import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { appBasePath, updateMcpAppModelContext } from "@agent-native/core/client";
import { IconCheck, IconCopy, IconExternalLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { renderPreview } from "../../shared/preview-template";
import { parseEnrichedFrontmatter } from "../../shared/parse-enriched-design-md";
import { renderEnrichedPreview } from "../../shared/render-enriched-showcase";
import type { DesignSystemData } from "../../shared/api";

interface PublicSavedEnrichment {
  id: string;
  sourceUrl: string;
  title: string;
  deterministicMarkdown: string;
  enrichedMarkdown: string;
  designSystemData: DesignSystemData;
  signals?: { title?: string };
  screenshotDataUrl: string | null;
  model: string;
  usage: unknown;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function meta() {
  return [
    { title: "Shared design.md — Free design.md" },
    {
      name: "description",
      content: "A public AI-enriched design.md snapshot.",
    },
  ];
}

export default function SavedDesignRoute() {
  const { id } = useParams();
  const [saved, setSaved] = useState<PublicSavedEnrichment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"enriched" | "deterministic">("enriched");
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [screenshotHeight, setScreenshotHeight] = useState<number | null>(null);
  const markdownPreRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!id) return;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${appBasePath()}/api/saved-enrichments/${encodeURIComponent(id!)}`,
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Saved design failed with ${res.status}`);
        }
        setSaved((await res.json()) as PublicSavedEnrichment);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [id]);

  useEffect(() => {
    if (!saved?.enrichedMarkdown) return;
    updateMcpAppModelContext({
      content: [
        {
          type: "text",
          text:
            `The user is viewing a public AI-enriched design.md for ${saved.sourceUrl}. ` +
            "Use this markdown as the current design context.\n\n" +
            saved.enrichedMarkdown,
        },
      ],
    });
  }, [saved]);

  const deterministicPreviewHtml = useMemo(() => {
    if (!saved) return "";
    try {
      return renderPreview(saved.designSystemData, {
        title: saved.signals?.title ?? saved.title,
        designMd: saved.deterministicMarkdown,
      });
    } catch {
      return "";
    }
  }, [saved]);

  const enrichedPreviewHtml = useMemo(() => {
    if (!saved?.enrichedMarkdown) return null;
    try {
      const parsed = parseEnrichedFrontmatter(saved.enrichedMarkdown);
      if (!parsed) return null;
      return renderEnrichedPreview(parsed, saved.enrichedMarkdown, saved.title);
    } catch {
      return null;
    }
  }, [saved]);

  const currentMarkdown =
    view === "enriched"
      ? saved?.enrichedMarkdown ?? ""
      : saved?.deterministicMarkdown ?? "";
  const activePreviewHtml =
    view === "enriched" && enrichedPreviewHtml
      ? enrichedPreviewHtml
      : deterministicPreviewHtml;
  const previewAvailable = activePreviewHtml.length > 0;

  async function copyMarkdown() {
    if (!currentMarkdown) return;
    await navigator.clipboard.writeText(currentMarkdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 1500);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8 text-foreground" />
      </div>
    );
  }

  if (error || !saved) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Saved design not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This public link may have been deleted or mistyped.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Public design.md
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">
              {saved.title}
            </h1>
            <a
              href={saved.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              <span className="truncate">{saved.sourceUrl}</span>
              <IconExternalLink size={14} />
            </a>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={copyLink}>
              {copiedLink ? <IconCheck size={14} /> : <IconExternalLink size={14} />}
              <span className="ml-1">{copiedLink ? "Copied" : "Share"}</span>
            </Button>
            <Button variant="outline" onClick={copyMarkdown}>
              {copiedMarkdown ? <IconCheck size={14} /> : <IconCopy size={14} />}
              <span className="ml-1">
                {copiedMarkdown ? "Copied" : "Copy design.md"}
              </span>
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Pane title="Real site" className="lg:flex-1 lg:min-w-0">
              {saved.screenshotDataUrl ? (
                <div className="overflow-hidden rounded-md border bg-muted/20" style={{ boxShadow: "var(--intuit-card-shadow)" }}>
                  <img
                    src={saved.screenshotDataUrl}
                    alt={`Screenshot of ${saved.sourceUrl}`}
                    className="block h-auto w-full"
                    onLoad={(e) => setScreenshotHeight(e.currentTarget.offsetHeight)}
                  />
                </div>
              ) : (
                <div className="rounded-md border bg-muted/40 p-6 text-sm text-muted-foreground">
                  Screenshot unavailable.
                </div>
              )}
            </Pane>

            <Pane
              title="design.md"
              className="lg:flex-1 lg:min-w-0"
              action={
                <div className="flex rounded-md border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setView("deterministic")}
                    className={`whitespace-nowrap px-2 py-1 transition-colors ${view === "deterministic" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                    style={view === "deterministic" ? { backgroundColor: "var(--intuit-primary)" } : undefined}
                  >
                    Deterministic
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("enriched")}
                    className={`whitespace-nowrap px-2 py-1 transition-colors ${view === "enriched" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                    style={view === "enriched" ? { backgroundColor: "var(--intuit-primary)" } : undefined}
                  >
                    AI-enriched
                  </button>
                </div>
              }
            >
              <pre ref={markdownPreRef} className="overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap" style={{ maxHeight: screenshotHeight ? `${screenshotHeight}px` : "600px" }}>
                {currentMarkdown}
              </pre>
            </Pane>
          </div>

          <Pane
            title="Preview from tokens"
            action={
              view === "enriched" && enrichedPreviewHtml ? (
                <span className="text-xs text-muted-foreground">AI-enriched</span>
              ) : undefined
            }
          >
            <div className="rounded-md border overflow-hidden" style={{ boxShadow: "var(--intuit-card-shadow)" }}>
              <div
                className="relative overflow-hidden"
                style={{ height: previewExpanded ? "900px" : "260px", transition: "height 0.3s ease" }}
              >
                {previewAvailable ? (
                  <div style={{ height: "900px" }}>
                    <iframe
                      srcDoc={activePreviewHtml}
                      title="Synthetic preview"
                      sandbox="allow-same-origin"
                      className="block h-full w-full"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                    Preview unavailable for this saved design.
                  </div>
                )}
                {!previewExpanded && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
                )}
              </div>
              <div className="flex justify-center border-t py-2">
                <button
                  type="button"
                  onClick={() => setPreviewExpanded((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  {previewExpanded ? "Collapse preview ↑" : "Expand full preview ↓"}
                </button>
              </div>
            </div>
          </Pane>
        </div>
      </div>
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
    <section className={`flex flex-col gap-2${className ? ` ${className}` : ""}`}>
      <div className="flex h-9 items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
