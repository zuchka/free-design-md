import { Link } from "react-router";
import type { LinksFunction } from "react-router";
import type { ReactNode } from "react";
import {
  IconArrowRight,
  IconBraces,
  IconFileText,
  IconMarkdown,
  IconSearch,
} from "@tabler/icons-react";
import { DocsPageLayout } from "@/components/DocsPageLayout";
import { DocsRelatedArticles } from "@/components/DocsRelatedArticles";
import { Button } from "@/components/ui/button";
import { DOCS_SITE_URL, docsUrl } from "@/lib/docs-content";

const PAGE_PATH = "/docs/markdown-vs-mdx";
const PAGE_URL = docsUrl(PAGE_PATH);
const PAGE_TITLE =
  "Markdown vs MDX: Differences and When to Use Each - Free design.md";
const PAGE_DESCRIPTION =
  "Markdown is best for portable text docs; MDX adds JSX components for interactive content. Compare syntax, workflows, pros, cons, and use cases.";

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
        "Markdown vs MDX, MD vs MDX, Markdown compared to MDX, MDX vs Markdown, Markdown documentation",
    },
    { property: "og:type", content: "article" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:url", content: PAGE_URL },
    { name: "twitter:title", content: PAGE_TITLE },
    { name: "twitter:description", content: PAGE_DESCRIPTION },
  ];
}

const DIFFERENCES = [
  {
    label: "Best for",
    markdown: "Portable docs, specs, READMEs, prompts, and design.md files.",
    mdx: "Docs websites, component demos, interactive examples, and rich guides.",
  },
  {
    label: "Syntax",
    markdown:
      "Plain text formatting: headings, lists, links, code, and tables.",
    mdx: "Markdown plus JSX imports, exports, expressions, and components.",
  },
  {
    label: "Tooling",
    markdown:
      "Works in most editors, repos, chat tools, and documentation systems.",
    mdx: "Needs an MDX compiler and a compatible app or documentation framework.",
  },
  {
    label: "Portability",
    markdown: "Very high. The file stays useful even without a web build.",
    mdx: "Lower. JSX parts depend on the components and runtime around the file.",
  },
];

const DECISIONS = [
  {
    title: "Choose Markdown when",
    items: [
      "The file needs to be read by humans and agents without a custom renderer.",
      "The content belongs in Git, prompts, chat, docs, or code review.",
      "The main goal is a durable text artifact, not a rendered web experience.",
    ],
  },
  {
    title: "Choose MDX when",
    items: [
      "The page needs real UI components, live examples, tabs, charts, or demos.",
      "The content is part of a website with an MDX-aware build pipeline.",
      "The rendered page experience is more important than raw text portability.",
    ],
  },
];

const FAQS = [
  {
    question: "What is the difference between Markdown and MDX?",
    answer:
      "Markdown is a plain-text formatting syntax. MDX extends Markdown with JSX, so an `.mdx` file can render UI components inside the content.",
  },
  {
    question: "Is MD the same as Markdown?",
    answer:
      "Usually yes. `.md` is the common file extension for Markdown files, so MD vs MDX normally means Markdown files compared with MDX files.",
  },
  {
    question: "Is MDX better than Markdown?",
    answer:
      "MDX is better for interactive web docs. Markdown is better for portable text, simple editing, code review, prompts, and agent-readable documentation.",
  },
  {
    question: "Should design.md be Markdown or MDX?",
    answer:
      "A design.md should usually stay plain Markdown because the goal is portability. Agents, engineers, and designers can read the same file without needing a component runtime.",
  },
];

const MARKDOWN_EXAMPLE = `# Button

Use the primary button for the most important action.

- Background: #10b981
- Radius: 5px
- Padding: 12px 18px`;

const MDX_EXAMPLE = `import { ButtonPreview } from "./ButtonPreview";

# Button

Use the primary button for the most important action.

<ButtonPreview variant="primary" />`;

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
      "@type": "TechArticle",
      "@id": `${PAGE_URL}#article`,
      headline: "Markdown vs MDX: Differences and When to Use Each",
      description: PAGE_DESCRIPTION,
      mainEntityOfPage: `${PAGE_URL}#webpage`,
      author: {
        "@type": "Organization",
        name: "Free design.md",
      },
      publisher: {
        "@type": "Organization",
        name: "Free design.md",
      },
      about: ["Markdown", "MDX", "documentation", "design.md"],
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: FAQS.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
        },
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
          item: docsUrl("/docs"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Markdown vs MDX",
          item: PAGE_URL,
        },
      ],
    },
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      isPartOf: {
        "@id": `${DOCS_SITE_URL}/#website`,
      },
      mainEntity: {
        "@id": `${PAGE_URL}#article`,
      },
    },
  ],
};

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
        {children}
      </p>
    </div>
  );
}

export default function MarkdownVsMdxRoute() {
  return (
    <DocsPageLayout structuredData={STRUCTURED_DATA}>
      <section className="border-b border-border bg-muted/25">
        <div className="grid gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:py-16">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link
                to="/docs"
                className="transition-colors hover:text-foreground"
              >
                Docs
              </Link>
              <IconArrowRight size={14} />
              <span>Markdown vs MDX</span>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold text-foreground sm:text-5xl">
              Markdown vs MDX: differences and when to use each
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              Markdown is best for portable text documentation. MDX is best when
              a Markdown-like page also needs JSX components, live examples, or
              interactive UI. Use Markdown for durable specs like design.md; use
              MDX for component-rich docs websites.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/docs/what-is-mdx">
                  Read the MDX definition
                  <IconArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/docs/what-is-design-md">
                  Why design.md uses Markdown
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconBraces size={18} className="text-primary" />
                Quick answer
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                MD vs MDX
              </span>
            </div>
            <div className="grid gap-px bg-border text-sm">
              {[
                [
                  "Markdown",
                  "Portable text files that work almost everywhere.",
                ],
                ["MDX", "Markdown plus JSX components for rendered web pages."],
                [
                  "Rule of thumb",
                  "Choose Markdown for interchange. Choose MDX for interactive docs.",
                ],
              ].map(([label, body]) => (
                <div key={label} className="bg-background p-4">
                  <p className="font-medium">{label}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <SectionHeading eyebrow="Comparison" title="The practical difference">
          Markdown is a simple syntax for text documents. MDX is a superset-like
          authoring format that can include Markdown and JSX. The right choice
          depends on whether the raw file needs to stay portable or the rendered
          page needs to be interactive.
        </SectionHeading>

        <div className="mt-8 grid gap-4">
          {DIFFERENCES.map((item) => (
            <article
              key={item.label}
              className="grid gap-4 rounded-lg border p-5 md:grid-cols-[180px_1fr_1fr]"
            >
              <h3 className="text-sm font-semibold">{item.label}</h3>
              <div>
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                  <IconMarkdown size={14} />
                  Markdown
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.markdown}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                  <IconFileText size={14} />
                  MDX
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.mdx}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/25">
        <div className="grid gap-10 px-6 py-14 lg:grid-cols-2">
          {DECISIONS.map((group) => (
            <article
              key={group.title}
              className="rounded-lg border bg-background p-5"
            >
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <div className="mt-5 grid gap-3">
                {group.items.map((item) => (
                  <div
                    key={item}
                    className="flex gap-3 rounded-lg border bg-muted/25 p-4 text-sm leading-6"
                  >
                    <IconBraces className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid w-full min-w-0 gap-10 px-6 py-14 lg:grid-cols-2">
        <div className="min-w-0">
          <SectionHeading eyebrow="Syntax" title="Same idea, different file">
            Both examples describe a primary button. The Markdown version is
            plain text. The MDX version depends on a component import and a
            renderer that knows what `ButtonPreview` means.
          </SectionHeading>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
              button.md
            </p>
            <pre className="max-w-full overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
              <code>{MARKDOWN_EXAMPLE}</code>
            </pre>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary">
              button.mdx
            </p>
            <pre className="max-w-full overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
              <code>{MDX_EXAMPLE}</code>
            </pre>
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-border bg-muted/25">
        <div className="px-6 py-14">
          <SectionHeading eyebrow="FAQ" title="Markdown vs MDX questions">
            Short answers for searchers comparing `.md` and `.mdx` files for
            documentation, design systems, and AI workflows.
          </SectionHeading>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FAQS.map((faq) => (
              <article
                key={faq.question}
                className="rounded-lg border bg-background p-5"
              >
                <h3 className="text-sm font-semibold">{faq.question}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <DocsRelatedArticles currentPath={PAGE_PATH} />

      <section className="border-t border-border bg-foreground text-background">
        <div className="grid gap-8 px-6 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <IconSearch size={20} />
            </div>
            <h2 className="max-w-2xl text-2xl font-semibold">
              Free design.md creates portable Markdown design specs.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-background/70">
              Paste a URL and get a design.md file that can move through Git,
              chat, docs, pull requests, and agent workflows without needing an
              MDX runtime.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link to="/">
              Try the extractor
              <IconArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </DocsPageLayout>
  );
}
