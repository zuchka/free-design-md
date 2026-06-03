export const SSE_KEEPALIVE_INTERVAL_MS = 10_000;

export function createSseSender(controller: ReadableStreamDefaultController) {
  const encoder = new TextEncoder();
  let closed = false;

  const enqueue = (text: string) => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      closed = true;
    }
  };

  const send = (eventName: string, payload: unknown) => {
    enqueue(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  const keepAlive = () => {
    enqueue(`: keepalive ${Date.now()}\n\n`);
  };

  const close = () => {
    if (closed) return;
    closed = true;
    controller.close();
  };

  keepAlive();
  const interval = setInterval(keepAlive, SSE_KEEPALIVE_INTERVAL_MS);

  return {
    send,
    close,
    stop: () => {
      clearInterval(interval);
    },
  };
}
