export const SINGLE_AI_RUN_PACK = {
  id: "credits-1",
  name: "1 AI run",
  runs: 1,
  priceUsd: 0.89,
  priceLabel: "$0.89",
  description: "One AI enrichment or revision.",
} as const;

export const AI_RUN_PACK = {
  id: "credits-10",
  name: "10 AI runs",
  runs: 10,
  priceUsd: 4.99,
  priceLabel: "$4.99",
  description: "Best value · about $0.50 per run.",
} as const;

export const AI_RUN_PACKS = [SINGLE_AI_RUN_PACK, AI_RUN_PACK] as const;

export type AiRunPack = (typeof AI_RUN_PACKS)[number];
export type AiRunPackId = AiRunPack["id"];

export function getAiRunPack(packId: string): AiRunPack | null {
  return AI_RUN_PACKS.find((pack) => pack.id === packId) ?? null;
}
