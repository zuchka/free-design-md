import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./extract.mjs";

let temporary: string;
let output: string;
let stdout: { write: ReturnType<typeof vi.fn> };
let stderr: { write: ReturnType<typeof vi.fn> };
let extractPage: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  temporary = await mkdtemp(join(tmpdir(), "design-skill-cli-"));
  output = join(temporary, "site");
  stdout = { write: vi.fn() };
  stderr = { write: vi.fn() };
  extractPage = vi.fn().mockResolvedValue({
    result: {
      url: "https://example.com/",
      markdown: "# Fixture\n",
      designSystemData: { colors: { primary: "#123456" } },
      signals: { title: "Fixture", cssVars: { "--brand": "#123456" } },
      screenshotDataUrl: `data:image/png;base64,${Buffer.from("png fixture").toString("base64")}`,
    },
    trace: { warnings: [], retries: [], stages: { signals: 10 } },
  });
});
afterEach(async () => {
  await rm(temporary, { recursive: true, force: true });
});
const args = () => ["--url", "https://example.com", "--output", output];
const options = () => ({ stdout, stderr, extractPage });

describe("standalone extraction CLI", () => {
  it("writes measured artifacts and emits a compact, parseable manifest", async () => {
    expect(await runCli(args(), options())).toBe(0);
    expect(extractPage).toHaveBeenCalledWith("https://example.com");
    expect(await readFile(join(output, "design.md"), "utf8")).toBe(
      "# Fixture\n",
    );
    expect(await readFile(join(output, "screenshot.png"), "utf8")).toBe(
      "png fixture",
    );
    const extraction = JSON.parse(
      await readFile(join(output, "extraction.json"), "utf8"),
    );
    expect(extraction).toMatchObject({
      schemaVersion: 1,
      viewport: { width: 1280, height: 800 },
      designSystemData: { colors: { primary: "#123456" } },
      signals: { cssVars: { "--brand": "#123456" } },
      screenshot: "screenshot.png",
      diagnostics: { stagesMs: { signals: 10 } },
    });
    expect(extraction).not.toHaveProperty("screenshotDataUrl");
    expect(JSON.parse(stdout.write.mock.calls[0][0])).toMatchObject({
      markdown: join(output, "design.md"),
      data: join(output, "extraction.json"),
      screenshot: join(output, "screenshot.png"),
    });
    expect(stderr.write).not.toHaveBeenCalled();
  });

  it("reports a missing optional screenshot without writing an empty image", async () => {
    const capture = await extractPage();
    capture.result.screenshotDataUrl = "";
    capture.trace.warnings = ["screenshot_unavailable"];
    expect(await runCli(args(), options())).toBe(0);
    const manifest = JSON.parse(stdout.write.mock.calls[0][0]);
    expect(manifest.screenshot).toBeNull();
    expect(manifest.warnings).toEqual(["screenshot_unavailable"]);
    await expect(
      readFile(join(output, "screenshot.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(output, "design.md"), "utf8")).toBe(
      "# Fixture\n",
    );
  });

  it("refuses an existing directory before extracting and preserves its files", async () => {
    await runCli(args(), options());
    await writeFile(join(output, "design.md"), "user edits");
    extractPage.mockClear();
    expect(await runCli(args(), options())).toBe(1);
    expect(extractPage).not.toHaveBeenCalled();
    expect(await readFile(join(output, "design.md"), "utf8")).toBe(
      "user edits",
    );
    expect(JSON.parse(stderr.write.mock.calls[0][0]).error.code).toBe("EEXIST");
  });

  it.each([
    [],
    ["--url"],
    ["--url", "example.com", "--output", ""],
    ["--unknown"],
    ["--url", "example.com", "extra"],
  ])("rejects malformed arguments: %j", async (...argv) => {
    expect(await runCli(argv, options())).toBe(1);
    expect(extractPage).not.toHaveBeenCalled();
    expect(stdout.write).not.toHaveBeenCalled();
    expect(JSON.parse(stderr.write.mock.calls[0][0])).toHaveProperty(
      "error.message",
    );
  });

  it("shows help without opening a browser", async () => {
    expect(await runCli(["--help"], options())).toBe(0);
    expect(stdout.write.mock.calls[0][0]).toContain("Usage:");
    expect(extractPage).not.toHaveBeenCalled();
  });

  it("runs when installed through a symlink", async () => {
    const entry = fileURLToPath(new URL("./extract.mjs", import.meta.url));
    const linked = join(temporary, "linked-extract.mjs");
    await symlink(entry, linked);
    const result = await promisify(execFile)(process.execPath, [
      linked,
      "--help",
    ]);
    expect(result.stdout).toContain("Usage:");
    expect(result.stderr).toBe("");
  });

  it("keeps safe extraction errors structured and off stdout", async () => {
    const error = Object.assign(
      new Error("This address is not a public website."),
      {
        name: "ExtractionError",
        code: "private_url",
        stage: "validation",
      },
    );
    extractPage.mockRejectedValue(error);
    expect(await runCli(args(), options())).toBe(1);
    expect(stdout.write).not.toHaveBeenCalled();
    expect(JSON.parse(stderr.write.mock.calls[0][0])).toEqual({
      error: {
        code: "private_url",
        stage: "validation",
        message: error.message,
      },
    });
  });

  it("preserves real validation error codes through the standalone TypeScript loader", async () => {
    const entry = fileURLToPath(new URL("./extract.mjs", import.meta.url));
    const failure = await promisify(execFile)(process.execPath, [
      entry,
      "--url",
      "localhost",
      "--output",
      output,
    ]).catch((error) => error);
    expect(failure.code).toBe(1);
    expect(failure.stdout).toBe("");
    expect(JSON.parse(failure.stderr)).toMatchObject({
      error: { code: "private_url", stage: "validation" },
    });
    await expect(readFile(join(output, "design.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("does not echo raw browser errors containing page data", async () => {
    extractPage.mockRejectedValue(
      new Error("https://example.com/?token=secret-value"),
    );
    expect(await runCli(args(), options())).toBe(1);
    expect(stderr.write.mock.calls[0][0]).not.toContain("secret-value");
  });
});
