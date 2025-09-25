<template>
  <div class="login-container">
    <div class="login-card">
      <!-- パスワードリセット画面 -->
      <div v-if="showPasswordReset" class="password-reset">
        <h1 class="login-title">パスワードリセット</h1>

        <div v-if="passwordResetSent" class="reset-success">
          <div class="success-icon">✅</div>
          <p><strong>パスワードリセットメールを送信しました！</strong></p>
          <p>{{ resetEmail }} にメールを送信しました。</p>
          <p>メール内のリンクをクリックしてパスワードをリセットしてください。</p>
          <p class="note">まもなくログイン画面に戻ります...</p>
        </div>

        <div v-else class="reset-form">
          <p>登録したメールアドレスを入力してください。パスワードリセット用のメールをお送りします。</p>

          <form @submit.prevent="handlePasswordReset" class="password-reset-form">
            <div class="form-group">
              <label for="resetEmail" class="form-label">メールアドレス</label>
              <input
                id="resetEmail"
                v-model="resetEmail"
                type="email"
                class="form-control"
                required
                placeholder="example@domain.com"
              />
            </div>

            <button
              type="submit"
              class="btn btn-primary btn-full"
              :disabled="sendingPasswordReset"
            >
              {{ sendingPasswordReset ? '送信中...' : 'パスワードリセットメールを送信' }}
            </button>
          </form>

          <div class="reset-actions">
            <button @click="showPasswordReset = false" class="btn btn-outline">
              ログイン画面に戻る
            </button>
          </div>
        </div>
      </div>

      <!-- メール認証画面 -->
      <div v-else-if="showEmailVerification" class="email-verification">
        <h1 class="login-title">{{ verificationCompleted ? 'メール認証完了' : 'メール認証' }}</h1>

        <!-- 認証完了メッセージ -->
        <div v-if="verificationCompleted" class="verification-success">
          <div class="success-icon">✅</div>
          <p><strong>メール認証が完了しました！</strong></p>
          <p>まもなくホームページに移動します...</p>
        </div>

        <!-- 通常の認証待ち画面 -->
        <div v-else class="verification-message">
          <p>会員登録はまだ完了していません。</p>
          <p><strong>{{ email }}</strong> に認証メールを送信しました。</p>
          <p>メール内のリンクをクリックしてメールアドレスを認証してください。</p>
          <p class="note">認証後、自動的にログインされます。</p>
        </div>

        <div v-if="!verificationCompleted" class="verification-actions">
          <button
            @click="handleCheckVerificationStatus"
            class="btn btn-primary"
            :disabled="checkingVerificationStatus"
          >
            {{ checkingVerificationStatus ? '確認中...' : '認証完了を確認' }}
          </button>
          <button @click="handleResendVerification" class="btn btn-secondary">
            認証メールを再送信
          </button>
          <button @click="showEmailVerification = false" class="btn btn-outline">
            ログインページに戻る
          </button>
        </div>
      </div>

      <!-- 通常のログイン・登録画面 -->
      <div v-else>
        <h1 class="login-title">{{ isSignUp ? '会員登録' : 'ログイン' }}</h1>

        <div v-if="authStore.error" class="alert alert-error">
          {{ authStore.error }}
        </div>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div v-if="isSignUp" class="form-group">
          <label for="displayName" class="form-label">ユーザー名</label>
          <input
            id="displayName"
            v-model="displayName"
            type="text"
            class="form-control"
            :class="{ 'error': displayNameError, 'success': displayNameValid }"
            required
            @input="checkDisplayNameAvailability"
          />
          <div v-if="displayNameChecking" class="field-message checking">
            確認中...
          </div>
          <div v-else-if="displayNameError" class="field-message error">
            {{ displayNameError }}
          </div>
          <div v-else-if="displayNameValid" class="field-message success">
            このユーザー名は利用可能です
          </div>
        </div>

        <div class="form-group">
          <label for="email" class="form-label">メールアドレス</label>
          <input
            id="email"
            v-model="email"
            type="email"
            class="form-control"
            required
          />
        </div>

        <div class="form-group">
          <label for="password" class="form-label">パスワード</label>
          <input
            id="password"
            v-model="password"
            type="password"
            class="form-control"
            required
            minlength="6"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary btn-full"
          :disabled="authStore.loading || (isSignUp && (displayNameChecking || displayNameError || !displayNameValid))"
        >
          {{ authStore.loading ? '処理中...' : (isSignUp ? '会員登録' : 'ログイン') }}
        </button>
      </form>

      <div v-if="!isSignUp" class="password-reset-link">
        <button @click="showPasswordReset = true" class="link-button">
          パスワードを忘れた方はこちら
        </button>
      </div>

      <div class="divider">または</div>

      <div class="social-login">
        <button 
          @click="handleGoogleLogin"
          class="btn btn-google"
          :disabled="authStore.loading"
        >
          <span>Googleでログイン</span>
        </button>

        <button 
          @click="handleGithubLogin"
          class="btn btn-github"
          :disabled="authStore.loading"
        >
          <span>GitHubでログイン</span>
        </button>
      </div>

      <div class="login-footer">
        <button @click="toggleMode" class="link-button">
          {{ isSignUp ? 'すでにアカウントをお持ちの方はログイン' : '新規会員登録はこちら' }}
        </button>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { DatabaseService } from '@/services/database'

const router = useRouter()
const authStore = useAuthStore()

const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const displayName = ref('')
const displayNameChecking = ref(false)
const displayNameError = ref('')
const displayNameValid = ref(false)
const showEmailVerification = ref(false)
const verificationEmailSent = ref(false)
const checkingVerificationStatus = ref(false)
const verificationCompleted = ref(false)
const showPasswordReset = ref(false)
const resetEmail = ref('')
const sendingPasswordReset = ref(false)
const passwordResetSent = ref(false)

let displayNameCheckTimeout = null

const checkDisplayNameAvailability = async () => {
  clearTimeout(displayNameCheckTimeout)

  const name = displayName.value.trim()
  console.log('checkDisplayNameAvailability: 開始', { name, length: name.length })

  if (!name) {
    console.log('checkDisplayNameAvailability: 空の入力')
    displayNameError.value = ''
    displayNameValid.value = false
    return
  }

  if (name.length < 2) {
    console.log('checkDisplayNameAvailability: 文字数不足')
    displayNameError.value = 'ユーザー名は2文字以上で入力してください'
    displayNameValid.value = false
    return
  }

  console.log('checkDisplayNameAvailability: 500ms後に重複チェック開始予定')

  // ユーザー名の重複チェック機能を有効化
  displayNameCheckTimeout = setTimeout(async () => {
    try {
      console.log('checkDisplayNameAvailability: 重複チェック実行開始', name)
      displayNameChecking.value = true
      displayNameError.value = ''
      displayNameValid.value = false

      const exists = await DatabaseService.checkDisplayNameExists(name)
      console.log('checkDisplayNameAvailability: 重複チェック結果', { name, exists })

      if (exists) {
        console.log('checkDisplayNameAvailability: ユーザー名重複')
        displayNameError.value = 'このユーザー名は既に使用されています'
        displayNameValid.value = false
      } else {
        console.log('checkDisplayNameAvailability: ユーザー名利用可能')
        displayNameError.value = ''
        displayNameValid.value = true
      }
    } catch (error) {
      console.error('checkDisplayNameAvailability: エラー発生', error)
      // 重複チェックに失敗した場合は警告のみ表示し、登録は可能にする
      displayNameError.value = 'ユーザー名の確認に失敗しました（登録は可能）'
      displayNameValid.value = true
      console.warn('ユーザー名の重複チェックをスキップしました')
    } finally {
      displayNameChecking.value = false
      console.log('checkDisplayNameAvailability: チェック完了', {
        error: displayNameError.value,
        valid: displayNameValid.value,
        checking: displayNameChecking.value
      })
    }
  }, 500)
}

const handleSubmit = async () => {
  try {
    authStore.clearError()

    if (isSignUp.value) {
      // 空のユーザー名チェック
      if (!displayName.value.trim()) {
        alert('ユーザー名を入力してください')
        return
      }

      // ユーザー名が2文字未満の場合
      if (displayName.value.trim().length < 2) {
        alert('ユーザー名は2文字以上で入力してください')
        return
      }

      // 重複チェック中の場合
      if (displayNameChecking.value) {
        alert('ユーザー名の確認中です。しばらくお待ちください。')
        return
      }

      // 重複エラーがある場合
      if (displayNameError.value) {
        alert(`エラー: ${displayNameError.value}`)
        return
      }

      // ユーザー名が有効でない場合
      if (!displayNameValid.value) {
        alert('ユーザー名の有効性を確認してください')
        return
      }

      await authStore.signUpWithEmail(email.value, password.value, displayName.value)
      // 会員登録成功時はメール認証画面を表示
      showEmailVerification.value = true
      return // ここでreturnして、リダイレクトをしない
    } else {
      await authStore.signInWithEmail(email.value, password.value)
      // ログイン成功時のみリダイレクト
      router.push('/')
    }
  } catch (error) {
    console.error('==== 詳細な登録エラー ====')
    console.error('エラーオブジェクト:', error)
    console.error('エラーメッセージ:', error.message)
    console.error('エラーコード:', error.code)
    console.error('エラースタック:', error.stack)
    console.error('========================')

    let errorMessage = 'エラーが発生しました'
    if (error.message) {
      errorMessage = error.message
    } else if (error.code) {
      errorMessage = `Firebase エラー: ${error.code}`
    }

    alert(`エラー: ${errorMessage}`)
  }
}

const handleGoogleLogin = async () => {
  try {
    authStore.clearError()
    const result = await authStore.signInWithGoogle()

    // ポップアップ方式で成功した場合
    if (result && result.uid) {
      router.push('/')
    }
  } catch (error) {
    // authStoreのerrorを使用
    authStore.error = `Google認証エラー: ${error.message || 'ポップアップが閉じられました。'}`
  }
}

const handleGithubLogin = async () => {
  try {
    authStore.clearError()
    await authStore.signInWithGithub()
    router.push('/')
  } catch (error) {
    // エラーはstoreで処理済み
  }
}

const handleResendVerification = async () => {
  try {
    await authStore.sendEmailVerification()
    verificationEmailSent.value = true
    alert('認証メールを再送信しました。メールをご確認ください。')
  } catch (error) {
    alert(`エラー: ${error.message}`)
  }
}

const handleCheckVerificationStatus = async () => {
  try {
    checkingVerificationStatus.value = true

    // デバッグ情報を詳細に出力
    console.log('🔍 === Login.vue: 手動メール認証状態チェック開始 ===')
    console.log('👤 現在のuser:', authStore.currentUser)
    console.log('📝 現在のuserProfile:', authStore.currentUserProfile)
    console.log('🔐 isAuthenticated:', authStore.isAuthenticated)
    console.log('📧 isEmailVerificationRequired:', authStore.isEmailVerificationRequired)

    const isVerified = await authStore.checkEmailVerificationStatus()

    console.log('📊 チェック結果:', isVerified)
    console.log('👤 チェック後のuser:', authStore.currentUser)
    console.log('📝 チェック後のuserProfile:', authStore.currentUserProfile)
    console.log('🔐 チェック後のisAuthenticated:', authStore.isAuthenticated)
    console.log('📧 チェック後のisEmailVerificationRequired:', authStore.isEmailVerificationRequired)
    console.log('🔍 === Login.vue: 手動メール認証状態チェック終了 ===')

    if (isVerified) {
      console.log('✅ 認証完了！リダイレクトします')
      alert('メール認証が完了しました！ホームページに移動します。')
      showEmailVerification.value = false
      // 認証済みなので自動的にホームページへリダイレクト
      router.push('/')
    } else {
      console.log('❌ まだ認証されていません')
      alert('まだメール認証が完了していません。メール内のリンクをクリックしてから再度お試しください。')
    }
  } catch (error) {
    console.error('❌ Login.vue: メール認証状態チェックエラー:', error)
    alert(`エラー: ${error.message}`)
  } finally {
    checkingVerificationStatus.value = false
  }
}

const handlePasswordReset = async () => {
  try {
    if (!resetEmail.value.trim()) {
      alert('メールアドレスを入力してください')
      return
    }

    sendingPasswordReset.value = true
    console.log('🔐 パスワードリセット開始:', resetEmail.value)

    await authStore.sendPasswordResetEmail(resetEmail.value)
    passwordResetSent.value = true

    console.log('✅ パスワードリセットメール送信完了')
    alert(`${resetEmail.value} にパスワードリセットメールを送信しました。メールをご確認ください。`)

    // 成功後はログイン画面に戻る
    setTimeout(() => {
      showPasswordReset.value = false
      passwordResetSent.value = false
      resetEmail.value = ''
    }, 2000)

  } catch (error) {
    console.error('❌ パスワードリセットエラー:', error)
    alert(`エラー: ${error.message}`)
  } finally {
    sendingPasswordReset.value = false
  }
}

const toggleMode = () => {
  isSignUp.value = !isSignUp.value
  authStore.clearError()
  showEmailVerification.value = false
  verificationEmailSent.value = false
  verificationCompleted.value = false
  showPasswordReset.value = false
  passwordResetSent.value = false
  // フォームをリセット
  email.value = ''
  password.value = ''
  displayName.value = ''
  resetEmail.value = ''
  // ユーザー名チェック状態もリセット
  displayNameError.value = ''
  displayNameValid.value = false
  displayNameChecking.value = false
  // タイムアウトもクリア
  clearTimeout(displayNameCheckTimeout)
  console.log('toggleMode: フォーム状態リセット完了')
}

// 認証状態の変化を監視して自動リダイレクト
watch(
  () => authStore.isAuthenticated,
  (newAuth, oldAuth) => {
    console.log('🔄 Login.vue: 認証状態変化検出', oldAuth, '→', newAuth)

    if (newAuth && showEmailVerification.value) {
      console.log('✅ メール認証完了を検出！自動リダイレクト開始')
      verificationCompleted.value = true

      // 成功メッセージを表示してからリダイレクト
      setTimeout(() => {
        console.log('🏠 ホームページにリダイレクト')
        showEmailVerification.value = false
        router.push('/')
      }, 2000)
    }
  },
  { immediate: false }
)

// メール認証要求状態の変化も監視
watch(
  () => authStore.isEmailVerificationRequired,
  (required, oldRequired) => {
    console.log('📧 Login.vue: メール認証要求状態変化', oldRequired, '→', required)

    if (!required && oldRequired && showEmailVerification.value) {
      console.log('✅ メール認証要求が解除されました！自動リダイレクト開始')
      verificationCompleted.value = true

      setTimeout(() => {
        console.log('🏠 ホームページにリダイレクト')
        showEmailVerification.value = false
        router.push('/')
      }, 2000)
    }
  },
  { immediate: false }
)

onMounted(() => {
  console.log('🚀 Login.vue: onMounted開始')
  console.log('🔐 初期認証状態:', authStore.isAuthenticated)
  console.log('📧 初期認証要求状態:', authStore.isEmailVerificationRequired)

  // 認証済みの場合はホームページにリダイレクト
  if (authStore.isAuthenticated) {
    console.log('✅ 既に認証済み - ホームページにリダイレクト')
    router.push('/')
  }
  // メール認証が必要な場合はメール認証画面を表示
  else if (authStore.isEmailVerificationRequired) {
    console.log('📧 メール認証が必要 - 認証画面を表示')
    showEmailVerification.value = true
    if (authStore.currentUser?.email) {
      email.value = authStore.currentUser.email
    }
  }

  // 初期状態を確実にリセット
  displayNameError.value = ''
  displayNameValid.value = false
  displayNameChecking.value = false
  console.log('🔧 onMounted: 初期状態リセット完了')

  // デバッグ用グローバル関数をセット
  window.debugListUsers = DatabaseService.debugListAllUsers
  window.checkName = DatabaseService.checkDisplayNameExists
  console.log('🛠️ デバッグ関数追加: window.debugListUsers(), window.checkName("username")')
})
</script>

<style scoped>
.login-container {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.login-title {
  text-align: center;
  margin-bottom: 2rem;
  color: #2c3e50;
}

.login-form {
  margin-bottom: 1.5rem;
}

.btn-full {
  width: 100%;
  margin-bottom: 1rem;
}

.divider {
  text-align: center;
  margin: 1.5rem 0;
  color: #6c757d;
  position: relative;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e9ecef;
  z-index: 1;
}

.divider span {
  background: white;
  padding: 0 1rem;
  z-index: 2;
  position: relative;
}

.social-login {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.btn-google {
  background-color: #db4437;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-google:hover {
  background-color: #c23321;
}

.btn-github {
  background-color: #333;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-github:hover {
  background-color: #222;
}

.login-footer {
  text-align: center;
}

.link-button {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  text-decoration: underline;
  font-size: 0.875rem;
}

.link-button:hover {
  color: #0056b3;
}

.form-control.error {
  border-color: #dc3545;
}

.form-control.success {
  border-color: #28a745;
}

.field-message {
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.field-message.error {
  color: #dc3545;
}

.field-message.success {
  color: #28a745;
}

.field-message.checking {
  color: #6c757d;
}

.email-verification {
  text-align: center;
}

.verification-message {
  margin: 2rem 0;
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  border-left: 4px solid #28a745;
}

.verification-message p {
  margin: 0.5rem 0;
  color: #495057;
}

.verification-message .note {
  font-size: 0.875rem;
  color: #6c757d;
  font-style: italic;
}

.verification-success {
  margin: 2rem 0;
  padding: 2rem;
  background-color: #d4edda;
  border-radius: 0.5rem;
  border-left: 4px solid #28a745;
  text-align: center;
}

.verification-success .success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.verification-success p {
  margin: 0.5rem 0;
  color: #155724;
}

.verification-success p:first-of-type {
  font-size: 1.1rem;
}

.password-reset {
  text-align: center;
}

.reset-form {
  margin: 2rem 0;
}

.reset-form p {
  margin-bottom: 1.5rem;
  color: #495057;
  line-height: 1.6;
}

.password-reset-form {
  margin-bottom: 1.5rem;
}

.reset-success {
  margin: 2rem 0;
  padding: 2rem;
  background-color: #d4edda;
  border-radius: 0.5rem;
  border-left: 4px solid #28a745;
  text-align: center;
}

.reset-success .success-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.reset-success p {
  margin: 0.5rem 0;
  color: #155724;
}

.reset-success p:first-of-type {
  font-size: 1.1rem;
}

.reset-success .note {
  font-size: 0.875rem;
  color: #6c757d;
  font-style: italic;
  margin-top: 1rem;
}

.reset-actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.password-reset-link {
  text-align: center;
  margin: 1rem 0;
}

.verification-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-secondary:hover {
  background-color: #5a6268;
}

.btn-outline {
  background-color: transparent;
  color: #007bff;
  border: 1px solid #007bff;
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-outline:hover {
  background-color: #007bff;
  color: white;
}

/* スマートフォン向けレスポンシブ対応 */
@media (max-width: 768px) {
  .login-container {
    padding: 1rem;
  }

  .login-card {
    max-width: 90%;
    min-width: 320px;
    padding: 1.5rem;
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 0.75rem;
  }

  .login-card {
    max-width: 95%;
    min-width: 300px;
    padding: 1.25rem;
  }
}
</style>