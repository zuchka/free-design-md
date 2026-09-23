# Supabase MCP migration review

## Interview answer in 60 seconds

The migration was a good test because it was not a toy database exercise. It
combined schema translation, a stateful SQLite volume, multi-tenant ownership,
Better Auth sessions, billing ledgers, deployment configuration, a write pause,
data verification, and rollback planning.

My conclusion is that the Supabase MCP was very valuable for the control plane:
it made project discovery, migration application, schema inspection, SQL
checks, and security/performance review fast and auditable. It was much less
complete for the data plane: it did not move a SQLite file, provide a
password-bearing Postgres connection, create a consistent source snapshot, or
orchestrate the cross-provider cutover. Those steps still needed repository
code, local database tooling, and Railway access.

The strongest product opportunity is a migration workflow that connects those
two halves: provision a restricted application credential, accept or stream a
source export, run a transactional import, verify it, hand the secret directly
to the hosting provider, and return a structured cutover receipt with rollback
checkpoints.

## What made the work easy

### Supabase MCP was strong at project-scoped database administration

The MCP removed most dashboard navigation and turned the hosted database into a
queryable, scriptable surface. It was particularly effective for:

- finding the exact Supabase project and confirming its region and health;
- applying the three versioned schema migrations in order;
- listing migration history and the 13 resulting application tables;
- running focused SQL to inspect counts, grants, roles, and integrity;
- checking the security and performance advisors after schema changes;
- keeping every operation scoped to an explicit project reference.

That last point matters in a production migration. A project ID in every call
is less ambiguous than clicking among similarly named dashboard projects.

### It encouraged good migration discipline

The Supabase plugin's guidance pushed the work toward versioned migrations for
DDL, raw SQL only for inspection or tightly scoped data operations, and advisor
checks after schema changes. It also prompted a check of the current Supabase
changelog before relying on remembered platform behavior.

The resulting design is deliberately server-only:

- all application tables are in a private `app` schema;
- `public`, `anon`, and `authenticated` have no schema or table access;
- the Railway application uses a password-bearing login that inherits only the
  DML-only `free_design_app` group role;
- the runtime role cannot create roles, create databases, bypass RLS, or act as
  superuser.

### Inspection and evidence were much faster than dashboard work

The migration produced machine-readable source counts, target counts, row
digests, owner distributions, public-ID preservation checks, referential
checks, wallet/ledger checks, and duplicate-payment checks. The MCP made it easy
to corroborate those reports against the hosted target and run the platform's
own advisors immediately afterward.

## What happened in the production run

The production cutover completed on September 23, 2026:

- a WAL-safe SQLite snapshot was taken during a verified write pause;
- the snapshot was 36,446,208 bytes and contained 263 rows in 13 tables;
- the response checksum matched the downloaded file, and SQLite integrity and
  foreign-key checks passed;
- the importer moved all 263 rows in one transaction;
- every table count, content digest, owner distribution, auth relationship,
  billing invariant, and public artifact ID passed independent verification;
- the production runtime uses the restricted `free_design_production` login
  through the Supabase session pooler with a maximum application pool of five;
- the immutable production image is
  `ghcr.io/zuchka/free-design-md:sha-0b8bd45`;
- health, public artifact reads, anonymous auth, session resolution, extraction,
  and restart persistence passed at `https://freedesign.md`;
- the first accepted Postgres production write was recorded at
  `2026-09-23T19:00:18Z`;
- the Railway SQLite volume and two local final-snapshot copies were retained.

The run also found two useful edge cases. First, Railway's agent said an image
change had been deployed when it had only staged the source change and
redeployed the old image. Independent live probes caught that before the
snapshot. Second, the initial verifier treated database query order as
canonical; mixed-case IDs sort differently under SQLite and Postgres
collations. Counts and ownership matched, and making the digest explicitly
order-independent produced an exact content match. Both findings argue for
structured state receipts and independent verification rather than trusting a
successful tool response alone.

## What was still hard

### A database migration is a cross-system workflow

The hardest part was not creating Postgres tables. It was coordinating:

1. the live Railway service and its attached SQLite volume;
2. a WAL-safe, immutable final SQLite snapshot;
3. a no-write maintenance window;
4. a one-time transactional import;
5. a new restricted Postgres credential;
6. an immutable application image;
7. health, auth, ownership, public-link, wallet, and restart checks;
8. a rollback boundary that changes after the first Postgres write.

Supabase MCP controlled only one part of that graph. Once Railway MCP was
available, the hosting side also became programmable, but the choreography
still had to be designed in application code.

### Bulk data transfer was outside the MCP

The MCP can execute SQL, but a production SQLite file should not be converted
into thousands of ad hoc SQL calls. I built a client-side importer that:

- reads a consistent SQLite snapshot;
- refuses to import into a non-empty target;
- inserts all 13 tables in dependency order inside one Postgres transaction;
- preserves timestamps and JSON text byte-for-byte;
- aborts on error;
- independently re-reads both databases and compares deterministic digests.

Without that importer, the MCP alone would not have been a safe bulk migration
mechanism.

### Credential provisioning had an awkward seam

The MCP can create a Postgres login with SQL, but it does not return a complete,
ready-to-use, password-bearing pooler URL or provide a first-class way to rotate
and hand that credential to Railway. The password, pooler hostname, username
format, SSL mode, and hosting variable all had to be assembled across tools.
That is manageable, but it is exactly where copy/paste mistakes and secret
exposure happen.

### Staged versus deployed state was too easy to confuse

The Railway agent's first image-switch response reported a deployment ID and
said the new image was live. Railway's own service-config tool still showed the
new image as a staged patch, and HTTP probes showed the old image accepting
writes. The dedicated `accept-deploy` operation was required to commit the
patch.

This did not lose data, but it is a good example of why an infrastructure MCP
should distinguish `desired`, `staged`, `deploying`, and `live` state in
every mutation response.

### The generic RLS warning needs more context

The table inventory reports all 13 tables as RLS-disabled and describes that as
critical. The dedicated security advisor reports no findings. Both results are
understandable: the inventory applies a broad heuristic, while this application
uses a private, unexposed schema with explicit grant revocation and a
server-only role.

Blindly enabling RLS would break this application because it does not use
Supabase JWT identities or `auth.uid()`. A better result would explain the
effective exposure path: API schema exposure, schema privileges, table
privileges, runtime roles, and RLS together.

### Skills added startup cost but little value on repeated calls

The Supabase skill was useful once for safety rules and current-platform
guidance. Reloading equivalent guidance for every small task would be wasteful.
In the earlier controlled study, skills added roughly seven to nine seconds per
run without producing a conclusive quality improvement.

The better model is session-scoped guidance: load it once, retain the relevant
constraints, and fetch a focused reference only when the operation changes
class—for example, from inspection to destructive migration or from SQL to
Edge Functions.

## How much onboarding required the UI?

### Supabase

Most database work could be done through MCP once the Supabase connection was
authorized:

- project discovery and status: MCP;
- schema migrations: MCP;
- table, role, grant, and count inspection: MCP;
- security and performance advisors: MCP;
- application-role creation: SQL through MCP;
- transactional bulk import and deterministic verification: local migration
  scripts connecting to Supabase.

The remaining UI-shaped work was concentrated at the trust boundary:

- installing/authorizing the plugin;
- obtaining or confirming the password-bearing database connection details;
- any account, billing, or organization decision that requires human consent.

In other words, very little of the repeatable database work needed the
dashboard, but the credential bootstrap was not fully MCP-native.

### Railway

The earlier preview deployment required substantial dashboard interaction
because the Railway plugin was not present. With Railway MCP added, the
production cutover could be inspected and operated without dashboard
navigation: project/service/environment discovery, variable names, domains,
volume mounts, deployment history, logs, metrics, variable updates, and
redeploys were all available.

The Railway MCP also exposed a useful limitation during the cutover: its agent
could inventory the attached volume but could not run arbitrary commands or
stream a 50 MB SQLite file. That led to a safer application-level snapshot
endpoint protected by a one-time token and enabled only during write
maintenance.

For this production run, the actual count was zero Railway or Supabase
dashboard steps after the plugins were authorized. The unavoidable human/UI
portion is plugin authorization and any explicit billing or account consent.

## What it would take without Supabase MCP

The migration would still be possible, but the operator would need to combine:

- the Supabase dashboard for project, database, and advisor inspection;
- the Supabase CLI or direct `psql` for migrations and SQL checks;
- a manually assembled connection string and credential handoff;
- a local SQLite/Postgres migration program;
- Railway dashboard or CLI work for variables, image changes, logs, and
  rollback;
- handwritten notes to preserve the audit trail.

For an experienced operator, I estimate the MCP saved roughly one to two hours
of navigation and glue work on this migration. More importantly, it reduced
context-switching and wrong-project risk. It did not eliminate the need for
database and deployment expertise.

## Product ideas for expanding Supabase MCP

### 1. A first-class migration session

Create an explicit migration object with:

- source type and snapshot checksum;
- destination project and schema;
- maintenance-window state;
- dry-run and import status;
- verification results;
- first-production-write timestamp;
- rollback instructions and retained artifacts.

This would turn a loose sequence of calls into a resumable, auditable workflow.

### 2. Restricted runtime credential provisioning

Add a tool that creates or rotates a least-privilege login and returns a secret
reference plus connection templates for direct, session-pooler, and
transaction-pooler modes. It should support securely handing the secret to an
approved deployment connector without exposing the value to the model or chat.

### 3. Cross-provider secret handoff

The highest-value integration would be:

> Create a restricted Supabase runtime credential and set it as
> `DATABASE_URL` on this Railway service.

The model should receive only a receipt: destination, variable name, role,
pooler mode, creation time, and rotation ID—not the password.

### 4. Streaming import/export primitives

Provide an upload or signed-transfer channel for SQLite/CSV/NDJSON and a managed
transactional importer with progress, cancellation, checksums, and error
reports. Raw SQL execution is the wrong abstraction for moving a large
database.

### 5. Effective-exposure security analysis

Replace the isolated “RLS off” signal with an explanation that combines:

- exposed API schemas;
- schema and table grants;
- default privileges;
- login-role capabilities and memberships;
- RLS state and policies;
- whether the application uses Supabase Auth or a server-only connection.

The tool should still flag risk, but it should distinguish “publicly reachable”
from “private server-only schema.”

### 6. Structured operation receipts

Every mutation should return a stable receipt containing the project, object,
before/after state, migration version, timestamp, and rollback hint. That would
make interview demos and real change reviews much clearer than reconstructing
state from conversational output.

Receipts should explicitly include both the staged configuration and the live
deployment configuration. A deployment ID by itself is not proof that staged
changes were committed.

### 7. Long-running task handles

Imports, branch operations, restores, and advisor scans should expose task IDs
with progress and completion events. This avoids polling and makes it easier to
resume after an interruption.

### 8. Session-scoped skill loading

Load plugin guidance once per session, expose which constraints are active, and
retrieve only the relevant subsection when needed. This keeps the safety value
while avoiding the measured seven-to-nine-second repeated startup penalty.

## Bottom line

Supabase MCP was a strong force multiplier for understanding and changing the
hosted database. It was not an end-to-end migration product. The missing value
is orchestration across source snapshot, bulk transfer, credentials, hosting,
verification, and rollback.

That gap is also the opportunity: if Supabase MCP grows from a database control
surface into a secure migration coordinator, this same job could become a
guided, mostly automated cutover instead of a carefully assembled systems
project.
