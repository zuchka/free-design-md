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

interface CreditsContextValue {
  credits: Credits | null;
  setRemaining: (n: number) => void;
  refresh: () => Promise<void>;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<Credits | null>(null);

  const refresh = async () => {
    try {
      const r = await fetch("/api/me/credits");
      if (!r.ok) return;
      const data = (await r.json()) as Credits;
      setCredits(data);
    } catch {
      // Network or parse errors: leave credits null. The UI hides the chip
      // when credits is null rather than showing a broken state.
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<CreditsContextValue>(
    () => ({
      credits,
      setRemaining: (n: number) =>
        setCredits((c) => (c ? { ...c, remaining: n } : c)),
      refresh,
    }),
    [credits],
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
