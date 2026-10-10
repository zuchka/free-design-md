import postgres from "postgres";
import { DbExecutor, getDatabaseUrl } from "../db/client.js";

let client: postgres.Sql | undefined;
let inFlight = 0;
export const analyticsHealth = { accepted: 0, dropped: 0, failed: 0 };
export function analyticsEnabled(): boolean {
  return (
    process.env.GROWTH_ANALYTICS_ENABLED === "1" &&
    process.env.FREE_DESIGN_MD_SELF_HOSTED !== "1"
  );
}
function database() {
  if (!client) {
    const url = getDatabaseUrl();
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(url).hostname,
    );
    client = postgres(url, {
      max: 2,
      prepare: false,
      connect_timeout: 1,
      idle_timeout: 10,
      ssl: local ? false : "require",
      connection: {
        application_name: "free-design-analytics",
        statement_timeout: 500,
        lock_timeout: 200,
      },
    });
  }
  return new DbExecutor(client);
}
/** A separate bounded pool prevents telemetry from consuming billing connections. */
export async function analyticsWrite<T>(
  fn: (db: DbExecutor) => Promise<T>,
): Promise<T | null> {
  if (!analyticsEnabled()) return null;
  if (inFlight >= 4) {
    analyticsHealth.dropped++;
    return null;
  }
  inFlight++;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = Promise.resolve()
    .then(() => fn(database()))
    .catch(() => {
      analyticsHealth.failed++;
      return null;
    })
    .finally(() => {
      inFlight--;
    });
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          analyticsHealth.dropped++;
          resolve(null);
        }, 750);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function closeAnalyticsDb() {
  const active = client;
  client = undefined;
  await active?.end({ timeout: 1 });
}
