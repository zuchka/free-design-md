import { describe, expect, it } from "vitest";
import { designArtifactToMdx } from "./design-mdx";

describe("designArtifactToMdx", () => {
  it("renders a self-contained MDX artifact with metadata and preview component", () => {
    const mdx = designArtifactToMdx({
      title: "Stripe",
      sourceUrl: "https://stripe.com",
      variant: "AI-enriched",
      markdown: "---\nname: Stripe\n---\n\n## Colors\n\n- Primary",
      previewHtml: "<!doctype html><html><body>Preview</body></html>",
    });

    expect(mdx).toContain('"title": "Stripe design.md"');
    expect(mdx).toContain('"sourceUrl": "https://stripe.com"');
    expect(mdx).toContain('"variant": "AI-enriched"');
    expect(mdx).toContain("export const designMd = ");
    expect(mdx).toContain("export const previewHtml = ");
    expect(mdx).toContain("export function TokenPreview");
    expect(mdx).toContain('sandbox=""');
    expect(mdx).toContain("# Stripe design.md");
    expect(mdx).toContain("Source URL: {metadata.sourceUrl}");
    expect(mdx).toContain("<TokenPreview />");
    expect(mdx).toContain("<pre><code>{designMd}</code></pre>");
  });

  it("escapes MDX-sensitive title text in the heading", () => {
    const mdx = designArtifactToMdx({
      title: "ACME <script>{bad}</script>",
      markdown: "# Demo",
      previewHtml: "",
    });

    expect(mdx).toContain(
      "# ACME &lt;script&gt;&#123;bad&#125;&lt;/script&gt; design.md",
    );
    expect(mdx).not.toContain("# ACME <script>{bad}</script> design.md");
  });

  it("serializes markdown and preview HTML as JavaScript strings", () => {
    const mdx = designArtifactToMdx({
      title: "Escapes",
      markdown: "Value with `ticks`, ${expressions}, and backslash \\",
      previewHtml: '<iframe srcdoc="${notAnExpression}"></iframe>',
    });

    expect(mdx).toContain(
      'export const designMd = "Value with `ticks`, ${expressions}, and backslash \\\\";',
    );
    expect(mdx).toContain(
      'export const previewHtml = "<iframe srcdoc=\\"${notAnExpression}\\"></iframe>";',
    );
  });

  it("does not require preview HTML", () => {
    const mdx = designArtifactToMdx({
      title: "No Preview",
      markdown: "# Design",
    });

    expect(mdx).toContain('export const previewHtml = "";');
    expect(mdx).toContain("No token preview was generated");
  });
});
