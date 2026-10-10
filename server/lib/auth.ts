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
  await db.batch([
    {
      sql: `INSERT INTO app.credit_wallets (owner_id, balance, lifetime_purchased)
              VALUES ($1, 0, 0)
              ON CONFLICT(owner_id) DO NOTHING`,
      args: [verifiedOwnerId],
    },
    {
      sql: `UPDATE app.credit_wallets
              SET balance = balance + COALESCE((SELECT balance FROM app.credit_wallets WHERE owner_id = $1), 0),
                  lifetime_purchased = lifetime_purchased + COALESCE((SELECT lifetime_purchased FROM app.credit_wallets WHERE owner_id = $1), 0),
                  updated_at = to_char(timezone('utc', statement_timestamp()), 'YYYY-MM-DD HH24:MI:SS')
              WHERE owner_id = $2`,
      args: [anonymousOwnerId, verifiedOwnerId],
    },
    {
      sql: "UPDATE app.fdmd_saved_enrichments SET owner_id = $1 WHERE owner_id = $2",
      args: [verifiedOwnerId, anonymousOwnerId],
    },
    {
      sql: "UPDATE app.credit_ledger SET owner_id = $1 WHERE owner_id = $2",
      args: [verifiedOwnerId, anonymousOwnerId],
    },
    {
      sql: "UPDATE app.credit_operations SET owner_id = $1 WHERE owner_id = $2",
      args: [verifiedOwnerId, anonymousOwnerId],
    },
    {
      sql: "UPDATE app.purchases SET owner_id = $1 WHERE owner_id = $2",
      args: [verifiedOwnerId, anonymousOwnerId],
    },
    {
      sql: "DELETE FROM app.credit_wallets WHERE owner_id = $1",
      args: [anonymousOwnerId],
    },
  ]);
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
    provider: "pg",
    schemaName: "app",
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
  advanced: {
    ipAddress: {
      // Railway overwrites this single-value header at its public edge.
      // Avoid trusting the client-controllable X-Forwarded-For chain.
      ipAddressHeaders: ["x-real-ip"],
    },
  },
  trustedOrigins: [baseURL],
});

export async function getRequestSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}
