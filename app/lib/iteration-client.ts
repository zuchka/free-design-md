/**
 * Client-side iteration state + SSE consumer for /api/iterate-design-md.
 *
 * Session state lives in localStorage keyed by URL. Each session tracks the
 * "current" memo (what the user is iterating on) and the "previous" memo
 * (what came before the current). That two-deep history is enough for the
 * side-by-side view. Full chain history lives server-side in fdmd_iterations.
 */

const STORAGE_KEY = "fdmd:iteration-session";

export interface IterationSession {
  sessionId: string;
  url: string;
  current: { id: string | null; markdown: string };
  previous: { id: string | null; markdown: string } | null;
}

type SessionMap = Record<string, IterationSession>;

function safeRandomUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers — non-crypto, but the value just needs to be
  // unique enough to scope localStorage entries.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAll(): SessionMap {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as SessionMap;
  } catch {
    return {};
  }
}

function writeAll(map: SessionMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage may be unavailable (private mode, quota) — non-fatal.
  }
}

export function getSession(url: string): IterationSession | null {
  return readAll()[url] ?? null;
}

export function getOrCreateSession(
  url: string,
  initialMarkdown: string,
): IterationSession {
  const all = readAll();
  const existing = all[url];
  if (existing) return existing;
  const fresh: IterationSession = {
    sessionId: safeRandomUUID(),
    url,
    current: { id: null, markdown: initialMarkdown },
    previous: null,
  };
  all[url] = fresh;
  writeAll(all);
  return fresh;
}

export function advanceSession(
  url: string,
  next: { id: string; markdown: string },
): IterationSession {
  const all = readAll();
  const s = all[url];
  if (!s) throw new Error("session missing for url");
  s.previous = s.current;
  s.current = next;
  all[url] = s;
  writeAll(all);
  return s;
}

export function resetSession(url: string): void {
  const all = readAll();
  delete all[url];
  writeAll(all);
}

export interface IterateRequest {
  sessionId: string;
  url: string;
  previousMarkdown: string;
  userPrompt: string;
  sectionTarget?: string;
  parentId?: string | null;
  deterministicMarkdown?: string;
  designSystemData?: unknown;
  signals?: unknown;
  screenshotDataUrl?: string | null;
}

export interface IterateDone {
  id: string;
  markdown: string;
  model: string;
  latencyMs: number;
  remaining: number | null;
  savedDesignId?: string;
  savedDesignUrl?: string;
  saveError?: string;
}

export interface IterateHandlers {
  onDelta: (text: string) => void;
  onDone: (d: IterateDone) => void;
  onError: (message: string) => void;
}

export async function iterate(
  req: IterateRequest,
  handlers: IterateHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/iterate-design-md", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
  } catch (err) {
    handlers.onError(err instanceof Error ? err.message : "network_error");
    return;
  }

  if (!res.ok) {
    let payload: { error?: string; reason?: string } | null = null;
    try {
      payload = await res.json();
    } catch {
      // body wasn't JSON
    }
    const message = payload?.error
      ? payload.reason
        ? `${payload.error}:${payload.reason}`
        : payload.error
      : `http_${res.status}`;
    handlers.onError(message);
    return;
  }
  if (!res.body) {
    handlers.onError("no_body");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const eventLine = frame.match(/^event:\s*(.+)$/m)?.[1];
      const dataLine = frame.match(/^data:\s*(.+)$/m)?.[1];
      if (!eventLine || !dataLine) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataLine);
      } catch {
        continue;
      }
      if (eventLine === "delta") {
        const text = (data as { text?: string }).text ?? "";
        handlers.onDelta(text);
      } else if (eventLine === "done") {
        handlers.onDone(data as IterateDone);
      } else if (eventLine === "error") {
        handlers.onError((data as { message?: string }).message ?? "error");
      }
    }
  }
}
