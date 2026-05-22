import { useBuilderConnectFlow } from "@agent-native/core/client";
import { IconCheck, IconExternalLink, IconLoader2 } from "@tabler/icons-react";

/**
 * Public-app harness attachment CTA.
 *
 * Ported from @agent-native/core's internal `BuilderConnectCta` (AssistantChat.js
 * line 1417). Opens the Builder.io cli-auth popup via `useBuilderConnectFlow`,
 * which owns the synchronous `window.open`, the 2s status poll, and the
 * focus-refresh. On success the framework persists credentials to `app_secrets`
 * and the card flips to "Connected".
 *
 * This is NOT user sign-in — the app is fully public. Connecting Builder just
 * attaches LLM credentials (free credits, no API key needed) so server-side
 * enrichment can route through Builder instead of the env ANTHROPIC_API_KEY.
 */
export default function BuilderConnectCta({
  variant = "primary",
  onConnected,
}: {
  variant?: "primary" | "compact";
  onConnected?: (state: { orgName: string | null }) => void;
}) {
  const { configured, orgName, connecting, error, start } = useBuilderConnectFlow({
    trackingSource: "free_design_md_navbar",
    onConnected,
  });

  const containerClass =
    variant === "compact"
      ? "rounded-md border border-border px-3 py-2.5"
      : "flex items-center gap-3 rounded-md border border-border px-3 py-3";

  if (configured) {
    return (
      <div className={containerClass}>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground">Builder.io</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {orgName ? `Connected — ${orgName}` : "Connected"}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
          <IconCheck size={10} />
          Connected
        </span>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground">Connect Builder.io</div>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">
          Free credits for LLM, hosting, and more — no API key needed
        </p>
        {error && (
          <p className="mt-1 text-[10px] text-destructive">{error}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => start()}
        disabled={connecting}
        className="ml-auto inline-flex items-center gap-1 shrink-0 rounded-md bg-foreground px-3 py-1.5 text-[11px] font-medium no-underline text-background hover:opacity-90 disabled:opacity-60 disabled:cursor-wait"
        aria-busy={connecting}
      >
        {connecting ? (
          <>
            <IconLoader2 size={10} className="animate-spin" />
            Waiting…
          </>
        ) : (
          <>
            Connect
            <IconExternalLink size={10} />
          </>
        )}
      </button>
    </div>
  );
}
