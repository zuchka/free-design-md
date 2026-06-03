import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Credits {
  remaining: number | null;
  allowed: number | null;
  unlimited?: boolean;
  accountTier?: "anonymous" | "free" | "paid" | "enterprise" | "unknown";
  planLabel?: string | null;
  builderOrgName?: string | null;
}

interface KeyStatus {
  byoKeyConfigured: boolean;
}

interface CreditsContextValue {
  credits: Credits | null;
  keyStatus: KeyStatus | null;
  setRemaining: (n: number | null) => void;
  refresh: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);

  const refresh = useCallback(async () => {
    const [creditsR, keyR] = await Promise.allSettled([
      fetch("/api/me/credits", { cache: "no-store" }),
      fetch("/api/me/key-status", { cache: "no-store" }),
    ]);
    if (creditsR.status === "fulfilled") {
      if (creditsR.value.ok) {
        try {
          setCredits((await creditsR.value.json()) as Credits);
        } catch {
          /* swallow */
        }
      } else {
        setCredits(null);
      }
    }
    if (keyR.status === "fulfilled" && keyR.value.ok) {
      try {
        setKeyStatus((await keyR.value.json()) as KeyStatus);
      } catch {
        /* swallow */
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const value = useMemo<CreditsContextValue>(
    () => ({
      credits,
      keyStatus,
      setRemaining: (n: number | null) =>
        setCredits((c) => (c ? { ...c, remaining: n } : c)),
      refresh,
    }),
    [credits, keyStatus, refresh],
  );

  return (
    <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>
  );
}

export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) {
    throw new Error("useCredits must be used inside a CreditsProvider");
  }
  return ctx;
}
