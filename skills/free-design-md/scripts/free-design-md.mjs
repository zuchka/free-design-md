#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_ORIGIN = "https://freedesign.md";
const FORMATS = new Set(["markdown", "md", "json", "mdx"]);

function usage() {
  return `Usage:
  free-design-md <url> [--format markdown|json|mdx] [--out design.md]
  free-design-md extract <url> [--format markdown|json|mdx] [--out design.md]

Outputs:
  markdown  Raw deterministic design.md text. Default. Alias: md.
  json      Full deterministic payload: url, markdown, designSystemData, signals, screenshotDataUrl.
  mdx       Deterministic MDX artifact with embedded preview.

Examples:
  node scripts/free-design-md.mjs https://stripe.com --out design.md
  node scripts/free-design-md.mjs https://stripe.com --format json --out extract.json
  node scripts/free-design-md.mjs https://stripe.com --format mdx --out design.mdx
`;
}

function parseArgs(argv) {
  const args = [...argv];
  if (args[0] === "extract") args.shift();

  const options = {
    url: "",
    format: "markdown",
    out: "",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h" || arg === "help") {
      options.help = true;
    } else if (arg === "--out" || arg === "-o") {
      options.out = requireValue(args, ++i, arg);
    } else if (arg === "--format") {
      options.format = requireValue(args, ++i, arg).toLowerCase();
    } else if (arg === "--json") {
      options.format = "json";
    } else if (arg === "--mdx") {
      options.format = "mdx";
    } else if (arg === "--markdown" || arg === "--md") {
      options.format = "markdown";
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!options.url) {
      options.url = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return options;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function normalizeFormat(format) {
  if (!FORMATS.has(format)) {
    throw new Error("--format must be one of: markdown, json, mdx");
  }
  return format === "md" ? "markdown" : format;
}

async function extract({ url, format, out }) {
  if (!url) throw new Error("A URL is required");

  const normalizedFormat = normalizeFormat(format);
  const endpoint = new URL("/api/extract", API_ORIGIN);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", normalizedFormat);

  let response;
  try {
    response = await fetch(endpoint);
  } catch (err) {
    throw new Error(
      `Hosted extraction request failed for ${endpoint.toString()}: ${errorDetail(err)}`,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body.trim() ? `\n${body.trim().slice(0, 1000)}` : "";
    throw new Error(
      `Hosted extraction failed: HTTP ${response.status} ${response.statusText}${detail}`,
    );
  }

  if (normalizedFormat === "json") {
    const data = await response.json();
    await writeOrPrint(`${JSON.stringify(data, null, 2)}\n`, out);
    return;
  }

  const text = await response.text();
  await writeOrPrint(text.endsWith("\n") ? text : `${text}\n`, out);
}

async function writeOrPrint(text, outPath) {
  if (!outPath) {
    process.stdout.write(text);
    return;
  }

  const dir = path.dirname(outPath);
  if (dir && dir !== ".") {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(outPath, text, "utf8");
}

function errorDetail(err) {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause;
  if (cause && typeof cause === "object") {
    const code = "code" in cause ? cause.code : "";
    const hostname = "hostname" in cause ? cause.hostname : "";
    const details = [code, hostname].filter(Boolean).join(" ");
    if (details) return `${err.message} (${details})`;
  }
  return err.message;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }
  await extract(options);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`free-design-md: ${message}\n`);
  process.exitCode = 1;
});
