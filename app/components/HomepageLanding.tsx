import { Link } from "react-router";
import { IconArrowRight, IconRocket } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InstallSkillButton from "@/components/InstallSkillButton";
import {
  ExampleCardGrid,
  ExampleColorSwatches,
  ExampleLogoMark,
} from "@/components/ExampleLibrary";
import type { ExampleDesignArtifact } from "@/lib/example-library";

interface HomepageLandingProps {
  url: string;
  isLoading: boolean;
  examples: ExampleDesignArtifact[];
  onUrlChange: (url: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSampleSelect: (url: string) => void;
}

export default function HomepageLanding({
  url,
  isLoading,
  examples,
  onUrlChange,
  onSubmit,
  onSampleSelect,
}: HomepageLandingProps) {
  const samples = examples.filter((example) =>
    ["stripe", "apple", "shopify"].includes(example.slug),
  );
  return (
    <div className="flex flex-col gap-10 pb-10">
      <section className="grid gap-8 py-4 min-[1800px]:grid-cols-[minmax(0,1fr)_420px] min-[1800px]:items-start">
        <div className="min-w-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-secondary/60 px-4 py-2 text-sm font-medium text-muted-foreground">
            <IconRocket size={16} />
            Free deterministic extraction. Optional AI enrichment.
          </div>
          <h1 className="max-w-none text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Turn any public website into a portable design.md
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Paste a URL to capture colors, typography, spacing, radii,
            components, and a token preview. Then export the artifact for
            agents, docs, repos, or local workflows.
          </p>

          <div className="mt-7 max-w-4xl">
            <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
              <label htmlFor="homepage-url" className="text-sm font-medium">
                Website URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  id="homepage-url"
                  value={url}
                  onChange={(event) => onUrlChange(event.target.value)}
                  placeholder="stripe.com"
                  aria-label="Website URL"
                  required
                  disabled={isLoading}
                  className="h-11 min-w-0 flex-1 bg-background"
                  autoFocus
                />
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="shrink-0"
                >
                  {isLoading ? "Extracting..." : "Extract design.md"}
                </Button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Try</span>
              {samples.map((example) => (
                <button
                  key={example.slug}
                  type="button"
                  onClick={() => onSampleSelect(example.sourceUrl)}
                  className="rounded-sm py-1 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:min-h-11"
                >
                  {example.title}
                </button>
              ))}
              <Link
                to="/examples"
                className="ml-auto inline-flex items-center gap-1 rounded-sm py-1 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 pointer-coarse:min-h-11"
              >
                Browse library
                <IconArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <InstallSkillButton />
          </div>
        </div>

        <PopularExamplesPanel examples={examples.slice(0, 6)} />
      </section>

      <section className="flex flex-col gap-5 rounded-md border bg-secondary/25 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-text">
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
        <ExampleCardGrid examples={examples} mutedCards />
      </section>

      <footer className="border-t py-8">
        <div className="flex flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              to="/"
              className="inline-flex text-base font-semibold text-foreground"
              aria-label="free design.md home"
            >
              free design<span className="text-brand-text">.md</span>
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
              Advanced usage
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

function PopularExamplesPanel({
  examples,
}: {
  examples: ExampleDesignArtifact[];
}) {
  return (
    <aside className="hidden rounded-md border bg-secondary/25 p-4 min-[1800px]:block">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-text">
            Popular examples
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            Browse ready-made design.md files.
          </h2>
        </div>
        <Link
          to="/examples"
          className="shrink-0 text-sm font-medium text-brand-text hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="mt-4 grid gap-1">
        {examples.map((example) => (
          <Link
            key={example.slug}
            to={`/examples/${example.slug}`}
            className="group flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-background"
          >
            <span className="flex min-w-0 items-center gap-3">
              <ExampleLogoMark example={example} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {example.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {example.domain}
                </span>
              </span>
            </span>
            <span className="hidden shrink-0 sm:block">
              <ExampleColorSwatches example={example} />
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
