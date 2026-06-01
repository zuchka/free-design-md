import {
  resolveBuilderCredentials,
  runWithRequestContext,
} from "@agent-native/core/server";

/**
 * Builder Connect is not the same thing as app auth: anonymous visitors can
 * connect Builder credentials that are stored under the anonymous owner used by
 * the framework routes. This helper checks that request-scoped credential
 * bucket and returns a stable quota owner when the connection is complete.
 */
export async function resolveConnectedBuilderQuotaOwner(
  owner: string,
): Promise<string | null> {
  try {
    return await runWithRequestContext({ userEmail: owner }, async () => {
      const credentials = await resolveBuilderCredentials();
      if (!credentials.privateKey || !credentials.publicKey) {
        return null;
      }
      return credentials.userId ? `builder:${credentials.userId}` : owner;
    });
  } catch {
    return null;
  }
}
