# Chat Sidebar Port — Design Spec

**Date:** 2026-05-30
**Branch:** `feat/chat-sidebar-port` (do not merge to `main` without explicit user approval after manual dogfood)
**Status:** Approved by user (sections 1–3) — pending spec review before planning

## Goal

Bring the agent-native chat sidebar UX into `free-design-md` so users can converse with an AI agent about the design.md they have loaded, while preserving the existing URL-paste → extract → enrich pipeline and the 144-test safety net.

Reject the alternative (porting fdmd business logic into `ag-blank/apps/starter`): too much surface area (5,200+ LOC of actions/server, custom Builder SSO, quota tables, deployed infra) to relocate when the chat sidebar is a single component import (`AgentSidebar` from `@agent-native/core/client`) already available in the framework fdmd depends on.

## Hard Constraints

1. **Feature branch only.** All work lands on `feat/chat-sidebar-port`. No commits to `main` until the user has manually dogfooded the result and explicitly approves the merge. This is a durable user preference, not a temporary stance.
2. **No regression in the existing 144 tests.** They must keep passing after every commit on this branch.
3. **No breaking changes to the public action / API contract.** `pnpm action extract-design-md`, `pnpm action enrich-design-md`, `pnpm action iterate-design-md`, `GET /api/extract`, `POST /api/enrich-design-md`, `POST /api/iterate-design-md`, and `GET /api/me/credits` must keep their existing input/output shapes and existing semantics for callers that supply a server key.
4. **CI on the branch stays green throughout.**

## Architecture

Single app, unchanged repo layout. Stay in `/Users/builder-matt/code/free-design-md`, mounted at `/`. Do **not** move into the ag-blank monorepo.

Bump `@agent-native/core` from 0.22.7 → 0.28.4 as the **first commit on the branch**, fix any breakage, then layer the sidebar work on top.

Wrap `<Outlet/>` in `app/root.tsx` with `<AgentSidebar position="right" defaultOpen>`. The home page (`/`) keeps its URL-paste-→-extract-→-enrich flow on the left; the sidebar lives on the right.

The chat sidebar replaces the existing `IteratePanel.tsx` and nothing else. Extract and enrich remain deterministic UI buttons that call their existing actions. Only iterate becomes chat-driven.

## Tech Stack

- `@agent-native/core` **0.28.4** (bumped from 0.22.7).
- React Router 7 (unchanged).
- Anthropic SDK (unchanged — `@anthropic-ai/sdk` ^0.96.0).
- SQLite via `@libsql/client` + Drizzle (unchanged).
- shadcn-style UI primitives already in `app/components/ui/` (unchanged).
- New surface from core 0.28.4: `AgentSidebar`, `AgentToggleButton`, `ApiKeySettings`, `sendToAgentChat`, `updateMcpAppModelContext`.

## Components

### Files to add

- (none — all new behavior wires into existing files)

### Files to modify

- `package.json` — bump `@agent-native/core` to `^0.28.4`. Adjust any peer-dep version mismatches that surface.
- `app/root.tsx` — wrap `<Outlet/>` in `<AgentSidebar position="right" defaultOpen emptyStateText="Tell me how to refine this design.md" suggestions={[…]}>`. Keep `CreditsProvider`, `NavBar`, `ThemeProvider` exactly where they are.
- `app/routes/_index.tsx` — when an AI-enriched design.md is loaded, call `updateMcpAppModelContext()` (or the equivalent screen-context API in 0.28.4) so the chat sees the current markdown + URL + designSystemData as model context. Remove the `<IteratePanel>` render call.
- `app/components/NavBar.tsx` — add a settings/gear entry that opens `ApiKeySettings` (from `@agent-native/core/client`). `CreditsChip` stays, repositioned next to it.
- `app/lib/use-credits.ts` — extend the hook's return shape to also surface `byoKeyConfigured: boolean`, sourced from a new `/api/me/key-status` endpoint (or whatever the framework provides for asking "does this session have an Anthropic key set?").

### Files to delete

- `app/components/IteratePanel.tsx`
- Any tests that exercise IteratePanel rendering specifically (replaced by sidebar interaction tests). Hold the supporting `iterate-design-md` action tests untouched.

### Server-side changes

- `actions/iterate-design-md.ts` — accept an optional `anthropicApiKey` parameter on the input shape. When present, use it directly. When absent, fall back to `ANTHROPIC_API_KEY` from env (today's behavior). The action itself stays portable for `pnpm action` use.
- `server/routes/api/iterate-design-md.post.ts` (the SSE wrapper) — implements the key-resolution order in the Auth Model section below. Only this HTTP route knows about quotas, sessions, and BYO keys. It hands the resolved key to the action.
- `actions/enrich-design-md.ts` + `server/routes/api/enrich-design-md.post.ts` — same treatment as iterate. The Builder Connect gating on the UI button stays.
- (Possibly new) `server/routes/api/me/key-status.get.ts` — returns `{ byoKeyConfigured: boolean }` for the current session, used by `use-credits.ts` and the NavBar.

## Auth Model

Two cookies in play, both already issued by the existing framework / fdmd code:
- An **anonymous session cookie** issued by the framework on first visit (already exists; `getSession()` returns an anonymous identity).
- The **`fdmd_session` cookie** issued after Builder SSO completes (already exists; `getSession()` returns the Builder-verified user).

The BYO Anthropic key is stored against whichever session is active, via `ApiKeySettings` from `@agent-native/core/client`. This works for both anonymous and SSO'd sessions.

### Key resolution order (per iterate / enrich request)

On every server-side AI call:

1. Does `ApiKeySettings` have a stored Anthropic key for this session?
   - **Yes** → use it. Do **not** decrement `fdmd_quota`. Done.
2. Does this session have `fdmd_quota.remaining > 0`?
   - **Yes** → use the server's `ANTHROPIC_API_KEY`. Decrement `fdmd_quota.remaining` by 1. Done.
3. Otherwise → return `402` with `{ reason: "byo-key-required" | "signed-in-and-out-of-credits" }`. UI shows the appropriate upsell in the chat.

### Authorization matrix

| State | Cookie | Quota | BYO key | Iterate works? |
|---|---|---|---|---|
| Anonymous, no BYO key | anonymous | n/a | none | No — 402, "add your key or sign in" |
| Anonymous, BYO key set | anonymous | n/a | yes | Yes, against user's key |
| Builder SSO'd, quota > 0, no BYO | `fdmd_session` | > 0 | none | Yes, server key + decrement |
| Builder SSO'd, quota > 0, BYO set | `fdmd_session` | > 0 | yes | Yes, **BYO preferred**, quota untouched |
| Builder SSO'd, quota = 0, no BYO | `fdmd_session` | 0 | none | No — 402, "add your key" |
| Builder SSO'd, quota = 0, BYO set | `fdmd_session` | 0 | yes | Yes, against user's key |

### Verification needed during implementation

**`ApiKeySettings`-against-anonymous-session assumption.** `@agent-native/core` 0.28.4's `ApiKeySettings` must let any framework session (anonymous or SSO'd) store a key. If it requires authenticated identity, fall back to: a small `BYOKeyForm` component + a new `POST /api/me/anthropic-key` route that writes the key to the existing `fdmd_sessions` table (new nullable column `anthropic_api_key`). Verify the framework's behavior on the very first implementation step so the fallback decision is made before the surrounding UI work.

## Chat ↔ Iterate Wiring

The agent backend behind the sidebar registers `iterate-design-md` as a tool (via the action's existing `defineAction` declaration, which the framework should pick up automatically in 0.28.4). The chat's model context is updated each time the user enriches a design.md so the agent always knows what markdown is loaded.

When the user types something like `"tighten the spacing scale"` in the sidebar:
1. The chat surface sends the message to the agent with current model context (the enriched design.md).
2. The agent picks the `iterate-design-md` tool.
3. The tool call goes through the SSE route, which resolves the key per the order above and streams the result back.
4. The home page subscribes to the streamed result (via the same Kept-iterations pattern that exists today for IteratePanel) and updates the left-side preview.

**Existing UX preserved:** the "Kept iterations" persistence, the Markdown/Preview toggle on side-by-side view, and `efbd6dc`'s recent reload-persistence behavior all continue to work — they read from the same underlying state.

## Out of Scope (explicit YAGNI)

- Migrating to the ag-blank monorepo. Rejected; see Goal.
- Registering `extract-design-md` or `enrich-design-md` as chat tools. Only `iterate-design-md` becomes chat-driven in this branch.
- Phase 2 productization items from `docs/spike-ai-enrichment-verdict.md`: URL cache, multi-provider fallback, eval harness, design.md as a Builder.io Space resource.
- Encryption-at-rest for BYO keys beyond what `ApiKeySettings` already provides. If the framework stores them in plaintext, that's a follow-up issue, not a blocker for this branch.
- Removing the deterministic `Enrich with AI` button. The button stays.
- Any UI redesign beyond inserting the sidebar and removing IteratePanel.

## Testing

### Automated (must not regress 144 existing tests)

- Six new tests covering the authorization matrix in the Auth Model section:
  - Anonymous, no BYO → 402.
  - Anonymous, BYO → iterate succeeds, no quota touched.
  - SSO'd, quota > 0, no BYO → iterate succeeds, quota decrements.
  - SSO'd, quota > 0, BYO → iterate succeeds, BYO key used, quota untouched.
  - SSO'd, quota = 0, no BYO → 402.
  - SSO'd, quota = 0, BYO → iterate succeeds, no quota touched.
- One test confirming `iterate-design-md` action still works under `pnpm action` with no HTTP context (env-key path preserved).
- One test confirming the SSE route still returns 422 on blocklist hit and 400 on input-cap violation (existing behavior unchanged).
- `server/agent-card.test.ts` updated if the agent card now advertises a chat-tool-registration for `iterate-design-md` distinct from its A2A skill.

### Manual (required before requesting merge)

- `pnpm dev` on port 8080: paste a URL → extract → enrich → iterate via chat. Verify the diff lands in the left-side preview.
- BYO key flow: open `ApiKeySettings` from NavBar, paste a test Anthropic key, run iterate from chat. Verify the quota did **not** decrement (check `/api/me/credits`).
- SSO + quota flow: sign in, iterate 3 times without BYO, confirm quota decrements to 0, confirm the 4th attempt surfaces the "add your key" upsell in the chat.
- Anonymous + no BYO: confirm 402 with the right error copy rendered in the chat surface.
- `pnpm build && pnpm start` — confirm SSR still works post-bump.

## Risks

- **Framework bump 0.22.7 → 0.28.4 spans 6 minor versions.** Likely breakage spots: client export renames, theme/appearance API, session-cookie shape, agent-chat API surface. Mitigation: bump is the first commit. Run `pnpm typecheck && pnpm test` before any other change. Fix inline.
- **`ApiKeySettings`-for-anonymous assumption.** See verification note in Auth Model. Mitigation: verify on day one.
- **Sidebar steals real estate from the design.md preview.** Mitigation: `AgentSidebar` is collapsible and remembers state (built-in framework behavior). Default-open is fine; user can collapse.
- **Chat needs current design.md as context.** If `updateMcpAppModelContext` doesn't carry markdown of this size, fall back to passing a reference / short summary and letting the agent re-fetch from the existing extract cache.

## Files (summary)

Modified:
- `package.json`
- `app/root.tsx`
- `app/routes/_index.tsx`
- `app/components/NavBar.tsx`
- `app/lib/use-credits.ts`
- `actions/iterate-design-md.ts`
- `actions/enrich-design-md.ts`
- `server/routes/api/iterate-design-md.post.ts` (the SSE handler)
- `server/routes/api/enrich-design-md.post.ts`
- `server/routes/api/iterate-design-md.post.test.ts` (extend with auth-matrix tests)
- `server/agent-card.test.ts` (if applicable)
- `CLAUDE.md` / `AGENTS.md` — short note on the new chat-driven iterate flow

Added:
- `server/routes/api/me/key-status.get.ts` (only if `ApiKeySettings` doesn't expose this directly)
- 6+ test cases for the auth matrix
- Possibly: `BYOKeyForm` component + `POST /api/me/anthropic-key` route (only if `ApiKeySettings` doesn't work for anonymous sessions)

Deleted:
- `app/components/IteratePanel.tsx`
- IteratePanel-specific tests (replaced by sidebar-based tests)
