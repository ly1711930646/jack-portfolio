import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ContentProvider } from './context/ContentContext'
import PortfolioPage from './pages/PortfolioPage'
import AdminPage from './pages/AdminPage'
import LoginPage, { isAuthenticated } from './pages/LoginPage'

const AdminRoute = () => {
  return isAuthenticated() ? <AdminPage /> : <LoginPage />
}

function App() {
  return (
    <ContentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PortfolioPage />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </BrowserRouter>
    </ContentProvider>
  )
}

export default App
