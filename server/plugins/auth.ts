import { createAuthPlugin } from "@agent-native/core/server";

export default createAuthPlugin({
  publicPaths: ["/", "/d", "/api", "/_agent-native"],
});
