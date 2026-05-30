import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetDbExec = vi.hoisted(() => vi.fn());
const mockGetCookie = vi.hoisted(() => vi.fn());

vi.mock("@agent-native/core/db", () => ({ getDbExec: mockGetDbExec }));
vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  return { ...actual, getCookie: mockGetCookie };
});

const { getBYOKeyForEvent, setBYOKeyForEvent } = await import("./byo-key.js");

const fakeExec = { execute: vi.fn() };
beforeEach(() => {
  mockGetDbExec.mockReturnValue(fakeExec);
  fakeExec.execute.mockReset();
  mockGetCookie.mockReset();
});

describe("getBYOKeyForEvent", () => {
  it("returns null when no fdmd_anon cookie", async () => {
    mockGetCookie.mockReturnValue(undefined);
    const result = await getBYOKeyForEvent({} as never);
    expect(result).toBeNull();
    expect(fakeExec.execute).not.toHaveBeenCalled();
  });

  it("returns null when cookie exists but no row in DB", async () => {
    mockGetCookie.mockReturnValue("test-token");
    fakeExec.execute.mockResolvedValue({ rows: [] });
    const result = await getBYOKeyForEvent({} as never);
    expect(result).toBeNull();
  });

  it("returns the api_key when a row exists", async () => {
    mockGetCookie.mockReturnValue("test-token");
    fakeExec.execute.mockResolvedValue({ rows: [{ api_key: "sk-test-key" }] });
    const result = await getBYOKeyForEvent({} as never);
    expect(result).toBe("sk-test-key");
  });
});

describe("setBYOKeyForEvent", () => {
  it("does nothing when no fdmd_anon cookie", async () => {
    mockGetCookie.mockReturnValue(undefined);
    await setBYOKeyForEvent({} as never, "sk-key");
    expect(fakeExec.execute).not.toHaveBeenCalled();
  });

  it("upserts the key when a cookie is present", async () => {
    mockGetCookie.mockReturnValue("test-token");
    fakeExec.execute.mockResolvedValue({ rows: [] });
    await setBYOKeyForEvent({} as never, "sk-new-key");
    expect(fakeExec.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("INSERT"),
      }),
    );
  });
});
