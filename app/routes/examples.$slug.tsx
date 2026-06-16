import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { IconArrowLeft, IconExternalLink } from "@tabler/icons-react";
import ArtifactActions from "@/components/ArtifactActions";
import TokenPreviewFrame from "@/components/TokenPreviewFrame";
import {
  ExampleColorSwatches,
  ExampleLogoMark,
} from "@/components/ExampleLibrary";
import { Button } from "@/components/ui/button";
import { getExampleDesignBySlug } from "@/lib/example-library";
import { designArtifactToMdx } from "../../shared/design-mdx";
import { parseEnrichedFrontmatter } from "../../shared/parse-enriched-design-md";
import { renderEnrichedPreview } from "../../shared/render-enriched-showcase";
import { renderPreview } from "../../shared/preview-template";

export function meta() {
  return [
    { title: "Example design.md artifact — Free design.md" },
    {
      name: "description",
      content:
        "View a curated deterministic and AI-enriched design.md example with token preview, Markdown export, HTML export, and MDX export.",
    },
  ];
}

export default function ExampleDetailRoute() {
  const { slug } = useParams();
  const example = getExampleDesignBySlug(slug);
  const [view, setView] = useState<"deterministic" | "enriched">("enriched");

  const deterministicPreviewHtml = useMemo(() => {
    if (!example) return "";
    try {
      return renderPreview(example.data, {
        title: example.title,
        designMd: example.markdown,
      });
    } catch {
      return "";
    }
  }, [example]);

  const enrichedPreviewHtml = useMemo(() => {
    if (!example?.enrichedMarkdown) return null;
    try {
      const parsed = parseEnrichedFrontmatter(example.enrichedMarkdown);
      if (!parsed) return null;
      return renderEnrichedPreview(
        parsed,
        example.enrichedMarkdown,
        example.title,
      );
    } catch {
      return null;
    }
  }, [example]);

  if (!example) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/examples"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          <IconArrowLeft size={15} />
          Back to examples
        </Link>
        <h1 className="mt-6 text-2xl font-semibold">
          Example design not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This curated example may have moved or the URL may be mistyped.
        </p>
      </main>
    );
  }

  const currentMarkdown =
    view === "enriched" ? example.enrichedMarkdown : example.markdown;
  const currentPreviewHtml =
    view === "enriched" && enrichedPreviewHtml
      ? enrichedPreviewHtml
      : deterministicPreviewHtml;
  const artifactVariant =
    view === "enriched" ? "AI-enriched example" : "Deterministic example";
  const artifactMdx = designArtifactToMdx({
    title: example.title,
    sourceUrl: example.sourceUrl,
    variant: artifactVariant,
    markdown: currentMarkdown,
    previewHtml: currentPreviewHtml,
  });
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <Link
              to="/examples"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              <IconArrowLeft size={15} />
              Examples
            </Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Example design.md
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
              {example.title} design.md
            </h1>
            <a
              href={example.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              <span className="truncate">{example.sourceUrl}</span>
              <IconExternalLink size={14} />
            </a>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline">
              <Link to={`/?url=${encodeURIComponent(example.sourceUrl)}`}>
                Generate fresh version
              </Link>
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Pane title="Source site" className="lg:min-w-0 lg:flex-1">
              <div
                className="rounded-md border bg-muted/20 p-5"
                style={{ boxShadow: "var(--intuit-card-shadow)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <ExampleLogoMark example={example} size="lg" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {example.category}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                        {example.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {example.domain}
                      </p>
                    </div>
                  </div>
                  <ExampleColorSwatches example={example} />
                </div>

                <dl className="mt-6 grid gap-4 text-sm">
                  <div>
                    <dt className="font-semibold text-foreground">
                      Extracted pattern
                    </dt>
                    <dd className="mt-1 leading-6 text-muted-foreground">
                      {example.description}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Best for</dt>
                    <dd className="mt-1 leading-6 text-muted-foreground">
                      {example.bestFor}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-foreground">Source</dt>
                    <dd className="mt-1">
                      <a
                        href={example.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground no-underline hover:text-foreground"
                      >
                        {example.sourceUrl}
                        <IconExternalLink size={14} />
                      </a>
                    </dd>
                  </div>
                </dl>
              </div>
            </Pane>

            <Pane
              title="design.md"
              className="lg:min-w-0 lg:flex-1"
              action={
                <div className="flex items-center gap-2">
                  <OutputToggle view={view} onViewChange={setView} />
                  <ArtifactActions
                    markdown={currentMarkdown}
                    html={currentPreviewHtml}
                    mdx={artifactMdx}
                    baseFilename={`${example.title}-${view}`}
                  />
                </div>
              }
            >
              <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                {currentMarkdown}
              </pre>
            </Pane>
          </div>

          <Pane
            title="Preview from tokens"
            action={
              <span className="text-xs text-muted-foreground">
                {view === "enriched" ? "AI-enriched" : "Deterministic"}
              </span>
            }
          >
            <div
              className="overflow-hidden rounded-md border"
              style={{ boxShadow: "var(--intuit-card-shadow)" }}
            >
              <div className="relative overflow-hidden">
                <TokenPreviewFrame
                  html={currentPreviewHtml}
                  title={`${example.title} synthetic preview`}
                  unavailableMessage="Preview unavailable for this curated example."
                  minHeight={320}
                />
              </div>
            </div>
          </Pane>

          <section className="rounded-md border bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
            This independent example is based on publicly observable design
            signals from {example.domain}. Brand marks are shown only to
            identify the source site. No affiliation, sponsorship, or
            endorsement is implied.
          </section>
        </div>
      </div>
    </main>
  );
}

function OutputToggle({
  view,
  onViewChange,
}: {
  view: "deterministic" | "enriched";
  onViewChange: (view: "deterministic" | "enriched") => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border text-xs">
      <button
        type="button"
        onClick={() => onViewChange("deterministic")}
        className={`whitespace-nowrap px-2 py-1 transition-colors ${
          view === "deterministic"
            ? "text-white"
            : "bg-transparent text-muted-foreground"
        }`}
        style={
          view === "deterministic"
            ? { backgroundColor: "var(--intuit-primary)" }
            : undefined
        }
      >
        Deterministic
      </button>
      <button
        type="button"
        onClick={() => onViewChange("enriched")}
        className={`whitespace-nowrap px-2 py-1 transition-colors ${
          view === "enriched"
            ? "text-white"
            : "bg-transparent text-muted-foreground"
        }`}
        style={
          view === "enriched"
            ? { backgroundColor: "var(--intuit-primary)" }
            : undefined
        }
      >
        AI-enriched
      </button>
    </div>
  );
}

interface PaneProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Pane({ title, action, children, className }: PaneProps) {
  return (
    <section
      className={`flex flex-col gap-2${className ? ` ${className}` : ""}`}
    >
      <div className="flex h-9 items-center justify-between gap-3">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
