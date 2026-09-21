import { createAuthClient } from "better-auth/react";
import { anonymousClient, magicLinkClient } from "better-auth/client/plugins";
import { appPath } from "./base-path";

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
  basePath: appPath("/api/auth"),
  plugins: [anonymousClient(), magicLinkClient()],
});
