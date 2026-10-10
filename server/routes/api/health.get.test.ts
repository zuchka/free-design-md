import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("../../db/index.js", () => ({
  getDbExec: () => ({ execute }),
}));

import { checkDatabaseHealth, getHealthResponse } from "./health.get.js";

describe("database health", () => {
  beforeEach(() => execute.mockReset());

  it("reports ready only when the schema and runtime grants are usable", async () => {
    execute.mockResolvedValue({
      rows: [{ schema_ready: true, schema_access: true, data_access: true }],
      rowsAffected: 1,
    });

    await expect(checkDatabaseHealth()).resolves.toEqual({
      ok: true,
      database: "ready",
    });
  });

  it("returns 503 without exposing connection details", async () => {
    execute.mockResolvedValue({
      rows: [{ schema_ready: true, schema_access: false, data_access: false }],
      rowsAffected: 1,
    });

    const response = await getHealthResponse();
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(503);
    await expect((response as Response).json()).resolves.toEqual({
      ok: false,
      database: "unavailable",
    });
  });
});
