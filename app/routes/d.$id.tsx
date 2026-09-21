import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { appBasePath } from "@/lib/base-path";
import {
  IconCheck,
  IconExternalLink,
  IconGitBranch,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import CreditsRecoveryBanner from "@/components/CreditsRecoveryBanner";
import SideBySideMemo from "@/components/SideBySideMemo";
import ArtifactActions from "@/components/ArtifactActions";
import TokenPreviewFrame from "@/components/TokenPreviewFrame";
import {
  classifyAiAccessErrorMessage,
  readAiAccessErrorResponse,
  type AiAccessRecoveryReason,
} from "@/lib/ai-access-errors";
import { recordDesignArtifactEvent } from "@/lib/design-artifact-events";
import { renderPreview } from "../../shared/preview-template";
import { designArtifactToMdx } from "../../shared/design-mdx";
import {
  extractSectionList,
  parseEnrichedFrontmatter,
} from "../../shared/parse-enriched-design-md";
import { renderEnrichedPreview } from "../../shared/render-enriched-showcase";
import type { DesignSystemData } from "../../shared/api";

interface PublicSavedEnrichment {
  id: string;
  sourceUrl: string;
  title: string;
  parentId: string | null;
  rootId: string | null;
  iterationPrompt: string | null;
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

function formatSectionLabel(section: string): string {
  const knownLabels: Record<string, string> = {
    "do-s-and-don-ts": "Do's and Don'ts",
    "elevation-depth": "Elevation & Depth",
    "border-radii": "Border Radii",
  };
  if (knownLabels[section]) return knownLabels[section];
  return section
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function SavedDesignRoute() {
  const { id } = useParams();
  const [saved, setSaved] = useState<PublicSavedEnrichment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"enriched" | "deterministic">("enriched");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [screenshotHeight, setScreenshotHeight] = useState<number | null>(null);
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [iterationSectionTarget, setIterationSectionTarget] = useState("");
  const [isIterating, setIsIterating] = useState(false);
  const [iterationError, setIterationError] = useState<string | null>(null);
  const [iterationRecoveryReason, setIterationRecoveryReason] =
    useState<AiAccessRecoveryReason | null>(null);
  const [candidateMarkdown, setCandidateMarkdown] = useState("");
  const [candidateSavedUrl, setCandidateSavedUrl] = useState<string | null>(
    null,
  );
  const [previewSource, setPreviewSource] = useState<"current" | "candidate">(
    "current",
  );
  const markdownPreRef = useRef<HTMLPreElement>(null);
  const streamAccumRef = useRef("");
  const iterationDeltaAnnouncedRef = useRef(false);

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

  const candidatePreviewHtml = useMemo(() => {
    if (!candidateMarkdown) return null;
    try {
      const parsed = parseEnrichedFrontmatter(candidateMarkdown);
      if (!parsed) return null;
      return renderEnrichedPreview(parsed, candidateMarkdown, saved?.title);
    } catch {
      return null;
    }
  }, [candidateMarkdown, saved?.title]);

  const currentMarkdown =
    view === "enriched"
      ? (saved?.enrichedMarkdown ?? "")
      : (saved?.deterministicMarkdown ?? "");
  const currentPreviewHtml =
    view === "enriched" && enrichedPreviewHtml
      ? enrichedPreviewHtml
      : deterministicPreviewHtml;
  const activePreviewHtml =
    previewSource === "candidate"
      ? (candidatePreviewHtml ?? "")
      : currentPreviewHtml;
  const activePreviewLabel =
    previewSource === "candidate"
      ? "Candidate"
      : view === "enriched"
        ? "AI-enriched"
        : "Deterministic";
  const artifactPreviewHtml = currentPreviewHtml;
  const artifactVariant = view === "enriched" ? "AI-enriched" : "Deterministic";
  const artifactMdx = useMemo(() => {
    if (!currentMarkdown || !saved) return "";
    return designArtifactToMdx({
      title: saved.signals?.title ?? saved.title,
      sourceUrl: saved.sourceUrl,
      variant: artifactVariant,
      markdown: currentMarkdown,
      previewHtml: artifactPreviewHtml,
    });
  }, [artifactPreviewHtml, artifactVariant, currentMarkdown, saved]);
  const candidatePreviewFailed =
    previewSource === "candidate" &&
    candidateMarkdown.length > 0 &&
    candidatePreviewHtml === null;
  const hasCandidateComparison = isIterating || candidateMarkdown.length > 0;
  const iterationSectionOptions = useMemo(
    () => extractSectionList(saved?.enrichedMarkdown ?? ""),
    [saved?.enrichedMarkdown],
  );

  useEffect(() => {
    if (
      iterationSectionTarget &&
      !iterationSectionOptions.includes(iterationSectionTarget)
    ) {
      setIterationSectionTarget("");
    }
  }, [iterationSectionOptions, iterationSectionTarget]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    recordDesignArtifactEvent({
      action: "share_link_copy",
      source: "saved_design",
      variant: "enriched",
      format: "link",
    });
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1500);
  }

  async function copyCliCommand() {
    if (!saved) return;
    await navigator.clipboard.writeText(`npx free-design-md add ${saved.id}`);
    recordDesignArtifactEvent({
      action: "share_link_copy",
      source: "saved_design",
      variant: "enriched",
      format: "cli",
    });
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1500);
  }

  async function iterateSavedDesign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || !iterationPrompt.trim() || isIterating) return;

    setIsIterating(true);
    setIterationError(null);
    setIterationRecoveryReason(null);
    setCandidateMarkdown("");
    setCandidateSavedUrl(null);
    setPreviewSource("candidate");
    streamAccumRef.current = "";
    iterationDeltaAnnouncedRef.current = false;

    try {
      const res = await fetch(
        `${appBasePath()}/api/saved-enrichments/${encodeURIComponent(saved.id)}/iterate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userPrompt: iterationPrompt.trim(),
            sectionTarget: iterationSectionTarget || undefined,
          }),
        },
      );
      if (!res.ok || !res.body) {
        const details = await readAiAccessErrorResponse(
          res,
          `Iteration failed with ${res.status}`,
        );
        setIterationRecoveryReason(details.recoveryReason);
        throw new Error(details.message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const parsed = parseSSE(part);
          if (!parsed) continue;
          if (parsed.event === "delta") {
            const { text } = parsed.data as { text: string };
            streamAccumRef.current += text;
            setCandidateMarkdown(streamAccumRef.current);
            if (!iterationDeltaAnnouncedRef.current) {
              iterationDeltaAnnouncedRef.current = true;
            }
          } else if (parsed.event === "done") {
            sawDone = true;
            const doneData = parsed.data as {
              markdown: string;
              savedDesignUrl: string;
            };
            setCandidateMarkdown(doneData.markdown);
            setCandidateSavedUrl(doneData.savedDesignUrl);
          } else if (parsed.event === "error") {
            const { message } = parsed.data as { message: string };
            throw new Error(message);
          }
        }
      }
      if (!sawDone) throw new Error("Stream ended without a done event");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setIterationError(message);
      setIterationRecoveryReason(
        (current) => current ?? classifyAiAccessErrorMessage(message),
      );
      setCandidateMarkdown("");
      setCandidateSavedUrl(null);
      setPreviewSource("current");
    } finally {
      setIsIterating(false);
    }
  }

  function keepCandidate() {
    if (!candidateSavedUrl) return;
    window.location.href = `${appBasePath()}${candidateSavedUrl}`;
  }

  function discardCandidate() {
    setCandidateMarkdown("");
    setCandidateSavedUrl(null);
    setIterationError(null);
    setIterationRecoveryReason(null);
    setPreviewSource("current");
  }

  function parseSSE(block: string): { event: string; data: unknown } | null {
    let eventName = "";
    let dataLine = "";
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("event:")) eventName = trimmed.slice(6).trim();
      else if (trimmed.startsWith("data:")) dataLine = trimmed.slice(5).trim();
    }
    if (!eventName || !dataLine) return null;
    try {
      return { event: eventName, data: JSON.parse(dataLine) };
    } catch {
      return null;
    }
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
          <div className="flex shrink-0 flex-col items-stretch gap-2 md:items-end">
            <Button variant="outline" onClick={copyLink}>
              {copiedLink ? (
                <IconCheck size={14} />
              ) : (
                <IconExternalLink size={14} />
              )}
              <span className="ml-1">{copiedLink ? "Copied" : "Share"}</span>
            </Button>
            <button
              type="button"
              onClick={copyCliCommand}
              className="group inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Copy CLI command"
            >
              <span>npx free-design-md add {saved.id}</span>
              {copiedCli ? (
                <IconCheck size={12} />
              ) : (
                <IconExternalLink size={12} />
              )}
              <span className="sr-only">
                {copiedCli ? "Copied" : "Copy CLI command"}
              </span>
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <Pane title="Real site" className="lg:flex-1 lg:min-w-0">
              {saved.screenshotDataUrl ? (
                <div
                  className="overflow-hidden rounded-md border bg-muted/20"
                  style={{ boxShadow: "var(--intuit-card-shadow)" }}
                >
                  <img
                    src={saved.screenshotDataUrl}
                    alt={`Screenshot of ${saved.sourceUrl}`}
                    className="block h-auto w-full"
                    onLoad={(e) =>
                      setScreenshotHeight(e.currentTarget.offsetHeight)
                    }
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
                <div className="flex items-center gap-2">
                  <div className="flex rounded-md border overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setView("deterministic")}
                      className={`whitespace-nowrap px-2 py-1 transition-colors ${view === "deterministic" ? "text-white" : "bg-transparent text-muted-foreground"}`}
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
                      onClick={() => setView("enriched")}
                      className={`whitespace-nowrap px-2 py-1 transition-colors ${view === "enriched" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                      style={
                        view === "enriched"
                          ? { backgroundColor: "var(--intuit-primary)" }
                          : undefined
                      }
                    >
                      AI-enriched
                    </button>
                  </div>
                  <ArtifactActions
                    markdown={currentMarkdown}
                    html={artifactPreviewHtml}
                    mdx={artifactMdx}
                    baseFilename={saved.title}
                    tracking={{ source: "saved_design", variant: view }}
                  />
                </div>
              }
            >
              <pre
                ref={markdownPreRef}
                className="overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap"
                style={{
                  maxHeight: screenshotHeight
                    ? `${screenshotHeight}px`
                    : "600px",
                }}
              >
                {currentMarkdown}
              </pre>
            </Pane>
          </div>

          <section className="rounded-md border bg-background p-4">
            <form onSubmit={iterateSavedDesign} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="iteration-prompt"
                    className="text-sm font-semibold tracking-tight"
                  >
                    Ask for a change
                  </label>
                  <textarea
                    id="iteration-prompt"
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    placeholder="Make this a polished dark mode, keeping the brand voice intact."
                    rows={3}
                    className="mt-2 min-h-24 w-full resize-y rounded-md border bg-background px-3 py-2 text-sm leading-6 outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                    disabled={isIterating}
                  />
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 lg:w-56">
                  {iterationSectionOptions.length > 0 && (
                    <div className="w-full">
                      <label
                        htmlFor="iteration-scope"
                        className="text-sm font-semibold tracking-tight"
                      >
                        Scope
                      </label>
                      <select
                        id="iteration-scope"
                        value={iterationSectionTarget}
                        onChange={(e) =>
                          setIterationSectionTarget(e.target.value)
                        }
                        disabled={isIterating}
                        className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
                      >
                        <option value="">Whole document</option>
                        {iterationSectionOptions.map((section) => (
                          <option key={section} value={section}>
                            {formatSectionLabel(section)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {(candidateMarkdown || iterationError) && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={discardCandidate}
                        disabled={isIterating}
                      >
                        <IconX size={14} />
                        <span className="ml-1">Clear</span>
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="w-full justify-center"
                      disabled={isIterating || !iterationPrompt.trim()}
                    >
                      {isIterating ? (
                        <Spinner className="size-4" />
                      ) : (
                        <IconSparkles size={16} />
                      )}
                      <span className="ml-1">
                        {isIterating ? "Iterating..." : "Create version"}
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
              {iterationRecoveryReason && (
                <CreditsRecoveryBanner
                  reason={iterationRecoveryReason}
                  onResolved={() => {
                    setIterationError(null);
                    setIterationRecoveryReason(null);
                  }}
                />
              )}
              {iterationError && !iterationRecoveryReason && (
                <div
                  className="rounded-md border px-3 py-2 text-xs"
                  style={{
                    borderColor: "rgba(239,68,68,0.25)",
                    backgroundColor: "var(--intuit-error-bg)",
                    color: "var(--intuit-error)",
                  }}
                >
                  {iterationError}
                </div>
              )}
              {candidateSavedUrl && (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconGitBranch
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="truncate text-muted-foreground">
                      New public version saved at {candidateSavedUrl}
                    </span>
                  </div>
                  <Button size="sm" onClick={keepCandidate}>
                    Open new version
                  </Button>
                </div>
              )}
            </form>
          </section>

          {hasCandidateComparison && saved && (
            <SideBySideMemo
              previous={saved.enrichedMarkdown}
              next={candidateMarkdown}
              isStreaming={isIterating}
              candidatePending={!isIterating && !!candidateSavedUrl}
              onKeep={keepCandidate}
              onDiscard={discardCandidate}
            />
          )}

          <Pane
            title="Preview from tokens"
            action={
              <div className="flex items-center gap-2">
                {hasCandidateComparison && (
                  <div className="flex overflow-hidden rounded-md border text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewSource("current")}
                      className={`whitespace-nowrap px-2 py-1 transition-colors ${previewSource === "current" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                      style={
                        previewSource === "current"
                          ? { backgroundColor: "var(--intuit-primary)" }
                          : undefined
                      }
                    >
                      Current
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewSource("candidate")}
                      className={`whitespace-nowrap px-2 py-1 transition-colors ${previewSource === "candidate" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                      style={
                        previewSource === "candidate"
                          ? { backgroundColor: "var(--intuit-primary)" }
                          : undefined
                      }
                    >
                      Candidate{isIterating ? "…" : ""}
                    </button>
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  {activePreviewLabel}
                </span>
              </div>
            }
          >
            <div
              className="rounded-md border overflow-hidden"
              style={{ boxShadow: "var(--intuit-card-shadow)" }}
            >
              <div className="relative overflow-hidden">
                <TokenPreviewFrame
                  html={activePreviewHtml}
                  title="Synthetic preview"
                  unavailableMessage="Preview unavailable for this saved design."
                  minHeight={260}
                />
                {isIterating && previewSource === "candidate" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                    <Spinner className="size-6 text-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Rendering candidate preview…
                    </p>
                  </div>
                )}
                {candidatePreviewFailed && !isIterating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm">
                    <p className="text-sm font-medium">
                      Candidate preview unavailable
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs text-center">
                      The candidate output doesn't match the expected design
                      token schema yet. The comparison above has the full
                      candidate content.
                    </p>
                  </div>
                )}
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
    <section
      className={`flex flex-col gap-2${className ? ` ${className}` : ""}`}
    >
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
