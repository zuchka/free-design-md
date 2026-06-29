import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import extractAction from "../actions/extract-design-md.js";
import enrichAction from "../actions/enrich-design-md.js";
import {
  CURATED_EXAMPLE_CATALOG,
  getCatalogEntryBySlug,
} from "../app/lib/example-catalog.js";
import type { DesignSystemData } from "../shared/api.js";
import type { ExtractedSignals } from "../shared/extract-design-system.js";
import { parseEnrichedFrontmatter } from "../shared/parse-enriched-design-md.js";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

interface ExtractResult {
  url: string;
  markdown: string;
  designSystemData: DesignSystemData;
  signals: ExtractedSignals;
  screenshotDataUrl: string;
}

interface EnrichResult {
  markdown: string;
  model: string;
  stopReason: string | null;
}

interface GeneratedExampleArtifact {
  sourceUrl: string;
  markdown: string;
  enrichedMarkdown: string;
  designSystemData: DesignSystemData;
  model: string;
  stopReason: string | null;
  generatedAt: string;
}

const TARGETS = CURATED_EXAMPLE_CATALOG.map((entry) => ({
  slug: entry.slug,
  sourceUrl: entry.sourceUrl,
}));

const OUTPUT_PATH = join("app", "lib", "generated-example-artifacts.ts");

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required in .env.local to generate enriched examples.",
    );
  }

  const onlySlug = getArg("--only");
  const entry = onlySlug ? getCatalogEntryBySlug(onlySlug) : null;
  const targets = entry
    ? [{ slug: entry.slug, sourceUrl: entry.sourceUrl }]
    : onlySlug
      ? []
      : TARGETS;
  if (onlySlug && !entry) {
    throw new Error(`Unknown example slug: ${onlySlug}`);
  }

  const force = process.argv.includes("--force");
  const artifacts = await readExistingArtifacts();
  for (const [index, target] of targets.entries()) {
    const prefix = `[${index + 1}/${targets.length}] ${target.slug}`;
    if (!force && artifacts[target.slug]) {
      console.log(`${prefix}: existing artifact found, skipping`);
      continue;
    }
    console.log(`${prefix}: extracting ${target.sourceUrl}`);
    const extracted = (await extractAction.run({
      url: target.sourceUrl,
    })) as ExtractResult;

    console.log(`${prefix}: enriching with production action prompt`);
    const enriched = (await enrichAction.run({
      url: extracted.url,
      designSystemData: extracted.designSystemData,
      deterministicMarkdown: extracted.markdown,
      signals: extracted.signals,
      screenshotDataUrl: extracted.screenshotDataUrl,
    })) as EnrichResult;

    validateGeneratedMarkdown(target.slug, enriched.markdown);

    artifacts[target.slug] = {
      sourceUrl: extracted.url,
      markdown: extracted.markdown,
      enrichedMarkdown: enriched.markdown,
      designSystemData: extracted.designSystemData,
      model: enriched.model,
      stopReason: enriched.stopReason,
      generatedAt: new Date().toISOString(),
    };

    await writeGeneratedFile(artifacts);
    console.log(
      `${prefix}: wrote ${enriched.markdown.length.toLocaleString()} enriched chars`,
    );
  }
}

function validateGeneratedMarkdown(slug: string, markdown: string) {
  if (!markdown.trim()) {
    throw new Error(`${slug}: enrichedMarkdown is empty`);
  }
  if (!markdown.includes("## Overview")) {
    throw new Error(`${slug}: enrichedMarkdown is missing ## Overview`);
  }
  if (!markdown.includes("## Do's and Don'ts")) {
    throw new Error(`${slug}: enrichedMarkdown is missing ## Do's and Don'ts`);
  }
  const parsed = parseEnrichedFrontmatter(markdown);
  if (!parsed?.name) {
    throw new Error(`${slug}: enrichedMarkdown frontmatter did not parse`);
  }
}

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

async function writeGeneratedFile(
  artifacts: Record<string, GeneratedExampleArtifact>,
) {
  const content = `import type { DesignSystemData } from "../../shared/api";

export interface GeneratedExampleArtifact {
  sourceUrl: string;
  markdown: string;
  enrichedMarkdown: string;
  designSystemData: DesignSystemData;
  model: string;
  stopReason: string | null;
  generatedAt: string;
}

export const GENERATED_EXAMPLE_ARTIFACTS = ${JSON.stringify(artifacts, null, 2)} satisfies Record<string, GeneratedExampleArtifact>;
`;
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, content, "utf8");
}

async function readExistingArtifacts(): Promise<
  Record<string, GeneratedExampleArtifact>
> {
  try {
    const content = await readFile(OUTPUT_PATH, "utf8");
    const match = content.match(
      /export const GENERATED_EXAMPLE_ARTIFACTS = ([\s\S]*?) satisfies/,
    );
    if (!match?.[1]) return {};
    return JSON.parse(match[1]) as Record<string, GeneratedExampleArtifact>;
  } catch {
    return {};
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
