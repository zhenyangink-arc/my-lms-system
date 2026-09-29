# Stage 1F-R3 operational verification

This directory is an operational harness, not a production deployment entry point.
The result is **NO-GO**. See the 35-section report and evidence under `docs/`.
Never point these helpers at production, enable a production flag, restart PM2,
change Tailscale, or install the baseline on an existing target.

## Evidence boundaries

- `production-inventory.sql` is aggregate-only, BEGIN READ ONLY SQL. Use an
  already-authorized read-only connection with TLS verification and bounded
  timeouts. Do not supply credentials on command lines or record them in logs.
- `rehearse-migrations.py --snapshot <private-schema-only-directory> --output
  <new-private-output-directory>` accepts local artifacts, not a database URL.
  It creates its own networkless PostgreSQL containers and destroys them.
  Input files are schema.dump, roles.sql (no role passwords), and catalog.json.
  The two actual paths and per-step hashes must pass before interpreting failure
  injection results. It is not a production migration runner.
- The Full Supabase stack is built by the guarded R2 lifecycle harness. Read its
  README first. Create a new project, never reuse another stack. The original
  449 baseline ledger is metadata; only post-cutover SQL is applied subsequently.
- `formal-fixture.py` changes only owned synthetic catalog slugs/chapter 0 to
  match the current real classroom route. It does not change unlock rules.
- `candidate.py <stage-dir> <private-runtime-config-file>` must run on the pristine
  R2-created source copy **before** instrumentation. Only public Supabase build
  config is read from that file. The complete original build is frozen to a tar.
- `instrument.py` subsequently modifies only the private copy, removes the R2
  mounting page, and connects Provider fixture and request observers. Rebuild this
  copy using staging public config. Its artifact differs from the original tar.
- `formal-browser.mjs <stage-dir>` uses the formal classroom slug route, real
  synthetic Auth/JWT, product components, Runtime, Domain and database. Its
  private rollout watcher is for functional tests, not production kill evidence.
  Close the page after UI tests before the HTTP-only deadline measurement: the
  ordinary LiveClassEntryBanner polls independently of Agent work.
- `process.py` supports startup-only ON/OFF/wrong-course/wrong-user modes,
  listener SIGTERM, graceful stop and an explicitly isolated 15-second forced
  stop simulation. It verifies project ownership and exact process cwd. Never
  replace those checks with a broad kill-by-port or trust another PID namespace.
- `operations.mjs <stage-dir>` requires a successfully built `previous` directory
  containing the known-good prior release source built with staging public config.
  It tests startup flag reality, OFF replacement, recovery, short drain, directory
  rollback and the current PM2 timeout's adverse case. The last case is expected
  to RECORD `drainConverged:false`, `verdict:FAIL`; exit 0 does not mean readiness.
  Its prerequisite previous-source/build metadata must identify the actual source
  and distinguish a staging rebuild from the production binary.
- Keep the parent verification process alive while Next children are running.
  A completed tool shell can terminate its children despite detached Popen.
  All live Provider calls remain prohibited; only the owned local SSE fixture runs.
- `release-manifest.mjs <stage-dir> <private-artifact-output>` uses the existing
  server-only test import shim. It locks current source/dependency inputs, exact
  definition, migration hashes and original build/archive. It never deploys.
  `/tmp` retention is temporary: future release requires an authorized immutable
  artifact store and matching bytes, not a newly built substitute.

## Operator read-only usage

Only infrastructure operators explicitly authorized for the selected tenant may
use these SQL files. SQL role checks and a supplied tenant ID are not themselves
human authorization. Do not expose them as a Tool, public API or teacher dashboard.
Connection setup and secret delivery remain in the existing restricted operations
channel; commands below intentionally show no connection string or secret.

```text
psql <approved-readonly-connection-options> -X -v ON_ERROR_STOP=1 \
  -v tenant_id=<authorized-tenant-uuid> -v run_id=<run-uuid> \
  -f scripts/teaching-agent-r3/operator-run-lookup.sql
psql <approved-readonly-connection-options> -X -v ON_ERROR_STOP=1 \
  -v tenant_id=<authorized-tenant-uuid> \
  -f scripts/teaching-agent-r3/operator-active-runs.sql
psql <approved-readonly-connection-options> -X -v ON_ERROR_STOP=1 \
  -v tenant_id=<authorized-tenant-uuid> -v since=<approved-window-start> \
  -f scripts/teaching-agent-r3/operator-monitor.sql
```

These are future operator examples, not commands executed against production in
R3. Production still has zero Agent tables. `verify-operator.py <stage-dir>` runs
the exact queries against completed/failed/cancelled/orphan synthetic runs and
tests missing scope, cross-tenant and non-privileged rejection. It writes only a
local metadata result, not database content.

Join model.started and model.usage by call ID; missing usage event is distinct
from an explicit unknown usage event. Selection latency is not persisted. Do not
invent p95 or infer zero cost from missing token rows. Raw messages, full prompt,
tool results, credentials and reasoning are intentionally excluded.

## Release / first-enable / rollback runbooks

The report sections 13–16 and 19–30 are the reviewable runbook. They include exact
migration order/hashes, verify-before-next and failure stop, definition publication,
startup OFF replacement, owner-safe recovery, data-preserving application rollback,
monitoring/stop conditions, content checklist, policy approval and first enable.
All execution remains gated. A configuration file write alone is not a live kill
switch. Current 15-second forced termination leaves an expired running Run; waiting
45 seconds does not repair it. Do not issue an ad hoc status UPDATE or claim that
unverified production drain is safe.

## Cleanup and archiving

Archive only allowlisted metadata/hashes/timings and synthetic screenshots. Never
copy status.json, private.json, users.private.json, cookies, full logs, Provider
payloads, real textbook bodies or production configuration. Scan exact private
values in memory and report only counts. Keep the original build tar private.

After archiving, invoke the existing R2 `observe.py cleanup` against the exact owned
stage directory. It removes only label/name-verified containers/network/volumes,
the owned Next process and private synthetic credentials/data/source copies.
Never use Docker prune, reset an unrelated Supabase project, or broadly delete
old temporary directories. Preserve prior-stage evidence and original worktree
changes. Final git status/diff plus the start-of-stage content hashes define scope.
