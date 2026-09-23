import { afterEach, describe, expect, it } from "vitest";
import {
  migrationWritePauseResponse,
  requestAllowedDuringMigrationPause,
} from "./migration-maintenance.js";

describe("migration maintenance", () => {
  afterEach(() => delete process.env.MIGRATION_WRITE_PAUSED);

  it("allows all requests when the pause is disabled", () => {
    expect(
      migrationWritePauseResponse(
        new Request("https://example.test/api/auth/sign-in/anonymous", {
          method: "POST",
        }),
      ),
    ).toBeNull();
  });

  it("blocks application and API writes with a retryable response", async () => {
    process.env.MIGRATION_WRITE_PAUSED = "1";
    const response = migrationWritePauseResponse(
      new Request("https://example.test/api/auth/sign-in/anonymous", {
        method: "POST",
      }),
    );

    expect(response?.status).toBe(503);
    expect(response?.headers.get("retry-after")).toBe("120");
    expect(await response?.json()).toEqual({
      error: "Writes are temporarily paused for database maintenance.",
      retryable: true,
    });
  });

  it("allows pages, health, snapshot download, and preflight requests", () => {
    expect(
      requestAllowedDuringMigrationPause(
        new Request("https://example.test/d/public-id"),
      ),
    ).toBe(true);
    expect(
      requestAllowedDuringMigrationPause(
        new Request("https://example.test/api/health"),
      ),
    ).toBe(true);
    expect(
      requestAllowedDuringMigrationPause(
        new Request("https://example.test/api/migration-snapshot"),
      ),
    ).toBe(true);
    expect(
      requestAllowedDuringMigrationPause(
        new Request("https://example.test/api/auth/get-session", {
          method: "OPTIONS",
        }),
      ),
    ).toBe(true);
  });

  it("blocks API GET routes that can perform cache or session writes", () => {
    expect(
      requestAllowedDuringMigrationPause(
        new Request("https://example.test/api/extract?url=https://example.com"),
      ),
    ).toBe(false);
    expect(
      requestAllowedDuringMigrationPause(
        new Request("https://example.test/api/auth/get-session"),
      ),
    ).toBe(false);
  });
});
