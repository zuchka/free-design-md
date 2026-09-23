# Railway Supabase preview

## Created infrastructure

- Railway project: `freedesign.md`
- Environment: `supabase-preview`
- Environment ID: `6c9317d3-b475-4641-aa80-b29b3bec9608`
- Service: `free-design-md-supabase-preview`
- Service ID: `aa995408-280d-4a8a-8c48-a7ac3af6f6c9`
- Active deployment ID: `8b9953ef-c2ee-4894-8f41-e3eb76c2cb4a`
- Public URL:
  `https://free-design-md-supabase-preview-supabase-preview.up.railway.app`
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

The deployed image is built from commit
`a601cca677a915b01eb6aabb683fa4e2eeb39b60`. Railway deploys the preview tag
on port `8080` and uses `/api/health` as the deployment healthcheck. The
multi-architecture manifest digest is:

```text
sha256:5d33805cf27f880415e7b1e6f8180a95994f54c0350204e98240c83f9c68f52a
```

## Hosted import rehearsal

A dedicated `free_design_preview` login inherits only the `free_design_app`
group role. The synthetic SQLite fixture was imported through the Supavisor
session pooler using that login, exercising the same connection path as the
Railway service.

- 18 rows imported across all 13 application tables.
- Every table count and canonical digest matched the SQLite fixture.
- Owner distributions matched for all tenant-owned tables.
- All referential, wallet, ledger, checkout, and public-ID integrity checks
  passed.
- Reports are kept under the ignored `.migration-artifacts/demo/` directory so
  connection metadata and rehearsal artifacts cannot be committed.
- The hosted verification was rerun after the restart rehearsal on
  2026-09-23. All 13 row digests and all integrity checks still passed.

## Required preview variables

The preview service has these variables set only in `supabase-preview`:

```text
DATABASE_URL
DATABASE_POOL_SIZE=5
BETTER_AUTH_SECRET
BETTER_AUTH_URL
PUBLIC_ORIGIN
NODE_ENV=production
MIGRATION_WRITE_PAUSED=0
```

Add `ANTHROPIC_API_KEY`, Resend, and Stripe test-mode variables only when those
flows are part of the rehearsal. Never copy the production Stripe webhook
secret or attach the production SQLite volume.

The database URL should use a dedicated password-bearing login that inherits
the `free_design_app` group role. Do not use an administrative connection in
the application.

`BETTER_AUTH_URL` and `PUBLIC_ORIGIN` are the exact Railway HTTPS origin.
`DATABASE_URL` uses the Supavisor session pooler on port `5432` with the
dedicated `free_design_preview` login. Better Auth reads Railway's platform-set
single-value `X-Real-IP` header for rate limiting; it does not trust the
client-controllable `X-Forwarded-For` chain.

## Validation record

The preview passed the deployment gate on 2026-09-23:

1. `GET /api/health` returned `200` with
   `{"ok":true,"database":"ready"}`.
2. The home page and imported public artifact both returned `200`.
3. Anonymous sign-in, session restoration, and credit lookup succeeded.
4. An owner-scoped synthetic artifact could be listed and read only by its
   owner, then deleted successfully.
5. A Railway service restart preserved both imported and newly written data.
6. The temporary user, session, wallet, membership, and artifact were removed;
   the target returned to the 18-row fixture baseline.
7. Independent verification found exact counts and content digests for all 13
   tables, with zero orphaned auth rows, broken design links, negative wallets,
   wallet/ledger mismatches, duplicate ledger references, or duplicate checkout
   sessions.
8. Five health requests produced one idle Supavisor backend connection for the
   restricted application login, with no database authentication errors.
9. The Supabase security advisor returned no findings. The performance advisor
   reported five unused indexes at informational severity, which is expected
   for this intentionally tiny fixture.
10. A fresh anonymous sign-in on the hardened image returned `200`; the deploy
    log contained no client-IP/rate-limit warning. That synthetic auth data was
    removed and the target was reconfirmed at 18 rows.

The Supabase table inventory emits a generic RLS-disabled warning because it
does not account for schema exposure and grants. The `app` schema is not exposed
through the Supabase Data API, privileges are revoked from `public`, `anon`, and
`authenticated`, and the server uses a restricted login. Enabling RLS without a
Supabase JWT identity would block the server application and is not part of this
architecture.

## Production boundary

The production Railway service, domain, variables, and SQLite volume have not
been changed. Production cutover remains a separate, explicitly approved
maintenance operation that starts with a fresh encrypted SQLite snapshot,
write pause, import, verification, and a rollback checkpoint.
