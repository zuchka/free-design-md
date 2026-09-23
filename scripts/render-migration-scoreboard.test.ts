import { describe, expect, it } from "vitest";
import { buildMigrationScoreboard } from "./render-migration-scoreboard.js";
import type { VerificationReport } from "./migration-verification.js";

function passingReport(): VerificationReport {
  return {
    version: 1,
    verifiedAt: "2026-09-23T00:00:00.000Z",
    passed: true,
    schema: { missingTables: [], missingIndexes: [] },
    tables: [
      {
        table: "auth_users",
        sourceCount: 2,
        targetCount: 2,
        sourceDigest: "same",
        targetDigest: "same",
        digestMatches: true,
        ownerDistributionMatches: null,
        ownerCount: null,
      },
    ],
    integrity: {
      orphanedSessions: 0,
      orphanedAccounts: 0,
      unresolvedSavedParents: 0,
      unresolvedSavedRoots: 0,
      negativeWallets: 0,
      walletLedgerMismatches: 0,
      duplicateLedgerReferences: 0,
      duplicateCheckoutSessions: 0,
      savedPublicIdDigestMatches: true,
    },
  };
}

describe("migration scoreboard", () => {
  it("summarizes a passing verification report", () => {
    expect(
      buildMigrationScoreboard(passingReport()).every((item) => item.passed),
    ).toBe(true);
  });

  it("surfaces a billing failure", () => {
    const report = passingReport();
    report.integrity.walletLedgerMismatches = 1;
    const billing = buildMigrationScoreboard(report).find(
      (item) => item.label === "Billing invariants",
    );
    expect(billing?.passed).toBe(false);
  });
});
