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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("purchase") !== "success" || !sessionId) return;

    let cancelled = false;
    let attempts = 0;
    const checkPurchase = async () => {
      attempts += 1;
      const response = await fetch(
        `/api/billing/purchase/${encodeURIComponent(sessionId)}`,
      ).catch(() => null);
      if (response?.ok) {
        const purchase = (await response.json()) as { status?: string };
        if (purchase.status === "fulfilled") {
          await refresh();
          params.delete("purchase");
          params.delete("session_id");
          const search = params.toString();
          window.history.replaceState(
            {},
            "",
            `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`,
          );
          return;
        }
      }
      if (!cancelled && attempts < 12) window.setTimeout(checkPurchase, 1000);
    };
    void checkPurchase();
    return () => {
      cancelled = true;
    };
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
