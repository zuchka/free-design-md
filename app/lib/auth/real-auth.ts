/**
 * Real Builder.io auth — backed by server endpoints under /api/auth/*.
 *
 * The seam contract (see [[./index.ts]]) requires synchronous reads
 * because the React `useSyncExternalStore` hook calls `getCurrentUser`
 * / `quotaRemaining` during render. We satisfy this with a small
 * module-scoped cache hydrated by `_hydrate()` on mount, and a
 * subscription channel so optimistic local mutations (e.g. consumeQuota
 * after a successful enrich) notify React.
 *
 * Authoritative state lives on the server — the enrich endpoint
 * decrements quota server-side and 402s when exhausted. The client cache
 * is a UX-quality estimate that the server overrides on hydration.
 */

import type { MockUser } from "./mock-auth";

const QUOTA_DEFAULT = 3;
const CHANGE_EVENT = "free-design-md:real-auth:change";

interface CacheState {
  user: MockUser | null;
  remaining: number;
  hasBuilderSpace: boolean;
}

let cache: CacheState = { user: null, remaining: QUOTA_DEFAULT, hasBuilderSpace: false };

function isClient(): boolean {
  return typeof window !== "undefined";
}

function dispatchChange(): void {
  if (!isClient()) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getCurrentUser(): MockUser | null {
  return cache.user;
}

export function quotaRemaining(): number {
  return cache.remaining;
}

export function hasBuilderSpace(): boolean {
  return cache.hasBuilderSpace;
}

/**
 * Navigate to the framework's built-in sign-in page. The /sign-in route
 * is unprotected-by-the-handler but not in publicPaths, so the framework's
 * auth guard intercepts unauthenticated requests and shows the email/password
 * form. After sign-in the handler redirects back to ?return.
 */
export function signIn(_emailIgnored?: string): MockUser {
  if (!isClient()) throw new Error("signIn called outside the browser");
  const returnPath = window.location.pathname + window.location.search;
  window.location.assign(`/api/auth/builder/start?return=${encodeURIComponent(returnPath)}`);
  // Page is navigating away — return placeholder; callers can't observe it.
  return { email: "" };
}

export function signOut(): void {
  if (!isClient()) return;
  cache = { user: null, remaining: QUOTA_DEFAULT, hasBuilderSpace: false };
  dispatchChange();
  void fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

export function consumeQuota(): { ok: boolean; remaining: number } {
  if (cache.remaining <= 0) {
    return { ok: false, remaining: 0 };
  }
  cache = { ...cache, remaining: cache.remaining - 1 };
  dispatchChange();
  return { ok: true, remaining: cache.remaining };
}

export function subscribe(listener: () => void): () => void {
  if (!isClient()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

/**
 * Hydrate the cache from /api/auth/me. Called once on mount from the
 * seam in `./index.ts` (added in Task 14).
 *
 * Underscore-prefixed because it's an implementation detail of the
 * real seam — not part of the public contract.
 */
export async function _hydrate(): Promise<void> {
  if (!isClient()) return;
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      user?: { email?: string; name?: string | null };
      remaining?: number;
      hasBuilderSpace?: boolean;
    };
    if (!body.user?.email) return;
    cache = {
      user: { email: body.user.email },
      remaining: typeof body.remaining === "number" ? body.remaining : QUOTA_DEFAULT,
      hasBuilderSpace: body.hasBuilderSpace === true,
    };
    dispatchChange();
  } catch {
    // network errored — leave cache at signed-out defaults
  }
}

/** Re-fetch quota from the server and update the local cache. */
export async function refreshQuota(): Promise<void> {
  await _hydrate();
}

/** Test-only — reset module state. Not exported from the auth seam. */
export function _resetForTests(): void {
  cache = { user: null, remaining: QUOTA_DEFAULT, hasBuilderSpace: false };
}
