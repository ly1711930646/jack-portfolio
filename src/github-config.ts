interface GitHubConfig {
  enabled: boolean
  token: string
  repo: string // owner/name
  branch: string
  uploadPath: string // 图片提交的仓库目录，如 public/assets/uploads
  contentKey: string // content.json 在仓库中的路径，如 public/data/content.json
  rawBase: string // https://raw.githubusercontent.com/owner/name/branch（GitHub 官方 raw，本项目图片/配置直连源）
  jsdelivrBase: string // 兼容旧数据用，指向 raw（不再依赖第三方 CDN）
}

const env = import.meta.env

const token = (env.VITE_GH_TOKEN as string | undefined) || ''
const repo = (env.VITE_GH_REPO as string | undefined) || ''
const branch = (env.VITE_GH_BRANCH as string | undefined) || 'main'
const uploadPath = (env.VITE_GH_UPLOAD_PATH as string | undefined) || 'public/assets/uploads'
const contentKey = (env.VITE_GH_CONTENT_KEY as string | undefined) || 'public/data/content.json'

export const githubConfig: GitHubConfig = {
  enabled: Boolean(token && repo),
  token,
  repo,
  branch,
  uploadPath,
  contentKey,
  rawBase: `https://raw.githubusercontent.com/${repo}/${branch}`,
  jsdelivrBase: `https://raw.githubusercontent.com/${repo}/${branch}/public`,
}

// 站点在 GitHub Pages 上的固定子路径（与 vite base 生产环境一致）。
// 图片/数据等资源统一用「同源绝对路径」（/jack-portfolio/assets/...），
// 由 GitHub Pages 直接托管，避免 raw.githubusercontent.com 在部分网络被拦截导致破图。
export const SITE_BASE = '/jack-portfolio/'

// 站点运行时优先从 GitHub raw 读取最新 content.json（后台保存即同步，无需重新部署）。
// 同时 content.json 也会随 dist 打包作为兜底（ContentContext 读取失败时使用）。
const contentJsonPath = githubConfig.contentKey.replace(/^public\//, '')
export const contentJsonUrl = `${githubConfig.rawBase}/${contentJsonPath}`

// 把仓库内路径（如 public/assets/uploads/x.png）转成站点可访问的相对路径（assets/uploads/x.png）
export const repoPathToServed = (repoPath: string): string => {
  const idx = repoPath.indexOf('public/')
  const rel = idx >= 0 ? repoPath.slice(idx + 'public/'.length) : repoPath
  return rel.replace(/^\/+/, '')
}

// 把「去掉 public/ 前缀后的相对路径」（如 assets/uploads/x.png）转成站点同源绝对路径。
export const toServedUrl = (relAfterPublic: string): string =>
  `${SITE_BASE}${relAfterPublic.replace(/^\/+/, '')}`

// 旧 CDN 域名（已不稳定，仅用于识别历史数据并迁移到同源路径）。
const LEGACY_JSDELIVR_HOST = 'https://cdn.jsdelivr.net'
const LEGACY_JSDELIVR_MIRROR_HOST = 'https://jsd.cdn.zzko.cn'

// 把本仓库的旧 jsDelivr 链接 / raw 直连链接统一改写成站点同源绝对路径
// （/jack-portfolio/assets/...）。只处理本项目生成的链接，不会误改第三方 URL。
const migrateLegacyJsdelivrUrl = (value: string): string => {
  if (!value || typeof value !== 'string') return value
  const prefixes = [
    `${LEGACY_JSDELIVR_HOST}/gh/${repo}@${branch}/public/`,
    `${LEGACY_JSDELIVR_MIRROR_HOST}/gh/${repo}@${branch}/public/`,
    `${githubConfig.rawBase}/public/`,
  ]
  for (const p of prefixes) {
    if (value.startsWith(p)) return toServedUrl(value.slice(p.length))
  }
  // 已经是同源 /assets/uploads/ 形式（可能被旧代码写成 /assets/uploads/ 或 /jack-portfolio/assets/uploads/）
  if (value.includes('/assets/uploads/')) {
    const upIdx = value.indexOf('/assets/uploads/')
    return toServedUrl(value.slice(upIdx + 1)) // 去掉开头的 '/'
  }
  return value
}

// 递归遍历对象/数组，把其中所有本仓库的旧 jsDelivr URL 替换为国内镜像。
export const migrateLegacyJsdelivrUrls = <T>(data: T): T => {
  if (typeof data === 'string') {
    return migrateLegacyJsdelivrUrl(data) as unknown as T
  }
  if (Array.isArray(data)) {
    return data.map((item) => migrateLegacyJsdelivrUrls(item)) as unknown as T
  }
  if (data && typeof data === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      result[key] = migrateLegacyJsdelivrUrls(value)
    }
    return result as unknown as T
  }
  return data
}
