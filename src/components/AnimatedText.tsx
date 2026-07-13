import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { type FC } from 'react'

interface AnimatedTextProps {
  text: string
  className?: string
  style?: React.CSSProperties
}

const AnimatedChar: FC<{
  char: string
  start: number
  end: number
  scrollYProgress: MotionValue<number>
}> = ({ char, start, end, scrollYProgress }) => {
  // Each character calls useTransform exactly once, unconditionally.
  const opacity = useTransform(scrollYProgress, [start, end], [0.2, 1])

  return (
    <span style={{ position: 'relative', display: 'inline' }}>
      <span style={{ visibility: 'hidden' }}>{char}</span>
      <motion.span
        style={{
          opacity,
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'inline',
        }}
      >
        {char}
      </motion.span>
    </span>
  )
}

const AnimatedText: FC<AnimatedTextProps> = ({ text, className, style }) => {
  const containerRef = useRef<HTMLParagraphElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.2'],
  })

  const chars = text.split('')

  return (
    <p
      ref={containerRef}
      className={className}
      style={{ position: 'relative', ...style }}
    >
      {chars.map((char, i) => {
        const start = i / chars.length
        const end = Math.min((i + 1) / chars.length, 1)
        return (
          <AnimatedChar
            key={i}
            char={char}
            start={start}
            end={end}
            scrollYProgress={scrollYProgress}
          />
        )
      })}
    </p>
  )
}

export default AnimatedText
