import { useEffect, useMemo, useRef, useState } from 'react'
import type { HeroContent } from '../content/siteContent'
import { SmartImage } from './SmartImage'

/**
 * 图片走廊 Banner
 *
 * 桌面（web）端：参考用户提供的设计稿 —— 卡片排成一条自右向左流动的带子，
 *   最右侧最大、最实，越往左越小、越透明，最终淡出消失（新卡片在右侧生长出现）。
 *   卡片保持恒定的中心间距，因此层层叠压、只露出左侧一条边；跟随各自图片的真实比例。
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

// ───────────────────────── 桌面（单向流动带）参数 ─────────────────────────
// 参考设计稿：卡片排成一条自右向左流动的带子 —— 最右侧最大、最实，
// 越往左越小、越透明，最终淡出消失；新卡片在右侧「生长」出现。
// 相邻卡片中心间距恒定（< 卡片宽度），因此层层叠压、露出左侧一条边。
const FAN = {
  OUTER_SCALE_RATIO: 0.33, // 最右侧（最大）卡片宽度 ≈ 0.33 × 视口宽度
  MAX_WIDTH_VH: 0.52, // 同时受视口高度约束（宽而矮的屏幕上不至于过大压到标题）
  VISIBLE_SLOTS: 3.25, // 同屏可见卡片数 = VISIBLE_SLOTS / SLOT_STEP ≈ 6 张
  SLOT_STEP: 0.5, // 每对卡片各占半个 slot（单向流动，不再镜像）
  SPAWN_X_RATIO: 0.416, // slot 0（刚出生卡片）中心相对视口中心的位置
  TRAVEL_RATIO: 0.276, // 每个 slot 左移 = 0.276 × 视口宽（相邻卡片 0.138 × 视口宽，重叠叠压）
  BIRTH_SLOTS: 0.2, // 卡片在右侧生长并淡入所消耗的 slot
  // 缩放/透明度曲线的索引：slot 0.5（已长成的最大卡片）对应 index 0
  CURVE_SLOT_OFFSET: 0.5,
  CURVE_SLOT_STEP: 2,
  SCALE: [1, 0.74, 0.55, 0.41, 0.3, 0.22],
  ROTATION: [2, 3.5, 5, 7, 9, 11],
  OPACITY: [1, 0.86, 0.72, 0.58, 0.45, 0.33],
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

/** 首帧（还没有上一帧时间戳时）使用的参考帧间隔 */
const REFERENCE_FRAME_MS = 1000 / 60

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

/**
 * 动画时间 t（秒，自流动开始计时）累计推进的 stream 位置。
 * 先「快速涌出 + 减速」填满走廊（FILL_DURATION），之后进入匀速流动。
 * 写成积分形式后，速度倍率变化时只需缩放每帧增量，位置不会跳变。
 */
function fillIntegral(t: number) {
  if (t <= 0) return 0
  const fillSeconds = FILL_DURATION / 1000
  if (t <= fillSeconds) {
    return INITIAL_SPEED * t + 0.5 * DECELERATION * t * t
  }
  const fillArea =
    INITIAL_SPEED * fillSeconds + 0.5 * DECELERATION * fillSeconds * fillSeconds
  return fillArea + (t - fillSeconds) * STEADY_SPEED
}

/** motionElapsed：已按速度倍率缩放过的动画时间（ms，自组件挂载计时） */
function getStreamPosition(motionElapsed: number) {
  return fillIntegral(Math.max(motionElapsed - IMAGE_START, 0) / 1000)
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
  // 真实时间（ms，未按速度缩放）：驱动开场开口动画的节奏，与速度无关
  const clockRef = useRef(0)
  // 动画时间（ms，已按速度缩放）：驱动图片流动
  const motionRef = useRef(0)
  const lastFrameAtRef = useRef(0)

  // 流动速度倍率（后台可调，1 = 原始速度）。用 ref 传递，
  // 这样后台拖动滑块时速度立即生效，且不会重置动画、不会跳帧。
  const speedRef = useRef(1)

  // 卡片对数：小屏减半，避免移动端 DOM 与逐帧写入过多
  const [pairCount, setPairCount] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 14 : 30,
  )

  const corridorSpeed = clamp(parseFloat(hero.corridorSpeed || '1') || 1, 0.1, 5)
  useEffect(() => {
    speedRef.current = corridorSpeed
  }, [corridorSpeed])

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

    lastFrameAtRef.current = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let running = true

    const render = (now: number) => {
      if (!running) return
      if (document.hidden) {
        lastFrameAtRef.current = 0
        frame = requestAnimationFrame(render)
        return
      }

      if (reduceMotion) {
        // 关闭动效：直接落在「已填满」的静止状态，不随时间推进
        clockRef.current = BAR_END + FILL_DURATION + 900
        motionRef.current = clockRef.current
      } else {
        const dt = lastFrameAtRef.current
          ? Math.min(now - lastFrameAtRef.current, 64)
          : REFERENCE_FRAME_MS
        lastFrameAtRef.current = now
        clockRef.current += dt
        // 速度倍率只作用于每帧增量：后台调速度时位置连续、不跳变
        motionRef.current += dt * speedRef.current
      }

      const elapsed = clockRef.current
      const streamPosition = getStreamPosition(motionRef.current)

      const width = corridor.clientWidth
      const firstCard = cardRefs.current[0]
      const baseCardWidth = firstCard?.offsetWidth || width * 0.125
      const logicalCardHeight = baseCardWidth * 0.75
      const widthBudget = window.innerWidth * P.OUTER_SCALE_RATIO
      const maxCardWidth = isDesktop
        ? Math.min(widthBudget, window.innerHeight * FAN.MAX_WIDTH_VH)
        : widthBudget
      const outerScale = maxCardWidth / baseCardWidth
      const maxVisible = P.VISIBLE_SLOTS
      const imagesStarted = elapsed >= IMAGE_START
      const barProgress = easeOut((elapsed - BAR_START) / (BAR_END - BAR_START))

      // 中心开口只服务于移动端走廊；桌面为单向流动带，不需要开口
      const aperture = apertureRef.current
      if (aperture) {
        aperture.style.setProperty('--open', barProgress.toFixed(4))
        aperture.style.opacity = isDesktop ? '0' : '1'
      }
      const apertureHeight = aperture?.offsetHeight || 80

      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const rawStreamAge = streamPosition - pairIndex
        const streamAge =
          rawStreamAge >= 0 ? rawStreamAge % pairCount : rawStreamAge

        // 移动端（走廊）：一对卡片共用同一 slot，向左右两侧对称展开
        let pairX = 0
        let pairScale = 0
        let pairRotation = 0
        let pairBirth = 0
        let pairOpacity = 0
        let pairVisible = 0

        if (!isDesktop) {
          const prePushProgress = easeIntoLinearMotion(
            (streamAge - CORRIDOR.PRE_PUSH_START_SLOT) /
              (CORRIDOR.PRE_PUSH_END_SLOT - CORRIDOR.PRE_PUSH_START_SLOT),
          )
          const birthProgress = easeInOut(streamAge / CORRIDOR.BIRTH_GROWTH_SLOTS)
          const slot = Math.max(streamAge - CORRIDOR.PRE_PUSH_END_SLOT, 0)
          const centerScaleRatio = apertureHeight / (logicalCardHeight * outerScale)
          const scaleRatios = [centerScaleRatio, ...CORRIDOR.SLOT_SCALE_RATIO.slice(1)]
          const prePushDistance = baseCardWidth * centerScaleRatio * outerScale
          pairBirth = 0.2 + birthProgress * 0.8
          pairScale = interpolateSlot(scaleRatios, slot) * outerScale
          pairRotation = interpolateSlot(
            CORRIDOR.SLOT_ROTATION,
            clamp(slot / maxVisible) * (CORRIDOR.SLOT_ROTATION.length - 1),
          )
          pairOpacity = 1
          pairX =
            prePushDistance * prePushProgress +
            interpolateSlot(CORRIDOR.SLOT_TRAVEL, slot) * width * CORRIDOR.TRACK_SPACING
          pairVisible = imagesStarted && streamAge >= 0 && streamAge <= maxVisible ? 1 : 0
        }

        for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
          const card = cardRefs.current[pairIndex * 2 + sideIndex]
          if (!card) continue

          let x = pairX
          let scale = pairScale
          let rotation = pairRotation
          let birth = pairBirth
          let opacityFactor = pairOpacity
          let visible = pairVisible
          let mirror = sideIndex === 0 ? -1 : 1 // 移动端左右镜像
          let zSlot = streamAge

          if (isDesktop) {
            // 桌面：单向流动带。每对的两张卡各占半个 slot，自右向左依次排列。
            const slot = Math.max(streamAge + sideIndex * FAN.SLOT_STEP, 0)
            const s = clampSlot(
              (slot - FAN.CURVE_SLOT_OFFSET) * FAN.CURVE_SLOT_STEP,
              FAN.SCALE.length - 1,
            )
            birth = easeInOut(clamp(slot / FAN.BIRTH_SLOTS))
            scale = interpolateSlot(FAN.SCALE, s) * outerScale * (0.3 + 0.7 * birth)
            rotation = interpolateSlot(FAN.ROTATION, s)
            opacityFactor = interpolateSlot(FAN.OPACITY, s)
            // 最右（slot 0）最大 → 越往左越小、渐隐消失
            x = (FAN.SPAWN_X_RATIO - slot * FAN.TRAVEL_RATIO) * width
            visible = imagesStarted && streamAge >= 0 && slot <= maxVisible ? 1 : 0
            mirror = 1
            zSlot = slot
          }

          card.style.setProperty('--x', `${mirror * x}px`)
          card.style.setProperty('--scale', scale.toFixed(4))
          card.style.setProperty('--rotate', `${mirror * -rotation}deg`)
          card.style.setProperty('--birth', birth.toFixed(4))
          card.style.opacity = (visible * opacityFactor * birth).toFixed(4)
          card.style.zIndex = String(
            20 + Math.round((maxVisible - clampSlot(zSlot, maxVisible)) * 10),
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
        className="absolute left-0 w-full z-10 pointer-events-none top-[42%] md:top-[43%] h-[56%]"
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
              // 布局宽度必须 ≥「该模式下卡片被放大后的最大显示宽度」，否则 <img> 会按
              // 较小的布局尺寸解码/栅格化，再被合成器拉伸 → 图糊成马赛克。
              // 放大由 transform: scale(var(--scale)) 完成，而 --scale 已乘上
              // outerScale = maxCardWidth / baseCardWidth，所以这里放大布局盒不会改变
              // 任何可见几何（位移/尺寸都与 outerScale 相互抵消），只是让栅格化分辨率够用。
              // 移动端走廊：最大显示宽 = 开口高 / 0.75 = 34.67vh（另一项 1.02×0.333vw = 34vw）
              // 桌面单向带：最大显示宽 = min(0.33vw, 0.52vh)
              className="absolute top-1/2 left-1/2 overflow-hidden w-[max(40vh,38vw)] md:w-[min(39vw,60vh)]"
              style={
                {
                  '--x': '0px',
                  '--scale': '0.27',
                  '--rotate': '0deg',
                  '--birth': '0',
                  '--base-shift': isDesktop ? '-50%' : sideIndex === 0 ? '-100%' : '0%',
                  '--origin-x': isDesktop ? '50%' : sideIndex === 0 ? '100%' : '0%',
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
