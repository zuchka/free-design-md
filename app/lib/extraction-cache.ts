import type { DesignSystemData } from '../../shared/api'

const KEY_PREFIX = 'fdmd:extraction:'
const TTL_MS = 24 * 60 * 60 * 1000

export interface CacheEntry {
  url: string
  markdown: string
  designSystemData: DesignSystemData
  signals?: { title?: string }
  screenshotDataUrl?: string
  enrichedMarkdown?: string
  enrichedModel?: string
}

interface StoredEntry extends CacheEntry {
  cachedAt: number
}

export function readCache(url: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + url)
    if (!raw) return null
    const entry = JSON.parse(raw) as StoredEntry
    if (Date.now() - entry.cachedAt > TTL_MS) {
      localStorage.removeItem(KEY_PREFIX + url)
      return null
    }
    const { cachedAt: _c, ...rest } = entry
    return rest
  } catch {
    return null
  }
}

export function writeCache(entry: CacheEntry): void {
  const stored: StoredEntry = { ...entry, cachedAt: Date.now() }
  const key = KEY_PREFIX + entry.url
  try {
    localStorage.setItem(key, JSON.stringify(stored))
    return
  } catch { /* quota — try progressively smaller */ }
  try {
    const { screenshotDataUrl: _s, ...withoutScreenshot } = stored
    localStorage.setItem(key, JSON.stringify(withoutScreenshot))
    return
  } catch { /* still too big */ }
  try {
    const { enrichedMarkdown: _e, screenshotDataUrl: _s2, ...minimal } = stored
    localStorage.setItem(key, JSON.stringify(minimal))
  } catch {
    // quota exceeded even for minimal entry — silent fail
  }
}
