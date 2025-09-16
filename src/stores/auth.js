import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { AuthService } from '@/services/auth'
import { DatabaseService } from '@/services/database'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const userProfile = ref(null)
  const loading = ref(true)
  const error = ref(null)

  const isAuthenticated = computed(() => {
    if (!user.value) return false

    // ソーシャルログインユーザー（Google/GitHub）は既にプロバイダー側で認証済み
    const socialProviders = ['google.com', 'github.com']
    const isSocialLogin = user.value.providerData?.some(provider =>
      socialProviders.includes(provider.providerId)
    )

    // ソーシャルログインまたはメール認証が完了している場合のみ認証済みとする
    return isSocialLogin || user.value.emailVerified === true
  })
  const currentUser = computed(() => user.value)
  const currentUserProfile = computed(() => userProfile.value)
  const isEmailVerificationRequired = computed(() => {
    if (!user.value) return false

    // ソーシャルログインユーザーは認証不要
    const socialProviders = ['google.com', 'github.com']
    const isSocialLogin = user.value.providerData?.some(provider =>
      socialProviders.includes(provider.providerId)
    )

    // メール/パスワードユーザーでメール未認証の場合は認証が必要
    return !isSocialLogin && user.value.emailVerified === false
  })

  let authStateUnsubscribe = null

  const initAuth = async () => {
    loading.value = true

    return new Promise((resolve) => {
      let initialized = false
      authStateUnsubscribe = AuthService.onAuthStateChanged(async (authUser) => {
        console.log('=== AuthStateChanged イベント発生 ===')
        console.log('authUser:', authUser ? {
          uid: authUser.uid,
          email: authUser.email,
          emailVerified: authUser.emailVerified,
          providerData: authUser.providerData
        } : null)

        if (authUser) {
          user.value = authUser
          try {
            const profile = await DatabaseService.getUser(authUser.uid)

            // Firebase AuthとFirestoreのemailVerified状態を同期
            console.log('Auth状態変更検出 - emailVerified同期チェック:')
            console.log('Firebase Auth emailVerified:', authUser.emailVerified)
            console.log('Firestore profile emailVerified:', profile?.emailVerified)

            if (profile && profile.emailVerified !== authUser.emailVerified) {
              console.log('emailVerified状態に差異があります。Firestoreを更新します。')
              await DatabaseService.updateUser(authUser.uid, { emailVerified: authUser.emailVerified })
              profile.emailVerified = authUser.emailVerified
              console.log('Firestore emailVerified更新完了:', authUser.emailVerified)
            } else {
              console.log('emailVerified状態は同期されています。')
            }

            userProfile.value = profile
            console.log('ユーザープロフィールを更新:', profile)
          } catch (err) {
            console.error('ユーザープロフィールの取得に失敗:', err)
            // プロフィール取得に失敗した場合でも基本情報は保持
            userProfile.value = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName || '',
              photoURL: authUser.photoURL || '',
              emailVerified: authUser.emailVerified || false
            }
          }
        } else {
          user.value = null
          userProfile.value = null
        }

        if (!initialized) {
          loading.value = false
          initialized = true
          resolve()
        }
      })
    })
  }

  const signInWithEmail = async (email, password) => {
    try {
      error.value = null
      loading.value = true
      const authUser = await AuthService.signInWithEmail(email, password)

      // ログイン成功後、即座にユーザー情報を更新
      if (authUser) {
        // まずAuthユーザー情報を設定（即座に表示更新）
        user.value = authUser

        try {
          const profile = await DatabaseService.getUser(authUser.uid)
          userProfile.value = profile
          console.log('ログイン成功時プロフィール取得:', profile)
        } catch (profileError) {
          console.error('プロフィール取得エラー:', profileError)
          // フォールバック情報を設定
          userProfile.value = {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || '',
            photoURL: authUser.photoURL || '',
            emailVerified: authUser.emailVerified || false
          }
        }
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const signUpWithEmail = async (email, password, displayName) => {
    try {
      error.value = null
      loading.value = true
      const authUser = await AuthService.signUpWithEmail(email, password, displayName)

      // 会員登録成功後、即座にユーザー情報を更新
      if (authUser) {
        // まずAuthユーザー情報を設定（即座に表示更新）
        user.value = authUser

        try {
          const profile = await DatabaseService.getUser(authUser.uid)
          userProfile.value = profile
          console.log('会員登録成功時プロフィール取得:', profile)
        } catch (profileError) {
          console.error('プロフィール取得エラー:', profileError)
          // フォールバック情報を設定
          userProfile.value = {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || displayName,
            photoURL: authUser.photoURL || ''
          }
        }
      }
    } catch (err) {
      console.error('==== signUpWithEmail エラー詳細 ====')
      console.error('エラーオブジェクト:', err)
      console.error('エラーメッセージ:', err.message)
      console.error('エラーコード:', err.code)
      console.error('エラータイプ:', typeof err)
      console.error('================================')

      error.value = err.message || '会員登録に失敗しました'
      throw err
    } finally {
      loading.value = false
    }
  }

  const signInWithGoogle = async () => {
    try {
      error.value = null
      loading.value = true
      const authUser = await AuthService.signInWithGoogle()

      // Googleログイン成功後、即座にユーザー情報を更新
      if (authUser) {
        // まずAuthユーザー情報を設定（即座に表示更新）
        user.value = authUser

        try {
          const profile = await DatabaseService.getUser(authUser.uid)
          userProfile.value = profile
          console.log('Googleログイン成功時プロフィール取得:', profile)
        } catch (profileError) {
          console.error('プロフィール取得エラー:', profileError)
          // フォールバック情報を設定
          userProfile.value = {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || '',
            photoURL: authUser.photoURL || '',
            emailVerified: authUser.emailVerified || false
          }
        }
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const signInWithGithub = async () => {
    try {
      error.value = null
      loading.value = true
      const authUser = await AuthService.signInWithGithub()

      // GitHubログイン成功後、即座にユーザー情報を更新
      if (authUser) {
        // まずAuthユーザー情報を設定（即座に表示更新）
        user.value = authUser

        try {
          const profile = await DatabaseService.getUser(authUser.uid)
          userProfile.value = profile
          console.log('GitHubログイン成功時プロフィール取得:', profile)
        } catch (profileError) {
          console.error('プロフィール取得エラー:', profileError)
          // フォールバック情報を設定
          userProfile.value = {
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName || '',
            photoURL: authUser.photoURL || '',
            emailVerified: authUser.emailVerified || false
          }
        }
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const signOut = async () => {
    try {
      error.value = null
      await AuthService.signOut()
      user.value = null
      userProfile.value = null
      if (authStateUnsubscribe) {
        authStateUnsubscribe()
        authStateUnsubscribe = null
      }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const updateUserProfile = async (profileData) => {
    try {
      error.value = null
      await DatabaseService.updateUser(user.value.uid, profileData)
      userProfile.value = { ...userProfile.value, ...profileData }
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const sendEmailVerification = async () => {
    try {
      error.value = null
      await AuthService.sendEmailVerification()
    } catch (err) {
      error.value = err.message
      throw err
    }
  }

  const checkEmailVerificationStatus = async () => {
    try {
      error.value = null

      console.log('🔍 === AuthStore: メール認証状態チェック開始 ===')
      console.log('🔸 チェック前のuser.emailVerified:', user.value?.emailVerified)
      console.log('🔸 チェック前のuserProfile.emailVerified:', userProfile.value?.emailVerified)
      console.log('🔸 チェック前のisAuthenticated:', isAuthenticated.value)

      const isVerified = await AuthService.checkEmailVerificationStatus()

      console.log('📊 AuthServiceから取得した結果:', isVerified)

      // 元のemailVerified状態を保存
      const oldEmailVerified = user.value?.emailVerified

      // Firebase Authからリフレッシュされたユーザー情報でAuthStoreのuserを更新
      const currentUser = AuthService.getCurrentUser()
      if (currentUser && user.value) {
        console.log('🔄 AuthStoreのuserオブジェクトを更新中...')
        console.log('🔸 更新前のuser.emailVerified:', user.value.emailVerified)
        console.log('🔸 Firebase Authのcurrent user emailVerified:', currentUser.emailVerified)

        // ユーザーオブジェクト全体を更新
        user.value = { ...currentUser }
        console.log('✅ AuthStore user更新完了')
        console.log('🔸 更新後のuser.emailVerified:', user.value.emailVerified)
        console.log('🔸 更新後のisAuthenticated:', isAuthenticated.value)
      } else {
        console.log('⚠️ currentUserまたはuserが存在しません')
        console.log('currentUser:', currentUser)
        console.log('user.value:', user.value)
      }

      // 認証状態が変わった場合、Firestoreも更新
      if (oldEmailVerified !== isVerified) {
        console.log('🔄 認証状態が変更されました:', oldEmailVerified, '→', isVerified)

        if (user.value?.uid) {
          // Firestoreのユーザー情報も更新
          console.log('💾 Firestoreを更新中...')
          try {
            await DatabaseService.updateUser(user.value.uid, { emailVerified: isVerified })
            console.log('✅ Firestore更新完了')
          } catch (firestoreError) {
            console.error('❌ Firestore更新エラー:', firestoreError)
          }

          // プロフィール情報も更新
          if (userProfile.value) {
            userProfile.value = { ...userProfile.value, emailVerified: isVerified }
            console.log('✅ プロフィール情報も更新完了')
          }
        }

        console.log('✅ メール認証状態を更新:', isVerified)
      } else {
        console.log('📍 認証状態に変更はありません')
      }

      console.log('🔍 === AuthStore: メール認証状態チェック完了 ===')
      console.log('🔸 最終的なuser.emailVerified:', user.value?.emailVerified)
      console.log('🔸 最終的なuserProfile.emailVerified:', userProfile.value?.emailVerified)
      console.log('🔸 最終的なisAuthenticated:', isAuthenticated.value)
      console.log('🔸 返り値:', isVerified)
      return isVerified
    } catch (err) {
      console.error('❌ AuthStore: メール認証状態チェックエラー:', err)
      error.value = err.message
      throw err
    }
  }

  const clearError = () => {
    error.value = null
  }

  // ページフォーカス時やvisibility変更時に認証状態をチェック
  let verificationInterval = null

  const setupVerificationCheck = () => {
    console.log('=== setupVerificationCheck 開始 ===')

    const checkVerificationOnFocus = async () => {
      if (user.value && !user.value.emailVerified) {
        console.log('📱 ページフォーカス検出 - メール認証状態をチェック')
        try {
          const isVerified = await checkEmailVerificationStatus()
          if (isVerified) {
            console.log('✅ フォーカス時チェックで認証完了を検出しました！')
          }
        } catch (error) {
          console.error('❌ フォーカス時の認証状態チェックエラー:', error)
        }
      }
    }

    // ページがフォーカスされた時
    window.addEventListener('focus', checkVerificationOnFocus)
    console.log('📱 フォーカスイベントリスナー設定完了')

    // visibilityが変わった時（タブ切り替え等）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ ページが表示状態になりました')
        checkVerificationOnFocus()
      }
    })
    console.log('👁️ visibilitychangeイベントリスナー設定完了')

    // 定期チェック開始（10秒間隔に短縮）
    const startPeriodicCheck = () => {
      if (verificationInterval) {
        console.log('⏰ 既存の定期チェックをクリア')
        clearInterval(verificationInterval)
      }

      console.log('⏰ 定期チェック開始（10秒間隔）')
      verificationInterval = setInterval(async () => {
        if (user.value && !user.value.emailVerified) {
          console.log('⏰ 定期チェック実行 - メール認証状態をチェック')
          try {
            const isVerified = await checkEmailVerificationStatus()
            if (isVerified) {
              console.log('✅ 定期チェックで認証完了を検出しました！')
              clearInterval(verificationInterval)
              verificationInterval = null
            }
          } catch (error) {
            console.error('❌ 定期チェック時の認証状態チェックエラー:', error)
          }
        } else if (user.value && user.value.emailVerified) {
          console.log('✅ ユーザーが認証済み - 定期チェック停止')
          clearInterval(verificationInterval)
          verificationInterval = null
        } else if (!user.value) {
          console.log('👤 ユーザーがログアウト - 定期チェック停止')
          clearInterval(verificationInterval)
          verificationInterval = null
        }
      }, 10000) // 10秒間隔に短縮
    }

    // 現在のユーザー状態をチェックして定期チェック開始
    if (user.value && !user.value.emailVerified) {
      console.log('👤 未認証ユーザー検出 - 定期チェック開始')
      startPeriodicCheck()
    } else {
      console.log('👤 認証済みまたは未ログインユーザー - 定期チェックなし')
    }

    console.log('=== setupVerificationCheck 完了 ===')
  }

  return {
    user,
    userProfile,
    loading,
    error,
    isAuthenticated,
    currentUser,
    currentUserProfile,
    isEmailVerificationRequired,
    initAuth,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    updateUserProfile,
    sendEmailVerification,
    checkEmailVerificationStatus,
    setupVerificationCheck,
    clearError
  }
})