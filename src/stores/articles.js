import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { DatabaseService } from '@/services/database'

export const useArticlesStore = defineStore('articles', () => {
  const articles = ref([])
  const currentArticle = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const hasMore = ref(true)
  const lastDocument = ref(null)

  const publishedArticles = computed(() => 
    articles.value.filter(article => article.status === 'published')
  )

  const fetchPublishedArticles = async (limitCount = 20, append = false) => {
    try {
      loading.value = true
      error.value = null
      console.log('公開記事取得開始...', { append, currentArticleCount: articles.value.length })

      const currentLastDoc = append ? lastDocument.value : null
      const result = await DatabaseService.getPublishedArticles(limitCount, currentLastDoc)

      console.log('取得した記事数:', result.articles.length)
      console.log('取得した記事:', result.articles)
      console.log('追加モード:', append, '、hasMore:', result.hasMore)

      if (append) {
        articles.value = [...articles.value, ...result.articles]
      } else {
        articles.value = result.articles
      }

      lastDocument.value = result.lastDocument
      hasMore.value = result.hasMore

    } catch (err) {
      error.value = '記事の取得に失敗しました'
      console.error('記事取得エラー:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchArticlesForUser = async (userId, limitCount = 20, append = false) => {
    try {
      loading.value = true
      error.value = null
      console.log('ユーザー向け記事取得開始...', { userId, append, currentArticleCount: articles.value.length })

      let publishedArticles = []
      let userArticles = []

      try {
        // 公開記事を取得（ページネーション対応）
        const currentLastDoc = append ? lastDocument.value : null
        const result = await DatabaseService.getPublishedArticles(limitCount, currentLastDoc)
        publishedArticles = result.articles || []
        if (!append) {
          lastDocument.value = result.lastDocument
          hasMore.value = result.hasMore
        }
        console.log('公開記事取得成功:', publishedArticles.length, '件')
      } catch (pubError) {
        console.error('公開記事取得失敗:', pubError)
        publishedArticles = []
      }

      if (!append) {
        try {
          // ユーザー記事を取得（初回読み込み時のみ）
          userArticles = await DatabaseService.getUserArticles(userId)
          console.log('ユーザー記事取得成功:', userArticles.length, '件')
        } catch (userError) {
          console.error('ユーザー記事取得失敗:', userError)
        }

        // 重複を除去して結合
        const combinedArticles = [...publishedArticles]

        userArticles.forEach(userArticle => {
          // 既に公開記事として含まれていない場合のみ追加
          if (!combinedArticles.find(article => article.id === userArticle.id)) {
            combinedArticles.push(userArticle)
          }
        })

        // 作成日時順でソート
        combinedArticles.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
          return dateB - dateA
        })

        console.log('取得した合計記事数:', combinedArticles.length)
        console.log('公開記事数:', publishedArticles.length)
        console.log('ユーザー記事数:', userArticles.length)

        articles.value = combinedArticles.slice(0, limitCount)

        // 記事が0件の場合はフォールバック
        if (combinedArticles.length === 0) {
          console.log('記事が0件のため、公開記事のみ再取得')
          await fetchPublishedArticles(limitCount)
        }
      } else {
        // 追加読み込み時は公開記事のみ追加
        articles.value = [...articles.value, ...publishedArticles]
      }
    } catch (err) {
      error.value = '記事の取得に失敗しました'
      console.error('ユーザー向け記事取得エラー:', err)
      // エラー時は公開記事のみ取得をフォールバック
      try {
        await fetchPublishedArticles(limitCount, append)
      } catch (fallbackError) {
        console.error('フォールバックも失敗:', fallbackError)
      }
    } finally {
      loading.value = false
    }
  }

  const fetchArticle = async (articleId) => {
    try {
      loading.value = true
      error.value = null
      console.log('fetchArticle: 記事取得開始', articleId)
      const article = await DatabaseService.getArticle(articleId)

      if (article) {
        currentArticle.value = article
        console.log('fetchArticle: 記事取得成功', {
          id: article.id,
          title: article.title,
          likesCount: article.likesCount
        })
      } else {
        console.log('fetchArticle: 記事が見つかりません', articleId)
        currentArticle.value = null
      }

      return article
    } catch (err) {
      error.value = '記事の取得に失敗しました'
      console.error('記事取得エラー:', err)
      currentArticle.value = null
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchUserArticles = async (userId) => {
    try {
      loading.value = true
      error.value = null
      const userArticles = await DatabaseService.getUserArticles(userId)
      return userArticles
    } catch (err) {
      error.value = 'ユーザーの記事取得に失敗しました'
      console.error('ユーザー記事取得エラー:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createArticle = async (articleData) => {
    try {
      loading.value = true
      error.value = null
      console.log('記事作成開始:', articleData)
      const articleId = await DatabaseService.createArticle(articleData)
      console.log('記事作成成功:', articleId)

      // 新しい記事を配列の先頭に追加
      const newArticle = { id: articleId, ...articleData, createdAt: new Date() }
      console.log('新しい記事オブジェクト:', newArticle)

      if (articleData.status === 'published') {
        articles.value.unshift(newArticle)
        console.log('記事を配列に追加しました。現在の記事数:', articles.value.length)
      } else {
        console.log('下書き記事なので配列に追加しませんでした')
      }

      return articleId
    } catch (err) {
      error.value = '記事の作成に失敗しました'
      console.error('記事作成エラー:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateArticle = async (articleId, articleData) => {
    try {
      loading.value = true
      error.value = null
      await DatabaseService.updateArticle(articleId, articleData)
      
      // 現在の記事を更新
      if (currentArticle.value && currentArticle.value.id === articleId) {
        currentArticle.value = { ...currentArticle.value, ...articleData }
      }
      
      // 記事一覧内の記事を更新
      const index = articles.value.findIndex(article => article.id === articleId)
      if (index !== -1) {
        articles.value[index] = { ...articles.value[index], ...articleData }
      }
      
    } catch (err) {
      error.value = '記事の更新に失敗しました'
      console.error('記事更新エラー:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteArticle = async (articleId) => {
    try {
      loading.value = true
      error.value = null
      await DatabaseService.deleteArticle(articleId)
      
      // 記事一覧から削除
      articles.value = articles.value.filter(article => article.id !== articleId)
      
      // 現在の記事をクリア
      if (currentArticle.value && currentArticle.value.id === articleId) {
        currentArticle.value = null
      }
      
    } catch (err) {
      error.value = '記事の削除に失敗しました'
      console.error('記事削除エラー:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const searchArticles = async (searchText, category = null, tags = null) => {
    try {
      loading.value = true
      error.value = null
      const results = await DatabaseService.searchArticles(searchText, category, tags)
      return results
    } catch (err) {
      error.value = '記事の検索に失敗しました'
      console.error('記事検索エラー:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  const clearCurrentArticle = () => {
    currentArticle.value = null
  }

  const clearAllArticles = () => {
    articles.value = []
    currentArticle.value = null
    error.value = null
    hasMore.value = true
    lastDocument.value = null
  }

  const loadMoreArticles = async (userId = null) => {
    if (!hasMore.value || loading.value) {
      console.log('無限スクロール: 読み込み不要', { hasMore: hasMore.value, loading: loading.value })
      return
    }

    console.log('無限スクロール: 追加記事読み込み開始')

    if (userId) {
      await fetchArticlesForUser(userId, 20, true)
    } else {
      await fetchPublishedArticles(20, true)
    }
  }

  return {
    articles,
    currentArticle,
    loading,
    error,
    hasMore,
    lastDocument,
    publishedArticles,
    fetchPublishedArticles,
    fetchArticlesForUser,
    fetchArticle,
    fetchUserArticles,
    createArticle,
    updateArticle,
    deleteArticle,
    searchArticles,
    clearError,
    clearCurrentArticle,
    clearAllArticles,
    loadMoreArticles
  }
})