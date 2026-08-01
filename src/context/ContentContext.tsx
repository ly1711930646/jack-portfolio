import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { defaultContent, type SiteContent, type TabId } from '../content/siteContent'
import { isGitHubReady, putContentJson, deleteAsset } from '../lib/githubClient'
import { contentJsonUrl, githubConfig, migrateLegacyJsdelivrUrls } from '../github-config'

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
  saveContent: (value: SiteContent) => Promise<boolean>
  saveStatus: 'idle' | 'saving' | 'success' | 'error'
  saveError: string
  clearSaveStatus: () => void
}

const ContentContext = createContext<ContentContextType | null>(null)

export const mergeWithDefault = (rawSaved: Partial<SiteContent>): SiteContent => {
  // 先把 content.json 里残留的旧 jsDelivr 域名（cdn.jsdelivr.net / 国内镜像）迁到 raw 直连，
  // 避免第三方 CDN 不稳定导致图片失效。
  const saved = migrateLegacyJsdelivrUrls(rawSaved)
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

// 持久化核心：写回 GitHub 仓库（保存即同步全网）或 dev 服务端；返回是否成功
// 关键：本地兜底 localStorage 只在「云端写入成功」后才写，保证「本地副本永远不比云端新」。
// 否则一旦 GitHub 写失败（限流/网络抖动），本地会存一份比云端更旧的失败副本，
// 下次刷新就会展示本地旧数据而非云端真实数据。
const doPersist = async (content: SiteContent): Promise<boolean> => {
  if (isGitHubReady()) {
    try {
      await putContentJson(content)
      persistLocal(content)
      return true
    } catch {
      return false
    }
  }
  try {
    await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    })
    persistLocal(content)
    return true
  } catch {
    return false
  }
}

// 将 GitHub API 返回的 base64 内容解码为 UTF-8 字符串
const base64ToUtf8 = (base64: string): string => {
  const bin = atob(base64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

// 从 GitHub Pages 同源静态文件加载 content.json（最快，适合首屏秒开）。
// contentJsonUrl 当前已指向 /jack-portfolio/data/content.json。
// 失败时不抛错，由调用方决定回退策略。
const loadFromStatic = async (): Promise<SiteContent | null> => {
  if (!contentJsonUrl) return null
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`${contentJsonUrl}${contentJsonUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`, { cache: 'no-store', signal: ctrl.signal })
    clearTimeout(timer)
    if (res.ok) {
      const raw = await res.json()
      if (raw && typeof raw === 'object' && (raw.hero || raw.about || raw.projects || raw.services || raw.marquee)) {
        return mergeWithDefault(raw)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

// 从 GitHub API 直接读取 content.json（不走 CDN，无缓存问题，最权威）。
// 需要配置 token，作为第一优先加载源。
const loadFromGitHubApi = async (): Promise<SiteContent | null> => {
  if (!isGitHubReady()) return null
  try {
    // 关键：URL 加 cache-buster + 完全不发送 If-None-Match header + Cache-Control: no-store + max-age=0
    //
    // 之前用 If-None-Match: '*'，但 GitHub API 居然把 '*' 当作合法 ETag 匹配 → 返回 304 空 body
    // → 前端 await res.json() 解析失败 → 返回 null → fallback 到 jsDelivr 缓存旧值（coverImg 空）
    // → 用户看到占位图。这是隐藏的"刷新回旧数据"根因之一。
    //
    // 现在彻底不发送 If-None-Match header，让 GitHub 不知道客户端有缓存版本，永远返 200 + 完整 body。
    const url = `https://api.github.com/repos/${githubConfig.repo}/contents/${encodeURI(githubConfig.contentKey)}?ref=${githubConfig.branch}&_t=${Date.now()}`
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubConfig.token}`,
        Accept: 'application/vnd.github+json',
        'Cache-Control': 'no-store, max-age=0',
      },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json()
      const raw = data.content ? JSON.parse(base64ToUtf8(data.content)) : null
      if (raw && typeof raw === 'object' && (raw.hero || raw.about || raw.projects || raw.services || raw.marquee)) {
        return mergeWithDefault(raw)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

// 读取本地兜底（仅在云端/服务端全部不可用时使用，避免展示 CDN 旧缓存）
const loadFromLocal = (): SiteContent | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return mergeWithDefault(JSON.parse(saved))
  } catch {
    /* ignore */
  }
  return null
}

// 加载优先级：
// 1. 同源静态文件（/jack-portfolio/data/content.json）— 最快，让 GitHub Pages 首屏秒开。
// 2. GitHub API（最权威）— 后台再拉取一次，如果比静态新则静默更新。
// 3. 本地 localStorage 兜底。
// 4. 默认值。
const loadInitial = async (): Promise<SiteContent> => {
  // 1. 优先同源静态，超时 3 秒，首屏秒开
  const staticContent = await loadFromStatic()
  if (staticContent) return staticContent

  // 2. GitHub API（权威但慢，5 秒超时）
  if (isGitHubReady()) {
    const github = await loadFromGitHubApi()
    if (github) return github

    // 3. GitHub API 失败时用本地缓存兜底
    const local = loadFromLocal()
    if (local) return local

    return defaultContent
  }

  // 非 GitHub 模式（dev / 静态托管）
  try {
    const res = await fetch('/api/content')
    if (res.ok) {
      const raw = await res.json()
      if (raw && typeof raw === 'object' && (raw.hero || raw.about || raw.projects || raw.services || raw.marquee)) {
        return mergeWithDefault(raw)
      }
    }
  } catch {
    /* 服务端不可用时走兜底 */
  }
  try {
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
  const local = loadFromLocal()
  if (local) return local
  return defaultContent
}

export const ContentProvider = ({ children }: { children: ReactNode }) => {
  // 首屏用 defaultContent 渲染（旧 localStorage 可能含 ProjectItem 等接口变更前的旧字段，
  // 例如没有 coverImg 的旧项目结构，会让用户刷新瞬间看到占位图）。
  // 权威源永远是 GitHub API → jsDelivr → localStorage 兜底，由下面 useEffect 异步加载。
  const [content, setContent] = useState<SiteContent>(defaultContent)
  const [loading, setLoading] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    loadInitial().then((c) => {
      if (cancelled) return
      setContent(c)
      setLoading(false)

      // 首屏渲染后，后台再用 GitHub API 拉一次最权威数据，如有更新则静默替换。
      // 这样用户先看到静态内容，不会因 GitHub API 慢而卡黑屏。
      if (isGitHubReady()) {
        loadFromGitHubApi().then((fresh) => {
          if (cancelled || !fresh) return
          setContent(fresh)
        })
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  // 用户主动保存：写入并弹成功/失败提示。
  // 保存成功后主动调 GitHub API 重新拉取最新数据 → setContent,
  // 保证本地 content 永远是 GitHub API 返回的真实数据(避免 jsDelivr CDN 缓存延迟/限流导致显示老数据)。
  // 收集 content 中所有指向本仓库 uploads 的图片/视频 URL（用于删除同步）。
  const collectAssetUrls = (obj: unknown, acc: Set<string> = new Set()): Set<string> => {
    const rawPrefix = `${githubConfig.rawBase}/public/assets/uploads/`
    const walk = (v: unknown) => {
      if (typeof v === 'string') {
        // 收集所有指向本仓库 uploads 的资源：同源绝对路径（/jack-portfolio/assets/uploads/X）、
        // 站点相对路径（/assets/uploads/X / assets/uploads/X）以及旧 raw 直连。
        if (
          v.includes('/assets/uploads/') ||
          v.startsWith('assets/uploads/') ||
          v.startsWith(rawPrefix)
        ) {
          acc.add(v)
        }
      } else if (Array.isArray(v)) {
        v.forEach(walk)
      } else if (v && typeof v === 'object') {
        Object.values(v).forEach(walk)
      }
    }
    walk(obj)
    return acc
  }

  const saveContent = async (value: SiteContent): Promise<boolean> => {
    const prevContent = content // 保存前的旧内容，用于比对被移除的资源
    setContent(value)
    setSaveStatus('saving')
    // 删除同步：找出本次被移除（不再被引用）的图片/视频 URL，
    // 并从 GitHub 仓库删除对应文件，避免仓库空间被无效图片占用。
    try {
      const prevUrls = collectAssetUrls(prevContent)
      const nextUrls = collectAssetUrls(value)
      const removed = [...prevUrls].filter((u) => !nextUrls.has(u))
      if (removed.length) {
        await Promise.all(removed.map((u) => deleteAsset(u).catch(() => {})))
      }
    } catch {
      /* 删除同步失败不影响主保存流程 */
    }
    const ok = await doPersist(value)
    if (ok) {
      setSaveStatus('success')
      setSaveError('')
      // 主动从 GitHub API 拉最新数据,覆盖本地 content。
      // 这样下次 AdminPage useEffect 同步 draft 时,draft 一定是 GitHub 源真实值。
      try {
        const fresh = await loadFromGitHubApi()
        if (fresh) setContent(fresh)
      } catch {
        /* 拉取失败不影响"保存成功"提示,下次刷新会再尝试 */
      }
    } else {
      setSaveStatus('error')
      setSaveError('保存到 GitHub 失败，请检查网络或重新加载页面后再试')
    }
    return ok
  }

  const clearSaveStatus = () => {
    setSaveStatus('idle')
    setSaveError('')
  }

  const resetContent = () => {
    setContent(defaultContent)
    doPersist(defaultContent)
  }

  const openProfile = () => setShowProfile(true)
  const closeProfile = () => setShowProfile(false)

  // 保存成功/失败提示 3 秒后自动消失
  useEffect(() => {
    if (saveStatus === 'success' || saveStatus === 'error') {
      const t = setTimeout(() => clearSaveStatus(), 3000)
      return () => clearTimeout(t)
    }
  }, [saveStatus])

  return (
    <ContentContext.Provider value={{ content, loading, showProfile, openProfile, closeProfile, updateSection, updateField, setFullContent, resetContent, saveContent, saveStatus, saveError, clearSaveStatus }}>
      {loading ? (
        // 加载占位：避免首屏渲染 defaultContent 导致内容闪烁（例如默认 bannerText 是
        // "Every Match Feels Better with Wanbo"，用户刷新时会先看到 Wanbo 文案 1-2 秒，
        // 然后才切换到真实 portfolio 内容）。统一改成 loading 占位直到 GitHub API 拿到数据。
        <div
          role="status"
          aria-live="polite"
          aria-label="加载中"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0C0C0C] text-[#D7E2EA]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D7E2EA] animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D7E2EA] animate-pulse" style={{ animationDelay: '180ms' }} />
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#D7E2EA] animate-pulse" style={{ animationDelay: '360ms' }} />
          </div>
          <p className="mt-5 text-xs sm:text-sm tracking-[0.3em] uppercase text-[#D7E2EA]/55">
            Loading
          </p>
        </div>
      ) : (
        children
      )}
    </ContentContext.Provider>
  )
}

export const useContent = () => {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used within ContentProvider')
  return ctx
}
