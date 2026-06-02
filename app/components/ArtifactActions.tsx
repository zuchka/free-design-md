import { useState } from "react";
import {
  IconCheck,
  IconDeviceFloppy,
  IconHtml,
  IconMarkdown,
  IconCopy,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtifactActionsProps {
  markdown: string;
  html: string;
  baseFilename: string;
}

export default function ArtifactActions({
  markdown,
  html,
  baseFilename,
}: ArtifactActionsProps) {
  const [copied, setCopied] = useState(false);
  const filename = safeFilename(baseFilename);

  async function copyMarkdown() {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function saveMarkdown() {
    downloadText(`${filename}.md`, markdown, "text/markdown;charset=utf-8");
  }

  function saveHtml() {
    downloadText(`${filename}.html`, html, "text/html;charset=utf-8");
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
            disabled={!markdown && !html}
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

function downloadText(filename: string, text: string, type: string) {
  if (!text) return;
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
