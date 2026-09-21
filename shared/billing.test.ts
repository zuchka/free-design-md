import { describe, expect, it } from "vitest";
import { AI_RUN_PACK } from "./billing";

describe("AI_RUN_PACK", () => {
  it("defines the launch offer in one shared place", () => {
    expect(AI_RUN_PACK).toMatchObject({
      id: "credits-10",
      name: "10 AI runs",
      runs: 10,
      priceUsd: 5,
      priceLabel: "$5",
    });
  });
});
