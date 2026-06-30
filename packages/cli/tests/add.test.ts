import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { runAdd } from "../src/add.js";

const sample = {
  id: "abc123xyz",
  title: "Stripe",
  enrichedMarkdown: "# enriched\n",
  deterministicMarkdown: "# deterministic\n",
};

function mockFetchOnce(body: unknown, init: { status?: number } = {}) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("runAdd", () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dir = await mkdtemp(join(tmpdir(), "fdmd-test-"));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("writes enrichedMarkdown to a design-specific filename by default", async () => {
    mockFetchOnce(sample);
    process.chdir(dir);
    const result = await runAdd({
      idOrUrl: sample.id,
      out: undefined,
      host: "http://localhost:8080",
      force: false,
    });
    expect(basename(result.path)).toBe("abc123xyz.design.md");
    const content = await readFile(result.path, "utf8");
    expect(content).toBe(sample.enrichedMarkdown);
  });

  it("writes to an explicit output path when --out is provided", async () => {
    mockFetchOnce(sample);
    const result = await runAdd({
      idOrUrl: sample.id,
      out: join(dir, "design.md"),
      host: "http://localhost:8080",
      force: false,
    });
    expect(result.path).toBe(join(dir, "design.md"));
    expect(await readFile(result.path, "utf8")).toBe(sample.enrichedMarkdown);
  });

  it("falls back to deterministicMarkdown when enriched is empty", async () => {
    mockFetchOnce({ ...sample, enrichedMarkdown: "" });
    const result = await runAdd({
      idOrUrl: sample.id,
      out: join(dir, "design.md"),
      host: "http://localhost:8080",
      force: false,
    });
    const content = await readFile(result.path, "utf8");
    expect(content).toBe(sample.deterministicMarkdown);
  });

  it("refuses to overwrite an existing file without --force", async () => {
    await writeFile(join(dir, "design.md"), "old", "utf8");
    mockFetchOnce(sample);
    await expect(
      runAdd({
        idOrUrl: sample.id,
        out: join(dir, "design.md"),
        host: "http://localhost:8080",
        force: false,
      }),
    ).rejects.toThrow(/overwrite/i);
    const content = await readFile(join(dir, "design.md"), "utf8");
    expect(content).toBe("old");
  });

  it("overwrites with --force", async () => {
    await writeFile(join(dir, "design.md"), "old", "utf8");
    mockFetchOnce(sample);
    await runAdd({
      idOrUrl: sample.id,
      out: join(dir, "design.md"),
      host: "http://localhost:8080",
      force: true,
    });
    const content = await readFile(join(dir, "design.md"), "utf8");
    expect(content).toBe(sample.enrichedMarkdown);
  });

  it("throws a clear 404 error when the design is not found", async () => {
    mockFetchOnce({ error: "not found" }, { status: 404 });
    mockFetchOnce({ error: "not found" }, { status: 404 });
    await expect(
      runAdd({
        idOrUrl: sample.id,
        out: join(dir, "design.md"),
        host: "http://localhost:8080",
        force: false,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("falls back to the curated catalog endpoint for slugs", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...sample,
            id: "stripe",
            title: "Stripe",
          }),
          { status: 200 },
        ),
      );

    const result = await runAdd({
      idOrUrl: "stripe",
      out: join(dir, "design.md"),
      host: "http://localhost:8080",
      force: false,
    });

    expect(result.id).toBe("stripe");
    expect(await readFile(result.path, "utf8")).toBe(sample.enrichedMarkdown);
    expect(spy).toHaveBeenNthCalledWith(
      1,
      "http://localhost:8080/api/saved-enrichments/stripe",
      expect.anything(),
    );
    expect(spy).toHaveBeenNthCalledWith(
      2,
      "http://localhost:8080/api/catalog-designs/stripe",
      expect.anything(),
    );
  });

  it("uses the returned catalog id for the default filename", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...sample,
            id: "linear.app",
            title: "Linear",
          }),
          { status: 200 },
        ),
      );

    process.chdir(dir);
    const result = await runAdd({
      idOrUrl: "linear",
      out: undefined,
      host: "http://localhost:8080",
      force: false,
    });

    expect(result.id).toBe("linear.app");
    expect(basename(result.path)).toBe("linear.app.design.md");
    expect(await readFile(result.path, "utf8")).toBe(sample.enrichedMarkdown);
  });

  it("calls the saved-enrichments endpoint at the resolved host", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sample), { status: 200 }),
      );
    await runAdd({
      idOrUrl: sample.id,
      out: join(dir, "design.md"),
      host: "http://example.test",
      force: false,
    });
    expect(spy).toHaveBeenCalledWith(
      "http://example.test/api/saved-enrichments/abc123xyz",
      expect.anything(),
    );
  });
});
