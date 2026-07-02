import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { CURATED_EXAMPLE_CATALOG } from "../app/lib/example-catalog.js";
import { EXAMPLE_DESIGNS } from "../app/lib/example-library.js";

const execFileAsync = promisify(execFile);
const privateRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultPublicRepo = resolve(privateRoot, "..", "free-design-md-catalog");

interface PublicPackageJson {
  name?: string;
}

const publicRepo = resolve(
  getArg("--repo") ??
    process.env.FREE_DESIGN_MD_CATALOG_REPO ??
    defaultPublicRepo,
);

async function main() {
  await assertPublicCatalogRepo(publicRepo);

  const catalogDir = join(publicRepo, "catalog");
  assertInsideRepo(publicRepo, catalogDir);

  await rm(catalogDir, { recursive: true, force: true });
  await mkdir(catalogDir, { recursive: true });

  const entriesBySlug = new Map(
    CURATED_EXAMPLE_CATALOG.map((entry) => [entry.slug, entry]),
  );
  const examples = [...EXAMPLE_DESIGNS].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );

  for (const example of examples) {
    const entry = entriesBySlug.get(example.slug);
    if (!entry) {
      throw new Error(`${example.slug}: missing curated catalog entry`);
    }
    if (!example.enrichedMarkdown.trim()) {
      throw new Error(`${example.slug}: missing enriched design.md`);
    }

    const designDir = join(catalogDir, example.slug);
    await mkdir(designDir, { recursive: true });
    await writeFile(
      join(designDir, "metadata.json"),
      `${JSON.stringify(
        {
          slug: example.slug,
          aliases: entry.aliases ?? [],
          title: example.title,
          sourceUrl: example.sourceUrl,
          category: example.category,
          description: example.description,
          bestFor: example.bestFor,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      join(designDir, "design.md"),
      ensureTrailingNewline(example.enrichedMarkdown),
      "utf8",
    );
  }

  await runPublicScript("build-catalog-index.mjs");
  await runPublicScript("build-readme-catalog.mjs");

  console.log(
    `Exported ${examples.length} curated designs to ${relative(
      privateRoot,
      publicRepo,
    )}`,
  );
}

async function assertPublicCatalogRepo(repoPath: string) {
  const packageJson = JSON.parse(
    await readFile(join(repoPath, "package.json"), "utf8"),
  ) as PublicPackageJson;

  if (packageJson.name !== "free-design-md-catalog") {
    throw new Error(
      `${repoPath} is not the free-design-md-catalog repo. Pass --repo <path> if needed.`,
    );
  }
}

function assertInsideRepo(repoPath: string, targetPath: string) {
  const rel = relative(repoPath, targetPath);
  if (rel.startsWith("..") || rel === "") {
    throw new Error(`Refusing to write outside ${repoPath}`);
  }
}

async function runPublicScript(scriptName: string) {
  const scriptPath = join(publicRepo, "scripts", scriptName);
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath],
    {
      cwd: publicRepo,
    },
  );
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
