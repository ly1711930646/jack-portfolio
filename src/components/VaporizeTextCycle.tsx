import React, { useRef, useEffect, useState, createElement, useMemo, useCallback, memo } from 'react'

export const Tag = {
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  P: 'p',
} as const

export type Tag = (typeof Tag)[keyof typeof Tag]

type VaporizeTextCycleProps = {
  texts: string[]
  font?: {
    fontFamily?: string
    fontSize?: string
    fontWeight?: number
  }
  color?: string
  spread?: number
  density?: number
  animation?: {
    vaporizeDuration?: number
    fadeInDuration?: number
    waitDuration?: number
  }
  direction?: 'left-to-right' | 'right-to-left'
  alignment?: 'left' | 'center' | 'right'
  tag?: Tag
  className?: string
  /** 为 true 时：默认显示静态文字，仅当鼠标移入文字区域才触发消散动画；移出恢复静态 */
  interactive?: boolean
}

type Particle = {
  x: number
  y: number
  originalX: number
  originalY: number
  color: string
  opacity: number
  originalAlpha: number
  velocityX: number
  velocityY: number
  angle: number
  speed: number
  shouldFadeQuickly?: boolean
}

type TextBoundaries = {
  left: number
  right: number
  width: number
}

type FireworkRocket = {
  x: number
  y: number
  targetY: number
  vx: number
  vy: number
  color: string
  trail: { x: number; y: number; alpha: number }[]
  exploded: boolean
  dead: boolean
}

type FireworkParticle = {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  decay: number
  gravity: number
}

const FIREWORK_COLORS = [
  'rgba(255, 215, 0, 1)',   // 金
  'rgba(255, 77, 77, 1)',   // 红
  'rgba(77, 255, 77, 1)',   // 绿
  'rgba(77, 255, 255, 1)',  // 青
  'rgba(255, 77, 255, 1)',  // 洋红
  'rgba(255, 255, 255, 1)', // 白
]

declare global {
  interface HTMLCanvasElement {
    textBoundaries?: TextBoundaries
  }
}

export default function VaporizeTextCycle({
  texts = ['Next.js', 'React'],
  font = {
    fontFamily: 'sans-serif',
    fontSize: '50px',
    fontWeight: 400,
  },
  color = 'rgb(255, 255, 255)',
  spread = 5,
  density = 5,
  animation = {
    vaporizeDuration: 2,
    fadeInDuration: 1,
    waitDuration: 0.5,
  },
  direction = 'left-to-right',
  alignment = 'center',
  tag = Tag.P,
  className = '',
  interactive = false,
}: VaporizeTextCycleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const isInView = useIsInView(wrapperRef as React.RefObject<HTMLElement>)
  const lastFontRef = useRef<string | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const fireworksRef = useRef<{ rockets: FireworkRocket[]; particles: FireworkParticle[] }>({
    rockets: [],
    particles: [],
  })
  const [currentTextIndex, setCurrentTextIndex] = useState(0)
  const [animationState, setAnimationState] = useState<'static' | 'vaporizing' | 'fadingIn' | 'waiting'>('static')
  const [hovered, setHovered] = useState(false)
  const vaporizeProgressRef = useRef(0)
  const fadeOpacityRef = useRef(0)
  // 交互模式下：标记「本次挂载是否已经触发过动画」，保证只触发一次
  const hasAnimatedRef = useRef(false)
  const transformedDensity = transformValue(density, [0, 10], [0.3, 1], true)

  const globalDpr = useMemo(() => {
    if (typeof window !== 'undefined') {
      return window.devicePixelRatio || 1
    }
    return 1
  }, [])

  const fontSize = parseInt(font.fontSize?.replace('px', '') || '50')

  const wrapperStyle = useMemo(
    () => ({
      display: 'inline-block',
      position: 'relative' as const,
      pointerEvents: (interactive ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
      cursor: (interactive ? 'default' : 'inherit') as React.CSSProperties['cursor'],
      zIndex: 2,
      minWidth: '1ch',
      minHeight: `${fontSize * 2}px`,
      lineHeight: 2,
    }),
    [interactive, fontSize]
  )

  // 画布独立做一个绝对定位覆盖整屏的容器，粒子可向屏幕四边扩散
  // 但本身不接收鼠标事件；hover 由 wrapper（文字大小的 inline-block）触发
  // transform 包含 CSS 变量驱动（来自 ScrollDropContent），保证与外层 wrapper 同步下落
  const canvasContainerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: 0,
      left: '50%',
      transform: 'translateX(-50%) translate3d(0, var(--scroll-drop-y, 0px), 0) rotate(var(--scroll-drop-r, 0deg))',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none' as const,
      overflow: 'visible',
      zIndex: 1,
    }),
    []
  )

  const canvasStyle = useMemo(
    () => ({
      display: 'block',
      width: '100%',
      height: '100%',
      pointerEvents: 'none' as const,
    }),
    []
  )

  const animationDurations = useMemo(
    () => ({
      VAPORIZE_DURATION: (animation.vaporizeDuration ?? 2) * 1000,
      FADE_IN_DURATION: (animation.fadeInDuration ?? 1) * 1000,
      WAIT_DURATION: (animation.waitDuration ?? 0.5) * 1000,
    }),
    [animation.vaporizeDuration, animation.fadeInDuration, animation.waitDuration]
  )

  const fontConfig = useMemo(() => {
    const fontSize = parseInt(font.fontSize?.replace('px', '') || '50')
    const VAPORIZE_SPREAD = calculateVaporizeSpread(fontSize)
    const MULTIPLIED_VAPORIZE_SPREAD = VAPORIZE_SPREAD * spread
    return {
      fontSize,
      VAPORIZE_SPREAD,
      MULTIPLIED_VAPORIZE_SPREAD,
      font: `${font.fontWeight ?? 400} ${fontSize * globalDpr}px ${font.fontFamily}`,
    }
  }, [font.fontSize, font.fontWeight, font.fontFamily, spread, globalDpr])

  const memoizedUpdateParticles = useCallback(
    (particles: Particle[], vaporizeX: number, deltaTime: number) => {
      return updateParticles(
        particles,
        vaporizeX,
        deltaTime,
        fontConfig.MULTIPLIED_VAPORIZE_SPREAD,
        animationDurations.VAPORIZE_DURATION,
        direction,
        transformedDensity
      )
    },
    [fontConfig.MULTIPLIED_VAPORIZE_SPREAD, animationDurations.VAPORIZE_DURATION, direction, transformedDensity]
  )

  const memoizedRenderParticles = useCallback(
    (ctx: CanvasRenderingContext2D, particles: Particle[]) => {
      renderParticles(ctx, particles, globalDpr)
    },
    [globalDpr]
  )

  const launchFireworks = useCallback((canvas: HTMLCanvasElement, count = 5) => {
    const rockets = fireworksRef.current.rockets
    const w = canvas.width
    const h = canvas.height
    for (let i = 0; i < count; i++) {
      const targetX = w * (0.2 + Math.random() * 0.6)
      const targetY = h * (0.15 + Math.random() * 0.3)
      const startX = w * (0.1 + Math.random() * 0.8)
      const startY = h
      const duration = 60 + Math.random() * 40
      const dx = targetX - startX
      const dy = targetY - startY
      rockets.push({
        x: startX,
        y: startY,
        targetY,
        vx: dx / duration,
        vy: dy / duration,
        color: FIREWORK_COLORS[(Math.random() * FIREWORK_COLORS.length) | 0],
        trail: [],
        exploded: false,
        dead: false,
      })
    }
  }, [])

  const explodeFirework = useCallback((x: number, y: number, color: string) => {
    const particles = fireworksRef.current.particles
    const count = 30 + ((Math.random() * 20) | 0)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = Math.random() * 4 + 1
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        decay: 0.01 + Math.random() * 0.015,
        gravity: 0.08,
      })
    }
  }, [])

  const updateFireworks = useCallback(() => {
    const rockets = fireworksRef.current.rockets
      const particles = fireworksRef.current.particles

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        if (r.dead) continue

        r.trail.push({ x: r.x, y: r.y, alpha: 1 })
        if (r.trail.length > 10) r.trail.shift()
        r.trail.forEach((t) => {
          t.alpha -= 0.12
        })

        r.x += r.vx
        r.y += r.vy
        r.vy += 0.06

        if (r.vy >= 0 || r.y <= r.targetY) {
          explodeFirework(r.x, r.y, r.color)
          r.exploded = true
          r.dead = true
        }
      }

      fireworksRef.current.rockets = rockets.filter((r) => !r.dead)

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.alpha -= p.decay
        if (p.alpha <= 0) {
          particles.splice(i, 1)
        }
      }
    },
    [explodeFirework]
  )

  const renderFireworks = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.save()
      ctx.scale(globalDpr, globalDpr)

      const rockets = fireworksRef.current.rockets
      const particles = fireworksRef.current.particles

      rockets.forEach((r) => {
        r.trail.forEach((t) => {
          if (t.alpha <= 0) return
          ctx.beginPath()
          ctx.arc(t.x / globalDpr, t.y / globalDpr, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = r.color.replace(/[\d.]+\)$/, `${t.alpha})`)
          ctx.fill()
        })
        ctx.beginPath()
        ctx.arc(r.x / globalDpr, r.y / globalDpr, 2, 0, Math.PI * 2)
        ctx.fillStyle = r.color
        ctx.fill()
      })

      particles.forEach((p) => {
        ctx.globalAlpha = Math.max(0, p.alpha)
        ctx.beginPath()
        ctx.arc(p.x / globalDpr, p.y / globalDpr, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
      })

      ctx.globalAlpha = 1
      ctx.restore()
    },
    [globalDpr]
  )

  useEffect(() => {
    if (interactive) {
      // 交互模式：
      // - 鼠标首次移入文字区域：触发一次粒子消散动画
      // - 持续 hover 不重复触发
      // - 鼠标移出：不打断正在播放的动画，让其走完
      if (hovered && !hasAnimatedRef.current) {
        hasAnimatedRef.current = true
        vaporizeProgressRef.current = 0
        fadeOpacityRef.current = 1
        resetParticles(particlesRef.current)
        setAnimationState('vaporizing')
        if (canvasRef.current) {
          launchFireworks(canvasRef.current, 5)
        }
      }
      return
    }
    if (isInView) {
      const startAnimationTimeout = setTimeout(() => {
        setAnimationState('vaporizing')
      }, 0)
      return () => clearTimeout(startAnimationTimeout)
    } else {
      setAnimationState('static')
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [interactive, hovered, isInView])

  useEffect(() => {
    if (!isInView) return

    let lastTime = performance.now()
    let frameId: number

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000
      lastTime = currentTime

      // 交互模式下不要在每帧打断动画，让首次触发后的整轮播放走完

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')

      if (!canvas || !ctx || !particlesRef.current.length) {
        frameId = requestAnimationFrame(animate)
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      switch (animationState) {
        case 'static': {
          memoizedRenderParticles(ctx, particlesRef.current)
          break
        }
        case 'vaporizing': {
          vaporizeProgressRef.current += (deltaTime * 100) / (animationDurations.VAPORIZE_DURATION / 1000)

          const textBoundaries = canvas.textBoundaries
          if (!textBoundaries) break

          const progress = Math.min(100, vaporizeProgressRef.current)
          const vaporizeX =
            direction === 'left-to-right'
              ? textBoundaries.left + (textBoundaries.width * progress) / 100
              : textBoundaries.right - (textBoundaries.width * progress) / 100

          const allVaporized = memoizedUpdateParticles(particlesRef.current, vaporizeX, deltaTime)
          memoizedRenderParticles(ctx, particlesRef.current)

          if (vaporizeProgressRef.current >= 100 && allVaporized) {
            setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length)
            setAnimationState('fadingIn')
            fadeOpacityRef.current = 0
          }
          break
        }
        case 'fadingIn': {
          fadeOpacityRef.current += (deltaTime * 1000) / animationDurations.FADE_IN_DURATION

          ctx.save()
          ctx.scale(globalDpr, globalDpr)
          particlesRef.current.forEach((particle) => {
            particle.x = particle.originalX
            particle.y = particle.originalY
            const opacity = Math.min(fadeOpacityRef.current, 1) * particle.originalAlpha
            const color = particle.color.replace(/[\d.]+\)$/, `${opacity})`)
            ctx.fillStyle = color
            ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1)
          })
          ctx.restore()

          if (fadeOpacityRef.current >= 1) {
            // 交互模式（动画已触发过）：跳过 waiting，直接进 static，
            // 避免 waiting 阶段 particle.opacity 仍是 0 导致文字闪烁
            if (interactive && hasAnimatedRef.current) {
              resetParticles(particlesRef.current)
              // 重置标记，允许用户下次重新移入时再次触发
              hasAnimatedRef.current = false
              setAnimationState('static')
            } else {
              setAnimationState('waiting')
              setTimeout(() => {
                setAnimationState('vaporizing')
                vaporizeProgressRef.current = 0
                resetParticles(particlesRef.current)
              }, animationDurations.WAIT_DURATION)
            }
          }
          break
        }
        case 'waiting': {
          memoizedRenderParticles(ctx, particlesRef.current)
          break
        }
      }

      updateFireworks()
      renderFireworks(ctx)

      frameId = requestAnimationFrame(animate)
    }

    frameId = requestAnimationFrame(animate)

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [
    animationState,
    isInView,
    texts.length,
    direction,
    globalDpr,
    memoizedUpdateParticles,
    memoizedRenderParticles,
    updateFireworks,
    renderFireworks,
    animationDurations.FADE_IN_DURATION,
    animationDurations.WAIT_DURATION,
    animationDurations.VAPORIZE_DURATION,
  ])

  useEffect(() => {
    renderCanvas({
      framerProps: {
        texts,
        font,
        color,
        alignment,
      },
      canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
      particlesRef,
      globalDpr,
      currentTextIndex,
      wrapperRef,
    })

    const currentFont = font.fontFamily || 'sans-serif'
    return handleFontChange({
      currentFont,
      lastFontRef,
      canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
      particlesRef,
      fireworksRef,
      globalDpr,
      currentTextIndex,
      framerProps: {
        texts,
        font,
        color,
        alignment,
      },
      wrapperRef,
    })
  }, [texts, font, color, alignment, currentTextIndex, globalDpr, transformedDensity])

  useEffect(() => {
    const onResize = () => {
      renderCanvas({
        framerProps: { texts, font, color, alignment },
        canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
        particlesRef,
        globalDpr,
        currentTextIndex,
        wrapperRef,
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [texts, font, color, alignment, currentTextIndex, globalDpr, particlesRef])

  // 监听 wrapper 尺寸变化（字体加载完成、flex 布局稳定后），确保 canvas 文字位置与 wrapper 对齐
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const ro = new ResizeObserver(() => {
      renderCanvas({
        framerProps: { texts, font, color, alignment },
        canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
        particlesRef,
        globalDpr,
        currentTextIndex,
        wrapperRef,
      })
    })
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [texts, font, color, alignment, currentTextIndex, globalDpr])

  return (
    <>
      {/* 全屏画布容器：粒子可以扩散到屏幕四边，本身不接收鼠标事件 */}
      <div style={canvasContainerStyle}>
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>

      {/* hover 触发区：inline-block 撑起与文字同宽/同高，仅在文字位置响应鼠标 */}
      <div
        ref={wrapperRef}
        style={wrapperStyle}
        className={className}
        onMouseEnter={interactive ? () => setHovered(true) : undefined}
        onMouseLeave={interactive ? () => setHovered(false) : undefined}
      >
        {/* 透明文字占位，让 wrapper 拿到与正文完全相同的尺寸 */}
        <span
          aria-hidden="true"
          style={{
            visibility: 'hidden',
            display: 'inline-block',
            fontFamily: font.fontFamily,
            fontSize: font.fontSize,
            fontWeight: font.fontWeight,
            lineHeight: 2,
            whiteSpace: 'nowrap',
          }}
        >
          {texts[0]}
        </span>
        <SeoElement tag={tag} texts={texts} />
      </div>
    </>
  )
}

const SeoElement = memo(({ tag = Tag.P, texts }: { tag: Tag; texts: string[] }) => {
  const style = useMemo(
    () => ({
      position: 'absolute' as const,
      width: '0',
      height: '0',
      overflow: 'hidden',
      userSelect: 'none' as const,
      pointerEvents: 'none' as const,
    }),
    []
  )

  const safeTag = Object.values(Tag).includes(tag) ? tag : 'p'

  return createElement(safeTag, { style }, texts?.join(' ') ?? '')
})

const handleFontChange = ({
  currentFont,
  lastFontRef,
  canvasRef,
  particlesRef,
  fireworksRef,
  globalDpr,
  currentTextIndex,
  framerProps,
  wrapperRef,
}: {
  currentFont: string
  lastFontRef: React.MutableRefObject<string | null>
  canvasRef: React.RefObject<HTMLCanvasElement>
  particlesRef: React.MutableRefObject<Particle[]>
  fireworksRef?: React.MutableRefObject<{ rockets: FireworkRocket[]; particles: FireworkParticle[] }>
  globalDpr: number
  currentTextIndex: number
  framerProps: VaporizeTextCycleProps
  wrapperRef?: React.RefObject<HTMLDivElement | null>
}) => {
  if (currentFont !== lastFontRef.current) {
    lastFontRef.current = currentFont

    const timeoutId = setTimeout(() => {
      cleanup({ canvasRef, particlesRef, fireworksRef })
      renderCanvas({
        framerProps,
        canvasRef,
        particlesRef,
        globalDpr,
        currentTextIndex,
        wrapperRef,
      })
    }, 1000)

    return () => {
      clearTimeout(timeoutId)
      cleanup({ canvasRef, particlesRef, fireworksRef })
    }
  }

  return undefined
}

const cleanup = ({
  canvasRef,
  particlesRef,
  fireworksRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>
  particlesRef: React.MutableRefObject<Particle[]>
  fireworksRef?: React.MutableRefObject<{ rockets: FireworkRocket[]; particles: FireworkParticle[] }>
}) => {
  const canvas = canvasRef.current
  const ctx = canvas?.getContext('2d')

  if (canvas && ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  if (particlesRef.current) {
    particlesRef.current = []
  }
  if (fireworksRef?.current) {
    fireworksRef.current.rockets = []
    fireworksRef.current.particles = []
  }
}

const renderCanvas = ({
  framerProps,
  canvasRef,
  particlesRef,
  globalDpr,
  currentTextIndex,
  wrapperRef,
}: {
  framerProps: VaporizeTextCycleProps
  canvasRef: React.RefObject<HTMLCanvasElement>
  particlesRef: React.MutableRefObject<Particle[]>
  globalDpr: number
  currentTextIndex: number
  wrapperRef?: React.RefObject<HTMLDivElement | null>
}) => {
  const canvas = canvasRef.current
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fontSize = parseInt(framerProps.font?.fontSize?.replace('px', '') || '50')
  const font = `${framerProps.font?.fontWeight ?? 400} ${fontSize * globalDpr}px ${framerProps.font?.fontFamily ?? 'sans-serif'}`
  const color = parseColor(framerProps.color ?? 'rgb(153, 153, 153)')
  const currentText = framerProps.texts[currentTextIndex] || 'Next.js'
  const align = framerProps.alignment || 'center'

  // Set font (text dimensions are measured inside createParticles)
  ctx.font = font

  // 画布尺寸跟随外层 absolute 容器（已是 100vw × 100vh），未布局时用窗口尺寸兜底
  const container = canvas.parentElement
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const cssWidth = (container && container.clientWidth) || viewportWidth
  const cssHeight = (container && container.clientHeight) || viewportHeight

  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  canvas.width = Math.floor(cssWidth * globalDpr)
  canvas.height = Math.floor(cssHeight * globalDpr)

  // 文字纵向位置与 hover wrapper（控制后续 subtitle/button 布局）对齐，
  // 而非画布正中，避免 wrapper 与可见文字之间产生视觉错位
  let textYCss = cssHeight / 2
  if (wrapperRef?.current) {
    const rect = wrapperRef.current.getBoundingClientRect()
    if (rect.height > 0) {
      // wrapper 的纵向中心（视口坐标）即为文字绘制中心
      textYCss = rect.top + rect.height / 2
    }
  }
  const textY = Math.round(textYCss * globalDpr)

  let textX
  if (align === 'center') {
    // 文字居中放在整屏画布正中
    textX = canvas.width / 2
  } else if (align === 'left') {
    textX = Math.ceil(fontSize * globalDpr * 0.5)
  } else {
    textX = canvas.width - Math.ceil(fontSize * globalDpr * 0.5)
  }

  const { particles, textBoundaries } = createParticles(
    ctx,
    canvas,
    currentText,
    textX,
    textY,
    font,
    color,
    align
  )

  particlesRef.current = particles
  canvas.textBoundaries = textBoundaries
}

const createParticles = (
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  textX: number,
  textY: number,
  font: string,
  color: string,
  alignment: 'left' | 'center' | 'right'
) => {
  const particles = []

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = alignment
  ctx.textBaseline = 'middle'
  ctx.imageSmoothingQuality = 'high'
  ctx.imageSmoothingEnabled = true

  if ('fontKerning' in ctx) {
    ;(ctx as any).fontKerning = 'normal'
  }

  if ('textRendering' in ctx) {
    ;(ctx as any).textRendering = 'geometricPrecision'
  }

  const metrics = ctx.measureText(text)
  let textLeft
  const textWidth = metrics.width

  if (alignment === 'center') {
    textLeft = textX - textWidth / 2
  } else if (alignment === 'left') {
    textLeft = textX
  } else {
    textLeft = textX - textWidth
  }

  const textBoundaries = {
    left: textLeft,
    right: textLeft + textWidth,
    width: textWidth,
  }

  ctx.fillText(text, textX, textY)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  const baseDPR = 3
  const currentDPR = canvas.width / parseInt(canvas.style.width)
  const baseSampleRate = Math.max(1, Math.round(currentDPR / baseDPR))
  const sampleRate = Math.max(1, Math.round(baseSampleRate))

  for (let y = 0; y < canvas.height; y += sampleRate) {
    for (let x = 0; x < canvas.width; x += sampleRate) {
      const index = (y * canvas.width + x) * 4
      const alpha = data[index + 3]

      if (alpha > 0) {
        const originalAlpha = (alpha / 255) * (sampleRate / currentDPR)
        const particle = {
          x,
          y,
          originalX: x,
          originalY: y,
          color: `rgba(${data[index]}, ${data[index + 1]}, ${data[index + 2]}, ${originalAlpha})`,
          opacity: originalAlpha,
          originalAlpha,
          velocityX: 0,
          velocityY: 0,
          angle: 0,
          speed: 0,
        }

        particles.push(particle)
      }
    }
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  return { particles, textBoundaries }
}

const updateParticles = (
  particles: Particle[],
  vaporizeX: number,
  deltaTime: number,
  MULTIPLIED_VAPORIZE_SPREAD: number,
  VAPORIZE_DURATION: number,
  direction: string,
  density: number
) => {
  let allParticlesVaporized = true

  particles.forEach((particle) => {
    const shouldVaporize =
      direction === 'left-to-right' ? particle.originalX <= vaporizeX : particle.originalX >= vaporizeX

    if (shouldVaporize) {
      if (particle.speed === 0) {
        particle.angle = Math.random() * Math.PI * 2
        particle.speed = (Math.random() * 1 + 0.5) * MULTIPLIED_VAPORIZE_SPREAD
        particle.velocityX = Math.cos(particle.angle) * particle.speed
        particle.velocityY = Math.sin(particle.angle) * particle.speed
        particle.shouldFadeQuickly = Math.random() > density
      }

      if (particle.shouldFadeQuickly) {
        particle.opacity = Math.max(0, particle.opacity - deltaTime)
      } else {
        const dx = particle.originalX - particle.x
        const dy = particle.originalY - particle.y
        const distanceFromOrigin = Math.sqrt(dx * dx + dy * dy)
        const dampingFactor = Math.max(0.95, 1 - distanceFromOrigin / (100 * MULTIPLIED_VAPORIZE_SPREAD))

        const randomSpread = MULTIPLIED_VAPORIZE_SPREAD * 3
        const spreadX = (Math.random() - 0.5) * randomSpread
        const spreadY = (Math.random() - 0.5) * randomSpread

        particle.velocityX = (particle.velocityX + spreadX + dx * 0.002) * dampingFactor
        particle.velocityY = (particle.velocityY + spreadY + dy * 0.002) * dampingFactor

        const maxVelocity = MULTIPLIED_VAPORIZE_SPREAD * 2
        const currentVelocity = Math.sqrt(
          particle.velocityX * particle.velocityX + particle.velocityY * particle.velocityY
        )

        if (currentVelocity > maxVelocity) {
          const scale = maxVelocity / currentVelocity
          particle.velocityX *= scale
          particle.velocityY *= scale
        }

        particle.x += particle.velocityX * deltaTime * 20
        particle.y += particle.velocityY * deltaTime * 10

        const baseFadeRate = 0.25
        const durationBasedFadeRate = baseFadeRate * (2000 / VAPORIZE_DURATION)
        particle.opacity = Math.max(0, particle.opacity - deltaTime * durationBasedFadeRate)
      }

      if (particle.opacity > 0.01) {
        allParticlesVaporized = false
      }
    } else {
      allParticlesVaporized = false
    }
  })

  return allParticlesVaporized
}

const renderParticles = (ctx: CanvasRenderingContext2D, particles: Particle[], globalDpr: number) => {
  ctx.save()
  ctx.scale(globalDpr, globalDpr)

  particles.forEach((particle) => {
    if (particle.opacity > 0) {
      const color = particle.color.replace(/[\d.]+\)$/, `${particle.opacity})`)
      ctx.fillStyle = color
      ctx.fillRect(particle.x / globalDpr, particle.y / globalDpr, 1, 1)
    }
  })

  ctx.restore()
}

const resetParticles = (particles: Particle[]) => {
  particles.forEach((particle) => {
    particle.x = particle.originalX
    particle.y = particle.originalY
    particle.opacity = particle.originalAlpha
    particle.speed = 0
    particle.velocityX = 0
    particle.velocityY = 0
  })
}

const calculateVaporizeSpread = (fontSize: number) => {
  const size = typeof fontSize === 'string' ? parseInt(fontSize) : fontSize

  const points = [
    { size: 20, spread: 0.2 },
    { size: 50, spread: 0.5 },
    { size: 100, spread: 1.5 },
  ]

  if (size <= points[0].size) return points[0].spread
  if (size >= points[points.length - 1].size) return points[points.length - 1].spread

  let i = 0
  while (i < points.length - 1 && points[i + 1].size < size) i++

  const p1 = points[i]
  const p2 = points[i + 1]

  return p1.spread + ((size - p1.size) * (p2.spread - p1.spread)) / (p2.size - p1.size)
}

const parseColor = (color: string) => {
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/)
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  const hexShortMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i)

  if (rgbaMatch) {
    const [_, r, g, b, a] = rgbaMatch
    return `rgba(${r}, ${g}, ${b}, ${a})`
  } else if (rgbMatch) {
    const [_, r, g, b] = rgbMatch
    return `rgba(${r}, ${g}, ${b}, 1)`
  } else if (hexMatch) {
    const [_, r, g, b] = hexMatch
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 1)`
  } else if (hexShortMatch) {
    const [_, r, g, b] = hexShortMatch
    return `rgba(${parseInt(r + r, 16)}, ${parseInt(g + g, 16)}, ${parseInt(b + b, 16)}, 1)`
  }

  console.warn('Could not parse color:', color)
  return 'rgba(0, 0, 0, 1)'
}

function transformValue(input: number, inputRange: number[], outputRange: number[], clamp = false): number {
  const [inputMin, inputMax] = inputRange
  const [outputMin, outputMax] = outputRange

  const progress = (input - inputMin) / (inputMax - inputMin)
  let result = outputMin + progress * (outputMax - outputMin)

  if (clamp) {
    if (outputMax > outputMin) {
      result = Math.min(Math.max(result, outputMin), outputMax)
    } else {
      result = Math.min(Math.max(result, outputMax), outputMin)
    }
  }

  return result
}

function useIsInView(ref: React.RefObject<HTMLElement>) {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '50px' }
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return isInView
}
