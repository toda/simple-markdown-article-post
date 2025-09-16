import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'
import app from '@/firebase/config'

const storage = getStorage(app)

export class StorageService {
  /**
   * 画像ファイルをアップロードしてURLを取得
   * @param {File} file - アップロードする画像ファイル
   * @param {string} path - 保存先パス（例: 'articles/userId/filename'）
   * @returns {Promise<string>} ダウンロードURL
   */
  static async uploadImage(file, path) {
    try {
      console.log('画像アップロード開始:', { file: file.name, path })

      // ファイルタイプ検証
      if (!file.type.startsWith('image/')) {
        throw new Error('画像ファイルのみアップロード可能です')
      }

      // ファイルサイズ検証（5MB制限）
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        throw new Error('ファイルサイズは5MB以下にしてください')
      }

      // Storage参照を作成
      const storageRef = ref(storage, path)

      // ファイルをアップロード
      console.log('Firebase Storageにアップロード中...')
      const snapshot = await uploadBytes(storageRef, file)
      console.log('アップロード完了:', snapshot.metadata.fullPath)

      // ダウンロードURLを取得
      const downloadURL = await getDownloadURL(snapshot.ref)
      console.log('ダウンロードURL取得:', downloadURL)

      return downloadURL
    } catch (error) {
      console.error('画像アップロードエラー:', error)

      // Firebase Storage特有のエラーを検出
      if (error.message.includes('CORS') ||
          error.message.includes('XMLHttpRequest') ||
          error.code === 'storage/unknown' ||
          error.code === 'storage/project-not-found') {
        throw new Error('Firebase Storageが設定されていません。管理者がFirebase ConsoleでStorageを有効化する必要があります。')
      }

      throw error
    }
  }

  /**
   * 画像ファイルを削除
   * @param {string} path - 削除するファイルのパス
   * @returns {Promise<void>}
   */
  static async deleteImage(path) {
    try {
      console.log('画像削除開始:', path)
      const storageRef = ref(storage, path)
      await deleteObject(storageRef)
      console.log('画像削除完了:', path)
    } catch (error) {
      console.error('画像削除エラー:', error)
      throw error
    }
  }

  /**
   * ファイル名から安全なパスを生成
   * @param {string} userId - ユーザーID
   * @param {string} filename - ファイル名
   * @returns {string} 安全なファイルパス
   */
  static generateImagePath(userId, filename) {
    // ファイル名を安全な形式に変換
    const timestamp = Date.now()
    const extension = filename.split('.').pop()
    const safeFilename = `${timestamp}.${extension}`

    return `articles/${userId}/${safeFilename}`
  }

  /**
   * URLからStorageパスを抽出
   * @param {string} url - Firebase Storage URL
   * @returns {string|null} Storageパス
   */
  static extractPathFromURL(url) {
    try {
      if (!url || !url.includes('firebase')) return null

      // URLからパスを抽出する正規表現
      const match = url.match(/\/o\/(.+?)\?/)
      if (match && match[1]) {
        return decodeURIComponent(match[1])
      }
      return null
    } catch (error) {
      console.error('URLからのパス抽出エラー:', error)
      return null
    }
  }
}