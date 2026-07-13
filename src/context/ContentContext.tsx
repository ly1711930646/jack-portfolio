import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { defaultContent, type SiteContent, type TabId } from '../content/siteContent'
import { isGitHubReady, putContentJson } from '../lib/githubClient'
import { contentJsonUrl } from '../github-config'

const STORAGE_KEY = 'jack-portfolio-content'

interface ContentContextType {
  content: SiteContent
  loading: boolean
  showProfile: boolean
  openProfile: () => void
  closeProfile: () => void
  updateSection: <K extends keyof SiteContent>(section: K, value: SiteContent[K]) => void
  updateField: <K extends keyof SiteContent>(section: K, field: keyof SiteContent[K], value: unknown) => void
  setFullContent: (value: SiteContent) => void
  resetContent: () => void
}

const ContentContext = createContext<ContentContextType | null>(null)

export const mergeWithDefault = (saved: Partial<SiteContent>): SiteContent => {
  // 清理已废弃的 legacy 字段，避免旧数据污染当前结构
  const cleaned: Partial<SiteContent> = { ...saved }
  // @ts-expect-error contact 字段已移除，旧备份中可能残留
  delete cleaned.contact
  if (Array.isArray(cleaned.tabOrder)) {
    cleaned.tabOrder = (cleaned.tabOrder as string[]).filter((t) => t !== 'contact') as TabId[]
  }

  const merged = {
    ...defaultContent,
    ...cleaned,
    hero: { ...defaultContent.hero, ...cleaned.hero },
    marquee: { ...defaultContent.marquee, ...cleaned.marquee },
    about: {
      ...defaultContent.about,
      ...cleaned.about,
      decorativeImages: { ...defaultContent.about.decorativeImages, ...cleaned.about?.decorativeImages },
      profile: {
        ...defaultContent.about.profile,
        ...cleaned.about?.profile,
        stats: Array.isArray(cleaned.about?.profile?.stats)
          ? cleaned.about!.profile!.stats
          : defaultContent.about.profile.stats,
        tags: Array.isArray(cleaned.about?.profile?.tags)
          ? cleaned.about!.profile!.tags
          : defaultContent.about.profile.tags,
        workExperience: Array.isArray(cleaned.about?.profile?.workExperience)
          ? cleaned.about!.profile!.workExperience
          : defaultContent.about.profile.workExperience,
      },
    },
    services: { ...defaultContent.services, ...cleaned.services },
    projects: { ...defaultContent.projects, ...cleaned.projects },
  }
  if (Array.isArray(cleaned.sectionOrder) && cleaned.sectionOrder.length > 0) {
    merged.sectionOrder = cleaned.sectionOrder
  }
  if (Array.isArray(cleaned.tabOrder) && cleaned.tabOrder.length > 0) {
    merged.tabOrder = cleaned.tabOrder
  }
  // If saved has empty bannerImage/video, fall back to defaults
  if (!merged.hero.bannerImage && !merged.hero.bannerVideo) {
    merged.hero.bannerImage = defaultContent.hero.bannerImage
  }
  return merged
}

// 本地缓存（兜底，不依赖它作为主存储）
const persistLocal = (content: SiteContent) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(content))
  } catch {
    /* ignore */
  }
}

// 持久化：配置 GitHub 时写回仓库（保存即同步全网）；否则回退到 /api/content（dev 用），同时写本地缓存
const persistServer = (content: SiteContent) => {
  persistLocal(content)
  if (isGitHubReady()) {
    putContentJson(content).catch(() => {
      /* 云端写入失败不影响本地缓存 */
    })
  } else {
    fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    }).catch(() => {
      /* 服务端不可用时静默失败，本地缓存仍在 */
    })
  }
}

// 加载优先级：云端 COS > dev 服务端文件 > 静态烘焙文件（Pages 等纯静态托管）> 本地缓存 > 默认值
const loadInitial = async (): Promise<SiteContent> => {
  // 最高优先级：GitHub 仓库上的 content.json（配置后保存即同步，无需重新打包）
  if (contentJsonUrl) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(contentJsonUrl, { cache: 'no-cache', signal: ctrl.signal })
      clearTimeout(timer)
      if (res.ok) {
        const raw = await res.json()
        if (raw && typeof raw === 'object' && (raw.hero || raw.about || raw.projects || raw.services || raw.marquee)) {
          return mergeWithDefault(raw)
        }
      }
    } catch {
      /* GitHub 不可用时（如国内被墙）走兜底 */
    }
  }
  try {
    const res = await fetch('/api/content')
    if (res.ok) {
      const raw = await res.json()
      // 只有服务端确有实质内容时才以它为准，避免空的 {} 覆盖本地已有数据
      if (raw && typeof raw === 'object' && (raw.hero || raw.about || raw.projects || raw.services || raw.marquee)) {
        return mergeWithDefault(raw)
      }
    }
  } catch {
    /* 服务端不可用时走兜底 */
  }
  try {
    // 纯静态托管（如 GitHub Pages）没有 /api/content，读取构建时烘焙进 dist 的静态文件
    const staticRes = await fetch(`${import.meta.env.BASE_URL}data/content.json`, { cache: 'no-cache' })
    if (staticRes.ok) {
      const raw = await staticRes.json()
      if (raw && typeof raw === 'object' && (raw.hero || raw.about || raw.projects || raw.services || raw.marquee)) {
        return mergeWithDefault(raw)
      }
    }
  } catch {
    /* 静态文件不可用走兜底 */
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return mergeWithDefault(JSON.parse(saved))
  } catch {
    /* ignore */
  }
  return defaultContent
}

export const ContentProvider = ({ children }: { children: ReactNode }) => {
  // 先用本地缓存做同步初始化，避免首屏闪白
  const [content, setContent] = useState<SiteContent>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return mergeWithDefault(JSON.parse(saved))
    } catch {
      /* ignore */
    }
    return defaultContent
  })
  const [loading, setLoading] = useState(true)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadInitial().then((c) => {
      if (!cancelled) {
        setContent(c)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 内容变化时（含首次加载完成后）→ 持久化到服务端 + 本地
  useEffect(() => {
    if (loading) return
    persistServer(content)
  }, [content, loading])

  const updateSection = <K extends keyof SiteContent>(section: K, value: SiteContent[K]) => {
    setContent((prev) => ({ ...prev, [section]: value }))
  }

  const updateField = <K extends keyof SiteContent>(
    section: K,
    field: keyof SiteContent[K],
    value: unknown,
  ) => {
    setContent((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }))
  }

  const setFullContent = (value: SiteContent) => {
    setContent(value)
  }

  const resetContent = () => {
    setContent(defaultContent)
    persistServer(defaultContent)
  }

  const openProfile = () => setShowProfile(true)
  const closeProfile = () => setShowProfile(false)

  return (
    <ContentContext.Provider value={{ content, loading, showProfile, openProfile, closeProfile, updateSection, updateField, setFullContent, resetContent }}>
      {children}
    </ContentContext.Provider>
  )
}

export const useContent = () => {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used within ContentProvider')
  return ctx
}
