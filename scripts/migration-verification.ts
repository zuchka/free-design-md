import type Database from "better-sqlite3";
import type postgres from "postgres";
import {
  countByOwner,
  digestRows,
  mapsEqual,
  readSourceRows,
  readTargetRows,
  REQUIRED_INDEXES,
  TABLE_SPECS,
} from "./database-migration.js";

interface CountRow {
  count: string | number | bigint;
}

function countValue(rows: readonly CountRow[]): number {
  return Number(rows[0]?.count ?? 0);
}

async function queryCount(sql: postgres.Sql, query: string): Promise<number> {
  const rows = await sql.unsafe<CountRow[]>(query);
  return countValue(rows);
}

export interface VerificationReport {
  version: 1;
  verifiedAt: string;
  passed: boolean;
  schema: {
    missingTables: string[];
    missingIndexes: string[];
  };
  tables: Array<{
    table: string;
    sourceCount: number;
    targetCount: number;
    sourceDigest: string;
    targetDigest: string;
    digestMatches: boolean;
    ownerDistributionMatches: boolean | null;
    ownerCount: number | null;
  }>;
  integrity: {
    orphanedSessions: number;
    orphanedAccounts: number;
    unresolvedSavedParents: number;
    unresolvedSavedRoots: number;
    negativeWallets: number;
    walletLedgerMismatches: number;
    duplicateLedgerReferences: number;
    duplicateCheckoutSessions: number;
    savedPublicIdDigestMatches: boolean;
  };
}

export async function verifyMigration(
  source: Database.Database,
  target: postgres.Sql,
): Promise<VerificationReport> {
  const tableRows = await target.unsafe<{ table_name: string }[]>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'app' AND table_type = 'BASE TABLE'`,
  );
  const targetTables = new Set(tableRows.map((row) => row.table_name));
  const indexRows = await target.unsafe<{ indexname: string }[]>(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'app'`,
  );
  const targetIndexes = new Set(indexRows.map((row) => row.indexname));
  const missingTables = TABLE_SPECS.map((spec) => spec.name).filter(
    (name) => !targetTables.has(name),
  );
  const missingIndexes = REQUIRED_INDEXES.filter(
    (name) => !targetIndexes.has(name),
  );
  if (missingTables.length) {
    return {
      version: 1,
      verifiedAt: new Date().toISOString(),
      passed: false,
      schema: { missingTables, missingIndexes },
      tables: [],
      integrity: {
        orphanedSessions: -1,
        orphanedAccounts: -1,
        unresolvedSavedParents: -1,
        unresolvedSavedRoots: -1,
        negativeWallets: -1,
        walletLedgerMismatches: -1,
        duplicateLedgerReferences: -1,
        duplicateCheckoutSessions: -1,
        savedPublicIdDigestMatches: false,
      },
    };
  }

  const tables: VerificationReport["tables"] = [];
  let savedPublicIdDigestMatches = false;
  for (const spec of TABLE_SPECS) {
    const sourceRows = readSourceRows(source, spec);
    const targetRows = await readTargetRows(target, spec);
    const sourceDigest = digestRows(sourceRows, spec.columns);
    const targetDigest = digestRows(targetRows, spec.columns);
    const ownerDistributionMatches = spec.ownerColumn
      ? mapsEqual(
          countByOwner(sourceRows, spec.ownerColumn),
          countByOwner(targetRows, spec.ownerColumn),
        )
      : null;
    if (spec.name === "fdmd_saved_enrichments") {
      savedPublicIdDigestMatches =
        digestRows(sourceRows, ["id"]) === digestRows(targetRows, ["id"]);
    }
    tables.push({
      table: spec.name,
      sourceCount: sourceRows.length,
      targetCount: targetRows.length,
      sourceDigest,
      targetDigest,
      digestMatches: sourceDigest === targetDigest,
      ownerDistributionMatches,
      ownerCount: spec.ownerColumn
        ? countByOwner(sourceRows, spec.ownerColumn).size
        : null,
    });
  }

  const integrity = {
    orphanedSessions: await queryCount(
      target,
      `SELECT count(*) AS count
       FROM app.auth_sessions s
       LEFT JOIN app.auth_users u ON u.id = s.user_id
       WHERE u.id IS NULL`,
    ),
    orphanedAccounts: await queryCount(
      target,
      `SELECT count(*) AS count
       FROM app.auth_accounts a
       LEFT JOIN app.auth_users u ON u.id = a.user_id
       WHERE u.id IS NULL`,
    ),
    unresolvedSavedParents: await queryCount(
      target,
      `SELECT count(*) AS count
       FROM app.fdmd_saved_enrichments child
       LEFT JOIN app.fdmd_saved_enrichments parent ON parent.id = child.parent_id
       WHERE child.parent_id IS NOT NULL AND parent.id IS NULL`,
    ),
    unresolvedSavedRoots: await queryCount(
      target,
      `SELECT count(*) AS count
       FROM app.fdmd_saved_enrichments child
       LEFT JOIN app.fdmd_saved_enrichments root ON root.id = child.root_id
       WHERE child.root_id IS NOT NULL AND root.id IS NULL`,
    ),
    negativeWallets: await queryCount(
      target,
      `SELECT count(*) AS count FROM app.credit_wallets WHERE balance < 0`,
    ),
    walletLedgerMismatches: await queryCount(
      target,
      `SELECT count(*) AS count
       FROM app.credit_wallets w
       LEFT JOIN (
         SELECT owner_id, coalesce(sum(delta), 0) AS ledger_balance
         FROM app.credit_ledger
         GROUP BY owner_id
       ) l ON l.owner_id = w.owner_id
       WHERE w.balance <> coalesce(l.ledger_balance, 0)`,
    ),
    duplicateLedgerReferences: await queryCount(
      target,
      `SELECT count(*) AS count FROM (
         SELECT reference_id FROM app.credit_ledger
         GROUP BY reference_id HAVING count(*) > 1
       ) duplicates`,
    ),
    duplicateCheckoutSessions: await queryCount(
      target,
      `SELECT count(*) AS count FROM (
         SELECT stripe_checkout_session_id FROM app.purchases
         GROUP BY stripe_checkout_session_id HAVING count(*) > 1
       ) duplicates`,
    ),
    savedPublicIdDigestMatches,
  };

  const tableChecksPass = tables.every(
    (table) =>
      table.sourceCount === table.targetCount &&
      table.digestMatches &&
      table.ownerDistributionMatches !== false,
  );
  const integrityChecksPass = Object.entries(integrity).every(([, value]) =>
    typeof value === "boolean" ? value : value === 0,
  );

  return {
    version: 1,
    verifiedAt: new Date().toISOString(),
    passed:
      missingTables.length === 0 &&
      missingIndexes.length === 0 &&
      tableChecksPass &&
      integrityChecksPass,
    schema: { missingTables, missingIndexes },
    tables,
    integrity,
  };
}
