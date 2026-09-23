const SAFE_METHODS = new Set(["GET", "HEAD"]);
const SAFE_API_PATHS = new Set([
  "/api/health",
  "/api/migration-snapshot",
]);

export function migrationWritesArePaused(): boolean {
  return process.env.MIGRATION_WRITE_PAUSED?.trim() === "1";
}

export function requestAllowedDuringMigrationPause(request: Request): boolean {
  if (request.method === "OPTIONS") return true;
  if (!SAFE_METHODS.has(request.method)) return false;

  const pathname = new URL(request.url).pathname;
  return !pathname.startsWith("/api/") || SAFE_API_PATHS.has(pathname);
}

export function migrationWritePauseResponse(request: Request): Response | null {
  if (
    !migrationWritesArePaused() ||
    requestAllowedDuringMigrationPause(request)
  ) {
    return null;
  }

  return Response.json(
    {
      error: "Writes are temporarily paused for database maintenance.",
      retryable: true,
    },
    {
      status: 503,
      headers: { "retry-after": "120" },
    },
  );
}
