import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  useSession,
  agentNativePath,
  type AuthSession,
} from "@agent-native/core/client";

interface AuthContextValue {
  auth: AuthSession | null;
  user: { email: string } | null;
  isLoading: boolean;
  remaining: number;
  hasBuilderSpace: boolean;
  signIn: () => void;
  signOut: () => void;
  consumeQuota: () => { ok: boolean; remaining: number };
  refreshQuota: () => Promise<void>;
}

const QUOTA_DEFAULT = 3;
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession();
  const [remaining, setRemaining] = useState(QUOTA_DEFAULT);
  const [hasBuilderSpace, setHasBuilderSpace] = useState(false);

  const refreshQuota = useCallback(async () => {
    if (!session?.email) {
      setRemaining(QUOTA_DEFAULT);
      setHasBuilderSpace(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const body = (await res.json()) as {
        remaining?: number;
        hasBuilderSpace?: boolean;
      };
      if (typeof body.remaining === "number") setRemaining(body.remaining);
      setHasBuilderSpace(body.hasBuilderSpace === true);
    } catch {
      // network error — leave previous state in place
    }
  }, [session?.email]);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  const consumeQuota = useCallback(() => {
    if (remaining <= 0) return { ok: false, remaining: 0 };
    const next = remaining - 1;
    setRemaining(next);
    return { ok: true, remaining: next };
  }, [remaining]);

  const signIn = useCallback(() => {
    const ret = window.location.pathname + window.location.search;
    window.location.assign(
      agentNativePath(`/_agent-native/sign-in?return=${encodeURIComponent(ret)}`),
    );
  }, []);

  const signOut = useCallback(() => {
    void fetch(agentNativePath("/_agent-native/auth/logout"), {
      method: "POST",
      credentials: "include",
    })
      .catch(() => {})
      .finally(() => {
        window.location.reload();
      });
  }, []);

  const value: AuthContextValue = {
    auth: session,
    user: session?.email ? { email: session.email } : null,
    isLoading,
    remaining,
    hasBuilderSpace,
    signIn,
    signOut,
    consumeQuota,
    refreshQuota,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
