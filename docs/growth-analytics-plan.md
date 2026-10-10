> Implementation status: application, schema, reports, privacy controls, maintenance command and local verification are implemented. The production allowlist, collection flag and daily service are staged in Railway; schema/application deployment and live observation remain rollout steps. See [the implementation guide](growth-analytics.md) for exact definitions, tested behavior and deliberate limitations (historical ledger projections are unattributed; no lifetime report snapshots are retained).

# Growth analytics implementation plan

Status: proposed; implementation has not started.

Goal: measure acquisition, meaningful free and paid usage, retention, and purchase conversion without requiring sign-in for free extraction.

## Baseline and implementation target

The reviewed checkout (`codex/extraction-diagnostics`) contains the older SQLite runtime. The locally available `origin/main` at `a1f4d88` includes the Postgres reconciliation from PR #69. Its deployment guide identifies `main` as the release source. Start implementation from refreshed `main`, verify the actual deployed commit and database, and use versioned migrations in `supabase/migrations/`. Do not introduce SQLite migrations or runtime DDL.

Current instrumentation provides aggregate extraction, AI, artifact-action, and billing metrics. It does not persist an identity-linked activity history. Browser/API requests currently share the HTTP classification. The workspace automatically creates anonymous Better Auth sessions, but public docs/examples do not run that bootstrap. Account linking transfers application records; it does not yet preserve analytics identity relationships.

Keep Better Auth, the private Postgres `app` schema, React Router resource routes, and existing Prometheus operational metrics. Build a private `/admin/analytics` dashboard. No external product-analytics service is needed for this version.

## 1. Define and version the measurements

- [ ] Add `shared/analytics.ts` with event names, allowed properties, source categories, and `definition_version = 1`.
- [ ] Document each report's population, exclusions, denominator, time window, and collection start date in `docs/growth-analytics.md`.
- [ ] Store timestamps as `timestamptz`; use UTC and half-open reporting intervals `[start, end)`. Label UTC in the dashboard.

| Report             | Definition                                                                                                                                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active creator     | A resolved identity with at least one successful free extraction, completed AI enrichment/revision, or explicit copy/download of its generated artifact. A page view, failed attempt, purchase alone, or automatic cache restore does not qualify.         |
| Calendar MAU       | Distinct active creator identities during a calendar month. Completed months are the default growth comparison.                                                                                                                                            |
| Rolling activity   | Distinct active creators in the trailing 24 hours, 7 days, and 30 days, calculated at the report's `as_of` timestamp. Never sum daily distinct counts to get MAU.                                                                                          |
| New / returning    | New means first observed qualifying activity is in the selected period; returning means first qualifying activity precedes it. Do not claim a newly observed anonymous browser is a new human.                                                             |
| Weekly retention   | Of identities first active in a UTC calendar week beginning Monday, the percentage active in the following calendar week. Exclude incomplete follow-up windows.                                                                                            |
| Monthly retention  | Of identities first active in a calendar month, the percentage active in the following calendar month. Show later-month cohorts as data accumulates.                                                                                                       |
| Activation funnel  | Observed browser visitor → extraction success → copy/download of the corresponding generated artifact. Ordered events; seven-day conversion window from first observed visit. Also report extraction-to-export conversion within seven days of extraction. |
| Purchase funnel    | First observed activation → verified account → first fulfilled purchase, within 30 days of activation. Separately show checkout-created → fulfilled purchase within seven days, and direct purchasers without observed activation.                         |
| Purchasers / sales | Unique fulfilled purchasers, first-time purchasers, repeat purchasers, fulfilled packs, and gross fulfilled Checkout amounts, grouped by currency and fulfillment date.                                                                                    |
| Acquisition        | First observed external referring hostname and allowlisted campaign source/medium/name; report their activation, retention, and purchase outcomes. Keep direct/unknown explicit.                                                                           |
| Coverage           | Attributed versus unattributed requests, accepted/dropped events, excluded test/bot activity, collection availability, and historical coverage dates.                                                                                                      |

Show anonymous browsers still unlinked, verified accounts, and their deduplicated combined estimate. For identity-based reports, classify using the current resolved identity; preserve the original anonymous/verified state on each event for funnel analysis. Explain that later verified linking may revise recent historical distinct counts.

Only browser product activity qualifies for headline creator metrics. Keep curated example exports, public-share engagement, API/CLI activity, self-hosted activity, known bots, and internal tests in separate breakdowns. Exporting another person's public snapshot is engagement, not ownership of that person's creation. A verified free user remains a free user unless they purchase; verification is not a paid segment.

Use actual retained payment amounts, not catalog prices. Label sales as gross Checkout receipts, potentially including tax and reflecting discounts; do not present them as net revenue or MRR. Credit refunds are not cash refunds. Net revenue would require monetary-refund and dispute reconciliation beyond this report.

## 2. Persist activity and identity relationships

- [ ] Add an additive, versioned migration and matching Drizzle schema entries.
- [ ] Add `server/lib/analytics.ts` for validation, writes, identity resolution, and bounded failure handling.
- [ ] Add `server/lib/analytics-queries.ts` for report queries shared by the dashboard and exports.

Proposed private tables:

| Table                      | Purpose / key fields                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.analytics_identities` | Internal identity ID, kind, optional unique Better Auth user ID, canonical identity reference, first seen/first active timestamps, and internal-test designation. Analytics identity survives anonymous-auth record deletion.                  |
| `app.analytics_visitors`   | Digest of an opaque browser cookie, associated anonymous identity, creation/last-seen/expiry timestamps, and bounded first-touch attribution. It is not an authorization credential.                                                           |
| `app.analytics_events`     | UUID, server event time and receipt time, observed identity, event name, source, environment, trust category, event-time auth state, definition version, deduplication key, optional operation/artifact reference, and allowlisted properties. |

Use a unique server deduplication key for request/operation outcomes and namespaced client UUIDs for browser events. Index time-window scans, identity/time lookups, event/time lookups, and operation/artifact references based on the actual report queries. Preserve merge aliases rather than rewriting every historical event. Prevent alias cycles and conflicting account links transactionally.

Start with indexed event queries and a short private response cache. Add daily activity tables or materialized reports only if measured query latency requires them; precomputed daily totals cannot produce exact monthly distinct users.

Keep these tables outside the Supabase Data API, with explicit runtime grants and no `anon`/`authenticated` access. Better Auth continues to supply identity; do not introduce Supabase Auth. Test privileges with the actual runtime role. This follows the project's private-schema model and [Supabase's separation of grants and row access](https://supabase.com/docs/guides/api/securing-your-api).

## 3. Recognize anonymous visitors and link verified accounts

- [ ] Add `server/lib/analytics-identity.ts` and a React Router `/api/analytics/visitor` resource route for browser bootstrap.
- [ ] Issue a server-generated, signed, opaque first-party visitor cookie: `HttpOnly`, `Secure` in production, `SameSite=Lax`, root path, proposed 180-day rolling lifetime. Store its digest, not the raw cookie. Never use it to authorize saved designs or billing.
- [ ] Establish visitor identity on dynamic workspace document responses where practical. Use the bootstrap endpoint on cacheable public pages so shared HTML responses never distribute one visitor's cookie to another visitor.
- [ ] Resolve verified users from the server-validated Better Auth session; resolve anonymous visitors independently of the auth session lifetime. The current default auth session can expire after seven days even when an analytics reporting period is longer. [Better Auth session documentation](https://better-auth.com/docs/concepts/session-management)
- [ ] Never wait for analytics to allow extraction. Requests before identity is established remain unattributed; report this coverage loss. Do not mint a countable new visitor for every cookieless API request. Require a returned cookie or a valid account session before including an identity in unique counts.
- [ ] Extend verified sign-in/account-link handling to associate the current unlinked anonymous identity with the verified account. Preserve the alias before the anonymous auth record can be deleted, including sign-in to an existing account. If verification happens on another browser without a proven link, leave the original browser separate.
- [ ] Merge idempotently and flatten aliases to one account identity. Two browsers signing in to the same account resolve to one account; two different verified accounts must never be merged.
- [ ] Rotate anonymous analytics identity on explicit sign-out/account switch. Also rotate when a previously account-bound visitor cookie is presented without a valid session, rather than assuming whoever uses that browser next is the same person. Cookie expiry/clearing creates a new observed browser.
- [ ] Handle analytics failures during linking without failing sign-in or deleting an unrecoverable link: persist a minimal link intent with the account-transfer transaction and allow reconciliation; if that is unavailable, leave history unlinked and report the gap.

Do not accept owner IDs or canonical identity mappings from client event bodies. No email address, IP-based identity, or fingerprint is needed for analytics. Shared browsers and unlinked devices remain an acknowledged source of error.

## 4. Instrument the complete journey

| Event                                                             | Authoritative capture point                                                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page_viewed`                                                     | Small browser collector in `app/root.tsx`, covering workspace, docs, examples, and public snapshots. Deduplicate hydration/router repeats; record page category rather than query strings.     |
| `extraction_started`, `extraction_succeeded`, `extraction_failed` | Existing extraction HTTP handler and trace boundary. One outcome per request despite internal retries; link by server request ID. Record bounded failure categories, not raw errors.           |
| `artifact_copied`, `artifact_downloaded`, `share_link_copied`     | Existing artifact event helper and UI controls, after the action succeeds or a browser download is initiated. Label these as browser-reported actions.                                         |
| `public_snapshot_saved`                                           | Server persistence success. A saved snapshot is not an additional extraction or automatic activation.                                                                                          |
| `ai_started`, `ai_succeeded`, `ai_failed`                         | Existing enrichment and revision routes, keyed by credit operation. Hosted success requires successful stream completion and credit commit. Keep blocked attempts and failed refunds distinct. |
| `sign_in_requested`, `account_verified`                           | Accepted magic-link request and server-observed successful verification. Verification is deduplicated per account; never include link tokens or email.                                         |
| `checkout_created`, `purchase_fulfilled`                          | Durable pending-purchase creation and verified fulfillment records. Idempotent projection keyed by Checkout Session; webhook retries do not create new sales.                                  |

- [ ] Extend the existing artifact-event flow so each click emits one event and continues updating its existing operational counter; avoid running two browser collectors for the same action.
- [ ] Add the new browser ingestion resource route at `/api/analytics/events`. Allow only client-reportable events; clients cannot assert purchases, verified accounts, or server extraction/AI success.
- [ ] Carry opaque artifact/request references into extraction cache entries and saved artifacts to connect extraction → export. Preserve public API response compatibility. A cache restore is a view, not a new successful extraction; a subsequent export can qualify as activity. Older cached results without references remain visible as uncorrelated exports.
- [ ] On examples and public snapshots, tag engagement independently from a user's own generated-artifact exports. Do not count visitors viewing someone's public snapshot as its owner.
- [ ] Classify browser/API/CLI, hosted/self-hosted, and internal/known-bot/unknown traffic. Use same-origin browser context and server-issued visitor identity as signals, not proof of a human. User-agent and client source claims alone must not establish eligibility.
- [ ] Use a shared browser bootstrap promise and telemetry queue to avoid duplicate initialization; ordinary extraction remains independent. Include initial auto-extraction and slow-auth/bootstrap cases in coverage tests.
- [ ] Record browser events via beacon/fetch with strict size/schema limits, same-origin checks, bounded timestamps, rate limits, and event-ID deduplication. Derive identity and environment on the server. Disable collection on local/test/self-hosted environments by default.
- [ ] Capture only external referrer hostname and bounded campaign values; exclude auth, payment, source-URL, and arbitrary query parameters. Preserve first touch; attach a separate current-visit source if useful. Mark missing attribution honestly rather than treating it as confirmed direct traffic.
- [ ] Give analytics database writes a short timeout and isolated error handling. Extraction, stream delivery, downloads, sign-in, and fulfillment must still work during analytics failure. Reconcile purchase and committed-AI projections from durable billing records; expose non-recoverable event gaps rather than hiding them.

Existing file touchpoints include `app/root.tsx`, `app/routes/_index.tsx`, `app/routes/d.$id.tsx`, `app/components/ArtifactActions.tsx`, `app/components/PurchaseCreditsButton.tsx`, `app/components/MagicLinkSignInForm.tsx`, `app/components/AccountMenu.tsx`, `app/lib/design-artifact-events.ts`, `app/lib/extraction-cache.ts`, `server/lib/auth.ts`, `server/lib/quota.ts`, and the existing extraction/AI/artifact/billing routes. New endpoints use React Router resource routes; instrument existing H3 streams in place.

## 5. Build reports and the private dashboard

- [ ] Add an admin authorization helper requiring a verified Better Auth account in a server-side user-ID allowlist. Missing allowlist means deny access. Do not reuse the metrics endpoint's optional-token behavior, which permits access when its token is unset.
- [ ] Add `/admin/analytics` and `/api/admin/analytics`, both protected server-side and served with `Cache-Control: private, no-store`. Return aggregates, not visitor activity feeds or email addresses.
- [ ] Show active-creator trends, new/returning split, cohort retention, activation/purchase funnels, acquisition sources, and purchasers/sales by currency.
- [ ] Include date selection, calendar-versus-rolling labels, collection start dates, incomplete-cohort indicators, source/identity filters, and aggregate CSV export.
- [ ] Compare completed calendar months; for current month show month-to-date versus the equivalent elapsed portion of the prior month. Zero prior denominator produces “not comparable,” not infinity.
- [ ] Compute funnels from ordered events for the same resolved identity, with matching artifact references for extraction → export. Do not divide unrelated event totals. Show cohort denominators and mark open conversion windows provisional.
- [ ] Exclude preexisting accounts from claims of newly registered users; record first observed verification separately where the original verification date is unavailable. Historical billing-only users are not “new this month” simply because analytics just started.
- [ ] Show attribution coverage and collection gaps beside MAU. Cookie-blocked/unattributed activity remains visible outside unique counts. Empty, unavailable, partially collected, and not-yet-mature reports must have different states.
- [ ] Keep existing Prometheus counters intact. If growth gauges are exported, use fixed window/source labels only, never user IDs. Database-wide values must be deduplicated across replicas. [Prometheus instrumentation guidance](https://prometheus.io/docs/practices/instrumentation/)

## 6. Retention, verification, and rollout

- [ ] Proposed defaults: retain identifiable analytics events/relationships for 13 months, retain only identity-free historical report snapshots longer, and remove expired visitors and orphaned aliases. Longer-lived first-observed metadata needs an explicit retention rule; after history expires, label returning/new classifications accordingly. Old snapshots are finalized and cannot be re-deduplicated after their underlying identities are removed.
- [ ] Add a batched, restartable maintenance command for cleanup and billing projection reconciliation; run it daily through the deployment scheduler. Do not schedule a Codex chat automation as part of implementation.
- [ ] Honor analytics opt-out and the site's applicable consent state across both client and server collection. Clear the analytics cookie when opted out. Keep operational counters separate and document collection/retention in the site's privacy information. Analytics opt-out must not interfere with functional auth cookies.
- [ ] Add fixtures with exact expected results for distinct counts, month/year boundaries, partial periods, cohort eligibility, ordered funnels, acquisition attribution, and identity merging.
- [ ] Add Postgres integration tests for migration grants, private-table access, admin authorization, concurrent event deduplication, account linking/sign-out, deleted anonymous accounts, and repeat webhook/operation projection.
- [ ] Verify one browser making 100 extractions counts once; an anonymous user later verifying/purchasing counts once; the same verified account on two devices counts once; different accounts sharing a browser never merge; unknown identities do not inflate MAU.
- [ ] Exercise cookie blocking, expired auth with persistent visitor cookie, cross-browser magic links, cache restores, first-page auto-extraction, API requests, bots, invalid client events, analytics DB timeout, retries, and interrupted AI streams.
- [ ] Reconcile purchase counts/amounts with fulfilled purchases and paid AI completions with committed operations. Compare browser/API extraction totals with existing operational counters over matching windows, allowing only documented exclusions and measured gaps.
- [ ] Run current-main checks: `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm db:test`, and `pnpm build`, using the project's isolated test database. Visually verify desktop/mobile dashboard states and the complete anonymous → extraction → export → verification → purchase journey in a preview environment.
- [ ] Benchmark the 13-month report queries with representative event volume and inspect query plans before choosing rollups. Set a provisional dashboard target of under two seconds for normal report loads and confirm analytics failures are bounded on product requests.
- [ ] Release schema first, then application code behind `GROWTH_ANALYTICS_ENABLED`, then enable collection. Keep dashboard visibility separately controlled. Record rollout timestamp and metric definition version.
- [ ] Backfill only substantiated billing history with explicit historical-source markers and original timestamps. Do not synthesize historical free usage, page views, identity links, or verification dates. Historical paid usage belongs in a separately labeled series if its browser source cannot be established.
- [ ] Validate seven days of collection before treating new charts as dependable; monthly retention remains pending until a full follow-up month exists. Confirm live deployment commit, database readiness, existing metrics, and a public snapshot. Roll back by disabling collection/dashboard or reverting the app while retaining additive tables; do not erase history or change billing behavior.

## Delivery sequence and completion criteria

| Increment | Deliverable                                                          | Completion evidence                                                                                                     |
| --------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1         | Definitions, private schema, anonymous identity, and account linking | Migration/access tests; stable anonymous identity beyond auth expiry; correct merge/sign-out cases.                     |
| 2         | Server/browser events and durable billing projections                | Complete journey in preview; retries do not duplicate; analytics failure cannot break extraction or billing.            |
| 3         | Queries, private dashboard, and CSV export                           | Known-answer fixture results for every metric; admin isolation; visual verification; query performance evidence.        |
| 4         | Cleanup/reconciliation, documentation, and production rollout        | Collection coverage is visible, billing reconciles, deployment verified, rollout date and historical limitations shown. |

The plan is complete when every proposed metric has a defined population and verifiable source, anonymous usage is measurable without sign-in, identity transitions do not inflate counts, and the dashboard makes estimation and missing coverage explicit.
