/**
 * Mocked Builder.io auth — localStorage-backed, no network calls. The
 * "Sign in" flow accepts any email and pretends to authenticate. Quota
 * is a 3-count integer in localStorage. Swap this whole file out for a
 * real OAuth impl post-hackathon (see [[../auth.ts]] for the seam).
 *
 * SSR-safe: every localStorage access is window-guarded so the initial
 * server render returns "signed-out / quota = full". The client effect
 * syncs from localStorage on mount via the subscribe API.
 */

const STORAGE_USER_KEY = "free-design-md:mock-auth:user";
const STORAGE_QUOTA_KEY = "free-design-md:mock-auth:quota";
const FULL_QUOTA = 3;
const CHANGE_EVENT = "free-design-md:mock-auth:change";

export type MockUser = { email: string };

function isClient(): boolean {
  return typeof window !== "undefined";
}

function dispatchChange() {
  if (!isClient()) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getCurrentUser(): MockUser | null {
  if (!isClient()) return null;
  const raw = window.localStorage.getItem(STORAGE_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MockUser;
  } catch {
    return null;
  }
}

export function signIn(email = "dev@example.local"): MockUser {
  if (!isClient()) throw new Error("signIn called outside the browser");
  const user: MockUser = { email };
  window.localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  // First sign-in seeds the quota. Subsequent sign-ins do NOT reset it —
  // signing out and back in shouldn't replenish free credits.
  if (window.localStorage.getItem(STORAGE_QUOTA_KEY) === null) {
    window.localStorage.setItem(STORAGE_QUOTA_KEY, String(FULL_QUOTA));
  }
  dispatchChange();
  return user;
}

export function signOut(): void {
  if (!isClient()) return;
  window.localStorage.removeItem(STORAGE_USER_KEY);
  // Keep the quota row — see signIn's note.
  dispatchChange();
}

export function quotaRemaining(): number {
  if (!isClient()) return FULL_QUOTA;
  const raw = window.localStorage.getItem(STORAGE_QUOTA_KEY);
  if (raw === null) return FULL_QUOTA;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Atomically decrement the quota. Returns ok=false (no decrement) when
 * already at zero so callers can short-circuit and show the lock UI.
 */
export function consumeQuota(): { ok: boolean; remaining: number } {
  if (!isClient()) return { ok: false, remaining: FULL_QUOTA };
  const current = quotaRemaining();
  if (current <= 0) return { ok: false, remaining: 0 };
  const next = current - 1;
  window.localStorage.setItem(STORAGE_QUOTA_KEY, String(next));
  dispatchChange();
  return { ok: true, remaining: next };
}

/**
 * Subscribe to auth-state changes. Returns an unsubscribe function.
 * Used by useAuth() so React components re-render when sign-in / sign-out
 * / quota changes happen anywhere in the app.
 */
export function subscribe(listener: () => void): () => void {
  if (!isClient()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  // Also listen to storage events so another tab signing out propagates.
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Test-only — reset all mock state. Not exported from the auth seam. */
export function _resetForTests(): void {
  if (!isClient()) return;
  window.localStorage.removeItem(STORAGE_USER_KEY);
  window.localStorage.removeItem(STORAGE_QUOTA_KEY);
}

/** No-op in mock mode — quota state is already in sync via localStorage. */
export async function refreshQuota(): Promise<void> {}

/** Mock always returns false — mock users never have a linked Builder space. */
export function hasBuilderSpace(): boolean {
  return false;
}
