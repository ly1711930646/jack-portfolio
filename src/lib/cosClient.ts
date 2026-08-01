import COS from 'cos-js-sdk-v5'

// 腾讯云 COS 上传封装。
// 图片/视频直传 COS 后返回固定绝对地址（形如 https://{bucket}.cos.{region}.myqcloud.com/{key}），
// 不依赖任何第三方 CDN，国内稳定直连；且链接与站点部署沙箱解耦，换部署链接也不影响已上传资源。
//
// 注意：这里用的是「永久密钥（SecretId / SecretKey）」放在前端，与现有 GitHub Token 的处理方式一致。
// 个人项目可接受；若对安全性要求高，应改为后端 STS 临时密钥（见 cos-js-sdk-v5 文档 getAuthorization）。

const env = import.meta.env

export interface CosConfig {
  secretId: string
  secretKey: string
  bucket: string // 形如 name-1250000000
  region: string // 形如 ap-guangzhou
  baseUrl: string // 可选：自定义域名（CDN 加速域名），留空则用默认 cos 域名
}

const secretId = (env.VITE_COS_SECRET_ID as string | undefined) || ''
const secretKey = (env.VITE_COS_SECRET_KEY as string | undefined) || ''
const bucket = (env.VITE_COS_BUCKET as string | undefined) || ''
const region = (env.VITE_COS_REGION as string | undefined) || 'ap-guangzhou'
const baseUrl = (env.VITE_COS_BASE_URL as string | undefined) || ''

export const cosConfig: CosConfig = { secretId, secretKey, bucket, region, baseUrl }

// COS 是否配置就绪（四项齐全才启用；否则 uploadImage/uploadVideo 会回退 GitHub）
export const isCosReady = (): boolean => Boolean(secretId && secretKey && bucket && region)

let _cos: COS | null = null
const getCos = (): COS => {
  if (!_cos) {
    // 懒初始化：只有真正上传时才 new COS，避免无凭证时构造报错
    _cos = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    })
  }
  return _cos
}

// 由 key 拼出可访问的绝对 URL
const cosUrl = (key: string): string => {
  if (baseUrl) return `${baseUrl.replace(/\/$/, '')}/${key}`
  return `https://${bucket}.cos.${region}.myqcloud.com/${key}`
}

// 浏览器直传文件到 COS（uploads/{时间戳}-{随机}.{ext}），返回绝对 URL
export const uploadToCos = async (file: File, prefix = 'uploads'): Promise<string> => {
  if (!isCosReady()) throw new Error('COS 未配置')
  if (!file.type) throw new Error('无法识别文件类型')

  const dot = file.name.lastIndexOf('.')
  let ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  if (!ext && file.type.includes('/')) ext = file.type.split('/')[1].replace(/[^a-z0-9]/g, '')
  const safeExt = ext || 'bin'
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`
  const key = `${prefix}/${name}`

  const cos = getCos()
  await new Promise<void>((resolve, reject) => {
    cos.uploadFile(
      {
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: file,
        onProgress: () => {
          /* 进度回调，预留 */
        },
      },
      (err: unknown) => {
        if (err) {
          const msg = err instanceof Error ? err.message : JSON.stringify(err)
          reject(new Error(`COS 上传失败: ${msg.slice(0, 160)}`))
        } else {
          resolve()
        }
      },
    )
  })
  return cosUrl(key)
}
