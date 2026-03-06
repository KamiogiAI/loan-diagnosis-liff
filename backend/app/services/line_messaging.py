"""
LINE Messaging API Service
診断完了時にユーザーへ結果を通知
"""
import os
import httpx
import logging

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


async def send_diagnosis_result(
    line_user_id: str,
    borrowable_amount: int,
    display_name: str = "",
    consult_type: str = ""
) -> bool:
    """
    診断結果をLINEで送信
    """
    access_token = await get_channel_access_token()
    if not access_token:
        logger.warning("No access token available, skipping LINE notification")
        return False
    
    if not line_user_id or line_user_id == "unknown" or line_user_id.startswith("dev_"):
        logger.warning("Invalid or dev line_user_id, skipping LINE notification")
        return False
    
    
    # 金額をフォーマット（万円単位）
    amount_man = borrowable_amount // 10000
    
    # 表示名の処理
    name_display = display_name if display_name else "お客"
    
    # メッセージ作成
    if consult_type == "相談希望":
        message_text = f"""🏠 住宅ローン診断結果

{name_display}様

診断が完了しました。

💰 借入可能額（目安）
約 {amount_man:,} 万円

ご相談のご希望をいただきありがとうございます。
担当者より改めてご連絡させていただきます。

※この金額はあくまで目安です。
実際の審査結果とは異なる場合がございます。"""
    else:
        message_text = f"""🏠 住宅ローン診断結果

{name_display}様

診断が完了しました。

💰 借入可能額（目安）
約 {amount_man:,} 万円

詳しいご相談をご希望の場合は、
このトーク画面で「詳細希望」とお送りください。

※この金額はあくまで目安です。
実際の審査結果とは異なる場合がございます。"""
    
    # LINE Messaging API でプッシュメッセージ送信
    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}"
    }
    payload = {
        "to": line_user_id,
        "messages": [
            {
                "type": "text",
                "text": message_text
            }
        ]
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers, timeout=10.0)
            
            if response.status_code == 200:
                logger.info("LINE message sent successfully")
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
