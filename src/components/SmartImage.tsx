import { useEffect, useMemo, useState, type ImgHTMLAttributes } from 'react'
import { fetchImageBlobUrl } from '../lib/githubClient'

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string
}

/**
 * 把本仓库 uploads 路径映射到 jsDelivr CDN：
 * GitHub Pages 国内访问慢，jsDelivr 有国内节点、支持缓存，
 * 图片加载速度显著提升。已在 MarqueeSection / HeroSection 独立实现，
 * 此处统一到 SmartImage 层，确保全站所有图片（作品/头像/装饰图）均受益。
 */
const toCdnUrl = (src: string): string => {
  if (!src) return src
  // 已经是外部 URL（http/https 或 // 开头）的不转换
  if (/^https?:\/\//i.test(src) || /^\/\//i.test(src)) return src
  const match = src.match(/\/jack-portfolio\/assets\/uploads\/([^/]+\.[a-z0-9]+)$/i)
  if (match) {
    return `https://cdn.jsdelivr.net/gh/ly1711930646/jack-portfolio@main/public/assets/uploads/${match[1]}`
  }
  return src
}

// 图片组件：优先用同源绝对路径（/jack-portfolio/assets/uploads/...）直接加载（由 GitHub Pages 托管）；
// 若该资源尚未随 Pages 重建上线（刚上传），则自动通过 GitHub API 拉取内容转成 blob URL 显示。
// 兼容旧 raw 直连地址（失败时同样走 API 兜底）。支持任意大小文件（>1MB 走 Git Blob API）。
export const SmartImage = ({ src, alt = '', loading, decoding, ...rest }: SmartImageProps) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  // 全站统一：本地 uploads 路径自动映射到 jsDelivr CDN
  const cdnSrc = useMemo(() => toCdnUrl(src), [src])

  useEffect(() => {
    setBlobUrl(null)
    setFailed(false)
  }, [cdnSrc])

  const handleError = async () => {
    if (failed) return
    if (blobUrl) {
      setFailed(true)
      return
    }
    try {
      // 兜底仍用原始 src（含仓库路径信息）走 GitHub API 拉取
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
      src={blobUrl || cdnSrc}
      alt={alt}
      loading={loading ?? 'lazy'}
      decoding={decoding ?? 'async'}
      onError={handleError}
    />
  )
}
