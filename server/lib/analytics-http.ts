import { sameOrigin } from "./analytics-identity.js";
import { analyticsHealth } from "./analytics-db.js";

const limits = new Map<string, { count: number; until: number }>();
export async function readAnalyticsBody(request: Request): Promise<unknown> {
  if (!sameOrigin(request))
    throw new Response("Same-origin request required", { status: 403 });
  // Only use the edge-overwritten address for transient abuse control; never persist it.
  const key = request.headers.get("x-real-ip") || "local";
  const now = Date.now();
  if (limits.size > 10000) {
    for (const [key, value] of limits)
      if (value.until < now) limits.delete(key);
  }
  const limit = limits.get(key);
  if (limit && limit.until > now) {
    if (++limit.count > 120) {
      analyticsHealth.dropped++;
      throw new Response("Too many events", { status: 429 });
    }
  } else {
    if (limits.size > 10000) throw new Response("Try later", { status: 429 });
    limits.set(key, { count: 1, until: now + 60000 });
  }
  if (Number(request.headers.get("content-length")) > 4096)
    throw new Response("Event too large", { status: 413 });
  const reader = request.body?.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  if (reader)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 4096) {
        await reader.cancel();
        throw new Response("Event too large", { status: 413 });
      }
      chunks.push(value);
    }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new Response("Invalid event", { status: 400 });
  }
}
export const analyticsHeaders = { "Cache-Control": "private, no-store" };
