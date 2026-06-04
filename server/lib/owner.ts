import type { H3Event } from "h3";
import { getCookie, setCookie } from "h3";
import { getSession } from "@agent-native/core";
import { randomUUID } from "node:crypto";
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

export function isAnonymousOwner(owner: string | null | undefined): boolean {
  return (
    owner === ANONYMOUS_OWNER ||
    /^anonymous:[a-zA-Z0-9_-]{8,128}@free-design-md\.local$/.test(
      owner ?? "",
    )
  );
}

export function getOrCreateAnonToken(event: H3Event): string {
  const existing = getCookie(event, FDMD_ANON_COOKIE);
  const safeExisting = existing ? safeAnonToken(existing) : null;
  if (safeExisting) return safeExisting;

  const token = randomUUID();
  setCookie(event, FDMD_ANON_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.PUBLIC_ORIGIN?.startsWith("https") ?? false,
  });
  return token;
}

export function anonymousOwnerForEvent(event: H3Event): string {
  return (
    anonymousOwnerForToken(getOrCreateAnonToken(event)) ?? ANONYMOUS_OWNER
  );
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

  return anonymousOwnerForEvent(event);
}
