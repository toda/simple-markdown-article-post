# Firebase Storage セットアップガイド

## 現在の問題
画像アップロード時に以下のエラーが発生しています：
```
Access to XMLHttpRequest at 'https://firebasestorage.googleapis.com/...' has been blocked by CORS policy
```

このエラーはFirebase Storageが有効化されていないことが原因です。

## 解決手順

### 1. Firebase Console でStorage を有効化

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト「first-a8d80」を選択
3. 左メニューから「Storage」をクリック
4. 「始める」ボタンをクリック
5. セキュリティルールの設定：
   - 「本番環境モード」を選択
   - 「完了」をクリック
6. ロケーションを選択（推奨：asia-northeast1 (Tokyo)）

### 2. Google Cloud SDKのインストールと設定（必須）

✅ **Google Cloud SDKは既にインストール済みです。**
✅ **CORS設定は既に適用済みです。**

~~次に、以下の手順でCORS設定を適用してください：~~（完了済み）

```bash
# 1. Google Cloud にログイン（ブラウザでの認証が必要）
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud auth login

# 2. プロジェクトを設定
gcloud config set project first-a8d80

# 3. CORS設定を適用
gsutil cors set cors.json gs://first-a8d80.firebasestorage.app
```

**重要：** `gcloud auth login` を実行すると、ブラウザでの認証画面が開きます。以下のURLにアクセスして認証を完了してください：

```
https://accounts.google.com/o/oauth2/auth?response_type=code&client_id=32555940559.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fsdk.cloud.google.com%2Fauthcode.html&scope=openid+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcloud-platform+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fappengine.admin+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fsqlservice.login+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcompute+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Faccounts.reauth&state=H9uhPIQ93QnvjDTaRzLrUxKwkUXR1q&prompt=consent&token_usage=remote&access_type=offline&code_challenge=UFrkpC3c2tslt9kT32S_srSFLP5zTbKPlQRzMkGGA_M&code_challenge_method=S256
```

### 3. CORS設定の確認

設定後、以下のコマンドで CORS 設定が正しく適用されているか確認できます：

```bash
gsutil cors get gs://first-a8d80.firebasestorage.app
```

### 4. セキュリティルールのデプロイ

プロジェクトルートで以下のコマンドを実行：

```bash
# Firebase CLIをインストール（まだインストールしていない場合）
npm install -g firebase-tools

# Firebase にログイン
firebase login

# プロジェクトを初期化（まだ初期化していない場合）
firebase init

# Storageルールのみデプロイ
firebase deploy --only storage
```

### 5. 設定確認

1. Firebase Console の Storage タブで画像がアップロードできることを確認
2. アプリで画像アップロード機能をテスト

## 現在の対処法

Firebase Storage が設定されるまでの間：

1. 画像アップロードを試行
2. エラーが発生した場合、「画像なしで投稿しますか？」ダイアログが表示
3. 「OK」を選択して画像なしで記事を投稿

## セキュリティルール内容

`storage.rules` ファイルの内容：
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // 記事用画像のルール
    match /articles/{userId}/{imageId} {
      // 認証済みユーザーは自分のフォルダに画像をアップロード可能
      allow write: if request.auth != null && request.auth.uid == userId;
      // 画像は誰でも読み取り可能（記事表示のため）
      allow read: if true;
    }

    // その他のファイルは管理者のみ
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 注意事項

- Storage を有効化後、設定が反映されるまで数分かかる場合があります
- セキュリティルールの変更も反映まで時間がかかる場合があります
- 本番環境では適切なセキュリティルールを設定してください