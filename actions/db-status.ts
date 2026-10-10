import {
  closeDbClient,
  getDatabaseUrl,
  getDbExec,
} from "../server/db/client.js";

export default async function main() {
  const url = getDatabaseUrl();
  const hostname = new URL(url).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  console.log(`\nDatabase Status`);
  console.log(`  URL: ${isLocal ? url : url.replace(/\/\/.*@/, "//***@")}`);
  console.log(`  Mode: ${isLocal ? "local Postgres" : "remote Postgres"}`);

  try {
    const result = await getDbExec().execute("SELECT 1 AS ok");
    if (result.rows.length > 0) {
      console.log(`  Status: connected`);
    } else {
      console.log(`  Status: unexpected response`);
    }
  } catch (err) {
    console.error(
      `  Status: error — ${err instanceof Error ? err.message : "Unknown"}`,
    );
    throw new Error("Script failed");
  } finally {
    await closeDbClient();
  }
}
