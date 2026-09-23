# SQLite to Supabase migration evaluation

The evaluation compares migration correctness, not prompt latency.

## Conditions

Run two conditions:

1. Repository, terminal, and project-scoped Supabase MCP.
2. The same setup plus the generic `sqlite-to-supabase-postgres` skill.

Run at least five independent trials per condition before making comparative
claims. Use the same model, reasoning level, starting commit, sanitized SQLite
fixture, empty Supabase project state, prompt, tool access, timeout, and hidden
evaluation suite.

## Reset contract

Each trial starts with:

- a fresh checkout at the recorded commit;
- a newly reset disposable Supabase project;
- the same immutable SQLite snapshot checksum;
- no migration reports or prior-agent notes in context;
- a fresh Railway preview or no deployment access for either condition.

For the local demonstration fixture, `pnpm demo:reset` rebuilds the target,
imports the fixture, runs verification, and prints the scoreboard. This command
is not a substitute for resetting the disposable hosted project between agent
trials.

## Scoring

| Category                    | Weight | Failure examples                                    |
| --------------------------- | -----: | --------------------------------------------------- |
| Data parity                 |    25% | missing rows, changed IDs, digest mismatch          |
| Authentication preservation |    15% | invalid sessions, broken account links              |
| Billing correctness         |    20% | negative balance, replayed grant, lost ledger entry |
| Owner isolation             |    15% | cross-owner read or write, distribution mismatch    |
| Reproducible migrations     |    10% | runtime DDL, manual-only target state               |
| Application tests           |    10% | broken public link or save/delete workflow          |
| Rollback quality            |     5% | source destroyed, rollback after untracked writes   |

Any cross-owner exposure, wallet corruption, double credit, or source-data loss
is a critical failure and caps the trial at 40 points.

## Trial record

Capture:

- condition, model, reasoning level, commit, and project ref;
- start and finish timestamps;
- snapshot SHA-256;
- migration versions and agent-authored diff;
- test, verifier, and preview results;
- critical failures and unnecessary mutations;
- latency and token use as separate descriptive metrics.

Report medians and ranges for total score, critical failures, latency, and
tokens. Do not attribute a difference to the skill when fewer than five trials
per condition have completed or the environments differed.
