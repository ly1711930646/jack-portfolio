import { motion } from 'framer-motion'
import { useMemo, type FC, type ReactNode, type ElementType } from 'react'

interface FadeInProps {
  children: ReactNode
  as?: ElementType
  delay?: number
  duration?: number
  x?: number
  y?: number
  className?: string
  style?: React.CSSProperties
  whileHover?: Record<string, unknown>
}

const FadeIn: FC<FadeInProps> = ({
  children,
  as = 'div',
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
  style,
  whileHover,
}) => {
  const MotionComponent = useMemo(() => motion.create(as as ElementType), [as])

  return (
    <MotionComponent
      className={className}
      style={style}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      whileHover={whileHover}
      viewport={{ once: true, margin: '50px', amount: 0 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </MotionComponent>
  )
}

export default FadeIn
