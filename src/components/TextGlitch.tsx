import { useEffect, useState, type CSSProperties } from 'react'

interface TextGlitchProps {
  text: string
  className?: string
  style?: CSSProperties
  /** 错位幅度(像素),默认 8 */
  offset?: number
  /** 相邻字符的动画间隔(ms),默认 30;越大波浪感越明显 */
  stagger?: number
}

/**
 * 鼠标移入波浪式错位效果,移出恢复正常。
 * 实现原理:把文字拆成单字符,每个字符单独包成 inline-block;
 * hover 时按字符索引 i 用三角函数算出不同方向的位移 + 旋转,
 * transition-delay 按 i 递增(波浪依次弹起),移出时反向 delay(波浪收回)。
 */
export function TextGlitch({ text, className = '', style = {}, offset = 8, stagger = 30 }: TextGlitchProps) {
  // 客户端挂载后才判断 hover 支持,避免 SSR/移动端渲染错位文字
  const [isHoverable, setIsHoverable] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    setIsHoverable(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  }, [])

  // 移动端/不支持 hover:直接渲染普通文字
  if (!isHoverable) {
    return (
      <h1 className={className} style={style}>
        {text}
      </h1>
    )
  }

  // 把字符串拆成字符(支持中文、emoji surrogate pair 等)
  const chars = Array.from(text)

  return (
    <h1
      className={className}
      style={{
        ...style,
        position: 'relative',
        display: 'inline-block',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {chars.map((ch, i) => {
        // 三角函数算位移:相邻字符方向相反 → 形成波浪式起伏
        const dx = Math.sin(i * 0.7) * offset
        const dy = Math.cos(i * 0.5) * offset * 1.2
        const rotate = Math.sin(i * 0.6) * 4
        // hover 时从左往右依次弹起（波浪感）,
        // leave 时全部同时归位（不要反向 stagger,避免快速进出时动画叠加拖沓）
        const delayMs = hovered ? i * stagger : 0
        const isSpace = ch === ' '
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
              transitionDelay: `${delayMs}ms`,
              transform: hovered
                ? `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg)`
                : 'translate(0, 0) rotate(0)',
              // 空格用不间断空格占位,避免被 inline-block 合并
              whiteSpace: isSpace ? 'pre' : 'normal',
            }}
          >
            {isSpace ? '\u00A0' : ch}
          </span>
        )
      })}
    </h1>
  )
}