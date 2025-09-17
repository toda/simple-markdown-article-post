<template>
  <div class="article-create">
    <div class="article-header">
      <h1>{{ isEdit ? '記事を編集' : '新しい記事を書く' }}</h1>
    </div>


    <form @submit.prevent="handleSubmit" class="article-form">
      <div class="form-group">
        <label for="title" class="form-label">タイトル</label>
        <input
          id="title"
          v-model="formData.title"
          type="text"
          class="form-control"
          placeholder="記事のタイトルを入力してください"
          required
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="category" class="form-label">カテゴリ</label>
          <select
            id="category"
            v-model="formData.category"
            class="form-control"
          >
            <option value="">カテゴリを選択</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.name"
            >
              {{ category.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label for="tags" class="form-label">タグ（カンマ区切り）</label>
          <input
            id="tags"
            v-model="tagsInput"
            type="text"
            class="form-control"
            placeholder="JavaScript, Vue.js, フロントエンド"
          />
        </div>
      </div>

      <!-- アイキャッチ画像アップロード -->
      <div class="form-group">
        <label class="form-label">画像アップロード</label>
        <div class="image-upload-area">
          <input
            ref="imageInput"
            type="file"
            accept="image/*"
            @change="handleImageSelect"
            style="display: none"
          />

          <div v-if="!imagePreview && !formData.featuredImage" class="upload-placeholder" @click="$refs.imageInput.click()">
            <div class="upload-icon">📷</div>
            <p>画像をアップロード</p>
            <small>JPG, PNG形式（最大5MB）</small>
          </div>

          <div v-else class="image-preview">
            <img
              :src="imagePreview || formData.featuredImage"
              alt="アップロード画像"
              class="preview-image"
            />
            <div class="image-actions">
              <button type="button" @click="$refs.imageInput.click()" class="btn btn-secondary btn-sm">
                変更
              </button>
              <button type="button" @click="removeImage" class="btn btn-danger btn-sm">
                削除
              </button>
            </div>
          </div>

          <div v-if="imageUploading" class="upload-progress">
            <div class="loading-spinner"></div>
            <p>画像をアップロード中...</p>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="content" class="form-label">内容（Markdown）</label>
        <div class="editor-container">
          <textarea
            id="content"
            v-model="formData.content"
            class="form-control editor"
            placeholder="記事の内容をMarkdownで書いてください"
            required
          ></textarea>
          <div class="preview" v-html="markdownPreview"></div>
        </div>
      </div>

      <div class="form-actions">
        <div class="status-group">
          <label class="checkbox-label">
            <input
              v-model="formData.status"
              type="checkbox"
              true-value="published"
              false-value="draft"
            />
            公開する
          </label>
        </div>
        
        <div class="buttons-group">
          <button type="button" @click="goBack" class="btn btn-secondary">
            キャンセル
          </button>
          <button 
            type="submit" 
            class="btn btn-primary"
            :disabled="articlesStore.loading"
          >
            {{ articlesStore.loading ? '保存中...' : (isEdit ? '更新する' : '保存する') }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import { useAuthStore } from '@/stores/auth'
import { useArticlesStore } from '@/stores/articles'
import { DatabaseService } from '@/services/database'
import { StorageService } from '@/services/storage'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const articlesStore = useArticlesStore()

const isEdit = computed(() => route.name === 'edit')
const articleId = computed(() => route.params.id)

const formData = ref({
  title: '',
  content: '',
  category: '',
  status: 'draft',
  tags: [],
  authorId: '',
  authorName: '',
  featuredImage: ''
})

const tagsInput = ref('')
const categories = ref([])

// 画像アップロード関連
const imagePreview = ref('')
const imageUploading = ref(false)
const selectedImageFile = ref(null)
const oldImagePath = ref('')

const markdownPreview = computed(() => {
  if (!formData.value.content) return ''
  try {
    return marked(formData.value.content)
  } catch (error) {
    return 'プレビューエラー'
  }
})

// タグの入力を配列に変換
watch(tagsInput, (newValue) => {
  formData.value.tags = newValue
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
})

const handleSubmit = async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  try {
    articlesStore.clearError()

    // 新しい画像がある場合はアップロード
    if (selectedImageFile.value) {
      const uploadResult = await uploadImage()
      if (uploadResult) {
        // 古い画像があれば削除
        if (oldImagePath.value) {
          try {
            await StorageService.deleteImage(oldImagePath.value)
          } catch (deleteError) {
            console.warn('古い画像の削除に失敗:', deleteError)
          }
        }
        formData.value.featuredImage = uploadResult.url
        oldImagePath.value = uploadResult.path
      } else {
        // 画像アップロードに失敗した場合、ユーザーに選択肢を提示
        const continueWithoutImage = confirm('画像のアップロードに失敗しました。画像なしで記事を投稿しますか？')
        if (!continueWithoutImage) {
          return // 処理を中断
        }
        // 画像なしで継続
        formData.value.featuredImage = ''
        selectedImageFile.value = null
        imagePreview.value = ''
      }
    }

    const articleData = {
      ...formData.value,
      authorId: authStore.currentUser.uid,
      authorName: authStore.currentUserProfile?.displayName || authStore.currentUser.email
    }

    if (isEdit.value) {
      await articlesStore.updateArticle(articleId.value, articleData)
      router.push(`/article/${articleId.value}`)
    } else {
      const newArticleId = await articlesStore.createArticle(articleData)
      // 記事作成後にホーム画面の記事一覧を更新
      if (authStore.isAuthenticated && authStore.currentUser) {
        // ログイン済みユーザー: 公開記事+自分の記事を再取得
        await articlesStore.fetchArticlesForUser(authStore.currentUser.uid)
      } else if (articleData.status === 'published') {
        // 未ログイン: 公開記事のみ再取得
        await articlesStore.fetchPublishedArticles()
      }
      router.push(`/article/${newArticleId}`)
    }
  } catch (error) {
    console.error('記事保存エラー:', error)
    alert(`記事の保存に失敗しました: ${error.message}`)
  }
}

const goBack = () => {
  router.back()
}

// 画像選択ハンドラー
const handleImageSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return

  // ファイルタイプ検証
  if (!file.type.startsWith('image/')) {
    alert('画像ファイルのみ選択できます')
    return
  }

  // ファイルサイズ検証（5MB）
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    alert('ファイルサイズは5MB以下にしてください')
    return
  }

  selectedImageFile.value = file

  // プレビュー用にFileReaderを使用
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target.result
  }
  reader.readAsDataURL(file)
}

// 画像削除
const removeImage = () => {
  imagePreview.value = ''
  formData.value.featuredImage = ''
  selectedImageFile.value = null

  // input要素をリセット
  const input = document.querySelector('input[type="file"]')
  if (input) input.value = ''
}

// 画像アップロード
const uploadImage = async () => {
  if (!selectedImageFile.value || !authStore.currentUser) {
    console.error('画像アップロード: ファイルまたはユーザー情報がありません')
    return null
  }

  try {
    imageUploading.value = true
    console.log('画像アップロード開始:', {
      fileName: selectedImageFile.value.name,
      fileSize: selectedImageFile.value.size,
      fileType: selectedImageFile.value.type,
      userId: authStore.currentUser.uid
    })

    const imagePath = StorageService.generateImagePath(
      authStore.currentUser.uid,
      selectedImageFile.value.name
    )
    console.log('生成された画像パス:', imagePath)

    const imageURL = await StorageService.uploadImage(selectedImageFile.value, imagePath)
    console.log('画像アップロード完了:', imageURL)

    return { url: imageURL, path: imagePath }
  } catch (error) {
    console.error('画像アップロードエラー:', {
      error: error,
      message: error.message,
      code: error.code,
      stack: error.stack
    })

    let errorMessage = '画像のアップロードに失敗しました'
    if (error.code === 'storage/unauthorized') {
      errorMessage = 'Firebase Storageの権限がありません。管理者に連絡してください。'
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage = 'ストレージの容量制限に達しています。'
    } else if (error.code === 'storage/unauthenticated') {
      errorMessage = 'ログインが必要です。'
    } else if (error.message) {
      errorMessage += `: ${error.message}`
    }

    alert(errorMessage)
    return null
  } finally {
    imageUploading.value = false
  }
}

const fetchCategories = async () => {
  try {
    categories.value = await DatabaseService.getCategories()
  } catch (error) {
    console.error('カテゴリ取得エラー:', error)
  }
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }

  // カテゴリ一覧を取得
  await fetchCategories()

  if (isEdit.value && articleId.value) {
    try {
      const article = await articlesStore.fetchArticle(articleId.value)
      if (article) {
        // 編集権限チェック
        if (article.authorId !== authStore.currentUser.uid) {
          router.push('/')
          return
        }

        formData.value = {
          title: article.title || '',
          content: article.content || '',
          category: article.category || '',
          status: article.status || 'draft',
          tags: article.tags || [],
          authorId: article.authorId,
          authorName: article.authorName,
          featuredImage: article.featuredImage || ''
        }

        // 既存画像のパスを保存（編集時の削除用）
        if (article.featuredImage) {
          oldImagePath.value = StorageService.extractPathFromURL(article.featuredImage) || ''
        }
        tagsInput.value = (article.tags || []).join(', ')
      }
    } catch (error) {
      router.push('/')
    }
  }
})
</script>

<style scoped>
.article-create {
  max-width: 1000px;
  margin: 0 auto;
}

.article-header {
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.article-header h1 {
  margin: 0;
  color: #2c3e50;
}

.article-form {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.editor-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  min-height: 400px;
}

.editor {
  resize: vertical;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

.preview {
  border: 1px solid #ced4da;
  border-radius: 0.25rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  overflow-y: auto;
  font-size: 0.875rem;
  line-height: 1.6;
}

.preview :deep(h1),
.preview :deep(h2),
.preview :deep(h3),
.preview :deep(h4),
.preview :deep(h5),
.preview :deep(h6) {
  margin: 1rem 0 0.5rem 0;
  color: #2c3e50;
}

.preview :deep(p) {
  margin: 0.5rem 0;
}

.preview :deep(pre) {
  background-color: #f1f3f4;
  padding: 1rem;
  border-radius: 0.25rem;
  overflow-x: auto;
}

.preview :deep(code) {
  background-color: #f1f3f4;
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #e9ecef;
}

.status-group {
  display: flex;
  align-items: center;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  cursor: pointer;
}

.buttons-group {
  display: flex;
  gap: 1rem;
}

/* 画像アップロード関連のスタイル */
.image-upload-area {
  position: relative;
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  transition: border-color 0.3s ease;
}

.image-upload-area:hover {
  border-color: #6366f1;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  cursor: pointer;
  color: #6b7280;
  transition: color 0.3s ease;
}

.upload-placeholder:hover {
  color: #6366f1;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.upload-placeholder p {
  margin: 0.5rem 0;
  font-weight: 500;
  font-size: 1.1rem;
}

.upload-placeholder small {
  font-size: 0.875rem;
  color: #9ca3af;
}

.image-preview {
  position: relative;
  display: inline-block;
  width: 100%;
}

.preview-image {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: block;
  margin: 0 auto;
}

.image-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.5rem;
}

.image-actions .btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  opacity: 0.9;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 0.5rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #6366f1;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .editor-container {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    flex-direction: column;
    gap: 1rem;
  }
  
  .buttons-group {
    width: 100%;
    justify-content: stretch;
  }
  
  .buttons-group .btn {
    flex: 1;
  }
}
</style>