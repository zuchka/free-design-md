import type { LoaderFunctionArgs } from "react-router";
import { getRequestSession } from "../../server/lib/auth.js";
import { analyticsAdminUser } from "../../server/lib/analytics-admin.js";
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getRequestSession(request);
  return Response.json(
    { allowed: analyticsAdminUser(session?.user) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
