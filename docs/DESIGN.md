# 住宅ローン簡易診断ツール 設計書

## 1. システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                         LINE                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ リッチメニュー │───▶│    LIFF     │───▶│  Messaging  │     │
│  └─────────────┘    │   (診断)    │    │     API     │     │
│                     └──────┬──────┘    └──────┬──────┘     │
└──────────────────────────────┼─────────────────┼────────────┘
                               │                 │
                               ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                      Cloud Run (Python)                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  /diagnose  │    │  /webhook   │    │   /admin    │     │
│  │  診断API    │    │ LINE通知    │    │  管理画面   │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Firestore                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ diagnoses   │    │   users     │    │   admins    │     │
│  │ (診断履歴)   │    │ (ユーザー)   │    │ (管理者)    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐
│  Resend (Mail)  │
│  運営通知        │
└─────────────────┘
```

## 2. ディレクトリ構成

```
loan_diagnosis_liff/
├── frontend/                    # フロントエンド (LIFF)
│   ├── index.html              # 診断フォーム
│   ├── result.html             # 結果画面
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── liff-init.js        # LIFF初期化
│   │   ├── form.js             # フォーム処理
│   │   ├── calculate.js        # 計算ロジック
│   │   └── api.js              # API通信
│   └── assets/
│       └── images/
│
├── backend/                     # バックエンド (Python/Cloud Run)
│   ├── main.py                 # エントリーポイント
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── app/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── diagnose.py     # 診断API
│   │   │   ├── webhook.py      # LINE Webhook
│   │   │   └── admin.py        # 管理画面API
│   │   ├── services/
│   │   │   ├── calculator.py   # 計算ロジック
│   │   │   ├── line.py         # LINE API
│   │   │   ├── mail.py         # メール送信
│   │   │   └── firestore.py    # DB操作
│   │   └── models/
│   │       └── diagnosis.py    # データモデル
│   └── tests/
│
├── admin/                       # 管理画面 (HTML/CSS/JS)
│   ├── index.html              # ログイン
│   ├── dashboard.html          # ダッシュボード
│   ├── css/
│   ├── js/
│   └── assets/
│
├── docs/
│   ├── DESIGN.md               # 設計書（本ファイル）
│   ├── API.md                  # API仕様
│   └── LINE_SETUP.md           # LINE設定手順書
│
└── README.md
```

## 3. データ設計

### 3.1 Firestore コレクション

#### `diagnoses` (診断履歴)
```json
{
  "id": "auto-generated",
  "lineUserId": "U1234567890abcdef",
  "lineDisplayName": "山田太郎",
  "input": {
    "income": 5000000,
    "incomeRange": "500〜600万",
    "age": 35,
    "employmentType": "正社員",
    "totalDebt": 1000000,
    "monthlyPayment": 30000,
    "yearsEmployed": 10
  },
  "result": {
    "borrowableAmount": 35000000,
    "repaymentRatio": 0.35,
    "loanPeriod": 35
  },
  "status": "未連絡",
  "createdAt": "2026-02-28T12:00:00Z",
  "updatedAt": "2026-02-28T12:00:00Z"
}
```

#### `admins` (管理者)
```json
{
  "id": "admin001",
  "email": "admin@example.com",
  "passwordHash": "hashed_password",
  "createdAt": "2026-02-28T00:00:00Z"
}
```

### 3.2 ステータス定義

| ステータス | 説明 |
|-----------|------|
| 未連絡 | 診断完了、未対応 |
| 連絡済み | 連絡済み |
| 面談予約 | 面談日程確定 |
| 成約 | 契約完了 |
| 見送り | 対応終了 |

## 4. API設計

### 4.1 診断API

#### POST /api/diagnose
診断を実行し、結果を保存・通知する。

**Request:**
```json
{
  "lineUserId": "U1234567890abcdef",
  "lineDisplayName": "山田太郎",
  "income": 5000000,
  "incomeRange": "500〜600万",
  "age": 35,
  "employmentType": "正社員",
  "totalDebt": 1000000,
  "monthlyPayment": 30000,
  "yearsEmployed": 10
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "borrowableAmount": 35000000,
    "repaymentRatio": 0.35,
    "loanPeriod": 35
  },
  "diagnosisId": "abc123"
}
```

### 4.2 管理画面API

#### GET /api/admin/diagnoses
診断履歴一覧を取得

#### PUT /api/admin/diagnoses/{id}/status
ステータスを更新

#### GET /api/admin/diagnoses/export
CSVエクスポート

## 5. 計算ロジック詳細

### 5.1 借入可能額の計算

```python
def calculate_borrowable_amount(
    income: int,          # 年収（円）
    age: int,             # 年齢
    monthly_payment: int  # 他社月返済額（円）
) -> int:
    # 返済負担率
    ratio = 0.30 if income < 4_000_000 else 0.35
    
    # 返済期間（35年 or 80歳-年齢 の短い方）
    loan_period = min(35, 80 - age)
    
    # 審査金利1.5%での100万円あたり月返済額
    # ※返済期間によって変動
    monthly_per_million = get_monthly_payment_per_million(1.5, loan_period)
    
    # 他社年間返済額
    annual_other_payment = monthly_payment * 12
    
    # 計算
    available_annual = income * ratio - annual_other_payment
    borrowable = (available_annual / 12) / monthly_per_million * 1_000_000
    
    return max(0, int(borrowable / 10000) * 10000)  # 万円単位で切り捨て
```

### 5.2 100万円あたり月返済額テーブル

| 返済期間 | 金利1.5%の月返済額 |
|---------|------------------|
| 35年 | 3,061円 |
| 30年 | 3,451円 |
| 25年 | 3,999円 |
| 20年 | 4,825円 |

## 6. セキュリティ

### 6.1 認証・認可
- 管理画面: Basic認証 or JWT
- LIFF: LINE認証（LIFF SDK）

### 6.2 データ保護
- Firestore セキュリティルール設定
- 環境変数での秘密情報管理
- HTTPS必須

### 6.3 入力バリデーション
- 年収: 0〜100,000,000円
- 年齢: 18〜80歳
- 他社借入: 0以上
- XSS対策

## 7. 環境変数

```env
# LINE
LIFF_ID=xxxx-xxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxx
LINE_CHANNEL_SECRET=xxxxx

# Firebase
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Resend
RESEND_API_KEY=re_xxxxx
NOTIFICATION_EMAIL=homesniper_contact@gac.free-up.jp

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=xxxxx
```

## 8. 開発フロー

### Phase 1: フロントエンド (3/3-3/4)
1. LIFF初期化・認証
2. 診断フォームUI
3. 計算ロジック（フロント版）
4. 結果表示画面

### Phase 2: バックエンド (3/4-3/6)
1. Cloud Run環境構築
2. 診断API
3. Firestore連携
4. メール通知

### Phase 3: 管理画面 (3/6-3/7)
1. ログイン機能
2. 診断履歴一覧
3. ステータス管理
4. CSVエクスポート

### Phase 4: LINE連携 (3/7-3/8)
1. Webhook設定
2. 結果通知メッセージ
3. リッチメニュー設定

### Phase 5: テスト・調整 (3/8-3/9)
1. 結合テスト
2. LINE実機テスト
3. バグ修正

---

**作成:** 千歳開発
**最終更新:** 2026-02-28
