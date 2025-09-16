import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Login from '@/views/Login.vue'
import ArticleDetail from '@/views/ArticleDetail.vue'
import ArticleCreate from '@/views/ArticleCreate.vue'
import Search from '@/views/Search.vue'
import Profile from '@/views/Profile.vue'
import AdminCategories from '@/views/AdminCategories.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/article/:id',
      name: 'article',
      component: ArticleDetail
    },
    {
      path: '/create',
      name: 'create',
      component: ArticleCreate
    },
    {
      path: '/edit/:id',
      name: 'edit',
      component: ArticleCreate
    },
    {
      path: '/search',
      name: 'search',
      component: Search
    },
    {
      path: '/profile/:id',
      name: 'profile',
      component: Profile
    },
    {
      path: '/admin/categories',
      name: 'admin-categories',
      component: AdminCategories
    }
  ]
})

export default router