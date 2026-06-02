import {
  IconAlertTriangle,
  IconCheck,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import {
  useAgentActivity,
  type AgentActivityTone,
} from "@/lib/agent-activity";
import { cn } from "@/lib/utils";

export default function AgentActivityNotice() {
  const items = useAgentActivity();
  if (items.length === 0) return null;

  const [current, ...previous] = items;

  return (
    <div className="bg-muted/25 px-3 py-2">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
          <ActivityIcon tone={current.tone} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">
              {current.title}
            </span>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Activity
            </span>
          </div>
          {current.detail ? (
            <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
              {current.detail}
            </div>
          ) : null}
          {previous.length > 0 ? (
            <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-0.5 text-[10px] leading-4 text-muted-foreground">
              {previous.slice(0, 2).map((item) => (
                <span key={item.id} className="inline-flex min-w-0 items-center gap-1">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      item.tone === "error"
                        ? "bg-destructive"
                        : item.tone === "success"
                          ? "bg-emerald-600"
                          : "bg-muted-foreground/50",
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.title}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
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
