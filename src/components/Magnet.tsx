import { useRef, type FC, type ReactNode, type MouseEvent } from 'react'

interface MagnetProps {
  children: ReactNode
  padding?: number
  strength?: number
  activeTransition?: string
  inactiveTransition?: string
  className?: string
  style?: React.CSSProperties
}

const Magnet: FC<MagnetProps> = ({
  children,
  padding = 150,
  strength = 3,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.6s ease-in-out',
  className,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const magnetRef = useRef<HTMLDivElement>(null)
  const isHovering = useRef(false)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current
    const magnet = magnetRef.current
    if (!container || !magnet) return

    const rect = container.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Check if cursor is within padding distance from element edge
    const fromLeft = e.clientX - rect.left
    const fromRight = rect.right - e.clientX
    const fromTop = e.clientY - rect.top
    const fromBottom = rect.bottom - e.clientY

    const isNear =
      fromLeft <= padding ||
      fromRight <= padding ||
      fromTop <= padding ||
      fromBottom <= padding

    if (isNear) {
      isHovering.current = true
      const deltaX = (e.clientX - centerX) / strength
      const deltaY = (e.clientY - centerY) / strength
      magnet.style.transition = activeTransition
      magnet.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`
      magnet.style.willChange = 'transform'
    } else if (isHovering.current) {
      isHovering.current = false
      magnet.style.transition = inactiveTransition
      magnet.style.transform = 'translate3d(0, 0, 0)'
    }
  }

  const handleMouseLeave = () => {
    const magnet = magnetRef.current
    if (magnet) {
      isHovering.current = false
      magnet.style.transition = inactiveTransition
      magnet.style.transform = 'translate3d(0, 0, 0)'
    }
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={magnetRef}>
        {children}
      </div>
    </div>
  )
}

export default Magnet
