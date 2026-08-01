import { githubConfig, toServedUrl } from '../github-config'
import { isCosReady, uploadToCos } from './cosClient'

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

// 根据文件扩展名推断 MIME 类型（用于 API 返回的 base64 解码）
const mimeFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  }
  return map[ext] || 'application/octet-stream'
}

// 把本仓库的 raw.githubusercontent.com 地址（或 /assets/uploads/... 相对路径）
// 通过 GitHub Contents API 拉取并转成浏览器可用的 blob URL。
// 用于后台预览兜底：当 raw 域名在用户侧被墙/拦截时，api.github.com 通常仍可访问。
export const fetchImageBlobUrl = async (url: string): Promise<string> => {
  if (!githubConfig.enabled) throw new Error('GitHub 未配置')
  let repoPath = ''
  // 支持三种形态：同源绝对路径（/jack-portfolio/assets/uploads/X）、
  // 站点相对路径（/assets/uploads/X）以及旧的 raw 直连（raw.githubusercontent.com/.../public/assets/uploads/X）。
  const upIdx = url.indexOf('/assets/uploads/')
  const rawPrefix = `${githubConfig.rawBase}/`
  if (upIdx >= 0) {
    repoPath = `public${url.slice(upIdx)}`
  } else if (url.startsWith(rawPrefix)) {
    repoPath = url.slice(rawPrefix.length)
  } else {
    throw new Error('非本仓库图片链接')
  }

  const headers = authHeaders()
  // 第一步：contents API 拿 sha；小文件（≤1MB）会同时返回 base64 content
  const contentsUrl = `${API}/repos/${githubConfig.repo}/contents/${encodeURI(repoPath)}?ref=${githubConfig.branch}`
  const res = await fetch(contentsUrl, { headers })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`GitHub API 读取失败 (${res.status}): ${t.slice(0, 120)}`)
  }
  const data = await res.json()
  let base64 = data.content
  // GitHub contents API 对 >1MB 文件虽返回 200，但 content 为空、encoding 为 none。
  // 必须用文件 sha 走 Git Blob API 才能拿到大文件的 base64。
  if (!base64 || data.encoding !== 'base64') {
    if (!data.sha) throw new Error('图片无法预览（过大且缺少 sha）')
    const blobRes = await fetch(`${API}/repos/${githubConfig.repo}/git/blobs/${data.sha}`, { headers })
    if (!blobRes.ok) {
      const t = await blobRes.text().catch(() => '')
      throw new Error(`GitHub Blob API 失败 (${blobRes.status}): ${t.slice(0, 120)}`)
    }
    const blobData = await blobRes.json()
    base64 = blobData.content
  }
  if (!base64) throw new Error('图片内容为空')
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeFromPath(repoPath) })
  return URL.createObjectURL(blob)
}

// 浏览器直传图片到 GitHub 仓库（public/assets/uploads），返回 jsDelivr 绝对地址
// 上传后无需重新部署，国内可直接从该 CDN 地址显示。
export const uploadImage = async (file: File, prefix = 'uploads'): Promise<string> => {
  // 优先直传腾讯云 COS（链接稳定、国内直连、与部署沙箱解耦）
  if (isCosReady()) return uploadToCos(file, prefix)
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
  // 返回站点同源绝对路径（由 GitHub Pages 直接托管，避免 raw 域名被拦截导致破图；
  // 后台保存即生效，GitHub Actions 会在推送后自动重建 Pages）。
  return toServedUrl(`assets/uploads/${name}`)
}

// 浏览器直传视频到 GitHub 仓库（与图片共用 uploads 目录），返回 jsDelivr 绝对地址。
// 视频文件通常较大（10-50MB），base64 编码再增 33%，单文件建议控制在 50MB 以内。
export const uploadVideo = async (file: File, prefix = 'uploads'): Promise<string> => {
  // 优先直传腾讯云 COS（链接稳定、国内直连、与部署沙箱解耦）
  if (isCosReady()) return uploadToCos(file, prefix)
  if (!githubConfig.enabled) throw new Error('GitHub 未配置')
  if (!file.type.startsWith('video/')) throw new Error('请选择视频文件')

  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'mp4'
  const safeExt = ext || 'mp4'
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`
  const dir = githubConfig.uploadPath.endsWith(prefix) ? githubConfig.uploadPath : `${githubConfig.uploadPath}/${prefix}`
  const path = `${dir}/${name}`

  const content = await fileToBase64(file)
  const res = await fetch(`${API}/repos/${githubConfig.repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      message: `upload video: ${name}`,
      content,
      branch: githubConfig.branch,
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`GitHub 视频上传失败 (${res.status}): ${t.slice(0, 120)}`)
  }
  // 返回站点同源绝对路径（与图片一致，由 GitHub Pages 托管）。
  return toServedUrl(`assets/uploads/${name}`)
}

// 从 GitHub 仓库删除一个资源（图片/视频）。传入的 url 可以是本项目生成的
// raw 直连地址或同源 /assets/uploads/... 路径。删除后对应文件不再占用仓库空间。
// 仅删除确实属于本仓库 uploads 的文件，避免误删用户手动填入的第三方链接。
export const deleteAsset = async (url: string): Promise<void> => {
  if (!githubConfig.enabled) return
  if (!url) return
  // 解析出仓库内相对路径（public/assets/uploads/xxx）。
  // 支持同源绝对路径（/jack-portfolio/assets/uploads/X）、站点相对路径（/assets/uploads/X）
  // 以及旧 raw 直连（raw.githubusercontent.com/.../public/assets/uploads/X）。
  let rel = ''
  const upIdx = url.indexOf('/assets/uploads/')
  const rawPrefix = `${githubConfig.rawBase}/public/`
  if (upIdx >= 0) {
    rel = `public${url.slice(upIdx)}`
  } else if (url.startsWith(rawPrefix)) {
    rel = 'public/' + url.slice(rawPrefix.length)
  } else {
    // 非本仓库资源（第三方链接），不处理
    return
  }
  const enc = encodeURI(rel)
  const getUrl = `${API}/repos/${githubConfig.repo}/contents/${enc}`
  try {
    const head = await fetch(getUrl, { headers: { Authorization: `Bearer ${githubConfig.token}`, Accept: 'application/vnd.github+json' } })
    if (!head.ok) return // 文件不存在则无需删除
    const info = await head.json()
    const sha = info.sha
    const delRes = await fetch(getUrl, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ message: `delete: ${rel}`, sha, branch: githubConfig.branch }),
    })
    if (!delRes.ok) {
      const t = await delRes.text().catch(() => '')
      throw new Error(`GitHub 删除失败 (${delRes.status}): ${t.slice(0, 120)}`)
    }
  } catch (e) {
    // 网络/解析错误向上抛出，由调用方决定提示
    throw e instanceof Error ? e : new Error('GitHub 删除异常')
  }
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
