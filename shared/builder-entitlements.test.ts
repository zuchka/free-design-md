import { describe, expect, it } from "vitest";
import {
  builderPlanLabel,
  classifyBuilderAccount,
  hasUnlimitedBuilderCredits,
} from "./builder-entitlements";

describe("Builder account entitlement classification", () => {
  it("grants unlimited credits to explicit paid accounts", () => {
    const metadata = {
      subscriptionName: "Pro",
      isFreeAccount: false,
    };

    expect(classifyBuilderAccount(metadata)).toBe("paid");
    expect(hasUnlimitedBuilderCredits(metadata)).toBe(true);
    expect(builderPlanLabel(metadata)).toBe("Pro");
  });

  it("grants unlimited credits to enterprise accounts", () => {
    const metadata = {
      subscriptionLevel: "enterprise",
      isEnterprise: true,
      isFreeAccount: false,
    };

    expect(classifyBuilderAccount(metadata)).toBe("enterprise");
    expect(hasUnlimitedBuilderCredits(metadata)).toBe(true);
    expect(builderPlanLabel(metadata)).toBe("enterprise");
  });

  it("keeps free accounts on finite credits", () => {
    const metadata = {
      subscriptionName: "Free",
      isFreeAccount: true,
    };

    expect(classifyBuilderAccount(metadata)).toBe("free");
    expect(hasUnlimitedBuilderCredits(metadata)).toBe(false);
  });

  it("does not grant unlimited credits when metadata is missing", () => {
    expect(classifyBuilderAccount({})).toBe("unknown");
    expect(hasUnlimitedBuilderCredits({})).toBe(false);
  });
});
