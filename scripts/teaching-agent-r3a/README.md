# Run reconciliation (infrastructure only)

Contract `deadline-terminal-v1`; migration `202609140006`. No public application
route, scheduler, Provider, Tool, model retry, or process signal listener is added.
The existing Next production signal handler stops its listener and waits for
in-flight requests. It cannot guarantee cleanup after SIGKILL. Do not install a
competing App Router `process.on` handler or change production PM2 here.

`reconcile-command.py --service <approved-service> --tenant <approved UUID> --operator <explicit-operator> --limit 50 --execute` is the one-shot maintenance command.
R4F adds the required explicit operator; it never infers human approval from an OS
account. Existing service/tenant/limit/execute options and legacy receipt aliases
remain, but invocations without `--operator` now return a local validation receipt.
`--release-ref` and `--build-ref` accept safe metadata labels; omitted values are
JSON null, not invented release evidence. Future production operators must supply
verified release/build references and independently approved scope/access/window.

The command invokes `operator-reconcile.sql` once, without automatic retry.
Credentials remain in a protected libpq service/CA/passfile, outside argv/logs;
use a verified target and TLS verify-full. No target is selected by default.
Service-role execution does not authorize a human to operate every tenant;
separate connection/scope approval is mandatory. Ordinary authenticated roles
(including platform-admin JWTs) have no execution grant. A wrong-tenant run lookup
is `not_found`. No global sweep is provided. The repository does not install psql
or provision production maintenance credentials.

The transaction rechecks status, deadline, cancellation and version/fence under
the same row lock used by completion. Eligibility starts six seconds after the
fixed deadline (three existing 2-second stop-only operations: usage, failure
audit, terminal CAS). This is a cleanup allowance, not renewed execution or an
SLA. Cancel before deadline yields cancelled; late/no cancel yields deadline
failed. A future deadline, including a cancelled run, is not eligible. The
admission contract sets lease equal to deadline; no heartbeat exists. A future
lease cannot extend the hard deadline. Terminal states always win and are no-ops.

Batch is 1–100 rows, defaults to 50, ordered by deadline and ID. Its transaction
is atomic. Statement timeout is 15s, lock timeout 2s, child timeout 20s and libpq
connect timeout 5s; none permits repeating an ambiguous invocation.

## R4F receipt contract

Stdout is exactly one JSON receipt; help/diagnostics use stderr. No raw server
stderr, exception text, question/answer, student name/email or credentials are
printed. `tenantScope` is an approved private identifier: production originals
belong outside Git, and repository evidence uses synthetic IDs or safe aliases.

- `CONFIRMED`: the child has fully returned, exit0, the exact valid RPC JSON is
  followed by `UPLY_RECONCILE_COMMIT_ACK_V1`, which the SQL file emits **after**
  COMMIT under ON_ERROR_STOP. The marker or pre-COMMIT JSON alone is insufficient.
  Normal result is SUCCESS, success=true, followUpReadRequired=false.
- `NOT_COMMITTED`: proven local validation/pre-dispatch failure only. No child
  was started; invalid limit/missing operator returns exit2 with a receipt.
- `UNKNOWN`: timeout, nonzero/negative child exit, connection loss, broken pipe,
  OSError after dispatch, missing/partial/malformed/unexpected output, or caught
  Python exception/interruption. SQL rejection is conservatively UNKNOWN too;
  an exit code is not used as proof of rollback. Result=HOLD, success=false,
  retryAllowed=false, followUpReadRequired=true. Ordinary failure exit1; caught
  KeyboardInterrupt/SIGTERM exit130. Help produces a NOT_COMMITTED receipt/exit0.

UNKNOWN means **STOP → NO RETRY → NEW READ-ONLY CONNECTION → VERIFY DATABASE →
OPERATOR REVIEW**. Preserve the original receipt unchanged. A later read finding
terminal runs does not prove this invocation committed: another worker could
have won CAS. Record followUpDatabaseState separately; do not rewrite UNKNOWN to
CONFIRMED. No follow-up write or read is automatically performed by this CLI.

The envelope contains receiptVersion, invocationId, operation, operator,
executedAtUtc, tenantScope, batchLimit, examined/eligible/processed/terminalized/
cancelled/failed/skipped/fenceConflicts, commitState, result/success/errorCode,
durationMs, releaseRef/buildRef, reconcilerVersion/reconcilerHash, SQL/CLI hashes,
followUpReadRequired and retryAllowed. Counts are null on uncertain outcomes.
Eligible is the **selected bounded candidates at scan time**, not total eligible
in the tenant. Processed includes no-ops; terminalized + skipped + fenceConflicts
= processed. Already-terminal/not-eligible/not-found are skipped. Full-tenant
eligibility and active=0 require separate read-only queries. The migration hash
identifies the DB algorithm; changed CLI/SQL hashes identify the new operator
contract. Legacy `status`, `reconcileError`, `examined`, cancellation/failure
aliases remain for readers; old `status` alone is no longer the success contract.

Optional `--receipt-file <new-private-path>` requires an existing trusted parent;
no directory is created, and an already existing destination is rejected before
dispatch. Write uses a same-directory 0600 temporary file, flush/fsync and atomic
rename. Use a unique invocation path and an operator-controlled 0700 parent, not
a directory writable by untrusted users. On file failure stdout still receives a
HOLD receipt and exit1. A known CONFIRMED commit remains CONFIRMED, but success is
false until the receipt persistence incident is reviewed; do not rerun the batch.
The file option does not install a production receipt directory or retention job.

Catchable exceptions/interruption produce receipts best effort. SIGKILL, power
loss, interpreter failure or all output sinks being unavailable cannot guarantee
one; **missing receipt after dispatch is UNKNOWN**, not NOT_COMMITTED. No claim
that a server COMMIT stops remote Provider billing or that this envelope is a
cryptographic attestation; the locked SQL/client environment remains trusted.

Revised drain procedure:

1. Stop new admission on every serving instance; verify new POST rejects.
   Startup-loaded flags require instance replacement/listener drain, not merely
   editing a configuration file. Keep owner GET/cancel available on an OFF worker.
2. Use the R3 tenant-scoped active query to enumerate runs. Request persistent
   owner-bound cancellation through the existing authorized cancellation path.
3. Allow live workers to perform normal cancellation and bounded cleanup. Wait
   until each remaining run's persisted deadline plus six seconds, without
   extending its execution budget or granting a new fence.
4. Invoke one bounded reconciliation transaction with an explicit operator. Require a
   CONFIRMED/SUCCESS receipt; UNKNOWN stops drain pending a new read-only connection
   and operator review, without automatic retry. Inspect terminal outcomes,
   `fence_conflict` and errors; remaining ineligible runs mean drain is incomplete.
5. Re-query **all** active states in the tenant. For more than 100 candidates,
   explicitly invoke further bounded batches; do not equate an empty batch with
   no active runs. Confirm active=0 and no new Provider/Tool/Teaching operations.
6. Only then mark drain PASS and permit separately authorized rollback/stop.
   Forced death before step 3 is recovered by the same database procedure.

Keep aggregate `expiredActive` separate from eligible. `operator-monitor.sql`
counts durable reconciled terminal reasons; failed transaction receipts supply
`reconcileError`. Missing model usage after death remains missing, never zero
tokens or guessed cost. Scheduler cadence, alert receiver, retention and any
PM2 grace change require later operations work. Production pilot remains blocked
on real content, actual Tailscale validation and Provider policy approval.

## Reproduce on a new disposable stack

Reuse the guarded `../teaching-agent-r2/staging.py` prepare/start/status/bootstrap
workflow. Then Auth fixture → seed → **R3 formal-fixture before generating pins**
→ 138-check security matrix → integration → ports → observe capture → Next copy.
The formal fixture changes catalog revision inputs; old pins must not be reused.
If pins were generated before that setup, run `refresh-pins.mjs` with the existing
`--import ./tests/fixtures/smart-textbook-legacy-adapter/register-server-only.mjs`
loader before any E2E. Do not republish the immutable definition to refresh pins.

Build/freeze the original candidate with the R3 build helper before injecting
fixture-only code. Run the R3 instrument helper and build the staging copy.
Before **every** formal-browser invocation, explicitly reset the private control
file to `{ "enabled": false, "providerDelayMs": 100 }`; a failed watched fixture
may leave it ON. Keep a supervisor alive around start-watched + formal-browser;
stop that owned Next process before `database-checks.py`.

Run `rpc-permissions.mjs` (27 real JWT denial checks), `database-checks.py`
(real independent PostgreSQL sessions, mixed batch and index plan), then
`strong-kill.mjs` (two actual 30-second fixture / 15-second kill cases), followed
by `operator-checks.py` and observe after. The database suite needs at least one
actual completed formal E2E run as a valid persisted evidence template; it uses
real completion RPC transactions, with synthetic clock/row setup clearly scoped
outside the reconciler. It never claims those fixture setup writes were zero.

The operator test temporarily provides a private Docker-psql wrapper scoped by
`staging.load` and container ownership/port guards; this does not create a remote
or production connection. Capture only approved metadata results, then run the
R2 observe cleanup helper and verify the unique project has no owned resources.
For baseline tests, `rehearse-migrations.py` accepts only private schema-only
snapshots and creates its own network-disabled clones; failed new incremental
SQL must leave the preceding six versions installed and the new version absent.


## R4F verification and operations status

Offline receipt tests: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_teaching_agent_reconcile_receipt.py -v`.
Existing R3A SQL suite on a fresh synthetic network-none fixture, plus real CLI
success/SQL-rejection receipts: `node --experimental-strip-types scripts/teaching-agent-r4f/regression.mjs`.
The latter runs the original database-checks.py through a guarded local Unix-socket
Docker transport; it is not a production target or a full Supabase JWT retest.

Current acceptance/runbook: `docs/teaching-agent-pilot-operations-runbook.md` and
`docs/teaching-agent-stage-1f-r4f-reconciler-receipt-closure.md`. Historical R3A/R4E
reports remain unchanged. R4F does not authorize production maintenance,
migration, deployment, scheduling, Provider calls or Feature enable.
