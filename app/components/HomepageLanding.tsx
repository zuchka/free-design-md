import { useState } from "react";
import { Link } from "react-router";
import {
  IconApi,
  IconBrandDocker,
  IconCheck,
  IconCopy,
  IconRocket,
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
    <div className="flex flex-col gap-10 pb-10">
      <section className="py-4">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-secondary/60 px-4 py-2 text-sm font-medium text-muted-foreground">
          <IconRocket size={16} />
          Free deterministic extraction. Optional AI enrichment.
        </div>
        <h1 className="max-w-none text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Turn any public website into a portable design.md.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          Paste a URL to capture colors, typography, spacing, radii, components,
          and a token preview. Then export the artifact for agents, docs, repos,
          or local workflows.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-7 flex max-w-4xl flex-col gap-3 rounded-md border bg-background p-3 shadow-sm sm:flex-row"
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
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Try
          </span>
          {examples.slice(0, 5).map((example) => (
            <button
              key={example.slug}
              type="button"
              onClick={() => onSampleSelect(example.sourceUrl)}
              className="rounded-full border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-secondary"
            >
              {example.title}
            </button>
          ))}
          <Link
            to="/examples"
            className="rounded-full border border-primary/30 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Browse library
          </Link>
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
        <ExampleCardGrid examples={examples} />
      </section>

      <section className="grid min-w-0 gap-6 rounded-md border bg-background p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
        <div className="min-w-0">
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
        <div className="grid min-w-0 gap-3">
          {CODE_SNIPPETS.map((snippet) => (
            <CopyCodeBlock key={snippet.id} snippet={snippet} />
          ))}
        </div>
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

      <footer className="border-t py-8">
        <div className="flex flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              to="/"
              className="inline-flex text-base font-semibold text-foreground"
              aria-label="free design.md home"
            >
              free design<span className="text-primary">.md</span>
            </Link>
            <p className="mt-2 max-w-xl leading-6">
              Portable design system artifacts for agents, docs, repos, and
              local workflows.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium"
          >
            <Link to="/examples" className="hover:text-foreground">
              Examples
            </Link>
            <Link to="/docs" className="hover:text-foreground">
              Docs
            </Link>
            <Link to="/docs/api-and-cli" className="hover:text-foreground">
              API and Docker
            </Link>
            <Link to="/quality" className="hover:text-foreground">
              Quality
            </Link>
          </nav>
        </div>
      </footer>
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
    <div className="min-w-0 overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Icon size={16} className="text-primary" />
          <span className="truncate">{snippet.label}</span>
        </div>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={`Copy ${snippet.label} example`}
        >
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="w-full overflow-x-auto p-3 text-xs leading-6 text-muted-foreground">
        <code>{snippet.code}</code>
      </pre>
    </div>
  );
}
