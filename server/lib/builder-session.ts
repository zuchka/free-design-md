import { randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "fdmd_session";
export const STATE_COOKIE_NAME = "fdmd_oauth_state";

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const STATE_MAX_AGE_SECONDS = 10 * 60;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiryDate(from: Date = new Date()): string {
  return new Date(from.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}

import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export interface SessionUserFields {
  userId: string;
  email: string;
  name: string | null;
}

export async function upsertUser(user: {
  id: string;
  email: string;
  name: string | null;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.fdmdUsers)
    .values({ id: user.id, email: user.email, name: user.name })
    .onConflictDoUpdate({
      target: schema.fdmdUsers.id,
      set: { email: user.email, name: user.name },
    });
}

export async function createSession(
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = generateSessionToken();
  const expiresAt = sessionExpiryDate();
  const db = getDb();
  await db.insert(schema.fdmdSessions).values({ token, userId, expiresAt });
  return { token, expiresAt };
}

export async function lookupSession(
  token: string,
): Promise<SessionUserFields | null> {
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({
      userId: schema.fdmdSessions.userId,
      expiresAt: schema.fdmdSessions.expiresAt,
      email: schema.fdmdUsers.email,
      name: schema.fdmdUsers.name,
    })
    .from(schema.fdmdSessions)
    .innerJoin(
      schema.fdmdUsers,
      eq(schema.fdmdSessions.userId, schema.fdmdUsers.id),
    )
    .where(eq(schema.fdmdSessions.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;
  return { userId: row.userId, email: row.email, name: row.name };
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  const db = getDb();
  await db.delete(schema.fdmdSessions).where(eq(schema.fdmdSessions.token, token));
}
