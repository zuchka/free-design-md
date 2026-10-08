import { AI_RUN_PACKS } from "../../shared/billing.js";
import { getDbExec } from "../db/index.js";

const routes = ["enrich", "iterate", "saved_iterate", "other"] as const;
const events = ["reserved", "committed", "refunded", "rejected"] as const;

function family(
  name: string,
  help: string,
  type: "counter" | "gauge",
  samples: string[],
) {
  return [
    `# HELP ${name} ${help}`,
    `# TYPE ${name} ${type}`,
    ...samples.map((sample) => `${name}${sample}`),
  ].join("\n");
}

/** Read the billing source of truth; never count a webhook delivery as a sale. */
export async function renderBillingMetrics(): Promise<string> {
  const healthName = "fdmd_billing_metrics_available";
  try {
    // A single statement uses one Postgres snapshot, even under READ COMMITTED.
    const result = await getDbExec().execute<{
      purchases: { pack_id: string; purchases: number; credits: number }[];
      operations: { kind: string; status: string; count: number }[];
      balance: string | number;
    }>(`SELECT
      (SELECT COALESCE(json_agg(p), '[]'::json) FROM (
        SELECT pack_id, COUNT(*) AS purchases, SUM(credits) AS credits
        FROM app.purchases WHERE status = 'fulfilled' GROUP BY pack_id
      ) p) AS purchases,
      (SELECT COALESCE(json_agg(o), '[]'::json) FROM (
        SELECT kind, status, COUNT(*) AS count
        FROM app.credit_operations GROUP BY kind, status
      ) o) AS operations,
      (SELECT COALESCE(SUM(balance), 0) FROM app.credit_wallets) AS balance`);
    const snapshot = result.rows[0];
    if (!snapshot) throw new Error("Missing billing metrics snapshot");

    // Only catalog IDs and a fixed fallback become labels, never arbitrary DB values.
    const packs = new Map<string, { purchases: number; credits: number }>(
      [...AI_RUN_PACKS.map((pack) => pack.id), "other"].map((id) => [
        id,
        { purchases: 0, credits: 0 },
      ]),
    );
    for (const row of snapshot.purchases) {
      const value = packs.get(String(row.pack_id)) ?? packs.get("other")!;
      value.purchases += Number(row.purchases);
      value.credits += Number(row.credits);
    }

    const counts = new Map(
      routes.map((route) => [
        route,
        { reserved: 0, committed: 0, refunded: 0, rejected: 0, pending: 0 },
      ]),
    );
    for (const row of snapshot.operations) {
      const route =
        row.kind === "saved-iterate"
          ? "saved_iterate"
          : row.kind === "enrich" || row.kind === "iterate"
            ? row.kind
            : "other";
      const value = counts.get(route)!;
      const count = Number(row.count);
      // Reserved is cumulative: completed/refunded operations were reserved too.
      if (["reserved", "committed", "refunded"].includes(String(row.status)))
        value.reserved += count;
      if (row.status === "reserved") value.pending += count;
      if (row.status === "committed") value.committed += count;
      if (row.status === "refunded") value.refunded += count;
      if (row.status === "rejected") value.rejected += count;
    }

    return [
      family(
        healthName,
        "Whether billing records were collected successfully.",
        "gauge",
        [" 1"],
      ),
      family(
        "fdmd_credit_purchases_total",
        "Fulfilled credit purchases from billing records, deduplicated by Checkout Session.",
        "counter",
        [...packs].map(
          ([pack, value]) => `{pack="${pack}"} ${value.purchases}`,
        ),
      ),
      family(
        "fdmd_credits_purchased_total",
        "Credits granted by fulfilled purchases from billing records.",
        "counter",
        [...packs].map(([pack, value]) => `{pack="${pack}"} ${value.credits}`),
      ),
      family(
        "fdmd_credit_operations_total",
        "Cumulative credit lifecycle transitions from billing records. Reserved includes committed and refunded operations.",
        "counter",
        [...counts].flatMap(([route, value]) =>
          events.map(
            (event) => `{route="${route}",event="${event}"} ${value[event]}`,
          ),
        ),
      ),
      family(
        "fdmd_credit_reservations_pending",
        "Credits reserved but not yet committed or refunded.",
        "gauge",
        [...counts].map(
          ([route, value]) => `{route="${route}"} ${value.pending}`,
        ),
      ),
      family(
        "fdmd_credit_wallet_balance",
        "Total unspent credits across hosted wallets.",
        "gauge",
        [` ${Number(snapshot.balance)}`],
      ),
    ].join("\n\n");
  } catch {
    // Do not turn a DB outage into plausible zero sales or wallet balances.
    return family(
      healthName,
      "Whether billing records were collected successfully.",
      "gauge",
      [" 0"],
    );
  }
}
