import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ContentProvider } from './context/ContentContext'
import PortfolioPage from './pages/PortfolioPage'
import AdminPage from './pages/AdminPage'
import LoginPage, { isAuthenticated } from './pages/LoginPage'

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
        <Routes>
          <Route path="/" element={<PortfolioPage />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </BrowserRouter>
    </ContentProvider>
  )
}

export default App
