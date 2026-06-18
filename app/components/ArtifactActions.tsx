import { useState } from "react";
import {
  IconBraces,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconHtml,
  IconMarkdown,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  recordDesignArtifactEvent,
  type DesignArtifactEventFormat,
  type DesignArtifactTrackingContext,
} from "@/lib/design-artifact-events";

interface ArtifactActionsProps {
  markdown: string;
  html: string;
  mdx?: string;
  baseFilename: string;
  tracking?: DesignArtifactTrackingContext;
}

export default function ArtifactActions({
  markdown,
  html,
  mdx = "",
  baseFilename,
  tracking,
}: ArtifactActionsProps) {
  const [copied, setCopied] = useState(false);
  const filename = safeFilename(baseFilename);

  async function copyMarkdown() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    trackArtifactEvent("copy", "markdown");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function saveMarkdown() {
    if (
      downloadText(`${filename}.md`, markdown, "text/markdown;charset=utf-8")
    ) {
      trackArtifactEvent("download", "markdown");
    }
  }

  function saveHtml() {
    if (downloadText(`${filename}.html`, html, "text/html;charset=utf-8")) {
      trackArtifactEvent("download", "html");
    }
  }

  function saveMdx() {
    if (downloadText(`${filename}.mdx`, mdx, "text/mdx;charset=utf-8")) {
      trackArtifactEvent("download", "mdx");
    }
  }

  function trackArtifactEvent(
    action: "copy" | "download",
    format: DesignArtifactEventFormat,
  ) {
    if (!tracking) return;
    recordDesignArtifactEvent({ ...tracking, action, format });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={copyMarkdown}
        disabled={!markdown}
        aria-label="Copy design.md"
        title="Copy design.md"
        className="size-8 p-0"
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={!markdown && !html && !mdx}
            aria-label="Save artifact"
            title="Save"
            className="size-8 p-0"
          >
            <IconDeviceFloppy />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={!markdown} onClick={saveMarkdown}>
              <IconMarkdown />
              <span>Save markdown</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!html} onClick={saveHtml}>
              <IconHtml />
              <span>Save HTML</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!mdx} onClick={saveMdx}>
              <IconBraces />
              <span>Save MDX</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function safeFilename(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "design";
}

function downloadText(filename: string, text: string, type: string): boolean {
  if (!text) return false;
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
