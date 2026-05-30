import type { H3Event } from "h3";

export const ANONYMOUS_OWNER = "anonymous@free-design-md.local";

export async function resolveOwner(_event: H3Event): Promise<string> {
  return ANONYMOUS_OWNER;
}
