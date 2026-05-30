import { defineNitroPlugin } from "@agent-native/core";
import { getCookie, setCookie } from "h3";
import { randomUUID } from "node:crypto";

/**
 * Sets a `fdmd_anon` cookie for every visitor (anonymous and SSO'd alike).
 * This gives every browser a stable identity for BYO Anthropic key storage.
 * 30-day expiry, HttpOnly, SameSite=Lax, path=/.
 */
export default defineNitroPlugin((app) => {
  app.hooks.hook("request", (event) => {
    const existing = getCookie(event, "fdmd_anon");
    if (!existing) {
      setCookie(event, "fdmd_anon", randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }
  });
});
