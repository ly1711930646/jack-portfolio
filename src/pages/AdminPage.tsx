import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useContent, mergeWithDefault } from '../context/ContentContext'
import { logout } from './LoginPage'
import { isGitHubReady, uploadImage, uploadVideo, fetchImageBlobUrl } from '../lib/githubClient'
import { isCosReady } from '../lib/cosClient'
import type {
  HeroContent,
  MarqueeContent,
  AboutContent,
  ServicesContent,
  ProjectsContent,
  NavLink,
  ServiceItem,
  ProjectItem,
  SectionType,
  TabId,
  SiteContent,
} from '../content/siteContent'

const sectionLabels: Record<SectionType, string> = {
  marquee: '轮播栏',
  about: '关于我',
  services: '技能',
  projects: '作品集',
}

const tabLabels: Record<TabId, string> = {
  navbar: '顶部栏',
  banner: 'Banner',
  ...sectionLabels,
}

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full bg-[#161616] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#D7E2EA] placeholder:text-white/30 focus:outline-none focus:border-[#4A90FF] transition-colors"
  />
)

const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className="w-full bg-[#161616] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#D7E2EA] placeholder:text-white/30 focus:outline-none focus:border-[#4A90FF] transition-colors resize-y"
  />
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-medium text-white/60 uppercase tracking-wider mb-2">{children}</label>
)

const Card = ({ children, title }: { children: React.ReactNode; title?: string }) => (
  <div className="bg-[#111111] border border-white/10 rounded-2xl p-5 sm:p-6">
    {title && <h3 className="text-lg font-semibold mb-5 text-[#D7E2EA]">{title}</h3>}
    {children}
  </div>
)

// 后台专用图片：先尝试 raw 直连，失败则通过 GitHub API 拉取 blob URL 显示。
// 解决 raw.githubusercontent.com 在用户网络/沙箱中被拦截时预览空白的问题。
const AdminImage = ({ src, alt, className }: { src: string; alt?: string; className?: string }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setBlobUrl(null)
    setFailed(false)
  }, [src])

  const handleError = async () => {
    if (failed) return
    if (blobUrl) {
      setFailed(true)
      return
    }
    try {
      const url = await fetchImageBlobUrl(src)
      setBlobUrl(url)
    } catch {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-[#0C0C0C] text-white/30 text-xs ${className || ''}`}>
        预览失败
      </div>
    )
  }

  return (
    <img
      src={blobUrl || src}
      alt={alt || ''}
      className={className}
      onError={handleError}
    />
  )
}

const ImagePreview = ({ src, alt }: { src: string; alt?: string }) => (
  <div className="mt-2 rounded-xl overflow-hidden border border-white/10 bg-[#0C0C0C] w-full max-w-[200px]">
    <AdminImage src={src} alt={alt || ''} className="w-full h-auto object-cover" />
  </div>
)

// 通用「上传到 GitHub」按钮：浏览器直传图片/视频到仓库，成功后把绝对 URL 回写到对应字段
// 默认接受图片（accept='image/*'），视频场景需传 accept='video/*'，内部按 mime 自动选上传函数
// 传 multiple=true + onPickedBatch 可一次批量上传多张图片。
const GitHubAssetUploader = ({
  onPicked,
  onPickedBatch,
  label = '上传到 GitHub',
  accept = 'image/*',
  multiple = false,
}: {
  value?: string
  onPicked?: (url: string) => void
  onPickedBatch?: (urls: string[]) => void
  label?: string
  accept?: string
  multiple?: boolean
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [err, setErr] = useState('')

  // 未配置任何图床时仍显示按钮，但禁用并提示用户去配置 token
  const ready = isGitHubReady() || isCosReady()
  // 实际使用的图床后端：优先 COS，其次 GitHub
  const usingCos = isCosReady()
  const usingGh = isGitHubReady() && !isCosReady()

  const uploadOne = async (file: File): Promise<string> => {
    return file.type.startsWith('video/') ? uploadVideo(file) : uploadImage(file)
  }

  // 限制并发数，避免 GitHub API 因瞬时请求过多被限流
  const runWithConcurrency = async <T,>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> => {
    const results: T[] = new Array(tasks.length)
    const iter = tasks.entries()
    const workers = Array.from({ length: limit }, async () => {
      for (const [idx, task] of iter) {
        results[idx] = await task()
      }
    })
    await Promise.all(workers)
    return results
  }

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    if (!ready) {
      setErr('未配置 GitHub Token / 腾讯云 COS，请在仓库 Settings → Secrets 中配置 GH_TOKEN 后重新部署')
      return
    }

    // 单文件模式
    if (!multiple) {
      const file = files[0]
      setBusy(true)
      setErr('')
      try {
        const url = await uploadOne(file)
        onPicked?.(url)
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : '上传失败')
      } finally {
        setBusy(false)
      }
      return
    }

    // 批量模式：每张图单独捕获错误，成功的自动填入，失败的单独提示
    setBusy(true)
    setErr('')
    setProgress(`上传中（0/${files.length}）…`)
    const successes: string[] = []
    const failures: string[] = []
    try {
      const tasks = files.map((file, i) => async () => {
        try {
          const url = await uploadOne(file)
          successes.push(url)
        } catch (e: unknown) {
          failures.push(`${file.name}: ${e instanceof Error ? e.message : '失败'}`)
        }
        setProgress(`上传中（${i + 1}/${files.length}）…`)
      })
      // GitHub Contents API 在并发写同一分支时会因引用竞争返回 409，
      // 所以 GitHub 后端必须串行；COS 后端可保持并发。
      await runWithConcurrency(tasks, usingCos ? 3 : 1)
      if (successes.length > 0) onPickedBatch?.(successes)
      if (failures.length > 0) setErr(`成功 ${successes.length}/${files.length} 张；失败：${failures.join('; ')}`)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '批量上传失败')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || !ready}
        className="text-xs text-[#4A90FF] hover:text-[#5C9CFF] font-medium disabled:opacity-50"
      >
        {busy ? (progress || '上传中…') : label}
      </button>
      <span className={`text-xs ${usingCos ? 'text-green-400/80' : usingGh ? 'text-[#4A90FF]/70' : 'text-white/30'}`}>
        {usingCos ? '腾讯云 COS' : usingGh ? 'GitHub' : '未配置上传后端'}
      </span>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handle} multiple={multiple} />
      {err && <span className="text-xs text-red-400">{err}</span>}
    </div>
  )
}

// 背景视频 URL 状态提示:帮助识别当前值是不是 GitHub 上传的视频,避免被 Mux/云存储等第三方 URL 覆盖
const BannerVideoStatus = ({ url }: { url: string }) => {
  if (!url) return null
  const isCos = url.includes('myqcloud.com')
  const isRaw = url.includes('raw.githubusercontent.com')
  const isServed = url.includes('/assets/uploads/')
  const isJsdelivr = url.includes('jsdelivr') || url.includes('zzko.cn')
  const isThirdPartyCdn = /(cloudfront\.net|mux\.com|googleapis\.com|amazonaws\.com|higgs\.ai)/.test(url)
  if (isCos) {
    return (
      <p className="mt-2 text-xs text-green-400/80">
        ✓ 已使用腾讯云 COS（国内稳定直连，链接固定不随部署变化）
      </p>
    )
  }
  if (isRaw || isServed) {
    return (
      <p className="mt-2 text-xs text-green-400/80">
        ✓ 已使用 GitHub 同源托管（/jack-portfolio/assets/uploads），稳定可靠，删除时自动同步清理仓库文件
      </p>
    )
  }
  if (isJsdelivr) {
    return (
      <p className="mt-2 text-xs text-yellow-400/80">
        ⚠️ 第三方 jsDelivr 镜像链接，可能不稳定；建议用「上传视频」按钮直传，自动生成 GitHub 直连地址。
      </p>
    )
  }
  if (isThirdPartyCdn) {
    return (
      <p className="mt-2 text-xs text-yellow-400/80">
        ⚠️ 第三方 CDN 链接（cloudfront / mux / 其它），可能加载慢或被墙。建议用「上传视频」按钮直传，自动生成 GitHub 直连地址。
      </p>
    )
  }
  return (
    <p className="mt-2 text-xs text-white/40">
      非云存储上传的链接，如加载慢/失败，建议用下方「上传视频」按钮直传。
    </p>
  )
}

// 通用复制按钮:点击后把 value 写入剪贴板,1.8s 内显示 ✓ 已复制反馈
// 用 navigator.clipboard + 老式 textarea fallback 兼容老浏览器/HTTP 上下文
const CopyButton = ({ value, label = '复制链接' }: { value: string; label?: string }) => {
  const [copied, setCopied] = useState(false)
  const handle = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        // 老浏览器兜底
        const ta = document.createElement('textarea')
        ta.value = value
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try { document.execCommand('copy') } catch { /* ignore */ }
        document.body.removeChild(ta)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 用户拒绝授权等异常,忽略 */
    }
  }
  return (
    <button
      type="button"
      onClick={handle}
      className={`shrink-0 px-3.5 text-xs font-medium rounded-lg border transition-colors ${
        copied
          ? 'border-green-400/50 text-green-400 bg-green-400/10'
          : 'border-white/10 text-[#4A90FF] hover:text-[#5C9CFF] hover:border-[#4A90FF]/50'
      }`}
    >
      {copied ? '✓ 已复制' : label}
    </button>
  )
}

const NavbarEditor = ({ hero, onChange }: { hero: HeroContent; onChange: (v: HeroContent) => void }) => {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const updateLink = (index: number, field: keyof NavLink, value: string) => {
    const next = [...hero.navLinks]
    next[index] = { ...next[index], [field]: value }
    onChange({ ...hero, navLinks: next })
  }

  const moveLink = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = [...hero.navLinks]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)
    onChange({ ...hero, navLinks: next })
  }

  const addLink = () => onChange({ ...hero, navLinks: [...hero.navLinks, { label: '', href: '' }] })
  const removeLink = (index: number) => {
    const next = [...hero.navLinks]
    next.splice(index, 1)
    onChange({ ...hero, navLinks: next })
  }

  return (
    <div className="space-y-6">
      <Card title="品牌与按钮">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label>Logo / 品牌名</Label>
            <Input value={hero.logo} onChange={(e) => onChange({ ...hero, logo: e.target.value })} />
          </div>
          <div>
            <Label>CTA 按钮文字</Label>
            <Input value={hero.ctaText} onChange={(e) => onChange({ ...hero, ctaText: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card title="导航链接">
        <div className="space-y-3">
          {hero.navLinks.map((link, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(i))
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(i)
              }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => {
                e.preventDefault()
                const fromIndex = Number(e.dataTransfer.getData('text/plain'))
                moveLink(fromIndex, i)
                setDragOverIndex(null)
              }}
              onDragEnd={() => setDragOverIndex(null)}
              className={`flex gap-3 items-center rounded-xl p-2 transition-colors ${
                dragOverIndex === i ? 'bg-white/10' : ''
              }`}
            >
              <span className="cursor-grab active:cursor-grabbing text-white/40 px-1">⋮⋮</span>
              <Input placeholder="文字" value={link.label} onChange={(e) => updateLink(i, 'label', e.target.value)} />
              <Input placeholder="锚点 #xxx" value={link.href} onChange={(e) => updateLink(i, 'href', e.target.value)} />
              <button onClick={() => removeLink(i)} className="text-sm text-red-400 hover:text-red-300 px-3 py-2">删除</button>
            </div>
          ))}
          <button onClick={addLink} className="text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium">+ 添加链接</button>
        </div>
      </Card>
    </div>
  )
}

const BannerEditor = ({ hero, onChange }: { hero: HeroContent; onChange: (v: HeroContent) => void }) => {
  const [titleFieldOrder, setTitleFieldOrder] = useState(['size', 'lineHeight', 'weight', 'color'])
  const [subtitleFieldOrder, setSubtitleFieldOrder] = useState(['size', 'lineHeight', 'weight', 'color'])
  const [buttonFieldOrder, setButtonFieldOrder] = useState(['bgColor', 'textColor', 'fontSize', 'fontWeight'])

  const weightOptions = [
    { value: '100', label: 'Thin (100)' },
    { value: '200', label: 'Extra Light (200)' },
    { value: '300', label: 'Light (300)' },
    { value: '400', label: 'Normal (400)' },
    { value: '500', label: 'Medium (500)' },
    { value: '600', label: 'Semi Bold (600)' },
    { value: '700', label: 'Bold (700)' },
    { value: '800', label: 'Extra Bold (800)' },
    { value: '900', label: 'Black (900)' },
  ]

  const ColorInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div className="flex items-center gap-3">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent p-0" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 bg-transparent border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:border-[#4A90FF]/50 focus:outline-none transition-colors" placeholder={placeholder || '#FFFFFF'} />
    </div>
  )

  const WeightSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-[#0C0C0C] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors">
      {weightOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  // Reusable draggable field row
  const DraggableField = ({
    fieldId,
    dragOver,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    children,
  }: {
    fieldId: string
    dragOver: boolean
    onDragStart: () => void
    onDragOver: (e: React.DragEvent) => void
    onDragLeave: () => void
    onDrop: (e: React.DragEvent) => void
    children: React.ReactNode
  }) => (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', fieldId); e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e) }}
      onDragLeave={() => onDragLeave()}
      onDrop={(e) => { e.preventDefault(); onDrop(e) }}
      className={`flex items-start gap-3 rounded-xl p-3 border border-transparent hover:border-white/10 transition-all ${dragOver ? 'bg-white/10 border-[#4A90FF]/30' : ''}`}
    >
      <span className="cursor-grab active:cursor-grabbing text-white/30 mt-2.5 select-none shrink-0">⠿</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )

  // Helper to reorder a field list
  const moveField = (order: string[], setOrder: React.Dispatch<React.SetStateAction<string[]>>, fromId: string, toId: string) => {
    if (fromId === toId) return
    const next = [...order]
    const fromIndex = next.indexOf(fromId)
    const toIndex = next.indexOf(toId)
    next.splice(fromIndex, 1)
    next.splice(toIndex, 0, fromId)
    setOrder(next)
  }

  // Title fields definition
  const titleFields: Record<string, React.ReactNode> = {
    size: (
      <div>
        <label className="text-xs text-white/50 block mb-2">主标题文字大小 (px)</label>
        <input type="number" min={12} max={300} value={hero.bannerTextSize}
          onChange={(e) => onChange({ ...hero, bannerTextSize: e.target.value })}
          className="w-full bg-transparent border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors" />
      </div>
    ),
    lineHeight: (
      <div>
        <label className="text-xs text-white/50 block mb-2">主标题行间距</label>
        <input type="number" min={1} max={3} step={0.1} value={hero.bannerTextLineHeight}
          onChange={(e) => onChange({ ...hero, bannerTextLineHeight: e.target.value })}
          className="w-full bg-transparent border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors" />
      </div>
    ),
    weight: (
      <div><label className="text-xs text-white/50 block mb-2">主标题粗细</label><WeightSelect value={hero.bannerTextWeight} onChange={(v) => onChange({ ...hero, bannerTextWeight: v })} /></div>
    ),
    color: (
      <div><label className="text-xs text-white/50 block mb-2">主标题颜色</label><ColorInput value={hero.bannerTextColor} onChange={(v) => onChange({ ...hero, bannerTextColor: v })} placeholder="#FFFFFF" /></div>
    ),
  }

  // Subtitle fields definition
  const subtitleFields: Record<string, React.ReactNode> = {
    size: (
      <div>
        <label className="text-xs text-white/50 block mb-2">副标题文字大小 (px)</label>
        <input type="number" min={12} max={80} value={hero.bannerSubtitleSize}
          onChange={(e) => onChange({ ...hero, bannerSubtitleSize: e.target.value })}
          className="w-full bg-transparent border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors" />
      </div>
    ),
    lineHeight: (
      <div>
        <label className="text-xs text-white/50 block mb-2">副标题行间距</label>
        <input type="number" min={1} max={3} step={0.1} value={hero.bannerSubtitleLineHeight}
          onChange={(e) => onChange({ ...hero, bannerSubtitleLineHeight: e.target.value })}
          className="w-full bg-transparent border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors" />
      </div>
    ),
    weight: (
      <div><label className="text-xs text-white/50 block mb-2">副标题粗细</label><WeightSelect value={hero.bannerSubtitleWeight} onChange={(v) => onChange({ ...hero, bannerSubtitleWeight: v })} /></div>
    ),
    color: (
      <div><label className="text-xs text-white/50 block mb-2">副标题颜色</label><ColorInput value={hero.bannerSubtitleColor} onChange={(v) => onChange({ ...hero, bannerSubtitleColor: v })} placeholder="#FFFFFF" /></div>
    ),
  }

  // Button fields definition
  const buttonFields: Record<string, React.ReactNode> = {
    bgColor: (
      <div><label className="text-xs text-white/50 block mb-2">按钮颜色</label><ColorInput value={hero.bannerButtonColor} onChange={(v) => onChange({ ...hero, bannerButtonColor: v })} placeholder="#C8A575" /></div>
    ),
    textColor: (
      <div><label className="text-xs text-white/50 block mb-2">按钮文字颜色</label><ColorInput value={hero.bannerButtonTextColor} onChange={(v) => onChange({ ...hero, bannerButtonTextColor: v })} placeholder="#FFFFFF" /></div>
    ),
    fontSize: (
      <div>
        <label className="text-xs text-white/50 block mb-2">按钮文字大小 (px)</label>
        <input type="number" min={10} max={40} value={hero.bannerButtonFontSize}
          onChange={(e) => onChange({ ...hero, bannerButtonFontSize: e.target.value })}
          className="w-full bg-transparent border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors" />
      </div>
    ),
    fontWeight: (
      <div><label className="text-xs text-white/50 block mb-2">按钮文字粗细</label><WeightSelect value={hero.bannerButtonFontWeight} onChange={(v) => onChange({ ...hero, bannerButtonFontWeight: v })} /></div>
    ),
  }

  const [dragOverTitleField, setDragOverTitleField] = useState<string | null>(null)
  const [dragOverSubtitleField, setDragOverSubtitleField] = useState<string | null>(null)
  const [dragOverButtonField, setDragOverButtonField] = useState<string | null>(null)

  const BannerPreview = ({ hero, onChange }: { hero: HeroContent; onChange: (v: HeroContent) => void }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)
    const [dragging, setDragging] = useState(false)
    const dragStartY = useRef(0)
    const dragStartOffset = useRef(0)

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const update = () => setScale(el.clientWidth / 1280)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    const bannerFontSize = parseInt(hero.bannerTextSize) || 18
    const bannerLineHeight = parseFloat(hero.bannerTextLineHeight) || 1.2
    const bannerFontWeight = parseInt(hero.bannerTextWeight) || 700
    const subtitleFontSize = parseInt(hero.bannerSubtitleSize) || 18
    const subtitleColor = hero.bannerSubtitleColor || '#FFFFFF'
    const subtitleLineHeight = parseFloat(hero.bannerSubtitleLineHeight) || 1.6
    const subtitleFontWeight = parseInt(hero.bannerSubtitleWeight) || 300
    const buttonColor = hero.bannerButtonColor || '#C8A575'
    const buttonTextColor = hero.bannerButtonTextColor || '#FFFFFF'
    const buttonFontSize = parseInt(hero.bannerButtonFontSize) || 14
    const buttonFontWeight = parseInt(hero.bannerButtonFontWeight) || 500

    const referenceHeight = 720

    return (
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-white/10 bg-[#0C0C0C] relative"
        style={{ height: referenceHeight * scale }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: 1280, height: referenceHeight, transform: `scale(${scale})` }}
        >
          {/* Background */}
          {hero.bannerVideo ? (
            <video
              src={hero.bannerVideo}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : hero.bannerImage ? (
            <img
              src={hero.bannerImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#162536] via-[#0C0C0C] to-[#0a0a0a]" />
          )}
          <div className="absolute inset-0 bg-black/40" />

          {/* Content — draggable in preview */}
          <div
            className="absolute inset-x-0 top-[6%] flex items-start justify-center px-20"
            style={{ transform: `translateY(${parseInt(hero.bannerContentOffsetY || '0')}px)` }}
            onPointerDown={(e) => {
              e.preventDefault()
              setDragging(true)
              dragStartY.current = e.clientY
              dragStartOffset.current = parseInt(hero.bannerContentOffsetY || '0')
              const el = e.currentTarget
              el.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!dragging) return
              const deltaPx = (e.clientY - dragStartY.current) / scale
              const nextOffset = Math.round(dragStartOffset.current + deltaPx)
              onChange({ ...hero, bannerContentOffsetY: String(nextOffset) })
            }}
            onPointerUp={(e) => {
              setDragging(false)
              e.currentTarget.releasePointerCapture(e.pointerId)
            }}
          >
            <div className={`text-center relative ${dragging ? 'cursor-grabbing' : 'cursor-grab'} group`} style={{ width: 'fit-content', maxWidth: '100%' }}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-white/40 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                拖动调整位置
              </div>
              {hero.bannerText && (
                <h1
                  className="whitespace-nowrap"
                  style={{
                    fontSize: `${Math.max(32, bannerFontSize)}px`,
                    color: hero.bannerTextColor,
                    lineHeight: bannerLineHeight,
                    fontWeight: bannerFontWeight,
                  }}
                >
                  {hero.bannerText}
                </h1>
              )}
              {hero.bannerSubtitle && (
                <p
                  className="mt-5"
                  style={{
                    fontSize: `${subtitleFontSize}px`,
                    color: subtitleColor,
                    lineHeight: subtitleLineHeight,
                    fontWeight: subtitleFontWeight,
                  }}
                >
                  {hero.bannerSubtitle}
                </p>
              )}
              {hero.bannerButtonText && (
                <button
                  className="mt-5 px-6 py-2 rounded-full"
                  style={{
                    backgroundColor: buttonColor,
                    color: buttonTextColor,
                    fontSize: `${buttonFontSize}px`,
                    fontWeight: buttonFontWeight,
                  }}
                >
                  {hero.bannerButtonText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card title="Banner 预览">
        <p className="text-xs text-white/40 mb-3">实时预览（按 1280×720 视口比例缩放，文字过大会自动截断）。在预览图中按住文字/按钮可上下拖动调整位置。</p>
        <BannerPreview hero={hero} onChange={onChange} />
        <div className="mt-4 flex items-center gap-3">
          <label className="text-xs text-white/50 whitespace-nowrap">垂直偏移（px）</label>
          <input
            type="number"
            value={hero.bannerContentOffsetY || '0'}
            onChange={(e) => onChange({ ...hero, bannerContentOffsetY: e.target.value })}
            className="w-24 bg-transparent border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#4A90FF]/50 focus:outline-none transition-colors"
          />
          <span className="text-xs text-white/30">正数向下，负数向上</span>
        </div>
      </Card>

      <Card title="人像图片">
        <p className="text-xs text-white/40 mb-3">Mathew header 风格首页中央的大人像。建议上传带透明背景的 PNG 半身照，效果最佳；JPG 也可正常显示。</p>
        <Input
          placeholder="https://example.com/portrait.png（留空则不显示）"
          value={hero.portraitImage}
          onChange={(e) => onChange({ ...hero, portraitImage: e.target.value })}
        />
        <GitHubAssetUploader value={hero.portraitImage} onPicked={(u) => onChange({ ...hero, portraitImage: u })} />
        {hero.portraitImage && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-[#0C0C0C] flex justify-center">
            <img src={hero.portraitImage} alt="人像预览" className="w-auto h-auto max-h-[400px] object-contain" />
          </div>
        )}
      </Card>

      <Card title="背景图片">
        <p className="text-xs text-white/40 mb-3">支持 JPG / PNG / GIF / WebP 等格式，填 URL 或点下方按钮直传（已配腾讯云 COS 则直传 COS，否则直传 GitHub，均为国内可直连）。当前新首页主要使用「人像图片」，背景图片已被替代。</p>
        <Input
          placeholder="https://example.com/bg.jpg（留空则不显示）"
          value={hero.bannerImage}
          onChange={(e) => onChange({ ...hero, bannerImage: e.target.value })}
        />
        <GitHubAssetUploader value={hero.bannerImage} onPicked={(u) => onChange({ ...hero, bannerImage: u })} />
        {hero.bannerImage && (
          <div className="mt-4 rounded-xl overflow-hidden border border-white/10 bg-[#0C0C0C]">
            <img src={hero.bannerImage} alt="Banner 预览" className="w-full h-auto max-h-[400px] object-cover" />
          </div>
        )}
      </Card>

      <Card title="背景视频">
        <p className="text-xs text-white/40 mb-3">支持 MP4 / WebM 格式，填入视频 URL 或点下方按钮直传（腾讯云 COS / GitHub）。视频优先于图片显示。</p>
        <div className="flex gap-2">
          <input
            placeholder="https://example.com/video.mp4（留空则不显示）"
            value={hero.bannerVideo}
            onChange={(e) => onChange({ ...hero, bannerVideo: e.target.value })}
            className="flex-1 min-w-0 bg-[#161616] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#D7E2EA] placeholder:text-white/30 focus:outline-none focus:border-[#4A90FF] transition-colors"
          />
          {hero.bannerVideo && <CopyButton value={hero.bannerVideo} />}
        </div>
        {hero.bannerVideo && (
          <BannerVideoStatus url={hero.bannerVideo} />
        )}
        <GitHubAssetUploader
          value={hero.bannerVideo}
          accept="video/mp4,video/webm,video/quicktime,video/*"
          label="上传视频到 GitHub"
          onPicked={(u) => onChange({ ...hero, bannerVideo: u })}
        />
        {hero.bannerVideo && (
          <video src={hero.bannerVideo} controls autoPlay muted loop playsInline className="mt-4 rounded-xl border border-white/10 bg-[#0C0C0C] w-full max-h-[400px]">
            您的浏览器不支持视频播放
          </video>
        )}
      </Card>

      {/* ===== Banner 文案 ===== */}
      <Card title="Banner 文案">
        <p className="text-xs text-white/40 mb-3">主标题（对应截图中的大标题）</p>
        <textarea
          placeholder="输入 Banner 主标题"
          value={hero.bannerText}
          onChange={(e) => onChange({ ...hero, bannerText: e.target.value })}
          className="w-full bg-transparent border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 focus:border-[#4A90FF]/50 focus:outline-none transition-colors resize-y min-h-[80px]"
        />
        <div className="space-y-2 mt-4">
          {titleFieldOrder.map((fieldId) => (
            <DraggableField
              key={fieldId}
              fieldId={fieldId}
              dragOver={dragOverTitleField === fieldId}
              onDragStart={() => {}}
              onDragOver={(e) => { e.preventDefault(); setDragOverTitleField(fieldId) }}
              onDragLeave={() => setDragOverTitleField(null)}
              onDrop={(e) => {
                const fromId = e.dataTransfer.getData('text/plain')
                if (fromId && titleFieldOrder.includes(fromId)) moveField(titleFieldOrder, setTitleFieldOrder, fromId, fieldId)
                setDragOverTitleField(null)
              }}
            >
              {titleFields[fieldId]}
            </DraggableField>
          ))}
        </div>
      </Card>

      {/* ===== 副标题 ===== */}
      <Card title="副标题">
        <p className="text-xs text-white/40 mb-3">副标题（对应截图中主标题下方的小字）</p>
        <Input
          placeholder="输入副标题（留空则不显示）"
          value={hero.bannerSubtitle}
          onChange={(e) => onChange({ ...hero, bannerSubtitle: e.target.value })}
        />
        <div className="space-y-2 mt-4">
          {subtitleFieldOrder.map((fieldId) => (
            <DraggableField
              key={fieldId}
              fieldId={fieldId}
              dragOver={dragOverSubtitleField === fieldId}
              onDragStart={() => {}}
              onDragOver={(e) => { e.preventDefault(); setDragOverSubtitleField(fieldId) }}
              onDragLeave={() => setDragOverSubtitleField(null)}
              onDrop={(e) => {
                const fromId = e.dataTransfer.getData('text/plain')
                if (fromId && subtitleFieldOrder.includes(fromId)) moveField(subtitleFieldOrder, setSubtitleFieldOrder, fromId, fieldId)
                setDragOverSubtitleField(null)
              }}
            >
              {subtitleFields[fieldId]}
            </DraggableField>
          ))}
        </div>
      </Card>

      {/* ===== 按钮 ===== */}
      <Card title="按钮">
        <p className="text-xs text-white/40 mb-3">CTA 按钮（对应截图中的 Fit Your Space 按钮）</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-white/50 block mb-2">按钮文字</label>
            <Input placeholder="输入按钮文字（留空则不显示）" value={hero.bannerButtonText} onChange={(e) => onChange({ ...hero, bannerButtonText: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-2">按钮链接</label>
            <Input placeholder="#contact 或 https://..." value={hero.bannerButtonLink} onChange={(e) => onChange({ ...hero, bannerButtonLink: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          {buttonFieldOrder.map((fieldId) => (
            <DraggableField
              key={fieldId}
              fieldId={fieldId}
              dragOver={dragOverButtonField === fieldId}
              onDragStart={() => {}}
              onDragOver={(e) => { e.preventDefault(); setDragOverButtonField(fieldId) }}
              onDragLeave={() => setDragOverButtonField(null)}
              onDrop={(e) => {
                const fromId = e.dataTransfer.getData('text/plain')
                if (fromId && buttonFieldOrder.includes(fromId)) moveField(buttonFieldOrder, setButtonFieldOrder, fromId, fieldId)
                setDragOverButtonField(null)
              }}
            >
              {buttonFields[fieldId]}
            </DraggableField>
          ))}
        </div>
      </Card>
    </div>
  )
}

const MarqueeEditor = ({ marquee, onChange }: { marquee: MarqueeContent; onChange: (v: MarqueeContent) => void }) => {
  const updateImage = (row: 'row1' | 'row2', index: number, value: string) => {
    const next = [...marquee[row]]
    next[index] = value
    onChange({ ...marquee, [row]: next })
  }

  const addImage = (row: 'row1' | 'row2') => onChange({ ...marquee, [row]: [...marquee[row], ''] })
  const removeImage = (row: 'row1' | 'row2', index: number) => {
    const next = [...marquee[row]]
    next.splice(index, 1)
    onChange({ ...marquee, [row]: next })
  }

  return (
    <div className="space-y-6">
      <Card title="Row 1（向右滚动）">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {marquee.row1.map((src, i) => (
            <div key={i} className="bg-[#0C0C0C] rounded-xl border border-white/10 p-3">
              <Input value={src} onChange={(e) => updateImage('row1', i, e.target.value)} />
              <GitHubAssetUploader value={src} onPicked={(u) => updateImage('row1', i, u)} />
              <ImagePreview src={src} />
              <button onClick={() => removeImage('row1', i)} className="mt-2 text-xs text-red-400 hover:text-red-300">删除</button>
            </div>
          ))}
        </div>
        <button onClick={() => addImage('row1')} className="mt-4 text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium">+ 添加图片</button>
      </Card>

      <Card title="Row 2（向左滚动）">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {marquee.row2.map((src, i) => (
            <div key={i} className="bg-[#0C0C0C] rounded-xl border border-white/10 p-3">
              <Input value={src} onChange={(e) => updateImage('row2', i, e.target.value)} />
              <GitHubAssetUploader value={src} onPicked={(u) => updateImage('row2', i, u)} />
              <ImagePreview src={src} />
              <button onClick={() => removeImage('row2', i)} className="mt-2 text-xs text-red-400 hover:text-red-300">删除</button>
            </div>
          ))}
        </div>
        <button onClick={() => addImage('row2')} className="mt-4 text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium">+ 添加图片</button>
      </Card>
    </div>
  )
}

const AboutEditor = ({ about, onChange }: { about: AboutContent; onChange: (v: AboutContent) => void }) => {
  const photoInputRef = useRef<HTMLInputElement>(null)

  const updateDecorative = (key: keyof AboutContent['decorativeImages'], value: string) => {
    onChange({ ...about, decorativeImages: { ...about.decorativeImages, [key]: value } })
  }

  const updateProfile = <K extends keyof AboutContent['profile']>(key: K, value: AboutContent['profile'][K]) => {
    onChange({ ...about, profile: { ...about.profile, [key]: value } })
  }

  const compressImage = (file: File, maxWidth = 800, quality = 0.85): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const scale = Math.min(1, maxWidth / img.width)
          canvas.width = Math.floor(img.width * scale)
          canvas.height = Math.floor(img.height * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('canvas error'))
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', quality))
        }
        img.onerror = reject
        img.src = String(e.target?.result)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      e.target.value = ''
      return
    }
    try {
      const base64 = await compressImage(file)
      updateProfile('photo', base64)
    } catch {
      alert('图片处理失败，请换一张试试')
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <Card title="文案">
        <div>
          <Label>标题</Label>
          <Input value={about.title} onChange={(e) => onChange({ ...about, title: e.target.value })} />
        </div>
        <div className="mt-5">
          <Label>段落</Label>
          <TextArea rows={5} value={about.text} onChange={(e) => onChange({ ...about, text: e.target.value })} />
        </div>
      </Card>

      <Card title="个人资料（弹窗内容）">
        <div className="space-y-5">
          <div>
            <Label>照片</Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <div
              onClick={() => photoInputRef.current?.click()}
              className="group relative w-full max-w-[180px] aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-[#0C0C0C] cursor-pointer"
            >
              {about.profile.photo ? (
                <img
                  src={about.profile.photo}
                  alt="照片预览"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-xs">点击上传</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-sm font-medium text-white">{about.profile.photo ? '更换图片' : '上传图片'}</span>
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">支持 JPG / PNG，会自动压缩到宽度 800px 以内</p>
          </div>

            <div>
              <Label>或填写图片 URL</Label>
              <Input
                placeholder="https://example.com/photo.jpg（留空则显示姓名首字母占位）"
                value={about.profile.photo}
                onChange={(e) => updateProfile('photo', e.target.value)}
              />
              <GitHubAssetUploader value={about.profile.photo} onPicked={(u) => updateProfile('photo', u)} />
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label>姓名</Label>
              <Input value={about.profile.name} onChange={(e) => updateProfile('name', e.target.value)} />
            </div>
            <div>
              <Label>职位 / 身份</Label>
              <Input value={about.profile.role} onChange={(e) => updateProfile('role', e.target.value)} />
            </div>
            <div>
              <Label>性别</Label>
              <Input value={about.profile.gender} onChange={(e) => updateProfile('gender', e.target.value)} />
            </div>
            <div>
              <Label>年龄</Label>
              <Input value={about.profile.age} onChange={(e) => updateProfile('age', e.target.value)} />
            </div>
            <div>
              <Label>邮箱</Label>
              <Input value={about.profile.email} onChange={(e) => updateProfile('email', e.target.value)} />
            </div>
            <div>
              <Label>电话</Label>
              <Input value={about.profile.phone} onChange={(e) => updateProfile('phone', e.target.value)} />
            </div>
            <div>
              <Label>服务方向 / 求职方向</Label>
              <Input value={about.profile.jobTarget} onChange={(e) => updateProfile('jobTarget', e.target.value)} />
            </div>
            <div>
              <Label>工作经验</Label>
              <Input value={about.profile.experience} onChange={(e) => updateProfile('experience', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>所在地</Label>
              <Input value={about.profile.location} onChange={(e) => updateProfile('location', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>个人简介</Label>
              <TextArea rows={4} value={about.profile.bio} onChange={(e) => updateProfile('bio', e.target.value)} />
            </div>
          </div>

          {/* Stats */}
          <div className="pt-5 border-t border-white/[0.08]">
            <Label>大数字统计（弹窗内 3 个）</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
              {(about.profile.stats || []).slice(0, 3).map((stat, i) => (
                <div key={i} className="bg-[#0C0C0C] border border-white/10 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs text-white/50 block mb-1.5">数值</label>
                    <Input
                      value={stat.value}
                      onChange={(e) => {
                        const next = [...(about.profile.stats || [])]
                        next[i] = { ...next[i], value: e.target.value }
                        updateProfile('stats', next)
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 block mb-1.5">标签</label>
                    <Input
                      value={stat.label}
                      onChange={(e) => {
                        const next = [...(about.profile.stats || [])]
                        next[i] = { ...next[i], label: e.target.value }
                        updateProfile('stats', next)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const next = [...(about.profile.stats || [])]
                if (next.length < 3) next.push({ value: '', label: '' })
                updateProfile('stats', next)
              }}
              className="mt-3 text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium disabled:opacity-40"
              disabled={(about.profile.stats || []).length >= 3}
            >
              + 添加统计
            </button>
          </div>

          {/* Tags */}
          <div className="pt-5 border-t border-white/[0.08]">
            <Label>底部标签</Label>
            <div className="flex flex-wrap gap-2 mt-3">
              {(about.profile.tags || []).map((tag, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-[#0C0C0C] border border-white/10 rounded-full px-3 py-1.5">
                  <Input
                    value={tag}
                    onChange={(e) => {
                      const next = [...(about.profile.tags || [])]
                      next[i] = e.target.value
                      updateProfile('tags', next)
                    }}
                    className="!bg-transparent !border-none !px-0 !py-0 min-w-[80px] w-auto"
                  />
                  <button
                    onClick={() => {
                      const next = [...(about.profile.tags || [])]
                      next.splice(i, 1)
                      updateProfile('tags', next)
                    }}
                    className="text-white/40 hover:text-red-400 text-xs leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const next = [...(about.profile.tags || []), '']
                updateProfile('tags', next)
              }}
              className="mt-3 text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium"
            >
              + 添加标签
            </button>
          </div>

          {/* Work Experience */}
          <div className="pt-5 border-t border-white/[0.08]">
            <Label>工作经历（弹窗底部时间线）</Label>
            <div className="space-y-4 mt-3">
              {(about.profile.workExperience || []).map((job, i) => (
                <div key={i} className="bg-[#0C0C0C] border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/50 block mb-1.5">时间范围</label>
                      <Input
                        value={job.period}
                        placeholder="2023.04 - 至今"
                        onChange={(e) => {
                          const next = [...(about.profile.workExperience || [])]
                          next[i] = { ...next[i], period: e.target.value }
                          updateProfile('workExperience', next)
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/50 block mb-1.5">职位</label>
                      <Input
                        value={job.title}
                        onChange={(e) => {
                          const next = [...(about.profile.workExperience || [])]
                          next[i] = { ...next[i], title: e.target.value }
                          updateProfile('workExperience', next)
                        }}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-white/50 block mb-1.5">公司名称</label>
                      <Input
                        value={job.company}
                        onChange={(e) => {
                          const next = [...(about.profile.workExperience || [])]
                          next[i] = { ...next[i], company: e.target.value }
                          updateProfile('workExperience', next)
                        }}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs text-white/50 block mb-1.5">工作描述</label>
                      <TextArea
                        rows={2}
                        value={job.description}
                        onChange={(e) => {
                          const next = [...(about.profile.workExperience || [])]
                          next[i] = { ...next[i], description: e.target.value }
                          updateProfile('workExperience', next)
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = [...(about.profile.workExperience || [])]
                      next.splice(i, 1)
                      updateProfile('workExperience', next)
                    }}
                    className="text-xs text-red-400 hover:text-red-300 font-medium"
                  >
                    删除该经历
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const next = [
                  ...(about.profile.workExperience || []),
                  { period: '', company: '', title: '', description: '' },
                ]
                updateProfile('workExperience', next)
              }}
              className="mt-3 text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium"
            >
              + 添加工作经历
            </button>
          </div>
        </div>
      </Card>

      <Card title="装饰图片">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {Object.entries(about.decorativeImages).map(([key, src]) => (
            <div key={key}>
              <Label>{key}</Label>
              <Input value={src} onChange={(e) => updateDecorative(key as keyof AboutContent['decorativeImages'], e.target.value)} />
              <GitHubAssetUploader value={src} onPicked={(u) => updateDecorative(key as keyof AboutContent['decorativeImages'], u)} />
              <ImagePreview src={src} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

const ServicesEditor = ({ services, onChange }: { services: ServicesContent; onChange: (v: ServicesContent) => void }) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const updateItem = (index: number, field: keyof ServiceItem, value: string) => {
    const next = [...services.items]
    next[index] = { ...next[index], [field]: value }
    onChange({ ...services, items: next })
  }

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = [...services.items]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)
    onChange({ ...services, items: next })
  }

  const handleDragStart = (i: number) => {
    setDragIndex(i)
  }

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === i) return
    setDragOverIndex(i)
  }

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIndex === null) return
    moveItem(dragIndex, i)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const addItem = () => onChange({ ...services, items: [...services.items, { number: String(services.items.length + 1).padStart(2, '0'), name: '', description: '' }] })
  const removeItem = (index: number) => {
    const next = [...services.items]
    next.splice(index, 1)
    onChange({ ...services, items: next })
  }

  return (
    <div className="space-y-6">
      <Card title="标题">
        <Input value={services.title} onChange={(e) => onChange({ ...services, title: e.target.value })} />
      </Card>

      <Card title="服务列表">
        <div className="space-y-4">
          {services.items.map((item, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`bg-[#0C0C0C] rounded-xl border p-4 space-y-3 transition-all ${
                dragIndex === i ? 'opacity-50' : 'opacity-100'
              } ${
                dragOverIndex === i && dragOverIndex !== dragIndex
                  ? 'border-[#4A90FF] shadow-[0_0_0_1px_#4A90FF]'
                  : 'border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 pt-1 select-none" title="拖动排序">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="2" />
                    <circle cx="15" cy="6" r="2" />
                    <circle cx="9" cy="12" r="2" />
                    <circle cx="15" cy="12" r="2" />
                    <circle cx="9" cy="18" r="2" />
                    <circle cx="15" cy="18" r="2" />
                  </svg>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-20">
                      <Label>编号</Label>
                      <Input value={item.number} onChange={(e) => updateItem(i, 'number', e.target.value)} />
                    </div>
                    <div className="flex-1">
                      <Label>名称</Label>
                      <Input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>描述</Label>
                    <TextArea rows={3} value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
                  </div>
                </div>
              </div>
              <button onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-300 ml-7">删除服务</button>
            </div>
          ))}
          <button onClick={addItem} className="text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium">+ 添加服务</button>
        </div>
      </Card>
    </div>
  )
}

const ProjectsEditor = ({ projects, onChange }: { projects: ProjectsContent; onChange: (v: ProjectsContent) => void }) => {
  const [newTab, setNewTab] = useState('')

  const updateItem = (index: number, field: keyof ProjectItem, value: string) => {
    const next = [...projects.items]
    if (field === 'tags') {
      // 分类标签用逗号分隔，存为 string[]
      const tags = value
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      next[index] = { ...next[index], tags }
    } else {
      next[index] = { ...next[index], [field]: value }
    }
    onChange({ ...projects, items: next })
  }

  const addItem = () =>
    onChange({
      ...projects,
      items: [
        ...projects.items,
        {
          number: String(projects.items.length + 1).padStart(2, '0'),
          name: '',
          category: '',
          tags: [],
        },
      ],
    })

  const removeItem = (index: number) => {
    const next = [...projects.items]
    next.splice(index, 1)
    onChange({ ...projects, items: next })
  }

  const addImages = (index: number, urls: string[]) => {
    const next = [...projects.items]
    next[index] = { ...next[index], images: [...(next[index].images ?? []), ...urls] }
    onChange({ ...projects, items: next })
  }

  const removeImage = (index: number, imgIndex: number) => {
    const next = [...projects.items]
    const images = [...(next[index].images ?? [])]
    images.splice(imgIndex, 1)
    next[index] = { ...next[index], images }
    onChange({ ...projects, items: next })
  }

  const moveImage = (index: number, imgIndex: number, direction: 'up' | 'down') => {
    const next = [...projects.items]
    const images = [...(next[index].images ?? [])]
    const target = direction === 'up' ? imgIndex - 1 : imgIndex + 1
    if (target < 0 || target >= images.length) return
    const temp = images[imgIndex]
    images[imgIndex] = images[target]
    images[target] = temp
    next[index] = { ...next[index], images }
    onChange({ ...projects, items: next })
  }

  return (
    <div className="space-y-6">
      <Card title="标题">
        <Input value={projects.title} onChange={(e) => onChange({ ...projects, title: e.target.value })} />
      </Card>

      <Card title="选项栏(分类标签)">
        <p className="text-xs text-white/40 mb-3">第一个标签默认作为「全部」用于展示所有项目；其余标签用于筛选对应分类。</p>

        <div className="space-y-2 mb-4">
          {(projects.filterTabs ?? []).length === 0 && (
            <p className="text-xs text-white/30">暂无分类标签</p>
          )}
          {(projects.filterTabs ?? []).map((tab, i) => (
            <div key={`${tab}-${i}`} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 bg-[#161616] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#D7E2EA] truncate">
                {tab}
              </span>
              {i === 0 && (
                <span className="text-xs text-white/40 px-2 shrink-0">全部</span>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = [...(projects.filterTabs ?? [])]
                  next.splice(i, 1)
                  onChange({ ...projects, filterTabs: next })
                }}
                className="shrink-0 text-xs text-red-400 hover:text-red-300 px-2 py-2"
              >
                删除
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newTab}
            onChange={(e) => setNewTab(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const label = newTab.trim()
                if (!label) return
                onChange({
                  ...projects,
                  filterTabs: [...(projects.filterTabs ?? []), label],
                })
                setNewTab('')
              }
            }}
            placeholder="输入新分类标签，按回车或点击添加"
          />
          <button
            type="button"
            onClick={() => {
              const label = newTab.trim()
              if (!label) return
              onChange({
                ...projects,
                filterTabs: [...(projects.filterTabs ?? []), label],
              })
              setNewTab('')
            }}
            className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-[#4A90FF] text-white hover:bg-[#5C9CFF] transition-colors"
          >
            添加
          </button>
        </div>
      </Card>

      {projects.items.map((item, i) => (
        <Card key={i} title={`项目 ${item.number || i + 1}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <Label>编号</Label>
              <Input value={item.number} onChange={(e) => updateItem(i, 'number', e.target.value)} />
            </div>
            <div>
              <Label>名称</Label>
              <Input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
            </div>
            <div>
              <Label>类别</Label>
              <Input value={item.category} onChange={(e) => updateItem(i, 'category', e.target.value)} />
            </div>
            <div>
              <Label>分类标签</Label>
              <p className="text-xs text-white/40 mb-2">用于选项栏过滤，多个用逗号分隔。</p>
              <Input
                value={(item.tags ?? []).join(',')}
                onChange={(e) => updateItem(i, 'tags', e.target.value)}
                placeholder="UI设计, 跨境电商"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>主图(整块)</Label>
              <p className="text-xs text-white/40 mb-2">设置后该图将占满项目底部整块区域,代替左/右三栏布局;留空则降级到三栏。</p>
              <div className="flex gap-2">
                <input
                  placeholder="https://example.com/cover.jpg（留空则不显示,用三栏布局）"
                  value={item.coverImg || ''}
                  onChange={(e) => updateItem(i, 'coverImg', e.target.value)}
                  className="flex-1 min-w-0 bg-[#161616] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#D7E2EA] placeholder:text-white/30 focus:outline-none focus:border-[#4A90FF] transition-colors"
                />
                {item.coverImg && <CopyButton value={item.coverImg} />}
                {item.coverImg && (
                  <a
                    href={item.coverImg}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center justify-center px-3.5 text-xs font-medium rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
                    title="在新标签打开预览"
                  >
                    打开 ↗
                  </a>
                )}
              </div>
              <GitHubAssetUploader
                value={item.coverImg || ''}
                onPicked={(u) => updateItem(i, 'coverImg', u)}
                label="上传主图到 GitHub"
              />
              {item.coverImg && <ImagePreview src={item.coverImg} />}
            </div>

            <div className="sm:col-span-2">
              <Label>作品图片</Label>
              <p className="text-xs text-white/40 mb-3">
                前台点击「LIVE PROJECT」按钮后，会在弹窗里展示这些图片。可上传多张、调整顺序或删除。
              </p>

              {(item.images ?? []).length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                  {(item.images ?? []).map((src, imgIndex) => (
                    <div
                      key={`${src}-${imgIndex}`}
                      className="group relative rounded-xl overflow-hidden border border-white/10 bg-[#0C0C0C]"
                    >
                      <AdminImage
                        src={src}
                        alt={`作品 ${imgIndex + 1}`}
                        className="w-full h-24 sm:h-28 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveImage(i, imgIndex, 'up')}
                          disabled={imgIndex === 0}
                          className="p-1.5 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="上移"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(i, imgIndex, 'down')}
                          disabled={imgIndex === (item.images ?? []).length - 1}
                          className="p-1.5 rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="下移"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeImage(i, imgIndex)}
                          className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          title="删除"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <GitHubAssetUploader
                multiple
                onPickedBatch={(urls) => addImages(i, urls)}
                label="批量上传作品图片到 GitHub"
              />
            </div>

            {/* 三栏旧字段已彻底移除:前端只渲染 coverImg,后台也只剩主图字段,前后端一致 */}
          </div>
          <button onClick={() => removeItem(i)} className="mt-5 text-sm text-red-400 hover:text-red-300">删除项目</button>
        </Card>
      ))}
      <button onClick={addItem} className="text-sm text-[#4A90FF] hover:text-[#5C9CFF] font-medium">+ 添加项目</button>
    </div>
  )
}

const AdminPage = () => {
  const { content, saveContent, saveStatus, saveError } = useContent()
  // 关键：draft 必须 deep-clone content，不能用 useState(content) 直接传引用，
  // 否则后续 content 异步更新（比如 GitHub API 拿到数据 setContent）会导致 draft 自动跟着变，
  // 但 useState 的初始值只在 mount 时取一次。如果初始 content 是 defaultContent（loading 期间），
  // draft 会一直停在 defaultContent，保存时丢失所有从 GitHub 拿到的字段（如 coverImg）。
  const [draft, setDraft] = useState<SiteContent>(() => JSON.parse(JSON.stringify(content)))
  const [activeTab, setActiveTab] = useState<TabId>('navbar')
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  // 当 content 异步更新（GitHub API 拿到数据 / 用户点取消）时，同步 draft 完整快照。
  // 用 ref + JSON 比对避免不必要的重渲染。
  const lastSyncedContent = useRef<string>(JSON.stringify(content))
  useEffect(() => {
    const sig = JSON.stringify(content)
    if (sig !== lastSyncedContent.current) {
      lastSyncedContent.current = sig
      // 只在没有未保存修改时才覆盖 draft（避免用户编辑被异步 content 更新吞掉）
      setDraft((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(content)) {
          // 有未保存修改 → 提示用户但不覆盖
          return prev
        }
        return JSON.parse(sig)
      })
    }
  }, [content])

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(content)

  const updateDraftSection = <K extends keyof SiteContent>(section: K, value: SiteContent[K]) => {
    setDraft(prev => ({ ...prev, [section]: value }))
  }

  const handleSave = async () => {
    await saveContent(draft)
  }

  const handleCancel = () => {
    setDraft(content)
  }

  // 导出当前后台内容为 JSON 文件（备份）
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jack-portfolio-content.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // 尝试清理用户从笔记/编辑器里复制出来的“类 JSON”内容：
  // 去掉 // 行注释、/* */ 块注释、# 开头的 YAML/配置行，以及行尾多余逗号。
  const sanitizeJsonLike = (input: string): string => {
    return input
      .replace(/^\uFEFF/, '')
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('#')) return ''
        // 去掉行尾 // 注释（粗略但足够处理备份场景）
        const idx = line.indexOf(' // ')
        return idx >= 0 ? line.slice(0, idx) : line
      })
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,(\s*[}\]])/g, '$1')
  }

  // 从 JSON 文件导入并立即生效（恢复备份）
  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleImportClick = () => fileInputRef.current?.click()
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 文件扩展名校验：必须是 .json
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert(`导入失败：请选择 .json 文件。当前文件是 "${file.name}"。`)
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        let raw = String(reader.result).replace(/^\uFEFF/, '')
        if (!raw.trim()) throw new Error('文件内容为空')

        let data: unknown
        try {
          data = JSON.parse(raw)
        } catch (firstErr: unknown) {
          // 第一次解析失败，尝试清理注释/YAML标记后再解析
          const cleaned = sanitizeJsonLike(raw)
          try {
            data = JSON.parse(cleaned)
          } catch {
            const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr)
            throw new Error(`JSON 解析失败。${firstMsg}。请确认文件是本后台「导出」的备份，且未被其他编辑器加入注释或 YAML 内容。`)
          }
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('JSON 内容不是一个有效的对象')
        }
        const merged = mergeWithDefault(data)
        setDraft(merged)
        // 导入后必须持久化，否则刷新会从 GitHub/本地缓存重新加载旧数据
        const ok = await saveContent(merged)
        if (!ok) {
          throw new Error('导入内容已加载到后台，但保存到 GitHub 失败。请检查网络或重新加载页面后再试。')
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        alert(`导入失败：${msg}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const sectionOrder = draft.sectionOrder
  const tabOrder = draft.tabOrder

  const moveTab = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = [...tabOrder]
    const [removed] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, removed)
    updateDraftSection('tabOrder', next)
  }

  const removeSection = (type: SectionType) => {
    const nextSectionOrder = sectionOrder.filter((t) => t !== type)
    const nextTabOrder = tabOrder.filter((t) => t !== type)
    updateDraftSection('sectionOrder', nextSectionOrder)
    updateDraftSection('tabOrder', nextTabOrder)
    if (activeTab === type) {
      const firstAvailable = nextTabOrder.find((t) => nextSectionOrder.includes(t as SectionType)) || nextTabOrder[0] || 'navbar'
      setActiveTab(firstAvailable)
    }
  }

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-[#D7E2EA] font-sans">
      {saveStatus !== 'idle' && (
        <div
          style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}
          className={`px-5 py-3 rounded-full text-sm font-medium shadow-lg ${
            saveStatus === 'saving'
              ? 'bg-white/15 text-white/80'
              : saveStatus === 'success'
                ? 'bg-green-500/90 text-white'
                : 'bg-red-500/90 text-white'
          }`}
        >
          {saveStatus === 'saving'
            ? '保存中…'
            : saveStatus === 'success'
              ? '✅ 保存成功'
              : `❌ 保存失败：${saveError}`}
        </div>
      )}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0C0C0C]/95 backdrop-blur z-20">
        <h1 className="text-xl sm:text-2xl font-bold">后台管理</h1>
        <div className="flex items-center gap-3 sm:gap-4">
          {hasChanges && (
            <>
              <button
                onClick={handleCancel}
                className="text-sm px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="text-sm px-5 py-2 rounded-full bg-[#4A90FF] text-white font-medium hover:bg-[#3A80EF] transition-colors"
              >
                保存
              </button>
            </>
          )}
          <Link
            to="/"
            className="text-sm px-4 py-2 rounded-full border border-[#D7E2EA]/30 text-[#D7E2EA] hover:bg-[#D7E2EA]/10 transition-colors"
          >
            查看网站
          </Link>
          <button
            onClick={handleExport}
            className="text-sm px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            导出
          </button>
          <button
            onClick={handleImportClick}
            className="text-sm px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            onClick={() => {
              logout()
              // 刷新当前页：AdminRoute 重新检查 isAuthenticated() → 渲染登录页。
              // 不用 navigate（同路径 SPA 导航不会触发组件重挂载，页面仍停在后台）。
              window.location.reload()
            }}
            className="text-sm px-4 py-2 rounded-full border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            退出登录
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row">
        <aside className="w-full md:w-64 md:border-r border-white/10 md:sticky md:top-[73px] md:self-start md:h-[calc(100vh-73px)] md:overflow-y-auto p-4">
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
            {tabOrder
              .filter((tab) => {
                if (['navbar', 'banner'].includes(tab)) return true
                return sectionOrder.includes(tab as SectionType)
              })
              .map((tab, index) => {
                const isSection = sectionOrder.includes(tab as SectionType)
                return (
                  <div
                    key={tab}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(tabOrder.indexOf(tab)))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverIndex(index)
                    }}
                    onDragLeave={() => setDragOverIndex(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const fromIndex = Number(e.dataTransfer.getData('text/plain'))
                      moveTab(fromIndex, tabOrder.indexOf(tab))
                      setDragOverIndex(null)
                    }}
                    onDragEnd={() => setDragOverIndex(null)}
                    className={`group relative flex items-center justify-between rounded-xl transition-colors ${
                      dragOverIndex === index ? 'bg-white/10' : ''
                    }`}
                  >
                    <button
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                        activeTab === tab
                          ? 'bg-[#4A90FF] text-white'
                          : 'text-[#D7E2EA]/70 hover:bg-white/5 hover:text-[#D7E2EA]'
                      }`}
                    >
                      <span className="cursor-grab active:cursor-grabbing text-white/40">⋮⋮</span>
                      {tabLabels[tab]}
                    </button>
                    {isSection && (
                      <button
                        onClick={() => removeSection(tab as SectionType)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-red-400 hover:text-red-300 px-2"
                        title="移除该板块"
                      >
                        ×
                      </button>
                    )}
                    {!isSection && <span className="opacity-0 px-2 text-xs">×</span>}
                  </div>
                )
              })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-5xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{tabLabels[activeTab]}</h2>
            <p className="text-sm text-white/50 mt-1">编辑内容后点击「保存」按钮生效，未保存的修改不会应用到网站。</p>
          </div>

          {(() => {
            switch (activeTab) {
              case 'navbar':
                return <NavbarEditor hero={draft.hero} onChange={(v) => updateDraftSection('hero', v)} />
              case 'banner':
                return <BannerEditor hero={draft.hero} onChange={(v) => updateDraftSection('hero', v)} />
              case 'marquee':
                return <MarqueeEditor marquee={draft.marquee} onChange={(v) => updateDraftSection('marquee', v)} />
              case 'about':
                return <AboutEditor about={draft.about} onChange={(v) => updateDraftSection('about', v)} />
              case 'services':
                return <ServicesEditor services={draft.services} onChange={(v) => updateDraftSection('services', v)} />
              case 'projects':
                return <ProjectsEditor projects={draft.projects} onChange={(v) => updateDraftSection('projects', v)} />
              default:
                return null
            }
          })()}
        </main>
      </div>
    </div>
  )
}

export default AdminPage
