import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import postgres from "postgres";

type Scalar = null | boolean | number | string | Date;
export type DataRow = Record<string, Scalar>;

export interface TableSpec {
  name: string;
  columns: readonly string[];
  keyColumns: readonly string[];
  booleanColumns?: readonly string[];
  timestampColumns?: readonly string[];
  ownerColumn?: string;
}

export const TABLE_SPECS: readonly TableSpec[] = [
  {
    name: "auth_users",
    columns: [
      "id",
      "name",
      "email",
      "email_verified",
      "image",
      "is_anonymous",
      "created_at",
      "updated_at",
    ],
    keyColumns: ["id"],
    booleanColumns: ["email_verified", "is_anonymous"],
    timestampColumns: ["created_at", "updated_at"],
  },
  {
    name: "auth_sessions",
    columns: [
      "id",
      "expires_at",
      "token",
      "created_at",
      "updated_at",
      "ip_address",
      "user_agent",
      "user_id",
    ],
    keyColumns: ["id"],
    timestampColumns: ["expires_at", "created_at", "updated_at"],
    ownerColumn: "user_id",
  },
  {
    name: "auth_accounts",
    columns: [
      "id",
      "account_id",
      "provider_id",
      "user_id",
      "access_token",
      "refresh_token",
      "id_token",
      "access_token_expires_at",
      "refresh_token_expires_at",
      "scope",
      "password",
      "created_at",
      "updated_at",
    ],
    keyColumns: ["id"],
    timestampColumns: [
      "access_token_expires_at",
      "refresh_token_expires_at",
      "created_at",
      "updated_at",
    ],
    ownerColumn: "user_id",
  },
  {
    name: "auth_verifications",
    columns: [
      "id",
      "identifier",
      "value",
      "expires_at",
      "created_at",
      "updated_at",
    ],
    keyColumns: ["id"],
    timestampColumns: ["expires_at", "created_at", "updated_at"],
  },
  {
    name: "enrichment_cache",
    columns: [
      "cache_key",
      "url",
      "prompt_version",
      "markdown",
      "model",
      "usage_json",
      "stop_reason",
      "created_at",
    ],
    keyColumns: ["cache_key"],
  },
  {
    name: "fdmd_iterations",
    columns: [
      "id",
      "session_id",
      "parent_id",
      "url",
      "owner",
      "user_prompt",
      "section_target",
      "markdown",
      "model",
      "usage_json",
      "stop_reason",
      "rejected_reason",
      "created_at",
    ],
    keyColumns: ["id"],
    ownerColumn: "owner",
  },
  {
    name: "fdmd_saved_enrichments",
    columns: [
      "id",
      "owner_id",
      "source_url",
      "title",
      "parent_id",
      "root_id",
      "iteration_prompt",
      "deterministic_markdown",
      "enriched_markdown",
      "design_system_data_json",
      "signals_json",
      "screenshot_data_url",
      "model",
      "usage_json",
      "stop_reason",
      "created_at",
      "updated_at",
    ],
    keyColumns: ["id"],
    ownerColumn: "owner_id",
  },
  {
    name: "fdmd_metric_counters",
    columns: ["name", "label_key", "labels_json", "value", "updated_at"],
    keyColumns: ["name", "label_key"],
  },
  {
    name: "credit_wallets",
    columns: [
      "owner_id",
      "balance",
      "lifetime_purchased",
      "created_at",
      "updated_at",
    ],
    keyColumns: ["owner_id"],
    ownerColumn: "owner_id",
  },
  {
    name: "credit_ledger",
    columns: [
      "id",
      "owner_id",
      "delta",
      "kind",
      "reference_id",
      "metadata_json",
      "created_at",
    ],
    keyColumns: ["id"],
    ownerColumn: "owner_id",
  },
  {
    name: "credit_operations",
    columns: [
      "operation_id",
      "owner_id",
      "kind",
      "status",
      "created_at",
      "updated_at",
    ],
    keyColumns: ["operation_id"],
    ownerColumn: "owner_id",
  },
  {
    name: "purchases",
    columns: [
      "id",
      "owner_id",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "pack_id",
      "credits",
      "amount_total",
      "currency",
      "status",
      "created_at",
      "fulfilled_at",
    ],
    keyColumns: ["id"],
    ownerColumn: "owner_id",
  },
  {
    name: "stripe_events",
    columns: ["event_id", "event_type", "processed_at"],
    keyColumns: ["event_id"],
  },
] as const;

export const REQUIRED_INDEXES = [
  "auth_accounts_user_id_idx",
  "auth_sessions_user_id_idx",
  "auth_verifications_identifier_idx",
  "credit_ledger_owner_created_idx",
  "fdmd_iter_owner_created_idx",
  "fdmd_iter_session_created_idx",
  "fdmd_saved_enrichments_owner_created_idx",
  "fdmd_saved_enrichments_parent_idx",
  "fdmd_saved_enrichments_root_created_idx",
  "fdmd_saved_enrichments_source_url_idx",
  "purchases_owner_created_idx",
] as const;

export interface ParsedArgs {
  flags: Set<string>;
  values: Map<string, string>;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--"))
      throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags.add(key);
    } else {
      values.set(key, next);
      index += 1;
    }
  }
  return { flags, values };
}

export function requiredArg(args: ParsedArgs, name: string): string {
  const value = args.values.get(name)?.trim();
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function toTimestamp(value: Scalar): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric))
    throw new Error("Invalid Better Auth timestamp");
  const milliseconds =
    Math.abs(numeric) < 100_000_000_000 ? numeric * 1_000 : numeric;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime()))
    throw new Error("Invalid Better Auth timestamp");
  return date;
}

export function normalizeRow(
  spec: TableSpec,
  input: Record<string, unknown>,
  postgresTimestampWithoutTimezone = false,
): DataRow {
  const row: DataRow = {};
  for (const column of spec.columns) {
    const raw = input[column] as Scalar;
    if (spec.booleanColumns?.includes(column)) {
      row[column] = raw === true || raw === 1 || raw === "1";
    } else if (spec.timestampColumns?.includes(column)) {
      const timestamp = toTimestamp(raw);
      row[column] =
        postgresTimestampWithoutTimezone && timestamp
          ? new Date(
              Date.UTC(
                timestamp.getFullYear(),
                timestamp.getMonth(),
                timestamp.getDate(),
                timestamp.getHours(),
                timestamp.getMinutes(),
                timestamp.getSeconds(),
                timestamp.getMilliseconds(),
              ),
            )
          : timestamp;
    } else if (
      raw === null ||
      typeof raw === "boolean" ||
      typeof raw === "number" ||
      typeof raw === "string" ||
      raw instanceof Date
    ) {
      row[column] = raw;
    } else {
      throw new Error(`Unsupported value in ${spec.name}.${column}`);
    }
  }
  return row;
}

export function openSourceDatabase(sourcePath: string): Database.Database {
  const database = new Database(sourcePath, {
    readonly: true,
    fileMustExist: true,
  });
  database.pragma("query_only = ON");
  const integrity = database.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    database.close();
    throw new Error("SQLite integrity_check failed");
  }
  return database;
}

export function assertSourceTables(database: Database.Database): void {
  const found = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => String((row as { name: unknown }).name)),
  );
  const missing = TABLE_SPECS.map((spec) => spec.name).filter(
    (name) => !found.has(name),
  );
  if (missing.length) {
    throw new Error(
      `SQLite source is missing required tables: ${missing.join(", ")}`,
    );
  }
}

export function readSourceRows(
  database: Database.Database,
  spec: TableSpec,
): DataRow[] {
  const columns = spec.columns.map(quoteIdentifier).join(", ");
  const order = spec.keyColumns.map(quoteIdentifier).join(", ");
  const rows = database
    .prepare(
      `SELECT ${columns} FROM ${quoteIdentifier(spec.name)} ORDER BY ${order}`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => normalizeRow(spec, row));
}

export function connectPostgres(targetUrl: string): postgres.Sql {
  const hostname = new URL(targetUrl).hostname;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  return postgres(targetUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 10,
    ssl: local ? false : "require",
    connection: {
      application_name: "free-design-md-sqlite-migration",
      statement_timeout: 120_000,
      idle_in_transaction_session_timeout: 120_000,
    },
  });
}

export async function readTargetRows(
  sql: postgres.Sql,
  spec: TableSpec,
): Promise<DataRow[]> {
  const columns = spec.columns.map(quoteIdentifier).join(", ");
  const order = spec.keyColumns.map(quoteIdentifier).join(", ");
  const rows = await sql.unsafe<Record<string, unknown>[]>(
    `SELECT ${columns} FROM app.${quoteIdentifier(spec.name)} ORDER BY ${order}`,
  );
  return rows.map((row) => normalizeRow(spec, row, true));
}

function canonicalValue(value: Scalar): Scalar {
  return value instanceof Date ? value.toISOString() : value;
}

function canonicalRows(
  rows: readonly DataRow[],
  columns: readonly string[],
): string {
  return rows
    .map((row) =>
      JSON.stringify(columns.map((column) => canonicalValue(row[column]))),
    )
    .sort()
    .join("\n");
}

export function digestRows(
  rows: readonly DataRow[],
  columns: readonly string[],
): string {
  return createHash("sha256")
    .update(canonicalRows(rows, columns))
    .digest("hex");
}

export function countByOwner(
  rows: readonly DataRow[],
  column: string,
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const owner = String(row[column]);
    result.set(owner, (result.get(owner) ?? 0) + 1);
  }
  return result;
}

export function mapsEqual(
  left: Map<string, number>,
  right: Map<string, number>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) {
    if (right.get(key) !== value) return false;
  }
  return true;
}

export function redactDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.username = parsed.username ? "***" : "";
  parsed.password = parsed.password ? "***" : "";
  parsed.search = "";
  return parsed.toString();
}

export async function writeJsonReport(
  path: string | undefined,
  value: unknown,
): Promise<void> {
  if (!path) return;
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
}

export function valuesForInsert(
  rows: readonly DataRow[],
  columns: readonly string[],
): postgres.SerializableParameter[] {
  return rows.flatMap((row) => columns.map((column) => row[column]));
}

export function insertStatement(spec: TableSpec, rowCount: number): string {
  const columns = spec.columns.map(quoteIdentifier).join(", ");
  let parameter = 1;
  const values = Array.from({ length: rowCount }, () => {
    const tuple = spec.columns.map(() => `$${parameter++}`).join(", ");
    return `(${tuple})`;
  }).join(", ");
  return `INSERT INTO app.${quoteIdentifier(spec.name)} (${columns}) VALUES ${values}`;
}
