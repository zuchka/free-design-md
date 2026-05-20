# Phase 2 — Builder.io SSO integration plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the localStorage-mocked "Sign in with Builder.io" flow with a real, redirect-based integration against Builder.io's existing `/cli-auth` endpoint, while keeping all user/session/quota state in this app's local SQLite (no Builder-side database changes).

**Architecture:** Hybrid — Builder.io uses Firebase Auth (no public OAuth endpoints), so we can't use `better-auth`'s `genericOAuth` plugin against it. Instead we lean on Builder's existing partner-redirect flow (`/cli-auth`), verify the returned `{ user-id, api-key, p-key }` payload by calling `GET https://builder.io/api/v1/users/:id`, discard the BPK after verification, mint our own opaque session token, and feed identity back into the framework via the `AuthOptions.getSession` BYOA escape hatch. The existing client-side auth seam (`app/lib/auth/{index,mock-auth,real-auth}.ts`) is the contract — only `real-auth.ts` changes shape. The framework's marketing/sign-in page is never invoked because `/` stays in `publicPaths` and our `SignInModal` is the entry point.

**Tech Stack:**
- `@agent-native/core` (h3/Nitro server, better-auth under the hood with our own `getSession` override)
- Drizzle ORM over SQLite (`server/db/schema.ts`)
- React Router 7 + `useSyncExternalStore` (existing seam)
- Vitest + happy-dom for client tests, Node for server tests
- Builder.io endpoints: `/cli-auth`, `/api/v1/users/:id`

---

## Background — why this design

The two prior research passes established:

1. **Builder.io has no OAuth 2.0 endpoint.** Auth is Firebase Auth (project `builder-3b0a2`). The closest thing to a partner identity flow is `/cli-auth`, used today by the CLI and Figma plugin. It accepts a `redirect_url` (allowlisted), forwards unauthenticated users to `/login` or `/signup` (the signup page already reads `signupSource=agent-native` attribution via `getAgentNativeSignupAttribution()`), and on user-clicked Authorize returns `?p-key=bpk-…&user-id=…&api-key=…&org-name=…` to the redirect URL.
2. **Agent-native's `createAuthPlugin` exposes a `getSession` escape hatch** (`AuthOptions.getSession` in `node_modules/@agent-native/core/dist/server/auth.d.ts`). When set, better-auth is bypassed entirely and the framework reads our function. This means `getSession(event)` in `server/handlers/request-auth-context.ts:13` and every other call site continues to work transparently.

The integration therefore needs:

- A small custom redirect flow (start → cli-auth → callback → verify → mint session).
- Three new SQLite tables (users, sessions, quota), all additive.
- An `options.getSession` implementation that reads our cookie and returns an `AuthSession { email, userId, name }`.
- A replacement for `real-auth.ts` that talks to the new server endpoints.

## Files (full inventory)

**Create:**
- `server/lib/builder-verify.ts` — Pure function: verify a Builder identity via `GET /api/v1/users/:id`.
- `server/lib/builder-verify.test.ts`
- `server/lib/builder-session.ts` — Pure functions: create/read/delete session rows; token generation; cookie attr helpers.
- `server/lib/builder-session.test.ts`
- `server/lib/builder-quota.ts` — Pure functions: ensure-quota-row, atomic decrement, read remaining.
- `server/lib/builder-quota.test.ts`
- `server/routes/api/auth/builder/start.get.ts` — Issues 302 to `https://builder.io/cli-auth`, sets state cookie.
- `server/routes/api/auth/builder/callback.get.ts` — Validates state, calls verify, mints session, redirects back.
- `server/routes/api/auth/builder/signout.post.ts` — Clears session cookie and row.
- `server/routes/api/auth/me.get.ts` — Returns `{ email, name, remaining }` for the current session, or 401.
- `app/lib/auth/real-auth.test.ts` — Mirror of `mock-auth.test.ts` with `fetch` mocked.

**Modify:**
- `server/db/schema.ts` — Add `fdmdUsers`, `fdmdSessions`, `fdmdQuota` tables.
- `server/plugins/auth.ts` — Add `getSession: builderGetSession`; add new `/api/auth/...` paths to `publicPaths` so the framework's guard doesn't block them.
- `server/routes/api/enrich-design-md.post.ts` — Gate on session + decrement quota server-side before streaming.
- `app/lib/auth/real-auth.ts` — Replace throwing stubs with fetch-based implementation.
- `app/components/auth/SignInModal.tsx` — Replace `signIn("matt@builder.io")` with redirect to `/api/auth/builder/start`.
- `.env.example` — Document `PUBLIC_ORIGIN`, `BUILDER_CLIENT_ID`.
- `CLAUDE.md` — Document the new auth flow + env vars.

## Risks / prerequisites

1. **Redirect-URL allowlist.** `/cli-auth`'s `isAllowedRedirectUrl()` (in `~/code/builder-internal/packages/app/components/CLIAuthPage.tsx:28`) accepts `*.agent-native.com`, `*.builder.io`, and `localhost` today. **Local dev works out of the box**; production needs either (a) a one-line PR adding our prod hostname, or (b) hosting under `*.agent-native.com`. Decide which before merging this work to prod.
2. **CSRF state parameter.** `/cli-auth` doesn't pass through an arbitrary `state` query param. We append our state to the `redirect_url` itself (`?state=<nonce>`) and verify on callback. Tested in Task 5.
3. **BPK handling.** The `p-key=bpk-…` returned by `/cli-auth` is org-scoped and powerful. We use it only for the one-shot verification call, **then discard**. Never write it to the DB.
4. **Multi-org users.** A Builder user with multiple orgs gets a BPK scoped to whichever org was active at `/cli-auth` time. Our quota is keyed on `builderUserId` (not org), so this doesn't affect functionality, just noted.
5. **Cookie domain.** Set cookie scoped to the request host (no `Domain=` attribute) so it doesn't leak across subdomains. `httpOnly`, `Secure` (in prod), `SameSite=Lax`.

---

## Conventions used across all tasks

- **Table prefix:** `fdmd_` (free-design-md) on every new table so future framework tables can't collide.
- **Session cookie name:** `fdmd_session`. 30-day Max-Age. Value: `crypto.randomBytes(32).toString("base64url")` opaque token. Server lookup against `fdmd_sessions` is the source of truth.
- **State cookie name:** `fdmd_oauth_state`. 10-minute Max-Age. Random opaque value compared verbatim on callback.
- **Quota default:** 3, seeded on first verified callback. Subsequent sign-ins do NOT reset (matches mock-auth behavior).
- **Env vars:**
  - `PUBLIC_ORIGIN` — e.g. `https://free-design-md.up.railway.app`. Required in prod; defaults to request origin in dev.
  - `BUILDER_CLIENT_ID` — string sent as `client_id` to `/cli-auth`. Default `"free-design-md"`.
- **Tests:** vitest. Server tests run in default `node` env; client tests use `// @vitest-environment happy-dom` per the existing pattern in `app/lib/auth/mock-auth.test.ts`.

---

### Task 1: Add SQLite tables for users, sessions, and quota

**Files:**
- Modify: `server/db/schema.ts`

- [ ] **Step 1: Add the three table definitions to `server/db/schema.ts` after the existing `enrichmentCache` table**

Append to `/Users/builder-matt/code/free-design-md/server/db/schema.ts`:

```ts
/**
 * Identity records for users who signed in via Builder.io.
 * The `id` is the Builder user ID prefixed with `builder-` so future
 * identity providers can coexist (e.g. `google-…`).
 *
 * We do NOT store the BPK that Builder returns at callback time —
 * it's used once for verification and discarded.
 */
export const fdmdUsers = table("fdmd_users", {
  id: text("id").primaryKey(), // "builder-${builderUserId}"
  email: text("email").notNull(),
  name: text("name"),
  createdAt: text("created_at").notNull().default(now()),
});

/**
 * Opaque server-side session tokens. The token in the cookie is
 * meaningless without a matching row here.
 */
export const fdmdSessions = table("fdmd_sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(now()),
});

/**
 * Per-user AI-enrichment quota. Seeded to 3 on the user's first
 * verified callback. Decremented atomically by the enrich endpoint
 * on successful completion.
 */
export const fdmdQuota = table("fdmd_quota", {
  userId: text("user_id").primaryKey(),
  enrichCount: integer("enrich_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});
```

- [ ] **Step 2: Run typecheck to verify the schema compiles**

Run: `pnpm typecheck`
Expected: silent success (existing convention — `agent-native typecheck` exits 0 on success).

- [ ] **Step 3: Commit**

```bash
git add server/db/schema.ts
git commit -m "feat(auth): add SQLite tables for Builder.io SSO users, sessions, and quota"
```

---

### Task 2: Token generation and cookie helpers

**Files:**
- Create: `server/lib/builder-session.ts`
- Create: `server/lib/builder-session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  sessionExpiryDate,
  SESSION_COOKIE_NAME,
  STATE_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  STATE_MAX_AGE_SECONDS,
} from "./builder-session.js";

describe("builder-session token + constants", () => {
  it("generateSessionToken returns a unique base64url string", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 base64url chars (no padding).
    expect(a.length).toBeGreaterThanOrEqual(43);
  });

  it("sessionExpiryDate returns an ISO string ~30 days in the future", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = new Date(sessionExpiryDate(now));
    const diffMs = expiry.getTime() - now.getTime();
    const days = diffMs / (1000 * 60 * 60 * 24);
    expect(days).toBeCloseTo(30, 0);
  });

  it("cookie names and max-ages match documented conventions", () => {
    expect(SESSION_COOKIE_NAME).toBe("fdmd_session");
    expect(STATE_COOKIE_NAME).toBe("fdmd_oauth_state");
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(STATE_MAX_AGE_SECONDS).toBe(10 * 60);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test server/lib/builder-session.test.ts`
Expected: FAIL with "Cannot find module './builder-session.js'".

- [ ] **Step 3: Implement the module**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-session.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test server/lib/builder-session.test.ts`
Expected: PASS — 3/3 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/builder-session.ts server/lib/builder-session.test.ts
git commit -m "feat(auth): add session token + cookie constants for Builder.io SSO"
```

---

### Task 3: Session CRUD against SQLite

**Files:**
- Modify: `server/lib/builder-session.ts`
- Modify: `server/lib/builder-session.test.ts`

- [ ] **Step 1: Add the failing tests for session CRUD**

Append to `/Users/builder-matt/code/free-design-md/server/lib/builder-session.test.ts`:

```ts
import { beforeEach } from "vitest";
import { getDb, schema } from "../db/index.js";
import {
  createSession,
  lookupSession,
  deleteSession,
  upsertUser,
} from "./builder-session.js";

describe("builder-session CRUD", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdSessions);
    await db.delete(schema.fdmdUsers);
  });

  it("upsertUser inserts on first call and updates on subsequent calls", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matthew",
    });
    const db = getDb();
    const rows = await db.select().from(schema.fdmdUsers);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Matthew");
  });

  it("createSession + lookupSession round-trips and returns user fields", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    const { token } = await createSession("builder-abc123");
    const session = await lookupSession(token);
    expect(session).toEqual({
      userId: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
  });

  it("lookupSession returns null for an unknown token", async () => {
    expect(await lookupSession("not-a-real-token")).toBeNull();
  });

  it("lookupSession returns null for an expired session", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: null,
    });
    const db = getDb();
    await db.insert(schema.fdmdSessions).values({
      token: "expired-token",
      userId: "builder-abc123",
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await lookupSession("expired-token")).toBeNull();
  });

  it("deleteSession removes the row", async () => {
    await upsertUser({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: null,
    });
    const { token } = await createSession("builder-abc123");
    await deleteSession(token);
    expect(await lookupSession(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test server/lib/builder-session.test.ts`
Expected: FAIL — `upsertUser`, `createSession`, `lookupSession`, `deleteSession` not exported.

- [ ] **Step 3: Implement the CRUD functions**

Append to `/Users/builder-matt/code/free-design-md/server/lib/builder-session.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test server/lib/builder-session.test.ts`
Expected: PASS — all tests green (3 from Task 2 + 5 from this task = 8 total).

- [ ] **Step 5: Commit**

```bash
git add server/lib/builder-session.ts server/lib/builder-session.test.ts
git commit -m "feat(auth): add session and user CRUD helpers"
```

---

### Task 4: Builder identity verification via `/api/v1/users/:id`

**Files:**
- Create: `server/lib/builder-verify.ts`
- Create: `server/lib/builder-verify.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-verify.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { verifyBuilderUser } from "./builder-verify.js";

describe("verifyBuilderUser", () => {
  it("returns the verified user on a successful 200 response", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "abc123",
          email: "matt@builder.io",
          name: "Matt",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await verifyBuilderUser(
      {
        userId: "abc123",
        apiKey: "0123456789abcdef",
        privateKey: "bpk-deadbeef",
      },
      fetchMock,
    );

    expect(result).toEqual({
      id: "abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://builder.io/api/v1/users/abc123?apiKey=0123456789abcdef",
    );
    expect((init as RequestInit).headers).toEqual({
      Authorization: "Bearer bpk-deadbeef",
    });
  });

  it("throws if the id in the response doesn't match the requested id", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "different", email: "x@y.z" }), {
        status: 200,
      }),
    );

    await expect(
      verifyBuilderUser(
        { userId: "abc123", apiKey: "k", privateKey: "bpk-x" },
        fetchMock,
      ),
    ).rejects.toThrow(/id mismatch/);
  });

  it("throws on a non-200 response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 403 }));

    await expect(
      verifyBuilderUser(
        { userId: "abc123", apiKey: "k", privateKey: "bpk-x" },
        fetchMock,
      ),
    ).rejects.toThrow(/verification failed/);
  });

  it("throws if email is missing from the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "abc123" }), { status: 200 }),
      );

    await expect(
      verifyBuilderUser(
        { userId: "abc123", apiKey: "k", privateKey: "bpk-x" },
        fetchMock,
      ),
    ).rejects.toThrow(/email missing/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test server/lib/builder-verify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the verifier**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-verify.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test server/lib/builder-verify.test.ts`
Expected: PASS — 4/4 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/builder-verify.ts server/lib/builder-verify.test.ts
git commit -m "feat(auth): verify Builder.io identities via /api/v1/users/:id"
```

---

### Task 5: Quota CRUD

**Files:**
- Create: `server/lib/builder-quota.ts`
- Create: `server/lib/builder-quota.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-quota.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, schema } from "../db/index.js";
import {
  ensureQuota,
  quotaRemaining,
  consumeQuota,
  QUOTA_DEFAULT,
} from "./builder-quota.js";

describe("builder-quota", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdQuota);
  });

  it("QUOTA_DEFAULT is 3 to match mock-auth", () => {
    expect(QUOTA_DEFAULT).toBe(3);
  });

  it("ensureQuota seeds the row to the default on first call", async () => {
    await ensureQuota("builder-abc123");
    expect(await quotaRemaining("builder-abc123")).toBe(3);
  });

  it("ensureQuota is idempotent — does not reset existing rows", async () => {
    await ensureQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    expect(await quotaRemaining("builder-abc123")).toBe(1);
    await ensureQuota("builder-abc123");
    expect(await quotaRemaining("builder-abc123")).toBe(1);
  });

  it("quotaRemaining returns QUOTA_DEFAULT for an unseen user", async () => {
    expect(await quotaRemaining("builder-never-seen")).toBe(3);
  });

  it("consumeQuota decrements and returns ok=true while > 0", async () => {
    await ensureQuota("builder-abc123");
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: true,
      remaining: 2,
    });
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: true,
      remaining: 1,
    });
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: true,
      remaining: 0,
    });
  });

  it("consumeQuota refuses to go below zero and reports ok=false", async () => {
    await ensureQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    await consumeQuota("builder-abc123");
    expect(await consumeQuota("builder-abc123")).toEqual({
      ok: false,
      remaining: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test server/lib/builder-quota.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the quota helpers**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-quota.ts`:

```ts
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";

export const QUOTA_DEFAULT = 3;

export async function ensureQuota(userId: string): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.fdmdQuota)
    .values({ userId, enrichCount: 0 })
    .onConflictDoNothing({ target: schema.fdmdQuota.userId });
}

export async function quotaRemaining(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ enrichCount: schema.fdmdQuota.enrichCount })
    .from(schema.fdmdQuota)
    .where(eq(schema.fdmdQuota.userId, userId))
    .limit(1);
  const used = rows[0]?.enrichCount ?? 0;
  return Math.max(0, QUOTA_DEFAULT - used);
}

/**
 * Atomically decrement remaining quota.
 *
 * Uses a WHERE-guarded UPDATE so concurrent calls can't push the
 * count past QUOTA_DEFAULT. SQLite serializes writes, so the second
 * caller sees the post-update state. If the user has no row yet,
 * insert one first.
 */
export async function consumeQuota(
  userId: string,
): Promise<{ ok: boolean; remaining: number }> {
  await ensureQuota(userId);
  const db = getDb();
  const result = await db
    .update(schema.fdmdQuota)
    .set({
      enrichCount: sql`${schema.fdmdQuota.enrichCount} + 1`,
      updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
    })
    .where(
      sql`${schema.fdmdQuota.userId} = ${userId} AND ${schema.fdmdQuota.enrichCount} < ${QUOTA_DEFAULT}`,
    )
    .returning({ enrichCount: schema.fdmdQuota.enrichCount });

  if (result.length === 0) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: Math.max(0, QUOTA_DEFAULT - result[0].enrichCount) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test server/lib/builder-quota.test.ts`
Expected: PASS — 6/6 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/builder-quota.ts server/lib/builder-quota.test.ts
git commit -m "feat(auth): add per-user quota helpers backed by SQLite"
```

---

### Task 6: Pure verify-and-create-session orchestrator (for the callback handler)

**Files:**
- Modify: `server/lib/builder-verify.ts`
- Modify: `server/lib/builder-verify.test.ts`

This pulls the multi-step callback logic into a pure function so we can test it without h3 plumbing.

- [ ] **Step 1: Add the failing tests**

Append to `/Users/builder-matt/code/free-design-md/server/lib/builder-verify.test.ts`:

```ts
import { beforeEach } from "vitest";
import { getDb, schema } from "../db/index.js";
import { handleCallback } from "./builder-verify.js";
import { lookupSession } from "./builder-session.js";

describe("handleCallback", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.delete(schema.fdmdSessions);
    await db.delete(schema.fdmdUsers);
    await db.delete(schema.fdmdQuota);
  });

  it("verifies, upserts the user, seeds quota, and creates a session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "abc123",
          email: "matt@builder.io",
          name: "Matt",
        }),
        { status: 200 },
      ),
    );

    const result = await handleCallback(
      {
        userId: "abc123",
        apiKey: "key",
        privateKey: "bpk-x",
      },
      fetchMock,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.user).toEqual({
      id: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
    expect(typeof result.sessionToken).toBe("string");
    expect(result.sessionToken.length).toBeGreaterThanOrEqual(43);

    const session = await lookupSession(result.sessionToken);
    expect(session).toEqual({
      userId: "builder-abc123",
      email: "matt@builder.io",
      name: "Matt",
    });
  });

  it("returns ok:false with a typed reason on verification failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 403 }));

    const result = await handleCallback(
      {
        userId: "abc123",
        apiKey: "key",
        privateKey: "bpk-x",
      },
      fetchMock,
    );

    expect(result).toEqual({ ok: false, reason: "verification_failed" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test server/lib/builder-verify.test.ts`
Expected: FAIL — `handleCallback` not exported.

- [ ] **Step 3: Implement `handleCallback`**

Append to `/Users/builder-matt/code/free-design-md/server/lib/builder-verify.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test server/lib/builder-verify.test.ts`
Expected: PASS — 6/6 tests green (4 from Task 4 + 2 from this task).

- [ ] **Step 5: Commit**

```bash
git add server/lib/builder-verify.ts server/lib/builder-verify.test.ts
git commit -m "feat(auth): add handleCallback orchestrator (verify → upsert → seed quota → session)"
```

---

### Task 7: Public-origin and redirect-URL helper

**Files:**
- Create: `server/lib/builder-redirect.ts`
- Create: `server/lib/builder-redirect.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-redirect.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  publicOrigin,
  buildCliAuthUrl,
  buildCallbackUrl,
} from "./builder-redirect.js";

describe("publicOrigin", () => {
  const previousOrigin = process.env.PUBLIC_ORIGIN;
  beforeEach(() => {
    delete process.env.PUBLIC_ORIGIN;
  });
  afterEach(() => {
    if (previousOrigin === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = previousOrigin;
  });

  it("returns PUBLIC_ORIGIN when set", () => {
    process.env.PUBLIC_ORIGIN = "https://example.com";
    expect(publicOrigin("http://fallback")).toBe("https://example.com");
  });

  it("falls back to the request origin when PUBLIC_ORIGIN is unset", () => {
    expect(publicOrigin("http://localhost:8080")).toBe("http://localhost:8080");
  });

  it("strips a trailing slash from PUBLIC_ORIGIN", () => {
    process.env.PUBLIC_ORIGIN = "https://example.com/";
    expect(publicOrigin("http://fallback")).toBe("https://example.com");
  });
});

describe("buildCallbackUrl", () => {
  it("appends ?state to the callback URL", () => {
    expect(
      buildCallbackUrl("https://example.com", "nonce-abc"),
    ).toBe(
      "https://example.com/api/auth/builder/callback?state=nonce-abc",
    );
  });
});

describe("buildCliAuthUrl", () => {
  it("constructs the /cli-auth URL with all attribution params + redirect_url", () => {
    const url = buildCliAuthUrl({
      origin: "https://example.com",
      clientId: "free-design-md",
      state: "nonce-abc",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://builder.io");
    expect(parsed.pathname).toBe("/cli-auth");
    const params = parsed.searchParams;
    expect(params.get("redirect_url")).toBe(
      "https://example.com/api/auth/builder/callback?state=nonce-abc",
    );
    expect(params.get("client_id")).toBe("free-design-md");
    expect(params.get("host")).toBe("free-design-md");
    expect(params.get("framework")).toBe("react");
    expect(params.get("signupSource")).toBe("agent-native");
    expect(params.get("agentNativeFlow")).toBe("design_extraction");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test server/lib/builder-redirect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helpers**

Create `/Users/builder-matt/code/free-design-md/server/lib/builder-redirect.ts`:

```ts
/**
 * Resolve the public origin of this app for redirect_url construction.
 *
 * Prefers `PUBLIC_ORIGIN` env var (set this in production to whatever
 * Builder.io has allowlisted in `CLIAuthPage.tsx`'s isAllowedRedirectUrl).
 * Falls back to the request's own origin — convenient for local dev where
 * `http://localhost:8080` is already allowlisted.
 */
export function publicOrigin(requestOrigin: string): string {
  const fromEnv = process.env.PUBLIC_ORIGIN;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return requestOrigin.replace(/\/$/, "");
}

export function buildCallbackUrl(origin: string, state: string): string {
  return `${origin}/api/auth/builder/callback?state=${encodeURIComponent(state)}`;
}

export function buildCliAuthUrl(args: {
  origin: string;
  clientId: string;
  state: string;
}): string {
  const url = new URL("https://builder.io/cli-auth");
  url.searchParams.set(
    "redirect_url",
    buildCallbackUrl(args.origin, args.state),
  );
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("host", "free-design-md");
  url.searchParams.set("framework", "react");
  url.searchParams.set("signupSource", "agent-native");
  url.searchParams.set("agentNativeFlow", "design_extraction");
  return url.toString();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test server/lib/builder-redirect.test.ts`
Expected: PASS — 5/5 tests green.

- [ ] **Step 5: Commit**

```bash
git add server/lib/builder-redirect.ts server/lib/builder-redirect.test.ts
git commit -m "feat(auth): add PUBLIC_ORIGIN + cli-auth URL builder helpers"
```

---

### Task 8: `/api/auth/builder/start.get.ts` — issue the redirect

**Files:**
- Create: `server/routes/api/auth/builder/start.get.ts`

This handler issues a 302 to `/cli-auth` with a fresh state cookie. We test the lib helpers; the handler itself is intentionally tiny.

- [ ] **Step 1: Create the handler**

Create `/Users/builder-matt/code/free-design-md/server/routes/api/auth/builder/start.get.ts`:

```ts
import {
  defineEventHandler,
  getRequestURL,
  getQuery,
  setCookie,
  sendRedirect,
} from "h3";
import { randomBytes } from "node:crypto";
import {
  STATE_COOKIE_NAME,
  STATE_MAX_AGE_SECONDS,
} from "../../../../lib/builder-session.js";
import {
  publicOrigin,
  buildCliAuthUrl,
} from "../../../../lib/builder-redirect.js";

/**
 * GET /api/auth/builder/start[?return=<url>]
 *
 * Mints a CSRF state, sets it as an httpOnly cookie, and 302s the user
 * to https://builder.io/cli-auth with our callback as the redirect_url.
 * The optional ?return is the URL the user came from — preserved in a
 * second cookie so the callback can drop them back where they started.
 */
export default defineEventHandler(async (event) => {
  const reqUrl = getRequestURL(event);
  const origin = publicOrigin(reqUrl.origin);

  const state = randomBytes(16).toString("base64url");
  setCookie(event, STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: reqUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  const query = getQuery(event);
  const returnTo = typeof query.return === "string" ? query.return : "/";
  // Validate: only allow same-origin returns to prevent open-redirect.
  let safeReturn = "/";
  try {
    const parsed = new URL(returnTo, origin);
    if (parsed.origin === origin) safeReturn = parsed.pathname + parsed.search;
  } catch {
    // fall through to default
  }
  setCookie(event, "fdmd_oauth_return", safeReturn, {
    httpOnly: true,
    secure: reqUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  const clientId = process.env.BUILDER_CLIENT_ID ?? "free-design-md";
  const target = buildCliAuthUrl({ origin, clientId, state });
  return sendRedirect(event, target, 302);
});
```

- [ ] **Step 2: Smoke-test by hand**

Run the dev server: `pnpm dev` (in a separate terminal)

Then:

```bash
curl -i -s "http://localhost:8080/api/auth/builder/start?return=/quality" 2>&1 | head -20
```

Expected output should include:
- `HTTP/1.1 302`
- `Set-Cookie: fdmd_oauth_state=...; Max-Age=600; ...`
- `Set-Cookie: fdmd_oauth_return=/quality; ...`
- `Location: https://builder.io/cli-auth?redirect_url=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fbuilder%2Fcallback%3Fstate%3D...&client_id=free-design-md&host=free-design-md&framework=react&signupSource=agent-native&agentNativeFlow=design_extraction`

Kill the dev server when done.

- [ ] **Step 3: Commit**

```bash
git add server/routes/api/auth/builder/start.get.ts
git commit -m "feat(auth): /api/auth/builder/start issues 302 to Builder /cli-auth"
```

---

### Task 9: `/api/auth/builder/callback.get.ts` — verify and mint a session

**Files:**
- Create: `server/routes/api/auth/builder/callback.get.ts`

- [ ] **Step 1: Create the handler**

Create `/Users/builder-matt/code/free-design-md/server/routes/api/auth/builder/callback.get.ts`:

```ts
import {
  defineEventHandler,
  getQuery,
  getCookie,
  setCookie,
  deleteCookie,
  sendRedirect,
  createError,
} from "h3";
import {
  STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/builder-session.js";
import { handleCallback } from "../../../../lib/builder-verify.js";

/**
 * GET /api/auth/builder/callback?state=…&p-key=bpk-…&user-id=…&api-key=…
 *
 * 1. Validate the state cookie matches the ?state query param.
 * 2. Call /api/v1/users/:id with the BPK to verify the identity.
 * 3. Upsert the user, seed quota, mint a session token, set cookie.
 * 4. Discard the BPK. Redirect back to fdmd_oauth_return (or /).
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const state = typeof query.state === "string" ? query.state : "";
  const userId = typeof query["user-id"] === "string" ? query["user-id"] : "";
  const apiKey = typeof query["api-key"] === "string" ? query["api-key"] : "";
  const privateKey =
    typeof query["p-key"] === "string" ? query["p-key"] : "";

  const cookieState = getCookie(event, STATE_COOKIE_NAME);
  deleteCookie(event, STATE_COOKIE_NAME);

  if (!state || !cookieState || state !== cookieState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or expired sign-in state",
    });
  }

  if (!userId || !apiKey || !privateKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing identity parameters from Builder.io",
    });
  }

  const result = await handleCallback({ userId, apiKey, privateKey });
  if (!result.ok) {
    throw createError({
      statusCode: 401,
      statusMessage: "Could not verify your Builder.io identity",
    });
  }

  setCookie(event, SESSION_COOKIE_NAME, result.sessionToken, {
    httpOnly: true,
    secure: event.node.req.headers["x-forwarded-proto"] === "https",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const returnTo = getCookie(event, "fdmd_oauth_return") ?? "/";
  deleteCookie(event, "fdmd_oauth_return");
  return sendRedirect(event, returnTo, 302);
});
```

- [ ] **Step 2: Smoke-test the failure paths**

Run dev server: `pnpm dev`

State mismatch:

```bash
curl -i -s "http://localhost:8080/api/auth/builder/callback?state=wrong" 2>&1 | head -5
```

Expected: `HTTP/1.1 400` and a "Invalid or expired sign-in state" body.

The happy path can only be exercised via a real Builder sign-in (Task 14 covers manual end-to-end).

- [ ] **Step 3: Commit**

```bash
git add server/routes/api/auth/builder/callback.get.ts
git commit -m "feat(auth): /api/auth/builder/callback verifies BPK and mints a session"
```

---

### Task 10: `/api/auth/builder/signout.post.ts` and `/api/auth/me.get.ts`

**Files:**
- Create: `server/routes/api/auth/builder/signout.post.ts`
- Create: `server/routes/api/auth/me.get.ts`

- [ ] **Step 1: Create the signout handler**

Create `/Users/builder-matt/code/free-design-md/server/routes/api/auth/builder/signout.post.ts`:

```ts
import { defineEventHandler, getCookie, deleteCookie } from "h3";
import {
  SESSION_COOKIE_NAME,
  deleteSession,
} from "../../../../lib/builder-session.js";

/**
 * POST /api/auth/builder/signout
 *
 * Deletes the server-side session row and clears the cookie. Idempotent —
 * calling without a cookie or with an unknown token still 200s.
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE_NAME);
  if (token) {
    await deleteSession(token);
  }
  deleteCookie(event, SESSION_COOKIE_NAME, { path: "/" });
  return { ok: true };
});
```

- [ ] **Step 2: Create the `me` handler**

Create `/Users/builder-matt/code/free-design-md/server/routes/api/auth/me.get.ts`:

```ts
import {
  defineEventHandler,
  getCookie,
  setResponseStatus,
} from "h3";
import {
  SESSION_COOKIE_NAME,
  lookupSession,
} from "../../../lib/builder-session.js";
import { quotaRemaining } from "../../../lib/builder-quota.js";

/**
 * GET /api/auth/me
 *
 * Returns the current user payload the client-side auth seam needs:
 * `{ email, name, remaining }`. 401 if no valid session — the client
 * uses that to fall back to a signed-out snapshot.
 */
export default defineEventHandler(async (event) => {
  const token = getCookie(event, SESSION_COOKIE_NAME);
  const session = token ? await lookupSession(token) : null;
  if (!session) {
    setResponseStatus(event, 401);
    return { error: "not_authenticated" };
  }
  const remaining = await quotaRemaining(session.userId);
  return {
    user: { email: session.email, name: session.name ?? null },
    remaining,
  };
});
```

- [ ] **Step 3: Smoke-test**

Run dev server. Without a cookie:

```bash
curl -i -s "http://localhost:8080/api/auth/me" 2>&1 | head -10
```

Expected: `HTTP/1.1 401` with `{"error":"not_authenticated"}`.

Signout:

```bash
curl -i -s -X POST "http://localhost:8080/api/auth/builder/signout" 2>&1 | head -10
```

Expected: `HTTP/1.1 200` with `{"ok":true}`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/api/auth/builder/signout.post.ts server/routes/api/auth/me.get.ts
git commit -m "feat(auth): /api/auth/me and /api/auth/builder/signout"
```

---

### Task 11: Wire `options.getSession` so framework reads our cookie

**Files:**
- Modify: `server/plugins/auth.ts`

This is the integration moment — once `getSession` is set, every existing call to `getSession(event)` in handlers (including `server/handlers/request-auth-context.ts:13`) flows through our SQLite-backed implementation instead of better-auth.

- [ ] **Step 1: Replace the contents of `server/plugins/auth.ts`**

Overwrite `/Users/builder-matt/code/free-design-md/server/plugins/auth.ts` with:

```ts
import { createAuthPlugin } from "@agent-native/core/server";
import type { H3Event } from "h3";
import { getCookie } from "h3";
import {
  SESSION_COOKIE_NAME,
  lookupSession,
} from "../lib/builder-session.js";

/**
 * Bridge the framework's getSession() escape hatch to our SQLite-backed
 * Builder.io session cookie.
 *
 * When set, `AuthOptions.getSession` causes the framework to skip
 * better-auth entirely. Every existing caller of `getSession(event)`
 * (see server/handlers/request-auth-context.ts) keeps working without
 * any changes — they read `{ email, userId }` off the AuthSession
 * shape that this function returns.
 */
async function builderGetSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE_NAME);
  if (!token) return null;
  const session = await lookupSession(token);
  if (!session) return null;
  return {
    email: session.email,
    userId: session.userId,
    name: session.name ?? undefined,
  };
}

export default createAuthPlugin({
  marketing: {
    appName: "Free design.md",
    tagline:
      "Paste any URL — get a portable design.md spec your agents can read.",
    features: [
      "Deterministic extraction of colors, typography, components, and spacing",
      "One-click AI enrichment with Claude Opus 4.7 for brand-voice depth",
      "Drop the design.md into a Builder.io Space and iterate with an agent",
    ],
  },
  getSession: builderGetSession,
  publicPaths: [
    // Product surface stays public — the "Sign in" gate is enforced
    // at the enrich endpoint, not by a route-level redirect.
    "/",
    "/quality",
    "/__manifest",
    "/api/extract",
    // Auth endpoints must be public — they're how users sign in.
    "/api/auth/builder/start",
    "/api/auth/builder/callback",
    "/api/auth/builder/signout",
    "/api/auth/me",
    // Google Docs OAuth callback (unrelated, pre-existing).
    "/_agent-native/google-docs/callback",
    // The enrich endpoint is intentionally NOT in publicPaths — but
    // because our framework auth guard only blocks unauthenticated
    // visits when getSession returns null AND the path isn't here,
    // we need it here too to avoid the framework's marketing page
    // taking over. The real gate happens inside the handler.
    "/api/enrich-design-md",
  ],
});
```

- [ ] **Step 2: Run the existing test suite to confirm nothing broke**

Run: `pnpm test`
Expected: all previously-green tests still pass. The new auth-lib tests added in earlier tasks should still pass too.

- [ ] **Step 3: Smoke-test in dev**

Run: `pnpm dev`

Set a fake session row by hand (we'll need a real Builder sign-in for the full happy path, but this proves the wiring):

```bash
# In the dev server's SQLite, insert a test user + session:
sqlite3 ./data/app.db \
  "INSERT INTO fdmd_users (id, email, name, created_at) VALUES ('builder-test', 'test@example.com', 'Test User', datetime('now')); \
   INSERT INTO fdmd_sessions (token, user_id, expires_at, created_at) VALUES ('test-token-123', 'builder-test', datetime('now', '+30 days'), datetime('now'));"

# Hit /api/auth/me with the cookie:
curl -i -s --cookie "fdmd_session=test-token-123" "http://localhost:8080/api/auth/me" 2>&1 | head -10
```

Expected: `HTTP/1.1 200` with `{"user":{"email":"test@example.com","name":"Test User"},"remaining":3}`.

Clean up:

```bash
sqlite3 ./data/app.db "DELETE FROM fdmd_sessions WHERE token='test-token-123'; DELETE FROM fdmd_users WHERE id='builder-test';"
```

- [ ] **Step 4: Commit**

```bash
git add server/plugins/auth.ts
git commit -m "feat(auth): wire AuthOptions.getSession to read our Builder session cookie"
```

---

### Task 12: Gate `/api/enrich-design-md` on session + decrement quota

**Files:**
- Modify: `server/routes/api/enrich-design-md.post.ts`

The framework's `getSession(event)` now reflects our Builder identity. We check it at the top of the handler, decrement quota before opening the stream, and 401/402 accordingly.

- [ ] **Step 1: Read the current handler to find the insertion point**

Run: `head -80 server/routes/api/enrich-design-md.post.ts`

The handler defines an h3 event handler whose body starts with `const body = await readBody(event);`. We add the auth + quota check immediately before that line.

- [ ] **Step 2: Add the gate at the top of the handler**

Edit `/Users/builder-matt/code/free-design-md/server/routes/api/enrich-design-md.post.ts` — add new imports near the existing h3 imports, and insert the gate at the start of the handler body.

Imports to add (place next to the existing `from "h3"` import):

```ts
import { getSession } from "@agent-native/core/server";
import { consumeQuota } from "../../../lib/builder-quota.js";
```

Inside the handler, before `const body = await readBody(event);`:

```ts
  const session = await getSession(event).catch(() => null);
  if (!session?.userId) {
    setResponseStatus(event, 401);
    setResponseHeader(event, "Content-Type", "application/json");
    return { error: "Sign in with Builder.io to enrich" };
  }
  const charged = await consumeQuota(session.userId);
  if (!charged.ok) {
    setResponseStatus(event, 402);
    setResponseHeader(event, "Content-Type", "application/json");
    return {
      error: "You've used all 3 free AI enrichments on your account",
      remaining: 0,
    };
  }
```

- [ ] **Step 3: Verify the modified handler typechecks**

Run: `pnpm typecheck`
Expected: silent success.

- [ ] **Step 4: Smoke-test the 401 path**

Run dev server. Without a session cookie:

```bash
curl -i -s -X POST "http://localhost:8080/api/enrich-design-md" \
  -H "Content-Type: application/json" \
  -d '{}' 2>&1 | head -10
```

Expected: `HTTP/1.1 401` with `{"error":"Sign in with Builder.io to enrich"}`.

With the test session row from Task 11:

```bash
sqlite3 ./data/app.db \
  "INSERT INTO fdmd_users (id, email, name, created_at) VALUES ('builder-test', 'test@example.com', 'Test User', datetime('now')); \
   INSERT INTO fdmd_sessions (token, user_id, expires_at, created_at) VALUES ('test-token-123', 'builder-test', datetime('now', '+30 days'), datetime('now'));"

curl -i -s -X POST --cookie "fdmd_session=test-token-123" \
  "http://localhost:8080/api/enrich-design-md" \
  -H "Content-Type: application/json" \
  -d '{}' 2>&1 | head -5
```

Expected: `HTTP/1.1 400` (the existing body-validation path — confirms we got past the auth gate). The quota row now shows enrichCount=1; run the same curl three more times and the fourth should return `HTTP/1.1 402`.

Clean up:

```bash
sqlite3 ./data/app.db "DELETE FROM fdmd_sessions WHERE token='test-token-123'; DELETE FROM fdmd_users WHERE id='builder-test'; DELETE FROM fdmd_quota WHERE user_id='builder-test';"
```

- [ ] **Step 5: Commit**

```bash
git add server/routes/api/enrich-design-md.post.ts
git commit -m "feat(auth): gate /api/enrich-design-md on Builder session + quota"
```

---

### Task 13: Replace `app/lib/auth/real-auth.ts` with the live implementation

**Files:**
- Modify: `app/lib/auth/real-auth.ts`
- Create: `app/lib/auth/real-auth.test.ts`

The seam contract in `app/lib/auth/index.ts` is unchanged. `real-auth.ts` just needs to expose the same six functions as `mock-auth.ts`, but backed by `fetch` calls and a small in-module cache for the synchronous reads `useSyncExternalStore` needs.

- [ ] **Step 1: Write the failing tests**

Create `/Users/builder-matt/code/free-design-md/app/lib/auth/real-auth.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTests,
  _hydrate,
  getCurrentUser,
  quotaRemaining,
  signOut,
  signIn,
  consumeQuota,
  subscribe,
} from "./real-auth";

const originalFetch = globalThis.fetch;
const originalLocation = window.location;

describe("real-auth", () => {
  beforeEach(() => {
    _resetForTests();
  });
  afterEach(() => {
    _resetForTests();
    globalThis.fetch = originalFetch;
  });

  it("starts signed-out with the default quota before hydration", () => {
    expect(getCurrentUser()).toBeNull();
    expect(quotaRemaining()).toBe(3);
  });

  it("_hydrate populates the cache from /api/auth/me on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 2,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await _hydrate();
    expect(getCurrentUser()).toEqual({ email: "matt@builder.io" });
    expect(quotaRemaining()).toBe(2);
  });

  it("_hydrate leaves the cache empty on a 401 response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }));
    await _hydrate();
    expect(getCurrentUser()).toBeNull();
    expect(quotaRemaining()).toBe(3);
  });

  it("signIn redirects to /api/auth/builder/start with the current href as return", () => {
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...originalLocation,
        assign: assignMock,
        href: "http://localhost:8080/some/page",
      },
    });

    signIn();

    expect(assignMock).toHaveBeenCalledTimes(1);
    const target = assignMock.mock.calls[0][0] as string;
    expect(target).toContain("/api/auth/builder/start?return=");
    expect(decodeURIComponent(target.split("return=")[1])).toBe(
      "http://localhost:8080/some/page",
    );
  });

  it("signOut POSTs to /api/auth/builder/signout and clears the cache", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { email: "matt@builder.io", name: "Matt" },
            remaining: 3,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    await _hydrate();
    expect(getCurrentUser()).not.toBeNull();
    signOut();
    // Cache cleared synchronously, network call fires async.
    expect(getCurrentUser()).toBeNull();
    await new Promise((r) => setTimeout(r, 0));
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/builder/signout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("consumeQuota decrements the cache optimistically and notifies subscribers", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 3,
        }),
        { status: 200 },
      ),
    );
    await _hydrate();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    expect(consumeQuota()).toEqual({ ok: true, remaining: 2 });
    expect(quotaRemaining()).toBe(2);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it("consumeQuota refuses to go below zero", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { email: "matt@builder.io", name: "Matt" },
          remaining: 0,
        }),
        { status: 200 },
      ),
    );
    await _hydrate();
    expect(consumeQuota()).toEqual({ ok: false, remaining: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test app/lib/auth/real-auth.test.ts`
Expected: FAIL — current `real-auth.ts` throws "real Builder.io auth not implemented" on every call.

- [ ] **Step 3: Replace the contents of `real-auth.ts`**

Overwrite `/Users/builder-matt/code/free-design-md/app/lib/auth/real-auth.ts` with:

```ts
/**
 * Real Builder.io auth — backed by server endpoints under /api/auth/*.
 *
 * The seam contract (see [[./index.ts]]) requires synchronous reads
 * because the React `useSyncExternalStore` hook calls `getCurrentUser`
 * / `quotaRemaining` during render. We satisfy this with a small
 * module-scoped cache hydrated by `_hydrate()` on mount, and a
 * subscription channel so optimistic local mutations (e.g. consumeQuota
 * after a successful enrich) notify React.
 *
 * Authoritative state lives on the server — the enrich endpoint
 * decrements quota server-side and 402s when exhausted. The client cache
 * is a UX-quality estimate that the server overrides on hydration.
 */

import type { MockUser } from "./mock-auth";

const QUOTA_DEFAULT = 3;
const CHANGE_EVENT = "free-design-md:real-auth:change";

interface CacheState {
  user: MockUser | null;
  remaining: number;
}

let cache: CacheState = { user: null, remaining: QUOTA_DEFAULT };

function isClient(): boolean {
  return typeof window !== "undefined";
}

function dispatchChange(): void {
  if (!isClient()) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getCurrentUser(): MockUser | null {
  return cache.user;
}

export function quotaRemaining(): number {
  return cache.remaining;
}

/**
 * Redirect to the server's sign-in entry. The server sets a state
 * cookie, redirects to Builder.io's /cli-auth, and (after the user
 * authorizes) lands back on /api/auth/builder/callback which mints
 * a session cookie and bounces them back to ?return.
 */
export function signIn(_emailIgnored?: string): MockUser {
  if (!isClient()) throw new Error("signIn called outside the browser");
  const target = `/api/auth/builder/start?return=${encodeURIComponent(window.location.href)}`;
  window.location.assign(target);
  // signIn's return value is by-contract a MockUser, but the page
  // is unloading. Return a placeholder; callers can't observe it.
  return { email: "" };
}

export function signOut(): void {
  if (!isClient()) return;
  cache = { user: null, remaining: QUOTA_DEFAULT };
  dispatchChange();
  void fetch("/api/auth/builder/signout", {
    method: "POST",
    credentials: "include",
  }).catch(() => {
    // Best-effort — the cookie is httpOnly so the client can't clear
    // it locally. If the network call fails, the next page load will
    // still see the cookie and the server's lookupSession will treat
    // the row as present until it expires.
  });
}

export function consumeQuota(): { ok: boolean; remaining: number } {
  if (cache.remaining <= 0) {
    return { ok: false, remaining: 0 };
  }
  cache = { ...cache, remaining: cache.remaining - 1 };
  dispatchChange();
  return { ok: true, remaining: cache.remaining };
}

export function subscribe(listener: () => void): () => void {
  if (!isClient()) return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

/**
 * Hydrate the cache from /api/auth/me. Called once on mount from the
 * seam in `./index.ts` (added in Task 13b).
 *
 * Underscore-prefixed because it's an implementation detail of the
 * real seam — not part of the public contract.
 */
export async function _hydrate(): Promise<void> {
  if (!isClient()) return;
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      user?: { email?: string; name?: string | null };
      remaining?: number;
    };
    if (!body.user?.email) return;
    cache = {
      user: { email: body.user.email },
      remaining: typeof body.remaining === "number" ? body.remaining : QUOTA_DEFAULT,
    };
    dispatchChange();
  } catch {
    // network errored — leave cache at signed-out defaults
  }
}

/** Test-only — reset module state. Not exported from the auth seam. */
export function _resetForTests(): void {
  cache = { user: null, remaining: QUOTA_DEFAULT };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test app/lib/auth/real-auth.test.ts`
Expected: PASS — 7/7 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/lib/auth/real-auth.ts app/lib/auth/real-auth.test.ts
git commit -m "feat(auth): real-auth.ts talks to /api/auth/* and caches for the React seam"
```

---

### Task 14: Hydrate the seam on mount

**Files:**
- Modify: `app/lib/auth/index.ts`

The mocked seam reads localStorage synchronously on first client render. The real seam needs to kick off a `/api/auth/me` fetch on mount and update the snapshot when it returns. We add a one-time hydration call inside `getClientSnapshot`.

- [ ] **Step 1: Edit `app/lib/auth/index.ts` to call `_hydrate` once when `real` is active**

Edit `/Users/builder-matt/code/free-design-md/app/lib/auth/index.ts` — change the top of the file to import `_hydrate` conditionally, and trigger it once on first client read.

Replace:

```ts
import { useSyncExternalStore } from "react";
import { useMockedAuth } from "@shared/flags";
import * as mock from "./mock-auth";
import * as real from "./real-auth";

const impl = useMockedAuth() ? mock : real;

export const getCurrentUser = impl.getCurrentUser;
export const signIn = impl.signIn;
export const signOut = impl.signOut;
export const quotaRemaining = impl.quotaRemaining;
export const consumeQuota = impl.consumeQuota;
export const subscribe = impl.subscribe;
```

With:

```ts
import { useSyncExternalStore } from "react";
import { useMockedAuth } from "@shared/flags";
import * as mock from "./mock-auth";
import * as real from "./real-auth";

const mocked = useMockedAuth();
const impl = mocked ? mock : real;

export const getCurrentUser = impl.getCurrentUser;
export const signIn = impl.signIn;
export const signOut = impl.signOut;
export const quotaRemaining = impl.quotaRemaining;
export const consumeQuota = impl.consumeQuota;
export const subscribe = impl.subscribe;

// One-time async hydrate for the real seam — kicks off a /api/auth/me
// fetch on the first client read. The mocked seam reads localStorage
// synchronously and doesn't need this.
let hydrationStarted = false;
function maybeStartHydration(): void {
  if (mocked || hydrationStarted) return;
  if (typeof window === "undefined") return;
  hydrationStarted = true;
  void real._hydrate();
}
```

Then update the `getClientSnapshot` function lower in the file to kick off hydration on its first call:

```ts
function getClientSnapshot(): AuthSnapshot {
  if (!isHydrated) {
    isHydrated = true;
    maybeStartHydration();
    maybeUpdateSnapshot();
  }
  return cachedSnapshot;
}
```

- [ ] **Step 2: Run all auth tests to confirm both seams still behave**

Run: `pnpm test app/lib/auth/`
Expected: all mock-auth and real-auth tests still green.

- [ ] **Step 3: Commit**

```bash
git add app/lib/auth/index.ts
git commit -m "feat(auth): hydrate real-auth from /api/auth/me on first client read"
```

---

### Task 15: Replace SignInModal's fake sign-in with the real redirect

**Files:**
- Modify: `app/components/auth/SignInModal.tsx`

- [ ] **Step 1: Update the modal to call `signIn()` directly**

The `signIn` export from `@/lib/auth` now redirects when real-auth is active, and the mocked seam still takes an email (we'll keep passing `matt@builder.io` for the mock so dev experience is unchanged).

Edit `/Users/builder-matt/code/free-design-md/app/components/auth/SignInModal.tsx`:

Replace the `handleSignIn` function:

```tsx
  async function handleSignIn() {
    setPending(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    signIn("matt@builder.io");
    setPending(false);
    onOpenChange(false);
  }
```

With:

```tsx
  async function handleSignIn() {
    setPending(true);
    // Mocked seam: pretend we round-tripped to Builder.io and signed in
    // as the default dev user. Real seam: redirect to /api/auth/builder/start
    // and the page navigates away — the setPending(false) below never runs.
    signIn("matt@builder.io");
  }
```

- [ ] **Step 2: Smoke-test the mocked flow still works**

Run: `pnpm dev`

Visit `http://localhost:8080`, click "Enrich with AI" → modal opens → click "Sign in with Builder.io". The mocked seam should log you in as `matt@builder.io` instantly (no flag set = mocked default). Verify AccountChip appears with `3` enrichments remaining.

- [ ] **Step 3: Commit**

```bash
git add app/components/auth/SignInModal.tsx
git commit -m "feat(auth): SignInModal calls signIn() — real seam redirects, mock signs in instantly"
```

---

### Task 16: Document env vars and the allowlist requirement

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `.env.example`**

Append to `/Users/builder-matt/code/free-design-md/.env.example`:

```bash
# --- Builder.io SSO (real-auth seam) ---
# Set VITE_FREE_DESIGN_MD_REAL_AUTH=1 to flip the client seam from the
# localStorage mock to the real /api/auth/* flow.
# VITE_FREE_DESIGN_MD_REAL_AUTH=1

# The public origin Builder.io should redirect back to. Must match a
# hostname in CLIAuthPage.tsx's isAllowedRedirectUrl (currently:
# localhost, *.agent-native.com, *.builder.io). Required in production.
# PUBLIC_ORIGIN=https://free-design-md.up.railway.app

# The client_id sent to https://builder.io/cli-auth. Shows up in
# Builder's UI as the app requesting authorization.
BUILDER_CLIENT_ID=free-design-md
```

- [ ] **Step 2: Append a section to CLAUDE.md**

Append to `/Users/builder-matt/code/free-design-md/CLAUDE.md` before the `## Phase 2 (deferred, …)` heading:

```markdown
## Auth — Builder.io SSO via `/cli-auth`

`free-design-md` uses Builder.io's existing `/cli-auth` partner redirect
flow to sign users in. There is no OAuth 2.0 endpoint on builder.io — auth
is Firebase under the hood — so we lean on the same redirect-with-BPK flow
that the Builder CLI and Figma plugin use.

**Client seam** (`app/lib/auth/`): contract is fixed across mock + real.
Set `VITE_FREE_DESIGN_MD_REAL_AUTH=1` to switch the seam to the real impl.

**Server flow:**

1. User clicks "Sign in with Builder.io" → `GET /api/auth/builder/start` sets
   a state cookie and 302s to `https://builder.io/cli-auth` with
   `redirect_url=…/api/auth/builder/callback?state=<nonce>` and attribution
   params (`signupSource=agent-native`, `agentNativeFlow=design_extraction`).
2. Builder forwards unauthenticated users to `/login` or `/signup`
   (preserving our attribution params), then back to `/cli-auth`.
3. User clicks Authorize. Builder redirects to our callback with
   `?p-key=bpk-…&user-id=…&api-key=…`.
4. Callback validates the state cookie, calls
   `GET https://builder.io/api/v1/users/<user-id>?apiKey=…` with the BPK
   as a bearer token. On 200, identity is verified.
5. We upsert into `fdmd_users`, seed `fdmd_quota` (default 3), mint an
   opaque token, store in `fdmd_sessions`, set `fdmd_session` cookie,
   discard the BPK, and 302 back to the original page.
6. The framework's `AuthOptions.getSession` is wired to read our cookie,
   so `getSession(event)` in any handler returns
   `{ email, userId, name }` for the Builder-verified user.

**Production prerequisite:** the deployed hostname must be in
`isAllowedRedirectUrl()` at
`~/code/builder-internal/packages/app/components/CLIAuthPage.tsx:28`.
Today: `localhost`, `*.agent-native.com`, `*.builder.io`. Either deploy
under one of those, or land a one-line PR adding the prod host.

**Env vars:** `PUBLIC_ORIGIN` (required in prod), `BUILDER_CLIENT_ID`
(defaults to `free-design-md`), `VITE_FREE_DESIGN_MD_REAL_AUTH=1` to
flip the client seam to the real impl.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: document Builder.io SSO flow and required env vars"
```

---

### Task 17: End-to-end manual verification

**Files:** none — manual.

This is the final acceptance test. It requires either a `localhost` dev run (which is allowlisted) or a deployed instance with the prod host added to Builder's allowlist.

- [ ] **Step 1: Set up the environment**

In `.env.local`:

```bash
VITE_FREE_DESIGN_MD_REAL_AUTH=1
BUILDER_CLIENT_ID=free-design-md
ANTHROPIC_API_KEY=<your-key>
# PUBLIC_ORIGIN unset — defaults to request origin in dev
```

Run: `pnpm dev`

- [ ] **Step 2: Sign-in happy path**

1. Visit `http://localhost:8080`. AccountChip should be absent (signed out).
2. Click "Enrich with AI" → SignInModal opens.
3. Click "Sign in with Builder.io". Page redirects to `https://builder.io/cli-auth?…`.
4. If not already signed into Builder, Builder redirects to `/signup` or `/login` (verify the URL preserves `signupSource=agent-native` and `agentNativeFlow=design_extraction`).
5. Authenticate at builder.io.
6. Click "Authorize" on the cli-auth page.
7. Page redirects to `http://localhost:8080/api/auth/builder/callback?state=…&p-key=bpk-…&user-id=…&api-key=…`.
8. Callback 302s back to `/`. AccountChip now shows your Builder email and `3` enrichments.

- [ ] **Step 3: Verify server state**

```bash
sqlite3 ./data/app.db "SELECT id, email, name FROM fdmd_users;"
sqlite3 ./data/app.db "SELECT user_id, expires_at FROM fdmd_sessions;"
sqlite3 ./data/app.db "SELECT user_id, enrich_count FROM fdmd_quota;"
```

Expected: one user row (`builder-<your-id>`, your email), one session row, one quota row (`enrich_count=0`).

- [ ] **Step 4: Verify the enrich gate**

Paste any URL into the extractor (e.g. `stripe.com`), wait for the deterministic output, click "Enrich with AI". The streaming output should arrive normally. After it completes, AccountChip should show `2` enrichments. Confirm `enrich_count` in SQLite is now `1`.

Repeat 3 more times — on the fourth attempt the server should return `HTTP 402` and the UI should show "You've used all 3 free AI enrichments on your account".

- [ ] **Step 5: Verify sign-out**

Click the AccountChip → "Sign out". AccountChip disappears, signed-out UI returns. Verify in DB:

```bash
sqlite3 ./data/app.db "SELECT * FROM fdmd_sessions;"
```

Expected: zero rows (the session was deleted).

- [ ] **Step 6: Verify state-mismatch protection**

Manually forge a callback URL with a state that doesn't match the cookie:

```bash
curl -i -s --cookie "fdmd_oauth_state=mine" \
  "http://localhost:8080/api/auth/builder/callback?state=other&user-id=x&api-key=y&p-key=bpk-z" 2>&1 | head -5
```

Expected: `HTTP/1.1 400` with "Invalid or expired sign-in state".

---

## Out of scope (Phase 3+)

Documented here so they don't get bundled into the SSO plan by accident:

- **Streaming + caching for enrichment** — `actions/enrich-design-md.ts` already streams. URL-keyed caching is partially done via `enrichmentCache`. Continue per spike verdict.
- **`AGENT_NATIVE_IDENTITY_HUB_URL` integration** — if Builder.io agrees to act as an agent-native identity hub later, the framework supports it out of the box. Would replace Tasks 7–11 with a single env var. Not blocking; this plan ships standalone.
- **Multi-org awareness** — quota keyed on `builderUserId`, not org. If we want per-org quotas later, extend `fdmd_quota` PK to `(userId, orgId)` and read `query["org-name"]` at callback.
- **`/cli-auth` partner-branded UX** — the existing page is labeled for CLIs/plugins. A partner-branded variant would be a one-line copy change in builder-internal.
- **Embedded-app (Spaces) flow** — different mechanism entirely (postMessage from the embedding iframe). Out of scope unless we ship a Spaces variant.

## Self-review

Spec coverage:
- Builder SSO wire-up → Tasks 2–11
- Sign-up redirect (kick people to /signup if not signed up) → covered by `/cli-auth`'s built-in unauth handling; verified manually in Task 17 Step 2.4.
- Drop them back into this project after sign-in → `fdmd_oauth_return` cookie + 302 from callback (Task 9).
- Local SQLite for state, no Builder DB changes → Tasks 1, 3, 5 (3 new tables, all in app's SQLite).

No placeholders, no "TODO", every step has runnable code or commands. Types line up (`MockUser` re-used as `AuthUser`, `AuthSession` shape `{ email, userId, name }` consistent across `getSession`, `lookupSession`, and the seam).

---

## Execution

Plan complete and saved to `docs/phase-2-sso-integration-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
