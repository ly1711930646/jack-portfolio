import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useContent } from '../context/ContentContext'

const ACTIVE_COLOR = '#4A90FF' // same as CTA button

const Navbar = () => {
  const { content, openProfile } = useContent()
  const { hero } = content
  const [isOpen, setIsOpen] = useState(false)
  const [activeId, setActiveId] = useState('hero')
  const [lockedId, setLockedId] = useState<string | null>(null)

  // ── Scroll Spy: detect which section is in view ──
  useEffect(() => {
    const sections = hero.navLinks
      .filter((l) => l.href.startsWith('#'))
      .map((l) => l.href.slice(1))
    const allSections = ['hero', ...sections.filter((s) => s !== 'hero')]

    const onScroll = () => {
      if (lockedId) return
      if (window.scrollY < 50) { setActiveId('hero'); return }

      // Find the section whose top is closest to but below ~100px (just past navbar)
      // If scrolled to the very bottom, highlight the last section
      const scrollBottom = window.scrollY + window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      if (scrollBottom >= docHeight - 4) {
        setActiveId(allSections[allSections.length - 1])
        return
      }

      let active = allSections[0]
      for (const id of allSections) {
        const el = document.getElementById(id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= 120) {
          active = id
        } else {
          break
        }
      }
      setActiveId(active)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [hero.navLinks, lockedId])

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const el = document.querySelector(href)
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY
        const id = href.slice(1)
        // Lock active state to prevent observer flash during smooth scroll
        setActiveId(id)
        setLockedId(id)
        setTimeout(() => setLockedId(null), 1200)
        window.scrollTo({ top, behavior: 'smooth' })
      }
    }
  }

  const handleLiquidMetalProfile = () => {
    const el = document.querySelector('#about')
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY
      const needsScroll = Math.abs(window.scrollY - top) > 50
      setActiveId('about')
      setLockedId('about')
      setTimeout(() => setLockedId(null), 1400)
      window.scrollTo({ top, behavior: 'smooth' })

      if (needsScroll) {
        setTimeout(() => openProfile(), 900)
      } else {
        openProfile()
      }
    } else {
      openProfile()
    }
  }

  return (
    <>
      {/* ── Nav bar capsule ── */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-4 px-5 md:px-8 py-3 rounded-full mx-auto max-w-6xl mt-4 transition-opacity duration-300">
        {/* Logo */}
        <a
          href="#hero"
          className={`font-medium text-base tracking-wide whitespace-nowrap transition-colors duration-300 ${
            activeId === 'hero' ? 'text-[#4A90FF]' : 'text-[#D7E2EA]'
          }`}
          onClick={(e) => scrollToSection(e, '#hero')}
        >
          {hero.logo}
        </a>

        {/* Desktop nav links */}
        <div key={hero.navLinks.map((l) => l.href).join('|')} className="hidden md:flex items-center gap-8">
          {hero.navLinks.map((link) => {
            const id = link.href.startsWith('#') ? link.href.slice(1) : ''
            const isActive = link.href.startsWith('#') && activeId === id
            const baseClass =
              'text-sm font-light transition-colors duration-300 whitespace-nowrap'
            const colorClass = isActive
              ? `text-[${ACTIVE_COLOR}] font-normal`
              : 'text-[#D7E2EA]/70 hover:text-white'

            return link.href.startsWith('#') ? (
              <a
                key={link.href}
                href={link.href}
                className={`${baseClass} ${colorClass} relative py-1`}
                onClick={(e) => scrollToSection(e, link.href)}
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full"
                    style={{ backgroundColor: ACTIVE_COLOR }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
              </a>
            ) : (
              <Link key={link.href} to={link.href} className={`${baseClass} text-[#D7E2EA]/70 hover:text-white`}>
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Desktop CTA — glass capsule matching the nav bar */}
        <button
          type="button"
          onClick={handleLiquidMetalProfile}
          className="hidden md:inline-flex items-center gap-2 nav-glass-button text-sm font-bold px-6 py-2.5 rounded-full whitespace-nowrap cursor-pointer"
        >
          {hero.ctaText}
        </button>

        {/* Mobile category links — shown inside top bar when menu is open */}
        {isOpen && (
          <div
            className="md:hidden flex items-center gap-3 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {hero.navLinks
              .filter((link) => link.href.startsWith('#'))
              .map((link) => {
                const id = link.href.slice(1)
                const isActive = activeId === id
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={`text-xs font-medium whitespace-nowrap transition-colors duration-300 ${
                      isActive ? 'text-[#4A90FF]' : 'text-[#D7E2EA]/80 hover:text-white'
                    }`}
                    onClick={(e) => {
                      scrollToSection(e, link.href)
                      setIsOpen(false)
                    }}
                  >
                    {link.label}
                  </a>
                )
              })}
          </div>
        )}

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-[#D7E2EA]/70 hover:text-white transition-colors duration-300"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* ── Mobile menu dropdown ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="mobile-menu-glass md:hidden fixed top-20 left-4 right-4 z-50 rounded-2xl py-8 flex flex-col items-center gap-5"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {/* Non-hash links stay in dropdown; hash links moved to top bar */}
            {hero.navLinks
              .filter((link) => !link.href.startsWith('#'))
              .map((link, i) => {
                const baseClass = "uppercase text-sm tracking-[0.25em] transition-colors duration-300"
                const motionProps = {
                  initial: { opacity: 0, y: -8 } as const,
                  animate: { opacity: 1, y: 0 } as const,
                  transition: { duration: 0.3, delay: 0.05 + i * 0.06, ease: 'easeOut' } as const,
                }
                return (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    className={`${baseClass} text-[#D7E2EA]/90 font-light hover:text-white`}
                    {...motionProps}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </motion.a>
                )
              })}

            {/* Mobile CTA — glass capsule matching the nav bar */}
            <motion.button
              type="button"
              className="mt-2 nav-glass-button text-sm font-bold px-7 py-3 rounded-full cursor-pointer"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.35, ease: 'easeOut' }}
              onClick={() => { setIsOpen(false); handleLiquidMetalProfile() }}
            >
              {hero.ctaText}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Navbar
