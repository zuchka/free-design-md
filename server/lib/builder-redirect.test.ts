import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  publicOrigin,
  buildCliAuthUrl,
  buildCallbackUrl,
} from "./builder-redirect.js";

describe("publicOrigin", () => {
  const previousOrigin = process.env.PUBLIC_ORIGIN;
  beforeEach(() => {
    delete process.env.PUBLIC_ORIGIN;
  });
  afterEach(() => {
    if (previousOrigin === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = previousOrigin;
  });

  it("returns PUBLIC_ORIGIN when set", () => {
    process.env.PUBLIC_ORIGIN = "https://example.com";
    expect(publicOrigin("http://fallback")).toBe("https://example.com");
  });

  it("falls back to the request origin when PUBLIC_ORIGIN is unset", () => {
    expect(publicOrigin("http://localhost:8080")).toBe("http://localhost:8080");
  });

  it("strips a trailing slash from PUBLIC_ORIGIN", () => {
    process.env.PUBLIC_ORIGIN = "https://example.com/";
    expect(publicOrigin("http://fallback")).toBe("https://example.com");
  });
});

describe("buildCallbackUrl", () => {
  it("appends ?state to the callback URL", () => {
    expect(
      buildCallbackUrl("https://example.com", "nonce-abc"),
    ).toBe(
      "https://example.com/api/auth/builder/callback?state=nonce-abc",
    );
  });
});

describe("buildCliAuthUrl", () => {
  it("constructs the /cli-auth URL with all attribution params + redirect_url", () => {
    const url = buildCliAuthUrl({
      origin: "https://example.com",
      clientId: "free-design-md",
      state: "nonce-abc",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://builder.io");
    expect(parsed.pathname).toBe("/cli-auth");
    const params = parsed.searchParams;
    expect(params.get("redirect_url")).toBe(
      "https://example.com/api/auth/builder/callback?state=nonce-abc",
    );
    expect(params.get("client_id")).toBe("free-design-md");
    expect(params.get("host")).toBe("free-design-md");
    expect(params.get("framework")).toBe("react");
    expect(params.get("signupSource")).toBe("agent-native");
    expect(params.get("agentNativeFlow")).toBe("design_extraction");
  });
});
