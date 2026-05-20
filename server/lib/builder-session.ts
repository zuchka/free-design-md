import { randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "fdmd_session";
export const STATE_COOKIE_NAME = "fdmd_oauth_state";

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const STATE_MAX_AGE_SECONDS = 10 * 60;

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiryDate(from: Date = new Date()): string {
  return new Date(from.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
}
