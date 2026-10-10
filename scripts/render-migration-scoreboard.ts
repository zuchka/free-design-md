import { readFile } from "node:fs/promises";
import { parseArgs, requiredArg } from "./database-migration.js";
import type { VerificationReport } from "./migration-verification.js";

export interface ScoreboardCheck {
  label: string;
  passed: boolean;
  detail: string;
}

interface VerificationArtifact extends VerificationReport {
  target?: string;
}

export function buildMigrationScoreboard(
  report: VerificationArtifact,
): ScoreboardCheck[] {
  const schemaPassed =
    report.schema.missingTables.length === 0 &&
    report.schema.missingIndexes.length === 0;
  const rowParityPassed = report.tables.every(
    (table) => table.sourceCount === table.targetCount && table.digestMatches,
  );
  const ownersPassed = report.tables.every(
    (table) => table.ownerDistributionMatches !== false,
  );
  const authPassed =
    report.integrity.orphanedSessions === 0 &&
    report.integrity.orphanedAccounts === 0;
  const billingPassed =
    report.integrity.negativeWallets === 0 &&
    report.integrity.walletLedgerMismatches === 0 &&
    report.integrity.duplicateLedgerReferences === 0 &&
    report.integrity.duplicateCheckoutSessions === 0;

  return [
    {
      label: "Tables and indexes",
      passed: schemaPassed,
      detail: `${report.tables.length} tables verified`,
    },
    {
      label: "Rows and content digests",
      passed: rowParityPassed,
      detail: `${report.tables.reduce((sum, table) => sum + table.targetCount, 0)} rows compared`,
    },
    {
      label: "Owner isolation data",
      passed: ownersPassed,
      detail: "owner distributions preserved",
    },
    {
      label: "Authentication relationships",
      passed: authPassed,
      detail: "session and account references valid",
    },
    {
      label: "Billing invariants",
      passed: billingPassed,
      detail: "wallet and idempotency checks passed",
    },
    {
      label: "Public artifact identifiers",
      passed: report.integrity.savedPublicIdDigestMatches,
      detail: "public IDs preserved",
    },
  ];
}

export function renderMigrationScoreboard(
  report: VerificationArtifact,
): string {
  const checks = buildMigrationScoreboard(report);
  const width = Math.max(...checks.map((check) => check.label.length));
  const lines = checks.map(
    (check) =>
      `${check.passed ? "PASS" : "FAIL"}  ${check.label.padEnd(width)}  ${check.detail}`,
  );
  lines.push("");
  lines.push(
    `${report.passed && checks.every((check) => check.passed) ? "PASS" : "FAIL"}  Migration verification`,
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.has("help")) {
    console.log(
      "Usage: pnpm demo:scoreboard -- --report <verification-report.json>",
    );
    return;
  }

  const reportPath = requiredArg(args, "report");
  const report = JSON.parse(
    await readFile(reportPath, "utf8"),
  ) as VerificationArtifact;
  console.log(renderMigrationScoreboard(report));
  if (!report.passed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
