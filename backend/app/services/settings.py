"""
設定サービス
"""
from datetime import datetime
from typing import Optional, List
from google.cloud import firestore


class SettingsService:
    """設定管理サービス"""
    
    def __init__(self):
        self.db = firestore.Client()
        self.settings_ref = self.db.collection("settings").document("app")
        self.users_ref = self.db.collection("admin_users")
    
    def _init_settings(self):
        """設定が存在しなければ初期化"""
        doc = self.settings_ref.get()
        if not doc.exists:
            self.settings_ref.set({
                "notification_emails": [],
                "card_images": {},
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            })
    
    # ========== メール通知先 ==========
    
    def get_notification_emails(self) -> List[str]:
        """通知先メールアドレス一覧を取得"""
        self._init_settings()
        doc = self.settings_ref.get()
        return doc.to_dict().get("notification_emails", [])
    
    def add_notification_email(self, email: str) -> bool:
        """通知先メールアドレスを追加"""
        self._init_settings()
        emails = self.get_notification_emails()
        if email in emails:
            return False  # 既に存在
        emails.append(email)
        self.settings_ref.update({
            "notification_emails": emails,
            "updated_at": datetime.utcnow()
        })
        return True
    
    def remove_notification_email(self, email: str) -> bool:
        """通知先メールアドレスを削除"""
        self._init_settings()
        emails = self.get_notification_emails()
        if email not in emails:
            return False
        emails.remove(email)
        self.settings_ref.update({
            "notification_emails": emails,
            "updated_at": datetime.utcnow()
        })
        return True
    
    # ========== カード画像設定 ==========
    
    def get_card_images(self) -> dict:
        """カード画像設定を取得"""
        self._init_settings()
        doc = self.settings_ref.get()
        return doc.to_dict().get("card_images", {})
    
    def get_card_image(self, key: str) -> Optional[str]:
        """特定のカード画像URLを取得"""
        images = self.get_card_images()
        return images.get(key)
    
    def set_card_image(self, key: str, url: str) -> bool:
        """カード画像URLを設定"""
        self._init_settings()
        images = self.get_card_images()
        images[key] = url
        self.settings_ref.update({
            "card_images": images,
            "updated_at": datetime.utcnow()
        })
        return True
    
    def remove_card_image(self, key: str) -> bool:
        """カード画像URLを削除"""
        self._init_settings()
        images = self.get_card_images()
        if key not in images:
            return False
        del images[key]
        self.settings_ref.update({
            "card_images": images,
            "updated_at": datetime.utcnow()
        })
        return True
    
    # ========== 管理者ユーザー ==========
    
    def get_users(self) -> List[dict]:
        """管理者ユーザー一覧を取得"""
        docs = self.users_ref.stream()
        users = []
        for doc in docs:
            data = doc.to_dict()
            users.append({
                "id": doc.id,
                "username": data.get("username"),
                "created_at": data.get("created_at")
            })
        return users
    
    def get_user(self, username: str) -> Optional[dict]:
        """管理者ユーザーを取得"""
        docs = self.users_ref.where("username", "==", username).limit(1).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            return data
        return None
    
    def create_user(self, username: str, password_hash: str) -> bool:
        """管理者ユーザーを作成"""
        if self.get_user(username):
            return False  # 既に存在
        self.users_ref.add({
            "username": username,
            "password_hash": password_hash,
            "created_at": datetime.utcnow()
        })
        return True
    
    def update_password(self, username: str, password_hash: str) -> bool:
        """パスワードを更新"""
        docs = self.users_ref.where("username", "==", username).limit(1).stream()
        for doc in docs:
            self.users_ref.document(doc.id).update({
                "password_hash": password_hash,
                "updated_at": datetime.utcnow()
            })
            return True
        return False
    
    def delete_user(self, username: str) -> bool:
        """管理者ユーザーを削除"""
        docs = self.users_ref.where("username", "==", username).limit(1).stream()
        for doc in docs:
            self.users_ref.document(doc.id).delete()
            return True
        return False
