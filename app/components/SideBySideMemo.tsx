import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseEnrichedFrontmatter } from "../../shared/parse-enriched-design-md";
import { renderEnrichedPreview } from "../../shared/render-enriched-showcase";

export interface SideBySideMemoProps {
  previous: string;
  next: string;
  isStreaming: boolean;
  candidatePending: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

type ViewMode = "markdown" | "preview";

export default function SideBySideMemo({
  previous,
  next,
  isStreaming,
  candidatePending,
  onKeep,
  onDiscard,
}: SideBySideMemoProps) {
  const [view, setView] = useState<ViewMode>("markdown");

  const previousHtml = useMemo(
    () => renderPreviewSafely(previous),
    [previous],
  );
  const nextHtml = useMemo(() => renderPreviewSafely(next), [next]);

  const heading = candidatePending && !isStreaming
    ? "Candidate iteration — accept or discard"
    : isStreaming
      ? "Iteration streaming…"
      : "Most recent change";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </div>
        <div className="flex overflow-hidden rounded-md border text-xs">
          <button
            type="button"
            onClick={() => setView("markdown")}
            className={`whitespace-nowrap px-2 py-1 transition-colors ${
              view === "markdown"
                ? "text-white"
                : "bg-transparent text-muted-foreground"
            }`}
            style={
              view === "markdown"
                ? { backgroundColor: "var(--intuit-primary)" }
                : undefined
            }
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => setView("preview")}
            className={`whitespace-nowrap px-2 py-1 transition-colors ${
              view === "preview"
                ? "text-white"
                : "bg-transparent text-muted-foreground"
            }`}
            style={
              view === "preview"
                ? { backgroundColor: "var(--intuit-primary)" }
                : undefined
            }
          >
            Preview
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Pane title="Previous">
          {view === "markdown" ? (
            <pre className="overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
              {previous}
            </pre>
          ) : (
            <PreviewFrame html={previousHtml} />
          )}
        </Pane>
        <Pane title={isStreaming ? "New (streaming…)" : "New"}>
          {view === "markdown" ? (
            <pre className="overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
              {next}
            </pre>
          ) : (
            <PreviewFrame html={nextHtml} />
          )}
        </Pane>
      </div>
      {candidatePending && !isStreaming && (
        <div className="flex items-center gap-2 self-end">
          <Button size="sm" variant="outline" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={onKeep}>
            Keep
          </Button>
        </div>
      )}
    </div>
  );
}

function renderPreviewSafely(markdown: string): string | null {
  if (!markdown || markdown.trim().length === 0) return null;
  try {
    const parsed = parseEnrichedFrontmatter(markdown);
    if (!parsed) return null;
    return renderEnrichedPreview(parsed, markdown);
  } catch {
    return null;
  }
}

function PreviewFrame({ html }: { html: string | null }) {
  if (!html) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        Preview unavailable — memo doesn't parse as enriched design.md (yet).
      </div>
    );
  }
  return (
    <iframe
      srcDoc={html}
      title="Memo preview"
      sandbox="allow-same-origin"
      className="block h-[440px] w-full rounded-md border"
    />
  );
}

function Pane({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex max-h-[480px] flex-col gap-2 rounded-md border p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}
