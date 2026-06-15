import { afterEach, describe, expect, it } from "vitest";

const {
  containsRequestAnthropicApiKey,
  isSelfHostedMode,
  resolveAnthropicKey,
} = await import("./anthropic-key.js");

const ORIGINAL_ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_SELF_HOSTED = process.env.FREE_DESIGN_MD_SELF_HOSTED;

afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ANTHROPIC_KEY;
  process.env.FREE_DESIGN_MD_SELF_HOSTED = ORIGINAL_SELF_HOSTED;
});

describe("resolveAnthropicKey", () => {
  it("uses the server key and consumes quota in hosted mode", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-server-key";
    delete process.env.FREE_DESIGN_MD_SELF_HOSTED;

    await expect(resolveAnthropicKey({} as never)).resolves.toEqual({
      apiKey: "sk-server-key",
      source: "server",
      consumesQuota: true,
    });
  });

  it("uses the server environment key without quota in self-host mode", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-self-host-key";
    process.env.FREE_DESIGN_MD_SELF_HOSTED = "1";

    await expect(resolveAnthropicKey({} as never)).resolves.toEqual({
      apiKey: "sk-self-host-key",
      source: "self-host",
      consumesQuota: false,
    });
  });

  it("throws a setup-specific error when self-host mode has no Anthropic key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.FREE_DESIGN_MD_SELF_HOSTED = "1";

    await expect(resolveAnthropicKey({} as never)).rejects.toThrow(
      /self_hosted_anthropic_key_missing/,
    );
  });

  it("throws no_api_key_available in hosted mode without a server key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.FREE_DESIGN_MD_SELF_HOSTED;

    await expect(resolveAnthropicKey({} as never)).rejects.toThrow(
      /no_api_key_available/,
    );
  });
});

describe("isSelfHostedMode", () => {
  it("is explicit and only enabled by FREE_DESIGN_MD_SELF_HOSTED=1", () => {
    process.env.FREE_DESIGN_MD_SELF_HOSTED = "true";
    expect(isSelfHostedMode()).toBe(false);

    process.env.FREE_DESIGN_MD_SELF_HOSTED = "1";
    expect(isSelfHostedMode()).toBe(true);
  });
});

describe("containsRequestAnthropicApiKey", () => {
  it("detects Anthropic keys submitted in HTTP headers", () => {
    expect(containsRequestAnthropicApiKey({}, "sk-request-key")).toBe(true);
  });

  it("detects Anthropic keys submitted in JSON bodies", () => {
    expect(
      containsRequestAnthropicApiKey({ anthropicApiKey: "sk-request-key" }, ""),
    ).toBe(true);
  });

  it("does not flag ordinary extraction payloads", () => {
    expect(
      containsRequestAnthropicApiKey({ url: "https://example.com" }, ""),
    ).toBe(false);
  });
});
