import {
  resolveBuilderCredentials,
  runWithRequestContext,
} from "@agent-native/core/server";
import {
  builderPlanLabel,
  classifyBuilderAccount,
  hasUnlimitedBuilderCredits,
  type BuilderAccountTier,
} from "../../shared/builder-entitlements.js";

export interface ConnectedBuilderOwner {
  ownerId: string;
  builderUserId: string;
  orgName: string | null;
  orgKind: string | null;
  subscription: string | null;
  subscriptionLevel: string | null;
  subscriptionName: string | null;
  isEnterprise: boolean | null;
  isFreeAccount: boolean | null;
  accountTier: BuilderAccountTier;
  planLabel: string | null;
  hasUnlimitedCredits: boolean;
}

/**
 * Builder Connect is not the same thing as app auth: anonymous visitors can
 * connect Builder credentials that are stored under the anonymous owner used by
 * the framework routes. This helper checks that request-scoped credential
 * bucket and returns the app-local owner for user-scoped saved artifacts.
 */
export async function resolveConnectedBuilderOwner(
  owner: string,
): Promise<ConnectedBuilderOwner | null> {
  try {
    return await runWithRequestContext({ userEmail: owner }, async () => {
      const credentials = await resolveBuilderCredentials();
      console.log("[builder-connect] resolved credentials", {
        owner,
        hasPrivateKey: Boolean(credentials.privateKey),
        hasPublicKey: Boolean(credentials.publicKey),
        userId: credentials.userId ?? null,
        orgName: credentials.orgName ?? null,
        orgKind: credentials.orgKind ?? null,
        subscription: credentials.subscription ?? null,
        subscriptionLevel: credentials.subscriptionLevel ?? null,
        subscriptionName: credentials.subscriptionName ?? null,
        isEnterprise: credentials.isEnterprise ?? null,
        isFreeAccount: credentials.isFreeAccount ?? null,
      });
      if (
        !credentials.privateKey ||
        !credentials.publicKey ||
        !credentials.userId
      ) {
        return null;
      }
      const planMetadata = {
        subscription: credentials.subscription ?? null,
        subscriptionLevel: credentials.subscriptionLevel ?? null,
        subscriptionName: credentials.subscriptionName ?? null,
        isEnterprise: credentials.isEnterprise ?? null,
        isFreeAccount: credentials.isFreeAccount ?? null,
      };
      return {
        ownerId: `builder:${credentials.userId}`,
        builderUserId: credentials.userId,
        orgName: credentials.orgName ?? null,
        orgKind: credentials.orgKind ?? null,
        ...planMetadata,
        accountTier: classifyBuilderAccount(planMetadata),
        planLabel: builderPlanLabel(planMetadata),
        hasUnlimitedCredits: hasUnlimitedBuilderCredits(planMetadata),
      };
    });
  } catch {
    return null;
  }
}

export async function resolveConnectedBuilderQuotaOwner(
  owner: string,
): Promise<string | null> {
  const connected = await resolveConnectedBuilderOwner(owner);
  return connected?.ownerId ?? null;
}
