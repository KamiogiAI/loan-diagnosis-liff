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
    
    1. 借入可能額を計算
    2. Firestoreに保存
    3. 運営にメール通知
    4. 結果を返却
    """
    try:
        # 計算
        result = calculate_borrowable_amount(
            income=input_data.income,
            age=input_data.age,
            monthly_payment=input_data.monthlyPayment
        )
        
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
        fs = FirestoreService()
        doc_id = fs.save_diagnosis(diagnosis_data)
        
        # メール通知（非同期でもいい）
        send_notification_email(diagnosis_data)
        
        return {
            "success": True,
            "diagnosisId": doc_id,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
