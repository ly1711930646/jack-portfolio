interface COSConfig {
  enabled: boolean
  SecretId: string
  SecretKey: string
  Bucket: string
  Region: string
  baseUrl: string
  contentKey: string
}

const env = import.meta.env

const bucket = (env.VITE_COS_BUCKET as string | undefined) || ''
const region = (env.VITE_COS_REGION as string | undefined) || ''
const secretId = (env.VITE_COS_SECRET_ID as string | undefined) || ''
const secretKey = (env.VITE_COS_SECRET_KEY as string | undefined) || ''
const customBase = (env.VITE_COS_BASE_URL as string | undefined) || ''
const baseUrl =
  customBase || (bucket && region ? `https://${bucket}.cos.${region}.myqcloud.com` : '')

export const cosConfig: COSConfig = {
  enabled: Boolean(bucket && region && secretId && secretKey),
  SecretId: secretId,
  SecretKey: secretKey,
  Bucket: bucket,
  Region: region,
  baseUrl,
  contentKey: 'data/content.json',
}

export const contentJsonUrl = cosConfig.enabled ? `${cosConfig.baseUrl}/${cosConfig.contentKey}` : ''
