# 記事投稿プラットフォーム

ZennやQiitaのような記事投稿プラットフォームです。Vue.js 3 + Firebase で構築されています。

## 機能

- **認証機能**
  - メール/パスワード認証
  - ソーシャルログイン（Google、GitHub）

- **記事機能**
  - Markdownでの記事作成・編集
  - 公開・非公開設定
  - カテゴリ・タグによる分類

- **検索機能**
  - テキスト検索
  - カテゴリ検索
  - タグ検索

- **交流機能**
  - コメント機能
  - いいね機能

- **ユーザー機能**
  - プロフィール編集
  - 投稿記事の管理

## 技術スタック

- **フロントエンド**: Vue.js 3, Vue Router, Pinia
- **バックエンド**: Firebase Firestore
- **認証**: Firebase Authentication
- **ホスティング**: Firebase Hosting
- **その他**: Marked (Markdown parser), Vite

## セットアップ

### 1. プロジェクトのクローン

```bash
git clone <repository-url>
cd article-platform
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Firebase プロジェクトの設定

1. [Firebase Console](https://console.firebase.google.com/) でプロジェクトを作成
2. Authentication を有効化し、メール/パスワード、Google、GitHub プロバイダーを設定
3. Firestore Database を作成
4. プロジェクト設定から設定情報を取得
5. `src/firebase/config.js` の設定を更新

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
}
```

### 4. Firestore セキュリティルールの設定

Firebase Console で Firestore のルールタブから `firestore.rules` の内容を設定してください。

### 5. 開発サーバーの起動

```bash
npm run dev
```

## デプロイ

### Firebase Hosting への デプロイ

1. Firebase CLI をインストール

```bash
npm install -g firebase-tools
```

2. Firebase にログイン

```bash
firebase login
```

3. Firebase プロジェクトを初期化

```bash
firebase init hosting
```

4. ビルド

```bash
npm run build
```

5. デプロイ

```bash
firebase deploy
```

## ディレクトリ構成

```
src/
├── assets/          # 静的ファイル
├── components/      # 再利用可能なコンポーネント
├── composables/     # Vue Composition API の共通ロジック
├── firebase/        # Firebase 設定
├── router/          # Vue Router 設定
├── services/        # ビジネスロジック
├── stores/          # Pinia ストア
├── utils/           # ユーティリティ関数
└── views/           # ページコンポーネント
```

## Firestore コレクション構成

- `users` - ユーザー情報
- `articles` - 記事情報
- `comments` - コメント情報
- `likes` - いいね情報
- `categories` - カテゴリマスタ（将来的に追加予定）
- `tags` - タグマスタ（将来的に追加予定）

## 今後の機能拡張予定

- [ ] 画像アップロード機能
- [ ] 通知機能
- [ ] フォロー機能
- [ ] 記事の下書き保存機能
- [ ] 収益化機能
- [ ] 管理画面

## ライセンス

MIT License