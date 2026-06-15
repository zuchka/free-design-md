import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  publicPaths: ["/", "/docs", "/quality", "/d", "/api", "/_agent-native"],
});
