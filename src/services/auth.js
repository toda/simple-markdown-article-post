import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, googleProvider, githubProvider, db } from '@/firebase/config'
import { DatabaseService } from '@/services/database'

export class AuthService {
  // モバイルデバイスの検出
  static isMobileDevice() {
    // より包括的なモバイル検出
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // スマートフォン・タブレットの検出
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i;

    // タッチデバイスかつ小さい画面の場合もモバイルとして扱う
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.screen.width <= 768 || window.innerWidth <= 768;

    const isMobile = mobileRegex.test(userAgent) || (isTouchDevice && isSmallScreen);

    console.log('🔍 モバイル検出詳細:', {
      userAgent,
      regexMatch: mobileRegex.test(userAgent),
      isTouchDevice,
      screenWidth: window.screen.width,
      innerWidth: window.innerWidth,
      isSmallScreen,
      finalResult: isMobile
    });

    return isMobile;
  }

  static async signInWithEmail(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // メール認証チェック（メール/パスワードユーザーのみ）
      const socialProviders = ['google.com', 'github.com']
      const isSocialLogin = user.providerData?.some(provider =>
        socialProviders.includes(provider.providerId)
      )

      if (!isSocialLogin && !user.emailVerified) {
        throw new Error('メールアドレスが認証されていません。メールをご確認ください。')
      }
      console.log('ログイン時のemailVerified:', user.emailVerified)

      return user
    } catch (error) {
      if (error.message === 'メールアドレスが認証されていません。メールをご確認ください。') {
        throw error
      }
      throw new Error(this.getErrorMessage(error.code))
    }
  }

  static async signUpWithEmail(email, password, displayName) {
    console.log('==== AuthService.signUpWithEmail 開始 ====')
    console.log('引数:', { email, password: '***', displayName })

    try {
      console.log('Firebase Authentication でユーザー作成中...')
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      console.log('Firebase Authentication 成功:', user.uid)

      try {
        console.log('プロフィール更新中...')
        // プロフィールを更新
        await updateProfile(user, { displayName })
        console.log('プロフィール更新成功')

        console.log('Firestore にユーザー情報保存中...')
        // Firestoreにユーザー情報を保存（ユニーク制約チェック込み）
        await DatabaseService.createUser(user.uid, {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          photoURL: user.photoURL || '',
          bio: '',
          emailVerified: user.emailVerified || false
        })
        console.log('Firestore ユーザー情報保存成功')

        console.log('メール認証送信中...')
        // メール認証を送信
        await sendEmailVerification(user)
        console.log('メール認証送信成功')

        console.log('==== AuthService.signUpWithEmail 成功 ====')
        return user
      } catch (dbError) {
        // Firestore保存でエラーが発生した場合、作成したAuthアカウントを削除
        console.error('==== Firestore 保存エラー ====')
        console.error('エラー詳細:', dbError)
        console.error('Auth アカウント削除を試行中...')
        try {
          await user.delete()
          console.log('Auth アカウント削除成功')
        } catch (deleteError) {
          console.error('Auth アカウント削除エラー:', deleteError)
        }
        throw dbError
      }
    } catch (error) {
      console.error('==== AuthService.signUpWithEmail エラー ====')
      console.error('エラーオブジェクト:', error)
      console.error('エラーメッセージ:', error.message)
      console.error('エラーコード:', error.code)
      console.error('==========================================')

      if (error.message === 'このユーザー名は既に使用されています') {
        throw error
      }
      throw new Error(this.getErrorMessage(error.code))
    }
  }

  static async signInWithGoogle() {
    try {
      console.log('🔍 AuthService: Google認証開始')
      console.log('📱 モバイルデバイス:', this.isMobileDevice())
      console.log('🌐 User Agent:', navigator.userAgent)

      // モバイルデバイスの場合は最初からリダイレクト方式を使用
      if (this.isMobileDevice()) {
        console.log('📱 AuthService: モバイルデバイス検出 - リダイレクト方式を使用')
        try {
          await signInWithRedirect(auth, googleProvider)
          return 'redirecting'
        } catch (redirectError) {
          console.error('❌ AuthService: リダイレクト認証失敗:', redirectError)
          throw new Error(this.getGoogleErrorMessage(redirectError))
        }
      } else {
        // デスクトップの場合はポップアップ方式を使用
        console.log('🖥️ AuthService: デスクトップデバイス - ポップアップ方式を使用')
        const userCredential = await signInWithPopup(auth, googleProvider)
        const user = userCredential.user

        console.log('✅ AuthService: ポップアップ認証成功:', user.email)

        // 初回ログインの場合、Firestoreにユーザー情報を保存
        await this.createUserDocument(user)

        return user
      }
    } catch (error) {
      console.error('❌ AuthService: Google認証エラー:', error.code, error.message)
      throw new Error(this.getGoogleErrorMessage(error))
    }
  }

  // リダイレクト結果の処理（モバイル用）
  static async handleRedirectResult() {
    try {
      console.log('🔍 AuthService: リダイレクト結果確認開始')
      const result = await getRedirectResult(auth)

      if (result && result.user) {
        console.log('✅ AuthService: リダイレクト認証成功:', result.user.email)

        // 初回ログインの場合、Firestoreにユーザー情報を保存
        await this.createUserDocument(result.user)

        return result.user
      } else {
        console.log('ℹ️ AuthService: リダイレクト結果なし')
        return null
      }
    } catch (error) {
      console.error('❌ AuthService: リダイレクト結果処理エラー:', error)
      throw new Error(this.getErrorMessage(error.code))
    }
  }

  static async signInWithGithub() {
    try {
      const userCredential = await signInWithPopup(auth, githubProvider)
      const user = userCredential.user
      
      // 初回ログインの場合、Firestoreにユーザー情報を保存
      await this.createUserDocument(user)
      
      return user
    } catch (error) {
      throw new Error(this.getErrorMessage(error.code))
    }
  }

  static async signOut() {
    try {
      await signOut(auth)
    } catch (error) {
      throw new Error('ログアウトに失敗しました')
    }
  }

  static onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback)
  }

  static getCurrentUser() {
    return auth.currentUser
  }

  static async sendEmailVerification() {
    try {
      const user = auth.currentUser
      if (!user) {
        throw new Error('ログインしてください')
      }
      await sendEmailVerification(user)
    } catch (error) {
      throw new Error('認証メールの送信に失敗しました')
    }
  }

  static async sendPasswordResetEmail(email) {
    try {
      console.log('🔐 パスワードリセットメール送信開始:', email)
      await sendPasswordResetEmail(auth, email)
      console.log('✅ パスワードリセットメール送信完了')
    } catch (error) {
      console.error('❌ パスワードリセットメール送信エラー:', error)
      throw new Error(this.getPasswordResetErrorMessage(error.code))
    }
  }

  static async checkEmailVerificationStatus() {
    try {
      const user = auth.currentUser
      if (!user) {
        console.log('❌ currentUserが存在しません')
        throw new Error('ログインしてください')
      }

      console.log('🔍 === AuthService: メール認証状態チェック開始 ===')
      console.log('📧 ユーザーEmail:', user.email)
      console.log('🆔 ユーザーUID:', user.uid)
      console.log('✉️ リフレッシュ前のemailVerified:', user.emailVerified)
      console.log('🕐 現在時刻:', new Date().toLocaleString())

      // Firebase Authからユーザー情報をリフレッシュ
      console.log('🔄 ユーザー情報をリフレッシュ中...')
      await reload(user)
      console.log('✅ ユーザー情報リフレッシュ完了')
      console.log('✉️ reload後のemailVerified:', user.emailVerified)

      // IDトークンも強制的にリフレッシュ
      console.log('🔑 IDトークンをリフレッシュ中...')
      try {
        const idToken = await user.getIdToken(true) // forceRefresh = true
        console.log('✅ IDトークンリフレッシュ完了')
        console.log('🔑 IDトークン先頭:', idToken ? idToken.substring(0, 50) + '...' : 'null')
      } catch (tokenError) {
        console.error('❌ IDトークンリフレッシュエラー:', tokenError)
      }

      // もう一度ユーザー情報をリフレッシュ（IDトークン更新後）
      console.log('🔄 最終ユーザー情報リフレッシュ中...')
      await reload(user)
      console.log('✅ 最終ユーザー情報リフレッシュ完了')

      console.log('✉️ 最終的なemailVerified:', user.emailVerified)
      console.log('📊 ユーザー完全情報:', {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        providerData: user.providerData?.map(p => ({
          providerId: p.providerId,
          email: p.email
        })),
        metadata: {
          creationTime: user.metadata?.creationTime,
          lastSignInTime: user.metadata?.lastSignInTime
        }
      })
      console.log('🔍 === AuthService: チェック完了 ===')

      // 最新の認証状態を取得
      return user.emailVerified
    } catch (error) {
      console.error('❌ メール認証状態チェックエラー:', error)
      console.error('❌ エラーの詳細:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      throw new Error('認証状態の確認に失敗しました')
    }
  }

  static async createUserDocument(user, additionalData = {}) {
    let displayName = user.displayName || additionalData.displayName || ''

    // ソーシャルログインでdisplayNameがある場合、ユニーク性を確保
    if (displayName) {
      displayName = await this.ensureUniqueDisplayName(displayName, user.uid)
    }

    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: displayName,
      photoURL: user.photoURL || '',
      bio: '',
      emailVerified: user.emailVerified || false,
      ...additionalData
    }

    try {
      // ユニーク制約チェック込みでユーザー作成
      await DatabaseService.createUser(user.uid, userData)
    } catch (error) {
      console.error('ユーザードキュメントの作成に失敗:', error)

      // displayName重複エラーの場合、番号付きで再試行
      if (error.message === 'このユーザー名は既に使用されています' && displayName) {
        console.log('displayName重複のため番号付きで再試行:', displayName)
        try {
          const uniqueDisplayName = await this.generateUniqueDisplayName(displayName, user.uid)
          const retryUserData = { ...userData, displayName: uniqueDisplayName }
          await DatabaseService.createUser(user.uid, retryUserData)
          console.log('番号付きdisplayNameで作成成功:', uniqueDisplayName)
        } catch (retryError) {
          console.error('番号付きdisplayNameでも失敗:', retryError)
          // 最終的にdisplayNameなしで作成
          const fallbackUserData = { ...userData, displayName: '' }
          await DatabaseService.createUser(user.uid, fallbackUserData)
          console.log('displayNameなしで作成成功')
        }
      } else {
        // その他のエラーの場合はdisplayNameなしで試行
        try {
          const fallbackUserData = { ...userData, displayName: '' }
          await DatabaseService.createUser(user.uid, fallbackUserData)
          console.log('フォールバック作成成功')
        } catch (fallbackError) {
          console.error('フォールバック作成も失敗:', fallbackError)
        }
      }
    }
  }

  // ユニークなdisplayNameを確保する（既存チェック付き）
  static async ensureUniqueDisplayName(baseDisplayName, uid) {
    try {
      const exists = await DatabaseService.checkDisplayNameExists(baseDisplayName, uid)
      if (!exists) {
        return baseDisplayName
      }

      // 重複する場合は番号付きで生成
      return await this.generateUniqueDisplayName(baseDisplayName, uid)
    } catch (error) {
      console.warn('ensureUniqueDisplayName: チェックエラー、元の名前を返す', error)
      return baseDisplayName
    }
  }

  // 番号付きでユニークなdisplayNameを生成
  static async generateUniqueDisplayName(baseDisplayName, uid) {
    for (let i = 2; i <= 100; i++) {
      const candidate = `${baseDisplayName}${i}`
      try {
        const exists = await DatabaseService.checkDisplayNameExists(candidate, uid)
        if (!exists) {
          console.log('generateUniqueDisplayName: 生成成功', candidate)
          return candidate
        }
      } catch (error) {
        console.warn(`generateUniqueDisplayName: チェックエラー (${candidate}):`, error)
        // エラーの場合はそのまま候補を返す
        return candidate
      }
    }

    // 100回試行しても見つからない場合は時刻を付与
    const timestamp = Date.now().toString().slice(-6)
    const fallback = `${baseDisplayName}_${timestamp}`
    console.log('generateUniqueDisplayName: 時刻付与フォールバック', fallback)
    return fallback
  }

  static getGoogleErrorMessage(error) {
    console.log('🔍 AuthService: Google認証詳細エラー情報:')
    console.log('- エラーコード:', error.code)
    console.log('- エラーメッセージ:', error.message)
    console.log('- エラースタック:', error.stack)
    console.log('- カスタムデータ:', error.customData)

    switch (error.code) {
      case 'auth/popup-blocked':
        return 'ポップアップがブロックされました。ポップアップを許可してください。'
      case 'auth/popup-closed-by-user':
        return 'ポップアップが閉じられました。'
      case 'auth/cancelled-popup-request':
        return 'ポップアップリクエストがキャンセルされました。'
      case 'auth/network-request-failed':
        return 'ネットワークエラーが発生しました。インターネット接続を確認してください。'
      case 'auth/internal-error':
        return '内部エラーが発生しました。時間をおいて再度お試しください。'
      case 'auth/unauthorized-domain':
        return '認証ドメインが許可されていません。'
      default:
        return error.message || 'Google認証でエラーが発生しました。'
    }
  }

  static getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': 'ユーザーが見つかりません',
      'auth/wrong-password': 'パスワードが間違っています',
      'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
      'auth/weak-password': 'パスワードは6文字以上で入力してください',
      'auth/invalid-email': 'メールアドレスの形式が正しくありません',
      'auth/user-disabled': 'このアカウントは無効になっています',
      'auth/too-many-requests': 'しばらく時間をおいてから再度お試しください',
      'auth/popup-closed-by-user': 'ログインがキャンセルされました',
      'auth/popup-blocked': 'ポップアップがブロックされました。ポップアップを許可してください',
      'auth/cancelled-popup-request': 'ログインがキャンセルされました'
    }

    return errorMessages[errorCode] || 'エラーが発生しました。再度お試しください'
  }

  static getPasswordResetErrorMessage(errorCode) {
    const errorMessages = {
      'auth/user-not-found': '指定されたメールアドレスのユーザーが見つかりません',
      'auth/invalid-email': 'メールアドレスの形式が正しくありません',
      'auth/too-many-requests': 'リクエストが多すぎます。しばらく時間をおいてから再度お試しください',
      'auth/user-disabled': 'このアカウントは無効になっています'
    }

    return errorMessages[errorCode] || 'パスワードリセットメールの送信に失敗しました。再度お試しください'
  }
}