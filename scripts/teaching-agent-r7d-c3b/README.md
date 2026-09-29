# Controlled exact single migration runner / 1

This operational package executes one reviewed, byte-sealed migration per invocation. It has no SQL, DSN, file, version, batch, force, skip, or retry option. It does not import a historical runner. Product and migration files remain unchanged.

## Current status

The sole production registry entry, `acl-000-v1`, is **DRAFT_NOT_EXECUTABLE**. All four install-related CLI modes reject it before credential access or a connection. The separate `capture` command requires explicit READ_ONLY_BASELINE_CAPTURE authorization; it does not issue approval, seal a production plan, or install a migration. 001/002 registry tuples describe reviewed source; only isolated test fixtures have corresponding plans.

The next separately approved phase must capture the real full statements-inclusive ledger prefix and descriptor, target identity, complete protected catalog, runtime/package identity, and backup/recovery capability. Historical 458 is not a fresh observation. Any reviewed plan change requires new immutable plan bytes/hash and registry revision; never edit an approved plan in place.

## Commands and approval boundary

```
python3 -B scripts/teaching-agent-r7d-c3b/runner.py preflight --plan acl-000-v1
python3 -B scripts/teaching-agent-r7d-c3b/runner.py backup --plan acl-000-v1
python3 -B scripts/teaching-agent-r7d-c3b/runner.py apply --plan acl-000-v1
python3 -B scripts/teaching-agent-r7d-c3b/runner.py verify --plan acl-000-v1
```

A future READY registry entry requires a private, fixed-directory operator authorization, binding its raw plan hash, migration bytes, complete package hashes, target identity, fresh actual ledger descriptor/catalog, runtime boundary, time window, one-use nonce, backup manifest, and explicit user approval reference/digest. This is a trusted OS operator attestation, **not cryptographic validation of chat approval**. The runner never creates authorization and cannot upgrade DRAFT. Each backup export also requires its own authorization. No apply command implicitly starts a backup.

The public operational boundary is this finite CLI. Python underscore transport operations are internal implementation mechanisms, not a sandbox against an operator who can replace the trusted package or run arbitrary Python. Production code accepts only the fixed maintenance target. Owned adapters inspect image, labels, network-none, no mounts and no ports; fixture plans cannot select production.

## Transaction and ledger

Full migration bytes, reviewed offsets, body hash, and a defensive top-level lexer must agree. Body bytes are preserved verbatim; only the reviewed outer comments/BEGIN and terminal COMMIT are excluded. Ledger `statements` stores the entire original source, including those wrappers.

After a fresh read-only observation, apply creates/fsyncs an exclusive attempt claim before mutation, opens one private session, obtains `pg_try_advisory_xact_lock(4171,100)`, locks the ledger in SHARE ROW EXCLUSIVE mode, and rechecks all preconditions. It executes body, inserts one ledger row, and verifies all required postconditions **before COMMIT**. Any precommit failure rolls back both schema and ledger. No business RPC is invoked by the checks.

The prefix algorithm `pg17-ledger-source-prefix/1` hashes UTF-8 PostgreSQL 17 jsonb text:

```sql
coalesce(jsonb_agg(jsonb_build_object(
  'version',version,'name',name,'statements',statements
) order by version collate "C")::text,'[]')
```

Null/empty statements, names, exact source, versions, count, latest version and ledger descriptor all matter. 449 historical metadata rows plus nine real incremental sources form the isolated fixture; it is explicitly not a current database clone.

The immutable 34b manifest governs completion/publication routine and constraint contracts. Its minimal unrelated domain bootstrap is not substituted for the full historical environment. The complete observed catalog is independently sealed, compared under lock and restricted to exact migration deltas. No default privilege or unrelated RPC change is permitted for 000.

Advisory locks serialize cooperative old/new tools. They cannot prevent arbitrary privileged out-of-band DDL; the approved maintenance window must exclude other operators. This is an explicit operational precondition.

## Backup and privacy

### Recovery Candidate V4 (bounded validation complete; successor implementation pending validation)

The canonical candidate is `SOURCE_ALIGNED_BOOTSTRAP_AWARE_STAGED_RESTORE_V4`,
version `4`, with status `IMPLEMENTED_AWAITING_FRESH_VALIDATION`. The V2 role
configuration and V3 fixed-extension contracts remain in place. V4 adds the
bounded database ACL profile and a dedicated `E6_DB_ACL` phase. D12-R1-F2A closed
the design, and D12-R1-F2B passed all three local synthetic feasibility variants:
two CREATE grants, one CREATE grant under SQL_ASCII, and NULL default ACL without
mutation. D11-R5 subsequently passed fresh implementation regression validation
with the exact 7 direct and 53 downstream authority blockers still pending.
D12-R3 passed all three formal-code local full-fidelity variants: shared SQL_ASCII,
configured-owner UTF8 with fixed extensions, and plpgsql-only UTF8. Those results
bind package `a9545da4858f83185205bd94cd0fb9f7abaf1a080129f85c097cb57399c81e98`.
They establish bounded local recovery fidelity, not production compatibility or
production provenance. The source status literal remains unchanged deliberately.

The backup exporter measures the real `pg_roles.oid = 10` row immediately before
the unchanged `pg_dumpall --roles-only --no-role-passwords` call. The existing fresh
after-observation session measures it again. Name, complete eleven-field role
tuple, server/client encoding, version, target, authorization/package/attempt,
transport proof references and the particular raw roles SHA must agree. Login
user, the name `postgres`, any superuser and destination identity are not substitutes
for source bootstrap provenance. This still does not turn global roles capture
into an atomic database MVCC snapshot.

Raw capture bytes are preserved as `roles.sql`. Candidate A separately derives the
execution buffer, omitting only the unique complete top-level CREATE ROLE for the
measured bootstrap. Original/derived/stdin hashes, removed span and statement,
prefix/suffix hashes and both identities are recorded privately. All other bytes
remain unchanged, including ordinary postgres CREATE, ALTER, configuration,
membership, comments and supported psql controls. There is no literal-postgres
filter fallback. Zero/multiple matches, unsupported/ambiguous lexical profiles,
identity/hash mismatch and password-bearing input stop the backup before replay.

`PG17_6_ASCII_ROLES_BOUNDARY_V1` is a bounded recognizer, not a general SQL parser.
The pinned PG17.6 profile supports ASCII identifiers of at most 63 bytes and the
reviewed role-setting subset. Nonempty role comments, security labels,
database-specific role settings and parameter ACLs are rejected. Password fidelity
is excluded. UTF8 is the combined synthetic profile; unchanged SQL_ASCII source
fixtures remain a mandatory implementation regression. Broader production
encoding/locale, role and extension profiles are not presumed compatible.

`ROLE_CONFIG_PROFILE_SEARCH_PATH_V1`, version 1, accepts only global per-role
defaults (`setdatabase = 0`). A role config is NULL, an empty array, or at most two
strings with unique keys. `statement_timeout` values match
`[0-9]+(?:ms|s|min|h|d)?`. `search_path` values match
`[a-z_][a-z0-9_]{0,62}(, [a-z_][a-z0-9_]{0,62})?`: one or two distinct lowercase
ASCII simple schema names, each at most 63 bytes, separated by exactly comma-space.
The exact strings and array order are preserved, without sorting, filtering or
normalization. Unknown GUCs, database-specific settings, duplicate keys/components,
special macros such as `$user`, quoted/escaped identifiers, Unicode, mixed case,
extra whitespace, `pg_*` and `information_schema` components remain unsupported.
There is no vendor role-name whitelist or arbitrary role config support.

Candidate A's lexical profile and derivation, STAGED reconciliation, E6's bounded
ACL predicate and exact comparison/transport normalization are unchanged. V4 does
not add `SET search_path` to recovery. `SET ROLE` does not load login-time role
defaults; fresh-login configuration and schema environment remain validation
requirements, including configured plpgsql/E6 owners.

The new destination-only cluster initializes bootstrap using the measured source
name and validates OID 10. A separate fixed `uply_owned_restore_admin` is created
for restore clients. The source may not contain that name. Existing `OwnedCluster`,
`OwnedTransport`, source fixture and source/TLS identities are unchanged. Source
names are passed as argv data, never interpolated into shell programs. The local
destination remains pinned, network-none, read-only-root/tmpfs, UID/GID 100:101,
without host ports, mounts or credentials, with one attempt and mandatory cleanup.

E3 runs derived bytes with `psql -X` and `ON_ERROR_STOP=1`. It does not add a single
transaction or assume rollback of previously committed statements. Exact role and
full six-field membership comparison must pass before reconciliation. The STAGED
plpgsql helper runs after this gate and before E4: save the intended source owner's
tuple, elevate only SUPERUSER if necessary, DROP with RESTRICT, recreate under that
owner, and restore the changed privilege bit. An originally superuser owner is
never demoted. Extension/language/implementation owners, structure and raw ACLs,
database ACL preservation, memberships and final privilege state must match.
Unsupported profiles, dependencies or any mismatch fail without DIRECT, catalog
surgery, destructive dependency removal or a second restore.

`BOOTSTRAP_OWNED_EXTENSION_RESTORE_PROFILE_V1`, version 1, has two branches:

- `PLPGSQL_ONLY`: no extra extension. E4 retains the V2 argv without `--role`.
- `BOOTSTRAP_OWNED_FIXED_EXTENSION_SET`: exactly `btree_gist` 1.7 in `public`,
  `pgcrypto` 1.3 and `uuid-ossp` 1.1 in `extensions`, in the pinned PG17.6 image.
  Every extra extension and ownable member must belong to the measured OID10
  SUPERUSER bootstrap. The full machine identity/structure template contains
  310 members; counts alone cannot satisfy it. Partial sets, different schemas,
  versions, owners, dependencies or member definitions are unsupported.

Function member ACLs are NULL or exact arrays with owner-granted EXECUTE to PUBLIC
or tracked source roles, without grant option. Type member ACLs must be NULL with
the measured default USAGE projection. All exact raw array ordering, typed grants
and effective privileges remain source-bound. The finite source ACL guard rejects
unresolved or nonowner grantors in the fixed-extension branch. It uses existing
structured catalog fields to resolve relation/column owners without guessing
from dots. A source role literally named PUBLIC is ambiguous in the frozen ACL
projection and is outside this branch. There is no vendor whitelist, generic ACL
repair or new infrastructure exception.

The two frozen catalog readers run in the existing exporter PRE and fresh
POST sessions; no third source session is created. Provenance binds five query
results in each phase, ten in total. The extra-extension reader covers extension
metadata, complete members/structure, raw ACL, expanded ACL, effective privileges
and diagnostic initial privileges. The source ACL-context reader is separate.
PRE/POST responses must remain exact. `pg_init_privs` is retained for explanation;
its independent cross-cluster layout is not a new acceptance oracle. The finite
guard is not an all-PostgreSQL-object or arbitrary archive SQL sandbox.

E4 still runs one unchanged full custom archive through `pg_restore --exit-on-error`.
The authenticated client remains `uply_owned_restore_admin`. Only the fixed
extension branch adds `--role <measured-bootstrap>` as one argv data value. The
private receipt records actual argv/input hashes and expected startup identity
from pinned client semantics; it does not claim a direct or continuous backend
identity observation. No schema precreation, archive rewrite, second restore,
new owner/ACL-suppression flag or retry is added. STAGED's intended plpgsql owner
remains independently measured and may be an ordinary configured NOSUPERUSER.

E5 measures extra-extension state in its existing read-only session and requires
source-exact owner, structure, raw/expanded ACL and effective privileges before E6.
E7 repeats the same reader alongside catalog/counts. E8 requires both recorded
states to match source and all existing fidelity gates. No E6 repair can hide
an extension mismatch. The schema archive remains TOC-checked only.

E6 only materializes the frozen owner-only default ACL representation: matching
relation identity/other fields and NULL restored ACL against the exact source
owner `arwdDxtm` (table) or `rwU` (sequence) item, or matching schema identity against
its exact owner `UC` item. Other differences are not repaired. Only one exact
infrastructure role row may be removed from a deep copy after zero typed-reference
checks. Database ownership alone remains `LOCAL_RESTORE_INFRASTRUCTURE_ONLY`;
no other owner inherits that exception. Ordinary catalog/counts/role/membership
comparison is unchanged. Count equality does not claim arbitrary production
row-content equality.

Fresh success writes `exact-single-backup/3`, with exactly these nine artifacts:

```
database.dump
schema.dump
roles.sql
metadata/catalog.json
metadata/counts.json
metadata/migration-ledger.json
metadata/restore.json
metadata/transport-proofs.json
metadata/bootstrap-provenance.json
```

`DATABASE_ACL_OWNER_CREATE_APPEND_PROFILE_V1`, version 1, accepts only the current
`postgres` database owned by the measured source OID10 bootstrap. The owner and
explicit grantee identifiers match `[a-z_][a-z0-9_]{0,62}` and resolve uniquely
among source roles. NULL ACL must expand to the exact five default privileges.
The only explicit ACL form is `{=Tc/<owner>,<owner>=CTc/<owner>,<g1>=C/<owner>}`
with an optional second distinct CREATE grantee. The raw default prefix, owner
grantor, false grantability and original suffix order are exact. No vendor-name
whitelist, sorting, normalization or ACL filtering is applied.

Empty ACL, explicit default-only ACL, more than two grantees, duplicate/unknown
roles, real `PUBLIC` ambiguity, restore-admin references, grant options, other
privileges/grantors, quoted/Unicode/uppercase identifiers and raw/expanded
inconsistency fail closed. This deliberately finite database ACL domain is
narrower than V3's unvalidated input domain; V4 is not an input-domain superset.

The existing PRE/POST database catalog reader and two source sessions remain
unchanged (five prerequisites per session, ten bindings). Before destination
creation, a plan is derived solely from validated source ACL/roles/bootstrap.
STAGED still preserves destination default ACL. After the existing E6 object ACL
supplement, `E6_DB_ACL` independently requires that pristine NULL-default baseline.
The append branch sends one batch through the fixed independent transport:
`SET ROLE` measured bootstrap, an actual session/current-user/database identity
SELECT, one or two schema-independent `GRANT CREATE ON DATABASE "postgres"`
statements, and `RESET ROLE`. Grant order follows the source raw ACL. The NULL
branch executes no SQL mutation. No retry, REVOKE, owner rewrite, adaptive repair,
`--create`, extra restore or transaction-wide rollback claim is added.

The immediate post-state and independent final E7 measurement must exactly match
the original source raw ACL and ordered expanded tuples. E8 retains every existing
gate plus database ACL equality and typed transport footprint checks. The private
restore report binds source/provenance/identity/archive hashes, derived and actual
stdin hashes, execution identity/count/return code, baseline/post/final states and
recomputed result flags. The pure validator reconstructs all these bindings;
self-consistent JSON alone does not replace the authenticated runner context.

The private immutable sidecar uses `backup-source-bootstrap-provenance/2`, schema
version 2. It contains canonical measured responses, never a claim that re-encoded
JSON is raw protocol stdout (`rawResponseAvailable=false`). The restore report uses
`exact-single-owned-restore/3`, binds provenance and derivation, role/finalization
gates, normalized catalog/counts, footprint and actual cleanup. It also binds the
E4 execution context and complete E5/E7 extension measurements. The pure validator
recomputes profile, hashes and equalities from data, not PASS flags alone. The manifest binds
all file hashes/sizes and the candidate. The runner's existing five-field receipt
binds the raw manifest SHA; lifecycle `/1` envelope/state order remains unchanged.

The pure artifact validator reads private files only. Fresh success accepts `/3`;
historical `/2` requires explicit historical verification and the authenticated
original ready/approval/archive/result/manifest/runner/package bindings. Historical
bytes are neither upgraded nor reinterpreted as the current candidate. Fresh `/3`
requires exact V4/version 4 identity across provenance, manifest and restore report;
there is no fresh V1/V2/V3 fallback or implicit historical V1/V2/V3 verification. Manifest
stays `/3`, restore is `/3`, and provenance is `/2` with schema version 2. Candidate
version 4 is independent of these schema versions; historical bytes are unchanged.
Artifacts are sealed
only after restore and cleanup pass. Failure diagnostics/INVALID behavior remains;
this implementation adds no guarantee of raw-payload persistence before restore.

The operational package changes again with D14's five authority constant updates.
D13 freezes the successor contract; D14 implements its consumer and tests without
publishing successful authority records. Old completion and lock bytes remain
immutable and cannot authorize this package. The final successor package requires
fresh regression and three-variant combined certification before separately
approved validation/completion/lock publication. Prior D11-R5/D12-R3 results retain
their exact original package scope; they cannot be relabeled as final-package
validation. Recovery algorithms, profiles and transport behavior are unchanged.
Production bootstrap provenance is `NOT_ACQUIRED`, production adoption is false,
and production execution, migration and Agent Run remain unauthorized.

The 70 `BACKUP_RECOVERY_V1_001`–`070` definitions retain their lineage IDs against
the current forward implementation, including the separately budgeted actual-code
integration case. `BACKUP_RECOVERY_V2_001`–`025` add bounded profile, artifact identity,
configured-owner STAGED and qualified E6 regression definitions; their lineage IDs
remain unchanged against the current forward implementation. `BACKUP_RECOVERY_V3_001`–`064` add the F2C extension,
execution-context, artifact and lifecycle cases (56 backup, 8 contract). Their IDs
remain intact. `BACKUP_RECOVERY_V4_001`–`038` implement the frozen DB ACL test plan:
31 backup cases and 7 contract cases (027–033). Shared-source SQL_ASCII, configured
owner/E6 decoy and NULL-default integration cases use the actual adapter. Syntax,
static and pure helper sanity checks in an implementation round are not fresh
repository validation. Complete suites, exact historical coverage and actual-code
full-fidelity certification require their own approved rounds.
The integration fixture and additional ACL/data/table-fed plpgsql oracles
exist only in the backup test file; no historical experimental executor is used
as the recovery implementation.

The adapter follows the existing R4D procedure using pinned pg_dump/pg_dumpall/pg_restore: a live exported READ ONLY snapshot, full and schema custom archives, no-password roles, catalog/ledger/count capture, TOC checks, actual owned PG17 restore, owner-default ACL representation supplement, exact restored catalog/count comparison, and only then a private seal. It keeps the existing production backup root and retention policy. It never restores production or changes global backup policy.

Role capture is outside database MVCC snapshot atomicity. Before/after role and membership fingerprints must match. A backup must match the plan/target/prefix/package and be at most 900 seconds old, without future timestamps. Every required file, mode, owner and hash is checked. Credentials are runtime-only; private connection files are never copied to plans, receipts or archives. Owned tests do not access them.

Directories are 0700, receipts/artifacts 0600, exclusive creation with file and directory fsync. Attempt claims are single-use even after failure. Redaction covers credential keys, JWTs, DSNs and authorization/cookie markers; raw transport stderr/tracebacks are never returned by the CLI. Full private backups/catalogs remain private; public evidence reports only safe hashes/classifications.

## Failure handling

| State | Meaning | Next action |
|---|---|---|
| PRECHECK_FAILED / APPROVAL_MISSING / TARGET_IDENTITY_MISMATCH | No authorized migration dispatch | Diagnose; obtain new reviewed authorization if needed |
| BACKUP_FAILED | Missing, stale, mismatched or unverified backup | Separate authorized backup/recovery work |
| CONCURRENT_RUN_REJECTED | Cooperative lock busy | Stop; no automatic wait-and-apply |
| MIGRATION_FAILED_ROLLED_BACK / LEDGER_FAILED_ROLLED_BACK / POSTCHECK_FAILED_ROLLED_BACK | Rollback ACK and independent unchanged-state proof | Preserve consumed attempt; diagnose |
| UNKNOWN_COMMIT | Commit ACK/session outcome cannot be proved | Never retry apply; independently verify/reconcile |
| POSTCHECK_FAILED_COMMITTED_FORWARD_FIX_REQUIRED | Commit was acknowledged, later verification/receipt failed | Preserve committed history; forward diagnosis |
| VERIFY_FAILED | Independent observation failed | Stop and preserve original attempt |
| SUCCESS | Exact migration, ledger and independent verification passed | Stop; `nextMigrationAllowed=false` |

Never GRANT back, delete ledger rows, run a down migration, invoke R5B/F1 as fallback, or issue manual SQL to bypass a failed gate. A later verification is a new immutable receipt; it never rewrites UNKNOWN history. A new migration always needs a separate plan, backup, authorization, invocation and receipt.

## Isolated validation

Only Python standard library and the cached pinned PG17 image are required. Tests use no host ports, no network and tmpfs PGDATA; owned containers are identity-checked and removed in `finally`.

```
python3 -B tests/teaching_agent_single_migration_runner_contract_test.py
python3 -B tests/teaching_agent_single_migration_runner_postgres_test.py
python3 -B tests/teaching_agent_single_migration_runner_backup_test.py
```

Test IDs map one-to-one to RUNNER-D1-01 through RUNNER-D1-51. Fault injection is confined to test code; no production fault/skip flag exists. Historical R5B unit tests run from a disposable, byte-identical historical tree so their fixed eight-migration contract remains intact. Their original evidence is never overwritten.


## Separate baseline capture / P1A

```
python3 -B scripts/teaching-agent-r7d-c3b/runner.py capture --plan acl-000-v1
```

This command accepts only the registered, byte-identical DRAFT. It does not construct
Engine, perform a backup, edit the plan or grant install authority. Existing
preflight/backup/apply/verify still require READY_FOR_INSTALL. Capture permission
and install permission are distinct; neither implies the other.

The fixed profile's private authorization directory must contain
`acl-000-v1.capture.json` (operator owned, 0600, no symlinks). No CLI/env target,
SQL, path or DSN override exists. The strict contract is
`readonly-baseline-capture-authorization/2`, scope `READ_ONLY_BASELINE_CAPTURE`.
It binds plan ID/raw SHA, migration raw/body SHA, all operational package hashes,
fixed target identity, an operator UID/nonce, explicit capture attestation,
reference/hash of the separately approved controlled-preflight-v4 proposal,
credential-file identity, and a window of at most 900 seconds. The runner does
not create this authorization. File ownership plus trusted operator attestation
is the authorization boundary, not automated verification of conversation text.
The future v4 approval remains unapproved until the user explicitly approves it.

No future catalog or descriptor digest is required. `expectedLedgerPrefixSha256`
is null for first capture. An optional existing digest can constrain a later
recapture. Without an independently known source digest, first capture cannot
classify a same-version statement change as drift; it reports the fresh changed
digest for review. It never substitutes an isolated or historical source digest.

The session uses REPEATABLE READ READ ONLY, checks transaction settings, fixed
DB/role/project/image/runtime identity and actual TLS for production, then reads
the ledger using the existing statements-inclusive serializer. Count 458, exact
ordered prior versions, absent 000/001/002, no duplicates, and the fixed ledger
column/PK/owner/no-trigger/no-rule contract must pass before protected catalog
reads. Wrong versions/count/descriptor or a supplied prior digest mismatch stops
before that family. Next it checks the exact function body/security/ACL/effective
privilege contract. Success and failure explicitly ROLLBACK the same session.

Only fixed query families are available. The capture capability exposes no SQL,
mutation session, dump, restore, apply or seal method. Credential/TLS/runtime
validation uses the existing maintenance implementation. Owned capture is a
separate Python test adapter, requiring an owned labeled network-none container
and fixture identity; it is inaccessible from the production CLI.

Private capture receipts use the existing exclusive 0600/fsync receipt mechanism.
They contain safe ordered version metadata, descriptor, target metadata,
role/default/ACL fingerprints, catalog-family and full protected catalog hashes,
query hashes and timestamps. They never contain raw ledger statements, function
body, raw role configuration or credentials. Stdout reports only status and the
receipt hash. No production capture, backup, sealing or install was performed in
P1A. Capture tests extend the existing test files; historical D1 expectations are
unchanged, and new regression logs use a new evidence directory.


## R7D-C3B transport security / scoped risk acceptance

The production profile now binds
`maintenance-transport-security/pooled-provider-managed-risk-accepted/1`.
The runner/libpq → Supavisor hop requires TCP, the pinned hostname/project,
port 5432, SESSION pooling, trusted CA and hostname verification with
`sslmode=verify-full`. GSS encryption is disabled explicitly so it cannot replace
TLS. There are no TLS/risk/endpoint overrides or fallback transports.

The Supavisor → PostgreSQL hop remains **PROVIDER_MANAGED_UNVERIFIED**.
The user accepted this residual risk for **R7D-C3B_ONLY**, including separately
approved 000/001/002 operations and release-required backup/verification.
This is neither proof of backend encryption nor a permanent security policy.
Pooler capacity and timeout risks remain operational residual risks accepted
for C3B; no provider guarantee is claimed. The historical P1D TLS rejection and
v3 proposal remain historical evidence. New source accepts only v4 capture
approval identity, never v3 fallback.

Each actual persistent psql session executes fixed `\conninfo` before yielding.
Its TLS protocol/cipher and endpoint metadata are bound to that process/session,
the fixed verify-full invocation, CA/credential identity hashes, image, package,
and operator authorization. Backend `pg_stat_ssl` is retained independently as
`true`, `false`, or `unavailable`. False/null may continue only with valid client
proof and active scoped risk authorization. An SQL observation error still
stops the transaction; it is not converted to null. Backend true never replaces
client proof. Capture/2 records both facts without raw conninfo, definitions,
statements, connection strings, or credentials.

pg_dump and pg_dumpall do not expose psql's session TLS metadata. Their proof
kind is **REAL_INVOCATION_LIBPQ_ENFORCEMENT**: each pinned process performs its
own real database operation using fixed TCP/verify-full/CA/GSS-off parameters,
finishes successfully, and yields a validated output bound to its unique
invocation. Cipher/protocol are explicitly unobserved for these tools. A psql
handshake is never proof for a dump. Only full snapshot dump, schema snapshot
dump and roles-only/no-role-passwords dump profiles are accepted. Roles capture
uses explicit initial database postgres, with no fallback to template1.

Immutable 0600/fsync sidecars live below receiptRoot/transport-invocations.
Backup/2 binds five independent proofs (exporter, full dump, schema dump, roles
dump, after-observation) in metadata/transport-proofs.json, along with snapshot,
output hashes, target, package, risk, timing and unique backup attempt identity.
Proof replay, output substitution, missing proofs and failed tools reject the
backup. The exported snapshot, role before/after check, archive checks, owned
restore comparison, sealing and retention algorithms are unchanged.

Production capture authorization/2 and operator authorization/2 additionally
require the exact `transportRiskAcceptance` binding: contract ID, risk ID/raw
artifact SHA, R7D-C3B release identity, stageActive=true and
completionObserved=false. Proposal approved=false is not operation authority;
a separately approved operation still needs the trusted operator's private
attestation and at most 900-second window. Legacy /1 authorization remains
usable only by isolated fixture plans, never by a production constructor.

At C3B completion **or risk revocation**, the release operator must publish the
fixed `receiptRoot/R7D-C3B.release-completed.json` closure receipt and cease
minting stage-active authorization. Future release completion approval must
require this step. Any marker existence (including malformed data, directory or
dangling symlink) closes the risk scope; do not delete it to reopen the stage.
Closure wins over unexpired authorization. Checks run before credentials, each
client, backup acceptance and the existing precommit authorization hook.

Transport failures distinguish CLIENT_TLS_REQUIRED,
CLIENT_TLS_IDENTITY_MISMATCH, CLIENT_TLS_PROOF_MISSING,
TRANSPORT_PROFILE_MISMATCH, PROVIDER_HOP_RISK_NOT_ACCEPTED,
RISK_ACCEPTANCE_SCOPE_EXPIRED and BACKUP_CLIENT_TLS_PROOF_MISSING.
Backend false is an observation, not a generic client TLS failure.

TLS-D4-01..36 extend the 98 existing runner/capture/order cases. Real TLS tests
use the same cached PG17 image, an existing local OpenSSL binary, ephemeral
owned certificates and a loopback listener inside a network-none container.
No production credential, connection, backup or capture is used. The plaintext
historical isolated adapter labels its proof OWNED_ISOLATED_INVOCATION; that
proof is never accepted as production TLS evidence.

## Capture authorization lifecycle / P1E-A2

The official **local-only** operator utility is:

```
python3 -B scripts/teaching-agent-r7d-c3b/capture_authorization.py mint --plan acl-000-v1 --approval-id <32hex> --approval-sha256 <64hex>
```

It never invokes capture, network clients, SQL, or credential reads. It validates
an operator-supplied `capture-execution-approval/1` in the fixed private
`capture-approvals/` directory. Every mint needs a new explicit user approval,
unique approval ID and hash-bound user attestation. This remains a trusted OS
operator attestation, not automated cryptographic verification of conversation
text. Historical approval of another attempt cannot be carried forward.
Credential identity comes only from hash-bound safe evidence or exact historical
authorization provenance; the future transport independently checks actual
credential bytes. No host/profile/path/credential/risk/force/skip override exists.

The `/2` authorization field set and `readonly-baseline-capture/2` receipt are
unchanged. The sole source authority now points to **v5**. v4 is historical only:
changed package hashes invalidate its execution authority. Until a reviewed v5
proposal exists and a user separately approves its capture scope, production
mint/capture fails closed. Implementation validation does not create v5 or mint
production authorization.

Mint and runner hold the same stable owner-only per-plan `flock(LOCK_EX|LOCK_NB)`.
Lock contention fails immediately. Never unlink/recreate a lock inode or take it
over on a PID timeout. O_EXCL/fsync claims independently burn approval IDs, user
approval-reference hashes and nonce hashes. Partial claims also deny reuse.
The state machine is VALIDATE_AND_LOCK -> PREPARE_AND_RESERVE -> ARCHIVE_OLD ->
STAGE_FRESH -> PUBLISH_CANONICAL -> COMMIT_READY. Each phase is immutable.

Archival moves exact old bytes into the SHA-addressed `capture-archive/acl-000-v1/`
namespace with Linux `renameat2(RENAME_NOREPLACE)`; no reserialization, overwrite,
deduplication, copy/delete or weaker rename fallback. Unsupported filesystem or
fsync behavior is a hard failure. Directories are individually created 0700;
files are 0600, operator-owned, regular, single-link and never symlinks. Existing
unsafe paths are rejected, never chmod/chown repaired. File and affected parent
directories are synced. Archives are preservation, not legacy cleanup.

The canonical file alone never permits dispatch. Runner requires the exact READY
receipt and phase/claim chain, a still-fresh user approval and current stage/source
bindings. It creates a durable `capture-authorization-consumption/1` claim **before
constructing CaptureTransport**, hence before credential access. The claim proves
reservation, not that a database connection happened. It is never removed, even
when the constructor, DB gate, receipt write or process fails. Formal runner replay
is denied before transport construction. Backend/TLS/query/transaction semantics
are unchanged.

The lock remains held through session close/ROLLBACK, exclusive durable capture
receipt, exact canonical archival and terminal outcome. SUCCESS is emitted only
after those complete. Finalization failure is BLOCKED_LIFECYCLE_FINALIZATION and
never restores authorization. Canonical-without-READY, partial phases, pending
files, missing outcomes and consumed-without-outcome states block. There is no
automatic recovery, resumption, cleanup, retry or fallback. Separate reviewed
forward recovery is required after an unresolved crash. A complete READY with no
consumption is one committed mint, never permission to mint twice.

`authorization-rotations/` under the fixed private receipt root stores phase,
READY, approval/nonce claim, consume and outcome records. The runner never selects
an archive or pending file as active. Trusted local operators must not bypass this
protocol by editing records or invoking internal transport APIs; flock is advisory,
not a security boundary against root or another process acting outside the contract.

Owned validation uses temporary roots only. Regression output reserves an exclusive
new `runner-p1e-a2-validation/<fresh-run-id>/` directory **before** child tests run.
Logs use exclusive creation. All older validation/capture directories are immutable;
never rerun a helper that writes an old finalized path.


## Backup authorization lifecycle

The separate local-only operator command is:

```
python3 -B scripts/teaching-agent-r7d-c3b/capture_authorization.py mint-backup --plan acl-000-v1 --approval-id <32hex> --approval-sha256 <64hex>
```

Implementation authority is forward-only. The historical
`r7d-c3b-backup-authorization-lifecycle-implementation.json` remains an immutable
blocked record at its original path; it is never a current success input.
The current consumer pins the raw SHA of D13's
`r7d-c3b-attempt2-e3-recovery-d13-forward-authority-successor-package-sealing-scope-review.json`.
Its only successful authority inputs are the following future fixed paths under
`docs/evidence/teaching-agent-stage-1f-r7d-c/`:

- `r7d-c3b-backup-authorization-lifecycle-v4-authority-resolution-validation-completion.json`,
  contract `backup-authorization-lifecycle-authority-resolution-validation-completion/2`.
- `r7d-c3b-backup-authorization-lifecycle-v4-implementation-completion.json`,
  contract `backup-authorization-lifecycle-implementation-completion/2`, status
  `IMPLEMENTATION_COMPLETE`.
- `r7d-c3b-backup-authorization-lifecycle-v4-package-lock.json`, unchanged contract
  `backup-authorization-lifecycle-package-lock/1`.

D14 does not create these records. Their absence must deny authority. The old
unversioned successful paths remain historical predecessor evidence only, with
no fallback or reinterpretation. The new closed schemas bind candidate V4,
manifest `/3`, restore `/3`, provenance `/2`, predecessor/supersession and the
final ten-entry package. These authority schema versions do not change recovery
artifact schemas or the lifecycle `/1` envelopes.

D13 requires 475 retained methods plus 24 new `BACKUP_AUTHORITY_V4_001`–`024`
methods: 499 unique tests, all raw PASS. The separately authorized validation
order is 24 successor tests, 12 historical authority tests, 196 contract tests,
231 backup tests, 72 PostgreSQL tests, and the unchanged exact historical 266
selection (801 method executions). The 7+53 authority cases must reach their
intended assertions; no pending-authority exception remains in that acceptance
gate. A fresh three-variant combined certificate must bind the same final package.
Counts in a proposed schema do not constitute executed validation evidence.

Runtime verifies the pinned resolution design, closed schemas, exact types,
current ten-entry package and raw hashes. Missing new authority fails closed:
there is no fallback to history, alternate path, selector or latest-file lookup.
Publication is exclusive and ordered validation -> completion -> package lock;
completion never refers back to the lock. The unchanged package-lock/1 binds
completion raw SHA; external backup-execution-approval/1 binds that same completion
raw SHA and the lock raw SHA. Historical files are never overwritten or moved.
Completion and package authority do not constitute human execution approval.
The source contains the design SHA and fixed output paths, never its own final
package digest or future completion/lock hashes. D13 freezes the nine other
operational members; all three new records bind the measured current authority
member as part of the final package. This keeps publication acyclic. An offline
publisher must verify actual fresh test/certification receipts before exclusive
publication; it cannot call mint to manufacture its own prerequisites.

Forward sequence: D14 implementation, D15 fresh final-package regression, D16
fresh final-package combined certification, then separately approved D17 durable
publication and read-only authority admission. Production bootstrap provenance
acquisition and any future backup authorization remain separate decisions.
There is no production mint, approval rotation, deployment or Agent Run in D14.

The existing `mint` command remains capture-only. `mint-backup` requires a fresh
external `backup-execution-approval/1` in fixed `backup-approvals/`, tied to the
completed lifecycle implementation, its new package lock and a separate explicit
human execution approval. Implementation approval never grants production backup
or mint permission. This is trusted OS operator attestation, not verification of
chat consent. Mint never executes backup, constructs transport, reads connection
credentials or opens network connections. Historical safe credential identity is
provenance only; actual bytes are revalidated after consumption by transport.

Backup uses its own `backup-lifecycle/acl-000-v1.lock`, `backup-pending/acl-000-v1`,
`backup-archive/acl-000-v1` and `receiptRoot/backup-authorization-lifecycle/acl-000-v1`.
Capture namespaces and contracts remain separate. The stable nonblocking flock
covers mint or the entire runner attempt, including finalization. Contention stops
immediately; no waiting, PID takeover or replacement of the lock inode.

Approval ID, approval raw hash, human approval hash, scope-domain nonce hash and
fresh authorization raw hash are immutable claims. PREPARED, ARCHIVED, STAGED and
PUBLISHED form a hash-bound chain; READY is written last. Canonical alone never
allows dispatch. Old bytes move via same-filesystem renameat2(RENAME_NOREPLACE)
into SHA-addressed immutable archives, never copy/delete, overwrite or deduplicate.
The historical bootstrap records HISTORICAL_USED_NO_FORMAL_CONSUME truthfully.

The official runner reserves entry, revalidates READY and durably consumes before
credential access or MaintenanceTransport construction. Only then may it reserve
one dispatch and call the unchanged backup adapter once. A consumed authorization
is burned after every outcome, including constructor failure and process crash.
Raw nonce stays only in private authorization bytes; receipts contain hashes and
fixed safe classes. Every required record is exclusive0600, with file/parent fsync
and readback in owner-only directories. There are no target, path, retry or force
options. The lock is cooperative; it cannot constrain a privileged operator who
bypasses the supported CLI or alters the trusted package.

Normal success/failure writes result, exact terminal archive and outcome, leaving
canonical absent. SUCCESS is emitted only after finalization. A primary body error
survives secondary finalization errors; finalizer-only failure is fatal. Existing
backup artifacts and receipts are preserved if finalization later fails. Missing
records, pending files, entry without consume, consumed without outcome and other
crash A-I intermediate states stop. Complete READY without entry permits just one
intentional still-approved first runner invocation, never automatic dispatch or
remint. No automatic recovery, resumption, claim deletion, move-back or retry is
provided. Separate human recovery approval is required for ambiguous states.

Future production use requires a new explicit execution decision, fresh external
approval and the new package map. This implementation neither archives the real
historical backup authorization nor mints a real production authorization.
