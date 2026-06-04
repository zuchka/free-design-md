import type { H3Event } from "h3";
import { resolveConnectedBuilderQuotaOwner } from "./builder-connection.js";
import { ANONYMOUS_OWNER, resolveOwner } from "./owner.js";

export async function resolveQuotaOwner(
  event: H3Event,
): Promise<string | null> {
  const owner = await resolveOwner(event);
  if (owner !== ANONYMOUS_OWNER) return owner;
  return await resolveConnectedBuilderQuotaOwner(owner);
}
