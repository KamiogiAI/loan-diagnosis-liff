"""
LIFF検証（簡易版）
"""
import os
import httpx
from fastapi import Request, HTTPException


# 許可されたOrigin
ALLOWED_ORIGINS = [
    "https://liff.line.me",
    "https://kamiogiai.github.io",
    "https://loan.free-up.jp",
    "https://loan-diagnosis-freeup.web.app",
]

# 開発環境用
if os.getenv("ENV") == "development":
    ALLOWED_ORIGINS.extend(["http://localhost:3000", "http://127.0.0.1:5500"])


def verify_liff_request(request: Request):
    """
    LIFFからのリクエストか検証（簡易版）
    - Originヘッダーチェック
    - Refererヘッダーチェック
    """
    origin = request.headers.get("origin", "")
    referer = request.headers.get("referer", "")
    
    # Originチェック
    origin_ok = any(origin.startswith(allowed) for allowed in ALLOWED_ORIGINS)
    
    # Refererチェック
    referer_ok = any(referer.startswith(allowed) for allowed in ALLOWED_ORIGINS)
    
    if not origin_ok and not referer_ok:
        raise HTTPException(
            status_code=403,
            detail="不正なリクエスト元です"
        )


async def verify_line_access_token(access_token: str) -> dict:
    """
    LINEアクセストークンを検証（正式版）
    https://developers.line.biz/ja/reference/liff-server-api/
    """
    if not access_token:
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            # トークン検証API
            res = await client.get(
                "https://api.line.me/oauth2/v2.1/verify",
                params={"access_token": access_token}
            )
            
            if res.status_code != 200:
                return None
            
            data = res.json()
            # expires_in が正の値であれば有効
            if data.get("expires_in", 0) <= 0:
                return None
            
            return data
    except Exception as e:
        print(f"Token verification error: {e}")
        return None


async def get_line_profile(access_token: str) -> dict:
    """
    LINEプロフィールを取得
    """
    if not access_token:
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://api.line.me/v2/profile",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if res.status_code != 200:
                return None
            
            return res.json()
    except Exception as e:
        print(f"Profile fetch error: {e}")
        return None
