/**
 * Auth seam. Picks the mocked or real implementation at module load
 * based on the `VITE_FREE_DESIGN_MD_REAL_AUTH` flag.
 *
 * Callers (route components, the SignInModal, the AccountChip) import
 * from here and never reach past this boundary. Phase 3 replaces
 * `real-auth.ts` with a working impl; this file does not change.
 */

import { useSyncExternalStore } from "react";
import { useMockedAuth } from "@shared/flags";
import * as mock from "./mock-auth";
import * as real from "./real-auth";

const impl = useMockedAuth() ? mock : real;

export const getCurrentUser = impl.getCurrentUser;
export const signIn = impl.signIn;
export const signOut = impl.signOut;
export const quotaRemaining = impl.quotaRemaining;
export const consumeQuota = impl.consumeQuota;
export const subscribe = impl.subscribe;

export type { MockUser as AuthUser } from "./mock-auth";

interface AuthSnapshot {
  user: ReturnType<typeof getCurrentUser>;
  remaining: number;
}

const SERVER_SNAPSHOT: AuthSnapshot = { user: null, remaining: 3 };

// useSyncExternalStore requires getSnapshot to return a STABLE reference
// between unchanged reads. The previous version of this file called
// refreshSnapshot() + cb() inside the subscribe callback at mount time,
// which produced a new object reference on every subscribe and caused
// React to infinite-loop ("Maximum update depth exceeded") because the
// snapshot kept "changing" on every mount/effect cycle.
//
// The correct pattern:
// - The snapshot is initialized to a stable value before any read.
// - The subscribe function ONLY registers a listener. It never mutates
//   the snapshot or calls cb() synchronously at mount.
// - When the underlying store changes, the listener checks whether the
//   new values actually differ from the cached snapshot. Only if they
//   do does it allocate a fresh snapshot and notify React.
let cachedSnapshot: AuthSnapshot = SERVER_SNAPSHOT;
let isHydrated = false;

function recompute(): AuthSnapshot {
  return { user: getCurrentUser(), remaining: quotaRemaining() };
}

function snapshotsEqual(a: AuthSnapshot, b: AuthSnapshot): boolean {
  return a.remaining === b.remaining && a.user?.email === b.user?.email;
}

function maybeUpdateSnapshot(): boolean {
  const next = recompute();
  if (snapshotsEqual(cachedSnapshot, next)) return false;
  cachedSnapshot = next;
  return true;
}

function getClientSnapshot(): AuthSnapshot {
  // First client read hydrates from localStorage. Subsequent reads return
  // the same reference until an external mutation flips it.
  if (!isHydrated) {
    isHydrated = true;
    maybeUpdateSnapshot();
  }
  return cachedSnapshot;
}

/**
 * React hook for subscribing to auth state. Use in components that need
 * to re-render when sign-in / sign-out / quota changes happen.
 */
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore<AuthSnapshot>(
    (cb) =>
      subscribe(() => {
        if (maybeUpdateSnapshot()) cb();
      }),
    getClientSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
