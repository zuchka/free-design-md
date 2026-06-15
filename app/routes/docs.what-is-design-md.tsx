import { Link } from "react-router";
import type { LinksFunction } from "react-router";
import {
  IconArrowRight,
  IconBraces,
  IconFileText,
  IconMarkdown,
  IconSearch,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://free-design-md.agent-native.com";
const PAGE_PATH = "/docs/what-is-design-md";
const PAGE_URL = `${SITE_URL}${PAGE_PATH}`;
const PAGE_TITLE = "What is a design.md? - Free design.md";
const PAGE_DESCRIPTION =
  "A design.md is a portable Markdown design-system spec for agents: colors, typography, spacing, radii, components, voice, and usage rules in one readable file.";

export const links: LinksFunction = () => [
  { rel: "canonical", href: PAGE_URL },
];

export function meta() {
  return [
    { title: PAGE_TITLE },
    {
      name: "description",
      content: PAGE_DESCRIPTION,
    },
    { name: "robots", content: "index,follow" },
    {
      name: "keywords",
      content:
        "design.md, design md, design system documentation, AI design system, design tokens, agent-native design",
    },
    { property: "og:type", content: "article" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:url", content: PAGE_URL },
    { name: "twitter:title", content: PAGE_TITLE },
    { name: "twitter:description", content: PAGE_DESCRIPTION },
  ];
}

const CONTENTS = [
  "Brand foundations",
  "Design tokens",
  "Components",
  "Usage rules",
];

const USE_CASES = [
  {
    title: "Give agents reliable design context",
    body: "Instead of asking an agent to infer a brand from a logo or screenshot, hand it a structured spec it can read before writing UI code.",
  },
  {
    title: "Move design systems between tools",
    body: "Markdown travels through Git, chat, docs, pull requests, and agent workflows without locking the team into one vendor format.",
  },
  {
    title: "Create a fast source of truth",
    body: "A design.md is small enough to review, edit, version, and paste, but structured enough to preserve the decisions that matter.",
  },
];

const COMPARISONS = [
  {
    label: "Screenshot",
    contrast:
      "Shows what a page looked like, but not why it works or how to rebuild it.",
  },
  {
    label: "Token JSON",
    contrast:
      "Great for machines, but usually missing voice, composition, component behavior, and do/don't guidance.",
  },
  {
    label: "Figma file",
    contrast:
      "Useful for designers, but harder for coding agents to consume as compact implementation context.",
  },
  {
    label: "Style guide",
    contrast:
      "Helpful for humans, but often too prose-heavy and inconsistent for repeatable agent output.",
  },
];

const FAQS = [
  {
    question: "What is a design.md?",
    answer:
      "A design.md is a Markdown design-system spec that gives humans and AI agents the practical details needed to recreate a brand's UI: tokens, typography, spacing, components, and usage guidance.",
  },
  {
    question: "Is a design.md the same as design tokens?",
    answer:
      "No. Design tokens are part of a design.md, but a design.md also explains component patterns, layout rules, brand voice, examples, and do's and don'ts.",
  },
  {
    question: "Why use Markdown for design system documentation?",
    answer:
      "Markdown is portable, versionable, readable in code review, and easy for AI agents to consume as implementation context.",
  },
  {
    question: "How do you create a design.md?",
    answer:
      "You can write one manually from an existing design system, or use Free design.md to extract one from a public URL and optionally enrich it with AI.",
  },
];

const EXAMPLE_MARKDOWN = `---
name: Acme Design System
source: https://example.com
---

# Acme Design System

## Colors
- primary: #18b6f6
- text: #111111

## Typography
- display: Poppins, 48px, 700
- body: Poppins, 16px, 400

## Components
### button-primary
- background: primary
- radius: 5px
- padding: 12px 18px

## Do's and Don'ts
- Do use sharp contrast and direct copy.
- Don't soften corners beyond the brand radius.`;

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Free design.md",
      url: SITE_URL,
    },
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: "What is a design.md?",
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
      about: [
        "design.md",
        "design system documentation",
        "AI design context",
        "design tokens",
      ],
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
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
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
  children: React.ReactNode;
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

export default function WhatIsDesignMdRoute() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(STRUCTURED_DATA),
        }}
      />
      <section className="border-b border-border bg-muted/25">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center lg:py-16">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              free design.md
              <IconArrowRight size={14} />
            </Link>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold text-foreground sm:text-5xl">
              What is a design.md?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              A design.md is a portable Markdown spec that explains a brand's
              visual system to humans and AI agents. It captures the colors,
              typography, spacing, radii, components, and usage rules needed to
              recreate a product's UI with consistency.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/">
                  Create one from a URL
                  <IconArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/quality">See extraction quality</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconMarkdown size={18} className="text-primary" />
                design.md
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                Agent-readable
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border text-sm">
              {CONTENTS.map((item) => (
                <div key={item} className="bg-background p-4">
                  <div className="mb-3 size-8 rounded-md bg-primary/10 text-primary">
                    <IconFileText size={16} className="m-2" />
                  </div>
                  <p className="font-medium">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        <SectionHeading eyebrow="Definition" title="The short version">
          A design.md turns a website's observed design system into a structured
          Markdown artifact. It is not just documentation and it is not only a
          token dump. It is implementation context for the next agent, engineer,
          or designer who needs to build something in the same visual language.
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
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionHeading eyebrow="Contents" title="What belongs in the file">
            The best design.md files combine deterministic evidence with
            designer-readable judgment. They name reusable pieces, preserve
            measurements, and explain when to use each pattern.
          </SectionHeading>

          <div className="grid gap-3">
            {[
              "Color tokens with roles, hex values, and contrast intent.",
              "Typography scales, weights, line heights, and font families.",
              "Spacing, border radius, elevation, layout rhythm, and density.",
              "Components such as buttons, cards, nav, forms, badges, and hero patterns.",
              "Brand voice, composition rules, accessibility notes, and do/don't guidance.",
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

      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(360px,520px)]">
        <div>
          <SectionHeading eyebrow="Example" title="A design.md is plain text">
            Because it is Markdown, a design.md can live in a repo, travel in a
            prompt, sit beside app code, or become the brief for an AI builder.
            The structure is compact enough for agents, but readable enough for
            product teams.
          </SectionHeading>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {COMPARISONS.map((item) => (
              <article
                key={item.label}
                className="border-l-2 border-primary/60 pl-4"
              >
                <h3 className="text-sm font-semibold">
                  Not just a {item.label.toLowerCase()}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.contrast}
                </p>
              </article>
            ))}
          </div>
        </div>

        <pre className="max-h-[620px] overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
          <code>{EXAMPLE_MARKDOWN}</code>
        </pre>
      </section>

      <section id="faq" className="border-t border-border bg-muted/25">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <SectionHeading eyebrow="FAQ" title="Common design.md questions">
            Short answers for teams evaluating design.md as a portable design
            system format for AI-assisted product work.
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

      <section className="border-t border-border bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <IconSearch size={20} />
            </div>
            <h2 className="max-w-2xl text-2xl font-semibold">
              Free design.md creates a design.md from any public URL.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-background/70">
              We load the page in headless Chromium, extract computed CSS and
              page signals, render a deterministic Markdown file, and optionally
              enrich it with AI using the screenshot and captured design data.
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
    </main>
  );
}
