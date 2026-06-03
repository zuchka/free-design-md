import { afterEach, describe, expect, it, vi } from "vitest";
import { createSseSender, SSE_KEEPALIVE_INTERVAL_MS } from "./sse.js";

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const { value, done } = await reader.read();
  expect(done).toBe(false);
  return new TextDecoder().decode(value);
}

describe("createSseSender", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends immediate and interval keepalive comments", async () => {
    vi.useFakeTimers();

    let sender: ReturnType<typeof createSseSender> | null = null;
    const stream = new ReadableStream({
      start(controller) {
        sender = createSseSender(controller);
      },
    });

    const reader = stream.getReader();
    expect(await readChunk(reader)).toMatch(/^: keepalive \d+\n\n$/);

    await vi.advanceTimersByTimeAsync(SSE_KEEPALIVE_INTERVAL_MS);
    expect(await readChunk(reader)).toMatch(/^: keepalive \d+\n\n$/);

    sender?.stop();
    sender?.close();
    const closed = await reader.read();
    expect(closed.done).toBe(true);
  });

  it("formats named SSE events as JSON payloads", async () => {
    const stream = new ReadableStream({
      start(controller) {
        const sender = createSseSender(controller);
        sender.send("delta", { text: "hello" });
        sender.stop();
        sender.close();
      },
    });

    const reader = stream.getReader();
    await readChunk(reader);
    expect(await readChunk(reader)).toBe(
      'event: delta\ndata: {"text":"hello"}\n\n',
    );
  });
});
