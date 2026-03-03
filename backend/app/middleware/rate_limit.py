"""
レートリミット（簡易版・メモリベース）
"""
import time
from collections import defaultdict
from fastapi import Request, HTTPException

# IPごとのリクエスト履歴
request_history = defaultdict(list)

# 設定（緩め）
RATE_LIMIT_WINDOW = 60  # 60秒
RATE_LIMIT_MAX = 30      # 60秒間に30リクエストまで


def check_rate_limit(request: Request):
    """レートリミットをチェック"""
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    
    now = time.time()
    request_history[ip] = [t for t in request_history[ip] if t > now - RATE_LIMIT_WINDOW]
    
    if len(request_history[ip]) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="リクエストが多すぎます。しばらく待ってからお試しください。")
    
    request_history[ip].append(now)
