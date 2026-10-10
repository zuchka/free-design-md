import { appPath } from "./base-path";
import {
  analyticsPage,
  type ClientAnalyticsEvent,
} from "../../shared/analytics";

let bootstrap: Promise<boolean> | undefined;
export function resetAnalyticsVisitor() {
  // Serialize refreshes so an auth change cannot race the initial Set-Cookie.
  bootstrap = bootstrap ? bootstrap.then(() => bootstrapVisitor()) : undefined;
}
async function bootstrapVisitor(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  return fetch(appPath("/api/analytics/visitor"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(3000),
    body: JSON.stringify({
      referrer: document.referrer,
      source: params.get("utm_source") || undefined,
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
    }),
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((result) => Boolean(result?.enabled))
    .catch(() => false);
}
export function ensureAnalyticsVisitor(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return (bootstrap ??= bootstrapVisitor());
}
export async function emitGrowthEvent(
  event: Omit<ClientAnalyticsEvent, "id" | "page"> & {
    page?: ClientAnalyticsEvent["page"];
  },
  operational = false,
) {
  if (typeof window === "undefined") return;
  const id = crypto.randomUUID();
  const enabled = await ensureAnalyticsVisitor();
  if (!enabled && !operational) return;
  const body = JSON.stringify({
    ...event,
    id,
    page: event.page || analyticsPage(window.location.pathname),
  });
  const url = appPath("/api/analytics/events");
  try {
    if (
      navigator.sendBeacon?.(
        url,
        new Blob([body], { type: "application/json" }),
      )
    )
      return;
  } catch {
    /* fetch fallback */
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
