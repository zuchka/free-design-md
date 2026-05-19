import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { appBasePath } from "@agent-native/core/client";
import { renderPreview } from "../../shared/preview-template";
import type { DesignSystemData } from "../../shared/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconLock,
  IconSparkles,
} from "@tabler/icons-react";
import { consumeQuota, useAuth } from "@/lib/auth";
import SignInModal from "@/components/auth/SignInModal";
import AccountChip from "@/components/auth/AccountChip";

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
  const [signInOpen, setSignInOpen] = useState(false);
  const { user, remaining } = useAuth();
  const builderSpaceUrl = import.meta.env.VITE_BUILDER_SPACE_URL as
    | string
    | undefined;

  useEffect(() => {
    if (!isLoading) return;
    setLabelIndex(0);
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % LOADING_LABELS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  const previewHtml = useMemo(() => {
    if (!result) return "";
    return renderPreview(result.designSystemData, {
      title: result.signals?.title,
    });
  }, [result]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setEnriched(null);
    setEnrichError(null);
    setView("deterministic");
    try {
      const endpoint = `${appBasePath()}/api/extract?url=${encodeURIComponent(trimmed)}&format=json`;
      const res = await fetch(endpoint);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `Request failed with ${res.status}`);
      }
      const data = (await res.json()) as ExtractResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleEnrich() {
    if (!result) return;
    if (!user) {
      setSignInOpen(true);
      return;
    }
    if (remaining <= 0) {
      setEnrichError("Out of free AI enrichments. Upgrade to keep going.");
      return;
    }
    setIsEnriching(true);
    setEnrichError(null);
    setStreamingMarkdown("");
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
            setStreamingMarkdown((m) => m + text);
          } else if (parsed.event === "done") {
            sawDone = true;
            setEnriched(parsed.data as EnrichResult);
            // Charge the quota only when enrichment completed end-to-end.
            consumeQuota();
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-6 flex items-start justify-between gap-4">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight">
              Extract a design system from any URL
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Type a URL. We headlessly load the page, capture its colors,
              fonts, and shapes, and render a portable design.md spec. No
              sign-in required for the deterministic pass.
            </p>
          </header>
          <div className="flex items-center gap-3">
            <Link
              to="/quality"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Quality
            </Link>
            <AccountChip />
          </div>
        </div>

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
          <div className="mb-8 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
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
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <Pane title="Real site" className="lg:flex-1 lg:min-w-0">
                {result.screenshotDataUrl ? (
                  <div className="max-h-[560px] overflow-auto rounded-md border bg-muted/20">
                    <img
                      src={result.screenshotDataUrl}
                      alt={`Screenshot of ${result.url}`}
                      className="block w-full h-auto"
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
                          className={`px-2 py-1 ${view === "deterministic" ? "bg-foreground text-background" : "bg-transparent text-muted-foreground"}`}
                        >
                          Deterministic
                        </button>
                        <button
                          type="button"
                          onClick={() => setView("enriched")}
                          className={`px-2 py-1 ${view === "enriched" ? "bg-foreground text-background" : "bg-transparent text-muted-foreground"}`}
                        >
                          AI-enriched{isEnriching && !enriched ? "…" : ""}
                        </button>
                      </div>
                    )}
                    {enriched && builderSpaceUrl && (
                      <Button
                        size="sm"
                        variant="default"
                        asChild
                        title="Drop this design.md into a Builder.io Space and iterate with an agent"
                      >
                        <a
                          href={builderSpaceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <IconExternalLink size={14} />
                          <span className="ml-1">Open in Builder Space</span>
                        </a>
                      </Button>
                    )}
                    {!hasEnrichedContent && (
                      user && remaining === 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="You've used all 3 free AI enrichments"
                        >
                          <IconLock size={14} />
                          <span className="ml-1">Out of free enrichments</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleEnrich}
                          disabled={isEnriching || !result.screenshotDataUrl}
                          title={
                            user
                              ? `Enrich with Claude Opus 4.7 (~30-60s) — ${remaining} free left`
                              : "Sign in to unlock AI enrichment"
                          }
                        >
                          {isEnriching ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <IconSparkles size={14} />
                          )}
                          <span className="ml-1">
                            {isEnriching
                              ? "Enriching…"
                              : user
                                ? "Enrich with AI"
                                : "Enrich with AI · Sign in"}
                          </span>
                        </Button>
                      )
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
                  <div className="mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                    {enrichError}
                  </div>
                )}
                {enriched && view === "enriched" && (
                  <div className="mb-2 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <span>
                      {enriched.model} · {Math.round(enriched.latencyMs / 100) / 10}s ·
                      input {enriched.usage.inputTokens.toLocaleString()} tok ·
                      output {enriched.usage.outputTokens.toLocaleString()} tok
                    </span>
                  </div>
                )}
                <pre className="max-h-[560px] overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap">
                  {currentMarkdown}
                </pre>
              </Pane>
            </div>

            <Pane title="Preview from tokens">
              <div className="h-[900px] w-full overflow-hidden rounded-md border">
                <iframe
                  srcDoc={previewHtml}
                  title="Synthetic preview"
                  sandbox="allow-same-origin"
                  className="block h-full w-full"
                />
              </div>
            </Pane>
          </div>
        )}
      </div>
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
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
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
