import { Link } from "react-router";
import type { LinksFunction } from "react-router";
import { IconArrowRight, IconBraces, IconMarkdown } from "@tabler/icons-react";
import { DocsPageLayout } from "@/components/DocsPageLayout";
import { Button } from "@/components/ui/button";
import { DOCS_ARTICLES, DOCS_SITE_URL, docsUrl } from "@/lib/docs-content";

const PAGE_PATH = "/docs";
const PAGE_URL = docsUrl(PAGE_PATH);
const PAGE_TITLE = "Free design.md Docs: design.md, Markdown, and MDX Guides";
const PAGE_DESCRIPTION =
  "Short, answer-first guides to design.md, Markdown, MDX, and portable design-system documentation for AI-assisted product teams.";

export const links: LinksFunction = () => [
  { rel: "canonical", href: PAGE_URL },
];

export function meta() {
  return [
    { title: PAGE_TITLE },
    { name: "description", content: PAGE_DESCRIPTION },
    { name: "robots", content: "index,follow" },
    {
      name: "keywords",
      content:
        "design.md docs, what is MDX, Markdown vs MDX, MD vs MDX, design system documentation",
    },
    { property: "og:type", content: "website" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:url", content: PAGE_URL },
    { name: "twitter:title", content: PAGE_TITLE },
    { name: "twitter:description", content: PAGE_DESCRIPTION },
  ];
}

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${DOCS_SITE_URL}/#website`,
      name: "Free design.md",
      url: DOCS_SITE_URL,
    },
    {
      "@type": "CollectionPage",
      "@id": `${PAGE_URL}#collection`,
      url: PAGE_URL,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      isPartOf: {
        "@id": `${DOCS_SITE_URL}/#website`,
      },
      mainEntity: {
        "@id": `${PAGE_URL}#item-list`,
      },
    },
    {
      "@type": "ItemList",
      "@id": `${PAGE_URL}#item-list`,
      name: "Free design.md documentation articles",
      itemListElement: DOCS_ARTICLES.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        url: docsUrl(article.path),
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${PAGE_URL}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: DOCS_SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Docs",
          item: PAGE_URL,
        },
      ],
    },
  ],
};

export default function DocsIndexRoute() {
  return (
    <DocsPageLayout structuredData={STRUCTURED_DATA}>
      <section className="border-b border-border bg-muted/25">
        <div className="px-6 py-14 lg:py-16">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            free design.md
            <IconArrowRight size={14} />
          </Link>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold text-foreground sm:text-5xl">
            Docs for design.md, Markdown, and MDX
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            Short guides for teams using Markdown files as portable design
            context. Start with design.md, then compare plain Markdown and MDX
            for documentation, agents, and design-system workflows.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to="/docs/what-is-design-md">
                Start with design.md
                <IconArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">Create one from a URL</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Articles
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            Answer-first guides
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
            Each page targets one search intent with a direct answer, examples,
            internal links, and structured data for search and answer engines.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {DOCS_ARTICLES.map((article) => (
            <Link
              key={article.path}
              to={article.path}
              className="group rounded-lg border bg-background p-5 transition-colors hover:border-primary/50"
            >
              <div className="mb-5 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                {article.intent === "Comparison" ? (
                  <IconBraces size={20} />
                ) : (
                  <IconMarkdown size={20} />
                )}
              </div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                {article.intent}
              </p>
              <h3 className="mt-2 text-base font-semibold text-foreground">
                {article.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {article.summary}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                Read guide
                <IconArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </DocsPageLayout>
  );
}
