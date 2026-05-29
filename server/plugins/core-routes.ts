import { createCoreRoutesPlugin } from "@agent-native/core/server";
import { envKeys } from "../lib/env-config.js";
import { ANONYMOUS_OWNER } from "../lib/owner.js";

export default createCoreRoutesPlugin({
  envKeys,
  anonymousOwner: () => ANONYMOUS_OWNER,
});
