# Migration verification gates

Use independent source and target reads. A successful importer exit code is not
evidence of parity.

## Required checks

- SQLite `integrity_check` succeeds before import.
- The target contains every required table, index, constraint, and grant.
- Source and target row counts match per table.
- Canonical row digests match per table after documented type normalization.
- Owner or tenant distributions match without writing identifiers to reports.
- Authentication sessions and accounts reference valid users.
- Public and externally referenced identifiers remain unchanged.
- Parent and root references resolve.
- Wallet balances remain nonnegative and reconcile with the ledger.
- Payment events, checkout sessions, ledger references, and operation IDs retain
  their uniqueness guarantees.

## Application acceptance

Test at least one valid and one invalid case for each authorization boundary.
Exercise authentication restoration, owned-data reads and writes, public reads,
financial reservation and refund, payment replay, and concurrent spending.

Run the full test suite and production build after the database-specific tests.
Keep verification reports private when counts or hashes reveal operational
information.
