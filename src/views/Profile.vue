<template>
  <div class="profile">
    <div v-if="loading" class="loading">
      プロフィールを読み込み中...
    </div>

    <div v-else-if="error" class="alert alert-error">
      {{ error }}
    </div>

    <div v-else-if="!user" class="alert alert-error">
      ユーザーが見つかりません
    </div>

    <div v-else class="profile-content">
      <!-- プロフィールヘッダー -->
      <div class="profile-header">
        <div class="profile-info">
          <div class="profile-avatar">
            <img 
              v-if="user.photoURL" 
              :src="user.photoURL" 
              :alt="user.displayName"
              class="avatar-image"
            />
            <div v-else class="avatar-placeholder">
              {{ getInitials(user.displayName || user.email) }}
            </div>
          </div>
          
          <div class="profile-details">
            <h1 class="profile-name">{{ user.displayName || user.email }}</h1>
            <p v-if="user.bio" class="profile-bio">{{ user.bio }}</p>
            <div class="profile-meta">
              <span class="join-date">
                {{ formatDate(user.createdAt) }}から利用開始
              </span>
            </div>
          </div>
        </div>

        <div v-if="isOwnProfile" class="profile-actions">
          <button @click="toggleEditMode" class="btn btn-secondary">
            {{ editMode ? 'キャンセル' : 'プロフィール編集' }}
          </button>
        </div>
      </div>

      <!-- プロフィール編集フォーム -->
      <div v-if="editMode" class="edit-form">
        <div class="form-group">
          <label for="displayName" class="form-label">表示名</label>
          <input
            id="displayName"
            v-model="editForm.displayName"
            type="text"
            class="form-control"
            placeholder="表示名を入力してください"
          />
        </div>

        <div class="form-group">
          <label for="bio" class="form-label">自己紹介</label>
          <textarea
            id="bio"
            v-model="editForm.bio"
            class="form-control"
            rows="4"
            placeholder="自己紹介を入力してください"
          ></textarea>
        </div>

        <div class="form-actions">
          <button @click="handleSaveProfile" class="btn btn-primary" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
          <button @click="toggleEditMode" class="btn btn-secondary">
            キャンセル
          </button>
        </div>
      </div>

      <!-- 統計情報 -->
      <div class="profile-stats">
        <div class="stat-item">
          <span class="stat-number">{{ userArticles.length }}</span>
          <span class="stat-label">記事</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ totalLikes }}</span>
          <span class="stat-label">いいね</span>
        </div>
        <div class="stat-item">
          <span class="stat-number">{{ totalComments }}</span>
          <span class="stat-label">コメント</span>
        </div>
      </div>

      <!-- 記事一覧 -->
      <div class="user-articles">
        <h2 class="section-title">記事一覧</h2>
        
        <div v-if="userArticles.length === 0" class="no-articles">
          まだ記事がありません
        </div>

        <div v-else class="articles-grid">
          <article 
            v-for="article in displayedArticles" 
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
                <span class="status" :class="article.status">
                  {{ article.status === 'published' ? '公開' : '下書き' }}
                </span>
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
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useArticlesStore } from '@/stores/articles'
import { DatabaseService } from '@/services/database'

const route = useRoute()
const authStore = useAuthStore()
const articlesStore = useArticlesStore()

const user = ref(null)
const userArticles = ref([])
const loading = ref(true)
const error = ref(null)
const editMode = ref(false)
const saving = ref(false)

const editForm = ref({
  displayName: '',
  bio: ''
})

const userId = computed(() => route.params.id)
const isOwnProfile = computed(() => 
  authStore.isAuthenticated && authStore.currentUser?.uid === userId.value
)

// 公開記事のみ表示（自分のプロフィールの場合は全て表示）
const displayedArticles = computed(() => {
  if (isOwnProfile.value) {
    return userArticles.value
  }
  return userArticles.value.filter(article => article.status === 'published')
})

const totalLikes = computed(() => 
  displayedArticles.value.reduce((sum, article) => sum + (article.likesCount || 0), 0)
)

const totalComments = computed(() => 
  displayedArticles.value.reduce((sum, article) => sum + (article.commentsCount || 0), 0)
)

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

const getInitials = (name) => {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}

const toggleEditMode = () => {
  if (editMode.value) {
    // キャンセル時は元の値に戻す
    editForm.value = {
      displayName: user.value.displayName || '',
      bio: user.value.bio || ''
    }
  } else {
    // 編集開始時は現在の値をセット
    editForm.value = {
      displayName: user.value.displayName || '',
      bio: user.value.bio || ''
    }
  }
  editMode.value = !editMode.value
}

const handleSaveProfile = async () => {
  try {
    saving.value = true
    error.value = null

    await authStore.updateUserProfile({
      displayName: editForm.value.displayName,
      bio: editForm.value.bio
    })

    // ローカルのユーザー情報を更新
    user.value = {
      ...user.value,
      displayName: editForm.value.displayName,
      bio: editForm.value.bio
    }

    editMode.value = false
  } catch (err) {
    error.value = 'プロフィールの更新に失敗しました'
    console.error('プロフィール更新エラー:', err)
  } finally {
    saving.value = false
  }
}

const fetchUserData = async () => {
  try {
    loading.value = true
    error.value = null

    // ユーザー情報を取得
    const userData = await DatabaseService.getUser(userId.value)
    if (!userData) {
      error.value = 'ユーザーが見つかりません'
      return
    }
    user.value = userData

    // ユーザーの記事を取得
    const articles = await articlesStore.fetchUserArticles(userId.value)
    userArticles.value = articles

  } catch (err) {
    error.value = 'ユーザー情報の取得に失敗しました'
    console.error('ユーザーデータ取得エラー:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchUserData()
})
</script>

<style scoped>
.profile {
  max-width: 800px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-header {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.profile-info {
  display: flex;
  gap: 1.5rem;
  flex: 1;
}

.profile-avatar {
  flex-shrink: 0;
}

.avatar-image {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: #6c757d;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: bold;
}

.profile-details {
  flex: 1;
}

.profile-name {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
  font-size: 2rem;
}

.profile-bio {
  margin: 0 0 1rem 0;
  color: #495057;
  line-height: 1.6;
}

.profile-meta {
  color: #6c757d;
  font-size: 0.875rem;
}

.edit-form {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.form-actions {
  display: flex;
  gap: 1rem;
}

.profile-stats {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #007bff;
}

.stat-label {
  color: #6c757d;
  font-size: 0.875rem;
}

.user-articles {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.section-title {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
  font-size: 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e9ecef;
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
  align-items: center;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  font-size: 0.75rem;
}

.status.published {
  background-color: #d4edda;
  color: #155724;
}

.status.draft {
  background-color: #f8d7da;
  color: #721c24;
}

.date {
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
  .profile-header {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .profile-info {
    flex-direction: column;
    text-align: center;
  }
  
  .profile-name {
    font-size: 1.5rem;
  }
  
  .profile-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .article-footer {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
}
</style>