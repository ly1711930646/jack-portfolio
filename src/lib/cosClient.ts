import COS from 'cos-js-sdk-v5'
import { cosConfig } from '../cos-config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null

const getClient = (): any => {
  if (!cosConfig.enabled) return null
  if (!client) {
    client = new COS({
      SecretId: cosConfig.SecretId,
      SecretKey: cosConfig.SecretKey,
    })
  }
  return client
}

export const isCOSReady = (): boolean => cosConfig.enabled

// 浏览器直传文件到 COS，返回公网可访问的 URL
export const uploadFile = async (file: File, prefix = 'uploads'): Promise<string> => {
  const cos = getClient()
  if (!cos) throw new Error('COS 未配置')
  const dot = file.name.lastIndexOf('.')
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
  const key = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'png'}`
  await cos.putObject({
    Bucket: cosConfig.Bucket,
    Region: cosConfig.Region,
    Key: key,
    Body: file,
  })
  return `${cosConfig.baseUrl}/${key}`
}

// 把最新的整站内容写回 COS，使所有访客实时看到（无需重新打包部署）
export const putContentJson = async (content: unknown): Promise<void> => {
  const cos = getClient()
  if (!cos) throw new Error('COS 未配置')
  await cos.putObject({
    Bucket: cosConfig.Bucket,
    Region: cosConfig.Region,
    Key: cosConfig.contentKey,
    Body: JSON.stringify(content),
    ContentType: 'application/json',
  })
}
