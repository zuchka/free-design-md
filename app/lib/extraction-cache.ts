import type { DesignSystemData } from '../../shared/api'

const KEY_PREFIX = 'fdmd:extraction:'
const TTL_MS = 24 * 60 * 60 * 1000

export interface CacheEntry {
  url: string
  markdown: string
  designSystemData: DesignSystemData
  signals?: { title?: string }
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
  try {
    const { url, markdown, designSystemData, signals } = entry
    localStorage.setItem(
      KEY_PREFIX + url,
      JSON.stringify({ url, markdown, designSystemData, signals, cachedAt: Date.now() }),
    )
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — silent fail
  }
}
