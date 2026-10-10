import { appBasePath } from "./base-path";
import { emitGrowthEvent } from "./growth-analytics";

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
  artifactId?: string;
  source: DesignArtifactEventSource;
  variant: DesignArtifactEventVariant;
}

export interface DesignArtifactEvent extends DesignArtifactTrackingContext {
  action: DesignArtifactEventAction;
  format: DesignArtifactEventFormat;
}

export function recordDesignArtifactEvent(event: DesignArtifactEvent): void {
  if (typeof window === "undefined") return;

  if (event.action !== "public_snapshot_saved" && event.format !== "snapshot") {
    void emitGrowthEvent(
      {
        name:
          event.action === "copy"
            ? "artifact_copied"
            : event.action === "download"
              ? "artifact_downloaded"
              : "share_link_copied",
        artifactId: event.artifactId,
        surface: event.source,
        page:
          event.source === "example"
            ? "examples"
            : event.source === "saved_design"
              ? "public_snapshot"
              : "workspace",
        variant: event.variant,
        format: event.format,
      },
      true,
    );
    return;
  }

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
