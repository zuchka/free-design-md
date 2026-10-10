import "dotenv/config";
import {
  assertSourceTables,
  connectPostgres,
  openSourceDatabase,
  parseArgs,
  redactDatabaseUrl,
  requiredArg,
  writeJsonReport,
} from "./database-migration.js";
import { verifyMigration } from "./migration-verification.js";

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    console.log(
      "Usage: pnpm db:verify:sqlite -- --source <snapshot.db> [--target <postgres-url>] [--report <report.json>]",
    );
    return;
  }

  const sourcePath = requiredArg(args, "source");
  const targetUrl =
    args.values.get("target") ?? process.env.DATABASE_URL?.trim();
  if (!targetUrl) throw new Error("--target or DATABASE_URL is required");

  const source = openSourceDatabase(sourcePath);
  const target = connectPostgres(targetUrl);
  try {
    assertSourceTables(source);
    const report = await verifyMigration(source, target);
    const output = {
      ...report,
      target: redactDatabaseUrl(targetUrl),
    };
    await writeJsonReport(args.values.get("report"), output);
    console.log(JSON.stringify(output, null, 2));
    if (!report.passed) process.exitCode = 1;
  } finally {
    source.close();
    await target.end({ timeout: 5 });
  }
}

await main();
