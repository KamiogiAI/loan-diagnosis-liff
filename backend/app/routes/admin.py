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
from pydantic import BaseModel
import io
import csv

from app.models.diagnosis import AdminLoginInput, DiagnosisUpdateInput
from app.services.firestore import FirestoreService
from app.services.settings import SettingsService

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


class PasswordChangeInput(BaseModel):
    current_password: str
    new_password: str

class UserCreateInput(BaseModel):
    username: str
    password: str

class EmailInput(BaseModel):
    email: str


def get_jwt_secret() -> str:
    return os.getenv("JWT_SECRET", "your-secret-key-change-in-production")


def verify_token(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="認証が必要です")
    try:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(status_code=401, detail="認証形式が不正です")
        payload = jwt.decode(parts[1], get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="トークンが期限切れです")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="トークンが不正です")


@router.post("/login")
async def login(input_data: AdminLoginInput):
    """ログイン（Firestoreのみ使用）"""
    settings = SettingsService()
    user = settings.get_user(input_data.username)
    
    if user:
        # Firestoreにユーザーが存在する場合
        if not pwd_context.verify(input_data.password, user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="パスワードが正しくありません")
    else:
        # Firestoreにユーザーがいない場合、初期adminアカウント（admin/admin123）を許可
        # ※初回ログイン後、管理画面でパスワード変更を推奨
        if input_data.username != "admin" or input_data.password != "admin123":
            raise HTTPException(status_code=401, detail="ユーザー名またはパスワードが正しくありません")
        # 初回ログイン時にDBにユーザーを作成
        password_hash = pwd_context.hash("admin123")
        settings.create_user("admin", password_hash)
    
    expiration = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    token = jwt.encode({"sub": input_data.username, "exp": expiration}, get_jwt_secret(), algorithm=JWT_ALGORITHM)
    return {"success": True, "token": token}


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
    fs = FirestoreService()
    diagnoses, total = fs.list_diagnoses(status=status, from_date=from_date, to_date=to_date, search=search, limit=limit, offset=offset)
    return {"success": True, "total": total, "diagnoses": diagnoses}


@router.get("/diagnoses/export")
async def export_diagnoses(
    status: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    _auth: dict = Depends(verify_token)
):
    fs = FirestoreService()
    diagnoses, _ = fs.list_diagnoses(status=status, from_date=from_date, to_date=to_date, limit=10000)
    
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(["ID", "LINE名", "お名前", "電話番号", "希望", "年収", "年齢", "雇用形態", "他社借入(万)", "月返済(万)", "勤続年数", "借入可能額(万)", "ステータス", "メモ", "診断日時"])
    
    for d in diagnoses:
        inp = d.get("input", {})
        res = d.get("result", {})
        writer.writerow([
            d.get("id", ""),
            d.get("lineDisplayName", ""),
            d.get("contactName", ""),
            d.get("contactPhone", ""),
            d.get("consultType", ""),
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
    filename = f"diagnoses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8-sig", headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.get("/diagnoses/{diagnosis_id}")
async def get_diagnosis(diagnosis_id: str, _auth: dict = Depends(verify_token)):
    fs = FirestoreService()
    diagnosis = fs.get_diagnosis(diagnosis_id)
    if not diagnosis:
        raise HTTPException(status_code=404, detail="診断が見つかりません")
    return {"success": True, "diagnosis": diagnosis}


@router.put("/diagnoses/{diagnosis_id}")
async def update_diagnosis(diagnosis_id: str, input_data: DiagnosisUpdateInput, _auth: dict = Depends(verify_token)):
    fs = FirestoreService()
    update_data = {}
    if input_data.status is not None:
        update_data["status"] = input_data.status
    if input_data.memo is not None:
        update_data["memo"] = input_data.memo
    if not update_data:
        raise HTTPException(status_code=400, detail="更新データがありません")
    
    if not fs.update_diagnosis(diagnosis_id, update_data):
        raise HTTPException(status_code=404, detail="診断が見つかりません")
    return {"success": True, "diagnosis": fs.get_diagnosis(diagnosis_id)}


@router.get("/stats")
async def get_stats(_auth: dict = Depends(verify_token)):
    fs = FirestoreService()
    return {"success": True, "stats": fs.get_stats()}


@router.get("/settings/emails")
async def get_notification_emails(_auth: dict = Depends(verify_token)):
    settings = SettingsService()
    emails = settings.get_notification_emails()
    return {"success": True, "emails": emails}


@router.post("/settings/emails")
async def add_notification_email(input_data: EmailInput, _auth: dict = Depends(verify_token)):
    settings = SettingsService()
    if not settings.add_notification_email(input_data.email):
        raise HTTPException(status_code=400, detail="既に登録されています")
    return {"success": True, "message": "追加しました"}


@router.delete("/settings/emails")
async def remove_notification_email(email: str = Query(...), _auth: dict = Depends(verify_token)):
    settings = SettingsService()
    if not settings.remove_notification_email(email):
        raise HTTPException(status_code=404, detail="見つかりません")
    return {"success": True, "message": "削除しました"}


@router.get("/users")
async def list_users(_auth: dict = Depends(verify_token)):
    settings = SettingsService()
    users = settings.get_users()
    return {"success": True, "users": users}


@router.post("/users")
async def create_user(input_data: UserCreateInput, _auth: dict = Depends(verify_token)):
    settings = SettingsService()
    password_hash = pwd_context.hash(input_data.password)
    if not settings.create_user(input_data.username, password_hash):
        raise HTTPException(status_code=400, detail="既に存在します")
    return {"success": True, "message": "作成しました"}


@router.delete("/users/{username}")
async def delete_user(username: str, _auth: dict = Depends(verify_token)):
    settings = SettingsService()
    if not settings.delete_user(username):
        raise HTTPException(status_code=404, detail="見つかりません")
    return {"success": True, "message": "削除しました"}


@router.post("/users/change-password")
async def change_password(input_data: PasswordChangeInput, auth: dict = Depends(verify_token)):
    settings = SettingsService()
    username = auth.get("sub")
    user = settings.get_user(username)
    
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    if not pwd_context.verify(input_data.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="現在のパスワードが正しくありません")
    
    password_hash = pwd_context.hash(input_data.new_password)
    settings.update_password(username, password_hash)
    
    return {"success": True, "message": "パスワードを変更しました"}


@router.delete("/diagnoses/{diagnosis_id}")
async def delete_diagnosis(
    diagnosis_id: str,
    _auth: dict = Depends(verify_token)
):
    """診断データを削除"""
    fs = FirestoreService()
    try:
        fs.delete_diagnosis(diagnosis_id)
        return {"success": True, "message": "削除しました"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========== カード画像設定 ==========

class CardImageInput(BaseModel):
    key: str
    url: str


@router.get("/settings/card-images")
async def get_card_images(_auth: dict = Depends(verify_token)):
    """カード画像設定を取得"""
    settings = SettingsService()
    images = settings.get_card_images()
    return {"success": True, "images": images}


@router.post("/settings/card-images")
async def set_card_image(input_data: CardImageInput, _auth: dict = Depends(verify_token)):
    """カード画像URLを設定"""
    settings = SettingsService()
    settings.set_card_image(input_data.key, input_data.url)
    return {"success": True, "message": "設定しました"}


@router.delete("/settings/card-images/{key}")
async def delete_card_image(key: str, _auth: dict = Depends(verify_token)):
    """カード画像URLを削除"""
    settings = SettingsService()
    if not settings.remove_card_image(key):
        raise HTTPException(status_code=404, detail="見つかりません")
    return {"success": True, "message": "削除しました"}


@router.delete("/diagnoses/{diagnosis_id}")
async def delete_diagnosis(
    diagnosis_id: str,
    _user: dict = Depends(verify_admin_token)
):
    """診断データを削除（物理削除）"""
    try:
        fs = FirestoreService()
        fs.delete_diagnosis(diagnosis_id)
        return {"success": True, "message": "削除しました"}
    except Exception as e:
        logger.error(f"Delete diagnosis error: {e}")
        raise HTTPException(status_code=500, detail="削除に失敗しました")
