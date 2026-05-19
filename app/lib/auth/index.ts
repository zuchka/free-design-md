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

// useSyncExternalStore requires getSnapshot to return a stable reference
// between mutations, otherwise React will treat every read as a change and
// re-render in a loop. We cache the snapshot here and only re-compute
// inside the subscribe callback when the underlying store fires.
let cachedSnapshot: AuthSnapshot = SERVER_SNAPSHOT;

function refreshSnapshot(): void {
  cachedSnapshot = { user: getCurrentUser(), remaining: quotaRemaining() };
}

/**
 * React hook for subscribing to auth state. Use in components that need
 * to re-render when sign-in / sign-out / quota changes happen.
 */
export function useAuth(): AuthSnapshot {
  return useSyncExternalStore<AuthSnapshot>(
    (cb) => {
      // Snap on subscribe so the first client-side render reflects
      // localStorage state rather than the SSR default.
      refreshSnapshot();
      cb();
      return subscribe(() => {
        refreshSnapshot();
        cb();
      });
    },
    () => cachedSnapshot,
    () => SERVER_SNAPSHOT,
  );
}
