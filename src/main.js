import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { useAuthStore } from './stores/auth'

console.log('main.js: アプリケーション初期化開始')

try {
  const app = createApp(App)
  const pinia = createPinia()

  console.log('main.js: Pinia設定中...')
  app.use(pinia)
  console.log('main.js: Router設定中...')
  app.use(router)

  console.log('main.js: 認証状態初期化中...')
  // 認証状態の初期化
  const authStore = useAuthStore()
  authStore.initAuth().then(() => {
    console.log('main.js: 認証初期化完了、アプリマウント中...')
    app.mount('#app')
    console.log('main.js: アプリマウント完了')

    // メール認証の自動チェック機能を設定
    console.log('main.js: メール認証チェック機能を設定中...')
    authStore.setupVerificationCheck()
    console.log('main.js: メール認証チェック機能設定完了')
  }).catch((error) => {
    console.error('main.js: 認証初期化エラー:', error)
    // 認証に失敗してもアプリは起動
    app.mount('#app')

    // エラーが発生してもメール認証チェック機能は設定
    const authStore = useAuthStore()
    authStore.setupVerificationCheck()
  })
} catch (error) {
  console.error('main.js: アプリケーション初期化エラー:', error)
  // フォールバック: 最小限のHTMLを表示
  document.getElementById('app').innerHTML = `
    <div style="padding: 20px; color: red;">
      <h1>アプリケーション起動エラー</h1>
      <p>詳細はコンソールを確認してください</p>
      <pre>${error.message}</pre>
    </div>
  `
}