import { createCoreRoutesPlugin } from "@agent-native/core/server";
import { envKeys } from "../lib/env-config.js";
import { resolveAgentContextOwner } from "../lib/owner.js";

export default createCoreRoutesPlugin({
  envKeys,
  anonymousOwner: resolveAgentContextOwner,
});
