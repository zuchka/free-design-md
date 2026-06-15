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

function isPublicReadOnlyPath(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname } = window.location;
  return (
    /^\/d\/[^/]+/.test(pathname) ||
    pathname.startsWith("/docs") ||
    pathname === "/quality"
  );
}

export function CreditsProvider({ children }: { children: ReactNode }) {
  const [credits, setCredits] = useState<Credits | null>(null);

  const refresh = async () => {
    const creditsR = await fetch("/api/me/credits").catch(() => null);
    if (creditsR?.ok) {
      try {
        setCredits((await creditsR.json()) as Credits);
      } catch {
        /* swallow */
      }
    } else {
      setCredits(null);
    }
  };

  useEffect(() => {
    if (isPublicReadOnlyPath()) return;
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
