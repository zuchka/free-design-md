import {
  resolveBuilderCredentials,
  runWithRequestContext,
} from "@agent-native/core/server";
import { recordBuilderConnectResolution } from "./metrics.js";

export interface ConnectedBuilderOwner {
  ownerId: string;
  builderUserId: string;
  orgName: string | null;
  orgKind: string | null;
}

/**
 * Builder Connect is not the same thing as app auth: anonymous visitors can
 * connect Builder credentials that are stored under the anonymous owner used by
 * the framework routes. This helper checks the framework credential bucket and
 * returns the app-local owner for user-scoped saved artifacts.
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
      });
      if (
        !credentials.privateKey ||
        !credentials.publicKey ||
        !credentials.userId
      ) {
        await recordBuilderConnectResolution({
          status: "missing_credentials",
          orgKind: credentials.orgKind ?? null,
        });
        return null;
      }
      await recordBuilderConnectResolution({
        status: "connected",
        orgKind: credentials.orgKind ?? null,
      });
      return {
        ownerId: `builder:${credentials.userId}`,
        builderUserId: credentials.userId,
        orgName: credentials.orgName ?? null,
        orgKind: credentials.orgKind ?? null,
      };
    });
  } catch {
    await recordBuilderConnectResolution({ status: "error" });
    return null;
  }
}

export async function resolveConnectedBuilderQuotaOwner(
  owner: string,
): Promise<string | null> {
  const connected = await resolveConnectedBuilderOwner(owner);
  return connected?.ownerId ?? null;
}
