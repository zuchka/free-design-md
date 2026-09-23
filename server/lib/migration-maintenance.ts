const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function migrationWritesArePaused(): boolean {
  return process.env.MIGRATION_WRITE_PAUSED?.trim() === "1";
}

export function migrationWritePauseResponse(request: Request): Response | null {
  if (!migrationWritesArePaused() || SAFE_METHODS.has(request.method)) {
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
