const BROWSER_TAB_ID_STORAGE_KEY = "free-design-md-browser-tab-id";
const BROWSER_TAB_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;

function isBrowserTabId(value: unknown): value is string {
  return typeof value === "string" && BROWSER_TAB_ID_PATTERN.test(value.trim());
}

function createBrowserTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tab_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function getBrowserTabId(): string | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const existing = sessionStorage.getItem(BROWSER_TAB_ID_STORAGE_KEY);
    if (isBrowserTabId(existing)) return existing.trim();

    const next = createBrowserTabId();
    sessionStorage.setItem(BROWSER_TAB_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createBrowserTabId();
  }
}
