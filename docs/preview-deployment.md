# Railway Supabase preview

## Created infrastructure

- Railway project: `freedesign.md`
- Environment: `supabase-preview`
- Environment ID: `6c9317d3-b475-4641-aa80-b29b3bec9608`
- Supabase project: `free-design-md-migration-demo`
- Supabase project ref: `eigswwtmuptcizadsctd`
- Region: Railway `us-west2`, Supabase `us-west-1`

The Railway environment was created empty. Production services, variables,
credentials, domains, and the SQLite volume were deliberately not copied.

## Preview image

The Docker release workflow publishes non-main manual builds as:

```text
ghcr.io/zuchka/free-design-md:supabase-preview
```

It also publishes an immutable `sha-<commit>` tag. Production continues to use
`latest`; a preview workflow dispatch cannot overwrite that tag.

## Required preview variables

Set these only in `supabase-preview`:

```text
DATABASE_URL
DATABASE_POOL_SIZE=5
BETTER_AUTH_SECRET
BETTER_AUTH_URL
PUBLIC_ORIGIN
```

Add `ANTHROPIC_API_KEY`, Resend, and Stripe test-mode variables only when those
flows are part of the rehearsal. Never copy the production Stripe webhook
secret or attach the production SQLite volume.

The database URL should use a dedicated password-bearing login that inherits
the `free_design_app` group role. Do not use an administrative connection in
the application.

## Deployment gate

The preview is ready for traffic only when all checks pass:

1. `GET /api/health` returns `200` with `{"ok":true,"database":"ready"}`.
2. Railway logs contain no database connection churn or authentication errors.
3. Supabase shows a small, stable session-pooler connection count.
4. A synthetic imported account restores its session.
5. An imported public artifact loads by its existing ID.
6. Owner-scoped create, list, and delete operations pass.
7. Credit reserve, commit, and refund pass.
8. A service restart preserves all reads and writes without a volume.

The preview service and its variables remain intentionally pending until the
preview database credential can be transferred into Railway with explicit
operator confirmation.
