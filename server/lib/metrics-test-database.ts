import { getDbExec } from "../db/client.js";

/** These fixtures clear billing tables and must only use an isolated local test DB. */
export async function resetMetricsDatabase(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  ) {
    throw new Error(
      "Metrics integration tests require a local database whose name ends in _test",
    );
  }
  await getDbExec().execute(`TRUNCATE app.stripe_events, app.purchases,
    app.credit_ledger, app.credit_operations, app.credit_wallets,
    app.fdmd_metric_counters, app.fdmd_iterations`);
}
