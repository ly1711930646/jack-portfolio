import { type FC } from 'react'

type ButtonIcon = 'arrow' | 'search'

interface LiveProjectButtonProps {
  onClick?: () => void
  /**
   * 按钮尾部的小图标
   * - 'arrow'  ↗  跳转箭头（默认）
   * - 'search' 🔍 放大镜，仅「国内电商」类目下使用
   */
  icon?: ButtonIcon
}

const ArrowIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
)

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const LiveProjectButton: FC<LiveProjectButtonProps> = ({ onClick, icon = 'arrow' }) => {
  // 仅放大镜模式下做轻微的 hover 放大反馈；箭头保持原本的右上轻推
  const iconClass =
    icon === 'search'
      ? 'transition-transform duration-200 group-hover:scale-110'
      : 'transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="group inline-flex items-center gap-2 rounded-full border-2 border-[#D7E2EA] px-6 py-2.5 sm:px-8 sm:py-3 text-sm sm:text-base text-[#D7E2EA] font-medium hover:bg-[#D7E2EA]/10 transition-colors duration-200"
      aria-label={icon === 'search' ? '查看大图' : '查看更多'}
    >
      查看更多
      {icon === 'search' ? <SearchIcon className={iconClass} /> : <ArrowIcon className={iconClass} />}
    </button>
  )
}

export default LiveProjectButton