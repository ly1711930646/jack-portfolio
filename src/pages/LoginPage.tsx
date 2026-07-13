import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin'
const AUTH_KEY = 'jack-portfolio-auth'

export const isAuthenticated = () => localStorage.getItem(AUTH_KEY) === 'true'

export const login = () => localStorage.setItem(AUTH_KEY, 'true')
export const logout = () => localStorage.removeItem(AUTH_KEY)

const LoginPage = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      setLoading(true)
      login()
      window.location.href = '/admin'
    } else {
      setError('账号或密码错误')
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl p-8 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#D7E2EA] text-center mb-2">后台管理</h1>
        <p className="text-sm text-white/50 text-center mb-8">请输入账号和密码进入后台</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 text-sm text-[#D7E2EA] focus:outline-none focus:border-[#4A90FF] transition-colors"
              placeholder="admin"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#161616] border border-white/10 rounded-xl px-4 py-3 pr-11 text-sm text-[#D7E2EA] focus:outline-none focus:border-[#4A90FF] transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A90FF] hover:bg-[#5C9CFF] disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">← 返回首页</a>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
