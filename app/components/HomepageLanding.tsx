import { useState } from "react";
import { Link } from "react-router";
import {
  IconApi,
  IconBrandDocker,
  IconBraces,
  IconCheck,
  IconCopy,
  IconFileCode,
  IconFileTypeHtml,
  IconRocket,
  IconMarkdown,
  IconSparkles,
  IconTerminal2,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExampleCardGrid } from "@/components/ExampleLibrary";
import type { ExampleDesignArtifact } from "@/lib/example-library";

interface HomepageLandingProps {
  url: string;
  isLoading: boolean;
  examples: ExampleDesignArtifact[];
  onUrlChange: (url: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSampleSelect: (url: string) => void;
}

const CODE_SNIPPETS = [
  {
    id: "http",
    label: "HTTP",
    icon: IconApi,
    code: 'curl "https://free-design-md.agent-native.com/api/extract?url=https://stripe.com&format=json"',
  },
  {
    id: "cli",
    label: "CLI",
    icon: IconTerminal2,
    code: "pnpm action extract-design-md --url stripe.com",
  },
  {
    id: "docker",
    label: "Docker",
    icon: IconBrandDocker,
    code:
      "docker run --rm -p 3000:3000 -e FREE_DESIGN_MD_SELF_HOSTED=1 -e ANTHROPIC_API_KEY ghcr.io/zuchka/free-design-md:latest",
  },
];

const WORKFLOW_STEPS = [
  "Paste URL",
  "Extract tokens",
  "Enrich with AI",
  "Export Markdown, HTML, or MDX",
  "Use in an agent",
];

const HERO_DETAIL_CARDS = [
  {
    title: "Structured tokens",
    body: "Colors, type, spacing, radii, and component anatomy in one Markdown file.",
  },
  {
    title: "Agent context",
    body: "Portable design instructions that can move through chat, Git, docs, and local tools.",
  },
  {
    title: "Export-ready",
    body: "Download Markdown, HTML, or MDX without changing the live preview path.",
  },
];

const PROOF_CARDS = [
  {
    title: "Any public URL",
    body: "Generate a fresh deterministic artifact instead of waiting for a static catalog to cover the brand.",
  },
  {
    title: "API-ready",
    body: "Hosted extraction is keyless, and the same path works from scripts and agent workflows.",
  },
  {
    title: "Docker/self-host",
    body: "Run your own local environment and keep Anthropic keys in server environment variables.",
  },
  {
    title: "MDX export",
    body: "Download Markdown, HTML, or MDX when the design spec needs to travel into docs or a repo.",
  },
  {
    title: "Quality report",
    body: "Compare the generated output against known design.md references before adopting it in a workflow.",
  },
];

export default function HomepageLanding({
  url,
  isLoading,
  examples,
  onUrlChange,
  onSubmit,
  onSampleSelect,
}: HomepageLandingProps) {
  return (
    <div className="flex flex-col gap-10">
      <section className="grid gap-8 py-4 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <IconRocket size={14} />
            Free deterministic extraction. Optional AI enrichment.
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Turn any public website into a portable design.md.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Paste a URL to capture colors, typography, spacing, radii,
            components, and a token preview. Then export the artifact for
            agents, docs, repos, or local workflows.
          </p>

          <form
            onSubmit={onSubmit}
            className="mt-7 flex flex-col gap-3 rounded-md border bg-background p-3 shadow-sm sm:flex-row"
          >
            <Input
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="stripe.com"
              disabled={isLoading}
              className="h-11 flex-1 border-0 bg-secondary/50 shadow-none focus-visible:ring-1"
              autoFocus
            />
            <Button
              type="submit"
              size="lg"
              disabled={isLoading || !url.trim()}
              className="shrink-0"
            >
              {isLoading ? "Extracting..." : "Extract design.md"}
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Try
            </span>
            {examples.slice(0, 5).map((example) => (
              <button
                key={example.slug}
                type="button"
                onClick={() => onSampleSelect(example.sourceUrl)}
                className="rounded-full border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
              >
                {example.title}
              </button>
            ))}
            <Link
              to="/examples"
              className="rounded-full border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Browse library
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/docs/api-and-cli">API and CLI docs</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/quality">See quality report</Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {HERO_DETAIL_CARDS.map((card) => (
              <div key={card.title} className="rounded-md border bg-muted/25 p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  {card.title}
                </h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {card.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <ArtifactPreviewPanel />
      </section>

      <section className="rounded-md border bg-muted/25 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-5">
          {WORKFLOW_STEPS.map((step, index) => (
            <div
              key={step}
              className="flex min-h-24 flex-col justify-between rounded-md border bg-background p-4 sm:min-h-28"
            >
              <span className="text-xs font-semibold text-primary">
                0{index + 1}
              </span>
              <span className="mt-4 text-sm font-semibold text-foreground">
                {step}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-md border bg-background p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Use it from code
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            The browser UI is only one entry point.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Hosted extraction does not need an Anthropic key. Local and
            self-hosted AI flows keep keys in environment variables instead of
            request bodies.
          </p>
          <Link
            to="/docs/api-and-cli"
            className="mt-5 inline-flex text-sm font-medium text-primary hover:underline"
          >
            Read the API and Docker guide
          </Link>
        </div>
        <div className="grid gap-3">
          {CODE_SNIPPETS.map((snippet) => (
            <CopyCodeBlock key={snippet.id} snippet={snippet} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-md border bg-background p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Free example library
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Start from curated design.md artifacts.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Each example includes deterministic and AI-enriched design.md
              views, seeded from public websites and shown with a small
              source-site mark for identification. Generate a fresh version any
              time from the source URL.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/examples">View all examples</Link>
          </Button>
        </div>
        <ExampleCardGrid examples={examples.slice(0, 4)} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {PROOF_CARDS.map((card) => (
          <div key={card.title} className="rounded-md border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {card.body}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

function ArtifactPreviewPanel() {
  return (
    <aside className="rounded-md border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <IconFileCode size={16} className="text-primary" />
          Artifact preview
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconSparkles size={14} />
          Agent-ready
        </div>
      </div>
      <div className="grid gap-4 p-4">
        <div className="rounded-md border bg-muted/35 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              design.md
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Portable spec
            </span>
          </div>
          <pre className="overflow-hidden text-xs leading-6 text-muted-foreground">
{`---
name: Stripe
colors:
  primary: "#635BFF"
typography:
  heading-1:
    fontFamily: Inter
---

## Components
- Button radius: 18px
- Card shadow: soft depth`}
          </pre>
        </div>

        <div className="rounded-md border p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Token preview
          </div>
          <div className="flex gap-2">
            {["#635BFF", "#0A2540", "#00D4FF", "#FFFFFF"].map((color) => (
              <span
                key={color}
                className="h-9 flex-1 rounded-md border"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="mt-4 rounded-md bg-[#F6F9FC] p-4">
            <div className="text-xl font-semibold text-[#0A2540]">
              Checkout components
            </div>
            <p className="mt-2 text-sm text-[#425466]">
              Extracted tokens render a synthetic UI preview before export.
            </p>
            <button
              type="button"
              className="mt-4 rounded-full bg-[#635BFF] px-4 py-2 text-sm font-semibold text-white"
            >
              Primary action
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <ExportBadge icon={IconMarkdown} label="Markdown" />
          <ExportBadge icon={IconFileTypeHtml} label="HTML" />
          <ExportBadge icon={IconBraces} label="MDX" />
        </div>
      </div>
    </aside>
  );
}

function ExportBadge({
  icon: Icon,
  label,
}: {
  icon: typeof IconMarkdown;
  label: string;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-md border bg-secondary/50 px-2 py-2 font-medium">
      <Icon size={15} className="text-primary" />
      <span>{label}</span>
    </div>
  );
}

function CopyCodeBlock({
  snippet,
}: {
  snippet: (typeof CODE_SNIPPETS)[number];
}) {
  const [copied, setCopied] = useState(false);
  const Icon = snippet.icon;

  async function copyCode() {
    await navigator.clipboard?.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon size={16} className="text-primary" />
          {snippet.label}
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={`Copy ${snippet.label} example`}
        >
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-6 text-muted-foreground">
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
}
