import { useNavigate } from 'react-router-dom'

const NotFoundPage = () => {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-6xl font-bold text-[#D7E2EA] mb-4">404</h1>
        <p className="text-white/50 mb-8">页面不存在或已被移动</p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#4A90FF] hover:bg-[#5C9CFF] text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          返回首页
        </button>
      </div>
    </div>
  )
}

export default NotFoundPage
