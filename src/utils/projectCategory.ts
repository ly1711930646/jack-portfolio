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

// 打开弹窗时各缩放类目的默认缩放比例。
// 跨境电商：按 100%（原图尺寸）打开，便于直接看细节；
// 国内电商：详情页通常极长，保持 30% 预览以便纵览全貌。
export const CATEGORY_DEFAULT_ZOOM: Record<string, number> = {
  国内电商: 0.3,
  跨境电商: 1,
}

/** 上面都没命中时的兜底默认缩放 */
export const DEFAULT_ZOOM = 0.3

/** 取某个作品打开弹窗时的默认缩放（按标签 / 类目命中，多标签时取先命中的那个） */
export const defaultZoomFor = (p: ProjectItem): number => {
  const tags = Array.isArray(p.tags) ? p.tags : []
  const keys = [...tags, p.category || ''].map((t) => (t || '').trim())
  const hit = keys.find((k) => Object.prototype.hasOwnProperty.call(CATEGORY_DEFAULT_ZOOM, k))
  return hit ? CATEGORY_DEFAULT_ZOOM[hit] : DEFAULT_ZOOM
}
