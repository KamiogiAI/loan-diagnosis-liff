# 住宅ローン簡易診断ツール (LIFF)

LINE公式アカウント上で動作する住宅ローン簡易診断ツール

## 技術スタック

- **フロントエンド:** HTML/CSS/JavaScript (LIFF)
- **バックエンド:** Python (Cloud Run)
- **データベース:** Firebase Firestore
- **メール送信:** Resend
- **ホスティング:** Cloud Run / GitHub Pages (フロント)

## ディレクトリ構成

```
├── frontend/          # LIFF診断フォーム
├── backend/           # Python API (Cloud Run)
├── admin/             # 管理画面
└── docs/              # ドキュメント
```

## セットアップ

### フロントエンド

```bash
cd frontend
# ローカルサーバーで確認
python -m http.server 8080
```

### バックエンド

```bash
cd backend
pip install -r requirements.txt
python main.py
```

### デプロイ

```bash
# Cloud Run
gcloud run deploy loan-diagnosis --source ./backend
```

## ドキュメント

- [設計書](docs/DESIGN.md)
- [API仕様](docs/API.md)
- [LINE設定手順](docs/LINE_SETUP.md)

## 開発者

千歳開発
