import { useEffect, useMemo, useRef, useState } from "react";
import {
  appBasePath,
  focusAgentChat,
  updateMcpAppModelContext,
  useBuilderConnectFlow,
} from "@agent-native/core/client";
import { renderPreview } from "../../shared/preview-template";
import {
  extractSectionList,
  parseEnrichedFrontmatter,
} from "../../shared/parse-enriched-design-md";
import { renderEnrichedPreview } from "../../shared/render-enriched-showcase";
import type { DesignSystemData } from "../../shared/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import BuilderConnectCta from "@/components/auth/BuilderConnectCta";
import CreditsRecoveryBanner from "@/components/CreditsRecoveryBanner";
import ArtifactActions from "@/components/ArtifactActions";
import {
  classifyAiAccessErrorMessage,
  readAiAccessErrorResponse,
  type AiAccessRecoveryReason,
} from "@/lib/ai-access-errors";
import { readCache, writeCache } from "@/lib/extraction-cache";
import SideBySideMemo from "@/components/SideBySideMemo";
import {
  advanceSession,
  getOrCreateSession,
  iterate,
  type IterationSession,
} from "@/lib/iteration-client";
import {
  announceAgentActivity,
  clearAgentActivity,
} from "@/lib/agent-activity";

export function meta() {
  return [
    { title: "Free design.md — extract a design system from any URL" },
    {
      name: "description",
      content:
        "Paste a URL. We headlessly load the page, capture its colors, fonts, and shapes, and render a portable design.md spec. Sign in to enrich it with Claude.",
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
  savedDesignId?: string;
  savedDesignUrl?: string;
  saveError?: string;
}

interface SavedDesignItem {
  id: string;
  sourceUrl: string;
  title: string;
  model: string;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const LOADING_LABELS = [
  "Loading the page…",
  "Extracting tokens…",
  "Rendering preview…",
];

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

export default function IndexRoute() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [labelIndex, setLabelIndex] = useState(0);
  const [enriched, setEnriched] = useState<EnrichResult | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [enrichRecoveryReason, setEnrichRecoveryReason] =
    useState<AiAccessRecoveryReason | null>(null);
  const [view, setView] = useState<"deterministic" | "enriched">(
    "deterministic",
  );
  const [streamingMarkdown, setStreamingMarkdown] = useState("");
  // Accumulates the full text of an in-progress enrichment so each state
  // update sets the COMPLETE text seen so far. This prevents the "catching
  // up" animation after the SSE stream closes — if React batches N delta
  // renders into one, that render shows the full text through delta N, not
  // just delta N's fragment.
  const streamAccumRef = useRef("");
  const enrichDeltaAnnouncedRef = useRef(false);
  const markdownPreRef = useRef<HTMLPreElement>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [screenshotHeight, setScreenshotHeight] = useState<number | null>(null);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesignItem[]>([]);
  const [savedDesignsError, setSavedDesignsError] = useState<string | null>(
    null,
  );
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [iterationPrompt, setIterationPrompt] = useState("");
  const [iterationSectionTarget, setIterationSectionTarget] = useState("");
  const [isIterating, setIsIterating] = useState(false);
  const [iterationError, setIterationError] = useState<string | null>(null);
  const [iterationRecoveryReason, setIterationRecoveryReason] =
    useState<AiAccessRecoveryReason | null>(null);
  const [candidateMarkdown, setCandidateMarkdown] = useState("");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [candidateSavedDesignId, setCandidateSavedDesignId] = useState<
    string | null
  >(null);
  const [candidateSavedDesignUrl, setCandidateSavedDesignUrl] = useState<
    string | null
  >(null);
  const [previewSource, setPreviewSource] = useState<"current" | "candidate">(
    "current",
  );
  const iterationAccumRef = useRef("");
  const iterationDeltaAnnouncedRef = useRef(false);

  // Iteration state: separate from the enrichment SSE flow. A session
  // represents one extract→enrich→iterate chain keyed on the URL.
  const { configured } = useBuilderConnectFlow({
    trackingSource: "free_design_md_index",
  });
  const [iterSession, setIterSession] = useState<IterationSession | null>(null);

  useEffect(() => {
    if (!configured) {
      setSavedDesigns([]);
      return;
    }
    void refreshSavedDesigns();
  }, [configured]);

  async function refreshSavedDesigns() {
    try {
      const res = await fetch(`${appBasePath()}/api/saved-enrichments`);
      if (!res.ok) {
        setSavedDesigns([]);
        return;
      }
      const data = (await res.json()) as { items: SavedDesignItem[] };
      setSavedDesigns(data.items);
      setSavedDesignsError(null);
    } catch (err) {
      setSavedDesignsError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (enriched?.markdown && result?.url) {
      const s = getOrCreateSession(result.url, enriched.markdown);
      setIterSession(s);
    }
  }, [enriched?.markdown, result?.url]);

  useEffect(() => {
    if (!enriched?.markdown) return;
    focusAgentChat();
    updateMcpAppModelContext({
      content: [
        {
          type: "text",
          text:
            `IMPORTANT: The user already has an AI-enriched design.md loaded for ${result?.url ?? "this page"}. ` +
            "DO NOT call extract-design-md — the content is already available below. " +
            "Do not revise or iterate from chat; the visible page has an 'Ask for a change' box that streams the candidate markdown and preview. " +
            "Answer questions about the loaded design.md and direct requested edits to that page control. " +
            "Do not re-extract, do not re-enrich.\n\n" +
            enriched.markdown,
        },
      ],
    });
  }, [enriched?.markdown, result?.url]);

  useEffect(() => {
    if (!isLoading) return;
    setLabelIndex(0);
    const id = setInterval(() => {
      setLabelIndex((i) => (i + 1) % LOADING_LABELS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [isLoading]);

  // Auto-scroll the markdown pane to the bottom while streaming so the
  // user sees new content as it arrives rather than staying at the top.
  useEffect(() => {
    if (!isEnriching || !markdownPreRef.current) return;
    const el = markdownPreRef.current;
    el.scrollTop = el.scrollHeight;
  }, [streamingMarkdown, isEnriching]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("url");
    if (!urlParam) return;
    const cached = readCache(urlParam);
    if (cached) {
      setUrl(cached.url);
      setResult(cached);
      if (cached.enrichedMarkdown) {
        setEnriched({
          markdown: cached.enrichedMarkdown,
          model: cached.enrichedModel ?? "cached",
          latencyMs: 0,
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
          },
          stopReason: "end_turn",
        });
        setView("enriched");
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
    return renderEnrichedPreview(
      parsed,
      enriched.markdown,
      result?.signals?.title,
    );
  }, [enriched?.markdown, result?.signals?.title]);

  const candidatePreviewHtml = useMemo(() => {
    if (!candidateMarkdown) return null;
    const parsed = parseEnrichedFrontmatter(candidateMarkdown);
    if (!parsed) return null;
    return renderEnrichedPreview(
      parsed,
      candidateMarkdown,
      result?.signals?.title,
    );
  }, [candidateMarkdown, result?.signals?.title]);

  const enrichedPreviewFailed =
    enriched !== null && enrichedPreviewHtml === null;
  const candidatePreviewFailed =
    previewSource === "candidate" &&
    candidateMarkdown.length > 0 &&
    candidatePreviewHtml === null;
  const hasCandidateComparison = isIterating || candidateMarkdown.length > 0;

  async function extractUrl(trimmed: string) {
    clearAgentActivity();
    announceAgentActivity({
      title: "Loading page",
      detail: trimmed,
      tone: "running",
    });
    setIsLoading(true);
    setError(null);
    setResult(null);
    setEnriched(null);
    setEnrichError(null);
    setEnrichRecoveryReason(null);
    setIterationPrompt("");
    setIterationError(null);
    setIterationRecoveryReason(null);
    setCandidateMarkdown("");
    setCandidateId(null);
    setCandidateSavedDesignId(null);
    setCandidateSavedDesignUrl(null);
    setIterSession(null);
    setPreviewSource("current");
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
      announceAgentActivity({
        title: "Extracted design tokens",
        detail: data.signals?.title ?? data.url,
        tone: "success",
      });
      writeCache({
        url: data.url,
        markdown: data.markdown,
        designSystemData: data.designSystemData,
        signals: data.signals,
        screenshotDataUrl: data.screenshotDataUrl,
      });
      history.replaceState(null, "", `?url=${encodeURIComponent(data.url)}`);
      focusAgentChat();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      announceAgentActivity({
        title: "Extraction failed",
        detail: message,
        tone: "error",
      });
      setError(message);
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
    setEnrichRecoveryReason(null);
    setStreamingMarkdown("");
    streamAccumRef.current = "";
    enrichDeltaAnnouncedRef.current = false;
    setView("enriched");
    announceAgentActivity({
      title: "Starting AI enrichment",
      detail: result.signals?.title ?? result.url,
      tone: "running",
    });
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
        const details = await readAiAccessErrorResponse(
          res,
          `Enrich failed with ${res.status}`,
        );
        setEnrichRecoveryReason(details.recoveryReason);
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
            if (!enrichDeltaAnnouncedRef.current) {
              enrichDeltaAnnouncedRef.current = true;
              announceAgentActivity({
                title: "Claude is writing design.md",
                detail: "Streaming the enriched memo into the preview.",
                tone: "running",
                openSidebar: false,
              });
            }
          } else if (parsed.event === "done") {
            sawDone = true;
            const enrichResult = parsed.data as EnrichResult;
            setEnriched(enrichResult);
            announceAgentActivity({
              title: "AI enrichment complete",
              detail: enrichResult.savedDesignUrl
                ? "Saved a public snapshot."
                : "Ready for follow-up questions.",
              tone: "success",
            });
            if (enrichResult.savedDesignUrl) {
              history.replaceState(
                null,
                "",
                `${appBasePath()}${enrichResult.savedDesignUrl}`,
              );
              void refreshSavedDesigns();
            }
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
            announceAgentActivity({
              title: "AI enrichment failed",
              detail: message,
              tone: "error",
            });
            throw new Error(message);
          }
        }
      }
      if (!sawDone) {
        throw new Error("Stream ended without a done event");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      announceAgentActivity({
        title: "AI enrichment stopped",
        detail: message,
        tone: "error",
      });
      setEnrichError(message);
      setEnrichRecoveryReason(
        (current) => current ?? classifyAiAccessErrorMessage(message),
      );
      // Fall back to the deterministic view if the stream blew up before
      // any content arrived. If we already have partial streaming text,
      // leave it visible so the user can see what they got.
      if (!streamAccumRef.current) setView("deterministic");
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

  const hasEnrichedContent = enriched !== null || streamingMarkdown.length > 0;
  const showEnrichBanner =
    !isLoading && !hasEnrichedContent && (!configured || result !== null);
  const currentMarkdown =
    view === "enriched"
      ? enriched
        ? enriched.markdown
        : streamingMarkdown
      : (result?.markdown ?? "");
  const iterationScopeMarkdown =
    iterSession?.current.markdown ?? enriched?.markdown ?? "";
  const iterationSectionOptions = useMemo(
    () => extractSectionList(iterationScopeMarkdown),
    [iterationScopeMarkdown],
  );

  useEffect(() => {
    if (
      iterationSectionTarget &&
      !iterationSectionOptions.includes(iterationSectionTarget)
    ) {
      setIterationSectionTarget("");
    }
  }, [iterationSectionOptions, iterationSectionTarget]);

  async function handleCopyShareUrl() {
    if (!enriched?.savedDesignUrl) return;
    const shareUrl = `${window.location.origin}${appBasePath()}${enriched.savedDesignUrl}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedShareUrl(true);
    setTimeout(() => setCopiedShareUrl(false), 1500);
  }

  async function handleDeleteSavedDesign(id: string) {
    const res = await fetch(`${appBasePath()}/api/saved-enrichments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setSavedDesigns((items) => items.filter((item) => item.id !== id));
    }
  }

  async function handleIterate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !result ||
      !enriched?.markdown ||
      !iterationPrompt.trim() ||
      isIterating
    ) {
      return;
    }

    const session =
      iterSession ?? getOrCreateSession(result.url, enriched.markdown);
    setIterSession(session);
    setIsIterating(true);
    setIterationError(null);
    setIterationRecoveryReason(null);
    setCandidateMarkdown("");
    setCandidateId(null);
    setCandidateSavedDesignId(null);
    setCandidateSavedDesignUrl(null);
    setPreviewSource("candidate");
    iterationAccumRef.current = "";
    iterationDeltaAnnouncedRef.current = false;
    announceAgentActivity({
      title: "Starting iteration",
      detail: iterationPrompt.trim(),
      tone: "running",
    });

    await iterate(
      {
        sessionId: session.sessionId,
        url: result.url,
        previousMarkdown: session.current.markdown,
        userPrompt: iterationPrompt.trim(),
        sectionTarget: iterationSectionTarget || undefined,
        parentId: session.current.id ?? enriched.savedDesignId ?? null,
        deterministicMarkdown: result.markdown,
        designSystemData: result.designSystemData,
        signals: result.signals,
        screenshotDataUrl: result.screenshotDataUrl,
      },
      {
        onDelta: (text) => {
          iterationAccumRef.current += text;
          setCandidateMarkdown(iterationAccumRef.current);
          if (!iterationDeltaAnnouncedRef.current) {
            iterationDeltaAnnouncedRef.current = true;
            announceAgentActivity({
              title: "Drafting candidate memo",
              detail: "Streaming the revised design.md side by side.",
              tone: "running",
              openSidebar: false,
            });
          }
        },
        onDone: (done) => {
          setCandidateMarkdown(done.markdown);
          setCandidateId(done.id);
          setCandidateSavedDesignId(done.savedDesignId ?? null);
          setCandidateSavedDesignUrl(done.savedDesignUrl ?? null);
          announceAgentActivity({
            title: "Iteration ready",
            detail: done.savedDesignUrl
              ? "Review the candidate, then keep or discard it."
              : "Review the candidate side by side.",
            tone: "success",
          });
          if (done.savedDesignUrl) {
            void refreshSavedDesigns();
          }
        },
        onError: (message) => {
          announceAgentActivity({
            title: "Iteration failed",
            detail: message,
            tone: "error",
          });
          setCandidateMarkdown("");
          setCandidateId(null);
          setCandidateSavedDesignId(null);
          setCandidateSavedDesignUrl(null);
          setPreviewSource("current");
          setIterationError(message);
          setIterationRecoveryReason(classifyAiAccessErrorMessage(message));
        },
      },
    );
    setIsIterating(false);
  }

  function handleKeep() {
    if (!result || !enriched || !candidateMarkdown || !candidateId) return;
    const nextSession = advanceSession(result.url, {
      id: candidateSavedDesignId ?? candidateId,
      markdown: candidateMarkdown,
    });
    setIterSession(nextSession);
    setEnriched({
      ...enriched,
      markdown: candidateMarkdown,
      savedDesignId: candidateSavedDesignId ?? enriched.savedDesignId,
      savedDesignUrl: candidateSavedDesignUrl ?? enriched.savedDesignUrl,
    });
    if (candidateSavedDesignUrl) {
      history.replaceState(
        null,
        "",
        `${appBasePath()}${candidateSavedDesignUrl}`,
      );
    }
    writeCache({
      url: result.url,
      markdown: result.markdown,
      designSystemData: result.designSystemData,
      signals: result.signals,
      screenshotDataUrl: result.screenshotDataUrl,
      enrichedMarkdown: candidateMarkdown,
      enrichedModel: enriched.model,
    });
    setIterationPrompt("");
    setCandidateMarkdown("");
    setCandidateId(null);
    setCandidateSavedDesignId(null);
    setCandidateSavedDesignUrl(null);
    setIterationError(null);
    setIterationRecoveryReason(null);
    setView("enriched");
    setPreviewSource("current");
  }

  function handleDiscard() {
    setCandidateMarkdown("");
    setCandidateId(null);
    setCandidateSavedDesignId(null);
    setCandidateSavedDesignUrl(null);
    setIterationError(null);
    setIterationRecoveryReason(null);
    setPreviewSource("current");
  }

  const currentPreviewHtml =
    view === "enriched" ? (enrichedPreviewHtml ?? "") : previewHtml;
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Extract a design system from any URL
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Type a URL. We headlessly load the page, capture its colors, fonts,
            and shapes, and render a portable design.md spec. No sign-in
            required for the deterministic pass.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mb-6 flex flex-col gap-3 sm:flex-row"
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

        {showEnrichBanner && (
          <div className="mb-8">
            <EnrichBanner
              isEnriching={isEnriching}
              hasScreenshot={!!result?.screenshotDataUrl}
              hasResult={!!result}
              configured={configured}
              onEnrich={handleEnrich}
            />
          </div>
        )}

        {configured && savedDesigns.length > 0 && (
          <SavedDesignsList
            items={savedDesigns}
            onDelete={handleDeleteSavedDesign}
          />
        )}

        {savedDesignsError && (
          <div className="mb-4 text-xs text-muted-foreground">
            Saved designs unavailable: {savedDesignsError}
          </div>
        )}

        {error && (
          <div
            className="mb-8 rounded-md border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(239,68,68,0.25)",
              backgroundColor: "var(--intuit-error-bg)",
              color: "var(--intuit-error)",
            }}
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
                  <div
                    className="overflow-hidden rounded-md border bg-muted/20"
                    style={{ boxShadow: "var(--intuit-card-shadow)" }}
                  >
                    <img
                      src={result.screenshotDataUrl}
                      alt={`Screenshot of ${result.url}`}
                      className="block w-full h-auto"
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
                    {hasEnrichedContent && (
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
                          AI-enriched{isEnriching && !enriched ? "…" : ""}
                        </button>
                      </div>
                    )}
                    {!hasEnrichedContent && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleEnrich}
                        disabled={
                          isEnriching ||
                          !result.screenshotDataUrl ||
                          !configured
                        }
                        title={
                          !configured
                            ? "Connect Builder.io to unlock AI enrichment"
                            : "Enrich with Claude (~30-60s)"
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
                    <ArtifactActions
                      markdown={currentMarkdown}
                      html={activePreviewHtml}
                      baseFilename={result.signals?.title ?? result.url}
                    />
                    {enriched?.savedDesignUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyShareUrl}
                      >
                        {copiedShareUrl ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconExternalLink size={14} />
                        )}
                        <span className="ml-1">
                          {copiedShareUrl ? "Link copied" : "Share"}
                        </span>
                      </Button>
                    )}
                  </div>
                }
              >
                {enrichRecoveryReason && (
                  <CreditsRecoveryBanner
                    reason={enrichRecoveryReason}
                    onResolved={() => {
                      setEnrichError(null);
                      setEnrichRecoveryReason(null);
                    }}
                  />
                )}
                {enrichError && !enrichRecoveryReason && (
                  <div
                    className="mb-2 rounded-md border px-3 py-2 text-xs"
                    style={{
                      borderColor: "rgba(239,68,68,0.25)",
                      backgroundColor: "var(--intuit-error-bg)",
                      color: "var(--intuit-error)",
                    }}
                  >
                    {enrichError}
                  </div>
                )}
                {enriched?.saveError && (
                  <div
                    className="mb-2 rounded-md border px-3 py-2 text-xs"
                    style={{
                      borderColor: "rgba(245,158,11,0.35)",
                      backgroundColor: "rgba(245,158,11,0.08)",
                      color: "rgb(146,64,14)",
                    }}
                  >
                    Enriched successfully, but saving the public link failed:{" "}
                    {enriched.saveError}
                  </div>
                )}
                <div className="relative">
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
                </div>
              </Pane>
            </div>

            {enriched?.markdown && (
              <section className="rounded-md border bg-background p-4">
                <form onSubmit={handleIterate} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
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
                    {iterationSectionOptions.length > 0 && (
                      <div className="w-full lg:w-56">
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
                    <div className="flex shrink-0 gap-2">
                      {(candidateMarkdown || iterationError) && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDiscard}
                          disabled={isIterating}
                        >
                          <IconX size={14} />
                          <span className="ml-1">Clear</span>
                        </Button>
                      )}
                      <Button
                        type="submit"
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
                </form>
              </section>
            )}

            {hasCandidateComparison && iterSession && (
              <SideBySideMemo
                previous={iterSession.current.markdown}
                next={candidateMarkdown}
                isStreaming={isIterating}
                candidatePending={!isIterating && !!candidateId}
                onKeep={handleKeep}
                onDiscard={handleDiscard}
              />
            )}

            {!candidateMarkdown &&
              enriched?.markdown &&
              iterSession &&
              iterSession.previous && (
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
                <div className="flex items-center gap-2">
                  {hasCandidateComparison && (
                    <div className="flex rounded-md border overflow-hidden text-xs">
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
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: previewExpanded ? "900px" : "260px",
                    transition: "height 0.3s ease",
                  }}
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
                      <p className="text-sm text-muted-foreground">
                        Enriching with AI…
                      </p>
                    </div>
                  )}
                  {isIterating && previewSource === "candidate" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
                      <Spinner className="size-6 text-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Rendering candidate preview…
                      </p>
                    </div>
                  )}
                  {enrichedPreviewFailed &&
                    view === "enriched" &&
                    previewSource === "current" &&
                    !isEnriching && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/90 backdrop-blur-sm">
                        <p className="text-sm font-medium">
                          Enriched preview unavailable
                        </p>
                        <p className="text-xs text-muted-foreground max-w-xs text-center">
                          The AI output didn't match the expected design token
                          schema. The text view above has the full enriched
                          content.
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
                <div className="flex justify-center border-t py-2">
                  <button
                    type="button"
                    onClick={() => setPreviewExpanded((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                  >
                    {previewExpanded
                      ? "Collapse preview ↑"
                      : "Expand full preview ↓"}
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
  hasResult: boolean;
  configured: boolean;
  onEnrich: () => void;
}

function EnrichBanner({
  isEnriching,
  hasScreenshot,
  hasResult,
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
            {hasResult ? (
              <>
                <p className="text-base font-semibold tracking-tight">
                  Your design.md is a skeleton. AI enrichment makes it{" "}
                  <span style={{ color: "var(--intuit-primary)" }}>
                    10–15× more detailed.
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  The deterministic pass captures raw tokens — colors, fonts,
                  radii. AI enrichment adds brand voice, component intent,
                  spacing rationale, and accessibility notes. Powered by{" "}
                  <span className="font-medium text-foreground">Claude</span>.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold tracking-tight">
                  Step 1 is free.{" "}
                  <span style={{ color: "var(--intuit-primary)" }}>
                    No sign-in required.
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Paste any URL and click Extract — we headlessly load the page
                  and pull colors, fonts, radii, and spacing into a portable
                  design.md. Then optionally enrich it with Claude for brand
                  voice, component intent, and accessibility notes.
                </p>
              </>
            )}
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              variant="default"
              onClick={onEnrich}
              disabled={isEnriching || !hasScreenshot || !configured}
              className="gap-2 border-0 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--intuit-primary)" }}
              title={
                !hasResult
                  ? "Extract a URL first"
                  : !configured
                    ? "Connect Builder.io to unlock AI enrichment"
                    : undefined
              }
            >
              <IconSparkles size={18} />
              {isEnriching ? "Enriching…" : "Enrich with AI"}
            </Button>
          </div>
        </div>
        {hasResult && <BuilderConnectCta />}
      </div>
    </div>
  );
}

function SavedDesignsList({
  items,
  onDelete,
}: {
  items: SavedDesignItem[];
  onDelete: (id: string) => void;
}) {
  const visible = items.slice(0, 4);
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Saved designs
        </h2>
        <span className="text-xs text-muted-foreground">Public links</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {visible.map((item) => (
          <div
            key={item.id}
            className="flex min-w-0 items-center gap-3 rounded-md border bg-background px-3 py-2"
          >
            <a
              href={`${appBasePath()}/d/${item.id}`}
              className="min-w-0 flex-1 no-underline"
            >
              <div className="truncate text-sm font-medium text-foreground">
                {item.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {item.sourceUrl}
              </div>
            </a>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(
                  `${window.location.origin}${appBasePath()}/d/${item.id}`,
                );
              }}
              title="Copy public link"
              aria-label="Copy public link"
            >
              <IconCopy size={14} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(item.id)}
              title="Delete saved design"
              aria-label="Delete saved design"
            >
              <IconTrash size={14} />
            </Button>
          </div>
        ))}
      </div>
    </section>
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
