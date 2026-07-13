export interface NavLink {
  label: string
  href: string
}

export interface HeroContent {
  logo: string
  navLinks: NavLink[]
  ctaText: string
  title: string
  subtitle: string
  portraitImage: string
  bannerImage: string
  bannerVideo: string
  bannerText: string
  bannerTextSize: string
  bannerTextColor: string
  bannerTextLineHeight: string
  bannerTextWeight: string
  bannerTextAlign: string
  bannerTextVPosition: string
  bannerSubtitle: string
  bannerSubtitleSize: string
  bannerSubtitleColor: string
  bannerSubtitleLineHeight: string
  bannerSubtitleWeight: string
  bannerButtonText: string
  bannerButtonLink: string
    bannerButtonColor: string
    bannerButtonTextColor: string
    bannerButtonFontSize: string
    bannerButtonFontWeight: string
  }

export interface DecorativeImages {
  topLeft: string
  bottomLeft: string
  topRight: string
  bottomRight: string
}

export interface ProfileStat {
  value: string
  label: string
}

export interface WorkExperience {
  period: string
  company: string
  title: string
  description: string
}

export interface ProfileInfo {
  photo: string
  name: string
  role: string
  gender: string
  age: string
  email: string
  phone: string
  jobTarget: string
  experience: string
  location: string
  bio: string
  stats: ProfileStat[]
  tags: string[]
  workExperience: WorkExperience[]
}

export interface AboutContent {
  title: string
  text: string
  decorativeImages: DecorativeImages
  profile: ProfileInfo
}

export interface ServiceItem {
  number: string
  name: string
  description: string
}

export interface ServicesContent {
  title: string
  items: ServiceItem[]
}

export interface ProjectItem {
  number: string
  name: string
  category: string
  col1Img1: string
  col1Img2: string
  col2Img: string
}

export interface ProjectsContent {
  title: string
  items: ProjectItem[]
}

export interface MarqueeContent {
  row1: string[]
  row2: string[]
}

export type SectionType = 'marquee' | 'about' | 'services' | 'projects'

export type TabId = 'navbar' | 'banner' | SectionType

export interface SiteContent {
  hero: HeroContent
  marquee: MarqueeContent
  about: AboutContent
  services: ServicesContent
  projects: ProjectsContent
  sectionOrder: SectionType[]
  tabOrder: TabId[]
}

export const defaultContent: SiteContent = {
  hero: {
    logo: 'Jack',
    navLinks: [
      { label: '首页', href: '#hero' },
      { label: '关于', href: '#about' },
      { label: '技能', href: '#skills' },
      { label: '作品', href: '#projects' },
      { label: '后台管理', href: '/admin' },
    ],
    ctaText: '查看资料',
    title: "Hi, i'm jack",
    subtitle: 'a 3d creator driven by crafting striking and unforgettable projects',
    portraitImage:
      'https://shrug-person-78902957.figma.site/_components/v2/d24c01ad3a56fc65e942a1f501eb73db42d7cf9a/Rectangle_40443.81459862.png',
    bannerImage: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1920&q=80',
    bannerVideo: '',
    bannerText: 'Every Match Feels Better with Wanbo',
    bannerTextSize: '48',
    bannerTextColor: '#FFFFFF',
    bannerTextLineHeight: '1.2',
    bannerTextWeight: '700',
    bannerTextAlign: 'center',
    bannerTextVPosition: 'center',
    bannerSubtitle: 'Portable Entertainment for Every Football Night',
    bannerSubtitleSize: '18',
    bannerSubtitleColor: '#FFFFFF',
    bannerSubtitleLineHeight: '1.6',
    bannerSubtitleWeight: '300',
    bannerButtonText: 'Fit Your Space',
    bannerButtonLink: '#contact',
    bannerButtonColor: '#C8A575',
    bannerButtonTextColor: '#FFFFFF',
    bannerButtonFontSize: '14',
    bannerButtonFontWeight: '500',
  },
  marquee: {
    row1: [
      'https://motionsites.ai/assets/hero-space-voyage-preview-eECLH3Yc.gif',
      'https://motionsites.ai/assets/hero-codenest-preview-Cgppc2qV.gif',
      'https://motionsites.ai/assets/hero-vex-ventures-preview-BczMFIiw.gif',
      'https://motionsites.ai/assets/hero-stellar-ai-v2-preview-DjvxjG3C.gif',
      'https://motionsites.ai/assets/hero-asme-preview-B_nGDnTP.gif',
      'https://motionsites.ai/assets/hero-transform-data-preview-Cx5OU29N.gif',
      'https://motionsites.ai/assets/hero-vitara-preview-Cjz2QYyU.gif',
      'https://motionsites.ai/assets/hero-terra-preview-BFjrCr7T.gif',
      'https://motionsites.ai/assets/hero-skyelite-preview-DHaZIgUv.gif',
      'https://motionsites.ai/assets/hero-aethera-preview-DknSlcTa.gif',
      'https://motionsites.ai/assets/hero-designpro-preview-D8c5_een.gif',
    ],
    row2: [
      'https://motionsites.ai/assets/hero-stellar-ai-preview-D3HL6bw1.gif',
      'https://motionsites.ai/assets/hero-xportfolio-preview-D4A8maiC.gif',
      'https://motionsites.ai/assets/hero-orbit-web3-preview-BXt4OttD.gif',
      'https://motionsites.ai/assets/hero-nexora-preview-cx5HmUgo.gif',
      'https://motionsites.ai/assets/hero-evr-ventures-preview-DZxeVFEX.gif',
      'https://motionsites.ai/assets/hero-planet-orbit-preview-DWAP8Z1P.gif',
      'https://motionsites.ai/assets/hero-new-era-preview-CocuDUm9.gif',
      'https://motionsites.ai/assets/hero-wealth-preview-B70idl_u.gif',
      'https://motionsites.ai/assets/hero-luminex-preview-CxOP7ce6.gif',
      'https://motionsites.ai/assets/hero-celestia-preview-0yO3jXO8.gif',
    ],
  },
  about: {
    title: 'About me',
    text: "With more than five years of experience in design, i focus on branding, web design, and user experience, i truly enjoy working with businesses that aim to stand out and present their best image. Let's build something incredible together!",
    decorativeImages: {
      topLeft:
        'https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/moon_icon.11395d36.png',
      bottomLeft:
        'https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/p59_1.4659672e.png',
      topRight:
        'https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/lego_icon-1.703bb594.png',
      bottomRight:
        'https://shrug-person-78902957.figma.site/_components/v2/ebb2b8f25d8e24d5f0a5ca8af4c950de81aa2fd7/Group_134-1.2e04f3ce.png',
    },
    profile: {
      photo: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=600&fit=crop&q=80',
      name: '李杨',
      role: 'UI / 平面视觉设计师',
      gender: '男',
      age: '28岁',
      email: '1711930646@qq.com',
      phone: '+86 176-0716-9406（vx同号）',
      jobTarget: 'UI/视觉设计师',
      experience: '5年',
      location: '深圳市',
      bio: '我把视觉系统、品牌叙事和 AI 工作流揉成一套能落地设计战斗力。擅长从 0 到 1 搭建风格方向，让产品、短视频和电商视觉更有记忆点，也更能打。',
      stats: [
        { value: '5+', label: '设计经验' },
        { value: '30+', label: '项目落地' },
        { value: '500+', label: '视觉作品' },
      ],
      tags: ['品牌视觉系统', 'AIGC 视觉工作流', '短视频封面体系', '电商营销视觉'],
      workExperience: [
        {
          period: '2023.04 - 至今',
          company: '未来影像科技有限公司',
          title: 'AI 设计师 / 视觉设计负责人',
          description: '负责 AIGC 视觉流程搭建与 AI 设计项目主导，覆盖品牌视觉、产品营销图、短视频封面与电商首页。',
        },
        {
          period: '2020.09 - 2023.03',
          company: '星火智能科技有限公司',
          title: 'AIGC 设计师',
          description: '参与智能产品界面与品牌视觉系统建设，主导多个 AI 工具的宣传物料与官网视觉升级。',
        },
        {
          period: '2018.07 - 2020.08',
          company: '云象互动科技有限公司',
          title: '视觉设计师',
          description: '负责移动端产品与运营活动视觉设计，建立设计规范并推动团队协作效率提升。',
        },
      ],
    },
  },
  services: {
    title: 'Services',
    items: [
      {
        number: '01',
        name: '3D Modeling',
        description:
          'Creation of detailed objects, characters, or environments tailored to specific client needs, ideal for games, products, and visualizations.',
      },
      {
        number: '02',
        name: 'Rendering',
        description:
          'High-quality, photorealistic renders that showcase designs with custom lighting, textures, and materials to bring concepts to life.',
      },
      {
        number: '03',
        name: 'Motion Design',
        description:
          'Dynamic animations and motion graphics that add energy and storytelling to brands, products, and digital experiences.',
      },
      {
        number: '04',
        name: 'Branding',
        description:
          'Crafting cohesive visual identities -- from logos to full brand systems -- that communicate a clear and memorable presence.',
      },
      {
        number: '05',
        name: 'Web Design',
        description:
          'Designing clean, modern, and conversion-focused websites with attention to layout, typography, and user experience.',
      },
    ],
  },
  projects: {
    title: 'Project',
    items: [
      {
        number: '01',
        name: 'Nextlevel Studio',
        category: 'Client',
        col1Img1:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055344_5eff02e0-87a5-41ce-b64f-eb08da8f33db.png&w=1280&q=85',
        col1Img2:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055431_11d841fd-8b41-46a5-82e4-b04f2407a7d8.png&w=1280&q=85',
        col2Img:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055451_e317bf2d-28d4-48cc-86b0-6f72f25b6327.png&w=1280&q=85',
      },
      {
        number: '02',
        name: 'Aura Brand Identity',
        category: 'Personal',
        col1Img1:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055654_911201c5-36d9-4bc6-bac7-331adfce159f.png&w=1280&q=85',
        col1Img2:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055723_5ceda0b8-d9c2-4665-b2e3-83ba19ba76d1.png&w=1280&q=85',
        col2Img:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055753_adc5dcbd-a8e6-49c0-b43a-9b030d835cea.png&w=1280&q=85',
      },
      {
        number: '03',
        name: 'Solaris Digital',
        category: 'Client',
        col1Img1:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055759_963cfb0b-4bd1-4b0f-9d0a-09bd6cf95b2f.png&w=1280&q=85',
        col1Img2:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_060108_438f781a-9846-4dcc-89ab-c4e6cb830f5b.png&w=1280&q=85',
        col2Img:
          'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260412_055818_9d062121-ad7e-46b9-999a-1a6a692ef1ee.png&w=1280&q=85',
      },
    ],
  },
  sectionOrder: ['marquee', 'about', 'services', 'projects'],
  tabOrder: ['navbar', 'banner', 'marquee', 'about', 'services', 'projects'],
}
