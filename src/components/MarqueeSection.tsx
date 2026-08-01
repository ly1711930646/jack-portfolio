import { useEffect, useRef, useState } from 'react'
import { useContent } from '../context/ContentContext'
import { SmartImage } from './SmartImage'

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
  }, [images, speed])

  // 三倍复制内容，实现无缝循环
  const tripled = [...images, ...images, ...images]

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
