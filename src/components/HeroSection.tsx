import { useContent } from '../context/ContentContext'
import { SmartImage } from './SmartImage'
import { useEffect, useRef, useState } from 'react'
import VaporizeTextCycle, { Tag } from './VaporizeTextCycle'

const TRAIL_EMOJIS = ['🔥', '✨', '⚡', '💫', '🌟', '💡', '🎨', '🚀', '🌈', '💥', '🪐', '⭐']

type Sprite = {
  el: HTMLDivElement
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  life: number
}

const TrailEmojis = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const sprites = useRef<Sprite[]>([])
  const lastSpawn = useRef({ x: 0, y: 0, t: 0 })
  const raf = useRef<number>()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 性能优化：降低生成频率、缩短存活时间，减少 DOM 节点堆积
    const SPAWN_DIST = 36
    const SPAWN_INTERVAL = 60

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const inside = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height
      if (!inside) return

      const t = performance.now()
      const dist = Math.hypot(x - lastSpawn.current.x, y - lastSpawn.current.y)
      if (dist > SPAWN_DIST && t - lastSpawn.current.t > SPAWN_INTERVAL) {
        lastSpawn.current = { x, y, t }
        const el = document.createElement('div')
        el.textContent = TRAIL_EMOJIS[(Math.random() * TRAIL_EMOJIS.length) | 0]
        el.className = 'pointer-events-none absolute left-0 top-0 text-lg sm:text-xl select-none'
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
        el.style.willChange = 'transform, opacity'
        container.appendChild(el)
        sprites.current.push({
          el,
          x,
          y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -0.3 - Math.random() * 0.5,
          rot: (Math.random() - 0.5) * 45,
          vr: (Math.random() - 0.5) * 5,
          life: 1,
        })
      }
    }

    const tick = () => {
      const arr = sprites.current
      for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i]
        s.x += s.vx
        s.y += s.vy
        s.rot += s.vr
        // 加快消失速度：约 0.7s 消完，减少 DOM 长时间堆积
        s.life -= 0.038
        if (s.life <= 0) {
          s.el.remove()
          arr.splice(i, 1)
          continue
        }
        const scale = 0.4 + s.life * 0.8
        s.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${scale}) rotate(${s.rot}deg)`
        s.el.style.opacity = String(Math.max(0, s.life))
      }
      raf.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove)
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf.current) cancelAnimationFrame(raf.current)
      sprites.current.forEach((s) => s.el.remove())
      sprites.current = []
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-30 overflow-hidden"
      aria-hidden="true"
    />
  )
}

const DiffuseBackground = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-[#0C0C0C]" aria-hidden="true" />
  )
}

const BannerMedia = ({ hero }: { hero: import('../content/siteContent').HeroContent }) => {
  if (!hero.bannerVideo && !hero.bannerImage) return null

  return hero.bannerVideo ? <BannerVideo src={hero.bannerVideo} fallback={hero.bannerImage} /> : (
    <SmartImage
      src={hero.bannerImage}
      alt="Banner Background"
      className="absolute inset-0 w-full h-full object-cover"
    />
  )
}

const BannerVideo = ({ src, fallback }: { src: string; fallback?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const isM3U8 = src.endsWith('.m3u8') || src.includes('.m3u8')
    let destroyed = false
    let cleanup: (() => void) | undefined

    // 首屏先显示 poster（静态海报），等浏览器空闲再加载视频，
    // 避免 8~9MB 的背景视频阻塞首屏渲染与交互。
    const start = () => {
      if (destroyed || videoRef.current !== video) return

      if (isM3U8 && !video.canPlayType('application/vnd.apple.mpegurl')) {
        // Lazy load hls.js only when needed (M3U8 on non-Safari browsers)
        import('hls.js').then((HlsModule) => {
          if (destroyed) return
          const Hls = HlsModule.default
          if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(src)
            hls.attachMedia(video)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().catch(() => {})
            })
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                console.error('HLS fatal error:', data)
                setFailed(true)
              }
            })
          }
        }).catch(() => {
          setFailed(true)
        })
        return
      }

      // Native HLS (Safari) or non-M3U8 video
      video.src = src
      video.play().catch(() => {})

      // GitHub Pages/Fastly 对 <video> 的 range 请求支持不稳定，
      // 常出现请求发出但长时间 readyState=0 的情况（fetch 同一 URL 却正常）。
      // 兜底：3 秒后若仍无数据，用 fetch 拉完整 blob 走 objectURL 播放。
      let blobUrl: string | undefined
      const fallbackTimer = window.setTimeout(async () => {
        if (destroyed || video.readyState >= 2 || !video.src) return
        try {
          const res = await fetch(src, { cache: 'no-store' })
          if (!res.ok) return
          const blob = await res.blob()
          blobUrl = URL.createObjectURL(blob)
          if (destroyed) {
            URL.revokeObjectURL(blobUrl)
            return
          }
          video.src = blobUrl
          video.play().catch(() => {})
        } catch (e) {
          console.error('Video blob fallback failed:', e)
        }
      }, 3000)

      const onError = () => {
        console.error('Video failed to load:', src)
        setFailed(true)
      }
      video.addEventListener('error', onError)
      cleanup = () => {
        video.removeEventListener('error', onError)
        window.clearTimeout(fallbackTimer)
        if (blobUrl) URL.revokeObjectURL(blobUrl)
      }
    }

    let idleId: number
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(start, { timeout: 2000 })
    } else {
      idleId = window.setTimeout(start, 400)
    }

    return () => {
      destroyed = true
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      } else {
        window.clearTimeout(idleId)
      }
      cleanup?.()
    }
  }, [src])

  // If video fails to load and we have a fallback image, show it instead
  if (failed && fallback) {
    return <SmartImage src={fallback} alt="Banner Background" className="absolute inset-0 w-full h-full object-cover" />
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={fallback || undefined}
      className="absolute inset-0 w-full h-full object-cover"
      style={{ backgroundColor: 'black' }}
    />
  )
}

const HeroSection = () => {
  const { content } = useContent()
  const { hero } = content

  // 字号直接使用后台设置的值，与后台预览保持一致
  const bannerFontSize = parseInt(hero.bannerTextSize) || 18
  const titleFontPx = Math.max(32, bannerFontSize)

  const hasBanner = !!(hero.bannerVideo || hero.bannerImage)
  const bannerFontWeight = parseInt(hero.bannerTextWeight) || 700

  const subtitleFontSize = parseInt(hero.bannerSubtitleSize) || 18
  const subtitleColor = hero.bannerSubtitleColor || '#FFFFFF'
  const subtitleLineHeight = parseFloat(hero.bannerSubtitleLineHeight) || 1.6
  const subtitleFontWeight = parseInt(hero.bannerSubtitleWeight) || 300
  const buttonColor = hero.bannerButtonColor || '#C8A575'
  const buttonTextColor = hero.bannerButtonTextColor || '#FFFFFF'
  const buttonFontSize = parseInt(hero.bannerButtonFontSize) || 14
  const buttonFontWeight = parseInt(hero.bannerButtonFontWeight) || 500
  const contentOffsetY = parseInt(hero.bannerContentOffsetY || '0')

  return (
    <section
      id="hero"
      className={`relative h-screen flex flex-col overflow-x-clip ${hasBanner ? '' : 'bg-[#0C0C0C]'}`}
    >
      {/* Diffuse aurora background (fallback when no banner media) */}
      <DiffuseBackground />

      {/* Banner Background */}
      {hasBanner && (
        <div className="absolute inset-0 z-0">
          <BannerMedia hero={hero} />
          <div className="absolute inset-0 bg-black/15" />
        </div>
      )}

      {/* Mouse-trail emojis */}
      <TrailEmojis />

      {/* Banner Content */}
      {hasBanner && hero.bannerText && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-start pt-[3%] px-6 sm:px-12 md:px-16 lg:px-20"
        >
          <div
            className="text-center flex flex-col items-center gap-6"
            style={{ width: 'fit-content', maxWidth: '100%', transform: `translateY(${contentOffsetY}px)` }}
          >
              {/* Title */}
              {hero.bannerText && (
                <div className="w-full flex items-center justify-center">
                  <VaporizeTextCycle
                    texts={[hero.bannerText]}
                    font={{
                      fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
                      fontSize: `${titleFontPx}px`,
                      fontWeight: bannerFontWeight,
                    }}
                    color={hero.bannerTextColor}
                    spread={5}
                    density={5}
                    animation={{
                      vaporizeDuration: 1.2,
                      fadeInDuration: 1.2,
                      waitDuration: 0.4,
                    }}
                    direction="left-to-right"
                    alignment={(hero.bannerTextAlign as 'left' | 'center' | 'right') || 'center'}
                    tag={Tag.H1}
                    interactive
                  />
                </div>
              )}

              {/* Subtitle */}
              {hero.bannerSubtitle && (
                <p
                  style={{
                    fontSize: `${subtitleFontSize}px`,
                    color: subtitleColor,
                    lineHeight: subtitleLineHeight,
                    fontWeight: subtitleFontWeight,
                  }}
                >
                  {hero.bannerSubtitle}
                </p>
              )}

              {/* Button */}
              {hero.bannerButtonText && (
                <a
                  href={hero.bannerButtonLink || undefined}
                  onClick={(e) => {
                    // No link set → do nothing (no scroll, no jump)
                    if (!hero.bannerButtonLink) e.preventDefault()
                  }}
                  style={{
                    backgroundColor: buttonColor,
                    color: buttonTextColor,
                    fontSize: `${buttonFontSize}px`,
                    fontWeight: buttonFontWeight,
                  }}
                  className="inline-block px-7 py-3 rounded-full text-white font-medium text-sm transition-transform hover:scale-105 cursor-pointer"
                >
                  {hero.bannerButtonText}
                </a>
              )}
            </div>
        </div>
      )}

      {/* Scroll Down Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <span className="text-white/60 text-sm font-light tracking-wider">滚动查看更多</span>
        <div className="w-9 h-14 rounded-full border-2 border-white/50 flex justify-center pt-2">
          <div className="w-1.5 h-2.5 bg-white/80 rounded-full animate-bounce-down" />
        </div>
      </div>
    </section>
  )
}

export default HeroSection
