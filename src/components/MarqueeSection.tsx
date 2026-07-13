import { useEffect, useRef, useState, useCallback } from 'react'
import { useContent } from '../context/ContentContext'

const MarqueeRow = ({
  images,
  direction,
}: {
  images: string[]
  direction: 'left' | 'right'
}) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  const handleScroll = useCallback(() => {
    const el = rowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const sectionTop = rect.top + window.scrollY
    const scrollVal = (window.scrollY - sectionTop + window.innerHeight) * 0.3
    setOffset(scrollVal)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Triple the images for seamless scrolling
  const tripled = [...images, ...images, ...images]

  const translateValue =
    direction === 'right'
      ? `translateX(${offset - 200}px)`
      : `translateX(-${offset - 200}px)`

  return (
    <div
      ref={rowRef}
      className="flex gap-3"
      style={{
        transform: translateValue,
        willChange: 'transform',
      }}
    >
      {tripled.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          className="w-[420px] h-[270px] rounded-2xl object-cover flex-shrink-0"
          loading="lazy"
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
        <MarqueeRow images={marquee.row1} direction="right" />
        <MarqueeRow images={marquee.row2} direction="left" />
      </div>
    </section>
  )
}

export default MarqueeSection
