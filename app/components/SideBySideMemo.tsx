import { Button } from "@/components/ui/button";

export interface SideBySideMemoProps {
  previous: string;
  next: string;
  isStreaming: boolean;
  candidatePending: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}

export default function SideBySideMemo({
  previous,
  next,
  isStreaming,
  candidatePending,
  onKeep,
  onDiscard,
}: SideBySideMemoProps) {
  const heading =
    candidatePending && !isStreaming
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
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Pane title="Previous">
          <pre className="overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
            {previous}
          </pre>
        </Pane>
        <Pane title={isStreaming ? "New (streaming…)" : "New"}>
          {next ? (
            <pre className="overflow-auto whitespace-pre-wrap text-xs leading-relaxed">
              {next}
            </pre>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 px-3 py-8 text-center text-xs text-muted-foreground">
              Waiting for the first streamed tokens…
            </div>
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
