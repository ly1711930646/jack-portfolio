import { useEffect, useRef, useState } from 'react'

interface Particle {
  sx: number
  sy: number
  sw: number
  sh: number
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  rotation: number
  vr: number
  tr: number
  baseRotation: number
}

interface TextShatterProps {
  text: string
  className?: string
  style?: React.CSSProperties
  fragmentSize?: number
  scatterPower?: number
  scatterRadius?: number
}

export function TextShatter({
  text,
  className = '',
  style = {},
  fragmentSize = 18,
  scatterPower = 70,
  scatterRadius = 260,
}: TextShatterProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const hoveredRef = useRef(false)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>()
  const mouseRef = useRef({ x: 0, y: 0 })
  const dprRef = useRef(1)
  const layoutRef = useRef({ width: 0, height: 0, font: '' })
  const [isHoverable, setIsHoverable] = useState(false)

  // 客户端挂载后才判断 hover 支持
  useEffect(() => {
    setIsHoverable(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  useEffect(() => {
    if (!isHoverable) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sourceCanvas = document.createElement('canvas')
    sourceCanvasRef.current = sourceCanvas
    const sCtx = sourceCanvas.getContext('2d')
    if (!sCtx) return

    const getComputedFont = () => {
      const computed = window.getComputedStyle(container)
      const fontSize = computed.fontSize
      const fontWeight = computed.fontWeight
      const fontFamily = computed.fontFamily
      return `${fontWeight} ${fontSize} ${fontFamily}`
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      dprRef.current = dpr
      const width = Math.max(1, Math.ceil(rect.width))
      const height = Math.max(1, Math.ceil(rect.height))
      layoutRef.current = { width, height, font: getComputedFont() }

      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      sourceCanvas.width = width * dpr
      sourceCanvas.height = height * dpr

      // 绘制原始文字到 source canvas
      sCtx.save()
      sCtx.scale(dpr, dpr)
      sCtx.clearRect(0, 0, width, height)
      sCtx.font = layoutRef.current.font
      sCtx.textAlign = 'center'
      sCtx.textBaseline = 'middle'
      sCtx.fillStyle = window.getComputedStyle(container).color || '#ffffff'
      sCtx.fillText(text, width / 2, height / 2)
      sCtx.restore()

      // 构建碎片网格
      const cols = Math.ceil(width / fragmentSize)
      const rows = Math.ceil(height / fragmentSize)
      const particles: Particle[] = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const sx = c * fragmentSize
          const sy = r * fragmentSize
          const sw = Math.min(fragmentSize, width - sx)
          const sh = Math.min(fragmentSize, height - sy)
          if (sw <= 0 || sh <= 0) continue
          particles.push({
            sx,
            sy,
            sw,
            sh,
            x: sx,
            y: sy,
            tx: sx,
            ty: sy,
            vx: 0,
            vy: 0,
            rotation: 0,
            vr: 0,
            tr: 0,
            baseRotation: (Math.random() - 0.5) * 36,
          })
        }
      }
      particlesRef.current = particles

      // 初始绘制一帧
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)
      for (const p of particles) {
        ctx.drawImage(sourceCanvas, p.sx, p.sy, p.sw, p.sh, p.x, p.y, p.sw, p.sh)
      }
      ctx.restore()
    }

    resize()
    window.addEventListener('resize', resize)

    let lastTime = performance.now()

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time

      const canvasEl = canvasRef.current
      const sourceEl = sourceCanvasRef.current
      if (!canvasEl || !sourceEl) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }
      const ctx2d = canvasEl.getContext('2d')
      if (!ctx2d) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }

      const dpr = dprRef.current
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const isActive = hoveredRef.current

      ctx2d.clearRect(0, 0, canvasEl.width, canvasEl.height)
      ctx2d.save()
      ctx2d.scale(dpr, dpr)

      const particles = particlesRef.current

      // 1) 先更新每个碎片的「目标位置」(scatter)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const cx = p.sx + p.sw / 2
        const cy = p.sy + p.sh / 2
        const dx = cx - mx
        const dy = cy - my
        const dist = Math.sqrt(dx * dx + dy * dy) || 1

        if (isActive) {
          const force = Math.max(0, 1 - dist / scatterRadius)
          const angle = Math.atan2(dy, dx)
          const power = scatterPower * (0.35 + 0.65 * force)
          p.tx = p.sx + Math.cos(angle) * power
          p.ty = p.sy + Math.sin(angle) * power
          // 固定种子旋转，避免逐帧随机造成的抖动
          p.tr = p.baseRotation * (0.4 + force)
        } else {
          p.tx = p.sx
          p.ty = p.sy
          p.tr = 0
        }
      }

      // 2) 稳定的欠阻尼弹簧(子步进，保证顺滑 + 过冲回弹的弹性感)
      const stiffness = 130 // 越大回复越快
      const friction = 8    // 越小回弹过冲越明显，弹性感越强
      const sub = 2
      const h = dt / sub
      for (let s = 0; s < sub; s++) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          const ax = -stiffness * (p.x - p.tx) - friction * p.vx
          const ay = -stiffness * (p.y - p.ty) - friction * p.vy
          const ar = -stiffness * (p.rotation - p.tr) - friction * p.vr
          p.vx += ax * h
          p.vy += ay * h
          p.vr += ar * h
          p.x += p.vx * h
          p.y += p.vy * h
          p.rotation += p.vr * h
        }
      }

      // 3) 绘制
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const cx2 = p.x + p.sw / 2
        const cy2 = p.y + p.sh / 2
        ctx2d.save()
        ctx2d.translate(cx2, cy2)
        ctx2d.rotate((p.rotation * Math.PI) / 180)
        ctx2d.drawImage(
          sourceEl,
          p.sx * dpr,
          p.sy * dpr,
          p.sw * dpr,
          p.sh * dpr,
          -p.sw / 2,
          -p.sh / 2,
          p.sw,
          p.sh
        )
        ctx2d.restore()
      }

      ctx2d.restore()
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isHoverable, text, fragmentSize, scatterPower, scatterRadius])

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // 移动端/不支持 hover：直接渲染普通文字
  if (!isHoverable) {
    return (
      <h1 className={className} style={style}>
        {text}
      </h1>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block select-none ${className}`}
      style={{ ...style, cursor: 'default' }}
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
      onMouseMove={handleMouseMove}
      aria-label={text}
    >
      <span aria-hidden="true" className="invisible">
        {text}
      </span>
      <canvas ref={canvasRef} className="absolute inset-0 block" />
    </div>
  )
}
