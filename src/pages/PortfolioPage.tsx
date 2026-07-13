import { type FC } from 'react'
import Navbar from '../components/Navbar'
import HeroSection from '../components/HeroSection'
import MarqueeSection from '../components/MarqueeSection'
import AboutSection from '../components/AboutSection'
import ServicesSection from '../components/ServicesSection'
import ProjectsSection from '../components/ProjectsSection'
import { useContent } from '../context/ContentContext'
import type { SectionType } from '../content/siteContent'

const sectionMap: Record<SectionType, FC> = {
  marquee: MarqueeSection,
  about: AboutSection,
  services: ServicesSection,
  projects: ProjectsSection,
}

const PortfolioPage = () => {
  const { content } = useContent()
  const sectionOrder = content.sectionOrder

  return (
    <div style={{ overflowX: 'clip' }}>
      <Navbar />
      <HeroSection />
      {sectionOrder.map((type) => {
        const Component = sectionMap[type]
        return <Component key={type} />
      })}
    </div>
  )
}

export default PortfolioPage
