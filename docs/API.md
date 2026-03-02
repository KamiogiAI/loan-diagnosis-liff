# API仕様書

## Base URL
```
本番: https://loan-diagnosis-api-xxxxx-an.a.run.app
開発: http://localhost:8080
```

## 認証

### LIFF API
- LIFFアクセストークンをAuthorizationヘッダーに付与
- `Authorization: Bearer {liff_access_token}`

### 管理画面API
- Basic認証 or JWTトークン
- `Authorization: Bearer {jwt_token}`

---

## 1. 診断API

### POST /api/diagnose

診断を実行し、結果をFirestoreに保存、運営にメール通知する。

#### Request Body
```json
{
  "lineUserId": "U1234567890abcdef",
  "lineDisplayName": "山田太郎",
  "income": 5000000,
  "incomeRange": "500〜600万",
  "age": 35,
  "employmentType": "正社員",
  "totalDebt": 100,
  "monthlyPayment": 3,
  "yearsEmployed": 10
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| lineUserId | string | ○ | LINE ユーザーID |
| lineDisplayName | string | ○ | LINE 表示名 |
| income | number | ○ | 年収（円） |
| incomeRange | string | ○ | 年収範囲（表示用） |
| age | number | ○ | 年齢 |
| employmentType | string | ○ | 雇用形態 |
| totalDebt | number | ○ | 他社借入合計（万円） |
| monthlyPayment | number | ○ | 月々の返済額（万円） |
| yearsEmployed | number | ○ | 勤続年数 |

#### Response (200 OK)
```json
{
  "success": true,
  "diagnosisId": "abc123xyz",
  "result": {
    "borrowableAmount": 35000000,
    "borrowableAmountMan": 3500,
    "repaymentRatio": 0.35,
    "loanPeriod": 35
  }
}
```

---

## 2. 管理画面API

### POST /api/admin/login

#### Request Body
```json
{
  "username": "admin",
  "password": "password123"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

### GET /api/admin/diagnoses

診断履歴一覧を取得

#### Query Parameters
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| status | string | ステータスでフィルタ |
| from | string | 開始日（YYYY-MM-DD） |
| to | string | 終了日（YYYY-MM-DD） |
| limit | number | 取得件数（デフォルト: 50） |
| search | string | 検索キーワード（名前） |

---

### PUT /api/admin/diagnoses/{id}

診断情報を更新（ステータス、メモ）

#### Request Body
```json
{
  "status": "連絡済み",
  "memo": "3/5に電話済み"
}
```

---

### GET /api/admin/diagnoses/export

CSVエクスポート（text/csv）

---

### GET /api/admin/stats

統計情報を取得

---

## 3. ヘルスチェック

### GET /health

```json
{
  "status": "ok",
  "timestamp": "2026-03-01T12:00:00Z"
}
```

---

**作成:** 千歳開発
**最終更新:** 2026-03-02
