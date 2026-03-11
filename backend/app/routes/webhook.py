"""
LINE Webhook API
LINEからのメッセージを受信して処理
"""
import os
import hashlib
import hmac
import base64
import logging
import asyncio
import time
from fastapi import APIRouter, Request, HTTPException, Header
from app.services.firestore import FirestoreService
from app.services.line_messaging import (
    send_diagnosis_card,
    send_diagnosis_result_by_user_id
)

logger = logging.getLogger(__name__)
router = APIRouter()

LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")


def verify_signature(body: bytes, signature: str) -> bool:
    """LINE署名を検証"""
    if not LINE_CHANNEL_SECRET:
        logger.warning("LINE_CHANNEL_SECRET not set, skipping signature verification")
        return True
    
    hash_value = hmac.new(
        LINE_CHANNEL_SECRET.encode("utf-8"),
        body,
        hashlib.sha256
    ).digest()
    
    expected_signature = base64.b64encode(hash_value).decode("utf-8")
    return hmac.compare_digest(signature, expected_signature)


@router.post("/webhook")
async def handle_webhook(
    request: Request,
    x_line_signature: str = Header(None, alias="X-Line-Signature")
):
    """
    LINE Webhookエンドポイント
    「結果を見る」などのメッセージを検知して診断結果を送信
    """
    body = await request.body()
    
    # 署名検証（本番環境では必須）
    if not x_line_signature:
        logger.warning("No X-Line-Signature header, rejecting request")
        raise HTTPException(status_code=400, detail="Missing signature")
    
    if not verify_signature(body, x_line_signature):
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    try:
        data = await request.json()
        events = data.get("events", [])
        
        for event in events:
            event_type = event.get("type")
            
            if event_type == "message":
                await handle_message_event(event)
            elif event_type == "follow":
                # 友だち追加時は非同期で処理（遅延なし）
                asyncio.create_task(handle_follow_event_delayed(event))
        
        return {"status": "ok"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        # LINEには200を返す（リトライ防止）
        return {"status": "ok"}


async def handle_message_event(event: dict):
    """メッセージイベントを処理"""
    message = event.get("message", {})
    message_type = message.get("type")
    
    if message_type != "text":
        return
    
    text = message.get("text", "").strip()
    source = event.get("source", {})
    user_id = source.get("userId", "")
    reply_token = event.get("replyToken", "")
    
    if not user_id:
        return
    
    # キーワード検知（完全一致のみ）
    keywords_result = ["結果を見る"]
    keywords_consult = ["詳細希望", "相談希望"]
    
    if text in keywords_result:
        # 診断結果を送信
        await send_diagnosis_result_by_user_id(user_id, reply_token)
    elif text in keywords_consult:
        # 相談希望として記録＆連絡
        fs = FirestoreService()
        existing = fs.check_duplicate(user_id)
        if existing:
            fs.update_diagnosis(existing["id"], {"consultType": "相談希望"})
        # 相談希望メッセージを送信
        from app.services.line_messaging import send_consult_response
        await send_consult_response(user_id, reply_token)


async def handle_follow_event_delayed(event: dict):
    """友だち追加イベントを処理（2秒遅延）"""
    await asyncio.sleep(2)
    
    start = time.time()
    
    source = event.get("source", {})
    user_id = source.get("userId", "")
    
    if not user_id:
        return
    
    # 友だち追加時は診断カードを送信
    await send_diagnosis_card(user_id, reply_token="")
    
    elapsed = time.time() - start
    logger.info(f"Follow event processed in {elapsed:.2f}s for user {user_id[:8]}...")
