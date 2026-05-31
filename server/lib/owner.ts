import type { H3Event } from "h3";
import { getSession } from "@agent-native/core";

export const ANONYMOUS_OWNER = "anonymous@free-design-md.local";

export async function resolveOwner(event: H3Event): Promise<string> {
  try {
    const session = await getSession(event);
    if (session?.email && typeof session.email === "string") {
      return session.email;
    }
  } catch {
    // No session plugin configured or session read failed — fall through.
  }
  return ANONYMOUS_OWNER;
}
