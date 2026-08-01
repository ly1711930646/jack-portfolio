import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { ProjectItem } from '../content/siteContent'
import { SmartImage } from './SmartImage'

interface ProjectModalProps {
  project: ProjectItem
  onClose: () => void
}

const ZOOM_MIN = 0.3
const ZOOM_MAX = 3
const ZOOM_STEP = 0.25

// 判断项目是否属于「国内电商」类目（用于显示缩放工具栏）
const isDomesticEcommerce = (p: ProjectItem) => {
  const tags = Array.isArray(p.tags) ? p.tags : []
  return tags.some((t) => t.trim() === '国内电商') || (p.category || '').trim() === '国内电商'
}

const ZoomInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
)

const ZoomOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
    <path d="M8 11h6" />
  </svg>
)

const ProjectModal = ({ project, onClose }: ProjectModalProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoom, setZoom] = useState(0.3) // 国内电商默认 30% 预览
  const [imgHeights, setImgHeights] = useState<number[]>([]) // 每张图 onLoad 时的 clientHeight（未 scale）
  const [shakeTick, setShakeTick] = useState(0) // 窗口抖动计数
  const onCloseRef = useRef(onClose) // 父组件频繁重渲染会创建新的 onClose，用 ref 保持引用稳定
  const prevProjectRef = useRef<ProjectItem | null>(null)
  const showZoomBar = isDomesticEcommerce(project)

  // 同步更新 onCloseRef，但不用它触发 useEffect 重执行
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))

  const zoomIn = () => setZoom((z) => clampZoom(+(z + ZOOM_STEP).toFixed(2)))
  const zoomOut = () => setZoom((z) => clampZoom(+(z - ZOOM_STEP).toFixed(2)))
  const zoomReset = () => setZoom(1)

  // 触发窗口抖动反馈（点击遮罩/按 Escape 时）
  const triggerShake = () => {
    setShakeTick((t) => (t >= 1000 ? 1 : t + 1))
  }

  // 图片加载后记录其布局高度，用于在 zoom 变化时同步 wrapper 高度，
  // 避免 transform: scale 视觉缩小但 layout 不变导致下方留白仍可滚动。
  // 注意：读取高度时必须先移除可能已应用的 scale，否则 clientHeight 是缩放后的值，
  // 后续再乘以 zoom 会得到错误高度，造成图片"跳回去"/高度异常。
  const handleImgLoad = (i: number, e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    const savedTransform = img.style.transform
    img.style.transform = ''
    const h = img.clientHeight
    img.style.transform = savedTransform
    setImgHeights((prev) => {
      const next = [...prev]
      next[i] = h
      return next
    })
  }

  // 弹窗外壳动画：渐入渐出 + shakeTick 变化时触发水平抖动
  const shellAnimate = useMemo(
    () => ({
      opacity: 1,
      scale: 1,
      y: 0,
      x: shakeTick > 0 ? [0, -12, 12, -9, 9, -5, 5, -2, 2, 0] : 0,
    }),
    [shakeTick],
  )

  useEffect(() => {
    // 弹窗关闭（project 变 null）时，重置"上一个项目"引用，
    // 这样再次打开同一个项目时 isNewProject 才会为 true，从而重置弹窗内部状态。
    if (!project) {
      prevProjectRef.current = null
      return
    }

    // 仅当 project 真正变化（或首次打开 / 重新打开）时才重置弹窗内部状态。
    // 避免父组件因 section 级 mousemove 频繁重渲染、onClose 引用变化导致 zoom 被重置。
    const isNewProject = prevProjectRef.current?.number !== project.number
    prevProjectRef.current = project
    if (isNewProject) {
      setCurrentIndex(0)
      setZoom(0.3)
      setImgHeights([])
      setShakeTick(0)
    }

    // 打开弹窗时通过 body class 统一隐藏顶部导航栏和右下角返回顶部按钮
    document.body.classList.add('modal-open')

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        triggerShake()
        return
      }
      // 仅「国内电商」类目下：快捷键 +/-/0 控制缩放
      if (showZoomBar) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          zoomIn()
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault()
          zoomOut()
        } else if (e.key === '0') {
          zoomReset()
        }
      }
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('modal-open')
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
    // 不依赖 onClose：父组件的匿名函数每次渲染都会变，会导致本 effect 反复执行并重置 zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, showZoomBar])

  // Ctrl/Cmd + 滚轮 → 缩放（仅「国内电商」类目）
  useEffect(() => {
    if (!showZoomBar) return
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      if (e.deltaY < 0) zoomIn()
      else if (e.deltaY > 0) zoomOut()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [showZoomBar])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const items = Array.from(el.querySelectorAll<HTMLElement>('[data-slide]'))
      if (!items.length) return
      const center = el.scrollTop + el.clientHeight / 2
      let nearest = 0
      let minDist = Infinity
      items.forEach((item, i) => {
        const itemCenter = item.offsetTop + item.offsetHeight / 2
        const dist = Math.abs(center - itemCenter)
        if (dist < minDist) {
          minDist = dist
          nearest = i
        }
      })
      setCurrentIndex(nearest)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const images = project.images && project.images.length > 0 ? project.images : []

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} 作品详情`}
      style={{ willChange: 'opacity' }}
    >
      {/* 背景遮罩：点击只抖动窗口，不关闭 */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-sm"
        onClick={triggerShake}
        aria-hidden="true"
      />

      {/* 弹窗主体：打开/关闭均为渐入渐出 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={shellAnimate}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{
          opacity: { duration: 0.4, ease: 'easeOut' },
          scale: { duration: 0.4, ease: 'easeOut' },
          y: { duration: 0.4, ease: 'easeOut' },
          x: { duration: 0.42, ease: 'easeInOut' },
        }}
        className="modal-shell relative z-10 flex h-full max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] sm:rounded-[32px] md:rounded-[40px] border border-white/10 bg-[#0C0C0C] shadow-2xl"
        style={{
          willChange: 'transform, opacity',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部信息 */}
        <div className="flex shrink-0 items-center justify-between px-5 sm:px-8 md:px-10 py-4 sm:py-5 border-b border-white/10 bg-[#0C0C0C]">
          <div className="flex items-center gap-4 sm:gap-6">
            <span
              className="text-[#D7E2EA] font-black leading-none"
              style={{ fontSize: 'clamp(2rem, 6vw, 64px)' }}
            >
              {project.number}
            </span>
            <div className="flex flex-col">
              <span className="text-[#D7E2EA]/60 text-xs sm:text-sm uppercase tracking-wider">
                {project.category}
              </span>
              <h3 className="text-[#D7E2EA] text-lg sm:text-2xl font-medium uppercase leading-tight">
                {project.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {images.length > 0 && (
              <span className="hidden sm:inline-block text-[#D7E2EA]/50 text-sm font-medium tracking-wider">
                {String(currentIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 w-10 h-10 rounded-full border border-white/20 text-[#D7E2EA] hover:bg-white/10 hover:rotate-90 active:scale-90 flex items-center justify-center transition-all duration-300 ease-out"
              aria-label="关闭"
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 图片内容区 - 在固定框内滚动 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          {images.length > 0 ? (
            <div className="flex flex-col">
              {images.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  data-slide
                  className="block w-full overflow-hidden"
                  style={
                    showZoomBar && imgHeights[i]
                      ? { height: `${imgHeights[i] * zoom}px` }
                      : undefined
                  }
                >
                  <SmartImage
                    src={src}
                    alt={`${project.name} 作品 ${i + 1}`}
                    className="w-full h-auto object-cover origin-top block transition-transform duration-200 ease-out"
                    style={showZoomBar ? { transform: `scale(${zoom})` } : undefined}
                    loading={i <= 1 ? 'eager' : 'lazy'}
                    draggable={false}
                    onLoad={(e) => handleImgLoad(i, e)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-[#D7E2EA]/40">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <p className="mt-6 text-base">暂无作品图片</p>
              <p className="mt-2 text-sm">请在后台为该项目的「作品图片」上传图片</p>
            </div>
          )}
        </div>

        {/* 仅「国内电商」类目：右侧中部竖排缩放工具栏 */}
        {showZoomBar && images.length > 0 && (
          <div
            className="pointer-events-none absolute right-3 sm:right-4 md:right-5 top-1/2 -translate-y-1/2 z-20"
            aria-label="图片缩放"
          >
            <div className="pointer-events-auto flex flex-col items-center overflow-hidden rounded-full border border-white/15 bg-[#0C0C0C]/85 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= ZOOM_MAX}
                className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center text-[#D7E2EA] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="放大"
                title="放大（Ctrl/⌘ + 滚轮上滚 或 +）"
              >
                <ZoomInIcon />
              </button>
              <span className="block h-px w-6 bg-white/15" aria-hidden="true" />
              <span
                className="flex h-9 items-center justify-center px-2 text-xs sm:text-sm font-medium tabular-nums text-[#D7E2EA]/80 select-none cursor-pointer hover:text-[#D7E2EA]"
                onClick={zoomReset}
                title="点击恢复 100%"
                aria-label={`当前缩放 ${Math.round(zoom * 100)}%`}
              >
                {Math.round(zoom * 100)}%
              </span>
              <span className="block h-px w-6 bg-white/15" aria-hidden="true" />
              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= ZOOM_MIN}
                className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center text-[#D7E2EA] hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="缩小"
                title="缩小（Ctrl/⌘ + 滚轮下滚 或 -）"
              >
                <ZoomOutIcon />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export default ProjectModal
