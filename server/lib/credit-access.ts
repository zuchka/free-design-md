import {
  type ConnectedBuilderOwner,
  resolveConnectedBuilderOwner,
} from "./builder-connection.js";
import { ANONYMOUS_OWNER } from "./owner.js";
import {
  decrementCredits,
  getCredits,
  refundCredit,
} from "./quota.js";

export interface CreditAccount {
  owner: string;
  quotaOwner: string;
  builderOwner: ConnectedBuilderOwner | null;
  unlimited: boolean;
}

export interface CreditStatus {
  remaining: number | null;
  allowed: number | null;
  unlimited: boolean;
  accountTier: ConnectedBuilderOwner["accountTier"] | "anonymous";
  planLabel: string | null;
  builderOrgName: string | null;
}

export interface CreditSpendResult {
  ok: boolean;
  remaining: number | null;
  unlimited: boolean;
}

export async function resolveCreditAccount(
  owner: string,
): Promise<CreditAccount> {
  const builderOwner = await resolveConnectedBuilderOwner(owner);
  return {
    owner,
    quotaOwner: builderOwner?.ownerId ?? owner,
    builderOwner,
    unlimited: builderOwner?.hasUnlimitedCredits ?? false,
  };
}

export function requiresBuilderConnectForServerKey(
  account: CreditAccount,
): boolean {
  return account.owner === ANONYMOUS_OWNER && !account.builderOwner;
}

export async function getCreditStatus(
  account: CreditAccount,
): Promise<CreditStatus> {
  if (account.unlimited && account.builderOwner) {
    return {
      remaining: null,
      allowed: null,
      unlimited: true,
      accountTier: account.builderOwner.accountTier,
      planLabel: account.builderOwner.planLabel,
      builderOrgName: account.builderOwner.orgName,
    };
  }

  const credits = await getCredits(account.quotaOwner);
  return {
    ...credits,
    unlimited: false,
    accountTier: account.builderOwner?.accountTier ?? "anonymous",
    planLabel: account.builderOwner?.planLabel ?? null,
    builderOrgName: account.builderOwner?.orgName ?? null,
  };
}

export async function spendCredit(
  account: CreditAccount,
): Promise<CreditSpendResult> {
  if (account.unlimited) {
    return { ok: true, remaining: null, unlimited: true };
  }
  return {
    ...(await decrementCredits(account.quotaOwner)),
    unlimited: false,
  };
}

export async function refundSpentCredit(
  account: CreditAccount,
  spend: CreditSpendResult | null,
): Promise<void> {
  if (!spend?.ok || spend.unlimited) return;
  await refundCredit(account.quotaOwner);
}
