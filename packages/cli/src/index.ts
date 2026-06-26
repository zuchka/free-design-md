#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "./args.js";
import { runAdd } from "./add.js";

const HELP = `fdmd — download public design.md files from Free design.md

Usage:
  fdmd add <id-or-url> [--out <path>] [--host <url>] [--force]
  fdmd --help
  fdmd --version

Environment:
  FDMD_HOST   Override the default host.
`;

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(
    readFileSync(join(here, "..", "package.json"), "utf8"),
  ) as { version: string };
  return pkg.version;
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (parsed.command === "version") {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  const result = await runAdd(parsed);
  process.stdout.write(`Wrote ${result.path} (design ${result.id})\n`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`fdmd: ${msg}\n`);
    process.exit(1);
  },
);
