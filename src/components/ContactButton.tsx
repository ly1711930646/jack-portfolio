import { type FC } from 'react'

interface ContactButtonProps {
  text?: string
  link?: string
  onClick?: () => void
}

const ContactButton: FC<ContactButtonProps> = ({ text = 'Contact Me', link, onClick }) => {
  const safeLink = link?.trim()
  const isExternalLink = safeLink?.startsWith('http') ?? false
  const isAnchorLink = safeLink?.startsWith('#') ?? false
  const isMailLink = safeLink?.startsWith('mailto:') ?? false
  const hasLink = safeLink && (isExternalLink || isMailLink || isAnchorLink)

  const commonClasses =
    'group relative overflow-hidden rounded-full px-8 py-3 sm:px-10 sm:py-3.5 md:px-12 md:py-4 text-xs sm:text-sm md:text-base text-white font-medium uppercase tracking-widest transition-transform duration-300 hover:scale-105 animate-pulse-glow inline-block text-center'

  const inlineStyle = {
    outline: '2px solid white',
    outlineOffset: '-3px',
  } as React.CSSProperties

  const children = (
    <>
      {/* Diffuse glow layer 1 — slow drifting color blobs */}
      <span
        className="absolute -inset-[60%] -z-30 animate-diffuse-1 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 45% 45%, rgba(182, 0, 168, 0.55) 0%, transparent 55%), radial-gradient(circle at 30% 70%, rgba(118, 33, 176, 0.45) 0%, transparent 50%)',
          filter: 'blur(44px)',
        }}
      />

      {/* Diffuse glow layer 2 — counter-moving, different hue */}
      <span
        className="absolute -inset-[60%] -z-30 animate-diffuse-2 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 60% 40%, rgba(190, 76, 0, 0.45) 0%, transparent 55%), radial-gradient(circle at 40% 80%, rgba(24, 1, 31, 0.6) 0%, transparent 50%)',
          filter: 'blur(52px)',
        }}
      />

      {/* Soft gradient base, slowly drifts */}
      <span
        className="absolute inset-0 -z-20 animate-gradient-shift"
        style={{
          background: 'linear-gradient(123deg, #18011F 7%, #B600A8 37%, #7621B0 72%, #BE4C00 100%)',
          backgroundSize: '220% 220%',
        }}
      />

      {/* Hover shimmer sweep */}
      <span
        className="pointer-events-none absolute inset-0 -z-10 translate-x-[-120%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer-sweep"
        aria-hidden="true"
      />

      <span className="relative z-10">{text}</span>
    </>
  )

  if (hasLink) {
    return (
      <a
        href={safeLink}
        className={commonClasses}
        style={inlineStyle}
        {...(isExternalLink ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  }

  return (
    <button className={commonClasses} style={inlineStyle} onClick={onClick}>
      {children}
    </button>
  )
}

export default ContactButton
