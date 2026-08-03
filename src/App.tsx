import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ContentProvider } from './context/ContentContext'
import PortfolioPage from './pages/PortfolioPage'
import LoginPage, { isAuthenticated } from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

// 后台（AdminPage）及其依赖的 cos-js-sdk-v5 体积较大，与首屏主包无关，
// 改为懒加载：仅在访问 /admin 时才拉取，显著加快作品集首屏加载。
const AdminPage = lazy(() => import('./pages/AdminPage'))

const AdminRoute = () => {
  return isAuthenticated() ? <AdminPage /> : <LoginPage />
}

// Vite 的 base 在生产环境是 /jack-portfolio/，开发环境是 /。
// React Router 的 basename 需要与部署路径一致，否则子路径部署时根路由不匹配导致白屏。
const rawBase = import.meta.env.BASE_URL || '/'
const routerBasename = rawBase.endsWith('/') && rawBase !== '/' ? rawBase.slice(0, -1) : rawBase

function App() {
  return (
    <ContentProvider>
      <BrowserRouter basename={routerBasename}>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#0C0C0C] text-white/60 text-sm font-light tracking-wider">
              加载中…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<PortfolioPage />} />
            <Route path="/admin" element={<AdminRoute />} />
            {/* 兜底路由：未知路径（如误点的 /admin/register）渲染正规 404 页，不再白屏 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ContentProvider>
  )
}

export default App
