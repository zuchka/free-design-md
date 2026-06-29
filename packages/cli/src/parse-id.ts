const DESIGN_SPECIFIER_RE = /^[A-Za-z0-9_.-]{2,80}$/;

export function parseId(input: string): string {
  if (!input || !input.trim()) {
    throw new Error("An id or share URL is required.");
  }
  const trimmed = input.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/d\/([A-Za-z0-9_-]+)\/?$/);
    if (!match) {
      throw new Error(
        `Could not extract a saved-design id from URL: ${trimmed}`,
      );
    }
    return match[1]!;
  }

  if (!DESIGN_SPECIFIER_RE.test(trimmed)) {
    throw new Error(`Invalid id or catalog slug: ${trimmed}`);
  }
  return trimmed;
}
