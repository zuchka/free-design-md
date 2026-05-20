import { defineEventHandler, getQuery, sendRedirect } from "h3";

/**
 * GET /sign-in[?return=<pathname>]
 *
 * When unauthenticated: the framework's auth guard intercepts this route
 * (it is intentionally absent from publicPaths) and serves the built-in
 * email/password sign-in page. After sign-in the framework calls
 * window.location.reload(), landing here again — now authenticated.
 *
 * When authenticated: redirect to ?return (must start with "/") or fall
 * back to "/" so the user lands back where they started.
 */
export default defineEventHandler((event) => {
  const { return: returnPath } = getQuery(event);
  const safe =
    typeof returnPath === "string" && returnPath.startsWith("/")
      ? returnPath
      : "/";
  return sendRedirect(event, safe, 302);
});
