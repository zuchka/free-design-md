/**
 * Resolve the public origin of this app for redirect_url construction.
 *
 * Prefers `PUBLIC_ORIGIN` env var (set this in production to whatever
 * Builder.io has allowlisted in `CLIAuthPage.tsx`'s isAllowedRedirectUrl).
 * Falls back to the request's own origin — convenient for local dev where
 * `http://localhost:8080` is already allowlisted.
 */
export function publicOrigin(requestOrigin: string): string {
  const fromEnv = process.env.PUBLIC_ORIGIN;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return requestOrigin.replace(/\/$/, "");
}

export function buildCallbackUrl(origin: string, state: string): string {
  return `${origin}/api/auth/builder/callback?state=${encodeURIComponent(state)}`;
}

export function buildCliAuthUrl(args: {
  origin: string;
  clientId: string;
  state: string;
}): string {
  const url = new URL("https://builder.io/cli-auth");
  url.searchParams.set(
    "redirect_url",
    buildCallbackUrl(args.origin, args.state),
  );
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("host", "free-design-md");
  url.searchParams.set("framework", "react");
  url.searchParams.set("signupSource", "agent-native");
  url.searchParams.set("agentNativeFlow", "design_extraction");
  return url.toString();
}
