import { useEffect, useMemo, useRef, useState } from 'react'
import type { HeroContent } from '../content/siteContent'
import { SmartImage } from './SmartImage'

/**
 * 图片走廊 Banner
 *
 * 桌面（web）端：参考用户提供的设计稿 —— 左右对称两簇卡片扇形铺开，
 *   中心留白形成开口，越靠近中心卡片越大、越靠外越小且渐隐，保持持续向两侧流动散开的动效。
 *   卡片跟随各自图片的真实比例（横向为主）。
 *
 * 移动端：维持原先的「走廊」逻辑（自中心开口不断涌出、向两侧展开）。
 *
 * 实现要点：
 * - 每帧只写 CSS 变量（--x/--scale/--rotate/--birth）与 opacity/zIndex，避免 React 重渲染。
 * - streamAge 对 pair 数量取模实现无缝循环。
 * - 单调三次 Hermite 插值（interpolateSlot）保证运动不过冲。
 */

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(Math.max(value, min), max)

const easeInOut = (value: number) => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}

const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3)

const easeIntoLinearMotion = (value: number) => {
  const t = clamp(value)
  return t * t * (2 - t)
}

/** 单调三次 Hermite 插值：保证曲线不过冲，适合做运动插值 */
function interpolateSlot(values: number[], slot: number) {
  const last = values.length - 1
  if (slot >= last) {
    const step = values[last] - values[last - 1]
    return values[last] + step * (slot - last)
  }

  const lower = Math.max(Math.floor(slot), 0)
  const upper = Math.min(lower + 1, last)
  const mix = slot - lower
  const mixSquared = mix * mix
  const mixCubed = mixSquared * mix

  const getSlope = (index: number) => {
    if (index === 0) return values[1] - values[0]
    if (index === last) return values[last] - values[last - 1]
    const before = values[index] - values[index - 1]
    const after = values[index + 1] - values[index]
    if (before === 0 || after === 0 || before * after < 0) return 0
    return (2 * before * after) / (before + after)
  }

  const lowerSlope = getSlope(lower)
  const upperSlope = getSlope(upper)
  return (
    (2 * mixCubed - 3 * mixSquared + 1) * values[lower] +
    (mixCubed - 2 * mixSquared + mix) * lowerSlope +
    (-2 * mixCubed + 3 * mixSquared) * values[upper] +
    (mixCubed - mixSquared) * upperSlope
  )
}

// ───────────────────────── 桌面（扇形）参数 ─────────────────────────
// 说明：越靠中心（slot 0）越大、旋转越大；向外渐小、渐隐。
const FAN = {
  OUTER_SCALE_RATIO: 0.22, // 最内侧卡片宽度 ≈ 0.22 × 视口宽度
  VISIBLE_SLOTS: 6.5,
  GAP_HALF_RATIO: 0.035, // 中心留白半宽 = 0.035 × 视口宽
  SPREAD_RATIO: 0.27, // 单簇铺开宽度 = 0.27 × 视口宽
  BIRTH_SLOTS: 0.35, // 卡片在开口边缘淡入生长消耗的 slot
  SCALE: [1.0, 0.98, 0.92, 0.84, 0.74, 0.63, 0.52, 0.42],
  ROTATION: [34, 31, 28, 24, 20, 16, 13, 11],
  OPACITY: [1, 1, 0.94, 0.84, 0.72, 0.55, 0.4, 0.26],
}

// ───────────────────────── 移动端（走廊）参数（沿用此前逻辑） ─────────────────────────
const CORRIDOR = {
  OUTER_SCALE_RATIO: 0.333,
  VISIBLE_SLOTS: 5.25,
  SLOT_TRAVEL: [0, 0.06, 0.145, 0.255, 0.375, 0.485, 0.585],
  SLOT_SCALE_RATIO: [0.5, 0.58, 0.66, 0.76, 0.86, 0.95, 1.02],
  SLOT_ROTATION: [10, 13, 17, 21, 25, 29, 33],
  TRACK_SPACING: 0.9,
  BIRTH_GROWTH_SLOTS: 1,
  PRE_PUSH_START_SLOT: 0.55,
  PRE_PUSH_END_SLOT: 1.85,
  APERTURE_HEIGHT_VH: 26,
  APERTURE_WIDTH_VH: 26 * 0.75,
}

const FALLBACK_COLORS = [
  '#ef5d45',
  '#5977d9',
  '#f2c84b',
  '#f08bae',
  '#8b55b5',
  '#f06d35',
  '#57ad82',
]

const IMAGE_REVEAL_PROGRESS = 0.8
const BAR_START = 180
const BAR_END = 900
const IMAGE_START =
  BAR_START + (BAR_END - BAR_START) * (1 - Math.cbrt(1 - IMAGE_REVEAL_PROGRESS))
const FILL_DURATION = 1000
const FILLED_STREAM_POSITION = 6
const STEADY_SPEED = 1.25 * (2 / 3)
const INITIAL_SPEED =
  (2 * FILLED_STREAM_POSITION) / (FILL_DURATION / 1000) - STEADY_SPEED
const DECELERATION = (STEADY_SPEED - INITIAL_SPEED) / (FILL_DURATION / 1000)

const clampSlot = (slot: number, max: number) => clamp(slot, 0, max)

/** 解析 #RRGGBB / #RGB，返回 0~1 亮度；解析失败返回 0（按深色处理） */
const luminanceOf = (color: string) => {
  const hex = (color || '').trim().replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function getStreamPosition(elapsed: number) {
  const motionElapsed = Math.max(elapsed - IMAGE_START, 0) / 1000
  const fillSeconds = FILL_DURATION / 1000
  if (motionElapsed <= fillSeconds) {
    return (
      INITIAL_SPEED * motionElapsed +
      0.5 * DECELERATION * motionElapsed * motionElapsed
    )
  }
  return FILLED_STREAM_POSITION + (motionElapsed - fillSeconds) * STEADY_SPEED
}

const ImageCorridorBanner = ({
  hero,
  images,
}: {
  hero: HeroContent
  images: string[]
}) => {
  const corridorRef = useRef<HTMLDivElement>(null)
  const apertureRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const startedAtRef = useRef(0)

  // 卡片对数：小屏减半，避免移动端 DOM 与逐帧写入过多
  const [pairCount, setPairCount] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 14 : 30,
  )

  useEffect(() => {
    const onResize = () => setPairCount(window.innerWidth < 768 ? 14 : 30)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isDesktop = pairCount > 20
  const P = isDesktop ? FAN : CORRIDOR

  // 每张卡片使用的图片 / 兜底色
  const cardSources = useMemo(() => {
    const list = images.filter(Boolean)
    const out: { src: string; color: string }[] = []
    for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
      for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
        const cardIndex = pairIndex * 2 + sideIndex
        out.push({
          src: list.length > 0 ? list[(cardIndex * 2 + 7) % list.length] : '',
          color: FALLBACK_COLORS[cardIndex % FALLBACK_COLORS.length],
        })
      }
    }
    return out
  }, [images, pairCount])

  // ---- 逐帧渲染 ----
  useEffect(() => {
    const corridor = corridorRef.current
    if (!corridor) return

    startedAtRef.current = performance.now()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let running = true

    const render = (now: number) => {
      if (!running) return
      if (document.hidden) {
        frame = requestAnimationFrame(render)
        return
      }
      const elapsed = reduceMotion
        ? BAR_END + FILL_DURATION + 900
        : now - startedAtRef.current

      const width = corridor.clientWidth
      const firstCard = cardRefs.current[0]
      const baseCardWidth = firstCard?.offsetWidth || width * 0.125
      const logicalCardHeight = baseCardWidth * 0.75
      const outerScale = (window.innerWidth * P.OUTER_SCALE_RATIO) / baseCardWidth
      const maxVisible = P.VISIBLE_SLOTS
      const streamPosition = getStreamPosition(elapsed)
      const imagesStarted = elapsed >= IMAGE_START
      const barProgress = easeOut((elapsed - BAR_START) / (BAR_END - BAR_START))

      const aperture = apertureRef.current
      if (aperture) {
        aperture.style.setProperty('--open', barProgress.toFixed(4))
        aperture.style.opacity = '1'
        if (isDesktop) {
          // 桌面：开口尺寸跟随最内侧卡片，形成干净的留白
          const innerW = baseCardWidth * outerScale * FAN.SCALE[1]
          const innerH = innerW * (firstCard?.dataset.ratio ? Number(firstCard.dataset.ratio) : 0.75)
          aperture.style.width = `${innerW * 1.5}px`
          aperture.style.height = `${innerH * 1.5}px`
        }
      }

      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const rawStreamAge = streamPosition - pairIndex
        const streamAge =
          rawStreamAge >= 0 ? rawStreamAge % pairCount : rawStreamAge

        let x: number
        let scale: number
        let rotation: number
        let birth: number
        let opacityFactor: number

        if (isDesktop) {
          const slot = streamAge
          const slotFraction = clampSlot(slot, maxVisible) / maxVisible
          birth = easeInOut(clamp(streamAge / FAN.BIRTH_SLOTS))
          const s = clampSlot(slot, FAN.SCALE.length - 1)
          scale = interpolateSlot(FAN.SCALE, s) * outerScale * (0.2 + 0.8 * birth)
          rotation = interpolateSlot(FAN.ROTATION, s)
          opacityFactor = interpolateSlot(FAN.OPACITY, s)
          // 卡片在「留白边缘」淡入生长，随后持续向两侧铺开、缩小、渐隐（保持流动动效）
          x = FAN.GAP_HALF_RATIO * width + slotFraction * FAN.SPREAD_RATIO * width
        } else {
          const prePushProgress = easeIntoLinearMotion(
            (streamAge - CORRIDOR.PRE_PUSH_START_SLOT) /
              (CORRIDOR.PRE_PUSH_END_SLOT - CORRIDOR.PRE_PUSH_START_SLOT),
          )
          const birthProgress = easeInOut(streamAge / CORRIDOR.BIRTH_GROWTH_SLOTS)
          const slot = Math.max(streamAge - CORRIDOR.PRE_PUSH_END_SLOT, 0)
          const apertureHeight = apertureRef.current?.offsetHeight || 80
          const centerScaleRatio = apertureHeight / (logicalCardHeight * outerScale)
          const scaleRatios = [centerScaleRatio, ...CORRIDOR.SLOT_SCALE_RATIO.slice(1)]
          const prePushDistance = baseCardWidth * centerScaleRatio * outerScale
          birth = 0.2 + birthProgress * 0.8
          scale = interpolateSlot(scaleRatios, slot) * outerScale
          rotation =
            interpolateSlot(
              CORRIDOR.SLOT_ROTATION,
              clamp(slot / maxVisible) * (CORRIDOR.SLOT_ROTATION.length - 1),
            )
          opacityFactor = 1
          x =
            prePushDistance * prePushProgress +
            interpolateSlot(CORRIDOR.SLOT_TRAVEL, slot) * width * CORRIDOR.TRACK_SPACING
        }

        const visible =
          imagesStarted && streamAge >= 0 && streamAge <= maxVisible ? 1 : 0

        for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
          const card = cardRefs.current[pairIndex * 2 + sideIndex]
          if (!card) continue
          const direction = sideIndex === 0 ? -1 : 1
          card.style.setProperty('--x', `${direction * x}px`)
          card.style.setProperty('--scale', scale.toFixed(4))
          card.style.setProperty('--rotate', `${direction * -rotation}deg`)
          card.style.setProperty('--birth', birth.toFixed(4))
          card.style.opacity = (visible * opacityFactor * birth).toFixed(4)
          card.style.zIndex = String(
            20 + Math.round((maxVisible - clampSlot(streamAge, maxVisible)) * 10),
          )
        }
      }

      frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [pairCount, isDesktop])

  // ---- 文案样式（沿用后台设置，移动端按比例缩小）----
  const bannerFontSize = parseInt(hero.bannerTextSize) || 18
  const titleFontPx = Math.max(32, bannerFontSize)
  const titleFontPxTablet = Math.max(28, Math.round(titleFontPx * 0.65))
  const titleFontPxMobile = Math.max(22, Math.round(titleFontPx * 0.42))
  const bannerFontWeight = parseInt(hero.bannerTextWeight) || 700

  const subtitleFontSize = parseInt(hero.bannerSubtitleSize) || 18
  const subtitleFontPxTablet = Math.max(14, Math.round(subtitleFontSize * 0.9))
  const subtitleFontPxMobile = Math.max(12, Math.round(subtitleFontSize * 0.75))
  const subtitleColor = hero.bannerSubtitleColor || '#FFFFFF'
  const subtitleLineHeight = parseFloat(hero.bannerSubtitleLineHeight) || 1.6
  const subtitleFontWeight = parseInt(hero.bannerSubtitleWeight) || 300

  const buttonColor = hero.bannerButtonColor || '#C8A575'
  const buttonTextColor = hero.bannerButtonTextColor || '#FFFFFF'
  const buttonFontSize = parseInt(hero.bannerButtonFontSize) || 14
  const buttonFontWeight = parseInt(hero.bannerButtonFontWeight) || 500
  const contentOffsetY = parseInt(hero.bannerContentOffsetY || '0')

  const corridorBg = hero.corridorBg || '#0C0C0C'
  const corridorRadius = Math.max(0, parseInt(hero.corridorRadius || '10') || 10)
  const isLightBg = luminanceOf(corridorBg) > 0.6
  const glowColor = isLightBg
    ? 'rgba(255,255,255,0.46)'
    : 'rgba(255,255,255,0.10)'

  return (
    <section
      id="hero"
      className="relative h-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: corridorBg }}
    >
      {/* 中心柔光，让开口处有呼吸感 */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-[9]"
        style={{
          width: '34vw',
          height: '22vw',
          background: glowColor,
          filter: 'blur(55px)',
        }}
      />

      {/* ── 图片走廊 / 扇形 ── */}
      <div
        ref={corridorRef}
        className="absolute left-0 w-full z-10 pointer-events-none top-[42%] md:top-[36%] h-[56%]"
        style={{
          perspective: '850px',
          perspectiveOrigin: '50% 50%',
        }}
        aria-hidden="true"
      >
        {/* 中心开口：从中间裂开，图片从这里涌出 */}
        <div
          ref={apertureRef}
          className="absolute top-1/2 left-1/2 z-[5] opacity-0"
          style={
            {
              '--open': 0,
              width: `${CORRIDOR.APERTURE_WIDTH_VH}vh`,
              height: `${CORRIDOR.APERTURE_HEIGHT_VH}vh`,
              borderRadius: `${corridorRadius}px`,
              background: corridorBg,
              transform: 'translate(-50%, -50%) scaleX(var(--open))',
              transformOrigin: 'center',
              willChange: 'transform, opacity',
            } as React.CSSProperties
          }
        />

        {cardSources.map((source, index) => {
          const sideIndex = index % 2
          return (
            <div
              key={index}
              ref={(el) => {
                cardRefs.current[index] = el
              }}
              className="absolute top-1/2 left-1/2 overflow-hidden w-[clamp(116px,36vw,240px)] sm:w-[clamp(150px,17vw,240px)] md:w-[clamp(180px,12.5vw,240px)]"
              style={
                {
                  '--x': '0px',
                  '--scale': '0.27',
                  '--rotate': '0deg',
                  '--birth': '0',
                  '--base-shift': sideIndex === 0 ? '-100%' : '0%',
                  '--origin-x': sideIndex === 0 ? '100%' : '0%',
                  aspectRatio: '4 / 3',
                  borderRadius: `${corridorRadius}px`,
                  backgroundColor: source.color,
                  opacity: 0,
                  transform:
                    'translate3d(calc(var(--base-shift) + var(--x)), -50%, 0) rotateY(var(--rotate)) scale(var(--scale)) scale(var(--birth))',
                  transformOrigin: 'var(--origin-x) 50%',
                  transformStyle: 'preserve-3d',
                  backfaceVisibility: 'hidden',
                  willChange: 'transform, opacity',
                } as React.CSSProperties
              }
              onLoadCapture={(e) => {
                const el = cardRefs.current[index]
                if (el) {
                  const ratio = el.offsetWidth / Math.max(el.offsetHeight, 1)
                  el.dataset.ratio = String(ratio)
                }
                void e
              }}
            >
              {source.src && (
                <SmartImage
                  src={source.src}
                  alt=""
                  loading="eager"
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    const img = e.currentTarget as HTMLImageElement
                    const w = img.naturalWidth
                    const h = img.naturalHeight
                    if (w && h) {
                      const el = cardRefs.current[index]
                      if (el) {
                        el.style.aspectRatio = `${w} / ${h}`
                        el.dataset.ratio = String(w / h)
                      }
                    }
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* ── 文案层 ── */}
      {(hero.bannerText || hero.bannerSubtitle) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center text-center gap-4 sm:gap-5 px-6 top-[9%] sm:top-[10%]"
          style={{
            width: 'min(920px, 92vw)',
            transform: `translate(-50%, ${contentOffsetY}px)`,
          }}
        >
          {hero.bannerText && (
            <h1
              className="w-full text-[length:var(--title-mobile)] sm:text-[length:var(--title-tablet)] md:text-[length:var(--title-desktop)]"
              style={
                {
                  fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
                  '--title-desktop': `min(${titleFontPx}px, 5.6vw)`,
                  '--title-tablet': `min(${titleFontPxTablet}px, 7.2vw)`,
                  '--title-mobile': `min(${titleFontPxMobile}px, 9.5vw)`,
                  fontWeight: bannerFontWeight,
                  color: hero.bannerTextColor,
                  textAlign: (hero.bannerTextAlign as 'left' | 'center' | 'right') || 'center',
                  lineHeight: 1.15,
                } as React.CSSProperties
              }
            >
              {hero.bannerText}
            </h1>
          )}

          {hero.bannerSubtitle && (
            <p
              className="text-[length:var(--subtitle-mobile)] sm:text-[length:var(--subtitle-tablet)] md:text-[length:var(--subtitle-desktop)]"
              style={
                {
                  '--subtitle-desktop': `min(${subtitleFontSize}px, 1.7vw)`,
                  '--subtitle-tablet': `min(${subtitleFontPxTablet}px, 2.6vw)`,
                  '--subtitle-mobile': `min(${subtitleFontPxMobile}px, 4.2vw)`,
                  color: subtitleColor,
                  lineHeight: subtitleLineHeight,
                  fontWeight: subtitleFontWeight,
                } as React.CSSProperties
              }
            >
              {hero.bannerSubtitle}
            </p>
          )}

          {hero.bannerButtonEnabled !== false && hero.bannerButtonText && (
            <a
              href={hero.bannerButtonLink || undefined}
              onClick={(e) => {
                if (!hero.bannerButtonLink) e.preventDefault()
              }}
              style={{
                backgroundColor: buttonColor,
                color: buttonTextColor,
                fontSize: `${buttonFontSize}px`,
                fontWeight: buttonFontWeight,
              }}
              className="inline-block px-7 py-3 rounded-full font-medium transition-transform hover:scale-105 cursor-pointer"
            >
              {hero.bannerButtonText}
            </a>
          )}
        </div>
      )}

      {/* 滚动提示 */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3"
        style={{ color: hero.bannerTextColor || '#FFFFFF' }}
      >
        <span className="text-sm font-light tracking-wider opacity-60">滚动查看更多</span>
        <div className="w-9 h-14 rounded-full border-2 border-current/50 flex justify-center pt-2 opacity-70">
          <div className="w-1.5 h-2.5 bg-current rounded-full animate-bounce-down" />
        </div>
      </div>
    </section>
  )
}

export default ImageCorridorBanner
