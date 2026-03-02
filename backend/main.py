"""
住宅ローン簡易診断ツール - Backend API
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import diagnose, admin

load_dotenv()

app = FastAPI(
    title="住宅ローン簡易診断API",
    description="LINE LIFF向け住宅ローン診断バックエンドAPI",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://liff.line.me",
        "https://kamiogiai.github.io",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター登録
app.include_router(diagnose.router, prefix="/api", tags=["診断"])
app.include_router(admin.router, prefix="/api/admin", tags=["管理画面"])


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    from datetime import datetime
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }


@app.get("/")
async def root():
    """ルート"""
    return {"message": "住宅ローン簡易診断API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
