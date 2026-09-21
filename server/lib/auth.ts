import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, magicLink } from "better-auth/plugins";
import { getDb, getDbExec, schema } from "../db/index.js";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.PUBLIC_ORIGIN ??
  "http://localhost:8080";

async function transferAnonymousData(
  anonymousOwnerId: string,
  verifiedOwnerId: string,
) {
  if (anonymousOwnerId === verifiedOwnerId) return;

  const db = getDbExec();
  await db.batch(
    [
      {
        sql: `INSERT INTO credit_wallets (owner_id, balance, lifetime_purchased)
              VALUES (?, 0, 0)
              ON CONFLICT(owner_id) DO NOTHING`,
        args: [verifiedOwnerId],
      },
      {
        sql: `UPDATE credit_wallets
              SET balance = balance + COALESCE((SELECT balance FROM credit_wallets WHERE owner_id = ?), 0),
                  lifetime_purchased = lifetime_purchased + COALESCE((SELECT lifetime_purchased FROM credit_wallets WHERE owner_id = ?), 0),
                  updated_at = datetime('now')
              WHERE owner_id = ?`,
        args: [anonymousOwnerId, anonymousOwnerId, verifiedOwnerId],
      },
      {
        sql: "UPDATE fdmd_saved_enrichments SET owner_id = ? WHERE owner_id = ?",
        args: [verifiedOwnerId, anonymousOwnerId],
      },
      {
        sql: "UPDATE credit_ledger SET owner_id = ? WHERE owner_id = ?",
        args: [verifiedOwnerId, anonymousOwnerId],
      },
      {
        sql: "UPDATE credit_operations SET owner_id = ? WHERE owner_id = ?",
        args: [verifiedOwnerId, anonymousOwnerId],
      },
      {
        sql: "UPDATE purchases SET owner_id = ? WHERE owner_id = ?",
        args: [verifiedOwnerId, anonymousOwnerId],
      },
      {
        sql: "DELETE FROM credit_wallets WHERE owner_id = ?",
        args: [anonymousOwnerId],
      },
    ],
    "write",
  );
}

async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[auth] Magic link for ${email}: ${url}`);
      return;
    }
    throw new Error("RESEND_API_KEY is required to send sign-in links");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        process.env.AUTH_EMAIL_FROM ?? "Free design.md <noreply@free.design>",
      to: email,
      subject: "Sign in to Free design.md",
      html: `<p>Use this link to sign in and access your AI runs:</p><p><a href="${url}">Sign in to Free design.md</a></p><p>This link expires shortly.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send sign-in email (${response.status})`);
  }
}

export const auth = betterAuth({
  appName: "Free design.md",
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "free-design-md-local-development-secret-change-me"),
  database: drizzleAdapter(getDb(), {
    provider: "sqlite",
    schema: {
      user: schema.authUsers,
      session: schema.authSessions,
      account: schema.authAccounts,
      verification: schema.authVerifications,
    },
  }),
  plugins: [
    anonymous({
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await transferAnonymousData(anonymousUser.user.id, newUser.user.id);
      },
    }),
    magicLink({ sendMagicLink: sendMagicLinkEmail }),
  ],
  trustedOrigins: [baseURL],
});

export async function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
