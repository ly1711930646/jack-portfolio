import { useEffect, useMemo, useRef, useState } from 'react'
import { useContent } from '../context/ContentContext'
import { SmartImage } from './SmartImage'

/**
 * 把本仓库 uploads 路径映射到 jsDelivr CDN：
 * GitHub Pages 国内访问慢，jsDelivr 有国内节点、支持缓存，
 * 图片加载速度显著提升。
 */
const toCdnUrl = (src: string): string => {
  if (!src) return src
  // 已经是外部 URL（http/https 或 // 开头）的不转换
  if (/^https?:\/\//i.test(src) || /^\/\//i.test(src)) return src
  const match = src.match(/\/jack-portfolio\/assets\/uploads\/([^/]+\.[a-z0-9]+)$/i)
  if (match) {
    return `https://cdn.jsdelivr.net/gh/ly1711930646/jack-portfolio@main/public/assets/uploads/${match[1]}`
  }
  return src
}

const MarqueeRow = ({
  images,
  direction,
  speed = 70,
}: {
  images: string[]
  direction: 'left' | 'right'
  speed?: number
}) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(0)
  const [isVisible, setIsVisible] = useState(true)

  // 将所有本地 uploads 路径映射到 jsDelivr CDN
  const cdnImages = useMemo(() => images.map(toCdnUrl), [images])

  useEffect(() => {
    const el = rowRef.current
    if (!el) return

    const computeDuration = () => {
      // 内容已三倍复制，滚动一周的距离 = 总宽度 / 3
      const singleSetWidth = el.scrollWidth / 3
      if (singleSetWidth > 0) {
        setDuration(singleSetWidth / speed)
      }
    }

    computeDuration()

    const ro = new ResizeObserver(computeDuration)
    ro.observe(el)

    const io = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 }
    )
    io.observe(el)

    return () => {
      ro.disconnect()
      io.disconnect()
    }
  }, [cdnImages, speed])

  // 三倍复制内容，实现无缝循环
  const tripled = [...cdnImages, ...cdnImages, ...cdnImages]

  const directionClass = direction === 'left' ? 'marquee-left' : 'marquee-right'
  const runningClass = duration > 0 && isVisible ? 'marquee-running' : ''

  return (
    <div
      ref={rowRef}
      className={`marquee-row flex gap-3 ${directionClass} ${runningClass}`}
      style={{
        ['--marquee-duration' as any]: duration > 0 ? `${duration}s` : '0s',
        willChange: 'transform',
      }}
    >
      {tripled.map((src, i) => (
        <SmartImage
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="w-[420px] h-[270px] rounded-2xl object-cover flex-shrink-0"
          loading="lazy"
          draggable={false}
        />
      ))}
    </div>
  )
}

const MarqueeSection = () => {
  const { content } = useContent()
  const { marquee } = content

  return (
    <section className="bg-[#0C0C0C] pt-24 sm:pt-32 md:pt-40 pb-10 overflow-hidden">
      <div className="flex flex-col gap-3">
        <MarqueeRow images={marquee.row1} direction="right" speed={72} />
        <MarqueeRow images={marquee.row2} direction="left" speed={60} />
      </div>
    </section>
  )
}

export default MarqueeSection
