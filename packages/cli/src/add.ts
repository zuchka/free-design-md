import { access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fetchDesign } from "./fetch-design.js";
import { parseId } from "./parse-id.js";
import { resolveHost } from "./config.js";

export interface AddOptions {
  idOrUrl: string;
  out: string | undefined;
  host: string | undefined;
  force: boolean;
}

export interface AddResult {
  id: string;
  path: string;
}

export async function runAdd(opts: AddOptions): Promise<AddResult> {
  const id = parseId(opts.idOrUrl);
  const host = resolveHost(opts.host);
  const design = await fetchDesign(host, id);
  const out = resolve(opts.out ?? defaultOutputFilename(design.id));

  if (!opts.force) {
    const exists = await access(out).then(
      () => true,
      () => false,
    );
    if (exists) {
      throw new Error(
        `Refusing to overwrite existing file: ${out}. Pass --force to overwrite.`,
      );
    }
  }

  const markdown =
    design.enrichedMarkdown && design.enrichedMarkdown.trim().length > 0
      ? design.enrichedMarkdown
      : design.deterministicMarkdown;

  await writeFile(out, markdown, "utf8");
  return { id: design.id, path: out };
}

function defaultOutputFilename(id: string): string {
  const safeId = id
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeId || "design"}.design.md`;
}
