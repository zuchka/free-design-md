import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { authClient } from "@/lib/auth-client";
import {
  emitGrowthEvent,
  resetAnalyticsVisitor,
  ensureAnalyticsVisitor,
} from "@/lib/growth-analytics";

export default function AnalyticsCollector() {
  const location = useLocation();
  const session = authClient.useSession();
  const userId = (session.data as { user: { id: string } } | null)?.user.id;
  const lastPage = useRef<string | null>(null);
  const lastUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (session.isPending) return;
    const user = userId || null;
    if (lastUser.current !== user) {
      resetAnalyticsVisitor();
      lastUser.current = user;
      void ensureAnalyticsVisitor();
    }
  }, [userId, session.isPending]);
  useEffect(() => {
    // Query changes can contain target URLs or auth/payment tokens; neither capture nor count them.
    if (
      location.pathname.startsWith("/admin") ||
      location.pathname === "/privacy"
    )
      return;
    if (lastPage.current === location.pathname) return;
    lastPage.current = location.pathname;
    void emitGrowthEvent({ name: "page_viewed" });
  }, [location.pathname]);
  return null;
}
