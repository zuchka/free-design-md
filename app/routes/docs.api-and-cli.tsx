import { Link } from "react-router";
import type { LinksFunction } from "react-router";
import type { ReactNode } from "react";
import {
  IconArrowRight,
  IconBrandDocker,
  IconCode,
  IconKey,
  IconShieldCheck,
  IconTerminal2,
} from "@tabler/icons-react";
import { DocsPageLayout } from "@/components/DocsPageLayout";
import { DocsRelatedArticles } from "@/components/DocsRelatedArticles";
import { Button } from "@/components/ui/button";
import { DOCS_SITE_URL, docsUrl } from "@/lib/docs-content";

const PAGE_PATH = "/docs/api-and-cli";
const PAGE_URL = docsUrl(PAGE_PATH);
const PAGE_TITLE = "Free design.md API and CLI: Extract design.md from a URL";
const PAGE_DESCRIPTION =
  "Use Free design.md from HTTP APIs, the command line, or the public Docker image. Learn keyless hosted extraction, hosted AI credits, local Anthropic environment keys, SSE responses, and CLI actions.";

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
        "design.md API, design.md CLI, extract design.md API, AI design system API, self-host design.md, Docker design.md, free design.md Docker image",
    },
    { property: "og:type", content: "article" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:url", content: PAGE_URL },
    { name: "twitter:title", content: PAGE_TITLE },
    { name: "twitter:description", content: PAGE_DESCRIPTION },
  ];
}

const HTTP_EXAMPLE = `# Hosted deterministic extraction: no Anthropic key required.
curl "https://free-design-md.agent-native.com/api/extract?url=https://stripe.com&format=json" \\
  -o extract.json`;

const LOCAL_EXAMPLE = `# Deterministic extraction from a local checkout.
pnpm action extract-design-md --url stripe.com

# For AI enrichment, load ANTHROPIC_API_KEY into your local environment first.
pnpm action enrich-design-md \\
  --url stripe.com \\
  --designSystemData '<json from extract>' \\
  --signals '<json from extract>' \\
  --screenshotDataUrl '<data URL from extract>' \\
  --deterministicMarkdown '<markdown from extract>'`;

const SELF_HOST_EXAMPLE = `# Local UI / self-host mode.
# Load ANTHROPIC_API_KEY into this environment first.
FREE_DESIGN_MD_SELF_HOSTED=1 pnpm dev`;

const DOCKER_EXAMPLE = `# Pull the public image from GitHub Container Registry.
docker pull ghcr.io/zuchka/free-design-md:latest

# Load ANTHROPIC_API_KEY into your shell or secret manager first.
docker run --rm \\
  -p 3000:3000 \\
  -e FREE_DESIGN_MD_SELF_HOSTED=1 \\
  -e ANTHROPIC_API_KEY \\
  -e DATABASE_URL=file:./data/app.db \\
  -v free-design-md-data:/app/data \\
  ghcr.io/zuchka/free-design-md:latest`;

const DOCKER_BUILD_EXAMPLE = `# Optional: build locally from a repository checkout.
docker build -t free-design-md:local .`;

const API_SURFACE = [
  {
    method: "GET",
    path: "/api/extract?url=...&format=json",
    key: "No Anthropic key",
    body: "Loads the URL in headless Chromium and returns deterministic design.md, designSystemData, page signals, and a screenshot data URL.",
  },
  {
    method: "POST",
    path: "/api/enrich-design-md",
    key: "Hosted credits",
    body: "Streams an AI-enriched design.md as Server-Sent Events. Hosted Free design.md uses its own server key and credits; it rejects user-supplied Anthropic keys.",
  },
  {
    method: "POST",
    path: "/api/iterate-design-md",
    key: "Hosted credits",
    body: "Streams a revised design.md from previousMarkdown and userPrompt. The hosted route uses Builder-connected credits, not user Anthropic keys.",
  },
];

const KEY_RULES = [
  "Deterministic extraction does not call an LLM and does not need an Anthropic key.",
  "Hosted AI enrichment runs on Free design.md credits and the deployment's server key.",
  "The hosted service does not accept or store user Anthropic keys.",
  "Use your own Anthropic key only in a local checkout or self-hosted deployment via ANTHROPIC_API_KEY.",
];

const FAQS = [
  {
    question: "Can I use Free design.md without the browser UI?",
    answer:
      "Yes. Use GET /api/extract for deterministic extraction, or run pnpm action extract-design-md from a local checkout.",
  },
  {
    question: "Does basic design.md extraction require an API key?",
    answer:
      "No. The deterministic extractor does not use AI, so it does not require an Anthropic key.",
  },
  {
    question: "How do I use my own Anthropic key?",
    answer:
      "Run Free design.md locally or in your own self-hosted deployment and set ANTHROPIC_API_KEY in that environment.",
  },
  {
    question: "Can I send my Anthropic key to the hosted API?",
    answer:
      "No. The hosted API rejects user-supplied Anthropic keys. Hosted AI runs through Free design.md credits.",
  },
  {
    question: "Is there a Brew package or desktop binary?",
    answer:
      "Not yet. A packaged local app is a future distribution path; today's packaged local path is the public Docker image.",
  },
  {
    question: "How do I download, install, and run Free design.md with Docker?",
    answer:
      "Pull ghcr.io/zuchka/free-design-md:latest, run it with FREE_DESIGN_MD_SELF_HOSTED=1 and ANTHROPIC_API_KEY, then open http://localhost:3000.",
  },
  {
    question: "Which operating systems can run the Docker image?",
    answer:
      "The public image is published for Linux amd64 and arm64. Docker pulls the matching image on Docker Desktop for macOS and Windows and Docker Engine on Linux.",
  },
];

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
      headline: PAGE_TITLE,
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
      about: ["design.md API", "CLI", "Docker", "self-hosted AI tools"],
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
          name: "API and CLI",
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

export default function ApiAndCliRoute() {
  return (
    <DocsPageLayout structuredData={STRUCTURED_DATA}>
      <section className="border-b border-border bg-muted/25">
        <div className="grid min-w-0 gap-10 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:py-16">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link
                to="/docs"
                className="transition-colors hover:text-foreground"
              >
                Docs
              </Link>
              <IconArrowRight size={14} />
              <span>API and CLI</span>
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold text-foreground sm:text-5xl">
              Free design.md API and CLI
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
              You can use Free design.md without the browser UI. The
              deterministic extractor works over HTTP and CLI with no AI key.
              Hosted AI enrichment runs on Free design.md credits, while local
              Docker and self-hosted deployments can use your own environment
              key.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="#http-api">
                  See HTTP examples
                  <IconArrowRight size={16} />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#cli">See CLI examples</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#docker">Run with Docker</a>
              </Button>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IconKey size={18} className="text-primary" />
                Hosted key policy
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                No user keys
              </span>
            </div>
            <div className="grid gap-px bg-border text-sm">
              {KEY_RULES.map((item) => (
                <div key={item} className="bg-background p-4">
                  <p className="leading-6 text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <SectionHeading eyebrow="API surface" title="What the hosted API does">
          The hosted API exposes keyless extraction and credit-backed AI routes.
          It does not accept user Anthropic keys in headers, bodies, or stored
          browser settings.
        </SectionHeading>

        <div className="mt-8 grid gap-4">
          {API_SURFACE.map((item) => (
            <article
              key={item.path}
              className="grid min-w-0 gap-4 rounded-lg border p-5 md:grid-cols-[110px_minmax(220px,0.8fr)_minmax(0,1fr)]"
            >
              <p className="text-sm font-semibold text-primary">
                {item.method}
              </p>
              <div className="min-w-0">
                <p className="break-all font-mono text-sm font-semibold">
                  {item.path}
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-primary">
                  {item.key}
                </p>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="http-api" className="border-y border-border bg-muted/25">
        <div className="grid min-w-0 gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <SectionHeading eyebrow="HTTP" title="Hosted extraction is keyless">
            Use the hosted API for deterministic design.md extraction. Hosted AI
            routes are available through the web app's Builder-connected credit
            flow, not by sending your Anthropic key to Free design.md.
          </SectionHeading>

          <pre className="min-w-0 overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
            <code>{HTTP_EXAMPLE}</code>
          </pre>
        </div>
      </section>

      <section
        id="cli"
        className="grid min-w-0 gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]"
      >
        <div>
          <SectionHeading eyebrow="CLI" title="Use your key locally">
            The action layer is the same core surface the UI wraps. In local or
            private deployments, set ANTHROPIC_API_KEY in the environment so the
            key never passes through the hosted Free design.md service.
          </SectionHeading>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Extraction",
                body: "Calls Playwright and returns deterministic JSON. No LLM and no key.",
                icon: IconTerminal2,
              },
              {
                title: "Enrichment",
                body: "Calls Anthropic with the extraction payload and returns the final enriched design.md.",
                icon: IconCode,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border p-5">
                  <Icon size={20} className="text-primary" />
                  <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </div>

        <pre className="min-w-0 overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
          <code>{LOCAL_EXAMPLE}</code>
        </pre>
      </section>

      <section className="border-t border-border bg-muted/25">
        <div className="grid min-w-0 gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <SectionHeading
            eyebrow="Self-host"
            title="Run private AI behind your own key"
          >
            Self-host mode is explicit. It uses ANTHROPIC_API_KEY from the
            deployment environment and does not spend hosted Free design.md
            credits. Packaged binaries and Homebrew installs are a future
            distribution path, not something this branch promises.
          </SectionHeading>

          <pre className="min-w-0 overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
            <code>{SELF_HOST_EXAMPLE}</code>
          </pre>
        </div>
      </section>

      <section id="docker" className="border-t border-border bg-background">
        <div className="grid min-w-0 gap-10 px-6 py-14 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div>
            <SectionHeading
              eyebrow="Docker"
              title="Download and run locally with Docker"
            >
              Pull the public image from GitHub Container Registry and run the
              local UI on port 3000. The latest tag publishes Linux amd64 and
              arm64 images, so Docker pulls the matching image on macOS,
              Windows, and Linux developer machines.
            </SectionHeading>
            <a
              href="https://github.com/zuchka/free-design-md/pkgs/container/free-design-md"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View the GHCR package
            </a>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "Public GHCR image",
                  body: "Install from ghcr.io/zuchka/free-design-md:latest without cloning the repository.",
                  icon: IconShieldCheck,
                },
                {
                  title: "Persistent SQLite",
                  body: "Mount /app/data so the local SQLite database survives container restarts.",
                  icon: IconBrandDocker,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border p-5">
                    <Icon size={20} className="text-primary" />
                    <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {item.body}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="min-w-0">
            <pre className="min-w-0 overflow-auto rounded-lg border bg-[#111111] p-5 text-xs leading-6 text-white shadow-sm">
              <code>{DOCKER_EXAMPLE}</code>
            </pre>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              After the container starts, open http://localhost:3000. The
              command passes the ANTHROPIC_API_KEY variable name to Docker, not
              the key value; if the variable is missing, self-host mode returns
              a setup error.
            </p>
            <pre className="mt-4 min-w-0 overflow-auto rounded-lg border bg-muted p-4 text-xs leading-6 text-muted-foreground">
              <code>{DOCKER_BUILD_EXAMPLE}</code>
            </pre>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Build locally only when you are developing from a checkout or need
              to test unreleased changes.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-border bg-muted/25">
        <div className="px-6 py-14">
          <SectionHeading eyebrow="FAQ" title="API and CLI questions">
            Short answers for developers using Free design.md in scripts,
            agents, CI jobs, and local tooling.
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
              <IconShieldCheck size={20} />
            </div>
            <h2 className="max-w-2xl text-2xl font-semibold">
              The hosted service does not accept your Anthropic key.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-background/70">
              Hosted AI uses Free design.md credits. Local and self-hosted
              runtimes use your own environment, where your key stays under your
              control.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link to="/docs/what-is-design-md">
              Read about design.md
              <IconArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </section>
    </DocsPageLayout>
  );
}
