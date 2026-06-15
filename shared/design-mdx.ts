export interface DesignMdxInput {
  title: string;
  markdown: string;
  previewHtml?: string;
  sourceUrl?: string;
  variant?: string;
}

function cleanTitle(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed || "Design System";
}

function mdxText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/{/g, "&#123;")
    .replace(/}/g, "&#125;");
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Render an export-only MDX artifact.
 *
 * This intentionally does not compile or execute MDX inside Free design.md.
 * The app still renders previews with the existing sanitized HTML iframe path;
 * this file is just a portable source artifact for MDX-aware docs sites.
 */
export function designArtifactToMdx(input: DesignMdxInput): string {
  const title = cleanTitle(input.title);
  const markdown = input.markdown.trimEnd();
  const previewHtml = (input.previewHtml ?? "").trim();
  const sourceUrl = (input.sourceUrl ?? "").trim();
  const variant = (input.variant ?? "").trim();

  const metadata: Record<string, string> = {
    title: `${title} design.md`,
    format: "design.mdx",
    generatedBy: "Free design.md",
  };
  if (sourceUrl) metadata.sourceUrl = sourceUrl;
  if (variant) metadata.variant = variant;

  return [
    "export const metadata = " + JSON.stringify(metadata, null, 2) + ";",
    "",
    `export const designMd = ${jsString(markdown)};`,
    "",
    `export const previewHtml = ${jsString(previewHtml)};`,
    "",
    'export function TokenPreview({ height = "720px" }) {',
    "  if (!previewHtml) {",
    "    return <p>No token preview was generated for this export.</p>;",
    "  }",
    "  return (",
    "    <iframe",
    '      title="Token preview"',
    "      srcDoc={previewHtml}",
    '      sandbox=""',
    "      style={{",
    '        width: "100%",',
    "        height,",
    '        border: "1px solid #e5e7eb",',
    '        borderRadius: "8px",',
    '        background: "#ffffff",',
    "      }}",
    "    />",
    "  );",
    "}",
    "",
    `# ${mdxText(title)} design.md`,
    "",
    sourceUrl ? "Source URL: {metadata.sourceUrl}" : "",
    "",
    "## Token preview",
    "",
    "<TokenPreview />",
    "",
    "## Source design.md",
    "",
    "<pre><code>{designMd}</code></pre>",
    "",
  ]
    .filter((line, index, lines) => {
      if (line !== "") return true;
      return lines[index - 1] !== "";
    })
    .join("\n")
    .trimEnd()
    .concat("\n");
}
