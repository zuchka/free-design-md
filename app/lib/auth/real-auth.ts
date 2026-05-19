/**
 * Real Builder.io auth — stub. Phase 3 will replace this with a real
 * OAuth/SSO flow against Builder.io's accounts code, a server-side user
 * + quota table, and proper session handling.
 *
 * Until then, this module exists so the seam in `./index.ts` can pick
 * "real" when `VITE_FREE_DESIGN_MD_REAL_AUTH=1` is set, and fail loudly
 * if anyone flips the flag prematurely.
 */

import type { MockUser } from "./mock-auth";

const NOT_IMPLEMENTED = "real Builder.io auth not implemented — unset VITE_FREE_DESIGN_MD_REAL_AUTH for the mocked seam";

export function getCurrentUser(): MockUser | null {
  throw new Error(NOT_IMPLEMENTED);
}

export function signIn(_email: string): MockUser {
  throw new Error(NOT_IMPLEMENTED);
}

export function signOut(): void {
  throw new Error(NOT_IMPLEMENTED);
}

export function quotaRemaining(): number {
  throw new Error(NOT_IMPLEMENTED);
}

export function consumeQuota(): { ok: boolean; remaining: number } {
  throw new Error(NOT_IMPLEMENTED);
}

export function subscribe(_listener: () => void): () => void {
  throw new Error(NOT_IMPLEMENTED);
}
