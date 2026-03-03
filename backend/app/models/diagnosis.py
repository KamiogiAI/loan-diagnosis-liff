"""
診断データモデル
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class EmploymentType(str, Enum):
    SEISHAIN = "正社員"
    KEIYAKU = "契約社員"
    HAKEN = "派遣社員"
    JIEIGYOU = "自営業"
    PART = "パート・アルバイト"
    OTHER = "その他"


class DiagnosisStatus(str, Enum):
    UNCONTACTED = "未連絡"
    CONTACTED = "連絡済み"
    MEETING = "面談予約"
    CLOSED = "成約"
    REJECTED = "見送り"


class DiagnosisInput(BaseModel):
    """診断入力データ"""
    lineUserId: str = Field(..., description="LINE ユーザーID")
    lineDisplayName: str = Field(..., description="LINE 表示名")
    income: int = Field(..., ge=0, le=100000000, description="年収（円）")
    incomeRange: str = Field(..., description="年収範囲（表示用）")
    age: int = Field(..., ge=18, le=64, description="年齢")
    employmentType: str = Field(..., description="雇用形態")
    totalDebt: float = Field(..., ge=0, description="他社借入合計（万円）")
    monthlyPayment: float = Field(..., ge=0, description="月々の返済額（万円）")
    yearsEmployed: int = Field(..., ge=0, description="勤続年数")
    contactName: Optional[str] = Field("", description="連絡先名前")
    contactPhone: Optional[str] = Field("", description="連絡先電話番号")
    consultType: Optional[str] = Field("", description="選択肢（結果だけ/詳細希望）")


class DiagnosisResult(BaseModel):
    """診断結果"""
    borrowableAmount: int = Field(..., description="借入可能額（円）")
    borrowableAmountMan: int = Field(..., description="借入可能額（万円）")
    repaymentRatio: float = Field(..., description="返済負担率")
    loanPeriod: int = Field(..., description="返済期間（年）")


class DiagnosisRecord(BaseModel):
    """診断レコード（Firestore保存用）"""
    id: Optional[str] = None
    lineUserId: str
    lineDisplayName: str
    input: dict
    result: dict
    contactName: str = ""
    contactPhone: str = ""
    consultType: str = ""
    status: str = DiagnosisStatus.UNCONTACTED.value
    memo: str = ""
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class DiagnosisUpdateInput(BaseModel):
    """診断更新入力"""
    status: Optional[str] = None
    memo: Optional[str] = None


class AdminLoginInput(BaseModel):
    """管理者ログイン入力"""
    username: str
    password: str
