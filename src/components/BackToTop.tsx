import { useState, useEffect } from 'react'

const BackToTop = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className={[
        'back-to-top group fixed bottom-6 right-6 z-50 flex items-center gap-3',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none',
      ].join(' ')}
    >
      <span
        className={[
          'select-none whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium tracking-wide',
          'bg-white/10 border border-white/20 text-[#D7E2EA] backdrop-blur-sm',
          'opacity-0 -translate-x-2 transition-all duration-300',
          'group-hover:opacity-100 group-hover:translate-x-0',
        ].join(' ')}
      >
        返回顶部
      </span>
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="返回顶部"
        className={[
          'w-12 h-12 rounded-full',
          'flex items-center justify-center',
          'bg-white/10 hover:bg-white/20 border border-white/20 text-[#D7E2EA]',
          'backdrop-blur-sm transition-all duration-300',
        ].join(' ')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </button>
    </div>
  )
}

export default BackToTop
