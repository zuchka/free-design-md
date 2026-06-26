import { appBasePath } from "@agent-native/core/client";

export type DesignArtifactEventAction =
  | "copy"
  | "download"
  | "share_link_copy"
  | "public_snapshot_saved";

export type DesignArtifactEventSource =
  | "home"
  | "example"
  | "saved_design"
  | "saved_library";

export type DesignArtifactEventVariant =
  | "deterministic"
  | "enriched"
  | "iteration";

export type DesignArtifactEventFormat =
  | "markdown"
  | "html"
  | "mdx"
  | "link"
  | "snapshot"
  | "cli";

export interface DesignArtifactTrackingContext {
  source: DesignArtifactEventSource;
  variant: DesignArtifactEventVariant;
}

export interface DesignArtifactEvent extends DesignArtifactTrackingContext {
  action: DesignArtifactEventAction;
  format: DesignArtifactEventFormat;
}

export function recordDesignArtifactEvent(event: DesignArtifactEvent): void {
  if (typeof window === "undefined") return;

  const url = `${appBasePath()}/api/design-artifact-event`;
  const body = JSON.stringify(event);

  try {
    if (navigator.sendBeacon) {
      const queued = navigator.sendBeacon(
        url,
        new Blob([body], { type: "application/json" }),
      );
      if (queued) return;
    }
  } catch {
    // Fall through to fetch. Metrics must never break the user action.
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
