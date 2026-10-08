# Extraction diagnostics

Initial extraction stays public and free. Diagnostics add no account requirement or external telemetry service.

## Where to look

- `/api/extraction-health` returns a JSON summary of HTTP extractions: total, succeeded, failed, recovered after one retry, failure rate, and causes ranked by frequency with suggested next steps. `failureRate: null` means no observations yet. `storage: process_memory` indicates the database could not be read; those counts cover only the current process.
- `/api/metrics` retains existing Prometheus metrics and adds durable `fdmd_extraction_results_total` and `fdmd_extraction_recovery_events_total`. New categories begin at deployment; historical generic errors cannot be reconstructed.
- Server logs contain one `extraction.completed` JSON event per operation, with its reference ID, hostname, cause, failing stage, upstream HTTP status, stage timings, retries, warnings, and classified stage issues (including recovered screenshot failures). Search Railway runtime logs for the reference shown to the user. An action called inside an HTTP request shares its trace, so it is counted once.
- Errors from `/api/extract?format=json` contain `error.code`, `message`, `hint`, `retryable`, `stage`, and `requestId`. Every response has `X-Request-Id`. Successful JSON responses add `diagnostics.requestId` and `diagnostics.warnings`; successful Markdown/MDX bodies retain their existing format.

The health endpoint uses the same optional `PROMETHEUS_METRICS_TOKEN` protection as metrics (`Authorization: Bearer …` or `x-prometheus-token`). Both endpoints contain aggregates only. Hostnames appear only in server logs. New diagnostic logs omit full URLs, paths, query strings, credentials, raw error text, page content and account identifiers. Existing platform/access logs have their own retention and redaction settings. Diagnostic output uses stderr so direct action stdout remains JSON.

## Find what to fix first

| Cause                                            | What to investigate or change                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timeout` at navigation                          | Slow document responses or scripts that prevent DOM readiness. One automatic retry is attempted; compare recovered requests with failures before increasing limits.                                  |
| `connection`                                     | Network resets, refused connections or HTTP/2 transport errors. One automatic retry is attempted. Compare affected hostnames in logs to distinguish one site's problem from service-wide networking. |
| `dns`                                            | Misspelled/nonexistent domains or resolver problems. If many unrelated valid domains fail, inspect the deployment's DNS/networking.                                                                  |
| `tls`                                            | Expired/untrusted certificates or protocol errors at the target. Certificate verification remains enabled.                                                                                           |
| `access_denied`, `bot_challenge`                 | Target refuses automated/public access. Use a genuinely public page; no challenge or login bypass is attempted.                                                                                      |
| `not_found`, `unsupported_content`, `empty_page` | Bad page address, a file/API instead of HTML, or a page without a document body. Ask for a working public HTML page.                                                                                 |
| `rate_limited`                                   | Target returned 429. No automatic retry; wait before resubmitting. The API provides Retry-After guidance.                                                                                            |
| `upstream_error`                                 | Target returned 5xx. Retry 502/503/504 once. Other server errors are reported directly.                                                                                                              |
| `browser_unavailable`, `browser_crash`           | Missing Playwright browser/dependencies, memory pressure or a crashed process. Check the image's Chromium installation and Railway memory/restart graphs.                                            |
| `invalid_url`, `private_url`, `invalid_request`  | Input validation; separate these from operational reliability failures.                                                                                                                              |
| `internal`                                       | Unexpected failure. Use the reference ID and failing stage to reproduce on the logged host in a development environment. Raw exceptions are deliberately excluded from production diagnostics.       |

`page_still_loading` means the bounded five-second network-idle wait elapsed; extraction continues. `screenshot_viewport` means a six-second screenshot attempt failed and a three-second viewport fallback succeeded. `screenshot_unavailable` preserves the free spec after both captures fail; the UI explains that AI enrichment needs a new successful screenshot. `cleanup_failed` does not invalidate a completed spec.

Navigation waits for `domcontentloaded`, so a slow image or analytics request cannot independently fail the initial 15-second page load. It still waits up to five seconds for hydration/network activity to settle. Maximum navigation attempts are two, with a 500ms delay. There is no unlimited retry loop, TLS bypass or increased access to private addresses.

## Prometheus queries

Failure counts by cause over the last hour:

```promql
sum by (reason, stage) (
  increase(fdmd_extraction_results_total{caller="http",status="error"}[1h])
)
```

Failure fraction over the last hour (including input errors and target refusals):

```promql
sum(increase(fdmd_extraction_results_total{caller="http",status="error"}[1h]))
/
sum(increase(fdmd_extraction_results_total{caller="http"}[1h]))
```

Requests saved by an automatic retry:

```promql
sum(increase(fdmd_extraction_results_total{caller="http",status="success",retried="true"}[1h]))
```

Stage p95 duration:

```promql
histogram_quantile(0.95, sum by (stage, le) (
  rate(fdmd_extraction_stage_duration_seconds_bucket[1h])
))
```

Outcome/recovery counters persist in the existing metric-counter table. Histograms (including the preexisting overall duration histogram) describe only the current process; Prometheus range queries handle resets. Avoid comparing lifetime action totals with a single process's duration counts. No new database table or migration is needed.

## Rollout and validation

Run the extraction/browser/metrics tests, typecheck and production build. Exercise a valid page, an invalid/private address, a missing domain and a target error. Confirm each attempt appears once in results, that response/header/log reference IDs match, and that the next scrape includes its category. Watch hourly failure causes, recovered retries, screenshot warnings and latency to evaluate improvement; some target refusals are outside this service's control.

Production was inspected on October 8, 2026: it uses image `sha-b32af43`, from the Postgres fulfillment branch, while the local main checkout uses SQLite. These changes reuse the metrics abstraction without modifying its database SQL. Apply the feature on top of the currently deployed branch (or merge that branch into main) before releasing; do not replace the live database stack with this checkout's older one.
