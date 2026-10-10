import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import ReactDOMServer from "react-dom/server.browser";
const { renderToReadableStream } = ReactDOMServer;
import { isbot } from "isbot";
import { bootstrapVisitor } from "../server/lib/analytics-identity.js";
import { analyticsSession } from "../server/lib/analytics.js";

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders,
    });
  }

  const userAgent = request.headers.get("user-agent");
  if (new URL(request.url).pathname === "/") {
    const session = await analyticsSession(request);
    const params = new URL(request.url).searchParams;
    const visitor = await bootstrapVisitor(request, session?.user, {
      referrer: request.headers.get("referer") || undefined,
      source: params.get("utm_source") || undefined,
      medium: params.get("utm_medium") || undefined,
      campaign: params.get("utm_campaign") || undefined,
    });
    if (visitor.cookie) {
      responseHeaders.append("Set-Cookie", visitor.cookie);
      responseHeaders.set("Cache-Control", "private, no-store");
    }
  }
  const waitForAll = (userAgent && isbot(userAgent)) || routerContext.isSpaMode;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), streamTimeout);

  try {
    const body = await renderToReadableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        signal: abortController.signal,
        onError(error: unknown) {
          if (!abortController.signal.aborted) {
            responseStatusCode = 500;
            console.error(error);
          }
        },
      },
    );

    if (waitForAll) {
      await body.allReady;
    }

    responseHeaders.set("Content-Type", "text/html");
    return new Response(body, {
      headers: responseHeaders,
      status: responseStatusCode,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
