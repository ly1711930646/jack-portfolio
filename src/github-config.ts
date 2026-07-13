interface GitHubConfig {
  enabled: boolean
  token: string
  repo: string // owner/name
  branch: string
  uploadPath: string // 图片提交的仓库目录，如 public/assets/uploads
  contentKey: string // content.json 在仓库中的路径，如 public/data/content.json
  rawBase: string // https://raw.githubusercontent.com/owner/name/branch
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
}

// 站点运行时优先读取此 URL（GitHub 上的最新 content.json），实现「保存即同步」
export const contentJsonUrl = githubConfig.enabled ? `${githubConfig.rawBase}/${githubConfig.contentKey}` : ''

// 把仓库内路径（如 public/assets/uploads/x.png）转成站点可访问的相对路径（assets/uploads/x.png）
export const repoPathToServed = (repoPath: string): string => {
  const idx = repoPath.indexOf('public/')
  const rel = idx >= 0 ? repoPath.slice(idx + 'public/'.length) : repoPath
  return rel.replace(/^\/+/, '')
}
