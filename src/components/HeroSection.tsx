import { useContent } from '../context/ContentContext'
import { useEffect, useRef, useState } from 'react'
import { TextShatter } from './TextShatter'

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

    const SPAWN_DIST = 16
    const SPAWN_INTERVAL = 26

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
        // Stay at spawn point, drift gently like a spark/particle fading out
        s.x += s.vx
        s.y += s.vy
        s.rot += s.vr
        s.life -= 0.014
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
    <img
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
      return () => { destroyed = true }
    }

    // Native HLS (Safari) or non-M3U8 video
    video.src = src
    video.play().catch(() => {})

    const onError = () => {
      console.error('Video failed to load:', src)
      setFailed(true)
    }
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('error', onError)
      destroyed = true
    }
  }, [src])

  // If video fails to load and we have a fallback image, show it instead
  if (failed && fallback) {
    return <img src={fallback} alt="Banner Background" className="absolute inset-0 w-full h-full object-cover" />
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      className="absolute inset-0 w-full h-full object-cover"
      style={{ backgroundColor: 'black' }}
    />
  )
}

const HeroSection = () => {
  const { content } = useContent()
  const { hero } = content

  const hasBanner = !!(hero.bannerVideo || hero.bannerImage)
  const bannerFontSize = parseInt(hero.bannerTextSize) || 18
  const bannerLineHeight = parseFloat(hero.bannerTextLineHeight) || 1.2
  const bannerFontWeight = parseInt(hero.bannerTextWeight) || 700

  const subtitleFontSize = parseInt(hero.bannerSubtitleSize) || 18
  const subtitleColor = hero.bannerSubtitleColor || '#FFFFFF'
  const subtitleLineHeight = parseFloat(hero.bannerSubtitleLineHeight) || 1.6
  const subtitleFontWeight = parseInt(hero.bannerSubtitleWeight) || 300
  const buttonColor = hero.bannerButtonColor || '#C8A575'
  const buttonTextColor = hero.bannerButtonTextColor || '#FFFFFF'
  const buttonFontSize = parseInt(hero.bannerButtonFontSize) || 14
  const buttonFontWeight = parseInt(hero.bannerButtonFontWeight) || 500

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
          className={`absolute inset-0 z-10 flex items-center justify-center px-6 sm:px-12 md:px-16 lg:px-20`}
        >
          <div className="text-center space-y-5" style={{ width: 'fit-content', maxWidth: '100%' }}>
              {/* Title */}
              {hero.bannerText && (
                <TextShatter
                  text={hero.bannerText}
                  className="whitespace-nowrap"
                  style={{
                    fontSize: `clamp(2rem, ${bannerFontSize}px, 11vw)`,
                    color: hero.bannerTextColor,
                    lineHeight: bannerLineHeight,
                    fontWeight: bannerFontWeight,
                  }}
                />
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
                  className="inline-block mt-2 px-7 py-3 rounded-full text-white font-medium text-sm transition-transform hover:scale-105 cursor-pointer"
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
