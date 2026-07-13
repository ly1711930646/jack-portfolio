import { githubConfig, repoPathToServed } from '../github-config'

const API = 'https://api.github.com'

// UTF-8 安全的 base64 编码（用于把 JSON / 二进制塞进 GitHub Contents API）
const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

// 把 File 读成 base64（去掉 data: 前缀）
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result as string
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    r.onerror = () => reject(new Error('读取文件失败'))
    r.readAsDataURL(file)
  })

export const isGitHubReady = (): boolean => githubConfig.enabled

const authHeaders = (): Record<string, string> => ({
  Authorization: `Bearer ${githubConfig.token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
})

// 浏览器直传图片到 GitHub 仓库（public/assets/uploads），返回站点可用的相对路径
export const uploadImage = async (file: File, prefix = 'uploads'): Promise<string> => {
  if (!githubConfig.enabled) throw new Error('GitHub 未配置')
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')

  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
  const safeExt = ext || 'png'
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`
  const dir = githubConfig.uploadPath.endsWith(prefix) ? githubConfig.uploadPath : `${githubConfig.uploadPath}/${prefix}`
  const path = `${dir}/${name}`

  const content = await fileToBase64(file)
  const res = await fetch(`${API}/repos/${githubConfig.repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      message: `upload: ${name}`,
      content,
      branch: githubConfig.branch,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`GitHub 上传失败 (${res.status}): ${t.slice(0, 120)}`)
  }
  // 返回相对路径，站点按自身 origin 解析 → GitHub Pages 与腾讯云部署都能正确显示
  return repoPathToServed(path)
}

// 把最新整站内容写回 GitHub 仓库的 content.json（保存即同步，无需重新打包）
export const putContentJson = async (content: unknown): Promise<void> => {
  if (!githubConfig.enabled) throw new Error('GitHub 未配置')
  const path = githubConfig.contentKey
  const url = `${API}/repos/${githubConfig.repo}/contents/${encodeURI(path)}`

  // 先取现有文件的 sha（用于更新；不存在则创建）
  let sha: string | undefined
  try {
    const head = await fetch(url, { headers: { Authorization: `Bearer ${githubConfig.token}`, Accept: 'application/vnd.github+json' } })
    if (head.ok) sha = (await head.json()).sha
  } catch {
    /* 404 或网络问题都按「新建」处理 */
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      message: 'update: content.json',
      content: toBase64(JSON.stringify(content, null, 2)),
      branch: githubConfig.branch,
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`GitHub 写回 content.json 失败 (${res.status}): ${t.slice(0, 120)}`)
  }
}
