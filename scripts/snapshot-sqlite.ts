import "dotenv/config";
import { createHash } from "node:crypto";
import { chmod, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  assertSourceTables,
  openSourceDatabase,
  parseArgs,
  readSourceRows,
  requiredArg,
  TABLE_SPECS,
  writeJsonReport,
} from "./database-migration.js";

async function sha256File(path: string): Promise<string> {
  const { createReadStream } = await import("node:fs");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    console.log(
      "Usage: pnpm db:snapshot -- --source <app.db> --output <snapshot.db> [--report <report.json>]",
    );
    return;
  }

  const sourcePath = resolve(requiredArg(args, "source"));
  const outputPath = resolve(requiredArg(args, "output"));
  if (sourcePath === outputPath)
    throw new Error("Snapshot output must differ from source");
  try {
    await stat(outputPath);
    throw new Error(`Refusing to overwrite existing snapshot: ${outputPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const source = openSourceDatabase(sourcePath);
  try {
    assertSourceTables(source);
    await source.backup(outputPath);
  } finally {
    source.close();
  }
  await chmod(outputPath, 0o600);

  const snapshot = openSourceDatabase(outputPath);
  const tableCounts: Record<string, number> = {};
  try {
    assertSourceTables(snapshot);
    for (const spec of TABLE_SPECS) {
      tableCounts[spec.name] = readSourceRows(snapshot, spec).length;
    }
  } finally {
    snapshot.close();
  }

  const metadata = await stat(outputPath);
  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    integrityCheck: "ok",
    byteSize: metadata.size,
    sha256: await sha256File(outputPath),
    tableCounts,
  };
  await writeJsonReport(args.values.get("report"), report);
  console.log(JSON.stringify(report, null, 2));
  console.log(`Snapshot written to ${outputPath}`);
}

await main();
