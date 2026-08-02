import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { fetchImageBlobUrl } from '../lib/githubClient'

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
}

// 图片组件：优先用同源绝对路径（/jack-portfolio/assets/uploads/...）直接加载（由 GitHub Pages 托管）；
// 若该资源尚未随 Pages 重建上线（刚上传），则自动通过 GitHub API 拉取内容转成 blob URL 显示。
// 兼容旧 raw 直连地址（失败时同样走 API 兜底）。支持任意大小文件（>1MB 走 Git Blob API）。
export const SmartImage = ({ src, alt = '', loading, decoding, ...rest }: SmartImageProps) => {
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

  // 默认懒加载 + 异步解码：首屏只加载视口内图片，视口外的项目大图滚动到时才加载，
  // 大幅减少初始请求数与主线程阻塞，解决「加载慢」。
  return (
    <img
      {...rest}
      src={blobUrl || src}
      alt={alt}
      loading={loading ?? 'lazy'}
      decoding={decoding ?? 'async'}
      onError={handleError}
    />
  )
}
