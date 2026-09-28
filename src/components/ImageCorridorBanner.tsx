import { useEffect, useMemo, useRef, useState } from 'react'
import type { HeroContent } from '../content/siteContent'
import { SmartImage } from './SmartImage'

/**
 * 图片走廊 Banner（参考 web-image-motion 的 corridor 效果）
 *
 * 视觉流程：中心先裂开一道开口 → 图片成对从开口涌出 → 沿透视向两侧流动展开，
 * 越靠外越大、越转向侧面，形成一条无限循环的图片长廊。
 *
 * 实现要点（沿用参考站参数）：
 * - 每对卡片由 streamAge 推导 slot，slot 决定位移 / 缩放 / 旋转，插值使用单调三次 Hermite。
 * - streamAge 对 pair 数量取模实现无缝循环。
 * - 每帧只写 CSS 变量（--x/--scale/--rotate/--birth）与 opacity/zIndex，避免 React 重渲染。
 */

// ---- 运动参数 ----
// 说明：缩放曲线被刻意「压平」（原参考站为 0.1 → 1.35，相差 13 倍），
// 让中心与两侧卡片尺寸尽量接近、整体观感统一；旋转也同步收敛，避免透视过度。
const SLOT_TRAVEL = [0, 0.06, 0.145, 0.255, 0.375, 0.485, 0.585]
const SLOT_SCALE_RATIO = [0.5, 0.58, 0.66, 0.76, 0.86, 0.95, 1.02]
const SLOT_ROTATION = [10, 13, 17, 21, 25, 29, 33]
/** 最外侧卡片宽度 ≈ OUTER_SCALE_RATIO × 视口宽度（卡片跟随图片真实比例，故以宽度为基准约束） */
const OUTER_SCALE_RATIO = 0.333
const TRACK_SPACING = 0.9
const BIRTH_GROWTH_SLOTS = 1
const PRE_PUSH_START_SLOT = 0.55
const PRE_PUSH_END_SLOT = 1.85
const BAR_START = 180
const BAR_END = 900
const IMAGE_REVEAL_PROGRESS = 0.8
const IMAGE_START =
  BAR_START + (BAR_END - BAR_START) * (1 - Math.cbrt(1 - IMAGE_REVEAL_PROGRESS))
const FILL_DURATION = 1000
const FILLED_STREAM_POSITION = 6
const STEADY_SPEED = 1.25 * (2 / 3)
const INITIAL_SPEED =
  (2 * FILLED_STREAM_POSITION) / (FILL_DURATION / 1000) - STEADY_SPEED
const DECELERATION = (STEADY_SPEED - INITIAL_SPEED) / (FILL_DURATION / 1000)
const MAX_VISIBLE_SLOT = 5.25

/** 中心开口（＝中心最小卡片）尺寸：按视口高度给出，保证与卡片尺寸联动 */
const APERTURE_HEIGHT_VH = 26
const APERTURE_WIDTH_VH = APERTURE_HEIGHT_VH * 0.75

const FALLBACK_COLORS = [
  '#ef5d45',
  '#5977d9',
  '#f2c84b',
  '#f08bae',
  '#8b55b5',
  '#f06d35',
  '#57ad82',
]

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
      // 页面切到后台时跳过样式更新，避免无谓绘制
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
      const outerScale = (window.innerWidth * OUTER_SCALE_RATIO) / baseCardWidth
      const apertureHeight = apertureRef.current?.offsetHeight || 80
      const centerScaleRatio = apertureHeight / (logicalCardHeight * outerScale)
      const scaleRatios = [centerScaleRatio, ...SLOT_SCALE_RATIO.slice(1)]
      const prePushDistance = baseCardWidth * centerScaleRatio * outerScale

      const streamPosition = getStreamPosition(elapsed)
      const imagesStarted = elapsed >= IMAGE_START
      const barProgress = easeOut((elapsed - BAR_START) / (BAR_END - BAR_START))

      const aperture = apertureRef.current
      if (aperture) {
        aperture.style.setProperty('--open', barProgress.toFixed(4))
        aperture.style.opacity = '1'
      }

      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const rawStreamAge = streamPosition - pairIndex
        const streamAge =
          rawStreamAge >= 0 ? rawStreamAge % pairCount : rawStreamAge

        const prePushProgress = easeIntoLinearMotion(
          (streamAge - PRE_PUSH_START_SLOT) /
            (PRE_PUSH_END_SLOT - PRE_PUSH_START_SLOT),
        )
        const birthProgress = easeInOut(streamAge / BIRTH_GROWTH_SLOTS)
        const slot = Math.max(streamAge - PRE_PUSH_END_SLOT, 0)
        const birthScale = 0.2 + birthProgress * 0.8
        const scale = interpolateSlot(scaleRatios, slot) * outerScale
        const rotationSlot =
          clamp(slot / MAX_VISIBLE_SLOT) * (SLOT_ROTATION.length - 1)
        const rotation = interpolateSlot(SLOT_ROTATION, rotationSlot)
        const x =
          prePushDistance * prePushProgress +
          interpolateSlot(SLOT_TRAVEL, slot) * width * TRACK_SPACING
        const visible =
          imagesStarted && streamAge >= 0 && slot <= MAX_VISIBLE_SLOT ? 1 : 0

        for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
          const card = cardRefs.current[pairIndex * 2 + sideIndex]
          if (!card) continue
          const direction = sideIndex === 0 ? -1 : 1
          card.style.setProperty('--x', `${direction * x}px`)
          card.style.setProperty('--scale', scale.toFixed(4))
          card.style.setProperty('--rotate', `${direction * -rotation}deg`)
          card.style.setProperty('--birth', birthScale.toFixed(4))
          card.style.opacity = visible.toFixed(4)
          card.style.zIndex = String(20 + Math.round(clamp(slot, 0, 8) * 10))
        }
      }

      frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => {
      running = false
      cancelAnimationFrame(frame)
    }
  }, [pairCount])

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

      {/* ── 图片走廊 ── */}
      <div
        ref={corridorRef}
        className="absolute left-0 w-full z-10 pointer-events-none top-[42%] md:top-[46%] h-[56%]"
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
              width: `${APERTURE_WIDTH_VH}vh`,
              height: `${APERTURE_HEIGHT_VH}vh`,
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
                      if (el) el.style.aspectRatio = `${w} / ${h}`
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
