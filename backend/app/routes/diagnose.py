"""
診断API
"""
from fastapi import APIRouter, HTTPException, Request, Depends, Header, BackgroundTasks
from typing import Optional
from app.models.diagnosis import DiagnosisInput
from app.services.calculator import calculate_borrowable_amount
from app.services.firestore import FirestoreService
from app.services.mail import send_notification_email
from app.services.line_messaging import send_diagnosis_result
from app.middleware.rate_limit import check_rate_limit
from app.middleware.liff_verify import verify_liff_request, verify_line_access_token, get_line_profile

router = APIRouter()


async def verify_request(
    request: Request,
    x_liff_access_token: Optional[str] = Header(None, alias="X-LIFF-Access-Token")
):
    """リクエスト検証（レートリミット + Origin/Referer）"""
    check_rate_limit(request)
    verify_liff_request(request)
    
    if x_liff_access_token:
        token_info = await verify_line_access_token(x_liff_access_token)
        if not token_info:
            raise HTTPException(status_code=401, detail="無効なアクセストークンです")
        return token_info
    return None


async def send_line_notification(diagnosis_data: dict, result: dict):
    """LINEメッセージ送信（バックグラウンド実行用）"""
    try:
        await send_diagnosis_result(
            line_user_id=diagnosis_data.get("lineUserId", ""),
            borrowable_amount=result.get("borrowableAmount", 0),
            display_name=diagnosis_data.get("lineDisplayName", ""),
            consult_type=diagnosis_data.get("consultType", "")
        )
    except Exception as e:
        import logging
        logging.error(f"Failed to send LINE notification: {e}")


@router.get("/diagnose/check/{line_user_id}")
async def check_diagnosis(
    line_user_id: str,
    request: Request
):
    """診断済みかチェック（認証なし - LIFFからのアクセス用）"""
    try:
        check_rate_limit(request)
        
        fs = FirestoreService()
        existing = fs.check_duplicate(line_user_id)
        
        if existing:
            return {
                "exists": True,
                "diagnosisId": existing["id"],
                "result": existing.get("result", {})
            }
        return {"exists": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/diagnose")
async def diagnose(
    input_data: DiagnosisInput,
    request: Request,
    background_tasks: BackgroundTasks,
    _verify: dict = Depends(verify_request)
):
    """診断を実行"""
    try:
        if input_data.age >= 65:
            raise HTTPException(status_code=400, detail="65歳以上は返済期間が短くなるため診断できません")
        
        fs = FirestoreService()
        
        # 重複チェック
        existing = fs.check_duplicate(input_data.lineUserId)
        if existing:
            # 連絡先情報があれば更新
            if input_data.contactName or input_data.contactPhone:
                update_data = {}
                if input_data.contactName:
                    update_data["contactName"] = input_data.contactName
                if input_data.contactPhone:
                    update_data["contactPhone"] = input_data.contactPhone
                if input_data.consultType:
                    update_data["consultType"] = input_data.consultType
                if update_data:
                    fs.update_diagnosis(existing["id"], update_data)
            
            return {
                "success": True,
                "duplicate": True,
                "message": "既に診断済みです",
                "diagnosisId": existing["id"],
                "result": existing.get("result", {})
            }
        
        # 計算
        result = calculate_borrowable_amount(
            income=input_data.income,
            age=input_data.age,
            monthly_payment=input_data.monthlyPayment
        )
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 保存
        diagnosis_data = {
            "lineUserId": input_data.lineUserId,
            "lineDisplayName": input_data.lineDisplayName,
            "contactName": input_data.contactName or "",
            "contactPhone": input_data.contactPhone or "",
            "consultType": input_data.consultType or "",
            "input": {
                "income": input_data.income,
                "incomeRange": input_data.incomeRange,
                "age": input_data.age,
                "employmentType": input_data.employmentType,
                "totalDebt": input_data.totalDebt,
                "monthlyPayment": input_data.monthlyPayment,
                "yearsEmployed": input_data.yearsEmployed
            },
            "result": result
        }
        
        doc_id = fs.save_diagnosis(diagnosis_data)
        
        # 処理順序: LINE通知 → メール送信
        background_tasks.add_task(send_line_notification, diagnosis_data, result)
        background_tasks.add_task(send_notification_email, diagnosis_data)
        
        return {
            "success": True,
            "duplicate": False,
            "diagnosisId": doc_id,
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
