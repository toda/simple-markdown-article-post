import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase/config'

export class DatabaseService {
  // デバッグ用: 全ユーザー一覧表示
  static async debugListAllUsers() {
    try {
      const usersRef = collection(db, 'users')
      const snapshot = await getDocs(usersRef)
      console.log('=== 全ユーザー一覧 ===')
      console.log('ユーザー数:', snapshot.docs.length)

      snapshot.docs.forEach((doc, index) => {
        const data = doc.data()
        console.log(`${index + 1}. ID: ${doc.id}`, {
          uid: data.uid,
          email: data.email,
          displayName: data.displayName,
          createdAt: data.createdAt
        })
      })
      console.log('===================')
    } catch (error) {
      console.error('debugListAllUsers: エラー', error)
    }
  }

  // ユーザー関連
  static async checkDisplayNameExists(displayName, excludeUid = null) {
    if (!displayName) {
      console.log('checkDisplayNameExists: 空のdisplayName')
      return false
    }

    const normalizedName = displayName.toLowerCase()
    console.log('checkDisplayNameExists: チェック中...', displayName, '→', normalizedName)

    try {
      const usersRef = collection(db, 'users')

      console.log('checkDisplayNameExists: 全ユーザー取得中...')
      const allUsersSnapshot = await getDocs(usersRef)
      console.log('checkDisplayNameExists: 全ユーザー数:', allUsersSnapshot.docs.length)

      // 全ユーザーのdisplayNameを詳細にログ出力
      const allUsers = allUsersSnapshot.docs.map(doc => {
        const data = doc.data()
        console.log('checkDisplayNameExists: ユーザー詳細:', {
          id: doc.id,
          uid: data.uid,
          displayName: data.displayName,
          email: data.email,
          emailVerified: data.emailVerified
        })
        return { id: doc.id, ...data }
      })

      console.log('checkDisplayNameExists: 検索対象名:', normalizedName)

      const matchingUsers = allUsers.filter(user => {
        if (excludeUid && user.uid === excludeUid) {
          console.log('checkDisplayNameExists: 自分のUID除外:', user.uid)
          return false // 自分は除外
        }

        // メール認証済みのユーザーのみをチェック対象とする
        if (!user.emailVerified) {
          console.log('checkDisplayNameExists: メール未認証のため除外:', user.uid, user.displayName)
          return false
        }

        const userDisplayName = user.displayName || ''
        const userNormalized = userDisplayName.toLowerCase()
        const matches = userNormalized === normalizedName

        console.log('checkDisplayNameExists: 比較中:', {
          userDisplayName,
          userNormalized,
          targetName: normalizedName,
          matches,
          emailVerified: user.emailVerified
        })

        if (matches) {
          console.log('checkDisplayNameExists: ★マッチしたユーザー:', user.uid, user.displayName, '(認証済み)')
        }

        return matches
      })

      const exists = matchingUsers.length > 0
      console.log('checkDisplayNameExists: ★最終結果★', {
        exists,
        matchingCount: matchingUsers.length,
        matchingUsers: matchingUsers.map(u => ({ uid: u.uid, displayName: u.displayName }))
      })

      return exists
    } catch (error) {
      console.error('checkDisplayNameExists: エラー', error)

      // エラー時は安全側に振って false を返す（登録は通す）
      console.warn('checkDisplayNameExists: エラーのため重複チェックをスキップ')
      return false
    }
  }

  static async createUser(uid, userData) {
    console.log('createUser: 開始', uid, userData)

    try {
      const userRef = doc(db, 'users', uid)

      // displayNameが空の場合は簡単な作成
      if (!userData.displayName || userData.displayName.trim() === '') {
        console.log('createUser: displayNameなしでユーザー作成')
        await setDoc(userRef, {
          ...userData,
          displayNameLower: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
        console.log('createUser: ユーザー作成成功（displayNameなし）')
        return
      }

      // displayNameがある場合
      const normalizedDisplayName = userData.displayName.toLowerCase()
      console.log('createUser: displayName付きユーザー作成', { displayName: userData.displayName, normalized: normalizedDisplayName })

      const existingDoc = await getDoc(userRef)

      if (existingDoc.exists()) {
        console.log('createUser: 既存ユーザーの更新')
        await updateDoc(userRef, {
          ...userData,
          displayNameLower: normalizedDisplayName,
          updatedAt: serverTimestamp()
        })
      } else {
        console.log('createUser: 新規ユーザーの作成')
        await setDoc(userRef, {
          ...userData,
          displayNameLower: normalizedDisplayName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }

      console.log('createUser: ユーザー作成成功')
    } catch (error) {
      console.error('createUser: エラー詳細', error)

      // エラーメッセージの詳細化
      if (error.message === 'このユーザー名は既に使用されています') {
        throw error
      } else if (error.code) {
        // Firestoreエラーの場合
        throw new Error(`データベースエラー: ${error.message}`)
      } else {
        throw new Error(`予期しないエラーが発生しました: ${error.message}`)
      }
    }
  }


  static async getUser(uid) {
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null
  }

  static async updateUser(uid, userData) {
    try {
      const userRef = doc(db, 'users', uid)

      // displayNameが変更される場合の重複チェック
      if (userData.displayName) {
        const currentUserSnap = await getDoc(userRef)

        if (!currentUserSnap.exists()) {
          throw new Error('ユーザーが見つかりません')
        }

        const currentUser = currentUserSnap.data()
        const oldDisplayName = currentUser.displayName

        // displayNameが変更される場合のみ重複チェック
        if (oldDisplayName !== userData.displayName) {
          const exists = await this.checkDisplayNameExists(userData.displayName, uid)
          if (exists) {
            console.log('updateUser: displayName重複検出')
            throw new Error('このユーザー名は既に使用されています')
          }
        }

        const normalizedDisplayName = userData.displayName.toLowerCase()
        const updateData = {
          ...userData,
          displayNameLower: normalizedDisplayName,
          updatedAt: serverTimestamp()
        }

        await updateDoc(userRef, updateData)
        console.log('updateUser: displayName付き更新成功')

      } else {
        // displayNameが含まれない場合は通常の更新
        const updateData = {
          ...userData,
          updatedAt: serverTimestamp()
        }

        await updateDoc(userRef, updateData)
        console.log('updateUser: 通常更新成功')
      }
    } catch (error) {
      console.error('updateUser: ユーザー更新エラー', error)
      throw error
    }
  }

  // 記事関連
  static async createArticle(articleData) {
    const articlesRef = collection(db, 'articles')
    const docRef = await addDoc(articlesRef, {
      ...articleData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      likesCount: 0,
      commentsCount: 0
    })
    return docRef.id
  }

  static async getArticle(articleId) {
    const articleRef = doc(db, 'articles', articleId)
    const articleSnap = await getDoc(articleRef)
    return articleSnap.exists() ? { id: articleSnap.id, ...articleSnap.data() } : null
  }

  static async updateArticle(articleId, articleData) {
    const articleRef = doc(db, 'articles', articleId)
    await updateDoc(articleRef, {
      ...articleData,
      updatedAt: serverTimestamp()
    })
  }

  static async deleteArticle(articleId) {
    const articleRef = doc(db, 'articles', articleId)
    await deleteDoc(articleRef)
  }

  static async deleteUser(uid) {
    try {
      console.log('deleteUser: ユーザー削除開始', uid)
      const userRef = doc(db, 'users', uid)
      await deleteDoc(userRef)
      console.log('deleteUser: ユーザー削除成功')
    } catch (error) {
      console.error('deleteUser: ユーザー削除エラー', error)
      throw error
    }
  }


  static async getPublishedArticles(limitCount = 20, lastDocument = null) {
    const articlesRef = collection(db, 'articles')

    try {
      console.log('Firestore クエリ実行中（認証不要）...', { limitCount, hasLastDocument: !!lastDocument })

      // まずorderByなしで試す（インデックスエラー回避）
      let q = query(
        articlesRef,
        where('status', '==', 'published'),
        limit(limitCount)
      )

      // ページネーション用: 前回の最後のドキュメントから続きを取得
      if (lastDocument) {
        q = query(
          articlesRef,
          where('status', '==', 'published'),
          startAfter(lastDocument),
          limit(limitCount)
        )
      }

      const querySnapshot = await getDocs(q)
      console.log('公開記事数:', querySnapshot.docs.length, '件')

      const publishedArticles = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // クライアントサイドでソート
      publishedArticles.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
        return dateB - dateA
      })

      console.log('取得した公開記事:', publishedArticles)

      // 最後のドキュメントを返す（次回のページネーション用）
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null

      return {
        articles: publishedArticles,
        lastDocument: lastDoc,
        hasMore: querySnapshot.docs.length === limitCount
      }
    } catch (error) {
      console.error('getPublishedArticles エラー:', error)

      // フォールバック: 全記事を取得してクライアントサイドでフィルタリング
      try {
        console.log('フォールバック: 全記事を取得してフィルタリング...')
        const allQuerySnapshot = await getDocs(articlesRef)
        const allArticles = allQuerySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        const publishedArticles = allArticles.filter(article => article.status === 'published')

        publishedArticles.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
          return dateB - dateA
        })

        const startIndex = lastDocument ? publishedArticles.findIndex(article => article.id === lastDocument.id) + 1 : 0
        const endIndex = startIndex + limitCount
        const paginatedArticles = publishedArticles.slice(startIndex, endIndex)

        return {
          articles: paginatedArticles,
          lastDocument: null,
          hasMore: endIndex < publishedArticles.length
        }
      } catch (fallbackError) {
        console.error('フォールバックも失敗:', fallbackError)
        throw fallbackError
      }
    }
  }

  static async getUserArticles(userId) {
    const articlesRef = collection(db, 'articles')

    try {
      console.log('ユーザー記事取得中:', userId)

      // orderByを削除してシンプルなクエリに
      const q = query(
        articlesRef,
        where('authorId', '==', userId)
      )

      const querySnapshot = await getDocs(q)
      console.log('ユーザー記事数:', querySnapshot.docs.length)

      const userArticles = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // クライアントサイドでソート
      userArticles.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
        return dateB - dateA
      })

      console.log('取得したユーザー記事:', userArticles)
      return userArticles
    } catch (error) {
      console.error('getUserArticles エラー:', error)
      throw error
    }
  }

  static async searchArticles(searchText, category = null, tags = null) {
    console.log('searchArticles: 検索開始', { searchText, category, tags })

    try {
      const articlesRef = collection(db, 'articles')
      let constraints = [where('status', '==', 'published')]

      if (category) {
        constraints.push(where('category', '==', category))
        console.log('searchArticles: カテゴリフィルター追加', category)
      }

      if (tags && tags.length > 0) {
        constraints.push(where('tags', 'array-contains-any', tags))
        console.log('searchArticles: タグフィルター追加', tags)
      }

      // orderByを削除してインデックスエラーを回避し、クライアントサイドでソート
      const q = query(articlesRef, ...constraints)
      console.log('searchArticles: Firestoreクエリ実行中...')

      const querySnapshot = await getDocs(q)
      console.log('searchArticles: 取得した記事数:', querySnapshot.docs.length)

      let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // テキスト検索（クライアントサイドフィルタリング）
      if (searchText) {
        const searchLower = searchText.toLowerCase()
        console.log('searchArticles: テキスト検索実行:', searchLower)

        results = results.filter(article => {
          const titleMatch = article.title && article.title.toLowerCase().includes(searchLower)
          const contentMatch = article.content && article.content.toLowerCase().includes(searchLower)
          return titleMatch || contentMatch
        })

        console.log('searchArticles: テキスト検索後の結果数:', results.length)
      }

      // クライアントサイドでソート（作成日時の降順）
      results.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
        const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
        return dateB - dateA
      })

      console.log('searchArticles: 最終結果数:', results.length)
      return results
    } catch (error) {
      console.error('searchArticles: エラー発生', error)
      throw error
    }
  }

  // コメント関連
  static async createComment(commentData) {
    const commentsRef = collection(db, 'comments')
    const docRef = await addDoc(commentsRef, {
      ...commentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    // 記事のコメント数を更新
    const articleRef = doc(db, 'articles', commentData.articleId)
    await updateDoc(articleRef, {
      commentsCount: increment(1)
    })
    
    return docRef.id
  }

  static async getArticleComments(articleId) {
    const commentsRef = collection(db, 'comments')
    const q = query(
      commentsRef,
      where('articleId', '==', articleId)
    )
    const querySnapshot = await getDocs(q)
    const comments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // クライアント側でソート（作成日時の昇順）
    return comments.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0)
      const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0)
      return dateA - dateB
    })
  }

  static async updateComment(commentId, commentData) {
    const commentRef = doc(db, 'comments', commentId)
    await updateDoc(commentRef, {
      ...commentData,
      updatedAt: serverTimestamp()
    })
  }

  static async deleteComment(commentId, articleId) {
    const commentRef = doc(db, 'comments', commentId)
    await deleteDoc(commentRef)
    
    // 記事のコメント数を更新
    const articleRef = doc(db, 'articles', articleId)
    await updateDoc(articleRef, {
      commentsCount: increment(-1)
    })
  }

  // いいね関連
  static async toggleLike(userId, articleId) {
    try {
      const likeId = `${userId}_${articleId}`
      const likeRef = doc(db, 'likes', likeId)
      const likeSnap = await getDoc(likeRef)
      const articleRef = doc(db, 'articles', articleId)

      if (likeSnap.exists()) {
        // いいねを削除
        await deleteDoc(likeRef)
        await updateDoc(articleRef, {
          likesCount: increment(-1)
        })
        return false
      } else {
        // いいねを追加
        await setDoc(likeRef, {
          userId,
          articleId,
          createdAt: serverTimestamp()
        })
        await updateDoc(articleRef, {
          likesCount: increment(1)
        })
        return true
      }
    } catch (error) {
      console.error('いいね機能エラー:', error)
      throw error
    }
  }

  static async getUserLikes(userId) {
    const likesRef = collection(db, 'likes')
    const q = query(likesRef, where('userId', '==', userId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  // カテゴリ関連
  static async getCategories() {
    const categoriesRef = collection(db, 'categories')
    const querySnapshot = await getDocs(categoriesRef)
    const categories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // 名前順でソート
    return categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }


  // タグ関連
  static async getTags() {
    const tagsRef = collection(db, 'tags')
    const querySnapshot = await getDocs(tagsRef)
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }
}