import {
  defineEventHandler,
  getQuery,
  getCookie,
  setCookie,
  deleteCookie,
  sendRedirect,
  createError,
} from "h3";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../../../../db/index.js";
import { ensureQuota } from "../../../../lib/builder-quota.js";

const SESSION_TTL_DAYS = 30;
const BUILDER_USERS_API = "https://builder.io/api/v1/users";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const bpk = typeof query["p-key"] === "string" ? query["p-key"] : null;
  const userId = typeof query["user-id"] === "string" ? query["user-id"] : null;
  const apiKey = typeof query["api-key"] === "string" ? query["api-key"] : null;
  const stateParam = typeof query.state === "string" ? query.state : null;

  if (!bpk || !userId || !apiKey || !stateParam) {
    throw createError({ statusCode: 400, statusMessage: "Missing required callback params" });
  }

  let statePayload: { nonce: string; return: string };
  try {
    statePayload = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as {
      nonce: string;
      return: string;
    };
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Invalid state" });
  }

  const stateCookie = getCookie(event, "fdmd_auth_state");
  if (!stateCookie || stateCookie !== statePayload.nonce) {
    throw createError({ statusCode: 400, statusMessage: "State mismatch — possible CSRF" });
  }
  deleteCookie(event, "fdmd_auth_state", { path: "/" });

  // Verify identity with Builder.io
  const verifyRes = await fetch(`${BUILDER_USERS_API}/${userId}?apiKey=${apiKey}`, {
    headers: { Authorization: `Bearer ${bpk}` },
  }).catch(() => null);

  if (!verifyRes?.ok) {
    throw createError({ statusCode: 502, statusMessage: "Builder.io identity verification failed" });
  }

  const builderUser = (await verifyRes.json()) as { email?: string; name?: string };
  const email = builderUser.email;
  if (!email) {
    throw createError({ statusCode: 502, statusMessage: "No email in Builder.io response" });
  }

  const db = getDb();

  // Upsert user
  const existing = await db
    .select({ id: schema.fdmdUsers.id })
    .from(schema.fdmdUsers)
    .where(eq(schema.fdmdUsers.id, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.fdmdUsers).values({
      id: userId,
      email,
      name: builderUser.name ?? null,
    });
    await ensureQuota(userId);
  }

  // Mint session
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  await db.insert(schema.fdmdSessions).values({ token, userId, expiresAt });

  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  setCookie(event, "fdmd_session", token, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 86_400,
    path: "/",
  });

  const returnPath =
    statePayload.return && statePayload.return.startsWith("/") ? statePayload.return : "/";
  return sendRedirect(event, returnPath, 302);
});
