import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import LiveProjectButton from './LiveProjectButton'
import { useContent } from '../context/ContentContext'
import type { ProjectItem } from '../content/siteContent'

const ProjectCard = ({ project, index, totalCards }: { project: ProjectItem; index: number; totalCards: number }) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  const targetScale = 1 - (totalCards - 1 - index) * 0.03
  const scale = useTransform(scrollYProgress, [0, 1], [1, targetScale])

  return (
    <div
      ref={containerRef}
      className="sticky h-[85vh] flex items-center justify-center"
      style={{ top: '8rem' }}
    >
      <motion.div
        style={{ scale }}
        className="w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-4 sm:p-6 md:p-8"
      >
        {/* Top Row */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
            <span
              className="text-[#D7E2EA] font-black leading-none"
              style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
            >
              {project.number}
            </span>
            <div className="flex flex-col">
              <span className="text-[#D7E2EA]/60 text-xs sm:text-sm uppercase tracking-wider">
                {project.category}
              </span>
              <h3
                className="text-[#D7E2EA] font-medium uppercase leading-tight"
                style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
              >
                {project.name}
              </h3>
            </div>
          </div>
          <LiveProjectButton />
        </div>

        {/* Bottom Row - Image Grid */}
        <div className="flex gap-2 sm:gap-3 md:gap-4">
          {/* Left column - 40% - 2 stacked images */}
          <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 w-[40%]">
            <img
              src={project.col1Img1}
              alt=""
              className="w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] object-cover"
              style={{ height: 'clamp(130px, 16vw, 230px)' }}
              loading="lazy"
            />
            <img
              src={project.col1Img2}
              alt=""
              className="w-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] object-cover"
              style={{ height: 'clamp(160px, 22vw, 340px)' }}
              loading="lazy"
            />
          </div>
          {/* Right column - 60% - 1 tall image */}
          <div className="w-[60%]">
            <img
              src={project.col2Img}
              alt=""
              className="w-full h-full rounded-[40px] sm:rounded-[50px] md:rounded-[60px] object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

const ProjectsSection = () => {
  const { content } = useContent()
  const { projects } = content

  return (
    <section id="projects" className="bg-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 z-10 relative px-5 sm:px-8 md:px-10 pb-20 sm:pb-24 md:pb-32">
      <h2
        className="hero-heading font-black uppercase text-center leading-none tracking-tight pt-16 sm:pt-20 md:pt-24 mb-8"
        style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
      >
        {projects.title}
      </h2>
      <div className="max-w-5xl mx-auto">
        {projects.items.map((project, i) => (
          <ProjectCard key={project.number} project={project} index={i} totalCards={projects.items.length} />
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection
