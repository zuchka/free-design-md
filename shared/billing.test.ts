import { describe, expect, it } from "vitest";
import {
  AI_RUN_PACK,
  AI_RUN_PACKS,
  SINGLE_AI_RUN_PACK,
  getAiRunPack,
} from "./billing";

describe("AI run packs", () => {
  it("defines the single-run and value packs in one shared place", () => {
    expect(SINGLE_AI_RUN_PACK).toMatchObject({
      id: "credits-1",
      name: "1 AI run",
      runs: 1,
      priceUsd: 0.89,
      priceLabel: "$0.89",
    });
    expect(AI_RUN_PACK).toMatchObject({
      id: "credits-10",
      name: "10 AI runs",
      runs: 10,
      priceUsd: 4.99,
      priceLabel: "$4.99",
    });
    expect(AI_RUN_PACKS).toHaveLength(2);
  });

  it("only resolves known server-catalog pack IDs", () => {
    expect(getAiRunPack("credits-1")).toBe(SINGLE_AI_RUN_PACK);
    expect(getAiRunPack("credits-10")).toBe(AI_RUN_PACK);
    expect(getAiRunPack("credits-1000")).toBeNull();
  });
});
