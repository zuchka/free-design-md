import { useEffect, useState } from "react";
import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import {
  useAgentActivity,
  type AgentActivityItem,
  type AgentActivityTone,
} from "@/lib/agent-activity";
import { cn } from "@/lib/utils";

const SIDEBAR_STATE_CHANGE_EVENT = "agent-panel:state-change";

export default function AgentActivityRail() {
  const items = useAgentActivity();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      setSidebarOpen(localStorage.getItem("agent-native-sidebar-open") === "true");
    } catch {
      setSidebarOpen(false);
    }

    function handleStateChange(event: Event) {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setSidebarOpen(detail?.open === true);
    }

    window.addEventListener(SIDEBAR_STATE_CHANGE_EVENT, handleStateChange);
    return () =>
      window.removeEventListener(SIDEBAR_STATE_CHANGE_EVENT, handleStateChange);
  }, []);

  if (items.length === 0 || !sidebarOpen) return null;

  return (
    <aside
      aria-label="Agent activity"
      className="pointer-events-none fixed right-3 top-[4.25rem] z-[2150] hidden w-[min(356px,calc(100vw-1.5rem))] flex-col gap-2 md:flex"
    >
      <div className="rounded-md border border-border bg-background/95 p-2 shadow-lg backdrop-blur">
        <div className="mb-1 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
            <IconSparkles className="size-3.5" aria-hidden="true" />
            Activity
          </div>
        </div>
        <ol className="flex max-h-56 flex-col gap-1 overflow-hidden">
          {items.map((item, index) => (
            <ActivityRow key={item.id} item={item} muted={index > 0} />
          ))}
        </ol>
      </div>
    </aside>
  );
}

function ActivityRow({
  item,
  muted,
}: {
  item: AgentActivityItem;
  muted: boolean;
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[1.25rem_1fr] gap-2 rounded-md px-1.5 py-1.5",
        muted ? "opacity-70" : "bg-muted/45",
      )}
    >
      <span className="mt-0.5 flex justify-center">
        <ActivityIcon tone={item.tone} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">
          {item.title}
        </span>
        {item.detail ? (
          <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
            {item.detail}
          </span>
        ) : null}
      </span>
    </li>
  );
}

function ActivityIcon({ tone }: { tone: AgentActivityTone }) {
  if (tone === "running") {
    return (
      <IconLoader2
        className="size-3.5 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
    );
  }
  if (tone === "success") {
    return <IconCheck className="size-3.5 text-emerald-600" aria-hidden="true" />;
  }
  if (tone === "error") {
    return (
      <IconAlertTriangle
        className="size-3.5 text-destructive"
        aria-hidden="true"
      />
    );
  }
  return <IconSparkles className="size-3.5 text-primary" aria-hidden="true" />;
}
