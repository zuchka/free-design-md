import dotenv from "dotenv";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import extractAction from "../actions/extract-design-md.js";
import enrichAction from "../actions/enrich-design-md.js";
import type { DesignSystemData } from "../shared/api.js";
import type { ExtractedSignals } from "../shared/extract-design-system.js";

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

const TARGETS = [
  { slug: "stripe", sourceUrl: "https://stripe.com" },
  { slug: "intuit", sourceUrl: "https://www.intuit.com" },
  { slug: "walmart", sourceUrl: "https://www.walmart.com" },
  { slug: "apple", sourceUrl: "https://www.apple.com" },
  { slug: "shopify", sourceUrl: "https://www.shopify.com" },
  { slug: "vercel", sourceUrl: "https://vercel.com" },
  { slug: "airbnb", sourceUrl: "https://www.airbnb.com" },
  { slug: "nike", sourceUrl: "https://www.nike.com" },
  { slug: "claude", sourceUrl: "https://www.anthropic.com/claude" },
  { slug: "figma", sourceUrl: "https://www.figma.com" },
  { slug: "linear", sourceUrl: "https://linear.app" },
] as const;

const OUTPUT_PATH = join("app", "lib", "generated-example-artifacts.ts");

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required in .env.local to generate enriched examples.",
    );
  }

  const onlySlug = getArg("--only");
  const targets = onlySlug
    ? TARGETS.filter((target) => target.slug === onlySlug)
    : TARGETS;
  if (onlySlug && targets.length === 0) {
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
