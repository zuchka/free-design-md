import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  publicPaths: [
    "/",
    "/docs",
    "/examples",
    "/quality",
    "/d",
    "/api",
    "/_agent-native",
  ],
});
