# Interview demo script

Target length: 15 minutes. Use the sanitized fixture and Railway
`supabase-preview`, never production data.

## Before the interview

- Confirm the preview image uses the intended immutable SHA tag.
- Run `pnpm demo:reset` and save the terminal output.
- Confirm hosted migrations and Supabase advisors.
- Run the preview smoke test twice, including one service restart.
- Keep a screen recording of the same successful sequence available.
- Keep production Railway and Supabase dashboards closed.

## 0:00–2:00 — Current architecture

Show the architecture slide. Explain that the deployed app stores Better Auth
identities, sessions, public designs, private designs, credits, purchases, and
metrics in one SQLite file on a Railway volume.

State the operational constraint: one service and one attached volume. The
database cannot scale or move independently from the container.

## 2:00–3:00 — Migration contract

Use this challenge statement:

> Migrate the application to Supabase Postgres without losing data, breaking
> sessions, crossing owner boundaries, or double-granting credits.

Explain the pass/fail gates before showing the agent work.

## 3:00–8:30 — Agent run

Show the agent:

1. comparing the actual SQLite schema with the ORM and runtime queries;
2. identifying authentication, ownership, and billing invariants;
3. applying versioned migrations through project-scoped Supabase MCP;
4. taking a consistent backup and refusing a nonempty target;
5. importing the sanitized data in one transaction;
6. running independent row-digest and invariant verification.

Keep verbose dependency installation and Docker build output off screen.

## 8:30–10:30 — Scoreboard

Run:

```bash
pnpm demo:verify
```

The terminal should show:

```text
PASS  Tables and indexes
PASS  Rows and content digests
PASS  Owner isolation data
PASS  Authentication relationships
PASS  Billing invariants
PASS  Public artifact identifiers

PASS  Migration verification
```

Open the private JSON report only if the interviewer asks how the checks work.

## 10:30–13:00 — Railway preview

- Load `/api/health` and show that it checks Postgres schema access.
- Restore an imported session.
- Open an imported public artifact by the same ID.
- Save and delete a private artifact.
- Exercise reserve and refund with a synthetic account.
- Restart the service and repeat the public and private reads.

## 13:00–15:00 — Evidence and judgment

Show the versioned SQL migrations, the Supabase migration history, the private
schema grants, and the rollback boundary.

Call out the security judgment explicitly: the application tables live in a
private schema revoked from `public`, `anon`, and `authenticated`; Better Auth
uses a restricted server login. The table inventory emits a generic RLS-disabled
warning, but enabling RLS without a Supabase JWT identity would block the server
application rather than improve tenant isolation. Owner checks remain in the
application and acceptance suite.

Do not claim the migration skill outperforms the baseline until the repeated
evaluation in `docs/evaluation-rubric.md` has completed.
