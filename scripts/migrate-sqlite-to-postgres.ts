import "dotenv/config";
import {
  assertSourceTables,
  connectPostgres,
  insertStatement,
  openSourceDatabase,
  parseArgs,
  readSourceRows,
  redactDatabaseUrl,
  requiredArg,
  TABLE_SPECS,
  valuesForInsert,
  writeJsonReport,
} from "./database-migration.js";
import { verifyMigration } from "./migration-verification.js";

interface CountRow {
  count: string | number | bigint;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    console.log(
      "Usage: pnpm db:migrate:sqlite -- --source <snapshot.db> [--target <postgres-url>] [--dry-run|--validate-only] [--batch-size 250] [--report <report.json>]",
    );
    return;
  }

  const sourcePath = requiredArg(args, "source");
  const targetUrl =
    args.values.get("target") ?? process.env.DATABASE_URL?.trim();
  if (!targetUrl) throw new Error("--target or DATABASE_URL is required");
  const dryRun = args.flags.has("dry-run");
  const validateOnly = args.flags.has("validate-only");
  if (dryRun && validateOnly) {
    throw new Error("Choose either --dry-run or --validate-only, not both");
  }
  const batchSize = Number(args.values.get("batch-size") ?? 250);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1_000) {
    throw new Error("--batch-size must be an integer between 1 and 1000");
  }

  const source = openSourceDatabase(sourcePath);
  const target = connectPostgres(targetUrl);
  try {
    assertSourceTables(source);
    if (validateOnly) {
      const verification = await verifyMigration(source, target);
      const report = {
        mode: "validate-only",
        target: redactDatabaseUrl(targetUrl),
        ...verification,
      };
      await writeJsonReport(args.values.get("report"), report);
      console.log(JSON.stringify(report, null, 2));
      if (!verification.passed) process.exitCode = 1;
      return;
    }

    const sourceCounts = Object.fromEntries(
      TABLE_SPECS.map((spec) => [
        spec.name,
        readSourceRows(source, spec).length,
      ]),
    );
    const targetCounts: Record<string, number> = {};
    for (const spec of TABLE_SPECS) {
      const rows = await target.unsafe<CountRow[]>(
        `SELECT count(*) AS count FROM app."${spec.name}"`,
      );
      targetCounts[spec.name] = Number(rows[0]?.count ?? 0);
    }
    const nonemptyTables = Object.entries(targetCounts)
      .filter(([, count]) => count > 0)
      .map(([table]) => table);
    if (nonemptyTables.length) {
      throw new Error(
        `Target must be empty before import; rows found in: ${nonemptyTables.join(", ")}`,
      );
    }

    if (dryRun) {
      const report = {
        version: 1,
        mode: "dry-run",
        checkedAt: new Date().toISOString(),
        target: redactDatabaseUrl(targetUrl),
        sourceCounts,
        targetEmpty: true,
        rowsPlanned: Object.values(sourceCounts).reduce(
          (sum, count) => sum + count,
          0,
        ),
      };
      await writeJsonReport(args.values.get("report"), report);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    await target.begin(async (transaction) => {
      for (const spec of TABLE_SPECS) {
        const rows = readSourceRows(source, spec);
        for (let start = 0; start < rows.length; start += batchSize) {
          const batch = rows.slice(start, start + batchSize);
          await transaction.unsafe(
            insertStatement(spec, batch.length),
            valuesForInsert(batch, spec.columns),
          );
        }
      }
    });

    const verification = await verifyMigration(source, target);
    const report = {
      mode: "import",
      target: redactDatabaseUrl(targetUrl),
      importedCounts: sourceCounts,
      ...verification,
    };
    await writeJsonReport(args.values.get("report"), report);
    console.log(JSON.stringify(report, null, 2));
    if (!verification.passed) {
      throw new Error(
        "Import completed, but deterministic verification failed",
      );
    }
  } finally {
    source.close();
    await target.end({ timeout: 5 });
  }
}

await main();
