import { useEffect, useMemo, useState } from "react";
import { AgentPanel } from "@agent-native/core/client";
import { cn } from "@/lib/utils";
import AgentActivityNotice from "@/components/AgentActivityNotice";
import { getBrowserTabId } from "@/lib/browser-tab-id";

const SIDEBAR_OPEN_KEY = "agent-native-sidebar-open";
const SIDEBAR_WIDTH = 380;
const MOBILE_QUERY = "(max-width: 767px)";

interface AppAgentSidebarProps {
  children: React.ReactNode;
  emptyStateText: string;
  suggestions: string[];
}

export default function AppAgentSidebar({
  children,
  emptyStateText,
  suggestions,
}: AppAgentSidebarProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [browserTabId, setBrowserTabId] = useState<string>();

  useEffect(() => {
    setBrowserTabId(getBrowserTabId());
  }, []);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const readInitialOpen = () => {
      if (media.matches) return false;
      try {
        return localStorage.getItem(SIDEBAR_OPEN_KEY) === "true";
      } catch {
        return false;
      }
    };

    setIsMobile(media.matches);
    setOpen(readInitialOpen());

    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (event.matches) setOpen(false);
    };
    media.addEventListener("change", handleMediaChange);
    return () => media.removeEventListener("change", handleMediaChange);
  }, []);

  useEffect(() => {
    function setOpenPersisted(next: boolean) {
      setOpen(next);
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      } catch {
        // localStorage is non-critical for sidebar state.
      }
    }

    function toggleHandler() {
      setOpen((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
        } catch {
          // localStorage is non-critical for sidebar state.
        }
        return next;
      });
    }
    function openHandler() {
      setOpenPersisted(true);
    }
    function closeHandler() {
      setOpenPersisted(false);
    }

    window.addEventListener("agent-panel:toggle", toggleHandler);
    window.addEventListener("agent-panel:open", openHandler);
    window.addEventListener("agent-panel:close", closeHandler);
    return () => {
      window.removeEventListener("agent-panel:toggle", toggleHandler);
      window.removeEventListener("agent-panel:open", openHandler);
      window.removeEventListener("agent-panel:close", closeHandler);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("agent-panel:state-change", {
        detail: { open, source: "app", mode: "app" },
      }),
    );
  }, [open]);

  const panelStyle = useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
        position: "fixed",
        top: 0,
        right: 0,
        height: "100%",
        width: SIDEBAR_WIDTH,
        maxWidth: "85vw",
        zIndex: 2200,
        background: "hsl(var(--background))",
        borderLeft: "1px solid hsl(var(--border))",
        display: open ? "flex" : "none",
      };
    }
    return {
      width: SIDEBAR_WIDTH,
      maxHeight: "100vh",
      borderLeft: "1px solid hsl(var(--border))",
      display: open ? "flex" : "none",
    };
  }, [isMobile, open]);

  return (
    <div className="flex h-screen min-w-0 flex-1 overflow-hidden">
      {isMobile && open ? (
        <button
          type="button"
          aria-label="Close agent sidebar"
          className="fixed inset-0 z-[2199] bg-black/40"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </div>
      <aside
        className={cn(
          "agent-sidebar-panel shrink-0 flex-col overflow-hidden text-[13px] leading-[1.2] antialiased",
          isMobile && "shadow-2xl",
        )}
        style={panelStyle}
      >
        {open ? (
          <AgentPanel
            browserTabId={browserTabId}
            emptyStateText={emptyStateText}
            suggestions={suggestions}
            chatNotice={<AgentActivityNotice />}
            onCollapse={() => setOpen(false)}
          />
        ) : null}
      </aside>
    </div>
  );
}
