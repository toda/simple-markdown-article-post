# Vue.js + Firebase Article Platform

## 概要
Vue.js 3とFirebaseを使用した記事投稿プラットフォーム

## 技術スタック
- Vue.js 3 (Composition API)
- Firebase Authentication
- Firestore Database
- Firebase Storage
- Firebase Hosting

## 開発コマンド

### 開発サーバー起動
```bash
npm run dev
```

### ビルド
```bash
npm run build
```

### デプロイ
```bash
firebase deploy --only hosting --project first-a8d80
```

### 型チェック・リント
```bash
npm run lint
npm run typecheck
```

## Firebase プロジェクト情報
- Project ID: first-a8d80
- Hosting URL: https://first-a8d80.web.app

## 主な機能
- メール/パスワード認証
- Google認証（iOS対応済み）
- GitHub認証
- 記事の作成・編集・削除
- 画像アップロード
- カテゴリ機能
- 記事検索

## 認証について
- iOS Safari対応のため、リダイレクト方式ではなくポップアップ方式を使用
- モバイル・デスクトップ共通でポップアップ認証

## 環境変数
```
VITE_API_KEY=
VITE_AUTH_DOMAIN=first-a8d80.firebaseapp.com
VITE_PROJECT_ID=first-a8d80
VITE_STORAGE_BUCKET=first-a8d80.firebasestorage.app
VITE_MESSAGING_SENDER_ID=
VITE_APP_ID=
```