import type { ActionFunctionArgs } from "react-router";
import { bootstrapVisitor } from "../../server/lib/analytics-identity.js";
import { analyticsSession } from "../../server/lib/analytics.js";
import {
  analyticsHeaders,
  readAnalyticsBody,
} from "../../server/lib/analytics-http.js";
export async function action({ request }: ActionFunctionArgs) {
  const body = await readAnalyticsBody(request);
  const session = await analyticsSession(request);
  const result = await bootstrapVisitor(request, session?.user, body);
  const headers = new Headers(analyticsHeaders);
  if (result.cookie) headers.append("Set-Cookie", result.cookie);
  return Response.json({ enabled: result.enabled }, { headers });
}
