<template>
  <div class="search">
    <div class="search-header">
      <h1>記事検索</h1>
    </div>

    <div class="search-form">
      <div class="search-input-group">
        <input
          v-model="searchForm.text"
          type="text"
          class="form-control search-input"
          placeholder="記事のタイトルや内容で検索..."
          @keyup.enter="handleSearch"
        />
        <button @click="handleSearch" class="btn btn-primary search-button">
          検索
        </button>
      </div>

      <div class="search-filters">
        <div class="filter-group">
          <label for="category" class="filter-label">カテゴリ</label>
          <select
            id="category"
            v-model="searchForm.category"
            class="form-control"
          >
            <option value="">すべてのカテゴリ</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.name"
            >
              {{ category.name }}
            </option>
            <!-- デバッグ用：カテゴリが読み込まれていない場合の表示 -->
            <option v-if="categories.length === 0" disabled>
              カテゴリを読み込み中...
            </option>
          </select>
        </div>

        <div class="filter-group">
          <label for="tags" class="filter-label">タグ</label>
          <input
            id="tags"
            v-model="searchForm.tags"
            type="text"
            class="form-control"
            placeholder="JavaScript, Vue.js（カンマ区切り）"
          />
        </div>

        <button @click="clearFilters" class="btn btn-secondary clear-button">
          クリア
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      検索中...
    </div>

    <div v-else-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-else-if="hasSearched && searchResults.length === 0" class="no-results">
      検索結果が見つかりませんでした
    </div>

    <div v-else-if="searchResults.length > 0" class="search-results">
      <div class="results-header">
        <h2>検索結果 ({{ searchResults.length }}件)</h2>
      </div>

      <div class="articles-grid">
        <article 
          v-for="article in searchResults" 
          :key="article.id"
          class="article-card"
        >
          <div class="article-header">
            <h3 class="article-title">
              <router-link :to="`/article/${article.id}`">
                {{ article.title }}
              </router-link>
            </h3>
            <div class="article-meta">
              <span class="author">{{ article.authorName || article.authorId }}</span>
              <span class="date">{{ formatDate(article.createdAt) }}</span>
            </div>
          </div>

          <div class="article-content">
            <p>{{ getExcerpt(article.content) }}</p>
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
    </div>

    <div v-else class="search-placeholder">
      <div class="placeholder-content">
        <h2>記事を検索</h2>
        <p>キーワードを入力して記事を検索してください</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useArticlesStore } from '@/stores/articles'
import { DatabaseService } from '@/services/database'

const route = useRoute()
const router = useRouter()
const articlesStore = useArticlesStore()

const searchForm = ref({
  text: '',
  category: '',
  tags: ''
})

const searchResults = ref([])
const loading = ref(false)
const error = ref(null)
const hasSearched = ref(false)
const categories = ref([])

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

const handleSearch = async () => {
  if (!searchForm.value.text.trim() && !searchForm.value.category && !searchForm.value.tags.trim()) {
    return
  }

  try {
    loading.value = true
    error.value = null
    hasSearched.value = true

    const tagsArray = searchForm.value.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    const results = await articlesStore.searchArticles(
      searchForm.value.text.trim() || null,
      searchForm.value.category || null,
      tagsArray.length > 0 ? tagsArray : null
    )

    searchResults.value = results

    // URLパラメータを更新
    const query = {}
    if (searchForm.value.text.trim()) query.q = searchForm.value.text.trim()
    if (searchForm.value.category) query.category = searchForm.value.category
    if (searchForm.value.tags.trim()) query.tags = searchForm.value.tags.trim()

    router.replace({ name: 'search', query })

  } catch (err) {
    console.error('==== 検索エラー詳細 ====')
    console.error('エラーオブジェクト:', err)
    console.error('エラーメッセージ:', err.message)
    console.error('エラーコード:', err.code)
    console.error('エラースタック:', err.stack)
    console.error('======================')

    error.value = `検索中にエラーが発生しました: ${err.message || err.code || 'Unknown error'}`
  } finally {
    loading.value = false
  }
}

const clearFilters = () => {
  searchForm.value = {
    text: '',
    category: '',
    tags: ''
  }
  searchResults.value = []
  hasSearched.value = false
  router.replace({ name: 'search' })
}

// URLパラメータから検索条件を復元
const loadCategories = async () => {
  try {
    console.log('🔍 Search.vue: カテゴリ取得開始')
    categories.value = await DatabaseService.getCategories()
    console.log('✅ Search.vue: カテゴリ取得完了:', categories.value.length, '件')
    console.log('📋 Search.vue: カテゴリ詳細:', categories.value)

    if (categories.value.length === 0) {
      console.warn('⚠️ Search.vue: カテゴリが0件です。Firestoreのcategoriesコレクションを確認してください')
    }
  } catch (error) {
    console.error('❌ Search.vue: カテゴリ取得エラー:', error)
  }
}

const restoreSearchFromQuery = () => {
  const query = route.query

  if (query.q) searchForm.value.text = query.q
  if (query.category) searchForm.value.category = query.category
  if (query.tags) searchForm.value.tags = query.tags

  // パラメータがある場合は自動で検索実行
  if (query.q || query.category || query.tags) {
    handleSearch()
  }
}

onMounted(async () => {
  console.log('🚀 Search.vue: onMounted開始')
  // カテゴリ一覧を取得
  await loadCategories()
  // クエリパラメータから検索条件を復元
  restoreSearchFromQuery()
  console.log('🏁 Search.vue: onMounted完了')

  // デバッグ用グローバル関数
  window.debugSearchCategories = () => {
    console.log('📊 Debug: categories.value:', categories.value)
    console.log('📊 Debug: categories.value.length:', categories.value.length)
    return categories.value
  }
})
</script>

<style scoped>
.search {
  max-width: 800px;
  margin: 0 auto;
}

.search-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.search-header h1 {
  margin: 0;
  color: #2c3e50;
}

.search-form {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.search-input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
}

.search-button {
  white-space: nowrap;
}

.search-filters {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 1rem;
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
}

.filter-label {
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.clear-button {
  height: fit-content;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.no-results {
  text-align: center;
  padding: 3rem;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 0.5rem;
}

.search-placeholder {
  text-align: center;
  padding: 4rem 2rem;
  color: #6c757d;
}

.placeholder-content h2 {
  margin: 0 0 1rem 0;
  color: #495057;
}

.placeholder-content p {
  margin: 0;
  font-size: 1.125rem;
}

.search-results {
  margin-bottom: 2rem;
}

.results-header {
  margin-bottom: 1.5rem;
}

.results-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
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
  padding: 1.5rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.1);
}

.article-header {
  margin-bottom: 1rem;
}

.article-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
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
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid #f8f9fa;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  display: inline-block;
  background-color: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.category-tag {
  background-color: #007bff;
  color: white;
}

.article-stats {
  display: flex;
  gap: 1rem;
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

@media (max-width: 768px) {
  .search-input-group {
    flex-direction: column;
  }

  .search-filters {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .article-footer {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  /* モバイルでのselectボックス最適化 */
  select.form-control {
    min-height: 48px;
    font-size: 16px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
  }

  select.form-control option {
    padding: 12px 16px;
    font-size: 16px;
    line-height: 1.5;
    background-color: white;
    color: #333;
  }
}
</style>