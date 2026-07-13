import FadeIn from './FadeIn'
import { useContent } from '../context/ContentContext'

const ServicesSection = () => {
  const { content } = useContent()
  const { services } = content

  return (
    <section id="skills" className="bg-white rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 relative z-10">
      <h2
        className="text-[#0C0C0C] font-black uppercase text-center mb-16 sm:mb-20 md:mb-28"
        style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
      >
        {services.title}
      </h2>

      <div className="max-w-5xl mx-auto flex flex-col">
        {services.items.map((service, i) => (
          <FadeIn
            key={service.number}
            delay={i * 0.1}
            y={20}
            whileHover={{ scale: 1.04, transition: { type: 'spring', stiffness: 400, damping: 18, mass: 0.6 } }}
            className="group flex items-start gap-4 sm:gap-6 md:gap-10 py-8 sm:py-10 md:py-12 border-b border-[rgba(12,12,12,0.15)] last:border-b-0 cursor-default"
          >
            <span
              className="text-[#0C0C0C] font-black flex-shrink-0 leading-none"
              style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
            >
              {service.number}
            </span>
            <div className="flex flex-col justify-center pt-2 sm:pt-3">
              <h3
                className="text-[#0C0C0C] font-medium uppercase leading-tight"
                style={{ fontSize: 'clamp(1rem, 2.2vw, 2.1rem)' }}
              >
                {service.name}
              </h3>
              <p
                className="text-[#0C0C0C] font-light leading-relaxed max-w-2xl opacity-60"
                style={{ fontSize: 'clamp(0.85rem, 1.6vw, 1.25rem)' }}
              >
                {service.description}
              </p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}

export default ServicesSection
