import { defineEventHandler, sendRedirect, setCookie, getQuery } from "h3";
import { randomUUID } from "node:crypto";

const BUILDER_CLI_AUTH = "https://builder.io/cli-auth";

export default defineEventHandler((event) => {
  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  const { return: returnPath } = getQuery(event);
  const nonce = randomUUID();

  setCookie(event, "fdmd_auth_state", nonce, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  const statePayload = JSON.stringify({
    nonce,
    return: typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/",
  });
  const encodedState = Buffer.from(statePayload).toString("base64url");

  const callbackUrl = `${origin}/api/auth/builder/callback?state=${encodedState}`;
  const redirectUrl = new URL(BUILDER_CLI_AUTH);
  redirectUrl.searchParams.set("redirect_url", callbackUrl);
  redirectUrl.searchParams.set("client_id", process.env.BUILDER_CLIENT_ID ?? "free-design-md");
  redirectUrl.searchParams.set("signupSource", "agent-native");
  redirectUrl.searchParams.set("agentNativeFlow", "design_extraction");

  return sendRedirect(event, redirectUrl.toString(), 302);
});
