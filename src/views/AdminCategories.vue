<template>
  <div class="admin-categories">
    <div class="admin-header">
      <h1>カテゴリ管理</h1>
      <p class="description">システムで使用するカテゴリを管理します。</p>
    </div>

    <div class="admin-content">
      <!-- 新規カテゴリ追加フォーム -->
      <div class="add-category-form">
        <h3>新規カテゴリ追加</h3>
        <form @submit.prevent="createCategory" class="form">
          <div class="form-row">
            <div class="form-group">
              <label for="name">カテゴリ名</label>
              <input
                id="name"
                v-model="newCategory.name"
                type="text"
                class="form-control"
                placeholder="例: プログラミング"
                required
              />
            </div>
            <div class="form-group">
              <label for="description">説明（任意）</label>
              <input
                id="description"
                v-model="newCategory.description"
                type="text"
                class="form-control"
                placeholder="例: プログラミングに関する記事"
              />
            </div>
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="loading || !newCategory.name.trim()"
          >
            {{ loading ? '追加中...' : 'カテゴリを追加' }}
          </button>
        </form>
      </div>

      <!-- カテゴリ一覧 -->
      <div class="categories-list">
        <h3>既存カテゴリ一覧</h3>
        <div v-if="categories.length === 0" class="no-categories">
          カテゴリがありません
        </div>
        <div v-else class="categories-grid">
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-card"
          >
            <div class="category-info">
              <h4>{{ category.name }}</h4>
              <p v-if="category.description">{{ category.description }}</p>
              <small class="created-date">
                作成日: {{ formatDate(category.createdAt) }}
              </small>
            </div>
            <div class="category-actions">
              <button
                @click="editCategory(category)"
                class="btn btn-secondary btn-sm"
              >
                編集
              </button>
              <button
                @click="deleteCategory(category)"
                class="btn btn-danger btn-sm"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 編集モーダル -->
      <div v-if="editingCategory" class="modal-overlay" @click="cancelEdit">
        <div class="modal" @click.stop>
          <h3>カテゴリ編集</h3>
          <form @submit.prevent="updateCategory" class="form">
            <div class="form-group">
              <label for="edit-name">カテゴリ名</label>
              <input
                id="edit-name"
                v-model="editingCategory.name"
                type="text"
                class="form-control"
                required
              />
            </div>
            <div class="form-group">
              <label for="edit-description">説明</label>
              <input
                id="edit-description"
                v-model="editingCategory.description"
                type="text"
                class="form-control"
              />
            </div>
            <div class="modal-actions">
              <button type="button" @click="cancelEdit" class="btn btn-secondary">
                キャンセル
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="loading"
              >
                {{ loading ? '更新中...' : '更新' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { DatabaseService } from '@/services/database'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getFirestore
} from 'firebase/firestore'

const router = useRouter()
const authStore = useAuthStore()
const db = getFirestore()

const categories = ref([])
const loading = ref(false)
const newCategory = ref({ name: '', description: '' })
const editingCategory = ref(null)

// 管理者権限チェック（簡易版）
const checkAdminAccess = () => {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return false
  }

  // 実際のプロダクションでは、ユーザーロールなどで管理者権限をチェック
  // ここでは簡易的に特定のメールアドレスのみ許可
  const adminEmails = ['admin@example.com', 'nextoda@gmail.com'] // 管理者のメールアドレス
  if (!adminEmails.includes(authStore.currentUser?.email)) {
    alert('管理者権限が必要です')
    router.push('/')
    return false
  }

  return true
}

const fetchCategories = async () => {
  try {
    categories.value = await DatabaseService.getCategories()
  } catch (error) {
    console.error('カテゴリ取得エラー:', error)
    alert('カテゴリの取得に失敗しました')
  }
}

const createCategory = async () => {
  if (!newCategory.value.name.trim()) return

  try {
    loading.value = true

    // 重複チェック
    const existingCategory = categories.value.find(
      cat => cat.name?.toLowerCase() === newCategory.value.name.trim().toLowerCase()
    )

    if (existingCategory) {
      alert('このカテゴリは既に存在します')
      return
    }

    const categoriesRef = collection(db, 'categories')
    const categoryData = {
      name: newCategory.value.name.trim(),
      description: newCategory.value.description.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await addDoc(categoriesRef, categoryData)

    // フォームリセット
    newCategory.value = { name: '', description: '' }

    // 一覧を再取得
    await fetchCategories()

    alert('カテゴリを追加しました')
  } catch (error) {
    console.error('カテゴリ作成エラー:', error)
    alert(`カテゴリの作成に失敗しました: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const editCategory = (category) => {
  editingCategory.value = { ...category }
}

const updateCategory = async () => {
  if (!editingCategory.value) return

  try {
    loading.value = true

    const categoryRef = doc(db, 'categories', editingCategory.value.id)
    await updateDoc(categoryRef, {
      name: editingCategory.value.name.trim(),
      description: editingCategory.value.description.trim(),
      updatedAt: serverTimestamp()
    })

    editingCategory.value = null
    await fetchCategories()

    alert('カテゴリを更新しました')
  } catch (error) {
    console.error('カテゴリ更新エラー:', error)
    alert('カテゴリの更新に失敗しました')
  } finally {
    loading.value = false
  }
}

const deleteCategory = async (category) => {
  if (!confirm(`カテゴリ「${category.name}」を削除しますか？\nこの操作は取り消せません。`)) {
    return
  }

  try {
    loading.value = true

    const categoryRef = doc(db, 'categories', category.id)
    await deleteDoc(categoryRef)

    await fetchCategories()

    alert('カテゴリを削除しました')
  } catch (error) {
    console.error('カテゴリ削除エラー:', error)
    alert('カテゴリの削除に失敗しました')
  } finally {
    loading.value = false
  }
}

const cancelEdit = () => {
  editingCategory.value = null
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(async () => {
  if (!checkAdminAccess()) return
  await fetchCategories()
})
</script>

<style scoped>
.admin-categories {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.admin-header {
  margin-bottom: 3rem;
  text-align: center;
}

.admin-header h1 {
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.description {
  color: #6c757d;
  margin: 0;
}

.admin-content {
  display: grid;
  gap: 3rem;
}

.add-category-form {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.add-category-form h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.categories-list {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
}

.categories-list h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.no-categories {
  text-align: center;
  color: #6c757d;
  padding: 2rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.category-card {
  border: 1px solid #e9ecef;
  border-radius: 0.25rem;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.category-info h4 {
  margin: 0 0 0.5rem 0;
  color: #2c3e50;
}

.category-info p {
  margin: 0 0 0.5rem 0;
  color: #495057;
  font-size: 0.875rem;
}

.created-date {
  color: #6c757d;
  font-size: 0.75rem;
}

.category-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal h3 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .categories-grid {
    grid-template-columns: 1fr;
  }

  .category-card {
    flex-direction: column;
    gap: 1rem;
  }

  .category-actions {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>