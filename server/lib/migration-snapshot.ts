import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { getDbExec } from "../db/index.js";
import { migrationWritesArePaused } from "./migration-maintenance.js";

function authorized(request: Request): boolean {
  const expected = process.env.MIGRATION_SNAPSHOT_TOKEN?.trim();
  if (!expected || expected.length < 32) return false;
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function createMigrationSnapshotResponse(
  request: Request,
): Promise<Response> {
  const commonHeaders = { "cache-control": "no-store" };

  if (!migrationWritesArePaused()) {
    return Response.json(
      { error: "migration_write_pause_required" },
      { status: 409, headers: commonHeaders },
    );
  }
  if (!authorized(request)) {
    return Response.json(
      { error: "not_found" },
      { status: 404, headers: commonHeaders },
    );
  }

  const destination = `/tmp/free-design-md-cutover-${randomUUID()}.db`;
  try {
    const database = getDbExec();
    await database.execute("PRAGMA wal_checkpoint(FULL)");
    await database.execute(`VACUUM INTO '${destination}'`);
    const bytes = await readFile(destination);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const timestamp = new Date().toISOString().replace(/:/g, "-");

    return new Response(new Uint8Array(bytes), {
      headers: {
        ...commonHeaders,
        "content-type": "application/octet-stream",
        "content-disposition":
          `attachment; filename="free-design-md-${timestamp}.db"`,
        "x-snapshot-sha256": sha256,
      },
    });
  } catch {
    return Response.json(
      { error: "snapshot_failed" },
      { status: 500, headers: commonHeaders },
    );
  } finally {
    await unlink(destination).catch(() => undefined);
  }
}
