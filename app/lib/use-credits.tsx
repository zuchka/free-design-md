import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Credits {
  remaining: number;
  allowed: number;
}

interface KeyStatus {
  byoKeyConfigured: boolean;
}

interface CreditsContextValue {
  credits: Credits | null;
  keyStatus: KeyStatus | null;
  setRemaining: (n: number) => void;
  refresh: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<Credits | null>(null);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);

  const refresh = async () => {
    const [creditsR, keyR] = await Promise.allSettled([
      fetch("/api/me/credits"),
      fetch("/api/me/key-status"),
    ]);
    if (creditsR.status === "fulfilled" && creditsR.value.ok) {
      try { setCredits((await creditsR.value.json()) as Credits); } catch { /* swallow */ }
    }
    if (keyR.status === "fulfilled" && keyR.value.ok) {
      try { setKeyStatus((await keyR.value.json()) as KeyStatus); } catch { /* swallow */ }
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<CreditsContextValue>(
    () => ({
      credits,
      keyStatus,
      setRemaining: (n: number) =>
        setCredits((c) => (c ? { ...c, remaining: n } : c)),
      refresh,
    }),
    [credits, keyStatus],
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
