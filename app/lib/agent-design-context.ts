import { appBasePath } from "@agent-native/core/client";
import type { DesignSystemData } from "../../shared/api";

type DesignContextStage = "deterministic" | "enriched" | "iteration";

interface PublishDesignContextInput {
  url: string;
  title?: string;
  stage: DesignContextStage;
  deterministicMarkdown?: string;
  currentMarkdown: string;
  designSystemData?: DesignSystemData;
  savedDesignId?: string | null;
  savedDesignUrl?: string | null;
}

const CONTEXT_PREVIEW_CHARS = 6000;

function previewMarkdown(markdown: string): string {
  if (markdown.length <= CONTEXT_PREVIEW_CHARS) return markdown;
  return `${markdown.slice(0, CONTEXT_PREVIEW_CHARS)}\n\n[preview truncated; call view-screen for the full current design.md]`;
}

export async function publishDesignContext({
  url,
  title,
  stage,
  deterministicMarkdown,
  currentMarkdown,
  designSystemData,
  savedDesignId,
  savedDesignUrl,
}: PublishDesignContextInput) {
  const payload = {
    view: "design-md",
    url,
    title: title ?? url,
    stage,
    savedDesignId: savedDesignId ?? null,
    savedDesignUrl: savedDesignUrl ?? null,
    updatedAt: new Date().toISOString(),
    currentMarkdown,
    currentMarkdownPreview: previewMarkdown(currentMarkdown),
    deterministicMarkdown: deterministicMarkdown ?? currentMarkdown,
    designSystemData: designSystemData ?? null,
    instructions:
      "Use currentMarkdown as the loaded design.md. Do not ask the user to paste or enrich the URL again.",
  };

  await fetch(`${appBasePath()}/api/agent-context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
