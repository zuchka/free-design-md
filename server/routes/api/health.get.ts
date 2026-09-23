import { defineEventHandler } from "h3";
import { getDbExec } from "../../db/index.js";

interface DatabaseHealthRow extends Record<string, unknown> {
  schema_ready: boolean;
  schema_access: boolean;
  data_access: boolean;
}

export async function checkDatabaseHealth(): Promise<{
  ok: true;
  database: "ready";
}> {
  const result = await getDbExec().execute<DatabaseHealthRow>(`
    SELECT
      to_regclass('app.auth_users') IS NOT NULL AS schema_ready,
      has_schema_privilege(current_user, 'app', 'USAGE') AS schema_access,
      has_table_privilege(current_user, 'app.auth_users', 'SELECT') AS data_access
  `);
  const row = result.rows[0];
  if (!row?.schema_ready || !row.schema_access || !row.data_access) {
    throw new Error("Database schema or runtime privileges are not ready");
  }
  return { ok: true, database: "ready" };
}

export async function getHealthResponse(): Promise<
  { ok: true; database: "ready" } | Response
> {
  try {
    return await checkDatabaseHealth();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, database: "unavailable" }),
      {
        status: 503,
        headers: { "content-type": "application/json" },
      },
    );
  }
}

export default defineEventHandler(getHealthResponse);
