# Growth analytics

Growth analytics uses private Postgres event tables. `/admin/analytics` and `/api/admin/analytics` expose aggregates only to explicitly allowed, verified Better Auth accounts. The account menu shows a link after the server confirms access. CSV uses the same authorization and queries. Empty allowlists deny everyone.

The existing `/metrics` endpoint remains compatible: persisted operational counters still come from Postgres; latency histograms remain in process memory. New timestamped events store extraction/AI durations so historical percentiles can also be queried in Postgres. No Prometheus user-ID labels or changes to billing entitlements are introduced.

## Configuration

Apply `supabase/migrations/20261010043325_growth_analytics.sql` before enabling collection. Startup never applies schema changes.

```text
GROWTH_ANALYTICS_ENABLED=1
GROWTH_ANALYTICS_ADMIN_EMAILS=analytics-admin@example.com
```

Optional server-only settings:

| Setting                              | Behavior                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GROWTH_ANALYTICS_ADMIN_USER_IDS`    | Comma-separated Better Auth IDs; verification is still required.                                                                                                                            |
| `GROWTH_ANALYTICS_INTERNAL_USER_IDS` | Comma-separated test account IDs excluded from creator reports and sales after identity resolution. Set before using test accounts. Existing identity flags refresh on subsequent activity. |
| `GROWTH_ANALYTICS_COOKIE_SECRET`     | Dedicated signing key; defaults to `BETTER_AUTH_SECRET`. Rotating it invalidates visitor cookies.                                                                                           |
| `GROWTH_ANALYTICS_REQUIRE_CONSENT=1` | Requires an explicit choice of “Allow product analytics” on `/privacy`. Otherwise the collector respects opt-out, GPC and DNT.                                                              |

Collection is off unless explicitly enabled, and always off with `FREE_DESIGN_MD_SELF_HOSTED=1`. Do not enable production analytics in ordinary local/test environments. Dashboard authorization is independent of the collection flag so an admin can still inspect retained history while collection is disabled.

## Populations and definitions (version 1)

All event timestamps use `timestamptz`. Reports explicitly run in UTC, with half-open `[start, end)` intervals, and expose their `asOf` time. The default date range is the last completed calendar month. Event history is limited to the preceding 13 months; fulfilled sales use the original billing ledger. A bounded, private, process-local aggregate cache lasts at most 30 seconds; responses themselves are `private, no-store`.

| Metric                       | Definition and denominator                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active creator               | A resolved identity with browser/product `extraction_succeeded`, `ai_succeeded`, or explicit copy/download of an artifact that the server can associate with that identity. AI success requires stream success and a committed hosted credit.                                                                                                                               |
| Calendar MAU                 | Distinct active identities in a calendar month. Never a sum of daily distinct counts. Current month is provisional; full-month cards include the whole calendar month even if a narrower date filter was selected.                                                                                                                                                          |
| Rolling activity             | Distinct creators in the trailing 24 hours, 7 days or 30 days at `asOf`, independent of the selected historical range.                                                                                                                                                                                                                                                      |
| Newly observed / returning   | First qualifying activity is inside / before the selected range. Dates are observed usage, not account registration or proof of a new human.                                                                                                                                                                                                                                |
| Growth comparison            | Complete month vs. previous complete month; month-to-date vs. the same elapsed portion of the previous month, capped at its end; arbitrary ranges vs. the preceding equal span. Missing prior coverage or a zero prior denominator produces “unavailable.”                                                                                                                  |
| Weekly / monthly retention   | Identities first active in a Monday-based UTC week / calendar month, returning in the following calendar week / month. Incomplete follow-up windows show “Pending.”                                                                                                                                                                                                         |
| Visit-to-export funnel       | First observed browser visit → extraction → export of the same artifact, ordered and within seven days of the visit. Any qualifying extraction can lead to the matching export. Mature conversion divides mature exported visitors by mature visitors; open windows are shown separately.                                                                                   |
| Extraction-to-export         | Distinct successful extractors in the selected range with an export of the same artifact within seven days / all successful extractors in that range. Provisional while windows remain open.                                                                                                                                                                                |
| Purchase funnel              | First qualifying creator activity → first observed verified sign-in after that activity → first fulfilled purchase within 30 days of activation. Existing verified users may not have an observed verification step. The UI does not call them newly registered.                                                                                                            |
| Checkout funnel              | Checkouts created in the selected range and fulfilled within seven days / all checkouts created in that range. Open windows and purchases without observed prior activation are shown separately.                                                                                                                                                                           |
| Acquisition                  | Earliest retained visitor’s campaign source or external referring hostname for a resolved identity; missing data is “unknown.” Activation is within seven days, retention is activity 7–14 days after first visit among visitors whose follow-up window is complete, purchase is within 30 days. Conversion counts are provisional while windows remain open.               |
| Purchases and gross receipts | Fulfilled packs, unique purchasers, first-ever purchasers and repeat purchasers, by actual fulfillment date and currency. A first-time buyer can also repurchase in the same period. Sum stored Checkout amounts in minor units, including applicable tax/discounts; show missing amounts. These are not net revenue or MRR; cash refunds/disputes are not reconciled here. |
| Coverage                     | Stored events by source/audience and events with identities. Also show collection start, retained-history boundary, last maintenance and per-process write failures/timeouts since restart. Process health is not durable fleet-wide gap history.                                                                                                                           |
| Performance                  | Median and p95 stored duration for each operation outcome, including failures. Historical billing projections have no fabricated timings.                                                                                                                                                                                                                                   |

Creator reports always require browser product activity. Examples, other people’s public snapshots, known bots, internal accounts, direct actions/CLI and API activity remain visible in coverage but do not qualify. Failed attempts, page views, purchases alone and automatic cache restoration do not qualify. Browser source is an estimate based on request context, not proof of a human.

Identity filters use the current resolved identity. The event-source filter applies to event reports, not the billing ledger. Sales are necessarily verified-account purchases; selecting anonymous identities excludes them. Original event-time auth state is retained for audit. Verified linking can revise recent historical distinct counts. Funnel queries join actions for the same resolved identity, not unrelated event totals.

## Anonymous identity and privacy

The server issues a signed, opaque `fdmd_visitor` cookie (HttpOnly, SameSite=Lax, Secure over HTTPS, 180-day rolling expiry). Postgres stores its digest. It is independent of the shorter anonymous auth session and never grants access to designs or billing. A returned cookie or verified server session is required for unique counts; cookieless requests do not mint a countable visitor per request.

The dynamic workspace document establishes identity before first auto-extraction when possible. Cacheable public HTML never sets a shared visitor cookie; its browser bootstraps separately. One shared bootstrap promise serializes initial collection and account changes. Extraction does not require successful bootstrap. Early/missing-cookie requests remain unattributed.

A server-observed verified sign-in links the current unlinked browser identity to the verified account. Two verified devices resolve to one account; conflicting accounts never merge. Sign-out clears the visitor cookie; a formerly linked cookie without its verified session rotates on the next bootstrap. Cross-browser verification without a proven original-browser link remains separate. Clearing cookies, shared browsers and unlinked devices limit person-level accuracy.

Account linking records a minimal retry intent before anonymous account transfer/deletion. Maintenance recovers the link using the visitor’s anonymous user ID even after the auth row is gone. Analytics writes fail open: if both direct linking and recording the intent fail, history stays unlinked. Aggregate failure counters signal a gap; the system does not invent a link.

`/privacy` controls a browser preference separate from auth cookies. Both client and server respect opt-out, GPC/DNT and configured consent. Product events stop and bootstrap clears the visitor cookie; essential billing records, legacy aggregate counters and separate 30-day extraction diagnostics continue. Ledger reconciliation creates only unattributed historical events, without manufacturing visitor identities. Previously collected activity is retained until cleanup; opt-out is not a deletion request.

Product analytics excludes submitted URLs, arbitrary query strings, prompts, extracted content, emails, auth/payment tokens and stored IP addresses. Referrer capture keeps an external hostname only; campaign source/medium/name have character/length limits. The trusted edge IP is used only in a bounded, in-memory ingestion rate limiter.

## Storage, failures and maintenance

Five private `app` tables hold identities, visitors, events, collection state and link retry intents. Public Supabase `anon`/`authenticated` roles have no access. Runtime `free_design_app` has explicit DML grants. Better Auth remains the only identity system.

Server request/credit-operation keys and browser UUIDs deduplicate growth events. The existing operational artifact counter still increments per accepted request, as before, so replaying an event can increment that legacy counter without duplicating growth events. Browser requests cannot assert server outcomes, payments or owner IDs. Same-origin checks, strict schema/4 KiB bodies and bounded per-edge-IP rate limiting protect ingestion.

Analytics uses its own two-connection pool, a four-operation concurrency cap, a 500 ms statement timeout, a 200 ms lock timeout and a 750 ms caller deadline per operation. Session lookup has a 250 ms deadline. Failures do not throw into extraction, sign-in or fulfillment. Missing free events cannot be reconstructed. Committed AI and fulfilled purchases can be recovered from their durable ledger records, marked historical/unattributed and excluded from creator MAU. The financial ledger remains authoritative; projections never grant/refund credits.

Run daily through the deployment scheduler:

```bash
pnpm analytics:maintain
```

Each batch recovers at most 500 links, projects at most 500 purchases and 500 committed AI operations, and removes up to 5,000 expired records per table. The command repeats bounded batches, stops after its time/batch budget, and exits nonzero if a backlog remains. Retry failures/backlogs and investigate a stale “Last maintenance” date. On a large first backfill, rerun until drained. The command is safe to retry; it skips already projected operation/session IDs and excludes AI commits newer than five minutes to allow normal stream instrumentation to finish.

Delete events older than 13 months and expired visitor cookies. Remove old identity leaves with no retained events, visitors or child aliases, then their now-orphaned canonical identity. First-seen, first-visit and first-active metadata can live longer while an identity remains referenced; this preserves returning/cohort definitions for continuing users. Attribution is available only while its visitor row is retained. No identity-free lifetime report snapshots are created in v1: pre-retention event detail and free-usage counts are unavailable. Billing history stays under its existing retention policy.

For Railway, run a companion scheduled service from the same release with start command `pnpm analytics:maintain`, daily schedule `15 5 * * *` (UTC), no public domain and no health check. Reference the web service’s `DATABASE_URL`, set `GROWTH_ANALYTICS_ENABLED=1`, and pass its internal-user list if configured. No Stripe, Resend, Anthropic or auth secrets are required by the job. Use the runtime database role. Configure failed-job notifications in the deployment provider; this is not a Codex chat automation.

## Validation and release

Local verification includes distinct counts (100 extractions count once), aliases and two devices, conflicting accounts, real Better Auth anonymous→magic-link verification, sign-out, private admin denial, ordered matching-artifact funnels, cohort maturity, UTC month boundaries, repeated billing projections, opt-out, malicious client events, database timeouts, actual runtime-role privileges and existing billing/stream tests.

The preview browser check exercises first-page auto-extraction, export, cached reload, verified admin access, CSV, opt-out and desktop/mobile layouts. Real headless browser user agents are classified as bot traffic; the human-flow preview uses an ordinary browser user agent. Payment ledger fixtures and existing Stripe tests cover fulfillment without sending real email or charging a card.

A local 13-month query benchmark with 100,000 events and 5,000 identities completed in approximately 1.45 seconds, before the private aggregate cache. `EXPLAIN ANALYZE` was inspected. Reports use aggregate joins for funnels/cohorts to avoid one full event scan per identity. This is a local baseline, not a hosted latency guarantee; report statements have a five-second timeout and the UI distinguishes unavailable data from zero.

Release order:

1. Apply the additive migration and run database privilege/schema tests.
2. Deploy this application revision with collection disabled and the admin allowlist configured.
3. Verify a public snapshot, `/metrics`, anonymous extraction, sign-in and existing billing health.
4. Enable collection; run maintenance to backfill substantiated billing history, then enable the daily job. The first visitor/live event records the collection-start timestamp.
5. Reconcile fulfilled purchases/amounts and committed AI outcomes against their original records. Check browser/API extraction totals against operational counters, accounting for bots, opt-out, time-window differences and recorded write gaps.
6. Observe seven days of live collection before treating growth charts as dependable. Monthly retention must wait for a complete follow-up month; historical free activity cannot be backfilled.

Rollback by disabling `GROWTH_ANALYTICS_ENABLED` on the web service and scheduler, or reverting the app. Retain the additive tables. Clear the admin allowlist to hide the dashboard independently. Neither rollback changes billing balances or deletes public snapshots.
