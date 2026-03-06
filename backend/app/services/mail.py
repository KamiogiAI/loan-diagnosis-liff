"""
メール通知サービス（Resend）
"""
import os
import time
import resend
from typing import List
from .settings import SettingsService


def send_notification_email(diagnosis_data: dict) -> bool:
    """
    運営への通知メールを送信（Firestoreの通知先のみ使用、5秒間隔）
    """
    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("FROM_EMAIL", "noreply@free-up.jp")
    
    if not api_key:
        print("Warning: RESEND_API_KEY not set")
        return False
    
    resend.api_key = api_key
    
    # 通知先をFirestoreから取得（環境変数は使用しない）
    settings = SettingsService()
    emails = settings.get_notification_emails()
    
    if not emails:
        print("Warning: No notification emails configured in Firestore")
        return False
    
    # メール本文作成
    input_data = diagnosis_data.get("input", {})
    result_data = diagnosis_data.get("result", {})
    
    borrowable_man = result_data.get('borrowableAmountMan', 0) or 0
    ratio = result_data.get('repaymentRatio', 0) or 0
    loan_period = result_data.get('loanPeriod', 0) or 0
    
    html_content = f"""
    <h2>🏠 新規診断がありました</h2>
    
    <h3>■ ユーザー情報</h3>
    <ul>
        <li><strong>LINE名:</strong> {diagnosis_data.get('lineDisplayName', '不明')}</li>
        <li><strong>LINE ID:</strong> {diagnosis_data.get('lineUserId', '不明')}</li>
        <li><strong>お名前:</strong> {diagnosis_data.get('contactName', '-') or '-'}</li>
        <li><strong>電話番号:</strong> {diagnosis_data.get('contactPhone', '-') or '-'}</li>
        <li><strong>希望:</strong> {diagnosis_data.get('consultType', '-') or '-'}</li>
    </ul>
    
    <h3>■ 入力内容</h3>
    <ul>
        <li><strong>年収:</strong> {input_data.get('incomeRange', '不明')}</li>
        <li><strong>年齢:</strong> {input_data.get('age', '不明')}歳</li>
        <li><strong>雇用形態:</strong> {input_data.get('employmentType', '不明')}</li>
        <li><strong>他社借入合計:</strong> {input_data.get('totalDebt', 0)}万円</li>
        <li><strong>月々の返済額:</strong> {input_data.get('monthlyPayment', 0)}万円</li>
        <li><strong>勤続年数:</strong> {input_data.get('yearsEmployed', 0)}年</li>
    </ul>
    
    <h3>■ 診断結果</h3>
    <ul>
        <li><strong>借入可能額:</strong> 約{borrowable_man:,}万円</li>
        <li><strong>返済負担率:</strong> {int(ratio * 100)}%</li>
        <li><strong>返済期間:</strong> {loan_period}年</li>
    </ul>
    
    <p style="margin-top: 20px; color: #666;">
        ※ このメールは自動送信されています。<br>
        ユーザーへの連絡は管理画面から行ってください。
    </p>
    """
    
    subject = f"【新規診断】{diagnosis_data.get('lineDisplayName', '不明')}様"
    success_count = 0
    
    # 5秒間隔で送信
    for i, email in enumerate(emails):
        if i > 0:
            time.sleep(5)  # 5秒待機
        
        try:
            params = {
                "from": f"住宅ローン診断 <{from_email}>",
                "to": [email],
                "subject": subject,
                "html": html_content
            }
            response = resend.Emails.send(params)
            print(f"Email sent to {email}: {response}")
            success_count += 1
        except Exception as e:
            print(f"Error sending email to {email}: {e}")
    
    return success_count > 0
