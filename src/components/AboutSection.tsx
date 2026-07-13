import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import FadeIn from './FadeIn'
import AnimatedText from './AnimatedText'
import ContactButton from './ContactButton'
import Magnet from './Magnet'
import { useContent } from '../context/ContentContext'
import type { AboutContent } from '../content/siteContent'

const DecorativeImage = ({
  src,
  className,
  delay,
  x,
}: {
  src: string
  className: string
  delay: number
  x: number
}) => (
  <motion.div
    initial={{ opacity: 0, x, y: 0 }}
    whileInView={{ opacity: 1, x: 0, y: 0 }}
    viewport={{ once: true, margin: '50px', amount: 0 }}
    transition={{ duration: 0.9, delay, ease: [0.25, 0.1, 0.25, 1] }}
    className={className}
  >
    <Magnet padding={100} strength={6} activeTransition="transform 0.2s ease-out" inactiveTransition="transform 0.5s ease-out">
      <img src={src} alt="" />
    </Magnet>
  </motion.div>
)

const ProfileModal = ({ profile, onClose }: { profile: AboutContent['profile']; onClose: () => void }) => {
  const modalRef = useRef<HTMLDivElement>(null)

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.07, delayChildren: 0.08 },
    },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 18, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 320, damping: 22 },
    },
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // 鼠标局部聚光灯：只让光标所在区域亮起
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = modalRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }

  const InfoRow = ({
    label,
    value,
    href,
  }: {
    label: string
    value: string
    href?: string
  }) => (
    <div className="py-1">
      <span className="block text-[11px] font-medium text-white/35 uppercase tracking-wider mb-0.5">{label}</span>
      {href ? (
        <a
          href={href}
          className="text-sm font-medium text-[#D7E2EA] hover:text-[#4A90FF] transition-colors break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="text-sm font-medium text-[#D7E2EA]">{value}</span>
      )}
    </div>
  )

  const StatBox = ({ value, label }: { value: string; label: string }) => (
    <div className="text-center md:text-left">
      <span className="block text-4xl sm:text-5xl md:text-6xl font-bold text-[#4A90FF] leading-none tracking-tighter">
        {value}
      </span>
      <span className="block text-[11px] font-medium text-white/40 uppercase tracking-wider mt-2">{label}</span>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 240, damping: 16, mass: 0.8 }}
        ref={modalRef}
        onMouseMove={handleMouseMove}
        className="relative w-full max-w-4xl xl:max-w-5xl bg-[#0f0f0f] border border-white/[0.06] rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 跟随鼠标的边框光晕 */}
        <div
          className="pointer-events-none absolute inset-0 z-30 rounded-[2rem]"
          style={{
            padding: '2px',
            background:
              'radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(74,144,255,0.55), rgba(74,144,255,0.18) 45%, transparent 72%)',
            transition: 'background 0.15s ease',
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
          }}
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col md:flex-row gap-5 p-5 max-h-[92vh] overflow-y-auto"
        >
          {/* Left: photo card */}
          <motion.div variants={itemVariants} className="w-full md:w-[34%] md:min-h-[440px] lg:min-h-[480px] relative rounded-3xl overflow-hidden bg-[#161616] shrink-0">
            {profile.photo ? (
              <img
                src={profile.photo}
                alt={profile.name}
                className="w-full h-full md:absolute md:inset-0 object-cover"
              />
            ) : (
              <div className="w-full h-full md:absolute md:inset-0 bg-gradient-to-br from-[#4A90FF] to-[#B600A8] flex items-center justify-center text-6xl font-bold text-white">
                {profile.name ? profile.name.charAt(0).toUpperCase() : 'J'}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
          </motion.div>

          {/* Right: info card */}
          <motion.div variants={itemVariants} className="relative flex-1 bg-[#141414] border border-white/[0.05] rounded-3xl p-6 sm:p-7 md:p-8 flex flex-col justify-between">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-colors text-lg sm:text-xl leading-none"
              aria-label="关闭"
            >
              ×
            </button>
            {/* Label */}
            <span className="inline-block text-[10px] font-bold tracking-[0.25em] text-[#4A90FF] uppercase mb-2">
              About Me
            </span>

            {/* Title */}
            <h3 className="text-3xl sm:text-4xl md:text-[44px] font-bold text-[#D7E2EA] leading-[1.05] tracking-tight mb-3">
              {profile.name || 'Name'}
            </h3>

            {/* Bio */}
            <p className="text-sm text-[#D7E2EA]/60 leading-relaxed mb-5">
              {profile.bio}
            </p>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 mb-5 pb-5 border-b border-white/[0.06]">
              <InfoRow label="当前身份" value={profile.role} />
              <InfoRow label="服务方向" value={profile.jobTarget} />
              <InfoRow label="手机" value={profile.phone} href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`} />
              <InfoRow label="邮箱" value={profile.email} href={`mailto:${profile.email}`} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              {(profile.stats || []).slice(0, 3).map((stat, i) => (
                <StatBox key={i} value={stat.value} label={stat.label} />
              ))}
            </div>

            {/* Tags */}
            <div className="pt-4 border-t border-white/[0.06]">
              <span className="block text-[10px] font-bold text-[#4A90FF] uppercase tracking-[0.2em] mb-2.5">SKILLS</span>
              <div className="flex flex-wrap gap-2">
                {(profile.tags || []).map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white/[0.04] text-[#D7E2EA]/70 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Work Experience */}
        {(profile.workExperience || []).length > 0 && (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="bg-[#141414] border border-white/[0.05] rounded-3xl p-6 sm:p-7 md:p-8"
          >
            <div className="mb-8">
              <span className="text-lg font-bold text-[#D7E2EA]">工作经历</span>
            </div>

            <div className="relative">
              {/* Timeline dashed line */}
              <div className="absolute top-[15px] left-0 right-0 h-0 border-t border-dashed border-[#4A90FF]/40 hidden md:block" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
                {(profile.workExperience || []).slice(0, 3).map((job, i) => (
                  <div key={i} className="relative pt-8">
                    {/* Dot: third one highlighted (white ring + blue center), others default */}
                    {i === 2 ? (
                      <div className="hidden md:flex absolute top-[8px] left-0 w-3.5 h-3.5 rounded-full border-2 border-white bg-transparent items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#4A90FF]" />
                      </div>
                    ) : (
                      <div className="hidden md:flex absolute top-[8px] left-0 w-3.5 h-3.5 rounded-full bg-[#4A90FF] shadow-[0_0_12px_rgba(74,144,255,0.5)] items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0f0f0f]" />
                      </div>
                    )}

                    <div className="md:pl-1">
                      <span className="block text-xs font-medium text-[#4A90FF]/90 mb-2">{job.period}</span>
                      <h4 className="text-base font-bold text-[#D7E2EA] mb-1.5">{job.company}</h4>
                      <span className="inline-block px-2.5 py-1 rounded-md bg-white/[0.05] text-[11px] font-medium text-white/70 border border-white/[0.08] mb-2.5">
                        {job.title}
                      </span>
                      <p className="text-xs text-[#D7E2EA]/50 leading-relaxed">{job.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}

const AboutSection = () => {
  const { content, showProfile, openProfile, closeProfile } = useContent()
  const { about } = content

  return (
    <section id="about" className="relative min-h-screen flex flex-col items-center justify-center bg-[#0C0C0C] px-5 sm:px-8 md:px-10 py-20 overflow-hidden">
      {/* Decorative 3D Images */}
      <DecorativeImage
        src={about.decorativeImages.topLeft}
        delay={0.1}
        x={-80}
        className="absolute top-[4%] left-[1%] sm:left-[2%] md:left-[4%] z-10 w-[120px] sm:w-[160px] md:w-[210px]"
      />

      <DecorativeImage
        src={about.decorativeImages.bottomLeft}
        delay={0.25}
        x={-80}
        className="absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%] z-10 w-[100px] sm:w-[140px] md:w-[180px]"
      />

      <DecorativeImage
        src={about.decorativeImages.topRight}
        delay={0.15}
        x={80}
        className="absolute top-[4%] right-[1%] sm:right-[2%] md:right-[4%] z-10 w-[120px] sm:w-[160px] md:w-[210px]"
      />

      <DecorativeImage
        src={about.decorativeImages.bottomRight}
        delay={0.3}
        x={80}
        className="absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%] z-10 w-[130px] sm:w-[170px] md:w-[220px]"
      />

      {/* Content */}
      <div className="relative z-20 flex flex-col items-center gap-10 sm:gap-14 md:gap-16">
        <FadeIn as="h2" delay={0} y={40} className="hero-heading font-black uppercase leading-none tracking-tight text-center" style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}>
          {about.title}
        </FadeIn>

        <AnimatedText
          text={about.text}
          className="text-[#D7E2EA] font-medium text-center leading-relaxed max-w-[560px]"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.35rem)' }}
        />
      </div>

      <div className="relative z-20 mt-16 sm:mt-20 md:mt-24">
        <FadeIn delay={0}>
          <ContactButton text="查看更多" onClick={openProfile} />
        </FadeIn>
      </div>

      <AnimatePresence>
        {showProfile && <ProfileModal profile={about.profile} onClose={closeProfile} />}
      </AnimatePresence>
    </section>
  )
}

export default AboutSection
