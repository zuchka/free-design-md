export const DOCS_SITE_URL = "https://free-design-md.agent-native.com";

export const DOCS_ARTICLES = [
  {
    path: "/docs/what-is-design-md",
    shortTitle: "What is a design.md?",
    title: "What is a design.md?",
    seoTitle: "What is a design.md? - Free design.md",
    description:
      "A design.md is a portable Markdown design-system spec for agents: colors, typography, spacing, radii, components, voice, and usage rules in one readable file.",
    intent: "Definition",
    topic: "Design systems",
    summary:
      "Learn what a design.md contains, why Markdown is useful for design systems, and how agents use it as implementation context.",
  },
  {
    path: "/docs/what-is-mdx",
    shortTitle: "What is MDX?",
    title: "What Is MDX? Markdown + JSX Explained",
    seoTitle: "What Is MDX? Markdown + JSX Explained - Free design.md",
    description:
      "MDX is a content format that lets you write JSX components inside Markdown. Learn how MDX works, when to use it, and when plain Markdown is better.",
    intent: "Definition",
    topic: "Markdown formats",
    summary:
      "A concise answer-first guide to MDX, including syntax, build requirements, use cases, and common tradeoffs.",
  },
  {
    path: "/docs/markdown-vs-mdx",
    shortTitle: "Markdown vs MDX",
    title: "Markdown vs MDX: Differences and When to Use Each",
    seoTitle:
      "Markdown vs MDX: Differences and When to Use Each - Free design.md",
    description:
      "Markdown is best for portable text docs; MDX adds JSX components for interactive content. Compare syntax, workflows, pros, cons, and use cases.",
    intent: "Comparison",
    topic: "Markdown formats",
    summary:
      "Compare Markdown and MDX side by side, including portability, syntax, tooling, design docs, and interactive documentation.",
  },
] as const;

export type DocsArticle = (typeof DOCS_ARTICLES)[number];

export function docsUrl(path: string) {
  return `${DOCS_SITE_URL}${path}`;
}

export function getRelatedDocs(currentPath: string) {
  return DOCS_ARTICLES.filter((article) => article.path !== currentPath);
}
