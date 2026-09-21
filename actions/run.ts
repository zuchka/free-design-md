import "dotenv/config";
import extractDesignMd from "./extract-design-md.js";
import enrichDesignMd from "./enrich-design-md.js";
import iterateDesignMd from "./iterate-design-md.js";
import exportDesignMd from "./export-design-md.js";
import dbHealth from "./db-health.js";

const actions = {
  "extract-design-md": extractDesignMd,
  "enrich-design-md": enrichDesignMd,
  "iterate-design-md": iterateDesignMd,
  "export-design-md": exportDesignMd,
  "db-health": dbHealth,
} as const;

function parseValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function parseArgs(argv: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      input[key] = true;
      continue;
    }
    input[key] = parseValue(next);
    index += 1;
  }
  return input;
}

const [actionName, ...argv] = process.argv.slice(2);
if (!actionName || !(actionName in actions)) {
  console.error(`Usage: pnpm action <${Object.keys(actions).join("|")}> [--key value]`);
  process.exitCode = 1;
} else {
  try {
    const action = actions[actionName as keyof typeof actions];
    const result = await action.run(parseArgs(argv));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
