<template>
  <div class="article-detail">
    <div v-if="articlesStore.loading" class="loading">
      記事を読み込み中...
    </div>

    <div v-else-if="articlesStore.error" class="alert alert-error">
      {{ articlesStore.error }}
    </div>

    <div v-else-if="!article" class="alert alert-error">
      記事が見つかりません
    </div>

    <article v-else class="article">
      <header class="article-header">
        <!-- アイキャッチ画像 -->
        <div v-if="article.featuredImage" class="featured-image">
          <img :src="article.featuredImage" :alt="article.title" />
        </div>

        <h1 class="article-title">{{ article.title }}</h1>

        <div class="article-meta">
          <div class="author-info">
            <span class="author-name">{{ article.authorName || article.authorId }}</span>
            <span class="article-date">{{ formatDate(article.createdAt) }}</span>
          </div>
          
          <div v-if="canEdit" class="article-actions">
            <router-link :to="`/edit/${article.id}`" class="btn btn-secondary btn-sm">
              編集
            </router-link>
            <button @click="handleDelete" class="btn btn-danger btn-sm">
              削除
            </button>
          </div>
        </div>

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
      </header>

      <div class="article-content" v-html="markdownContent"></div>


      <footer class="article-footer">
        <div class="article-stats">
          <button
            v-if="authStore.isAuthenticated"
            @click="handleLike"
            class="like-button"
            :class="{ liked: isLiked }"
            :disabled="loading || !authStore.currentUser"
          >
            <span class="like-icon">👍</span>
            <span>{{ article.likesCount || 0 }}</span>
          </button>
          <span v-else class="stat">
            <span class="stat-icon">👍</span>
            {{ article.likesCount || 0 }}
          </span>
          
          <span class="stat">
            <span class="stat-icon">💬</span>
            {{ comments.length }}
          </span>
        </div>
      </footer>
    </article>

    <!-- コメントセクション -->
    <section v-if="article" class="comments-section">
      <h3 class="comments-title">コメント ({{ comments.length }})</h3>
      
      <!-- コメント投稿フォーム -->
      <div v-if="authStore.isAuthenticated" class="comment-form">
        <textarea
          v-model="newComment"
          class="form-control"
          placeholder="コメントを入力してください"
          rows="3"
        ></textarea>
        <button 
          @click="handleSubmitComment"
          class="btn btn-primary"
          :disabled="!newComment.trim() || submittingComment"
        >
          {{ submittingComment ? '投稿中...' : 'コメントする' }}
        </button>
      </div>
      
      <div v-else class="login-prompt">
        <router-link to="/login" class="btn btn-primary">
          ログインしてコメントする
        </router-link>
      </div>

      <!-- コメント一覧 -->
      <div class="comments-list">
        <div v-if="comments.length === 0" class="no-comments">
          まだコメントがありません
        </div>
        
        <div 
          v-for="comment in comments" 
          :key="comment.id"
          class="comment"
        >
          <div class="comment-header">
            <span class="comment-author">{{ comment.authorName || comment.authorId }}</span>
            <span class="comment-date">{{ formatDate(comment.createdAt) }}</span>
            <button 
              v-if="canEditComment(comment)"
              @click="handleDeleteComment(comment.id)"
              class="btn-delete-comment"
            >
              削除
            </button>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import { useAuthStore } from '@/stores/auth'
import { useArticlesStore } from '@/stores/articles'
import { DatabaseService } from '@/services/database'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const articlesStore = useArticlesStore()

const comments = ref([])
const newComment = ref('')
const submittingComment = ref(false)
const isLiked = ref(false)
const loading = ref(false)

const articleId = computed(() => route.params.id)
const article = computed(() => articlesStore.currentArticle)

const canEdit = computed(() => {
  return authStore.isAuthenticated && 
         article.value && 
         article.value.authorId === authStore.currentUser?.uid
})

const canEditComment = (comment) => {
  return authStore.isAuthenticated && 
         comment.authorId === authStore.currentUser?.uid
}

const markdownContent = computed(() => {
  if (!article.value?.content) return ''
  try {
    return marked(article.value.content)
  } catch (error) {
    return '<p>コンテンツの表示エラー</p>'
  }
})

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const handleLike = async () => {
  if (!authStore.isAuthenticated || !authStore.currentUser || loading.value) {
    return
  }

  try {
    loading.value = true
    const liked = await DatabaseService.toggleLike(
      authStore.currentUser.uid,
      articleId.value
    )

    isLiked.value = liked
    await articlesStore.fetchArticle(articleId.value)
  } catch (error) {
    console.error('いいねエラー:', error)
  } finally {
    loading.value = false
  }
}

const handleSubmitComment = async () => {
  if (!newComment.value.trim()) return

  try {
    submittingComment.value = true

    const commentData = {
      content: newComment.value.trim(),
      authorId: authStore.currentUser.uid,
      authorName: authStore.currentUserProfile?.displayName || authStore.currentUser.email,
      articleId: articleId.value
    }

    await DatabaseService.createComment(commentData)
    await fetchComments()
    newComment.value = ''
  } catch (error) {
    console.error('コメント投稿エラー:', error)
  } finally {
    submittingComment.value = false
  }
}

const handleDeleteComment = async (commentId) => {
  if (!confirm('コメントを削除しますか？')) return
  
  try {
    await DatabaseService.deleteComment(commentId, articleId.value)
    await fetchComments()
  } catch (error) {
    console.error('コメント削除エラー:', error)
  }
}

const handleDelete = async () => {
  if (!confirm('記事を削除しますか？この操作は取り消せません。')) return
  
  try {
    await articlesStore.deleteArticle(articleId.value)
    router.push('/')
  } catch (error) {
    console.error('記事削除エラー:', error)
  }
}

const fetchComments = async () => {
  try {
    const fetchedComments = await DatabaseService.getArticleComments(articleId.value)
    comments.value = fetchedComments
  } catch (error) {
    console.error('コメント取得エラー:', error)
  }
}

const checkUserLike = async () => {
  if (!authStore.isAuthenticated) return
  
  try {
    const userLikes = await DatabaseService.getUserLikes(authStore.currentUser.uid)
    isLiked.value = userLikes.some(like => like.articleId === articleId.value)
  } catch (error) {
    console.error('いいね状態取得エラー:', error)
  }
}

onMounted(async () => {
  try {
    await articlesStore.fetchArticle(articleId.value)
    await fetchComments()
    await checkUserLike()
  } catch (error) {
    console.error('記事詳細取得エラー:', error)
  }
})
</script>

<style scoped>
.article-detail {
  max-width: 800px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
}

.article {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.article-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.featured-image {
  margin-bottom: 2rem;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
}

.featured-image img {
  width: 100%;
  height: auto;
  display: block;
}

.article-title {
  margin: 0 0 1rem 0;
  color: #2c3e50;
  font-size: 2rem;
  line-height: 1.3;
}

.article-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.author-name {
  font-weight: 600;
  color: #495057;
}

.article-date {
  font-size: 0.875rem;
  color: #6c757d;
}

.article-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.btn-danger:hover {
  background-color: #c82333;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.category-tag {
  background-color: #007bff;
  color: white;
}

.article-content {
  line-height: 1.8;
  color: #2c3e50;
  margin-bottom: 2rem;
}

.article-content :deep(h1),
.article-content :deep(h2),
.article-content :deep(h3),
.article-content :deep(h4),
.article-content :deep(h5),
.article-content :deep(h6) {
  margin: 2rem 0 1rem 0;
  color: #2c3e50;
}

.article-content :deep(p) {
  margin: 1rem 0;
}

.article-content :deep(pre) {
  background-color: #f8f9fa;
  padding: 1rem;
  border-radius: 0.25rem;
  overflow-x: auto;
  border: 1px solid #e9ecef;
}

.article-content :deep(code) {
  background-color: #f8f9fa;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  border: 1px solid #e9ecef;
}

.article-content :deep(blockquote) {
  border-left: 4px solid #007bff;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #6c757d;
  font-style: italic;
}

.article-footer {
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.article-stats {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.like-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: 1px solid #e9ecef;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.like-button:hover {
  background-color: #f8f9fa;
}

.like-button.liked {
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6c757d;
}

.comments-section {
  background: white;
  border-radius: 0.5rem;
  padding: 2rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.comments-title {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.comment-form {
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.login-prompt {
  text-align: center;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  margin-bottom: 2rem;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.no-comments {
  text-align: center;
  padding: 2rem;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
}

.comment {
  border: 1px solid #e9ecef;
  border-radius: 0.25rem;
  padding: 1rem;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.comment-author {
  font-weight: 600;
  color: #495057;
}

.comment-date {
  color: #6c757d;
}

.btn-delete-comment {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem;
}

.btn-delete-comment:hover {
  text-decoration: underline;
}

.comment-content {
  color: #495057;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .article {
    padding: 1rem;
  }

  .featured-image {
    margin-bottom: 1.5rem;
    border-radius: 0.25rem;
  }


  .article-title {
    font-size: 1.5rem;
  }

  .article-meta {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .comments-section {
    padding: 1rem;
  }
}
</style>