"""
Firestore サービス
"""
import os
from datetime import datetime
from typing import Optional, List
from google.cloud import firestore


class FirestoreService:
    """Firestore操作クラス"""
    
    def __init__(self):
        self.db = firestore.Client()
        self.collection = self.db.collection("diagnoses")
    
    def _convert_datetime(self, data: dict) -> dict:
        """datetimeフィールドをISO文字列に変換"""
        if data.get("createdAt") and hasattr(data["createdAt"], "isoformat"):
            data["createdAt"] = data["createdAt"].isoformat() + "Z"
        if data.get("updatedAt") and hasattr(data["updatedAt"], "isoformat"):
            data["updatedAt"] = data["updatedAt"].isoformat() + "Z"
        return data
    
    def check_duplicate(self, line_user_id: str) -> Optional[dict]:
        """
        重複診断をチェック
        
        Args:
            line_user_id: LINE ユーザーID
        
        Returns:
            既存の診断データ（存在しない場合はNone）
        """
        docs = self.collection.where("lineUserId", "==", line_user_id).limit(1).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            return self._convert_datetime(data)
        return None
    
    def save_diagnosis(self, data: dict) -> str:
        """
        診断結果を保存
        
        Args:
            data: 診断データ
        
        Returns:
            ドキュメントID
        """
        now = datetime.utcnow()
        data["createdAt"] = now
        data["updatedAt"] = now
        data["status"] = "未連絡"
        data["memo"] = ""
        
        doc_ref = self.collection.add(data)
        return doc_ref[1].id
    
    def get_diagnosis(self, doc_id: str) -> Optional[dict]:
        """
        診断結果を取得
        
        Args:
            doc_id: ドキュメントID
        
        Returns:
            診断データ（存在しない場合はNone）
        """
        doc = self.collection.document(doc_id).get()
        if doc.exists:
            data = doc.to_dict()
            data["id"] = doc.id
            return self._convert_datetime(data)
        return None
    
    def list_diagnoses(
        self,
        status: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> tuple[List[dict], int]:
        """
        診断履歴一覧を取得
        
        Returns:
            (診断リスト, 総件数)
        """
        # 基本クエリ（createdAtでソート）
        query = self.collection.order_by("createdAt", direction=firestore.Query.DESCENDING)
        
        # ステータスフィルタのみ適用（Firestoreの複合クエリ制限を回避）
        if status:
            query = query.where("status", "==", status)
        
        # 全件取得
        all_docs = list(query.stream())
        
        # クライアントサイドでフィルタリング
        filtered_docs = []
        for doc in all_docs:
            data = doc.to_dict()
            
            # 日付フィルタ
            if from_date:
                from_dt = datetime.strptime(from_date, "%Y-%m-%d")
                created_at = data.get("createdAt")
                if created_at and created_at < from_dt:
                    continue
            
            if to_date:
                to_dt = datetime.strptime(to_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                created_at = data.get("createdAt")
                if created_at and created_at > to_dt:
                    continue
            
            # 検索フィルタ
            if search:
                display_name = data.get("lineDisplayName", "").lower()
                if search.lower() not in display_name:
                    continue
            
            filtered_docs.append(doc)
        
        total = len(filtered_docs)
        
        # ページネーション
        paginated_docs = filtered_docs[offset:offset + limit]
        
        results = []
        for doc in paginated_docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(self._convert_datetime(data))
        
        return results, total
    
    def update_diagnosis(self, doc_id: str, data: dict) -> bool:
        """
        診断情報を更新
        
        Args:
            doc_id: ドキュメントID
            data: 更新データ
        
        Returns:
            成功/失敗
        """
        doc_ref = self.collection.document(doc_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return False
        
        data["updatedAt"] = datetime.utcnow()
        doc_ref.update(data)
        return True
    
    def get_stats(self) -> dict:
        """
        統計情報を取得
        """
        from datetime import date
        
        all_docs = list(self.collection.stream())
        total = len(all_docs)
        
        # 今日の件数
        today = date.today()
        today_count = 0
        
        # ステータス別カウント
        status_count = {
            "未連絡": 0,
            "連絡済み": 0,
            "面談予約": 0,
            "成約": 0,
            "見送り": 0
        }
        
        # 平均借入可能額
        total_borrowable = 0
        borrowable_count = 0
        
        for doc in all_docs:
            data = doc.to_dict()
            
            # 今日の件数
            created_at = data.get("createdAt")
            if created_at and hasattr(created_at, "date") and created_at.date() == today:
                today_count += 1
            
            # ステータス
            status = data.get("status", "未連絡")
            if status in status_count:
                status_count[status] += 1
            
            # 借入可能額
            result = data.get("result", {})
            if result.get("borrowableAmount"):
                total_borrowable += result["borrowableAmount"]
                borrowable_count += 1
        
        avg_borrowable = total_borrowable // borrowable_count if borrowable_count > 0 else 0
        
        return {
            "total": total,
            "today": today_count,
            "byStatus": status_count,
            "averageBorrowable": avg_borrowable
        }
