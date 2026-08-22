import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, RefreshCw } from 'lucide-react'
import LiveProjectButton from './LiveProjectButton'
import ProjectModal from './ProjectModal'
import { useContent } from '../context/ContentContext'
import type { ProjectItem } from '../content/siteContent'
import { SmartImage } from './SmartImage'
import { isZoomableCategory } from '../utils/projectCategory'

// 项目底部区域统一只渲染一张图:有 coverImg 显示主图,空时显示统一占位大图
const FALLBACK_PLACEHOLDER = 'assets/remote/placeholder-deco-tr.svg'

const ProjectCard = forwardRef<HTMLDivElement, {
  project: ProjectItem
  index: number
  onOpen: (project: ProjectItem) => void
  isActive: boolean
  dragOffset: { x: number; y: number }
  isDragging: boolean
}>(({
  project,
  index,
  onOpen,
  isActive,
  dragOffset,
  isDragging,
}, ref) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const cardRafRef = useRef<number | null>(null)
  const cardMouseRef = useRef({ x: 0, y: 0 })

  // spotlight 光效：坐标设置在 .spotlight-glow 层上（而非卡片本身）。
  // glow 层比卡片向外扩展 80px，光晕可自然溢出四边，不会被卡片圆角/堆叠裁切。
  // --xp/--yp 仍为相对视口比例，用于色相随鼠标横向扩散。
  const flushCardSpotlight = () => {
    cardRafRef.current = null
    const glow = glowRef.current
    if (!glow) return
    const { x, y } = cardMouseRef.current
    const r = glow.getBoundingClientRect()
    const localX = x - r.left
    const localY = y - r.top
    glow.style.setProperty('--x', localX.toFixed(2))
    glow.style.setProperty('--xp', (x / window.innerWidth).toFixed(2))
    glow.style.setProperty('--y', localY.toFixed(2))
    glow.style.setProperty('--yp', (y / window.innerHeight).toFixed(2))
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    cardMouseRef.current = { x: e.clientX, y: e.clientY }
    if (!cardRafRef.current) {
      cardRafRef.current = requestAnimationFrame(flushCardSpotlight)
    }
  }

  const handleMouseLeave = () => {
    if (cardRafRef.current) {
      cancelAnimationFrame(cardRafRef.current)
      cardRafRef.current = null
    }
  }

  // 用纯 CSS sticky 实现"卡片堆叠"视觉,不再用 framer-motion useScroll
  // (旧实现下容器高度 85vh < 100vh viewport,scrollYProgress 永远是 0 或 1,
  // scale 动画失效且多重 sticky 容易让浏览器误判滚动边界,看起来"卡死")
  return (
    <div
      ref={ref}
      className={[
        'sticky flex items-center justify-center pointer-events-none spotlight-wrapper',
        isActive ? 'is-active' : '',
      ].join(' ')}
      style={{
        top: `calc(8rem + ${index * 24}px)`,
        height: 'min(85vh, auto)',
        // 拖拽中临时置顶，保证拖拽完整可见且可交互；
        // 静止（未拖拽）时恢复自然层叠，层优先级不变
        zIndex: isDragging ? 9999 : undefined,
      }}
    >
      {/* 光效层：比卡片向外扩展 80px，可溢出四边且不会被其他卡片盖住 */}
      <div ref={glowRef} className="spotlight-glow" aria-hidden="true" />
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
        className={[
          'spotlight-card relative w-full rounded-[24px] sm:rounded-[32px] md:rounded-[40px] border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:p-6 md:p-8 pointer-events-auto',
        ].join(' ')}
        style={{
          transform: isDragging || dragOffset.x !== 0 || dragOffset.y !== 0
            ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
            : undefined,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: isDragging ? 'none' : 'auto',
        } as React.CSSProperties}
      >
        {/* 真实内容层：光效由同级的 .spotlight-glow 提供 */}
        <div className="spotlight-inner">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
              <span
                className="text-[#D7E2EA] font-black leading-none"
                style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
              >
                {project.number}
              </span>
              <div className="flex flex-col">
                <span className="text-[#D7E2EA]/60 text-xs sm:text-sm uppercase tracking-wider">
                  {project.category}
                </span>
                <h3
                  className="text-[#D7E2EA] font-medium uppercase leading-tight"
                  style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
                >
                  {project.name}
                </h3>
              </div>
            </div>
            <LiveProjectButton
              onClick={() => onOpen(project)}
              icon={isZoomableCategory(project) ? 'search' : 'arrow'}
            />
          </div>

          {/* Bottom Row - 统一一张大图(主图或占位)，四边边距一致；
              内层圆角 = 外层圆角 - padding，使四个角视觉上与外层卡片同心重合。
              移动端使用 object-contain + 高度自适应，避免后台上传的不同比例图片被裁切。 */}
          <div className="w-full h-auto sm:h-[clamp(280px,38vw,560px)]">
            <SmartImage
              src={project.coverImg || FALLBACK_PLACEHOLDER}
              alt=""
              className="w-full h-auto sm:h-full rounded-lg object-contain sm:object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  )
})

const ProjectsSection = () => {
  const { content } = useContent()
  const { projects } = content
  const tabs = projects.filterTabs ?? ['全部', 'UI设计', '跨境电商', '国内电商']
  const [activeTab, setActiveTab] = useState(0)
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null)
  const handleCloseModal = useCallback(() => setActiveProject(null), [])

  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([])
  const sectionRef = useRef<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // section 级 hover：根据鼠标在折叠堆叠中的垂直位置，判断该激活哪张卡片
  //（解决被前面卡片盖住时，后面卡片自己的 onMouseEnter 无法触发的问题）
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const lastMousePos = useRef({ x: 0, y: 0 })
  const spotlightRafRef = useRef<number | null>(null)
  const spotlightPendingRef = useRef(false)

  // 每张卡片的拖拽位移（容器级统一管理）
  const [cardDrags, setCardDrags] = useState<{ x: number; y: number }[]>([])
  const cardDragRefs = useRef<{ x: number; y: number }[]>([])
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  // 长按 / 拖拽过程状态
  const LONG_PRESS_MS = 260
  const MOVE_THRESHOLD = 6
  const dragCtrl = useRef({
    pending: false,
    didDrag: false,
    activeDragIndex: -1,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    initLeft: 0,
    initTop: 0,
    cardWidth: 0,
    cardHeight: 0,
    pointerId: -1,
    longPressTimer: null as number | null,
  })

  // 项目列表变化时重置位移
  useEffect(() => {
    const reset = filteredItems.map(() => ({ x: 0, y: 0 }))
    setCardDrags(reset)
    cardDragRefs.current = reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.items, activeTab])

  // 监听滚动：在顶部时隐藏「返回顶部」按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 100)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // 同步更新指定卡片的光效坐标（解决被盖住卡片的 onMouseMove 无法触发导致光效错位）
  // 坐标设置在 .spotlight-glow 层上，glow 比卡片向外扩展 80px，光晕可自然溢出四边。
  const updateSpotlight = useCallback((idx: number | null) => {
    if (idx == null) return
    const wrapper = wrapperRefs.current[idx]
    if (!wrapper) return
    const glow = wrapper.querySelector('.spotlight-glow') as HTMLElement | null
    const card = wrapper.querySelector('.spotlight-card') as HTMLElement | null
    if (!glow || !card) return
    const { x, y } = lastMousePos.current

    // glow 层比卡片向外扩展 80px，用相对 glow 的坐标画柔光斑
    const gr = glow.getBoundingClientRect()
    glow.style.setProperty('--x', (x - gr.left).toFixed(2))
    glow.style.setProperty('--y', (y - gr.top).toFixed(2))

    // 卡片边框发光描边用相对卡片的坐标，保证光圈紧贴边框
    const cr = card.getBoundingClientRect()
    card.style.setProperty('--x', (x - cr.left).toFixed(2))
    card.style.setProperty('--y', (y - cr.top).toFixed(2))

    // 色相跟随全局鼠标位置，卡片与 glow 都需要
    const xp = (x / window.innerWidth).toFixed(2)
    const yp = (y / window.innerHeight).toFixed(2)
    glow.style.setProperty('--xp', xp)
    glow.style.setProperty('--yp', yp)
    card.style.setProperty('--xp', xp)
    card.style.setProperty('--yp', yp)
  }, [])

  // 光效更新通过 requestAnimationFrame 节流，避免 mousemove 高频事件直接触发样式重绘
  const flushSpotlight = useCallback(() => {
    spotlightRafRef.current = null
    if (!spotlightPendingRef.current) return
    spotlightPendingRef.current = false
    updateSpotlight(hoveredIndex)
  }, [hoveredIndex, updateSpotlight])

  const scheduleSpotlightUpdate = useCallback(() => {
    spotlightPendingRef.current = true
    if (!spotlightRafRef.current) {
      spotlightRafRef.current = requestAnimationFrame(flushSpotlight)
    }
  }, [flushSpotlight])

  // section 级鼠标命中：
  // - 顶牌（rect.top 最小）的整个矩形区域可交互；
  // - 被压住的卡片只在露出的条带（自身 top 到下一张卡片 top）可交互，避免被顶牌“盖住”后点不到。
  // 必须同时判断 x 与 y，否则鼠标水平移出卡片后仍会误判为命中。
  const handleSectionMouseMove = useCallback((e: MouseEvent) => {
    const { clientX: x, clientY: y } = e
    lastMousePos.current = { x, y }
    // 拖拽进行中：跳过 hover/光效重算，避免与拖拽抢占重绘造成抖动
    if (dragCtrl.current.activeDragIndex >= 0) return
    const rects = wrapperRefs.current.map((el) => el?.getBoundingClientRect())

    const inRect = (rect: DOMRect) =>
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom

    // 找顶牌：rect.top 最小的卡片
    let frontIdx = -1
    let frontTop = Infinity
    rects.forEach((rect, i) => {
      if (!rect) return
      if (rect.top < frontTop) {
        frontTop = rect.top
        frontIdx = i
      }
    })

    let next: number | null = null

    // 优先检查被压住卡片的露出条带（从顶牌后面一张开始往下）
    for (let i = frontIdx + 1; i < rects.length; i++) {
      const rect = rects[i]
      if (!rect) continue
      const nextRect = rects[i + 1]
      const top = rect.top
      const bottom = nextRect ? nextRect.top : rect.bottom
      const strip: DOMRect = new DOMRect(rect.left, top, rect.width, bottom - top)
      if (x >= strip.left && x <= strip.right && y >= strip.top && y <= strip.bottom) {
        next = i
        break
      }
    }

    // 没命中条带，再判断是否在顶牌区域内
    if (next == null && frontIdx >= 0) {
      const rect = rects[frontIdx]
      if (rect && inRect(rect)) {
        next = frontIdx
      }
    }

    // 兜底：往上再检查一次（非堆叠状态用）
    if (next == null) {
      for (let i = frontIdx - 1; i >= 0; i--) {
        const rect = rects[i]
        if (rect && inRect(rect)) {
          next = i
          break
        }
      }
    }

    setHoveredIndex(next)
    scheduleSpotlightUpdate()
  }, [scheduleSpotlightUpdate])

  const handleSectionMouseLeave = useCallback(() => {
    setHoveredIndex(null)
    spotlightPendingRef.current = false
    if (spotlightRafRef.current) {
      cancelAnimationFrame(spotlightRafRef.current)
      spotlightRafRef.current = null
    }
  }, [])

  // 使用原生事件监听 section 级 mousemove/mouseleave：
  // React 合成事件在 headless/某些浏览器环境下可能不被触发，原生事件更可靠。
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    section.addEventListener('mousemove', handleSectionMouseMove)
    section.addEventListener('mouseleave', handleSectionMouseLeave)
    return () => {
      section.removeEventListener('mousemove', handleSectionMouseMove)
      section.removeEventListener('mouseleave', handleSectionMouseLeave)
      if (spotlightRafRef.current) {
        cancelAnimationFrame(spotlightRafRef.current)
        spotlightRafRef.current = null
      }
    }
  }, [handleSectionMouseMove, handleSectionMouseLeave])

  // 根据坐标找出当前位置最应该被拖拽的卡片
  const getFrontmostCardAt = useCallback((x: number, y: number) => {
    const rects = wrapperRefs.current.map((el) => el?.getBoundingClientRect())

    // 找顶牌：rect.top 最小的卡片
    let frontIdx = -1
    let frontTop = Infinity
    rects.forEach((rect, i) => {
      if (!rect) return
      if (rect.top < frontTop) {
        frontTop = rect.top
        frontIdx = i
      }
    })

    // 优先检查被压住卡片的露出条带
    for (let i = frontIdx + 1; i < rects.length; i++) {
      const rect = rects[i]
      if (!rect) continue
      const nextRect = rects[i + 1]
      const top = rect.top
      const bottom = nextRect ? nextRect.top : rect.bottom
      if (x >= rect.left && x <= rect.right && y >= top && y <= bottom) {
        return i
      }
    }

    // 再判断是否在顶牌区域内
    if (frontIdx >= 0) {
      const rect = rects[frontIdx]
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return frontIdx
      }
    }

    // 兜底
    for (let i = frontIdx - 1; i >= 0; i--) {
      const rect = rects[i]
      if (rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return i
      }
    }

    return -1
  }, [])

  const beginDrag = (index: number) => {
    const c = dragCtrl.current
    c.activeDragIndex = index
    c.baseX = cardDragRefs.current[index]?.x ?? 0
    c.baseY = cardDragRefs.current[index]?.y ?? 0
    const card = wrapperRefs.current[index]?.querySelector('.spotlight-card') as HTMLElement | null
    if (card) {
      const rect = card.getBoundingClientRect()
      c.initLeft = rect.left
      c.initTop = rect.top
      c.cardWidth = rect.width
      c.cardHeight = rect.height
      card.style.transition = 'none'
    }
    setActiveDragIndex(index)
  }

  const finishDrag = () => {
    const c = dragCtrl.current
    if (c.longPressTimer) {
      window.clearTimeout(c.longPressTimer)
      c.longPressTimer = null
    }
    if (c.activeDragIndex >= 0) {
      const card = wrapperRefs.current[c.activeDragIndex]?.querySelector('.spotlight-card') as HTMLElement | null
      if (card) card.style.transition = ''
    }
    c.pending = false
    c.activeDragIndex = -1
    setActiveDragIndex(null)
    c.didDrag = false
    if (c.pointerId >= 0) {
      try {
        containerRef.current?.releasePointerCapture(c.pointerId)
      } catch {
        /* noop */
      }
    }
    c.pointerId = -1
  }

  // 容器级长按拖拽：绿色框范围内任意非交互区域长按均可拖动最前卡片
  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return

    const target = e.target as HTMLElement | null
    const isInteractive =
      !!target &&
      (target.closest('button, a, input, textarea, select, [role="button"]') != null ||
        target.isContentEditable)

    if (isInteractive) return

    const index = getFrontmostCardAt(e.clientX, e.clientY)
    if (index < 0) return

    const c = dragCtrl.current
    c.pending = true
    c.didDrag = false
    c.startX = e.clientX
    c.startY = e.clientY
    c.pointerId = e.pointerId
    c.longPressTimer = window.setTimeout(() => {
      if (c.pending) {
        c.pending = false
        beginDrag(index)
      }
    }, LONG_PRESS_MS)

    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* noop */
    }
  }

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const c = dragCtrl.current
    lastMousePos.current = { x: e.clientX, y: e.clientY }

    if (!c.pending && c.activeDragIndex < 0) return

    // 长按触发前若已移动，则视为普通滑动/点击意图，取消拖拽
    if (c.activeDragIndex < 0) {
      if (Math.hypot(e.clientX - c.startX, e.clientY - c.startY) > MOVE_THRESHOLD) {
        c.pending = false
        if (c.longPressTimer) {
          window.clearTimeout(c.longPressTimer)
          c.longPressTimer = null
        }
      }
      return
    }

    const idx = c.activeDragIndex
    const dx = e.clientX - c.startX
    const dy = e.clientY - c.startY

    // 基于「开始时记录的卡片位置 + 鼠标位移增量」计算，避免实时 rect 造成的反馈抖动
    const margin = 8
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    const expectedLeft = c.initLeft + dx
    const expectedTop = c.initTop + dy
    const clampedLeft = Math.min(
      Math.max(expectedLeft, margin),
      Math.max(margin, viewportW - margin - c.cardWidth),
    )
    const clampedTop = Math.min(
      Math.max(expectedTop, margin),
      Math.max(margin, viewportH - margin - c.cardHeight),
    )

    // L0(无偏移时的原始屏幕左/上) = init - base，把屏幕位置换算回偏移量
    const nx = clampedLeft - (c.initLeft - c.baseX)
    const ny = clampedTop - (c.initTop - c.baseY)

    if (Math.hypot(e.clientX - c.startX, e.clientY - c.startY) > MOVE_THRESHOLD) {
      c.didDrag = true
    }

    cardDragRefs.current[idx] = { x: nx, y: ny }
    setCardDrags((prev) => {
      const next = [...prev]
      next[idx] = { x: nx, y: ny }
      return next
    })
  }

  const handleContainerPointerUp = () => {
    finishDrag()
  }

  const handleContainerPointerCancel = () => {
    finishDrag()
  }

  // 双击卡片（或卡片堆叠区域）将其复位到原始位置
  const handleContainerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null
    const isInteractive =
      !!target &&
      (target.closest('button, a, input, textarea, select, [role="button"]') != null ||
        target.isContentEditable)
    if (isInteractive) return

    const idx = getFrontmostCardAt(e.clientX, e.clientY)
    if (idx < 0) return

    const current = cardDragRefs.current[idx]
    if (!current || (current.x === 0 && current.y === 0)) return

    const card = wrapperRefs.current[idx]?.querySelector('.spotlight-card') as HTMLElement | null
    if (card) {
      card.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)'
      window.setTimeout(() => {
        card.style.transition = ''
      }, 350)
    }

    cardDragRefs.current[idx] = { x: 0, y: 0 }
    setCardDrags((prev) => {
      const next = [...prev]
      next[idx] = { x: 0, y: 0 }
      return next
    })
  }

  // 一键复位：右下角刷新按钮，恢复所有被拖动的卡片
  const resetAllCards = () => {
    const reset = cardDragRefs.current.map((offset, idx) => {
      const hasOffset = offset && (offset.x !== 0 || offset.y !== 0)
      if (hasOffset) {
        const card = wrapperRefs.current[idx]?.querySelector('.spotlight-card') as HTMLElement | null
        if (card) {
          card.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
          window.setTimeout(() => {
            card.style.transition = ''
          }, 400)
        }
      }
      return { x: 0, y: 0 }
    })
    cardDragRefs.current = reset
    setCardDrags(reset)
  }

  const hasAnyDragged = cardDrags.some((d) => d && (d.x !== 0 || d.y !== 0))

  // 若本次发生过拖拽，抑制紧随其后的点击事件（避免误触发打开弹窗）
  const handleContainerClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragCtrl.current.didDrag) {
      e.preventDefault()
      e.stopPropagation()
    }
    dragCtrl.current.didDrag = false
  }

  const activeLabel = tabs[activeTab] ?? ''
  const showAll = activeTab === 0 || activeLabel === '全部'

  // 分类标签顺序（跳过"全部"本身），用于「全部」视图下的分组排序
  const categoryOrder = tabs.filter((t) => t && t.trim() !== '全部')

  // 判断单个项目是否属于某个分类（新数据用 tags，旧数据用 category 兜底）
  const matchCategory = (p: ProjectItem, cat: string) => {
    const itemTags = Array.isArray(p.tags) ? p.tags : []
    if (itemTags.length > 0) {
      return itemTags.some((t) => t.trim() === cat)
    }
    return (p.category || '').trim() === cat
  }

  // 「全部」视图：按选项栏分类顺序分组排列，未匹配任何分类的项目放最后
  const groupedItems = (() => {
    const seen = new Set<string>()
    const result: ProjectItem[] = []
    for (const cat of categoryOrder) {
      for (const p of projects.items) {
        if (!seen.has(p.number) && matchCategory(p, cat)) {
          seen.add(p.number)
          result.push(p)
        }
      }
    }
    // 未匹配的分类项目放末尾
    for (const p of projects.items) {
      if (!seen.has(p.number)) {
        seen.add(p.number)
        result.push(p)
      }
    }
    return result
  })()

  // 过滤：「全部」展示所有（按分类分组排序）；其他标签展示 tags 中包含该标签的项目
  const filteredItems = showAll
    ? groupedItems
    : projects.items.filter((p) => matchCategory(p, activeLabel.trim()))

  return (
    <section
      id="projects"
      ref={sectionRef}
      className="bg-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 z-10 relative px-5 sm:px-8 md:px-10 pb-20 sm:pb-24 md:pb-32"
    >
      <h2
        className="hero-heading font-black uppercase text-center leading-none tracking-tight pt-16 sm:pt-20 md:pt-24 mb-14 sm:mb-20 md:mb-24"
        style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
      >
        {projects.title}
      </h2>
      {tabs.length > 0 && (
        <div
          role="tablist"
          aria-label="项目分类"
          className="max-w-5xl mx-auto mb-24 sm:mb-32 md:mb-40 flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-10 md:gap-x-14 gap-y-4"
        >
          {tabs.map((label, i) => {
            const active = i === activeTab
            return (
              <button
                key={`${label}-${i}`}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(i)}
                className="relative text-base sm:text-lg md:text-xl font-medium tracking-wider py-1.5 px-1 outline-none"
              >
                <motion.span
                  className="inline-block"
                  animate={{
                    scale: active ? 1.12 : 1,
                    color: active
                      ? 'rgb(215, 226, 234)'
                      : 'rgba(215, 226, 234, 0.55)',
                  }}
                  whileHover={{
                    scale: active ? 1.12 : 1.06,
                    color: active
                      ? 'rgb(215, 226, 234)'
                      : 'rgba(215, 226, 234, 0.85)',
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 18,
                    mass: 0.6,
                  }}
                >
                  {label}
                </motion.span>
                {active && (
                  <motion.span
                    layoutId="projects-tab-underline"
                    className="absolute left-0 right-0 -bottom-1.5 h-[2px] rounded-full bg-[#D7E2EA]"
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 22,
                      mass: 0.7,
                    }}
                    aria-hidden="true"
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
      <div
        ref={containerRef}
        className="max-w-5xl mx-auto relative"
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handleContainerPointerMove}
        onPointerUp={handleContainerPointerUp}
        onPointerCancel={handleContainerPointerCancel}
        onDoubleClick={handleContainerDoubleClick}
        onClickCapture={handleContainerClickCapture}
      >
        {filteredItems.length > 0 ? (
          filteredItems.map((project, i) => (
            <ProjectCard
              key={project.number}
              project={project}
              index={i}
              onOpen={setActiveProject}
              isActive={hoveredIndex === i}
              dragOffset={cardDrags[i] ?? { x: 0, y: 0 }}
              isDragging={activeDragIndex === i}
              ref={(el) => {
                wrapperRefs.current[i] = el
              }}
            />
          ))
        ) : (
          <div className="text-center py-16 text-[#D7E2EA]/40 text-sm">
            该分类下暂无项目
          </div>
        )}
      </div>

      {/* 右下角按钮：上「刷新复位」下「返回顶部」 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* 刷新复位按钮：仅在有卡片被拖动时显示 */}
        <motion.button
          type="button"
          aria-label="恢复卡片位置"
          title="恢复卡片位置"
          onClick={resetAllCards}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: hasAnyDragged ? 1 : 0,
            scale: hasAnyDragged ? 1 : 0.8,
            pointerEvents: hasAnyDragged ? 'auto' : 'none',
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white/95 text-[#0a0a0a] shadow-xl shadow-black/50 backdrop-blur-md border border-white/30 cursor-pointer"
        >
          <RefreshCw className="w-6 h-6" />
        </motion.button>

        {/* 返回顶部按钮：滚动离开顶部后显示 */}
        <motion.button
          type="button"
          aria-label="返回顶部"
          title="返回顶部"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: showBackToTop ? 1 : 0,
            scale: showBackToTop ? 1 : 0.8,
            pointerEvents: showBackToTop ? 'auto' : 'none',
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[#1a1a1a]/95 text-white shadow-xl shadow-black/50 backdrop-blur-md border border-white/35 cursor-pointer"
        >
          <ArrowUp className="w-6 h-6" />
        </motion.button>
      </div>

      <AnimatePresence>
        {activeProject && (
          <ProjectModal
            key={activeProject.number}
            project={activeProject}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>
    </section>
  )
}

export default ProjectsSection
