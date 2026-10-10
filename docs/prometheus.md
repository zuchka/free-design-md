# Prometheus metrics

Scrape `GET /api/metrics`. When `PROMETHEUS_METRICS_TOKEN` is configured, send
`Authorization: Bearer <token>` or `x-prometheus-token: <token>`. The endpoint
does not require an account session and returns uncached Prometheus text.

The business model is one-time credit packs, not recurring subscriptions. Free
URL extraction spends no credit. Hosted enrichment and revisions reserve one
credit from a verified account, commit on success, and refund on failure.
Self-hosted and direct CLI AI calls do not spend hosted credits.

| Metric                                                             | Meaning / storage                                                                                                                                                                                                 |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fdmd_ai_requests_total{route,status,key_source,credit_outcome}`   | HTTP AI outcomes persisted since this metrics rollout. Routes: `enrich`, `iterate`, `saved_iterate`. Key sources: `hosted_server`, `self_hosted_env`, `none`.                                                     |
| `fdmd_credit_purchases_total{pack}`                                | Fulfilled purchases, deduplicated by Checkout Session, read from the billing database. Pending checkouts do not count.                                                                                            |
| `fdmd_credits_purchased_total{pack}`                               | Credits granted by fulfilled purchases. Includes existing paid-credit history, not legacy free quotas.                                                                                                            |
| `fdmd_credit_operations_total{route,event}`                        | Cumulative reservations, commits, refunds and rejected reservations, read from billing records. `reserved` includes operations later committed or refunded.                                                       |
| `fdmd_credit_reservations_pending{route}`                          | Gauge of reservations still awaiting commit or refund. Persistent increases can indicate interrupted streams or refund failures.                                                                                  |
| `fdmd_credit_wallet_balance`                                       | Gauge of total unspent hosted credits.                                                                                                                                                                            |
| `fdmd_billing_metrics_available`                                   | 1 when billing collection succeeds; 0 on failure, with billing values omitted rather than reported as zero.                                                                                                       |
| `fdmd_persistent_metrics_available`                                | 1 when persisted event counters can be read; 0 when the endpoint falls back to process memory.                                                                                                                    |
| `fdmd_quota_events_total{route,event}`                             | Existing counter retained for dashboards: `decremented` means reservation, not completed sale or committed usage. Refund failures now use `refund_failed`, never `refunded`. Historical values are not rewritten. |
| `fdmd_action_runs_total{action,status,caller}`                     | Existing persisted action executions; `caller="direct"` includes CLI runs and must not be treated as paid usage.                                                                                                  |
| `fdmd_design_artifact_events_total`                                | Existing persisted artifact events.                                                                                                                                                                               |
| `fdmd_extract_duration_seconds`, `fdmd_ai_stream_duration_seconds` | Existing process-local histograms; reset on process restart.                                                                                                                                                      |

For AI requests, `credit_outcome="consumed"` means commit succeeded;
`refunded` means refund succeeded; `refund_failed` means refund threw and needs
investigation. `blocked` and `exhausted` distinguish access denials from AI
failures; `not_consumed` identifies requests running without wallet billing;
`not_applicable` covers preflight validation or missing deployment keys.
The new request counter starts at rollout. Billing totals include retained
records from before rollout; do not delete billing history without accounting
for the resulting counter resets.

No metric label contains user IDs, email addresses, URLs, prompts, API keys,
Checkout Session IDs, or Stripe event IDs. Pack labels come from the catalog;
unrecognized stored pack IDs and operation kinds are grouped under `other`.
Balances and pending reservations are gauges because they can decrease, following
[Prometheus metric guidance](https://prometheus.io/docs/instrumenting/writing_exporters/).

## Scraping multiple replicas

Counters and billing totals are shared across processes using the same database.
Do **not** sum replica copies: use one scrape target for database-backed metrics,
or deduplicate each label set (for example, `max without(instance, pod)` when
those labels identify replicas). Keep different deployments/databases separate.
Scrape every process for its local duration histograms; a load-balanced URL alone
cannot reliably measure those histograms. Monitor both availability gauges:
memory fallback can reset counters and undercount database-wide traffic.

For a single database scrape target, useful queries include:

```promql
# Completed paid AI runs by route.
sum by (route) (increase(fdmd_credit_operations_total{event="committed"}[1h]))

# Fulfilled packs and granted credits are different quantities.
sum by (pack) (increase(fdmd_credit_purchases_total[24h]))
sum by (pack) (increase(fdmd_credits_purchased_total[24h]))

# Failed refunds (request telemetry); pending reservations are the DB truth.
sum by (route) (increase(fdmd_ai_requests_total{credit_outcome="refund_failed"}[15m]))
fdmd_credit_reservations_pending

# Access denials, separate from provider/stream errors.
sum by (status) (increase(fdmd_ai_requests_total{status=~"sign_in_required|out_of_credits"}[1h]))
```

These are aggregate operational metrics, not a replacement for the payment and
credit ledger. No revenue is inferred from advertised pack prices, and no
subscription/MRR metric is emitted for one-time packs.

## Postgres verification

The collector reads the private `app` schema with one SQL statement so purchase,
operation, and wallet totals use the same snapshot. It requires only the runtime
role's existing `SELECT` grants; no schema migration or production data write is
needed.

Run database tests against a dedicated local database ending in `_test`, with
the repository's Supabase migrations applied. The metrics fixtures clear billing
and metric tables in that database and reject hosted URLs or other database names:

```sh
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/fdmd_metrics_test \
  DATABASE_TESTS=true pnpm test:db
```

Before release, compare the deployed `/api/metrics` counters with
`app.fdmd_metric_counters`, execute the billing snapshot query read-only, and
check the runtime role can read the billing tables. After deploying the new
image, verify both availability gauges are 1 and reconcile purchased credits,
committed operations, outstanding reservations and wallet balances. Pushing a
GitHub branch alone does not change the image pinned in Railway.
