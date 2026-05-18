import { useEffect, useMemo, useState } from "react";
import { appBasePath } from "@agent-native/core/client";
import { renderPreview } from "../../shared/preview-template";
import type { DesignSystemData } from "../../shared/api";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconCheck, IconCopy } from "@tabler/icons-react";

export function meta() {
  return [
    { title: "Extract design.md from a URL" },
    {
      name: "description",
      content:
        "Type a URL. See a screenshot, a synthetic preview using the extracted tokens, and the rendered design.md spec.",
    },
  ];
}

interface ExtractResult {
  url: string;
  markdown: string;
  designSystemData: DesignSystemData;
  signals?: { title?: string };
  screenshotDataUrl?: string;
}

const LOADING_LABELS = [
  "Loading the page…",
  "Extracting tokens…",
  "Rendering preview…",
];

export default function ExtractRoute() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [labelIndex, setLabelIndex] = useState(0);
  const [copied, setCopied] = useState(false);

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

  async function handleCopy() {
    if (!result?.markdown) return;
    await navigator.clipboard.writeText(result.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Extract a design system from any URL
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Type a URL. We headlessly load the page, capture its colors, fonts,
            and shapes, and render a portable design.md spec. No sign-in
            required.
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
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Pane title="Real site">
              {result.screenshotDataUrl ? (
                <img
                  src={result.screenshotDataUrl}
                  alt={`Screenshot of ${result.url}`}
                  className="block w-full h-auto rounded-md border"
                />
              ) : (
                <div className="rounded-md border bg-muted/40 p-6 text-sm text-muted-foreground">
                  Screenshot unavailable.
                </div>
              )}
            </Pane>

            <Pane title="Preview from tokens">
              <div className="aspect-[8/5] w-full overflow-hidden rounded-md border">
                <iframe
                  srcDoc={previewHtml}
                  title="Synthetic preview"
                  sandbox="allow-same-origin"
                  className="block h-full w-full"
                />
              </div>
            </Pane>

            <Pane
              title="design.md"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  disabled={!result.markdown}
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
                </Button>
              }
            >
              <pre className="max-h-[480px] overflow-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap">
                {result.markdown}
              </pre>
            </Pane>
          </div>
        )}
      </div>
    </div>
  );
}

interface PaneProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Pane({ title, action, children }: PaneProps) {
  return (
    <section className="flex flex-col gap-2">
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
