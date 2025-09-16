<template>
  <div class="home">
    <div class="home-header">
      <h1>最新の記事</h1>
      <router-link v-if="authStore.isAuthenticated" to="/create" class="btn btn-primary">
        新しい記事を書く
      </router-link>
    </div>

    <div v-if="articlesStore.loading" class="loading">
      記事を読み込み中...
    </div>


    <div v-if="articlesStore.articles.length === 0" class="no-articles">
      まだ記事がありません。
      <div style="font-size: 0.8rem; color: #666; margin-top: 1rem;">
        デバッグ: 読み込み状態: {{ articlesStore.loading }},
        エラー: {{ articlesStore.error }},
        記事数: {{ articlesStore.articles.length }}
      </div>
    </div>

    <div v-else class="articles-grid">
      <article
        v-for="article in articlesStore.articles"
        :key="article.id"
        class="article-card"
      >
        <!-- アイキャッチ画像 -->
        <div v-if="article.featuredImage" class="article-image">
          <router-link :to="`/article/${article.id}`">
            <img
              :src="article.featuredImage"
              :alt="article.title"
              class="featured-image"
              loading="lazy"
            />
          </router-link>
        </div>

        <div class="article-body">
          <div class="article-header">
            <div class="article-title-row">
              <h2 class="article-title">
                <router-link :to="`/article/${article.id}`">
                  {{ article.title }}
                </router-link>
              </h2>
              <span v-if="article.status === 'draft'" class="status-badge draft">
                下書き
              </span>
              <!-- <span v-else class="status-badge published">
                公開
              </span> -->
            </div>
            <div class="article-meta">
              <span class="author">{{ article.authorName || article.authorId }}</span>
              <span class="date">{{ formatDate(article.createdAt) }}</span>
            </div>
          </div>

          <div class="article-content">
            <p>{{ getExcerpt(article.content) }}</p>
          </div>
        </div>

        <div class="article-footer">
          <div class="article-tags">
            <span v-if="article.category" class="tag category-tag">
              {{ article.category }}
            </span>
            <span 
              v-for="tag in article.tags" 
              :key="tag" 
              class="tag"
            >
              #{{ tag }}
            </span>
          </div>
          
          <div class="article-stats">
            <span class="stat">
              <span class="stat-icon">👍</span>
              {{ article.likesCount || 0 }}
            </span>
            <span class="stat">
              <span class="stat-icon">💬</span>
              {{ article.commentsCount || 0 }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <!-- 無限スクロール用のローディングトリガー -->
    <div v-if="articlesStore.hasMore" ref="loadingTrigger" class="loading-trigger">
      <div v-if="articlesStore.loading" class="loading-more">
        記事を読み込み中...
      </div>
    </div>

    <!-- すべて読み込み完了メッセージ -->
    <div v-if="!articlesStore.hasMore && articlesStore.articles.length > 0" class="no-more-articles">
      すべての記事を読み込みました
    </div>
  </div>
</template>

<script setup>
import { onMounted, watch, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useArticlesStore } from '@/stores/articles'

const authStore = useAuthStore()
const articlesStore = useArticlesStore()

// 無限スクロール用のref
const loadingTrigger = ref(null)
let observer = null

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const getExcerpt = (content) => {
  if (!content) return ''
  const plainText = content.replace(/[#*`]/g, '').trim()
  return plainText.length > 150 ? plainText.substring(0, 150) + '...' : plainText
}

const fetchArticles = async () => {
  try {
    console.log('=== 記事取得開始 ===')
    console.log('現在の認証状態:', authStore.isAuthenticated)
    console.log('現在のユーザー:', authStore.currentUser)
    console.log('認証読み込み中:', authStore.loading)

    // 記事データをクリアして初期化
    articlesStore.clearAllArticles()

    if (authStore.isAuthenticated && authStore.currentUser) {
      // ログイン済み: 公開記事 + 自分の記事（下書き含む）
      console.log('認証済みユーザー向け記事取得:', authStore.currentUser.uid)
      await articlesStore.fetchArticlesForUser(authStore.currentUser.uid)
    } else {
      // 未認証: 公開記事のみ
      console.log('未認証ユーザー向け公開記事取得')
      await articlesStore.fetchPublishedArticles()
    }

    console.log('=== 記事取得完了 ===')
    console.log('取得記事数:', articlesStore.articles.length)
    console.log('記事データ:', articlesStore.articles)
    console.log('エラー状態:', articlesStore.error)
    console.log('読み込み状態:', articlesStore.loading)
    console.log('hasMore:', articlesStore.hasMore)
  } catch (error) {
    console.error('=== 記事取得エラー ===', error)
  }
}

// 認証状態の変化を監視して記事を再取得
watch(
  () => authStore.isAuthenticated,
  async (newAuth, oldAuth) => {
    console.log('認証状態変化:', oldAuth, '→', newAuth)

    if (oldAuth !== undefined && newAuth !== oldAuth) {
      // 記事データをクリアして再取得
      articlesStore.clearAllArticles()
      await fetchArticles()
    }
  }
)

// ユーザー情報の変化も監視（ログイン直後のユーザー情報更新時）
watch(
  () => authStore.currentUser,
  async (newUser, oldUser) => {
    if (newUser && oldUser === null) {
      console.log('ユーザー情報更新:', newUser.uid)
      // ログイン完了時に記事再取得
      await fetchArticles()
    }
  }
)

// 無限スクロール用のIntersection Observer設定
const setupInfiniteScroll = () => {
  if (!loadingTrigger.value) return

  observer = new IntersectionObserver(
    async (entries) => {
      const entry = entries[0]
      if (entry.isIntersecting && articlesStore.hasMore && !articlesStore.loading) {
        console.log('無限スクロール: トリガー検出')
        await articlesStore.loadMoreArticles(
          authStore.isAuthenticated ? authStore.currentUser?.uid : null
        )
      }
    },
    {
      rootMargin: '100px'
    }
  )

  observer.observe(loadingTrigger.value)
}

onMounted(async () => {
  // 認証状態の初期化を待つ
  if (authStore.loading) {
    console.log('認証初期化を待機中...')
    // 認証状態の変化を監視
    const unwatch = watch(
      () => authStore.loading,
      async (newLoading) => {
        if (!newLoading) {
          console.log('認証初期化完了')
          await fetchArticles()
          // 無限スクロール設定
          setTimeout(setupInfiniteScroll, 100)
          unwatch()
        }
      }
    )
  } else {
    // 既に認証初期化済み
    await fetchArticles()
    // 無限スクロール設定
    setTimeout(setupInfiniteScroll, 100)
  }
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
}

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.home-header h1 {
  margin: 0;
  color: #2c3e50;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.no-articles {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
}

.articles-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.article-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 0.5rem;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

/* アイキャッチ画像 */
.article-image {
  width: 100%;
  margin-bottom: 0;
}

.featured-image {
  width: 100%;
  height: 500px;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.featured-image:hover {
  transform: scale(1.02);
}

.article-body {
  padding: 1.5rem;
}

.article-header {
  margin-bottom: 1rem;
}

.article-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.article-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  flex: 1;
}

.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
  margin-left: 1rem;
}

.status-badge.draft {
  background-color: #ffc107;
  color: #212529;
}

.status-badge.published {
  background-color: #28a745;
  color: white;
}

.article-title a {
  color: #2c3e50;
  text-decoration: none;
}

.article-title a:hover {
  color: #007bff;
}

.article-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.article-content {
  margin-bottom: 1rem;
  color: #495057;
  line-height: 1.6;
}

.article-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0 1.5rem 0;
  border-top: 1px solid #f8f9fa;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
  margin-left: 1.5rem;
}

.tag {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background-color: #f8f9fa;
  color: #495057;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  text-decoration: none;
}

.category-tag {
  background-color: #007bff;
  color: white;
}

.article-stats {
  display: flex;
  gap: 1rem;
  margin-right: 1.5rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.stat-icon {
  font-size: 1rem;
}

/* 無限スクロール関連のスタイル */
.loading-trigger {
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2rem 0;
}

.loading-more {
  text-align: center;
  padding: 1rem;
  color: #6c757d;
  font-style: italic;
}

.no-more-articles {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
  margin-top: 2rem;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .featured-image {
    height: 250px;
  }

  .home-header {
    flex-direction: column;
    gap: 1rem;
    align-items: center;
  }

  .article-footer {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .article-stats {
    margin-top: 0;
    margin-right: 1rem;
  }

  .article-tags {
    margin-left: 1rem;
  }

  .loading-trigger {
    margin: 1rem 0;
  }

  .no-more-articles {
    margin-top: 1rem;
    padding: 1.5rem;
  }
}
</style>