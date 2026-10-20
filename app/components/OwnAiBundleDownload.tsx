import { useId, useState } from "react";
import { IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { OwnAiExtraction } from "@/lib/own-ai-bundle";

export default function OwnAiBundleDownload({
  extraction,
}: {
  extraction: OwnAiExtraction;
}) {
  const descriptionId = useId();
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadBundle() {
    setIsPreparing(true);
    setError(null);
    try {
      const { createOwnAiBundle } = await import("@/lib/own-ai-bundle");
      const { filename, blob } = createOwnAiBundle(extraction);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      try {
        link.click();
      } finally {
        link.remove();
        // Give the browser time to start reading the downloaded blob.
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }
    } catch {
      setError(
        "Could not prepare the bundle. Try again, or extract the URL again.",
      );
    } finally {
      setIsPreparing(false);
    }
  }

  return (
    <section
      aria-label="Continue with your own AI"
      className="flex min-w-0 flex-col gap-3 rounded-md border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">Continue in your own AI chat</p>
        <p
          id={descriptionId}
          className="mt-1 text-xs leading-5 text-muted-foreground"
        >
          Download a ZIP with design.md, measurements,
          {extraction.screenshotDataUrl ? " screenshot," : ""} and enrichment
          instructions.
          {!extraction.screenshotDataUrl && " This capture has no screenshot."}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:max-w-72">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPreparing || !extraction.markdown.trim()}
          aria-busy={isPreparing}
          aria-describedby={descriptionId}
          onClick={downloadBundle}
        >
          {isPreparing ? <Spinner /> : <IconDownload aria-hidden="true" />}
          {isPreparing ? "Preparing ZIP…" : "Use your own AI"}
        </Button>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
