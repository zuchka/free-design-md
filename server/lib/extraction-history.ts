import { getDbExec } from "../db/client.js";
import {
  extractionFailures,
  type ExtractionFailureCode,
  type ExtractionStage,
} from "../../shared/extraction-diagnostics.js";

/** Keep the submitted site/path without persisting credentials or query tokens. */
export function extractionHistoryUrl(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const value = input.trim();
    // Match extraction's default HTTPS and bare-host-with-port handling.
    const hasPort = /^[^/?#:\s]+:\d+(?:[/?#]|$)/.test(value);
    const url = new URL(
      !hasPort && /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`,
    );
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    // Unparseable or unusually long inputs aren't useful diagnostic URLs.
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

export interface ExtractionHistoryRecord {
  requestId: string;
  url: string | null;
  caller: "http" | "direct";
  status: "success" | "error";
  code: ExtractionFailureCode | "none";
  stage: ExtractionStage | "complete";
  durationMs: number;
  upstreamStatus: number | null;
  retried: boolean;
}

interface ExtractionHistoryRow
  extends Record<string, unknown>,
    Omit<ExtractionHistoryRecord, "caller"> {
  completedAt: Date;
}

export async function recordExtractionHistory(
  record: ExtractionHistoryRecord,
): Promise<void> {
  if (process.env.NODE_ENV === "test" && process.env.DATABASE_TESTS !== "true")
    return;
  try {
    const db = getDbExec();
    await db.execute({
      sql: `INSERT INTO app.fdmd_extraction_requests
        (request_id, url, caller, status, code, stage, duration_ms, upstream_status, retried)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (request_id) DO NOTHING`,
      args: [
        record.requestId,
        extractionHistoryUrl(record.url),
        record.caller,
        record.status,
        record.code,
        record.stage,
        record.durationMs,
        record.upstreamStatus,
        record.retried,
      ],
    });
    // Indexed, bounded cleanup on writes; reads also exclude expired rows.
    await db.execute(`DELETE FROM app.fdmd_extraction_requests WHERE request_id IN (
      SELECT request_id FROM app.fdmd_extraction_requests
      WHERE completed_at < now() - interval '30 days'
      ORDER BY completed_at LIMIT 500
    )`);
  } catch {
    // Telemetry must not turn a completed extraction into a failure. Database
    // errors can include SQL parameters, so never print the raw exception.
    console.warn("[extraction-history] persistence failed", {
      requestId: record.requestId,
    });
  }
}

export async function getExtractionHistory(options: {
  limit: number;
  status?: "success" | "error";
}) {
  const result = await getDbExec().execute<ExtractionHistoryRow>({
    sql: `SELECT request_id AS "requestId", url, completed_at AS "completedAt",
        status, code, stage, duration_ms AS "durationMs",
        upstream_status AS "upstreamStatus", retried
      FROM app.fdmd_extraction_requests
      WHERE caller = 'http' AND completed_at >= now() - interval '30 days'
        AND ($1::text IS NULL OR status = $1)
      ORDER BY completed_at DESC, request_id DESC
      LIMIT $2`,
    args: [options.status ?? null, options.limit + 1],
  });
  return {
    window: "last_30_days",
    storage: "persistent",
    limit: options.limit,
    hasMore: result.rows.length > options.limit,
    items: result.rows.slice(0, options.limit).map((row) => ({
      ...row,
      ...(row.code !== "none" &&
      Object.prototype.hasOwnProperty.call(extractionFailures, row.code)
        ? {
            explanation:
              extractionFailures[row.code as ExtractionFailureCode].message,
            nextStep:
              extractionFailures[row.code as ExtractionFailureCode].hint,
          }
        : {}),
    })),
  };
}
