import { describe, expect, it } from "vitest";
import { getCreditPack } from "./stripe";

describe("Stripe credit pack catalog", () => {
  it("resolves credit quantities only from known server-side pack IDs", () => {
    expect(getCreditPack("credits-1")?.credits).toBe(1);
    expect(getCreditPack("credits-10")?.credits).toBe(10);
    expect(getCreditPack("credits-1000")).toBeNull();
  });
});
