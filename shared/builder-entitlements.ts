export type BuilderAccountTier = "free" | "paid" | "enterprise" | "unknown";

export interface BuilderPlanMetadata {
  subscription?: string | null;
  subscriptionLevel?: string | null;
  subscriptionName?: string | null;
  isEnterprise?: boolean | null;
  isFreeAccount?: boolean | null;
}

const FREE_MARKERS = new Set(["free", "trial", "developer"]);
const ENTERPRISE_MARKERS = new Set(["enterprise", "ent"]);
const PAID_MARKERS = new Set([
  "paid",
  "pro",
  "growth",
  "business",
  "premium",
  "scale",
  "startup",
]);

export function classifyBuilderAccount(
  metadata: BuilderPlanMetadata,
): BuilderAccountTier {
  if (metadata.isEnterprise === true) return "enterprise";
  if (metadata.isFreeAccount === true) return "free";
  if (metadata.isFreeAccount === false) return "paid";

  const tokens = planTokens(metadata);
  if (tokens.some((token) => ENTERPRISE_MARKERS.has(token))) {
    return "enterprise";
  }
  if (tokens.some((token) => PAID_MARKERS.has(token))) {
    return "paid";
  }
  if (tokens.some((token) => FREE_MARKERS.has(token))) {
    return "free";
  }
  return "unknown";
}

export function hasUnlimitedBuilderCredits(
  metadata: BuilderPlanMetadata,
): boolean {
  const tier = classifyBuilderAccount(metadata);
  return tier === "paid" || tier === "enterprise";
}

export function builderPlanLabel(
  metadata: BuilderPlanMetadata,
): string | null {
  return (
    metadata.subscriptionName ||
    metadata.subscriptionLevel ||
    metadata.subscription ||
    (metadata.isEnterprise
      ? "Enterprise"
      : metadata.isFreeAccount === true
        ? "Free"
        : metadata.isFreeAccount === false
          ? "Paid"
          : null)
  );
}

function planTokens(metadata: BuilderPlanMetadata): string[] {
  return [
    metadata.subscription,
    metadata.subscriptionLevel,
    metadata.subscriptionName,
  ].flatMap((value) => {
    if (!value) return [];
    return String(value)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  });
}
