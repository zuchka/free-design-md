import { mkdir, rmdir, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const help = `Usage: node scripts/extract.mjs --url <public-url> [--output <new-directory>]

Extract a website's computed styles and screenshot without an AI API or app server.
The output directory must not already exist. Relative paths use your current directory.
Default: ./design-extractions/<timestamp>

Outputs: design.md, extraction.json, and screenshot.png (when available).
Stdout: one JSON summary with absolute artifact paths and warnings.
Stderr: one JSON error on failure; the process exits with status 1.
`;

async function extract(url) {
  const { tsImport } = await import("tsx/esm/api");
  // Ignore the caller's tsconfig: this folder also runs outside the application.
  const { extractDesignMd, ExtractionTrace } = await tsImport(
    "./lib/extract.ts",
    {
      parentURL: import.meta.url,
      tsconfig: false,
    },
  );
  const trace = new ExtractionTrace();
  const result = await extractDesignMd(url, trace);
  return { result, trace };
}

export async function runCli(
  argv,
  {
    extractPage = extract,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  let reservedOutput;
  try {
    const { values } = parseArgs({
      args: argv,
      options: {
        url: { type: "string" },
        output: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    });
    if (values.help) {
      stdout.write(help);
      return 0;
    }
    if (!values.url?.trim()) {
      throw new Error("Provide --url <public-url>. Use --help for usage.");
    }
    if (values.output !== undefined && !values.output.trim()) {
      throw new Error("--output must name a new directory.");
    }
    const output = resolve(
      values.output ??
        join(
          "design-extractions",
          new Date().toISOString().replace(/[:.]/g, "-"),
        ),
    );
    await mkdir(dirname(output), { recursive: true });
    // Reserve a new directory before opening the browser; never overwrite files.
    await mkdir(output);
    reservedOutput = output;

    const { result, trace } = await extractPage(values.url);
    const markdown = join(output, "design.md");
    const data = join(output, "extraction.json");
    const screenshot = result.screenshotDataUrl
      ? join(output, "screenshot.png")
      : null;
    const diagnostics = {
      warnings: trace.warnings,
      retries: trace.retries,
      stagesMs: trace.stages,
    };
    const { screenshotDataUrl, ...extraction } = result;
    await writeFile(markdown, result.markdown, { flag: "wx" });
    if (screenshot) {
      await writeFile(
        screenshot,
        Buffer.from(
          screenshotDataUrl.replace(/^data:image\/png;base64,/, ""),
          "base64",
        ),
        { flag: "wx" },
      );
    }
    await writeFile(
      data,
      JSON.stringify(
        {
          schemaVersion: 1,
          extractedAt: new Date().toISOString(),
          viewport: { width: 1280, height: 800 },
          ...extraction,
          screenshot: screenshot ? "screenshot.png" : null,
          diagnostics,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
    stdout.write(
      JSON.stringify({ output, markdown, data, screenshot, ...diagnostics }) +
        "\n",
    );
    return 0;
  } catch (error) {
    // Remove only an empty directory created by this run. Preserve partial files.
    if (reservedOutput) await rmdir(reservedOutput).catch(() => {});
    const failure = error?.name === "ExtractionError";
    const code = error?.code;
    const message =
      code === "EEXIST"
        ? "The output directory already exists. Choose a new --output directory."
        : code === "ERR_MODULE_NOT_FOUND"
          ? "Install the skill dependencies with npm ci in the skill directory."
          : failure
            ? error.message
            : code?.startsWith("ERR_PARSE_ARGS") || !code
              ? "Check --url and --output, and use --help for usage."
              : "Could not write the extraction. Check the output path and permissions.";
    stderr.write(
      JSON.stringify({
        error: {
          code: code ?? "invalid_request",
          message,
          ...(failure ? { stage: error.stage } : {}),
          ...(code === "browser_unavailable"
            ? {
                hint: "Run npm run install-browser in the skill directory. On Linux, missing system libraries may require playwright install --with-deps chromium.",
              }
            : {}),
        },
      }) + "\n",
    );
    return 1;
  }
}

if (
  process.argv[1] &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
) {
  process.exitCode = await runCli(process.argv.slice(2));
}
