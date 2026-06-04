import type { H3Event } from "h3";
import { resolveConnectedBuilderQuotaOwner } from "./builder-connection.js";
import {
  isAnonymousOwner,
  resolveAgentContextOwner,
} from "./owner.js";

export async function resolveQuotaOwner(
  event: H3Event,
): Promise<string | null> {
  const owner = await resolveAgentContextOwner(event);
  if (!isAnonymousOwner(owner)) return owner;
  return await resolveConnectedBuilderQuotaOwner(owner);
}
