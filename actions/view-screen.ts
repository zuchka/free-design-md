import { defineAction } from "@agent-native/core";
import { readAppState } from "@agent-native/core/application-state";
import { getRequestRunContext } from "@agent-native/core/server";
import { z } from "zod";

interface DesignNavigationState {
  view?: unknown;
  url?: unknown;
  title?: unknown;
  stage?: unknown;
  savedDesignId?: unknown;
  savedDesignUrl?: unknown;
  updatedAt?: unknown;
  currentMarkdown?: unknown;
  currentMarkdownPreview?: unknown;
  deterministicMarkdown?: unknown;
  designSystemData?: unknown;
  browserTabId?: unknown;
}

const BROWSER_TAB_ID_PATTERN = /^[A-Za-z0-9_-]{1,96}$/;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function browserTabIdValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return BROWSER_TAB_ID_PATTERN.test(trimmed) ? trimmed : null;
}

async function readNavigationState(): Promise<DesignNavigationState | null> {
  const browserTabId = browserTabIdValue(getRequestRunContext()?.browserTabId);
  if (browserTabId) {
    const scoped = (await readAppState(
      `navigation:${browserTabId}`,
    )) as DesignNavigationState | null;
    if (scoped) return scoped;
  }

  return (await readAppState("navigation")) as DesignNavigationState | null;
}

export default defineAction({
  description:
    "See the current Free design.md screen context, including the full loaded design.md when available.",
  schema: z.object({}),
  readOnly: true,
  http: false,
  run: async () => {
    const navigation = await readNavigationState();

    if (!navigation || navigation.view !== "design-md") {
      return "No design.md is currently loaded in application state.";
    }

    const currentMarkdown = asString(navigation.currentMarkdown);
    const deterministicMarkdown = asString(navigation.deterministicMarkdown);

    return {
      view: "design-md",
      browserTabId: asString(navigation.browserTabId) ?? null,
      url: asString(navigation.url) ?? null,
      title: asString(navigation.title) ?? null,
      stage: asString(navigation.stage) ?? null,
      savedDesignId: asString(navigation.savedDesignId) ?? null,
      savedDesignUrl: asString(navigation.savedDesignUrl) ?? null,
      updatedAt: asString(navigation.updatedAt) ?? null,
      instructions:
        "Use currentMarkdown as the loaded design.md. Do not ask the user to paste or enrich the URL again.",
      currentMarkdown: currentMarkdown ?? "",
      deterministicMarkdown: deterministicMarkdown ?? currentMarkdown ?? "",
      designSystemData: navigation.designSystemData ?? null,
    };
  },
});
