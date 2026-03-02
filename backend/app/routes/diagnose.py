"""
診断API
"""
from fastapi import APIRouter, HTTPException
from app.models.diagnosis import DiagnosisInput
from app.services.calculator import calculate_borrowable_amount
from app.services.firestore import FirestoreService
from app.services.mail import send_notification_email

router = APIRouter()


@router.post("/diagnose")
async def diagnose(input_data: DiagnosisInput):
    """
    診断を実行
    
    1. 年齢チェック（65歳以上は診断不可）
    2. 重複チェック（同じLINEユーザーの2回目以降を防止）
    3. 借入可能額を計算
    4. Firestoreに保存
    5. 運営にメール通知
    6. 結果を返却
    """
    try:
        # 年齢チェック
        if input_data.age >= 65:
            raise HTTPException(
                status_code=400, 
                detail="65歳以上は返済期間が短くなるため診断できません"
            )
        
        fs = FirestoreService()
        
        # 重複チェック
        existing = fs.check_duplicate(input_data.lineUserId)
        if existing:
            # 既に診断済みの場合は過去の結果を返す
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
        
        # 計算エラーチェック
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 保存データ作成
        diagnosis_data = {
            "lineUserId": input_data.lineUserId,
            "lineDisplayName": input_data.lineDisplayName,
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
        
        # Firestore保存
        doc_id = fs.save_diagnosis(diagnosis_data)
        
        # メール通知（非同期でもいい）
        send_notification_email(diagnosis_data)
        
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


@router.get("/diagnose/check/{line_user_id}")
async def check_diagnosis(line_user_id: str):
    """
    診断済みかチェック（フロントエンドから事前確認用）
    """
    try:
        fs = FirestoreService()
        existing = fs.check_duplicate(line_user_id)
        
        if existing:
            return {
                "exists": True,
                "diagnosisId": existing["id"],
                "result": existing.get("result", {})
            }
        
        return {
            "exists": False
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
