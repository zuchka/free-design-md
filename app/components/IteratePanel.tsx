import { useMemo, useState } from "react";
import { useBuilderConnectFlow } from "@agent-native/core/client";
import { Button } from "@/components/ui/button";
import { extractSectionList } from "../../shared/parse-enriched-design-md";

export interface IteratePanelProps {
  enrichedMarkdown: string;
  onSubmit: (input: { userPrompt: string; sectionTarget?: string }) => void;
  isStreaming: boolean;
  remaining: number | null;
}

const MAX_PROMPT = 1000;

export default function IteratePanel({
  enrichedMarkdown,
  onSubmit,
  isStreaming,
  remaining,
}: IteratePanelProps) {
  const { configured } = useBuilderConnectFlow({
    trackingSource: "free_design_md_iterate",
  });
  const [text, setText] = useState("");
  const [section, setSection] = useState<string>("");
  const sections = useMemo(
    () => extractSectionList(enrichedMarkdown),
    [enrichedMarkdown],
  );

  if (!configured) return null;

  if (remaining === 0) {
    return (
      <div className="rounded-md border px-4 py-3 text-sm text-muted-foreground">
        Out of iteration credits. Single-tenant pool — refresh credits upstream
        to continue.
      </div>
    );
  }

  const overCap = text.length > MAX_PROMPT;
  const canSubmit = text.trim().length > 0 && !overCap && !isStreaming;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Iterate on this memo</div>
        {remaining !== null && (
          <div className="text-xs text-muted-foreground">
            {remaining} credit{remaining === 1 ? "" : "s"} left
          </div>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_PROMPT}
        rows={3}
        placeholder="e.g. Make the brand voice more playful and confident."
        className="w-full rounded-md border bg-background p-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isStreaming}
      />
      <div className="flex items-center gap-2">
        <select
          value={section}
          onChange={(e) => setSection(e.target.value)}
          disabled={sections.length === 0 || isStreaming}
          className="rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="">Whole memo</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              Limit to: {s}
            </option>
          ))}
        </select>
        <div className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {text.length}/{MAX_PROMPT}
        </div>
        <Button
          size="sm"
          onClick={() => {
            onSubmit({
              userPrompt: text,
              sectionTarget: section || undefined,
            });
            setText("");
          }}
          disabled={!canSubmit}
        >
          {isStreaming ? "Iterating…" : "Iterate"}
        </Button>
      </div>
    </div>
  );
}
