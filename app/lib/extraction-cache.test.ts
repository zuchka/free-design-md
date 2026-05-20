// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readCache, writeCache } from './extraction-cache'

const MOCK_DATA = {
  url: 'stripe.com',
  markdown: '# Stripe\n\nsome tokens',
  designSystemData: {} as any,
  signals: { title: 'Stripe' },
}

describe('extraction-cache', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  describe('readCache', () => {
    it('returns null when no entry exists', () => {
      expect(readCache('stripe.com')).toBeNull()
    })

    it('returns entry when present and fresh', () => {
      writeCache(MOCK_DATA)
      const result = readCache('stripe.com')
      expect(result).toMatchObject({ url: 'stripe.com', markdown: MOCK_DATA.markdown })
      expect(result).not.toHaveProperty('cachedAt')
    })

    it('returns null and evicts when entry is older than 24h', () => {
      writeCache(MOCK_DATA)
      const key = 'fdmd:extraction:stripe.com'
      const stored = JSON.parse(localStorage.getItem(key)!)
      stored.cachedAt = Date.now() - 25 * 60 * 60 * 1000
      localStorage.setItem(key, JSON.stringify(stored))

      expect(readCache('stripe.com')).toBeNull()
      expect(localStorage.getItem(key)).toBeNull()
    })

    it('returns null when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(readCache('stripe.com')).toBeNull()
    })
  })

  describe('writeCache', () => {
    it('writes entry with cachedAt timestamp', () => {
      const before = Date.now()
      writeCache(MOCK_DATA)
      const after = Date.now()
      const raw = localStorage.getItem('fdmd:extraction:stripe.com')
      expect(raw).not.toBeNull()
      const stored = JSON.parse(raw!)
      expect(stored.url).toBe('stripe.com')
      expect(stored.cachedAt).toBeGreaterThanOrEqual(before)
      expect(stored.cachedAt).toBeLessThanOrEqual(after)
    })

    it('does not store screenshotDataUrl even when passed via cast', () => {
      const withExtra = { ...MOCK_DATA, screenshotDataUrl: 'data:image/png;base64,...' } as any
      writeCache(withExtra)
      const stored = JSON.parse(localStorage.getItem('fdmd:extraction:stripe.com')!)
      expect(stored).not.toHaveProperty('screenshotDataUrl')
    })

    it('silently fails when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError')
      })
      expect(() => writeCache(MOCK_DATA)).not.toThrow()
    })
  })
})
