import type { ProjectItem } from '../content/siteContent'

// 支持图片放大/缩小的类目（国内电商 + 跨境电商）
export const ZOOM_CATEGORIES = ['国内电商', '跨境电商']

export const isZoomableCategory = (p: ProjectItem): boolean => {
  const tags = Array.isArray(p.tags) ? p.tags : []
  return (
    tags.some((t) => ZOOM_CATEGORIES.includes(t.trim())) ||
    ZOOM_CATEGORIES.includes((p.category || '').trim())
  )
}
