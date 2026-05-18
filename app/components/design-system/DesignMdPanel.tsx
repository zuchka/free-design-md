import { useState } from "react";
import { useActionQuery } from "@agent-native/core/client";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface DesignMdPanelProps {
  id: string;
}

export function DesignMdPanel({ id }: DesignMdPanelProps) {
  const { data, isLoading, error } = useActionQuery<{
    id: string;
    title: string;
    markdown: string;
  }>("export-design-md", { id });
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (!data?.markdown) return;
    await navigator.clipboard.writeText(data.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          DESIGN.md
        </div>
        <Button size="sm" variant="outline" onClick={onCopy} disabled={!data?.markdown}>
          {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          <span className="ml-1">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">Rendering…</div>}
      {error && <div className="text-sm text-red-500">Failed to render: {String(error)}</div>}
      {data?.markdown && (
        <pre className="max-h-[480px] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap">
          {data.markdown}
        </pre>
      )}
    </div>
  );
}
