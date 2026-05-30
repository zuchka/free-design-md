import { defineNitroPlugin } from "@agent-native/core";
import { getCookie, setCookie } from "h3";
import { randomUUID } from "node:crypto";
import { FDMD_ANON_COOKIE } from "../lib/cookie-names";

/**
 * Sets a `fdmd_anon` cookie for every visitor (anonymous and SSO'd alike).
 * This gives every browser a stable identity for BYO Anthropic key storage.
 * 30-day expiry, HttpOnly, SameSite=Lax, path=/, Secure in HTTPS environments.
 */
export default defineNitroPlugin((app) => {
  app.hooks.hook("request", (event) => {
    const existing = getCookie(event, FDMD_ANON_COOKIE);
    if (!existing) {
      setCookie(event, FDMD_ANON_COOKIE, randomUUID(), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        secure: process.env.PUBLIC_ORIGIN?.startsWith("https") ?? false,
      });
    }
  });
});
