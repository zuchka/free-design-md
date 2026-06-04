import type { H3Event } from "h3";
import { getCookie } from "h3";
import { getSession } from "@agent-native/core";
import { FDMD_ANON_COOKIE } from "./cookie-names";

export const ANONYMOUS_OWNER = "anonymous@free-design-md.local";

function safeAnonToken(token: string): string | null {
  const trimmed = token.trim();
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(trimmed)) return null;
  return trimmed;
}

export function anonymousOwnerForToken(token: string): string | null {
  const safe = safeAnonToken(token);
  return safe ? `anonymous:${safe}@free-design-md.local` : null;
}

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

export async function resolveAgentContextOwner(
  event: H3Event,
): Promise<string> {
  try {
    const session = await getSession(event);
    if (session?.email && typeof session.email === "string") {
      return session.email;
    }
  } catch {
    // No session plugin configured or session read failed — fall through.
  }

  const scopedAnonymous = anonymousOwnerForToken(
    getCookie(event, FDMD_ANON_COOKIE) ?? "",
  );
  return scopedAnonymous ?? ANONYMOUS_OWNER;
}
