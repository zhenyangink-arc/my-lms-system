# R5B fixed Foundation engineering tools

Development forward-only strategy. R5B permits isolated writes and artifact preservation;
**no production migration/deploy/backup/PM2/Provider operation is authorized**.

## Migration engine

`runner.py plan` reads exactly the eight versions and hashes in `locked-package.json`,
compares them with R5A evidence, and rejects extra/missing post-cutover files. It does
not execute discovered files. `rehearse` requires a uniquely labeled, ID-pinned,
network-none PG17 container, exact volume mount and database comment marker.
There are no skip/resume/force/repair/retry options; every invocation must start at449.

Each step takes advisory lock `(4171,100)` and a ledger table lock, rechecks the full
old prefix (including SQL) and exact new prefix, executes the original transaction
body and inserts full original SQL in the ledger, and commits once. A nonce ACK
**after** COMMIT plus success exit identifies CONFIRMED; new-connection full ledger
verification must also PASS before the next step. Missing/bad ACK, timeout or lost
connection is UNKNOWN. Never retry or upgrade the original receipt after a later
read. NOT_COMMITTED is limited to no-dispatch cases. Receipts use exclusive creation,
0600, file+directory fsync; per-step failures stop execution.

`maintenance_transport.py` is the future private libpq/Docker transport. The
`apply-authorized` entry requires a private 0600 **explicitly approved** JSON record,
700 connection directory, exact private service/passfile/CA, pinned runner/transport/
package/target/runtime hashes, window, OFF/EMPTY, zero Provider/Agent scope and
sealed fresh backup age<=900s (or explicit RPO exception). It is not invoked in R5B;
the negative test with absent authorization exits before connecting. Production
read-only capability was checked independently. Never fabricate an authorization
file from an unsigned Markdown template.

Required future approval fields: status, operator, explicitUserAuthorizationReference,
migrationVersions, runnerSha256, maintenanceTransportSha256, packageSha256,
projectIdentitySha256, hostIdentitySha256, runtimeSha256, windowStartUtc,
windowEndUtc, feature, allowlists, providerRequests, agentRuns, freshBackupPath,
freshBackupManifestSha256. An RPO exception additionally requires
rpoExceptionSeconds and explicitRpoExceptionReference. No real values/secrets are
provided here. Revalidate capability at the actual window.

## Isolated rehearsal and tests

`environment.py create` verifies the R4D dump, manifest and all seal entries, creates
owned PG17 network-none resources, restores roles/schema/extensions/data/ACL, resets
postgres NOSUPERUSER and checks 26 restored categories. It writes a private state
path and sanitized ownership evidence. It never creates or alters the source backup.

Run `runner.py rehearse --state <owned-state> --receipts <new-private-directory>`.
Run `verify-integrity.py <owned-state>` for post-007 catalogs. `test_runner.py` has17
unit/protocol cases. `live-negative.py <separate-fresh-owned-state>` is an intentionally
failing ledger-trigger/timeout/disconnect/bad-ACK test; never use the successful
rehearsal database or a production target. It does not retry its rejected migration.

## Frozen candidate

`persist-artifact.py` exclusively creates a 0700 persistent directory, copies only
the locked archive, fsyncs, rehashes and verifies tar/Build ID. Existing destination
is refused. Original /tmp artifact and known-good release are retained.

`setup-services.py <private-directory>` starts real Auth/PostgREST on an internal
network, sharing only the disposable PG Unix socket. No production credential is
injected. `start-candidate.py <private-directory>` extracts the exact archive, uses
existing compatible node_modules, and starts the owned localhost gateway and Next.
Keep that tool session open. Public build-bound Supabase origin is redirected by
`network-guard.cjs` to the clone; all other outbound sockets/fetches are denied.
No frozen member is patched or rebuilt. `synthetic-auth.mjs` creates only a disposable
synthetic actor; its isolated profile is explicitly promoted for the UI check.
`candidate-browser.mjs` reads base/authoring pages, blocks external browser traffic,
and verifies one local OFF rejection (not a Run). No Save/Publish/content action.

Stop the owned candidate tool session explicitly (Ctrl-C, which signals its children)
**before** `cleanup.py <all registered private directories>`. Sandbox /proc visibility
alone does not prove a host process exited. Cleanup validates Docker ownership,
removes services/networks/DB volumes and private credentials, and preserves the
persistent artifact, R4D backup and shared dependencies. Do not run old R4D backup
entrypoints or old deployment drivers to perform these tasks.
