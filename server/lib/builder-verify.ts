export interface VerifiedBuilderUser {
  id: string;
  email: string;
  name: string | null;
}

export interface VerifyArgs {
  userId: string;
  apiKey: string;
  privateKey: string; // bpk-… — used once, then discarded.
}

/**
 * Verify a Builder.io identity returned by the `/cli-auth` callback.
 *
 * Calls `GET https://builder.io/api/v1/users/:id?apiKey=…` with the
 * BPK as a bearer token. The endpoint enforces that the BPK's org
 * actually contains this user, so a successful 200 with matching id
 * is proof the user identity is genuine. We do NOT store the BPK —
 * the caller discards it after this returns.
 *
 * `fetchImpl` is injected so tests can mock without monkey-patching
 * globals.
 */
export async function verifyBuilderUser(
  args: VerifyArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedBuilderUser> {
  const url = `https://builder.io/api/v1/users/${encodeURIComponent(args.userId)}?apiKey=${encodeURIComponent(args.apiKey)}`;
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${args.privateKey}` },
  });

  if (!res.ok) {
    throw new Error(
      `Builder.io identity verification failed: ${res.status} ${res.statusText}`,
    );
  }

  const body = (await res.json()) as {
    id?: string;
    email?: string;
    name?: string | null;
  };

  if (body.id !== args.userId) {
    throw new Error(
      `Builder.io identity verification failed: id mismatch (expected ${args.userId}, got ${body.id ?? "undefined"})`,
    );
  }
  if (!body.email || typeof body.email !== "string") {
    throw new Error("Builder.io identity verification failed: email missing");
  }

  return {
    id: body.id,
    email: body.email,
    name: typeof body.name === "string" ? body.name : null,
  };
}

import {
  upsertUser,
  createSession,
} from "./builder-session.js";
import { ensureQuota } from "./builder-quota.js";

export type CallbackResult =
  | {
      ok: true;
      sessionToken: string;
      user: { id: string; email: string; name: string | null };
    }
  | { ok: false; reason: "verification_failed" };

export async function handleCallback(
  args: VerifyArgs,
  fetchImpl: typeof fetch = fetch,
): Promise<CallbackResult> {
  let verified: VerifiedBuilderUser;
  try {
    verified = await verifyBuilderUser(args, fetchImpl);
  } catch {
    return { ok: false, reason: "verification_failed" };
  }

  const localUserId = `builder-${verified.id}`;
  await upsertUser({
    id: localUserId,
    email: verified.email,
    name: verified.name,
  });
  await ensureQuota(localUserId);
  const { token } = await createSession(localUserId);
  return {
    ok: true,
    sessionToken: token,
    user: { id: localUserId, email: verified.email, name: verified.name },
  };
}
