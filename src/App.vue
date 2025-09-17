<template>
  <div id="app" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
    <nav class="navbar">
      <div class="navbar-top">
        <div class="nav-brand">
          <router-link to="/">シンプル投稿フォーム</router-link>
        </div>

        <!-- ハンバーガーメニューボタン（モバイル用） -->
        <button class="mobile-menu-toggle" @click="toggleMobileMenu" :class="{ active: isMobileMenuOpen }">
          <span></span>
          <span></span>
          <span></span>
        </button>

        <!-- ナビゲーションリンク -->
        <div class="nav-links" :class="{ 'mobile-open': isMobileMenuOpen }" @touchstart.stop @touchmove.stop>
          <router-link to="/" @click="closeMobileMenu">ホーム</router-link>
          <router-link to="/search" @click="closeMobileMenu">検索</router-link>
          <router-link v-if="authStore.isAuthenticated" to="/create" @click="closeMobileMenu">記事作成</router-link>
          <router-link v-else to="/login" @click="closeMobileMenu">ログイン</router-link>

          <div v-if="authStore.isAuthenticated" class="user-menu">
            <button @click="handleSignOut" class="btn-signout">ログアウト</button>
          </div>
        </div>

        <!-- モバイル用オーバーレイ -->
        <div v-if="isMobileMenuOpen" class="mobile-overlay" @click="closeMobileMenu"></div>
      </div>

      <!-- ユーザー挨拶（ヘッダー内の下部に表示） -->
      <div v-if="authStore.isAuthenticated" class="user-greeting">
        <span>こんにちは、{{ userDisplayName }}さん</span>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth'
import { useArticlesStore } from '@/stores/articles'
import { useRouter } from 'vue-router'
import { computed, ref } from 'vue'

const authStore = useAuthStore()
const articlesStore = useArticlesStore()
const router = useRouter()

// モバイルメニュー管理
const isMobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

// スワイプによる意図しない開閉を防ぐ
let startX = 0
let startY = 0
let isSwipe = false

const handleTouchStart = (e) => {
  // ハンバーガーメニューボタンのタッチは許可
  if (e.target.closest('.mobile-menu-toggle')) {
    return
  }

  startX = e.touches[0].clientX
  startY = e.touches[0].clientY
  isSwipe = false
}

const handleTouchMove = (e) => {
  // ハンバーガーメニューボタンのタッチは許可
  if (e.target.closest('.mobile-menu-toggle')) {
    return
  }

  if (!startX || !startY) return

  const deltaX = Math.abs(e.touches[0].clientX - startX)
  const deltaY = Math.abs(e.touches[0].clientY - startY)

  // 横スワイプを検出
  if (deltaX > 10 && deltaX > deltaY) {
    isSwipe = true
    // メニューが開いている場合は閉じる
    if (isMobileMenuOpen.value) {
      closeMobileMenu()
    }
  }
}

const handleTouchEnd = (e) => {
  // ハンバーガーメニューボタンのタッチは許可
  if (e.target.closest('.mobile-menu-toggle')) {
    return
  }

  // スワイプでメニューが開かないようにする
  if (isSwipe) {
    e.preventDefault()
    e.stopPropagation()
  }
  startX = 0
  startY = 0
  isSwipe = false
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const userDisplayName = computed(() => {
  // プロフィールが存在し、displayNameがある場合
  if (authStore.currentUserProfile?.displayName) {
    return authStore.currentUserProfile.displayName
  }

  // Firebase Authのユーザー情報からdisplayNameを取得
  if (authStore.currentUser?.displayName) {
    return authStore.currentUser.displayName
  }

  // フォールバック: メールアドレスの@より前の部分を表示
  if (authStore.currentUser?.email) {
    return authStore.currentUser.email.split('@')[0]
  }

  return 'ユーザー'
})

const handleSignOut = async () => {
  try {
    closeMobileMenu()
    await authStore.signOut()
    // ログアウト時に記事データもクリア
    articlesStore.clearAllArticles()
    router.push('/')
  } catch (error) {
    console.error('ログアウトエラー:', error)
  }
}
</script>

<style>
#app {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
  color: #334155;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
  min-height: 100vh;
}

.navbar {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  touch-action: pan-y;
  -webkit-touch-callout: none;
  -webkit-user-drag: none;
}

.navbar-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 2rem;
}

.nav-brand a {
  font-size: 1.5rem;
  font-weight: 800;
  text-decoration: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: all 0.3s ease;
  letter-spacing: -0.02em;
}

.nav-brand a:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.nav-links {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  touch-action: manipulation;
}

.nav-links a {
  text-decoration: none;
  color: #64748b;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  font-weight: 500;
  font-size: 0.95rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.nav-links a::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.nav-links a:hover {
  color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.nav-links a:hover::before,
.nav-links a.router-link-active::before {
  opacity: 1;
}

.nav-links a.router-link-active {
  color: #667eea;
  font-weight: 600;
  background: rgba(102, 126, 234, 0.08);
}

/* ユーザー挨拶エリア（ヘッダー内） */
.user-greeting {
  text-align: right;
  padding: 0 2rem 1rem;
  margin-top: -1rem;
}

.user-greeting span {
  color: #475569;
  font-size: 0.95rem;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-name {
  color: #475569;
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: -0.01em;
}

.btn-signout {
  background: none;
  border: none;
  color: #64748b;
  padding: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-signout:hover {
  color: #ef4444;
  transform: translateY(-1px);
}

/* ハンバーガーメニューボタン */
.mobile-menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 30px;
  touch-action: manipulation;
  -webkit-touch-callout: auto;
  -webkit-user-drag: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1001;
  position: relative;
}

.mobile-menu-toggle span {
  display: block;
  position: absolute;
  width: 22px;
  height: 2px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 2px;
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transform-origin: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mobile-menu-toggle span:nth-child(1) {
  top: 8px;
}

.mobile-menu-toggle span:nth-child(2) {
  top: 14px;
}

.mobile-menu-toggle span:nth-child(3) {
  top: 20px;
}

.mobile-menu-toggle.active span:nth-child(1) {
  top: 14px;
  transform: rotate(45deg);
}

.mobile-menu-toggle.active span:nth-child(2) {
  opacity: 0;
  transform: scale(0);
}

.mobile-menu-toggle.active span:nth-child(3) {
  top: 14px;
  transform: rotate(-45deg);
}

/* モバイル用オーバーレイ */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
  touch-action: manipulation;
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .navbar {
    padding: 1rem;
  }

  .nav-brand a {
    font-size: 1.25rem;
  }

  .mobile-menu-toggle {
    display: flex;
  }

  .mobile-overlay {
    display: block;
  }

  .nav-links {
    position: fixed;
    top: 0;
    right: -320px;
    width: 300px;
    height: 100vh;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    flex-direction: column;
    align-items: stretch;
    padding: 100px 30px 30px;
    gap: 8px;
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.12);
    transition: right 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    border-left: 1px solid rgba(226, 232, 240, 0.8);
  }

  .nav-links.mobile-open {
    right: 0;
  }

  .nav-links a {
    padding: 16px 24px;
    margin: 4px 0;
    border-radius: 16px;
    color: #64748b;
    font-size: 16px;
    font-weight: 500;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid transparent;
  }

  .nav-links a:hover,
  .nav-links a.router-link-active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
    color: #667eea;
    transform: translateX(-4px);
    border-color: rgba(102, 126, 234, 0.2);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  }

  .user-menu {
    margin: 20px 0;
    align-items: flex-start;
  }

  .btn-signout {
    width: 100%;
    padding: 12px;
    font-size: 16px;
    border-radius: 8px;
  }

  .user-greeting {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }

  .main-content {
    padding: 1rem;
  }
}

@media (max-width: 480px) {
  .navbar {
    padding: 0.75rem;
  }

  .nav-brand a {
    font-size: 1.1rem;
  }

  .nav-links {
    width: 100vw;
    right: -100vw;
  }
}
</style>
