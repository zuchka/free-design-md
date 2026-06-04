import { defineNitroPlugin } from "@agent-native/core";
import { getOrCreateAnonToken } from "../lib/owner.js";

/**
 * Sets a `fdmd_anon` cookie for every visitor (anonymous and SSO'd alike).
 * This gives every browser a stable identity for BYO Anthropic key storage.
 * 30-day expiry, HttpOnly, SameSite=Lax, path=/, Secure in HTTPS environments.
 */
export default defineNitroPlugin((app) => {
  app.hooks.hook("request", (event) => {
    getOrCreateAnonToken(event);
  });
});
