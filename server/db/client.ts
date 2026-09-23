import postgres from "postgres";

export interface DbStatement {
  sql: string;
  args?: readonly postgres.SerializableParameter[];
}

export interface DbResult<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  rows: Row[];
  rowsAffected: number;
}

type Queryable = postgres.Sql | postgres.TransactionSql;

export class DbExecutor {
  constructor(readonly sql: Queryable) {}

  async execute<Row extends Record<string, unknown> = Record<string, unknown>>(
    statement: string | DbStatement,
  ): Promise<DbResult<Row>> {
    const query = typeof statement === "string" ? statement : statement.sql;
    const args: postgres.SerializableParameter[] =
      typeof statement === "string" ? [] : [...(statement.args ?? [])];
    const result = await this.sql.unsafe<Row[]>(query, args);
    return {
      rows: Array.from(result),
      rowsAffected: result.count,
    };
  }

  async batch(statements: readonly DbStatement[]): Promise<DbResult[]> {
    return this.transaction(async (transaction) => {
      const results: DbResult[] = [];
      for (const statement of statements) {
        results.push(await transaction.execute(statement));
      }
      return results;
    });
  }

  async transaction<T>(
    callback: (transaction: DbExecutor) => Promise<T>,
  ): Promise<T> {
    if (!("begin" in this.sql)) return callback(this);
    return (await this.sql.begin((transaction) =>
      callback(new DbExecutor(transaction)),
    )) as T;
  }
}

let queryClient: postgres.Sql | null = null;
let executor: DbExecutor | null = null;

export function getDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}

function usesTransactionPooler(url: string): boolean {
  try {
    return new URL(url).port === "6543";
  } catch {
    return false;
  }
}

function isLocalDatabase(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  } catch {
    return false;
  }
}

export function getQueryClient(): postgres.Sql {
  if (queryClient) return queryClient;
  const url = getDatabaseUrl();
  queryClient = postgres(url, {
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: !usesTransactionPooler(url),
    ssl: isLocalDatabase(url) ? false : "require",
    connection: {
      application_name: "free-design-md",
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 10_000,
    },
  });
  return queryClient;
}

export function getDbExec(): DbExecutor {
  if (!executor) executor = new DbExecutor(getQueryClient());
  return executor;
}

export async function closeDbClient(): Promise<void> {
  const active = queryClient;
  queryClient = null;
  executor = null;
  if (active) await active.end({ timeout: 5 });
}

export async function resetDbClientForTests(): Promise<void> {
  await closeDbClient();
}
