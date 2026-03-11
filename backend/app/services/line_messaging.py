"""
LINE Messaging API Service
診断完了時にユーザーへ結果を通知
"""
import os
import httpx
import logging
from app.services.flex_messages import (
    get_diagnosis_card_message,
    get_result_card_message,
    get_consult_response_message,
    get_diagnosis_result_message
)
from app.services.settings import SettingsService

logger = logging.getLogger(__name__)

# 環境変数から設定を取得
LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")

# アクセストークンのキャッシュ
_access_token_cache = {"token": None, "expires_at": 0}


async def get_channel_access_token() -> str:
    """チャネルアクセストークンを取得（v2.0 Client Credentials方式）"""
    import time
    
    # キャッシュが有効ならそれを返す
    if _access_token_cache["token"] and _access_token_cache["expires_at"] > time.time():
        return _access_token_cache["token"]
    
    if not LINE_CHANNEL_ID or not LINE_CHANNEL_SECRET:
        logger.warning("LINE_CHANNEL_ID or LINE_CHANNEL_SECRET is not set")
        return ""
    
    url = "https://api.line.me/v2/oauth/accessToken"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": LINE_CHANNEL_ID,
        "client_secret": LINE_CHANNEL_SECRET
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, data=data, timeout=10.0)
            if response.status_code == 200:
                result = response.json()
                token = result.get("access_token", "")
                expires_in = result.get("expires_in", 0)
                # 有効期限の5分前にキャッシュを無効化
                _access_token_cache["token"] = token
                _access_token_cache["expires_at"] = time.time() + expires_in - 300
                return token
            else:
                logger.error(f"Failed to get access token: {response.status_code} - {response.text}")
                return ""
    except Exception as e:
        logger.error(f"Error getting access token: {e}")
        return ""


async def _send_push_message(user_id: str, messages: list) -> bool:
    """プッシュメッセージを送信"""
    access_token = await get_channel_access_token()
    if not access_token:
        logger.warning("No access token available, skipping LINE notification")
        return False
    
    if not user_id or user_id == "unknown" or user_id.startswith("dev_"):
        logger.warning("Invalid or dev user_id, skipping LINE notification")
        return False
    
    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    payload = {
        "to": user_id,
        "messages": messages
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            
            if response.status_code == 200:
                logger.info(f"LINE push message sent successfully to {user_id}")
                return True
            else:
                logger.error(f"LINE API error: {response.status_code} - {response.text}")
                return False
                
    except httpx.TimeoutException:
        logger.error("LINE API request timed out")
        return False
    except Exception as e:
        logger.error(f"Failed to send LINE message: {e}")
        return False


async def _send_reply_message(reply_token: str, messages: list) -> bool:
    """リプライメッセージを送信"""
    access_token = await get_channel_access_token()
    if not access_token:
        logger.warning("No access token available, skipping LINE reply")
        return False
    
    if not reply_token:
        logger.warning("No reply token, skipping LINE reply")
        return False
    
    url = "https://api.line.me/v2/bot/message/reply"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    payload = {
        "replyToken": reply_token,
        "messages": messages
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            
            if response.status_code == 200:
                logger.info("LINE reply message sent successfully")
                return True
            else:
                logger.error(f"LINE reply API error: {response.status_code} - {response.text}")
                return False
                
    except httpx.TimeoutException:
        logger.error("LINE reply API request timed out")
        return False
    except Exception as e:
        logger.error(f"Failed to send LINE reply: {e}")
        return False


def _get_diagnosis_card_image_url() -> str:
    """診断開始カードの画像URLを取得"""
    try:
        settings = SettingsService()
        return settings.get_card_image("diagnosis_start") or ""
    except Exception as e:
        logger.error(f"Failed to get card image URL: {e}")
        return ""


async def send_diagnosis_result(
    line_user_id: str,
    borrowable_amount: int,
    display_name: str = "",
    consult_type: str = ""
) -> bool:
    """
    診断結果をLINEで送信（診断完了直後）
    診断完了後にカードを送信し、ユーザーが「結果を見る」をタップするまで結果は送らない
    """
    # 診断完了カードを送信
    card_message = get_result_card_message()
    return await _send_push_message(line_user_id, [card_message])


async def send_diagnosis_result_by_user_id(user_id: str, reply_token: str = "") -> bool:
    """
    ユーザーIDから診断結果を取得して送信（「結果を見る」タップ時）
    """
    from app.services.firestore import FirestoreService
    
    fs = FirestoreService()
    diagnosis = fs.check_duplicate(user_id)
    
    if not diagnosis:
        # 診断データがない場合は診断を促す
        image_url = _get_diagnosis_card_image_url()
        card_message = get_diagnosis_card_message(image_url)
        if reply_token:
            return await _send_reply_message(reply_token, [card_message])
        else:
            return await _send_push_message(user_id, [card_message])
    
    result = diagnosis.get("result", {})
    borrowable_amount = result.get("borrowableAmount", 0)
    display_name = diagnosis.get("lineDisplayName", "")
    consult_type = diagnosis.get("consultType", "")
    
    result_message = get_diagnosis_result_message(
        borrowable_amount=borrowable_amount,
        display_name=display_name,
        consult_type=consult_type
    )
    
    if reply_token:
        return await _send_reply_message(reply_token, [result_message])
    else:
        return await _send_push_message(user_id, [result_message])


async def send_diagnosis_card(user_id: str, reply_token: str = "") -> bool:
    """診断開始カードを送信（友だち追加時など）"""
    image_url = _get_diagnosis_card_image_url()
    card_message = get_diagnosis_card_message(image_url)
    
    if reply_token:
        return await _send_reply_message(reply_token, [card_message])
    else:
        return await _send_push_message(user_id, [card_message])


async def send_consult_response(user_id: str, reply_token: str = "") -> bool:
    """相談希望への返信を送信"""
    response_message = get_consult_response_message()
    
    if reply_token:
        return await _send_reply_message(reply_token, [response_message])
    else:
        return await _send_push_message(user_id, [response_message])
