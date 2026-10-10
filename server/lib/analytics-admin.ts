import { getRequestSession } from "./auth.js";

export function analyticsAdminUser(
  user:
    | {
        id: string;
        email: string;
        emailVerified?: boolean;
        isAnonymous?: boolean | null;
      }
    | null
    | undefined,
) {
  if (!user?.emailVerified || user.isAnonymous) return false;
  const ids = (process.env.GROWTH_ANALYTICS_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const emails = (process.env.GROWTH_ANALYTICS_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return ids.includes(user.id) || emails.includes(user.email.toLowerCase());
}
export async function requireAnalyticsAdmin(request: Request) {
  const session = await getRequestSession(request);
  if (!analyticsAdminUser(session?.user))
    throw new Response(
      "Sign in with an allowed verified account to view analytics.",
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
}
