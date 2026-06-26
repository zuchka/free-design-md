export type ParsedArgs =
  | { command: "help" }
  | { command: "version" }
  | {
      command: "add";
      idOrUrl: string;
      out: string | undefined;
      host: string | undefined;
      force: boolean;
    };

export function parseArgs(argv: readonly string[]): ParsedArgs {
  if (argv.length === 0) return { command: "help" };

  const head = argv[0]!;
  if (head === "--help" || head === "-h") return { command: "help" };
  if (head === "--version" || head === "-v") return { command: "version" };

  if (head !== "add") {
    throw new Error(`Unknown command: ${head}`);
  }

  let idOrUrl: string | undefined;
  let out: string | undefined;
  let host: string | undefined;
  let force = false;

  for (let i = 1; i < argv.length; i++) {
    const token = argv[i]!;
    if (token === "--force") {
      force = true;
      continue;
    }
    const eq = token.indexOf("=");
    if (token.startsWith("--out")) {
      if (eq !== -1) {
        out = token.slice(eq + 1);
      } else {
        out = argv[++i];
      }
      continue;
    }
    if (token.startsWith("--host")) {
      if (eq !== -1) {
        host = token.slice(eq + 1);
      } else {
        host = argv[++i];
      }
      continue;
    }
    if (token.startsWith("-")) {
      throw new Error(`Unknown flag: ${token}`);
    }
    if (idOrUrl === undefined) {
      idOrUrl = token;
      continue;
    }
    throw new Error(`Unexpected extra argument: ${token}`);
  }

  if (!idOrUrl) {
    throw new Error("`add` requires an id or share URL.");
  }

  return { command: "add", idOrUrl, out, host, force };
}
