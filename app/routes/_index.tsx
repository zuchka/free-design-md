import { useEffect, useMemo, useRef, useState } from "react";
import { appBasePath, sendToAgentChat, updateMcpAppModelContext, useBuilderConnectFlow } from "@agent-native/core/client";
import { renderPreview } from "../../shared/preview-template";
import { parseEnrichedFrontmatter } from "../../shared/parse-enriched-design-md";
import { renderEnrichedPreview } from "../../shared/render-enriched-showcase";
import type { DesignSystemData } from "../../shared/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconCheck,
  IconCopy,
  IconSparkles,
} from "@tabler/icons-react";
import BuilderConnectCta from "@/components/auth/BuilderConnectCta";
import { readCache, writeCache } from "@/lib/extraction-cache";
import SideBySideMemo from "@/components/SideBySideMemo";
import {
  getOrCreateSession,
  type IterationSession,
} from "@/lib/iteration-client";

export function meta() {
  return [
    { title: "Free design.md — extract a design system from any URL" },
    {
      name: "description",
      content:
        "Paste a URL. We headlessly load the page, capture its colors, fonts, and shapes, and render a portable design.md spec. Sign in to enrich it with Claude Opus 4.7.",
    },
  ];
}

export function HydrateFallback() {
  return (
    <div className="flex items-center justify-center h-screen w-full">
      <Spinner className="size-8 text-foreground" />
    </div>
  );
}

interface ExtractResult {
  url: string;
  markdown: string;
  designSystemData: DesignSystemData;
  signals?: { title?: string };
  screenshotDataUrl?: string;
}

interface EnrichResult {
  markdown: string;
  model: string;
  latencyMs: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  stopReason: string | null;
}

const LOADING_LABELS = [
  "Loading the page…",
  "Extracting tokens…",
  "Rendering preview…",
];

export default function IndexRoute() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [labelIndex, setLabelIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [enriched, setEnriched] = useState<EnrichResult | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [view, setView] = useState<"deterministic" | "enriched">("deterministic");
  const [streamingMarkdown, setStreamingMarkdown] = useState("");
  // Accumulates the full text of an in-progress enrichment so each state
  // update sets the COMPLETE text seen so far. This prevents the "catching
  // up" animation after the SSE stream closes — if React batches N delta
  // renders into one, that render shows the full text through delta N, not
  // just delta N's fragment.
  const streamAccumRef = useRef("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [screenshotHeight, setScreenshotHeight] = useState<number | null>(null);

  // Iteration state: separate from the enrichment SSE flow. A session
  // represents one extract→enrich→iterate chain keyed on the URL.
  const { configured } = useBuilderConnectFlow({
    trackingSource: "free_design_md_index",
  });
  const [iterSession, setIterSession] = useState<IterationSession | null>(null);

  useEffect(() => {
    if (enriched?.markdown && result?.url) {
      const s = getOrCreateSession(result.url, enriched.markdown);
      setIterSession(s);
    }
  }, [enriched?.markdown, result?.url]);

  useEffect(() => {
    if (!enriched?.markdown) return;
    updateMcpAppModelContext({
      content: [
        {
          type: "text",
          text:
            "The user has loaded this AI-enriched design.md. Treat it as the " +
            "current document. When the user asks to revise it, call the " +
            "iterate-design-md action.\n\n" +
            enriched.markdown,
        },
      ],
    });
  }, [enriched?.markdown]);

  useEffect(() => {
    if (!isLoading) return;
    setLabelIndex(0);
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % LOADING_LABELS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (!urlParam) return;
    const cached = readCache(urlParam);
    if (cached) {
      setUrl(cached.url);
      setResult(cached);
      if (cached.enrichedMarkdown) {
        setEnriched({
          markdown: cached.enrichedMarkdown,
          model: cached.enrichedModel ?? 'cached',
          latencyMs: 0,
          usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
          stopReason: 'end_turn',
        });
        setView('enriched');
      }
    } else {
      setUrl(urlParam);
      void extractUrl(urlParam);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const previewHtml = useMemo(() => {
    if (!result) return "";
    return renderPreview(result.designSystemData, {
      title: result.signals?.title,
      designMd: result.markdown,
    });
  }, [result]);

  const enrichedPreviewHtml = useMemo(() => {
    if (!enriched?.markdown) return null;
    const parsed = parseEnrichedFrontmatter(enriched.markdown);
    if (!parsed) return null;
    return renderEnrichedPreview(parsed, enriched.markdown, result?.signals?.title);
  }, [enriched?.markdown, result?.signals?.title]);

  const enrichedPreviewFailed = enriched !== null && enrichedPreviewHtml === null;

  async function extractUrl(trimmed: string) {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setEnriched(null);
    setEnrichError(null);
    setView("deterministic");
    setPreviewExpanded(false);
    setScreenshotHeight(null);
    try {
      const endpoint = `${appBasePath()}/api/extract?url=${encodeURIComponent(trimmed)}&format=json`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Request failed with ${res.status}`);
      }
      const data = (await res.json()) as ExtractResult;
      setResult(data);
      writeCache({ url: data.url, markdown: data.markdown, designSystemData: data.designSystemData, signals: data.signals, screenshotDataUrl: data.screenshotDataUrl });
      history.replaceState(null, '', `?url=${encodeURIComponent(data.url)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (trimmed) void extractUrl(trimmed);
  }

  async function handleEnrich() {
    if (!result) return;
    setIsEnriching(true);
    setEnrichError(null);
    setStreamingMarkdown("");
    streamAccumRef.current = "";
    setView("enriched");
    try {
      const endpoint = `${appBasePath()}/api/enrich-design-md`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          designSystemData: result.designSystemData,
          signals: result.signals,
          screenshotDataUrl: result.screenshotDataUrl,
          deterministicMarkdown: result.markdown,
        }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Enrich failed with ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by a blank line ("\n\n").
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const parsed = parseSSE(part);
          if (!parsed) continue;
          if (parsed.event === "delta") {
            const { text } = parsed.data as { text: string };
            streamAccumRef.current += text;
            setStreamingMarkdown(streamAccumRef.current);
          } else if (parsed.event === "done") {
            sawDone = true;
            const enrichResult = parsed.data as EnrichResult;
            setEnriched(enrichResult);
            sendToAgentChat({
              message:
                `Design enriched for **${result.url}**. ` +
                `The AI-enhanced design.md is now loaded in the preview. ` +
                `What would you like to refine? For example: "tighten the spacing scale", ` +
                `"make the brand voice more confident", or "soften the card radii".`,
              submit: true,
            });
            if (result) {
              writeCache({
                url: result.url,
                markdown: result.markdown,
                designSystemData: result.designSystemData,
                signals: result.signals,
                screenshotDataUrl: result.screenshotDataUrl,
                enrichedMarkdown: enrichResult.markdown,
                enrichedModel: enrichResult.model,
              });
            }
          } else if (parsed.event === "error") {
            const { message } = parsed.data as { message: string };
            throw new Error(message);
          }
        }
      }
      if (!sawDone) {
        throw new Error("Stream ended without a done event");
      }
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : String(err));
      // Fall back to the deterministic view if the stream blew up before
      // any content arrived. If we already have partial streaming text,
      // leave it visible so the user can see what they got.
      if (!streamingMarkdown) setView("deterministic");
    } finally {
      setIsEnriching(false);
    }
  }

  /**
   * Parse a single SSE event block of the form:
   *   event: <name>
   *   data: <json>
   * Whitespace-tolerant. Returns null when the block is malformed.
   */
  function parseSSE(
    block: string,
  ): { event: string; data: unknown } | null {
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

  const hasEnrichedContent = enriched !== null || streamingMarkdown.length > 0;
  const currentMarkdown =
    view === "enriched"
      ? enriched
        ? enriched.markdown
        : streamingMarkdown
      : result?.markdown ?? "";

  async function handleCopy() {
    if (!currentMarkdown) return;
    await navigator.clipboard.writeText(currentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Keep/Discard are wired to SideBySideMemo for historical diffs.
  // candidatePending is always false now (chat sidebar drives iteration),
  // so these buttons never render — but the prop contract still requires them.
  function handleKeep() {
    // no-op: candidatePending=false means buttons are hidden
  }
  function handleDiscard() {
    // no-op: candidatePending=false means buttons are hidden
  }

  const activePreviewHtml =
    view === "enriched" && enrichedPreviewHtml ? enrichedPreviewHtml : previewHtml;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Extract a design system from any URL
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Type a URL. We headlessly load the page, capture its colors,
            fonts, and shapes, and render a portable design.md spec. No
            sign-in required for the deterministic pass.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mb-10 flex flex-col gap-3 sm:flex-row"
        >
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="stripe.com"
            disabled={isLoading}
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={isLoading || !url.trim()}>
            {isLoading ? "Extracting…" : "Extract"}
          </Button>
        </form>

        {error && (
          <div
            className="mb-8 rounded-md border px-4 py-3 text-sm"
            style={{ borderColor: "rgba(239,68,68,0.25)", backgroundColor: "var(--intuit-error-bg)", color: "var(--intuit-error)" }}
          >
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Spinner className="size-8 text-foreground" />
            <div className="text-sm text-muted-foreground">
              {LOADING_LABELS[labelIndex]}
            </div>
          </div>
        )}

        {result && !isLoading && (
          <div className="flex flex-col gap-6">
            {!hasEnrichedContent && (
              <EnrichBanner
                isEnriching={isEnriching}
                hasScreenshot={!!result.screenshotDataUrl}
                configured={configured}
                onEnrich={handleEnrich}
              />
            )}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <Pane title="Real site" className="lg:flex-1 lg:min-w-0">
                {result.screenshotDataUrl ? (
                  <div className="overflow-hidden rounded-md border bg-muted/20" style={{ boxShadow: "var(--intuit-card-shadow)" }}>
                    <img
                      src={result.screenshotDataUrl}
                      alt={`Screenshot of ${result.url}`}
                      className="block w-full h-auto"
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
                  <div className="flex items-center gap-2">
                    {hasEnrichedContent && (
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
                          AI-enriched{isEnriching && !enriched ? "…" : ""}
                        </button>
                      </div>
                    )}
                    {!hasEnrichedContent && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEnrich}
                        disabled={isEnriching || !result.screenshotDataUrl || !configured}
                        title={
                          !configured
                            ? "Connect Builder.io to unlock AI enrichment"
                            : "Enrich with Claude Opus 4.7 (~30-60s)"
                        }
                      >
                        {isEnriching ? (
                          <Spinner className="size-3.5" />
                        ) : (
                          <IconSparkles size={14} />
                        )}
                        <span className="ml-1">
                          {isEnriching ? "Enriching…" : "Enrich with AI"}
                        </span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopy}
                      disabled={!currentMarkdown}
                    >
                      {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
                    </Button>
                  </div>
                }
              >
                {enrichError && (
                  <div
                    className="mb-2 rounded-md border px-3 py-2 text-xs"
                    style={{ borderColor: "rgba(239,68,68,0.25)", backgroundColor: "var(--intuit-error-bg)", color: "var(--intuit-error)" }}
                  >
                    {enrichError}
                  </div>
                )}
                <pre className="overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap" style={{ maxHeight: screenshotHeight ? `${screenshotHeight}px` : "600px" }}>
                  {currentMarkdown}
                </pre>
              </Pane>
            </div>

            {enriched?.markdown && iterSession && iterSession.previous && (
              <SideBySideMemo
                previous={iterSession.previous.markdown}
                next={iterSession.current.markdown}
                isStreaming={false}
                candidatePending={false}
                onKeep={handleKeep}
                onDiscard={handleDiscard}
              />
            )}

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
                  <div style={{ height: "900px" }}>
                    <iframe
                      srcDoc={activePreviewHtml}
                      title="Synthetic preview"
                      sandbox="allow-same-origin"
                      className="block h-full w-full"
                    />
                  </div>
                  {!previewExpanded && (
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
                  )}
                  {isEnriching && view === "enriched" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                      <Spinner className="size-6 text-foreground" />
                      <p className="text-sm text-muted-foreground">Enriching with AI…</p>
                    </div>
                  )}
                  {enrichedPreviewFailed && view === "enriched" && !isEnriching && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm">
                      <p className="text-sm font-medium">Enriched preview unavailable</p>
                      <p className="text-xs text-muted-foreground max-w-xs text-center">
                        The AI output didn't match the expected design token schema. The text view above has the full enriched content.
                      </p>
                    </div>
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
        )}
      </div>
    </div>
  );
}

interface EnrichBannerProps {
  isEnriching: boolean;
  hasScreenshot: boolean;
  configured: boolean;
  onEnrich: () => void;
}

function EnrichBanner({
  isEnriching,
  hasScreenshot,
  configured,
  onEnrich,
}: EnrichBannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border px-5 py-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(24,182,246,0.08) 0%, rgba(24,182,246,0.04) 60%, transparent 100%)",
        borderColor: "rgba(24,182,246,0.22)",
      }}
    >
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <p className="text-base font-semibold tracking-tight">
              Your design.md is a skeleton. AI enrichment makes it{" "}
              <span style={{ color: "var(--intuit-primary)" }}>
                10–15× more detailed.
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              The deterministic pass captures raw tokens — colors, fonts, radii.
              AI enrichment adds brand voice, component intent, spacing
              rationale, and accessibility notes. Powered by{" "}
              <span className="font-medium text-foreground">
                Claude Opus 4.7
              </span>
              .
            </p>
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              variant="default"
              onClick={onEnrich}
              disabled={isEnriching || !hasScreenshot || !configured}
              className="gap-2 border-0 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--intuit-primary)" }}
              title={!configured ? "Connect Builder.io to unlock AI enrichment" : undefined}
            >
              <IconSparkles size={18} />
              {isEnriching ? "Enriching…" : "Enrich with AI"}
            </Button>
          </div>
        </div>
        <BuilderConnectCta />
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
