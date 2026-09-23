import { rm } from "node:fs/promises";
import { delimiter, dirname, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const workspace = process.cwd();
const artifactDirectory = resolve(workspace, ".migration-artifacts", "demo");
const expectedPrefix = resolve(workspace, ".migration-artifacts") + sep;
const localDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function run(args: string[]): void {
  const pnpmCli = process.env.npm_execpath;
  if (!pnpmCli) throw new Error("Run this script through pnpm demo:reset");
  const nodeExecutable = process.env.npm_node_execpath ?? process.execPath;
  const commandEnvironment = {
    ...process.env,
    PATH: `${dirname(nodeExecutable)}${delimiter}${process.env.PATH ?? ""}`,
  };
  const result = spawnSync(nodeExecutable, [pnpmCli, ...args], {
    cwd: workspace,
    env: commandEnvironment,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: pnpm ${args.join(" ")}`);
  }
}

async function main(): Promise<void> {
  if (!artifactDirectory.startsWith(expectedPrefix)) {
    throw new Error("Refusing to reset outside .migration-artifacts");
  }
  await rm(artifactDirectory, { recursive: true, force: true });

  run(["db:start"]);
  run(["db:reset"]);
  run([
    "db:fixture",
    "--",
    "--template",
    "data/app.db",
    "--output",
    ".migration-artifacts/demo/source.db",
  ]);
  run([
    "db:migrate:sqlite",
    "--",
    "--source",
    ".migration-artifacts/demo/source.db",
    "--target",
    localDatabaseUrl,
    "--report",
    ".migration-artifacts/demo/import-report.json",
  ]);
  run([
    "db:verify:sqlite",
    "--",
    "--source",
    ".migration-artifacts/demo/source.db",
    "--target",
    localDatabaseUrl,
    "--report",
    ".migration-artifacts/demo/verification-report.json",
  ]);
  run([
    "demo:scoreboard",
    "--",
    "--report",
    ".migration-artifacts/demo/verification-report.json",
  ]);
}

await main();
