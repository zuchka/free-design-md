import { afterEach, describe, expect, it } from "vitest";
import { migrationWritePauseResponse } from "./migration-maintenance.js";

describe("migration write pause", () => {
  afterEach(() => delete process.env.MIGRATION_WRITE_PAUSED);

  it("allows reads during a cutover", () => {
    process.env.MIGRATION_WRITE_PAUSED = "1";
    expect(
      migrationWritePauseResponse(
        new Request("https://example.test/api/health", { method: "GET" }),
      ),
    ).toBeNull();
  });

  it("rejects writes with a retryable response", async () => {
    process.env.MIGRATION_WRITE_PAUSED = "1";
    const response = migrationWritePauseResponse(
      new Request("https://example.test/api/auth/sign-in/anonymous", {
        method: "POST",
      }),
    );
    expect(response?.status).toBe(503);
    expect(response?.headers.get("retry-after")).toBe("120");
    await expect(response?.json()).resolves.toMatchObject({ retryable: true });
  });

  it("does not affect normal traffic when disabled", () => {
    expect(
      migrationWritePauseResponse(
        new Request("https://example.test/api/billing/checkout", {
          method: "POST",
        }),
      ),
    ).toBeNull();
  });
});
