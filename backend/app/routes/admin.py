"""
管理画面API
"""
import os
import jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import StreamingResponse
from passlib.context import CryptContext
import io
import csv

from app.models.diagnosis import AdminLoginInput, DiagnosisUpdateInput
from app.services.firestore import FirestoreService

router = APIRouter()

# パスワードハッシュ
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT設定
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def get_jwt_secret() -> str:
    """JWT秘密鍵を取得（環境変数から都度読み込み）"""
    return os.getenv("JWT_SECRET", "your-secret-key-change-in-production")


def verify_token(authorization: str = Header(None)) -> dict:
    """
    JWTトークンを検証
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="認証が必要です")
    
    try:
        # "Bearer {token}" 形式
        parts = authorization.split()
        if len(parts) != 2:
            raise HTTPException(status_code=401, detail="認証形式が不正です")
        
        scheme, token = parts
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="認証形式が不正です")
        
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="トークンが期限切れです")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="トークンが不正です")
    except Exception as e:
        raise HTTPException(status_code=401, detail="認証エラー")


@router.post("/login")
async def login(input_data: AdminLoginInput):
    """
    管理者ログイン
    """
    # 環境変数から認証情報を取得
    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "demo1234")
    
    # 認証チェック
    if input_data.username != admin_username or input_data.password != admin_password:
        raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが正しくありません")
    
    # JWTトークン生成
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": input_data.username,
        "exp": expiration
    }
    token = jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    
    return {
        "success": True,
        "token": token
    }


@router.get("/diagnoses")
async def list_diagnoses(
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _auth: dict = Depends(verify_token)
):
    """
    診断履歴一覧を取得
    """
    fs = FirestoreService()
    diagnoses, total = fs.list_diagnoses(
        status=status,
        from_date=from_date,
        to_date=to_date,
        search=search,
        limit=limit,
        offset=offset
    )
    
    return {
        "success": True,
        "total": total,
        "diagnoses": diagnoses
    }


@router.get("/diagnoses/export")
async def export_diagnoses(
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _auth: dict = Depends(verify_token)
):
    """
    CSVエクスポート（BOM付きUTF-8でExcel対応）
    """
    fs = FirestoreService()
    diagnoses, _ = fs.list_diagnoses(
        status=status,
        from_date=from_date,
        to_date=to_date,
        limit=10000
    )
    
    # CSV生成（BOM付きUTF-8）
    output = io.StringIO()
    # BOMを追加
    output.write('\ufeff')
    writer = csv.writer(output)
    
    # ヘッダー
    writer.writerow([
        "ID", "LINE名", "年収", "年齢", "雇用形態", 
        "他社借入(万)", "月返済(万)", "勤続年数",
        "借入可能額(万)", "ステータス", "メモ", "診断日時"
    ])
    
    # データ
    for d in diagnoses:
        inp = d.get("input", {})
        res = d.get("result", {})
        writer.writerow([
            d.get("id", ""),
            d.get("lineDisplayName", ""),
            inp.get("incomeRange", ""),
            inp.get("age", ""),
            inp.get("employmentType", ""),
            inp.get("totalDebt", ""),
            inp.get("monthlyPayment", ""),
            inp.get("yearsEmployed", ""),
            res.get("borrowableAmountMan", ""),
            d.get("status", ""),
            d.get("memo", ""),
            d.get("createdAt", "")
        ])
    
    output.seek(0)
    
    # ファイル名
    filename = f"diagnoses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/diagnoses/{diagnosis_id}")
async def get_diagnosis(
    diagnosis_id: str,
    _auth: dict = Depends(verify_token)
):
    """
    診断詳細を取得
    """
    fs = FirestoreService()
    diagnosis = fs.get_diagnosis(diagnosis_id)
    
    if not diagnosis:
        raise HTTPException(status_code=404, detail="診断が見つかりません")
    
    return {
        "success": True,
        "diagnosis": diagnosis
    }


@router.put("/diagnoses/{diagnosis_id}")
async def update_diagnosis(
    diagnosis_id: str,
    input_data: DiagnosisUpdateInput,
    _auth: dict = Depends(verify_token)
):
    """
    診断情報を更新
    """
    fs = FirestoreService()
    
    update_data = {}
    if input_data.status is not None:
        update_data["status"] = input_data.status
    if input_data.memo is not None:
        update_data["memo"] = input_data.memo
    
    if not update_data:
        raise HTTPException(status_code=400, detail="更新データがありません")
    
    success = fs.update_diagnosis(diagnosis_id, update_data)
    
    if not success:
        raise HTTPException(status_code=404, detail="診断が見つかりません")
    
    diagnosis = fs.get_diagnosis(diagnosis_id)
    
    return {
        "success": True,
        "diagnosis": diagnosis
    }


@router.get("/stats")
async def get_stats(_auth: dict = Depends(verify_token)):
    """
    統計情報を取得
    """
    fs = FirestoreService()
    stats = fs.get_stats()
    
    return {
        "success": True,
        "stats": stats
    }
