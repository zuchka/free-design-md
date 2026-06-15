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

const PAGE_PATH = "/docs/what-is-mdx";
const PAGE_URL = docsUrl(PAGE_PATH);
const PAGE_TITLE = "What Is MDX? Markdown + JSX Explained - Free design.md";
const PAGE_DESCRIPTION =
  "MDX is a content format that lets you write JSX components inside Markdown. Learn how MDX works, when to use it, and when plain Markdown is better.";

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
        "what is MDX, MDX, Markdown JSX, MDX documentation, Markdown components, MDX vs Markdown",
    },
    { property: "og:type", content: "article" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:url", content: PAGE_URL },
    { name: "twitter:title", content: PAGE_TITLE },
    { name: "twitter:description", content: PAGE_DESCRIPTION },
  ];
}

const BUILDING_BLOCKS = [
  {
    title: "Markdown prose",
    body: "Headings, paragraphs, lists, links, blockquotes, and code fences stay readable as text.",
  },
  {
    title: "JSX components",
    body: "MDX lets a page render imported UI components next to the written explanation.",
  },
  {
    title: "A build step",
    body: "MDX needs tooling that can compile the file into something a web app can render.",
  },
  {
    title: "Component props",
    body: "Authors can pass data into embedded components, such as examples, charts, or demos.",
  },
];

const USE_CASES = [
  {
    title: "Interactive documentation",
    body: "Use MDX when a docs page needs live examples, props tables, sandboxes, charts, tabs, or callouts backed by real components.",
  },
  {
    title: "Design-system websites",
    body: "MDX works well for publishing component guidance because prose and component previews can live in the same source file.",
  },
  {
    title: "Product education",
    body: "MDX can turn static docs into richer product pages without abandoning the writing workflow of Markdown.",
  },
];

const TRADEOFFS = [
  "MDX is less portable than plain Markdown because ordinary Markdown renderers do not understand JSX.",
  "MDX usually belongs in a web project with an MDX-aware build pipeline.",
  "MDX is powerful when the rendered page matters more than plain-text portability.",
];

const FAQS = [
  {
    question: "What is MDX?",
    answer:
      "MDX is a file format that combines Markdown with JSX, so writers can place UI components directly inside Markdown content.",
  },
  {
    question: "Is MDX the same as Markdown?",
    answer:
      "No. MDX includes normal Markdown syntax, but it also supports JSX expressions and components that plain Markdown parsers do not support.",
  },
  {
    question: "What does MDX stand for?",
    answer:
      "MDX is commonly understood as Markdown plus JSX. In practice, the name refers to the format and toolchain rather than a strict expanded acronym.",
  },
  {
    question: "When should you use MDX instead of Markdown?",
    answer:
      "Use MDX when the page needs interactive components, live examples, or reusable UI. Use plain Markdown when portability, simple editing, and agent-readable text matter most.",
  },
];

const EXAMPLE_MDX = `import { ColorSwatch } from "./ColorSwatch";

export const metadata = {
  title: "Brand colors"
};

# Brand colors

Use the primary color for calls to action.

<ColorSwatch name="Primary" value="#18b6f6" />

Plain Markdown explains the rule. The JSX component
renders the visual example.`;

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
      headline: "What Is MDX? Markdown + JSX Explained",
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
      about: ["MDX", "Markdown", "JSX", "documentation"],
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
          name: "What is MDX?",
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

export default function WhatIsMdxRoute() {
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
              <span>What is MDX?</span>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold text-foreground sm:text-5xl">
              What is MDX?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              MDX is Markdown that can render JSX components. It keeps the
              writing experience of Markdown, then adds a way to place
              interactive UI, live examples, charts, callouts, and design-system
              components inside the same content file.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/docs/markdown-vs-mdx">
                  Compare Markdown and MDX
                  <IconArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a
                  href="https://mdxjs.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Official MDX docs
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconMarkdown size={18} className="text-primary" />
                page.mdx
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Markdown + JSX
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border text-sm">
              {BUILDING_BLOCKS.map((item) => (
                <div key={item.title} className="bg-background p-4">
                  <div className="mb-3 flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconFileText size={16} />
                  </div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <SectionHeading eyebrow="Definition" title="The short answer">
          MDX is useful when a document should be both readable content and a
          rendered web page with real components. The tradeoff is that MDX needs
          build tooling, while ordinary Markdown can be opened, indexed, copied,
          versioned, and read almost anywhere.
        </SectionHeading>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {USE_CASES.map((item) => (
            <article key={item.title} className="rounded-lg border p-5">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-muted/25">
        <div className="grid gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionHeading
            eyebrow="How it works"
            title="What makes MDX different"
          >
            MDX starts with normal Markdown syntax, then allows JSX imports,
            exports, expressions, and components. That means an `.mdx` file can
            describe an idea and render the interface that proves it.
          </SectionHeading>

          <div className="grid gap-3">
            {[
              "Write normal Markdown for the durable prose and document structure.",
              "Import components from the surrounding web app or docs system.",
              "Place JSX components in the content where a live example should appear.",
              "Compile the MDX file before it can render in the browser.",
            ].map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-lg border bg-background p-4 text-sm leading-6"
              >
                <IconBraces className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <div>
          <SectionHeading eyebrow="Example" title="MDX mixes prose and UI">
            The Markdown remains readable, but the JSX component only works in
            an MDX-aware app. That is why MDX is strong for published docs
            websites and weaker as a universal interchange format.
          </SectionHeading>
          <div className="mt-8 grid gap-4">
            {TRADEOFFS.map((item) => (
              <article key={item} className="border-l-2 border-primary/60 pl-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  {item}
                </p>
              </article>
            ))}
          </div>
        </div>

        <pre className="max-h-[620px] overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
          <code>{EXAMPLE_MDX}</code>
        </pre>
      </section>

      <section id="faq" className="border-t border-border bg-muted/25">
        <div className="px-6 py-14">
          <SectionHeading eyebrow="FAQ" title="Common MDX questions">
            Short answers for teams choosing between Markdown, MDX, and portable
            design documentation.
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
              Use design.md when the design spec needs to stay portable.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-background/70">
              Free design.md turns a public URL into a plain Markdown design
              system spec that agents can read without a custom MDX renderer.
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
