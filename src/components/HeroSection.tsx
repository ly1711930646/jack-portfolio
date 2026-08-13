import { useContent } from '../context/ContentContext'
import { SmartImage } from './SmartImage'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'

/**
 * HeroSection — Mathew header 风格
 * 浅灰背景 + 超大居中姓名 + 人像在文字后方 + 底部 CTA / 头像组 / 旋转徽章
 */

const RotatingBadge = ({ text }: { text: string }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    let raf = 0
    let angle = 0
    const step = () => {
      angle = (angle + 0.35) % 360
      svg.style.transform = `rotate(${angle}deg)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className="w-16 h-16 md:w-20 md:h-20"
      style={{ willChange: 'transform' }}
    >
      <defs>
        <path
          id="circlePath"
          d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0"
        />
      </defs>
      <text className="fill-[#0C0C0C]/70 text-[11px] uppercase tracking-[0.18em]">
        <textPath href="#circlePath" startOffset="0%">
          {text}
        </textPath>
      </text>
    </svg>
  )
}

const AvatarStack = () => (
  <div className="flex -space-x-2.5">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-[#F2F2F2] bg-neutral-300"
        style={{
          backgroundImage: `linear-gradient(135deg, ${
            i === 0 ? '#d4d4d4 0%, #a3a3a3 100%' : i === 1 ? '#a3a3a3 0%, #737373 100%' : '#737373 0%, #525252 100%'
          })`,
        }}
      />
    ))}
  </div>
)

const HeroSection = () => {
  const { content } = useContent()
  const { hero } = content

  // 大标题优先取 title 中的中文姓名；没有中文则使用完整 title；都没有则用 bannerText
  const displayName =
    (hero.title.match(/[\u4e00-\u9fa5]+/) || [])[0] ||
    hero.title ||
    hero.bannerText ||
    ''

  const topLine = hero.bannerSubtitle || ''
  const ctaText = hero.bannerButtonText || ''
  const ctaLink = hero.bannerButtonLink || '#contact'
  const portrait = hero.portraitImage || hero.bannerImage || ''

  return (
    <section
      id="hero"
      className="relative h-screen w-full bg-[#F2F2F2] text-[#0C0C0C] overflow-hidden"
    >
      {/* 顶部居中细字（类似 Based in London） */}
      {topLine && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
          className="absolute top-24 md:top-28 left-1/2 -translate-x-1/2 z-20"
        >
          <span className="text-[10px] md:text-xs tracking-[0.25em] uppercase text-[#0C0C0C]/55">
            {topLine}
          </span>
        </motion.div>
      )}

      {/* 中央大标题 + 人像 */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="relative w-full max-w-[90rem] mx-auto px-4 h-full flex items-center justify-center">
          {/* 水平光条（Mathew 风格的橙色眼部光晕） */}
          <div
            className="absolute left-0 right-0 h-3 md:h-5 pointer-events-none z-0"
            style={{
              top: 'calc(50% - 0.75rem)',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(249,115,22,0.85) 20%, rgba(239,68,68,0.9) 50%, rgba(249,115,22,0.85) 80%, transparent 100%)',
              filter: 'blur(8px)',
              opacity: 0.75,
            }}
          />

          {/* 人像：放在文字后方 */}
          {portrait && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              className="absolute left-1/2 -translate-x-1/2 bottom-0 z-0 h-[62vh] md:h-[72vh] w-auto max-w-[90%]"
            >
              <SmartImage
                src={portrait}
                alt={displayName}
                className="h-full w-auto object-contain"
              />
            </motion.div>
          )}

          {/* 超大姓名 */}
          {displayName && (
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 text-center font-black tracking-tighter leading-[0.85] select-none"
              style={{
                fontSize: 'clamp(3.5rem, 17vw, 13rem)',
                color: '#0C0C0C',
              }}
            >
              {displayName}
            </motion.h1>
          )}
        </div>
      </div>

      {/* 底部左侧：头像组 + 简介 + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5, ease: 'easeOut' }}
        className="absolute bottom-8 md:bottom-12 left-6 md:left-12 z-20 flex flex-col gap-4 max-w-[280px]"
      >
        <div className="flex items-center gap-3">
          <AvatarStack />
          <p className="text-[10px] md:text-xs leading-relaxed text-[#0C0C0C]/55">
            专注 UI/UX 与视觉设计，<br className="hidden md:block" />
            让每一次第一眼都留下深刻印象。
          </p>
        </div>

        {ctaText && (
          <a
            href={ctaLink}
            onClick={(e) => {
              if (!ctaLink || ctaLink === '#') e.preventDefault()
            }}
            className="group inline-flex items-center gap-2 self-start bg-[#0C0C0C] text-white text-xs md:text-sm font-medium px-5 py-3 rounded-full transition-transform hover:scale-105"
          >
            {ctaText}
            <ArrowUpRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        )}
      </motion.div>

      {/* 底部右侧：旋转徽章 + 角色 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6, ease: 'easeOut' }}
        className="absolute bottom-8 md:bottom-12 right-6 md:right-12 z-20 flex flex-col items-end gap-2"
      >
        <RotatingBadge text="UI DESIGN • 视觉设计 • 品牌设计 • " />
        <span className="text-xs text-[#0C0C0C]/55 tracking-wide">UI/UX 设计师</span>
      </motion.div>
    </section>
  )
}

export default HeroSection
