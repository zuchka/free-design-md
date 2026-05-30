# Chat Sidebar Port — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the agent-native chat sidebar to `free-design-md` as the new surface for design.md iteration, replacing `IteratePanel`, while preserving URL-paste → extract → enrich on the left and adding a hybrid BYO-Anthropic-key / Builder-SSO-quota auth model.

**Architecture:** Stay in the existing `free-design-md` repo. First commit bumps `@agent-native/core` from 0.22.7 → 0.28.4. A new server-side `resolveAnthropicKey()` helper centralizes the BYO-key-vs-server-key resolution that both the iterate and enrich SSE routes consume. The chat sidebar lives on the right via `<AgentSidebar>` from `@agent-native/core/client`, and the `iterate-design-md` action is exposed to the chat as a callable tool.

**Tech Stack:** React Router 7, `@agent-native/core` 0.28.4, h3, Drizzle + libsql, Anthropic SDK 0.96, Vitest, shadcn primitives in `app/components/ui/`.

**Branch:** `feat/chat-sidebar-port` (already created from `main` at `4b4837a`). **Do not commit to `main` at any point in this plan.** Every step's commit lands on the feature branch; PR opens only after the manual dogfood task is complete and the user explicitly approves merge.

**Spec:** `docs/superpowers/specs/2026-05-30-chat-sidebar-port-design.md` (commit `d65c8c9`).

---

## Files

**Created**
- `server/lib/anthropic-key.ts` — `resolveAnthropicKey(event)` helper. Returns `{ apiKey, source: "byo" | "server", consumesQuota: boolean }` or throws if neither is available.
- `server/lib/anthropic-key.test.ts` — unit tests for `resolveAnthropicKey`.
- `server/routes/api/me/key-status.get.ts` — `GET /api/me/key-status` returns `{ byoKeyConfigured: boolean }`.
- `server/routes/api/me/key-status.get.test.ts` — tests for that route.

**Modified**
- `package.json` — bump `@agent-native/core` to `^0.28.4`.
- `server/lib/owner.ts` — make `resolveOwner` return real per-user identity via `getSession()` (fall back to `ANONYMOUS_OWNER` for unauthenticated).
- `server/lib/owner.test.ts` (if it doesn't exist, create) — tests for the new behavior.
- `actions/iterate-design-md.ts` — accept optional `anthropicApiKey` on the input and use it instead of `process.env.ANTHROPIC_API_KEY` when present.
- `actions/enrich-design-md.ts` — same treatment.
- `server/routes/api/iterate-design-md.post.ts` — call `resolveAnthropicKey` first; only decrement quota when `consumesQuota` is true.
- `server/routes/api/iterate-design-md.post.test.ts` — add auth-matrix tests for the six rows.
- `server/routes/api/enrich-design-md.post.ts` — call `resolveAnthropicKey`. If the resolver returns a BYO key, pass it through; otherwise gate on quota (new behavior — today this route has no quota gate). Update existing tests, add matrix tests.
- `app/lib/use-credits.tsx` — extend the context value to include `byoKeyConfigured: boolean | null`; fetch from `/api/me/key-status` alongside `/api/me/credits`.
- `app/components/NavBar.tsx` — add a settings entry that opens `ApiKeySettings` from `@agent-native/core/client`.
- `app/root.tsx` — wrap `<Outlet/>` in `<AgentSidebar position="right" defaultOpen ...>`.
- `app/routes/_index.tsx` — when an enriched design.md is loaded, push it into chat model context via the framework's screen-context / `updateMcpAppModelContext` API; remove the `<IteratePanel>` block (lines 545–568); keep the `SideBySideMemo` block that consumes `iterCandidate` etc.; subscribe to iterate results coming back from the chat-driven route so the existing Kept-iterations behavior keeps working.
- `CLAUDE.md` / `AGENTS.md` — short section on the chat-driven iterate flow + BYO key path.

**Deleted**
- `app/components/IteratePanel.tsx`

---

## Task 0: Capture baseline + confirm branch state

**Files:** none modified.

- [ ] **Step 1: Confirm the branch is `feat/chat-sidebar-port`**

```bash
git branch --show-current
```
Expected: `feat/chat-sidebar-port`. If not, abort and recreate from main.

- [ ] **Step 2: Run the full test suite to capture the green baseline**

```bash
pnpm test
```
Expected: 144 tests pass (per CLAUDE.md). Note any pre-existing flakes — they're noise we won't blame on the bump later.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: silent success.

- [ ] **Step 4: Record baseline in the branch's working notes (optional)**

No commit — this is a verification step. If anything is red here, stop and fix before proceeding.

---

## Task 1: Bump @agent-native/core to 0.28.4

**Files:**
- Modify: `package.json` line with `"@agent-native/core": "^0.22.7"`
- Modify: any source files broken by the bump (fix inline)

- [ ] **Step 1: Update the version pin**

Edit `package.json`. Change:
```json
"@agent-native/core": "^0.22.7",
```
to:
```json
"@agent-native/core": "^0.28.4",
```

- [ ] **Step 2: Install**

```bash
pnpm install
```
Expected: lockfile updates; no install errors.

- [ ] **Step 3: Run typecheck — fix breakage inline**

```bash
pnpm typecheck
```
If errors surface (renamed exports, changed signatures), fix them in the touching file. Likely candidates: `getThemeInitScript` signature, `configureTracking` shape, anything in `app/components/auth/` that imports from `@agent-native/core/client`. Do not stub failing modules — actually update the call sites to match 0.28.4's API.

- [ ] **Step 4: Run the test suite — fix breakage inline**

```bash
pnpm test
```
Expected: all 144 tests pass. If any fail because of the bump (e.g., the agent-card test asserts a stale shape), update the test to match the new shape *only if* the underlying contract is unchanged. If the contract changed, surface this for review rather than silently rewriting expectations.

- [ ] **Step 5: Smoke the dev server**

```bash
pnpm dev
```
In another terminal: `curl -sS http://localhost:8080/ | head -20`. Expected: HTML returned, no 500. Kill the server after confirming.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
# include any source files you had to edit for the bump
git commit -m "chore: bump @agent-native/core 0.22.7 -> 0.28.4"
```

---

## Task 2: Verify ApiKeySettings works against anonymous sessions

**Files:** none modified in this task (decision-only).

- [ ] **Step 1: Locate the component in installed source**

```bash
grep -rn "export.*ApiKeySettings" node_modules/@agent-native/core/dist/client | head -5
```
Then read the file the export comes from (likely `components/ApiKeySettings.js` or `settings/`).

- [ ] **Step 2: Check whether the component requires SSO'd identity**

Look for: does it call `useSession()`? Does it short-circuit when there's no session? Does it post to a route that requires auth? Read the component end-to-end before deciding.

- [ ] **Step 3: Decide path A or path B**

- **Path A (preferred):** The framework's `ApiKeySettings` works against any framework session (anonymous or SSO'd). The framework already provides server storage. Plan Tasks 7+ use the component directly.
- **Path B (fallback):** The component requires SSO'd identity. We will write our own `BYOKeyForm` component + a `POST /api/me/anthropic-key` route + a column on `fdmd_sessions`. The rest of the plan changes slightly: Tasks 4 and 7 need additional steps; the auth-matrix tests in Task 5 still pass but the storage backend differs.

Record the decision inline:
```
DECISION: Path A | Path B
EVIDENCE: <one-line summary of what you saw in the framework source>
```

- [ ] **Step 4: If Path B, scope the fallback into this plan**

Open this plan file and add these two tasks between Task 7 and Task 8:
- Task 7.1: Add `anthropic_api_key` column to `fdmd_sessions` (additive migration).
- Task 7.2: `POST /api/me/anthropic-key` route + `BYOKeyForm` component.

If Path A, skip Step 4 — proceed to Task 3.

- [ ] **Step 5: No commit — this is a decision step**

The decision lives in the plan file. Commit only happens when the next task does.

---

## Task 3: Per-user identity in resolveOwner

**Why:** Today `resolveOwner` always returns `ANONYMOUS_OWNER`, making the `fdmd_quota` table a single-tenant pool. The spec's auth matrix needs distinct per-user quota for Builder-SSO'd users.

**Files:**
- Modify: `server/lib/owner.ts`
- Create: `server/lib/owner.test.ts`

- [ ] **Step 1: Write a failing test for the new behavior**

Create `server/lib/owner.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());

vi.mock("@agent-native/core", async () => {
  const actual = await vi.importActual<typeof import("@agent-native/core")>(
    "@agent-native/core",
  );
  return { ...actual, getSession: mockGetSession };
});

const { resolveOwner, ANONYMOUS_OWNER } = await import("./owner.js");

describe("resolveOwner", () => {
  it("returns ANONYMOUS_OWNER when no session is present", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const owner = await resolveOwner({} as never);
    expect(owner).toBe(ANONYMOUS_OWNER);
  });

  it("returns the session email when a session is present", async () => {
    mockGetSession.mockResolvedValueOnce({
      email: "matthew@builder.io",
      userId: "u-123",
    });
    const owner = await resolveOwner({} as never);
    expect(owner).toBe("matthew@builder.io");
  });

  it("returns ANONYMOUS_OWNER when session has no email", async () => {
    mockGetSession.mockResolvedValueOnce({ userId: "u-123" });
    const owner = await resolveOwner({} as never);
    expect(owner).toBe(ANONYMOUS_OWNER);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test server/lib/owner.test.ts
```
Expected: FAIL — `resolveOwner` ignores the mocked `getSession` because the current implementation doesn't call it.

- [ ] **Step 3: Update `server/lib/owner.ts`**

Replace the entire file contents with:

```typescript
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
```

- [ ] **Step 4: Re-run the test**

```bash
pnpm test server/lib/owner.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

```bash
pnpm test
```
Expected: still green. If any existing test that relied on the single-tenant assumption breaks, fix it — the test was wrong, not the new resolver.

- [ ] **Step 6: Commit**

```bash
git add server/lib/owner.ts server/lib/owner.test.ts
git commit -m "feat(server): per-user identity in resolveOwner via getSession"
```

---

## Task 4: `resolveAnthropicKey` helper + tests

**Files:**
- Create: `server/lib/anthropic-key.ts`
- Create: `server/lib/anthropic-key.test.ts`

The helper is the single source of truth for "which Anthropic key does this request use, and does the call consume quota?" Both iterate and enrich routes will use it.

- [ ] **Step 1: Write failing tests**

Create `server/lib/anthropic-key.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetByoKeyForOwner = vi.hoisted(() => vi.fn());

vi.mock("@agent-native/core", async () => {
  const actual = await vi.importActual<typeof import("@agent-native/core")>(
    "@agent-native/core",
  );
  return { ...actual, getSession: mockGetSession };
});

vi.mock("./anthropic-key-store.js", () => ({
  getByoKeyForOwner: mockGetByoKeyForOwner,
}));

const { resolveAnthropicKey } = await import("./anthropic-key.js");

const ORIGINAL_ENV = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV;
  mockGetSession.mockReset();
  mockGetByoKeyForOwner.mockReset();
});

describe("resolveAnthropicKey", () => {
  it("prefers BYO key when configured", async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetByoKeyForOwner.mockResolvedValue("sk-byo-key");
    process.env.ANTHROPIC_API_KEY = "sk-server-key";
    const r = await resolveAnthropicKey({} as never);
    expect(r).toEqual({
      apiKey: "sk-byo-key",
      source: "byo",
      consumesQuota: false,
    });
  });

  it("falls back to server key when no BYO key", async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetByoKeyForOwner.mockResolvedValue(null);
    process.env.ANTHROPIC_API_KEY = "sk-server-key";
    const r = await resolveAnthropicKey({} as never);
    expect(r).toEqual({
      apiKey: "sk-server-key",
      source: "server",
      consumesQuota: true,
    });
  });

  it("throws when neither a BYO key nor a server key is available", async () => {
    mockGetSession.mockResolvedValue(null);
    mockGetByoKeyForOwner.mockResolvedValue(null);
    delete process.env.ANTHROPIC_API_KEY;
    await expect(resolveAnthropicKey({} as never)).rejects.toThrow(
      /no_api_key_available/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test server/lib/anthropic-key.test.ts
```
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement the helper**

Create `server/lib/anthropic-key.ts`:

```typescript
import type { H3Event } from "h3";
import { resolveOwner } from "./owner.js";
import { getByoKeyForOwner } from "./anthropic-key-store.js";

export type AnthropicKeySource = "byo" | "server";

export interface ResolvedAnthropicKey {
  apiKey: string;
  source: AnthropicKeySource;
  consumesQuota: boolean;
}

/**
 * Decide which Anthropic key a request uses, and whether that consumes quota.
 *
 * Order:
 *   1. BYO key stored for this session's owner -> source "byo", no quota.
 *   2. process.env.ANTHROPIC_API_KEY -> source "server", consumes quota.
 *   3. Neither -> throw "no_api_key_available" (HTTP routes turn this into 402).
 */
export async function resolveAnthropicKey(
  event: H3Event,
): Promise<ResolvedAnthropicKey> {
  const owner = await resolveOwner(event);
  const byo = await getByoKeyForOwner(owner);
  if (byo) {
    return { apiKey: byo, source: "byo", consumesQuota: false };
  }
  const server = process.env.ANTHROPIC_API_KEY;
  if (server) {
    return { apiKey: server, source: "server", consumesQuota: true };
  }
  throw new Error("no_api_key_available");
}
```

- [ ] **Step 4: Stub the storage module**

Create `server/lib/anthropic-key-store.ts`:

```typescript
/**
 * BYO Anthropic key storage. Backed by:
 *   - Path A (framework's ApiKeySettings): we read whatever the framework exposes.
 *   - Path B (our own table column): we read fdmd_sessions.anthropic_api_key.
 *
 * Implementation chosen during Task 2. Today this is a stub returning null
 * so the rest of the plan can land green; Task 7 (or 7.1+7.2 if Path B) fills
 * in the real read.
 */
export async function getByoKeyForOwner(_owner: string): Promise<string | null> {
  return null;
}
```

- [ ] **Step 5: Run tests, confirm pass**

```bash
pnpm test server/lib/anthropic-key.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite**

```bash
pnpm test
```
Expected: still green.

- [ ] **Step 7: Commit**

```bash
git add server/lib/anthropic-key.ts server/lib/anthropic-key.test.ts server/lib/anthropic-key-store.ts
git commit -m "feat(server): resolveAnthropicKey helper for BYO/server key resolution"
```

---

## Task 5: Wire `resolveAnthropicKey` into the iterate route + matrix tests

**Files:**
- Modify: `actions/iterate-design-md.ts` — accept `anthropicApiKey` on input.
- Modify: `server/routes/api/iterate-design-md.post.ts` — use the resolver.
- Modify: `server/routes/api/iterate-design-md.post.test.ts` — add matrix tests.

- [ ] **Step 1: Extend the action's input schema and stream to accept an explicit key**

In `actions/iterate-design-md.ts`:

Update the `InputSchema`:
```typescript
const InputSchema = z.object({
  previousMarkdown: z.string().min(1),
  userPrompt: z.string().min(1),
  sectionTarget: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
  anthropicApiKey: z.string().min(1).optional(),
});
```

Update `IterationInput`:
```typescript
export interface IterationInput {
  previousMarkdown: string;
  userPrompt: string;
  sectionTarget?: string;
  anthropicApiKey?: string;
}
```

Replace the env-check block (currently around line 87–89) and the `new Anthropic()` line (currently around line 97) with:

```typescript
const apiKey = input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Add it to .env.local or pass anthropicApiKey on the call.",
  );
}
// ...later, where the client is instantiated:
const client = new Anthropic({ apiKey });
```

- [ ] **Step 2: Add an action-level test for the new param**

Append to `actions/iterate-design-md.test.ts` (file already exists):

```typescript
it("uses the input anthropicApiKey when provided", async () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    // We expect the call to proceed past the env-check and fail at the
    // network step (no real key). That proves the input key was used,
    // not rejected because env was missing.
    const gen = iterateStream({
      previousMarkdown: "---\nname:x\n---\n",
      userPrompt: "hi",
      anthropicApiKey: "sk-test-bogus",
    });
    await expect(gen.next()).rejects.toThrow(/Anthropic API error|fetch failed|network/i);
  } finally {
    process.env.ANTHROPIC_API_KEY = originalEnv;
  }
});
```

- [ ] **Step 3: Run the action test**

```bash
pnpm test actions/iterate-design-md.test.ts
```
Expected: existing tests still pass; new test passes (or shows the expected network-level error).

- [ ] **Step 4: Update the SSE route to use `resolveAnthropicKey`**

In `server/routes/api/iterate-design-md.post.ts`, after the `resolveOwner(event)` call and before the `decrementCredits(owner)` call (around line 81–100), inject:

```typescript
import { resolveAnthropicKey } from "../../lib/anthropic-key.js";
// ...inside the handler, after `const owner = await resolveOwner(event);`:

let resolvedKey;
try {
  resolvedKey = await resolveAnthropicKey(event);
} catch {
  setResponseStatus(event, 402);
  return { error: "no_api_key_available", reason: "byo-key-required" };
}
```

Replace the existing unconditional quota decrement block:
```typescript
// Atomic quota decrement before streaming.
const dec = await decrementCredits(owner);
if (!dec.ok) {
  setResponseStatus(event, 402);
  return { error: "out_of_credits" };
}
```
with the conditional version:
```typescript
let dec: { ok: boolean; remaining: number } | null = null;
if (resolvedKey.consumesQuota) {
  dec = await decrementCredits(owner);
  if (!dec.ok) {
    setResponseStatus(event, 402);
    return { error: "out_of_credits", reason: "signed-in-and-out-of-credits" };
  }
}
```

Then update the `iterateStream` call to pass the key through:
```typescript
const input: IterationInput = {
  previousMarkdown,
  userPrompt,
  sectionTarget: sectionTarget ?? undefined,
  anthropicApiKey: resolvedKey.apiKey,
};
```

In the `done` branch, change `remaining: dec.remaining` to `remaining: dec?.remaining ?? null` (BYO calls don't have a quota to report).

In the `catch` branch, the existing `refundCredit(owner)` call should only run when we actually charged one. Wrap it:
```typescript
if (resolvedKey.consumesQuota && dec?.ok) {
  await refundCredit(owner).catch(() => {});
}
```

- [ ] **Step 5: Update existing route tests to mock `resolveAnthropicKey`**

In `server/routes/api/iterate-design-md.post.test.ts`, near the top (with the other `vi.mock` calls):

```typescript
const mockResolveAnthropicKey = vi.hoisted(() => vi.fn());
vi.mock("../../lib/anthropic-key", () => ({
  resolveAnthropicKey: mockResolveAnthropicKey,
}));
```

Inside `beforeEach`, set a default that mimics today's behavior (server key, consumes quota):
```typescript
mockResolveAnthropicKey.mockResolvedValue({
  apiKey: "sk-server-test",
  source: "server",
  consumesQuota: true,
});
```

- [ ] **Step 6: Run existing tests, confirm they still pass**

```bash
pnpm test server/routes/api/iterate-design-md.post.test.ts
```
Expected: all 9 existing tests pass (they're now using the mocked resolver but behavior is identical).

- [ ] **Step 7: Add the auth-matrix tests**

Append to `server/routes/api/iterate-design-md.post.test.ts`:

```typescript
describe("POST /api/iterate-design-md — auth matrix", () => {
  const validMd = ["---", "name: X", "---", "", "## A", "B"].join("\n");
  const happyDone = {
    type: "done" as const,
    markdown: validMd,
    model: "claude-sonnet-4-6",
    latencyMs: 1,
    usage: {
      inputTokens: 1,
      outputTokens: 1,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    },
    stopReason: "end_turn" as const,
  };

  function happyBody(sessionId: string) {
    return {
      _body: {
        sessionId,
        previousMarkdown: "---\nname:x\n---\n",
        userPrompt: "Make it pop.",
        url: "https://example.com",
      },
    } as unknown as Record<string, unknown>;
  }

  async function quotaCount(): Promise<number> {
    const exec = getDbExec();
    const r = await exec.execute({
      sql: `SELECT enrich_count FROM fdmd_quota WHERE user_id = ?`,
      args: [ANONYMOUS_OWNER],
    });
    return Number(
      (r.rows[0] as { enrich_count: number | bigint } | undefined)
        ?.enrich_count ?? 0,
    );
  }

  it("anonymous + no BYO + no server key -> 402 no_api_key_available", async () => {
    mockResolveAnthropicKey.mockRejectedValueOnce(new Error("no_api_key_available"));
    const event = happyBody("test-iter-matrix-1");
    const result = await routeHandler(event as never);
    expect(statusOf(event as { _statusCode?: number })).toBe(402);
    expect(result).toMatchObject({ error: "no_api_key_available" });
    expect(mockIterateStream).not.toHaveBeenCalled();
  });

  it("anonymous + BYO key -> streams, no quota touched", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-byo",
      source: "byo",
      consumesQuota: false,
    });
    mockIterateStream.mockImplementation(async function* () {
      yield happyDone;
    });
    const before = await quotaCount();
    const event = happyBody("test-iter-matrix-2");
    const result = await routeHandler(event as never);
    await readSse(result as ReadableStream<Uint8Array>);
    const after = await quotaCount();
    expect(after).toBe(before);
    expect(mockIterateStream).toHaveBeenCalledWith(
      expect.objectContaining({ anthropicApiKey: "sk-byo" }),
    );
  });

  it("SSO'd + server key + quota > 0 -> streams, decrements quota", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-server",
      source: "server",
      consumesQuota: true,
    });
    mockIterateStream.mockImplementation(async function* () {
      yield happyDone;
    });
    const before = await quotaCount();
    const event = happyBody("test-iter-matrix-3");
    const result = await routeHandler(event as never);
    await readSse(result as ReadableStream<Uint8Array>);
    const after = await quotaCount();
    expect(after).toBe(before + 1);
    expect(mockIterateStream).toHaveBeenCalledWith(
      expect.objectContaining({ anthropicApiKey: "sk-server" }),
    );
  });

  it("SSO'd + BYO set + quota > 0 -> BYO preferred, quota untouched", async () => {
    // Resolver decides preference; route just trusts it.
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-byo",
      source: "byo",
      consumesQuota: false,
    });
    mockIterateStream.mockImplementation(async function* () {
      yield happyDone;
    });
    const before = await quotaCount();
    const event = happyBody("test-iter-matrix-4");
    const result = await routeHandler(event as never);
    await readSse(result as ReadableStream<Uint8Array>);
    const after = await quotaCount();
    expect(after).toBe(before);
  });

  it("SSO'd + server key + quota = 0 -> 402 out_of_credits", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-server",
      source: "server",
      consumesQuota: true,
    });
    const exec = getDbExec();
    await exec.execute({
      sql: `UPDATE fdmd_quota SET enrich_count = bonus_credits WHERE user_id = ?`,
      args: [ANONYMOUS_OWNER],
    });
    const event = happyBody("test-iter-matrix-5");
    const result = await routeHandler(event as never);
    expect(statusOf(event as { _statusCode?: number })).toBe(402);
    expect(result).toMatchObject({ error: "out_of_credits" });
    expect(mockIterateStream).not.toHaveBeenCalled();
  });

  it("SSO'd + BYO set + quota = 0 -> BYO used, no decrement, no 402", async () => {
    mockResolveAnthropicKey.mockResolvedValueOnce({
      apiKey: "sk-byo",
      source: "byo",
      consumesQuota: false,
    });
    mockIterateStream.mockImplementation(async function* () {
      yield happyDone;
    });
    const exec = getDbExec();
    await exec.execute({
      sql: `UPDATE fdmd_quota SET enrich_count = bonus_credits WHERE user_id = ?`,
      args: [ANONYMOUS_OWNER],
    });
    const event = happyBody("test-iter-matrix-6");
    const result = await routeHandler(event as never);
    expect(result).toBeInstanceOf(ReadableStream);
    await readSse(result as ReadableStream<Uint8Array>);
  });
});
```

- [ ] **Step 8: Run the iterate route tests**

```bash
pnpm test server/routes/api/iterate-design-md.post.test.ts
```
Expected: all original tests + 6 new matrix tests pass.

- [ ] **Step 9: Run the full suite**

```bash
pnpm test
```
Expected: still green.

- [ ] **Step 10: Commit**

```bash
git add actions/iterate-design-md.ts actions/iterate-design-md.test.ts \
  server/routes/api/iterate-design-md.post.ts \
  server/routes/api/iterate-design-md.post.test.ts
git commit -m "feat(iterate): use resolveAnthropicKey, support BYO key, add auth matrix tests"
```

---

## Task 6: Wire `resolveAnthropicKey` into the enrich route

The enrich route today has no quota gate at all — it just streams. Adding the resolver lets us require either a BYO key or a server-side key (which now consumes the same quota pool).

**Files:**
- Modify: `actions/enrich-design-md.ts`
- Modify: `server/routes/api/enrich-design-md.post.ts`
- Modify: `server/routes/api/enrich-design-md.post.test.ts` (if it exists; otherwise create)

- [ ] **Step 1: Extend the enrich action input to accept an explicit key**

In `actions/enrich-design-md.ts`, mirror exactly what Task 5 Step 1 did: add `anthropicApiKey?: string` to the schema and the `EnrichInput` interface; in the stream function, prefer the input key over the env var. Show the same code shape:

```typescript
const apiKey = input.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Add it to .env.local or pass anthropicApiKey on the call.",
  );
}
// ...
const client = new Anthropic({ apiKey });
```

- [ ] **Step 2: Check whether `server/routes/api/enrich-design-md.post.test.ts` exists**

```bash
ls server/routes/api/enrich-design-md.post.test.ts
```
If it doesn't exist, skip the test-update steps in this task and instead add a small new test file mirroring the iterate route's pattern (see Task 5 Step 7 for the structure to copy).

- [ ] **Step 3: Update the enrich SSE route**

In `server/routes/api/enrich-design-md.post.ts`, before the `return new ReadableStream(...)` line, insert:

```typescript
import { resolveAnthropicKey } from "../../lib/anthropic-key.js";
import { resolveOwner } from "../../lib/owner.js";
import { decrementCredits, refundCredit } from "../../lib/quota.js";

// ...inside the handler, after input validation:

const owner = await resolveOwner(event);
let resolvedKey;
try {
  resolvedKey = await resolveAnthropicKey(event);
} catch {
  setResponseStatus(event, 402);
  return { error: "no_api_key_available", reason: "byo-key-required" };
}

let dec: { ok: boolean; remaining: number } | null = null;
if (resolvedKey.consumesQuota) {
  dec = await decrementCredits(owner);
  if (!dec.ok) {
    setResponseStatus(event, 402);
    return { error: "out_of_credits", reason: "signed-in-and-out-of-credits" };
  }
}

const inputWithKey: EnrichInput = { ...input, anthropicApiKey: resolvedKey.apiKey };
```

Then change the `for await (const ev of enrichStream(input))` to use `inputWithKey`, and in the `catch`:
```typescript
if (resolvedKey.consumesQuota && dec?.ok) {
  await refundCredit(owner).catch(() => {});
}
```

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```
Expected: still green. The enrich route's existing UI calls still work because the resolver returns the server key when no BYO key is set and quota exists.

- [ ] **Step 5: Commit**

```bash
git add actions/enrich-design-md.ts server/routes/api/enrich-design-md.post.ts \
  server/routes/api/enrich-design-md.post.test.ts 2>/dev/null
git commit -m "feat(enrich): use resolveAnthropicKey, add BYO + quota gate"
```

---

## Task 7: `GET /api/me/key-status` endpoint

**Files:**
- Create: `server/routes/api/me/key-status.get.ts`
- Create: `server/routes/api/me/key-status.get.test.ts`

- [ ] **Step 1: Write a failing test**

Create `server/routes/api/me/key-status.get.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

const mockGetByoKeyForOwner = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/anthropic-key-store", () => ({
  getByoKeyForOwner: mockGetByoKeyForOwner,
}));

const { default: handler } = await import("./key-status.get");

describe("GET /api/me/key-status", () => {
  it("returns byoKeyConfigured: false when no key stored", async () => {
    mockGetByoKeyForOwner.mockResolvedValueOnce(null);
    const result = await handler({} as never);
    expect(result).toEqual({ byoKeyConfigured: false });
  });

  it("returns byoKeyConfigured: true when a key is stored", async () => {
    mockGetByoKeyForOwner.mockResolvedValueOnce("sk-something");
    const result = await handler({} as never);
    expect(result).toEqual({ byoKeyConfigured: true });
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
pnpm test server/routes/api/me/key-status.get.test.ts
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the route**

Create `server/routes/api/me/key-status.get.ts`:

```typescript
import { defineEventHandler } from "h3";
import { resolveOwner } from "../../../lib/owner.js";
import { getByoKeyForOwner } from "../../../lib/anthropic-key-store.js";

/**
 * GET /api/me/key-status
 *
 * Returns { byoKeyConfigured: boolean } for the resolved owner.
 * Used by the UI to decide whether to show the "add your key" upsell.
 */
export default defineEventHandler(async (event) => {
  const owner = await resolveOwner(event);
  const key = await getByoKeyForOwner(owner);
  return { byoKeyConfigured: !!key };
});
```

- [ ] **Step 4: Confirm pass + full suite green**

```bash
pnpm test server/routes/api/me/key-status.get.test.ts
pnpm test
```
Expected: both green.

- [ ] **Step 5: Commit**

```bash
git add server/routes/api/me/key-status.get.ts server/routes/api/me/key-status.get.test.ts
git commit -m "feat(api): GET /api/me/key-status reports BYO key presence"
```

---

## Task 8: Extend `useCredits` to include `byoKeyConfigured`

**Files:**
- Modify: `app/lib/use-credits.tsx`

- [ ] **Step 1: Update the context type**

In `app/lib/use-credits.tsx`, change the `Credits` and `CreditsContextValue` shapes:

```typescript
export interface Credits {
  remaining: number;
  allowed: number;
}

interface KeyStatus {
  byoKeyConfigured: boolean;
}

interface CreditsContextValue {
  credits: Credits | null;
  keyStatus: KeyStatus | null;
  setRemaining: (n: number) => void;
  refresh: () => Promise<void>;
}
```

- [ ] **Step 2: Add the second fetch**

Replace the `refresh` function with:

```typescript
const refresh = async () => {
  const [creditsR, keyR] = await Promise.allSettled([
    fetch("/api/me/credits"),
    fetch("/api/me/key-status"),
  ]);
  if (creditsR.status === "fulfilled" && creditsR.value.ok) {
    try {
      setCredits((await creditsR.value.json()) as Credits);
    } catch {
      /* swallow */
    }
  }
  if (keyR.status === "fulfilled" && keyR.value.ok) {
    try {
      setKeyStatus((await keyR.value.json()) as KeyStatus);
    } catch {
      /* swallow */
    }
  }
};
```

Add the new state:
```typescript
const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
```

And include it in the `useMemo` value:
```typescript
const value = useMemo<CreditsContextValue>(
  () => ({
    credits,
    keyStatus,
    setRemaining: (n: number) =>
      setCredits((c) => (c ? { ...c, remaining: n } : c)),
    refresh,
  }),
  [credits, keyStatus],
);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```
Expected: silent success. If any consumer of `useCredits` is now type-incompatible because they destructured the whole object, fix the call site.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```
Expected: still green.

- [ ] **Step 5: Commit**

```bash
git add app/lib/use-credits.tsx
git commit -m "feat(ui): use-credits exposes byoKeyConfigured via /api/me/key-status"
```

---

## Task 9: Add `ApiKeySettings` entry to NavBar

**Files:**
- Modify: `app/components/NavBar.tsx`

This depends on Task 2's decision. Path A: drop `ApiKeySettings` in directly. Path B: drop in a custom `BYOKeyForm` that's been built in Task 7.2.

- [ ] **Step 1: Add the import and a settings menu trigger**

In `app/components/NavBar.tsx`:

```typescript
import { Link } from "react-router";
import { useState } from "react";
import { ApiKeySettings } from "@agent-native/core/client";
import CreditsChip from "@/components/CreditsChip";
import { Button } from "@/components/ui/button";
import { IconKey } from "@tabler/icons-react";

export default function NavBar() {
  const [keyOpen, setKeyOpen] = useState(false);
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center">
          <Link to="/" aria-label="free design.md" className="flex items-center">
            <span className="font-semibold text-foreground">free design</span>
            <span className="font-semibold text-primary">.md</span>
          </Link>
          <span className="mx-2 text-muted-foreground">·</span>
          <a
            href="https://agent-native.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            powered by Agent Native ↗
          </a>
        </div>
        <nav aria-label="Main" className="flex items-center gap-4">
          <CreditsChip />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKeyOpen((v) => !v)}
            aria-label="API key settings"
          >
            <IconKey size={14} />
            <span className="ml-1 text-xs">API key</span>
          </Button>
          <Link
            to="/quality"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Quality
          </Link>
        </nav>
      </div>
      {keyOpen && (
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <ApiKeySettings />
        </div>
      )}
    </header>
  );
}
```

If `ApiKeySettings` from 0.28.4 requires specific props (provider name, scope), pass them per the component's signature. Read the export from `node_modules/@agent-native/core/dist/client/` before guessing.

- [ ] **Step 2: Smoke in dev**

```bash
pnpm dev
```
Visit `http://localhost:8080/`. Click "API key". Verify a panel opens. Paste a fake key (e.g. `sk-test`), confirm it persists across reload. Kill the dev server.

- [ ] **Step 3: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add app/components/NavBar.tsx
git commit -m "feat(ui): NavBar gains API key settings entry"
```

---

## Task 10: Wrap Outlet in `<AgentSidebar>`

**Files:**
- Modify: `app/root.tsx`

- [ ] **Step 1: Update imports + JSX**

In `app/root.tsx`, add `AgentSidebar` to the existing `@agent-native/core/client` import:

```typescript
import {
  ClientOnly,
  DefaultSpinner,
  appPath,
  configureTracking,
  getThemeInitScript,
  AgentSidebar,
} from "@agent-native/core/client";
```

Wrap `<Outlet/>` in the `Root` component:

```typescript
export default function Root() {
  return (
    <ClientOnly fallback={<DefaultSpinner />}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <TooltipProvider>
          <CreditsProvider>
            <NavBar />
            <AgentSidebar
              position="right"
              defaultOpen
              emptyStateText="Tell me how to refine this design.md"
              suggestions={[
                "Tighten the spacing scale",
                "Make the brand voice more energetic",
                "Soften the radii on cards",
              ]}
            >
              <Outlet />
            </AgentSidebar>
          </CreditsProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ClientOnly>
  );
}
```

- [ ] **Step 2: Smoke in dev**

```bash
pnpm dev
```
Visit `/`. Expected: a chat sidebar appears on the right, the URL-paste UI is on the left. Toggle the sidebar — collapse/expand. Kill the dev server.

- [ ] **Step 3: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add app/root.tsx
git commit -m "feat(ui): wrap Outlet in AgentSidebar (right, default open)"
```

---

## Task 11: Push current design.md into chat model context

**Files:**
- Modify: `app/routes/_index.tsx`

The chat needs to know what design.md is currently loaded. Use `updateMcpAppModelContext` from `@agent-native/core/client` (or whichever 0.28.4 export the framework recommends — verify before writing).

- [ ] **Step 1: Verify the right export**

```bash
grep -n "updateMcpAppModelContext\|useMcpAppHostContext" node_modules/@agent-native/core/dist/client/*.d.ts | head -5
```
Expected: confirm `updateMcpAppModelContext` exists in 0.28.4. If the framework prefers a different surface (e.g. a screen-context hook), use that instead.

- [ ] **Step 2: Add the context push**

In `app/routes/_index.tsx`, near the top imports:

```typescript
import { updateMcpAppModelContext } from "@agent-native/core/client";
import { useEffect } from "react";
```

Inside the component, after the `enriched` state declaration is settled (find the existing `const enriched = ...` line):

```typescript
useEffect(() => {
  if (!enriched?.markdown) return;
  updateMcpAppModelContext({
    contents: [
      {
        type: "text",
        text:
          "The user has loaded this AI-enriched design.md. Treat it as the " +
          "current document. When the user asks to revise it, call the " +
          "iterate-design-md action.\n\n" +
          enriched.markdown,
      },
    ],
  });
}, [enriched?.markdown]);
```

- [ ] **Step 3: Smoke in dev**

```bash
pnpm dev
```
Visit `/`. Paste a URL. Click extract. Click enrich. Open the chat sidebar. Type "what colors does this design system use?" — the agent should respond grounded in the loaded design.md content. Kill the dev server.

- [ ] **Step 4: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add app/routes/_index.tsx
git commit -m "feat(ui): push enriched design.md into chat model context"
```

---

## Task 12: Replace IteratePanel with chat-driven iterate

**Files:**
- Delete: `app/components/IteratePanel.tsx`
- Modify: `app/routes/_index.tsx`

The chat already streams responses. For the iteration UX we want the chat's user message → tool call to `iterate-design-md` → streamed result that lands in the existing `iterCandidate` / `SideBySideMemo` flow.

The cleanest path: when the chat's iterate tool finishes, the agent backend POSTs the result to a small bridge endpoint, or the UI subscribes to the chat's tool-call lifecycle via a hook from `@agent-native/core/client` (likely `useProductionAgent` or an event from the AgentSidebar). The exact wiring depends on what 0.28.4 exposes.

- [ ] **Step 1: Find the chat-tool-result subscription API**

```bash
grep -rn "tool.*result\|onToolCall\|useAgentChat" node_modules/@agent-native/core/dist/client/*.d.ts | head -20
```
Identify the hook/event that fires when a tool call completes. Most likely candidates: `useAgentChatGenerating` to know when streaming finishes, plus reading the message list from `useProductionAgent` or `AssistantChat` exports.

- [ ] **Step 2: Subscribe in `_index.tsx`**

Hook-based subscription that watches for `iterate-design-md` tool-call completions and feeds the result into the existing iterate-session state. The exact code depends on Step 1's findings — write it once the API is known. Sketch:

```typescript
// In _index.tsx, near the iterate-session state:
import { useAgentChatGenerating /* + the right tool-call hook */ } from "@agent-native/core/client";

// ...inside the component:
// useEffect(() => {
//   const off = subscribeToToolCalls((call) => {
//     if (call.name === "iterate-design-md" && call.status === "completed") {
//       // call.result.markdown is the new design.md
//       handleIterate({ ... });  // OR drive the existing iter-session state directly
//     }
//   });
//   return off;
// }, []);
```

- [ ] **Step 3: Remove IteratePanel rendering**

In `app/routes/_index.tsx`, delete lines 545–568 (the entire `{enriched?.markdown && iterSession && (...)}` block that renders `IteratePanel` + `SideBySideMemo`) and replace with a version that only renders `SideBySideMemo` (still useful for showing the diff once the chat returns a candidate):

```tsx
{enriched?.markdown && iterSession && (iterStreaming || iterCandidate || iterSession.previous) && (
  <div className="flex flex-col gap-3">
    <SideBySideMemo
      previous={
        iterStreaming || iterCandidate
          ? iterSession.current.markdown
          : iterSession.previous?.markdown ?? ""
      }
      next={iterCandidate || iterSession.current.markdown}
      isStreaming={iterStreaming}
      candidatePending={!!iterCandidate}
      onKeep={handleKeep}
      onDiscard={handleDiscard}
    />
  </div>
)}
```

Also remove the `import IteratePanel from "@/components/IteratePanel";` line at the top (line 17).

- [ ] **Step 4: Delete the component file**

```bash
rm app/components/IteratePanel.tsx
```

- [ ] **Step 5: Confirm `iterate-design-md` is reachable as a tool from the chat**

The action is already wrapped in `defineAction(...)`. In 0.28.4 the framework should auto-register actions as agent tools. Verify by:
```bash
pnpm dev
```
Open `/`, paste a URL, enrich, then in the chat sidebar type "make the headline more energetic". Watch the network panel for a POST to `/api/iterate-design-md`. If the chat does not pick the action as a tool, check whether ag-blank's starter does anything extra to advertise tools (search `apps/starter/app/` and `apps/starter/server/` for `tool` references) and replicate.

- [ ] **Step 6: Typecheck + tests**

```bash
pnpm typecheck && pnpm test
```
Expected: green. The IteratePanel-specific UI test (if any) needs to be removed or rewritten — search for it:
```bash
grep -rn "IteratePanel" app/ server/ shared/ 2>/dev/null
```
Delete or rewrite each hit.

- [ ] **Step 7: Commit**

```bash
git add app/routes/_index.tsx
git rm app/components/IteratePanel.tsx
# include any test edits from Step 6
git commit -m "feat(ui): chat sidebar drives iterate, remove IteratePanel"
```

---

## Task 13: Update CLAUDE.md / AGENTS.md

**Files:**
- Modify: `CLAUDE.md` (which is a symlink to `AGENTS.md`) — edit `AGENTS.md`.

- [ ] **Step 1: Find the section that describes the iterate flow**

```bash
grep -n "iterate-design-md\|IteratePanel" AGENTS.md
```

- [ ] **Step 2: Replace the relevant prose with the new flow**

In `AGENTS.md`, find the API routes table row for `POST /api/iterate-design-md` and update it to read:

```
| POST   | `/api/iterate-design-md`              | SSE wrapper over `iterate-design-md`. Resolves the Anthropic key via `server/lib/anthropic-key.ts`: prefers the session's BYO key, falls back to the server key with quota decrement. Returns 402 when no key is available, 422 on blocklist hit, 400 on input-cap violation. The chat sidebar on `/` is the surface that drives this route. |
```

And add a row for the new key-status endpoint:
```
| GET    | `/api/me/key-status`                  | Returns `{ byoKeyConfigured: boolean }` for the resolved owner. Used by the UI to show or hide the "add your key" upsell. |
```

In the "Actions reference" table, update `iterate-design-md` to mention the optional `anthropicApiKey` parameter.

In the "Phase 2" section, mark the bullet about SSO sign-in gate as partially in progress (chat sidebar + BYO key path landed in `feat/chat-sidebar-port`).

Add a short paragraph at the end of "Why this is agent-native":

```
**Update (2026-05-30 — chat-sidebar-port branch):** The app now mounts the
agent-native chat sidebar on the right of `/`. The URL-paste pipeline (extract
+ enrich) stays as deterministic UI buttons; iteration is driven from the chat
("tighten the spacing", "make the brand voice more energetic"). The chat
backend calls `iterate-design-md` as a tool. Anonymous users must bring their
own Anthropic key; Builder-SSO users get 3 free server-key calls and then must
also BYO.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for chat-driven iterate + BYO key flow"
```

---

## Task 14: Manual dogfood + final commit

**Files:** none modified — verification only.

- [ ] **Step 1: Full test + typecheck**

```bash
pnpm typecheck && pnpm test
```
Expected: green. If 144 + new tests don't all pass, do not proceed.

- [ ] **Step 2: Build**

```bash
pnpm build
```
Expected: clean build, no warnings about missing exports from the 0.28.4 bump.

- [ ] **Step 3: Production start smoke**

```bash
pnpm start &
SERVER_PID=$!
sleep 3
curl -sS http://localhost:8080/ | head -20
kill $SERVER_PID
```
Expected: HTML returned, no 500.

- [ ] **Step 4: Manual flow — anonymous + no BYO**

```bash
pnpm dev
```
Open a private browser window (no Builder SSO). Visit `http://localhost:8080/`. Paste `stripe.com`, click extract. Click enrich — expect 402 with "add your key" upsell rendered by the chat sidebar. Open the API key settings from NavBar, paste a real Anthropic test key. Re-try enrich — succeeds. Type "tighten the spacing" in the chat — verify it calls iterate-design-md and the side-by-side diff appears in the left pane.

- [ ] **Step 5: Manual flow — SSO + quota**

Sign in via Builder SSO (`/api/auth/builder/start`). Reload `/`. Confirm the credits chip shows 3 credits. Run extract + enrich + 3 iterations in the chat. Confirm quota decrements to 0. Confirm the 4th iterate attempt surfaces "out of credits" with the "add your key" upsell.

- [ ] **Step 6: Manual flow — SSO + BYO**

While SSO'd, paste a BYO Anthropic key in the API key settings. Run an iterate — confirm via `GET /api/me/credits` (in another tab) that quota did **not** decrement.

- [ ] **Step 7: Stop the dev server**

- [ ] **Step 8: Push the branch (do NOT merge)**

```bash
git push -u origin feat/chat-sidebar-port
```

- [ ] **Step 9: Open a PR (do NOT merge yet)**

```bash
gh pr create --title "feat: chat sidebar port (option B)" --body "$(cat <<'EOF'
## Summary

- Adds the agent-native chat sidebar to /, replacing IteratePanel. Iterate is now driven from chat ("tighten the spacing scale" etc.)
- Adds a hybrid Anthropic-key auth model via server/lib/anthropic-key.ts: BYO key always preferred, server key falls back with quota decrement, 402 when neither is available.
- Bumps @agent-native/core from 0.22.7 to 0.28.4 (first commit on the branch).
- Wires getSession into resolveOwner so per-user quotas work for Builder-SSO users (previously single-tenant).

Spec: docs/superpowers/specs/2026-05-30-chat-sidebar-port-design.md
Plan: docs/superpowers/plans/2026-05-30-chat-sidebar-port.md

## Test plan

- [ ] pnpm typecheck + pnpm test green (144 baseline + ~10 new tests)
- [ ] Manual: anonymous + no BYO key -> 402 with upsell
- [ ] Manual: anonymous + BYO -> iterate works, no quota touched
- [ ] Manual: SSO'd + quota=3 -> 3 iterations on server key, 4th shows "add your key"
- [ ] Manual: SSO'd + BYO -> BYO preferred even with quota remaining
- [ ] Manual: pnpm build && pnpm start serves /

**Do not merge until @zuchka has manually dogfooded the branch and explicitly approved.**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10: Report back**

Drop the PR URL in the conversation. **Do not run `gh pr merge`. The user merges manually after dogfood.**

---

## Out of scope (do not implement here)

- Migrating to the ag-blank monorepo.
- Registering extract or enrich as chat tools (only iterate).
- Phase 2 productization items from `docs/spike-ai-enrichment-verdict.md`.
- Encryption-at-rest beyond what `ApiKeySettings` already provides.

## Risks and watchouts

- The 0.22.7 → 0.28.4 bump is the biggest risk. Task 1 isolates it. If it explodes, revert that single commit before continuing.
- Task 2's Path A/B decision can add two tasks (7.1, 7.2). Resolve it before Task 7. Concrete steps for Path B are in Appendix A.
- The chat-tool-call subscription in Task 12 depends on framework internals — read the source before writing the hook, don't guess.
- `updateMcpAppModelContext` (Task 11) may have a payload size limit. If the design.md is too big, fall back to a short reference + a tool that returns the full markdown on request.
- The enrich route's quota gating is technically a new failure mode on a previously-public endpoint. The spec allows this because the success path is unchanged when a server key is configured; document the new 402 in `AGENTS.md` (Task 13).

---

## Appendix A: Path B fallback (only if Task 2 chose Path B)

Use these tasks only if `ApiKeySettings` from `@agent-native/core/client` requires an SSO'd identity and won't store keys against anonymous sessions. Insert them between Task 7 and Task 8.

### Task 7.1: Add `anthropic_api_key` column to `fdmd_sessions`

**Files:**
- Modify: `server/db/schema.ts` (or wherever `fdmd_sessions` is defined)
- Modify: `server/db/migrations` (additive migration)

- [ ] **Step 1: Add the nullable column to the Drizzle schema**

Find the `fdmd_sessions` table definition and add:
```typescript
anthropicApiKey: text("anthropic_api_key"),  // nullable
```

- [ ] **Step 2: Write the additive migration**

Follow the existing migration pattern in `server/db/migrations`:
```sql
ALTER TABLE fdmd_sessions ADD COLUMN anthropic_api_key TEXT;
```

- [ ] **Step 3: Run the migration locally; verify schema**

```bash
pnpm action db-status
```
Confirm the column exists.

- [ ] **Step 4: Update `server/lib/anthropic-key-store.ts` to read it**

```typescript
import { getDbExec } from "@agent-native/core/db";

export async function getByoKeyForOwner(owner: string): Promise<string | null> {
  if (owner === "anonymous@free-design-md.local") return null;
  const exec = getDbExec();
  const r = await exec.execute({
    sql: `SELECT anthropic_api_key FROM fdmd_sessions WHERE user_email = ? AND anthropic_api_key IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    args: [owner],
  });
  const row = r.rows[0] as { anthropic_api_key: string | null } | undefined;
  return row?.anthropic_api_key ?? null;
}
```

- [ ] **Step 5: Run tests + commit**

```bash
pnpm test
git add server/db/schema.ts server/db/migrations server/lib/anthropic-key-store.ts
git commit -m "feat(db): fdmd_sessions.anthropic_api_key column for BYO keys"
```

### Task 7.2: `POST /api/me/anthropic-key` route + `BYOKeyForm` component

**Files:**
- Create: `server/routes/api/me/anthropic-key.post.ts`
- Create: `app/components/BYOKeyForm.tsx`

- [ ] **Step 1: Write the route**

```typescript
import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { getDbExec } from "@agent-native/core/db";
import { resolveOwner } from "../../../lib/owner.js";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { apiKey?: string } | null;
  if (!body || typeof body.apiKey !== "string" || !body.apiKey.startsWith("sk-")) {
    setResponseStatus(event, 400);
    return { error: "bad_key" };
  }
  const owner = await resolveOwner(event);
  if (owner === "anonymous@free-design-md.local") {
    setResponseStatus(event, 401);
    return { error: "sign_in_required" };
  }
  const exec = getDbExec();
  await exec.execute({
    sql: `UPDATE fdmd_sessions SET anthropic_api_key = ? WHERE user_email = ?`,
    args: [body.apiKey, owner],
  });
  return { ok: true };
});
```

- [ ] **Step 2: Write the form component**

```typescript
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BYOKeyForm() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "err">("idle");
  async function save() {
    setStatus("saving");
    const r = await fetch("/api/me/anthropic-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: value }),
    });
    setStatus(r.ok ? "ok" : "err");
    if (r.ok) setValue("");
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-..."
        className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
      />
      <Button size="sm" onClick={save} disabled={!value.startsWith("sk-") || status === "saving"}>
        {status === "saving" ? "Saving…" : status === "ok" ? "Saved" : "Save"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: In Task 9, swap `<ApiKeySettings />` for `<BYOKeyForm />`**

If Path B is in effect, Task 9 Step 1 uses `BYOKeyForm` instead of the framework component. Same drawer behavior.

- [ ] **Step 4: Run tests + commit**

```bash
pnpm test
git add server/routes/api/me/anthropic-key.post.ts app/components/BYOKeyForm.tsx
git commit -m "feat(ui): BYO Anthropic key form + endpoint (Path B fallback)"
```
