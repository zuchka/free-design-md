import type { SavedDesign } from "./types.js";

export async function fetchDesign(
  host: string,
  id: string,
): Promise<SavedDesign> {
  const savedUrl = `${host}/api/saved-enrichments/${encodeURIComponent(id)}`;
  const catalogUrl = `${host}/api/catalog-designs/${encodeURIComponent(id)}`;
  const saved = await tryFetchDesign(savedUrl);
  if (saved.status === "found") return saved.design;
  const catalog = await tryFetchDesign(catalogUrl);
  if (catalog.status === "found") return catalog.design;
  throw new Error(`Design "${id}" was not found at ${host}.`);
}

type FetchDesignResult =
  | { status: "found"; design: SavedDesign }
  | { status: "not-found" };

async function tryFetchDesign(url: string): Promise<FetchDesignResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) {
      return { status: "not-found" };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Fetch failed (${res.status} ${res.statusText})${body ? `: ${body}` : ""}`,
      );
    }
    const json = (await res.json()) as Partial<SavedDesign>;
    if (
      typeof json.id !== "string" ||
      typeof json.title !== "string" ||
      typeof json.enrichedMarkdown !== "string" ||
      typeof json.deterministicMarkdown !== "string"
    ) {
      throw new Error(
        "Unexpected response shape from saved-enrichments endpoint.",
      );
    }
    return { status: "found", design: json as SavedDesign };
  } finally {
    clearTimeout(timeout);
  }
}
