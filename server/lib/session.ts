import { getCookie } from "h3";
import type { H3Event } from "h3";
import { eq, and, gt } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export interface SessionUser {
  userId: string;
  email: string;
  name: string | null;
}

export async function getMySession(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, "fdmd_session");
  if (!token) return null;

  const db = getDb();
  const now = new Date().toISOString();

  const sessions = await db
    .select()
    .from(schema.fdmdSessions)
    .where(and(eq(schema.fdmdSessions.token, token), gt(schema.fdmdSessions.expiresAt, now)))
    .limit(1);

  if (!sessions.length) return null;

  const users = await db
    .select()
    .from(schema.fdmdUsers)
    .where(eq(schema.fdmdUsers.id, sessions[0].userId))
    .limit(1);

  if (!users.length) return null;

  return {
    userId: users[0].id,
    email: users[0].email,
    name: users[0].name ?? null,
  };
}
