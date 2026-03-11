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
        for field in ["createdAt", "updatedAt"]:
            val = data.get(field)
            if val:
                if hasattr(val, "isoformat"):
                    # datetime objectの場合
                    data[field] = val.strftime("%Y-%m-%dT%H:%M:%SZ")
                elif isinstance(val, str) and "+00:00" in val:
                    # 既に文字列で+00:00Zになってる場合
                    data[field] = val.replace("+00:00Z", "Z").replace("+00:00", "Z")
        return data
    
    def check_duplicate(self, line_user_id: str) -> Optional[dict]:
        """重複診断をチェック"""
        docs = self.collection.where("lineUserId", "==", line_user_id).limit(1).stream()
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            return self._convert_datetime(data)
        return None
    
    def save_diagnosis(self, data: dict) -> str:
        """診断結果を保存"""
        now = datetime.utcnow()
        data["createdAt"] = now
        data["updatedAt"] = now
        data["status"] = "未連絡"
        data["memo"] = ""
        
        doc_ref = self.collection.add(data)
        return doc_ref[1].id
    
    def get_diagnosis(self, doc_id: str) -> Optional[dict]:
        """診断結果を取得"""
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
        """診断履歴一覧を取得"""
        query = self.collection.order_by("createdAt", direction=firestore.Query.DESCENDING)
        
        if status:
            query = query.where("status", "==", status)
        
        all_docs = list(query.stream())
        
        filtered_docs = []
        for doc in all_docs:
            data = doc.to_dict()
            
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
            
            if search:
                display_name = data.get("lineDisplayName", "").lower()
                if search.lower() not in display_name:
                    continue
            
            filtered_docs.append(doc)
        
        total = len(filtered_docs)
        paginated_docs = filtered_docs[offset:offset + limit]
        
        results = []
        for doc in paginated_docs:
            data = doc.to_dict()
            data["id"] = doc.id
            results.append(self._convert_datetime(data))
        
        return results, total
    
    def update_diagnosis(self, doc_id: str, data: dict) -> bool:
        """診断情報を更新"""
        doc_ref = self.collection.document(doc_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return False
        
        data["updatedAt"] = datetime.utcnow()
        doc_ref.update(data)
        return True
    
    def get_stats(self) -> dict:
        """統計情報を取得"""
        from datetime import date
        
        all_docs = list(self.collection.stream())
        total = len(all_docs)
        
        today = date.today()
        today_count = 0
        
        status_count = {
            "未連絡": 0,
            "連絡済み": 0,
            "面談予約": 0,
            "成約": 0,
            "見送り": 0
        }
        
        total_borrowable = 0
        borrowable_count = 0
        
        for doc in all_docs:
            data = doc.to_dict()
            
            created_at = data.get("createdAt")
            if created_at and hasattr(created_at, "date") and created_at.date() == today:
                today_count += 1
            
            status = data.get("status", "未連絡")
            if status in status_count:
                status_count[status] += 1
            
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

    def delete_diagnosis(self, diagnosis_id: str) -> bool:
        """診断データを削除"""
        try:
            self.db.collection("diagnoses").document(diagnosis_id).delete()
            return True
        except Exception as e:
            print(f"Error deleting diagnosis: {e}")
            raise e


