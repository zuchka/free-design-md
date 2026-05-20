import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { appBasePath } from "@agent-native/core/client";
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
  IconExternalLink,
  IconLock,
  IconSparkles,
} from "@tabler/icons-react";
import { consumeQuota, useAuth, refreshQuota } from "@/lib/auth";
import { readCache, writeCache } from "@/lib/extraction-cache";
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
  // Accumulates the full text of an in-progress enrichment so each state
  // update sets the COMPLETE text seen so far. This prevents the "catching
  // up" animation after the SSE stream closes — if React batches N delta
  // renders into one, that render shows the full text through delta N, not
  // just delta N's fragment.
  const streamAccumRef = useRef("");
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

  const activePreviewHtml =
    view === "enriched" && enrichedPreviewHtml ? enrichedPreviewHtml : previewHtml;

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
          <div
            className="mb-8 rounded-md border px-4 py-3 text-sm"
            style={{ borderColor: "rgba(184,0,0,0.25)", backgroundColor: "var(--intuit-error-bg)", color: "var(--intuit-error)" }}
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
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <Pane title="Real site" className="lg:flex-1 lg:min-w-0">
                {result.screenshotDataUrl ? (
                  <div className="h-[560px] overflow-auto rounded-md border bg-muted/20" style={{ boxShadow: "var(--intuit-card-shadow)" }}>
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
                          className={`px-2 py-1 transition-colors ${view === "deterministic" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                          style={view === "deterministic" ? { backgroundColor: "var(--intuit-primary)" } : undefined}
                        >
                          Deterministic
                        </button>
                        <button
                          type="button"
                          onClick={() => setView("enriched")}
                          className={`px-2 py-1 transition-colors ${view === "enriched" ? "text-white" : "bg-transparent text-muted-foreground"}`}
                          style={view === "enriched" ? { backgroundColor: "var(--intuit-primary)" } : undefined}
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
                  <div
                    className="mb-2 rounded-md border px-3 py-2 text-xs"
                    style={{ borderColor: "rgba(184,0,0,0.25)", backgroundColor: "var(--intuit-error-bg)", color: "var(--intuit-error)" }}
                  >
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

            {!hasEnrichedContent && (
              <EnrichBanner
                user={user}
                remaining={remaining}
                isEnriching={isEnriching}
                hasScreenshot={!!result.screenshotDataUrl}
                onEnrich={handleEnrich}
                onSignIn={() => setSignInOpen(true)}
                onUnlocked={() => void refreshQuota()}
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
              <div className="relative h-[900px] w-full overflow-hidden rounded-md border" style={{ boxShadow: "var(--intuit-card-shadow)" }}>
                <iframe
                  srcDoc={activePreviewHtml}
                  title="Synthetic preview"
                  sandbox="allow-same-origin"
                  className="block h-full w-full"
                />
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
            </Pane>
          </div>
        )}
      </div>
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  );
}

interface EnrichBannerProps {
  user: { email: string } | null;
  remaining: number;
  isEnriching: boolean;
  hasScreenshot: boolean;
  onEnrich: () => void;
  onSignIn: () => void;
  onUnlocked: () => void;
}

function EnrichBanner({
  user,
  remaining,
  isEnriching,
  hasScreenshot,
  onEnrich,
  onSignIn,
  onUnlocked,
}: EnrichBannerProps) {
  const outOfQuota = user !== null && remaining === 0;

  if (outOfQuota) return <BuilderKeyUnlockCard onUnlocked={onUnlocked} />;

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-6"
      style={{ background: "linear-gradient(135deg, rgba(10,30,74,0.08) 0%, rgba(26,86,176,0.06) 60%, transparent 100%)", borderColor: "rgba(35,108,255,0.18)" }}
    >
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5 max-w-2xl">
          <p className="text-base font-semibold tracking-tight">
            Your design.md is a skeleton. AI enrichment makes it{" "}
            <span style={{ color: "var(--intuit-primary)" }}>10–15× more detailed.</span>
          </p>
          <p className="text-sm text-muted-foreground">
            The deterministic pass captures raw tokens — colors, fonts, radii. AI enrichment adds
            brand voice, component intent, spacing rationale, and accessibility notes, reaching the
            depth of{" "}
            <span className="font-medium text-foreground">getdesign.md</span>
            {" "}reference files — or beyond. Powered by{" "}
            <span className="font-medium text-foreground">Claude Opus 4.7</span>.
            {user
              ? ` ${remaining} free enrichment${remaining === 1 ? "" : "s"} remaining.`
              : " Free with a Builder.io account."}
          </p>
        </div>
        <div className="shrink-0">
          {user ? (
            <Button
              size="lg"
              variant="default"
              onClick={onEnrich}
              disabled={isEnriching || !hasScreenshot}
              className="gap-2 text-white border-0 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--intuit-primary)" }}
            >
              <IconSparkles size={18} />
              {isEnriching ? "Enriching…" : "Enrich with AI"}
            </Button>
          ) : (
            <Button
              size="lg"
              variant="default"
              onClick={onSignIn}
              className="gap-2 text-white border-0 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--intuit-primary)" }}
            >
              <IconSparkles size={18} />
              Sign in to Enrich
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function BuilderKeyUnlockCard({ onUnlocked }: { onUnlocked: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleUnlock() {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/unlock-with-builder-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = (await res.json()) as { error?: string; remaining?: number };
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Verification failed — try again.");
        return;
      }
      setStatus("success");
      await refreshQuota();
      onUnlocked();
    } catch {
      setStatus("error");
      setErrorMsg("Network error — check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-xl border p-6"
        style={{
          background: "linear-gradient(135deg, rgba(0,128,0,0.06) 0%, transparent 100%)",
          borderColor: "rgba(0,160,0,0.2)",
        }}
      >
        <p className="text-base font-semibold tracking-tight" style={{ color: "var(--intuit-primary)" }}>
          10 more enrichments unlocked!
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Builder.io space is linked. You're good to go.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-6"
      style={{
        background: "linear-gradient(135deg, rgba(10,30,74,0.08) 0%, rgba(26,86,176,0.06) 60%, transparent 100%)",
        borderColor: "rgba(35,108,255,0.18)",
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold tracking-tight">
            You've used your 3 free enrichments.
          </p>
          <p className="text-sm text-muted-foreground">
            Link a Builder.io space to unlock{" "}
            <span style={{ color: "var(--intuit-primary)" }}>10 more — free, no credit card required.</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Paste your Builder.io public API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleUnlock()}
            disabled={status === "loading"}
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            style={{ borderColor: "rgba(35,108,255,0.3)" }}
          />
          <button
            onClick={() => void handleUnlock()}
            disabled={status === "loading" || !apiKey.trim()}
            className="h-9 rounded-md px-4 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "var(--intuit-primary)" }}
          >
            {status === "loading" ? "Verifying…" : "Unlock 10 more"}
          </button>
        </div>

        {errorMsg && (
          <p
            className="rounded-md border px-3 py-2 text-xs"
            style={{
              borderColor: "rgba(184,0,0,0.25)",
              backgroundColor: "var(--intuit-error-bg)",
              color: "var(--intuit-error)",
            }}
          >
            {errorMsg}
          </p>
        )}

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>
            No Builder.io account?{" "}
            <a
              href="https://www.builder.io/signup?agentNativeFlow=design_extraction&source=free-design-md"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Sign up free — no credit card required →
            </a>
          </span>
          <span>
            Your public API key is in your Builder.io space settings under{" "}
            <strong>Settings → Space → Public API Key</strong>.
          </span>
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
