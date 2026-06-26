import type { SavedDesign } from "./types.js";

export async function fetchDesign(
  host: string,
  id: string,
): Promise<SavedDesign> {
  const url = `${host}/api/saved-enrichments/${encodeURIComponent(id)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 404) {
      throw new Error(`Design "${id}" was not found at ${host}.`);
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
    return json as SavedDesign;
  } finally {
    clearTimeout(timeout);
  }
}
