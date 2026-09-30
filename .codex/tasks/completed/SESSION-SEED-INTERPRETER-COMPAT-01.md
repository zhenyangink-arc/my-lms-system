# TASK — Fixed interpreter path compatibility

## Identity
TASK ID: SESSION-SEED-INTERPRETER-COMPAT-01
TITLE: Minimal private diagnostic interpreter binding/read correction
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium (GPT-6 Sol medium)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED; private diagnostic path compatibility only, operational/security contracts unchanged.
MODEL ROUTING REASON: One precisely proven private harness defect; scope and intended behavior fixed. Escalate if broader design is actually needed.
DISPATCH RECORD REQUIRED: YES

## Objective
Produce a new private diagnostic package that correctly handles the fixed Python interpreter path and checks the real runtime binding reader during preparation. Do not execute diagnostic.

## Context
Previous approved diagnostic stopped in preflight before launch/action/child. /home/yangzhen/miniconda3/bin/python3 is symlink to python3.14; generic O_NOFOLLOW read raised ELOOP40. Actual interpreter bytes match frozen SHA bfad6f00ca222ee6445c391a97653939f9086b7f571fa0ead9a5b53fe303c97f. Preparation Path.read_bytes followed link and stubbed bind_inputs, so preparation missed actual-read incompatibility.
Bindings:
- Public preflight result docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-seed-diagnostic-attempt-1-result.json SHA 5a3078117341b5ac9cecb8ef57ca9834a20f9c62bb1cf8090eb7a120e45f512f.
- Worker /tmp/session-seed-diagnostic-execution-3843o6jr/WorkerReport.md SHA 16b469db32dd892391a173e17ab373e613b429e27e6c0e967b733c43c2a50aa7.
- Verifier /tmp/session-seed-preflight-stop-verify-5NQq3T/VerificationReport.md SHA de47f6f095f7ea026b24415f73b84e04e67439d16446cdae857aeb33aa66a9c5.
- Old prepared package /tmp/session-seed-diagnostic-prep-r1-_r6zpmbw, packet SHA f7690c1eb1445c58dbf395ab115ba95c84e71876d6cf312cce3fb6f545e59465, script SHA 8a6cc137021a1a206fece95fd3dbef9fb1bf39678f4cef775d6482c934d28f99.

## Scope
WRITABLE SCOPE: new private /tmp/session-seed-interpreter-compat-* only. Supervisor owns task lifecycle metadata.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, CODEX_VERIFICATION.md, prior package, stop evidence, necessary frozen source/hash references and exact interpreter alias/target metadata/bytes.
FORBIDDEN: changes to old package/history/source/tests/fixtures/README/authority/lock/completion/native; .env/credentials; AGENTS/CODEX files/.codex changes; Docker even inspect; DB/SQL/network; diagnostic/fixture/import side effects; repository tests/build/downloads/git stage/commit/push; querying or removing old retained container. Do not read sensitive approval-b2-provisioning.before-initial-ban-workflow.json.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. All operational source/functions/args, diagnostic budgets/observer/one-use parent-child guards/cleanup/privacy remain unchanged except exact necessary interpreter pin/read/preparation validation and package/path rebindings. No blanket symlink allowance or removed hash checks.
DATABASE IMPACT: NONE. RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: LOW/MEDIUM (private fixed interpreter binding; preserve fail-closed identity).

## Requirements
1. Reuse already closed forensics/preparation. Fresh hash named inputs and necessary source only; do not redo915tests or fourgroupreview.
2. Choose smallest exact interpreter pin/read strategy: bind exact approved alias-to-real-target relationship and actual target bytes, or use explicitly pinned real interpreter path consistently with exact command/child and document necessity. Preserve O_NOFOLLOW for ordinary inputs. Reject unrelated/changed symlink target, changed bytes, missing/unexpected path. Do not treat matching bytes at arbitrary path as approved identity.
3. No generic symlink following. No arbitrary PATH/interpreter discovery or fallback. No executable run/version probe. Read/stat/hash only.
4. Fix preparation validation to exercise the exact real binding reader against current actual fixed input files, not a mocked substitute, while stopping before action marker/import/fixture/Popen. Must prove this offline path has no runtime side effects. This directly addresses previous test coverage gap.
5. Add minimum pure offline negatives for target/path mismatch, hash mismatch, unsupported ordinary-input symlink, missing interpreter, plus positive exact alias/real binding as designed. Use private synthetic files only; never mutate interpreter/source. Pure helper checks must not create processes, perform Docker/network/DB, import fixture or signal real processes.
6. Preserve prior F1/F2 fixes, all other source calls/observer/ownership/memory/topology/deadlines/private output policy. Exact textual/AST diff classification should show only allowed correction + package rebindings + focused offline coverage. Do not expand driver framework.
7. Old package/evidence remain untouched. Generate complete new packet/script/bindings/approval command/WorkerReport/delivery hashes. Private files0600, parent0700, durability/readback as appropriate. Existing output path means do not overwrite frozen package; use unique new directory.
8. New command is proposal only. No RUN_ONCE/WORKER_STARTED/run-private output created. All runtime counters0. Root cause of seed remains NOT_VALIDATED, formal qualification FAIL_NOT_QUALIFIED.
9. Deliver exact minimal diff, offline checks/results/known limitations, finite before/after source+old package proofs, new exact command+SHAs ready for independent review. Cannot close within this scope: report specific escalation, not broader changes.

## Out of Scope
Seed root cause diagnosis, actual local run, test fixes SESSION003/008/016/025, production inputs, credential access, formal revalidation/authority.

## Acceptance Criteria
Exact real binding read passes offline, negatives fail closed; ordinary-file protections unchanged; prior reviewed guards preserved; new sealed private package and concrete runtime proposal, no execution or repo implementation mutation.

## Required Validation
Syntax/AST/diff/hash and smallest pure reader checks only. TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION suites NOT_REQUIRED and prohibited. Explicitly label helper checks PREPARATION_ONLY not runtime validation.

## Risk Focus
Repeating stub coverage gap; weakening symlink/hash boundary; unnoticed command interpreter drift; consuming one-use marker during preparation; source mutation; unauthorized runtime.

## Parallelism
CAN RUN IN PARALLEL: NO. Worker then independent verifier; no worktree needed.

## Escalation Rule
If correction requires operational or security-contract changes, stop and request scope/gate review. Medium-to-high only with concrete added complexity; do not silently expand.

## Worker Report
Follow CODEX_WORKER.md. Include selected profile/model, actual metadata visibility, exact modified private files, pure checks/commands/rc, diff and all evidence pins, limits and next minimum task.

## Verification Report
Follow CODEX_VERIFICATION.md. Independent narrow correction review, especially real-reader coverage and unchanged ordinary O_NOFOLLOW/one-use/cleanup. No Docker/tests/runtime. PASS means package ready for approval, not seed/recovery PASS.

## Supervisor Final Review
RESULT: PASS, PREPARATION_ONLY. READY_FOR_APPROVAL: YES.
Worker selected worker_medium / GPT-6 Sol medium. Independent verifier selected verifier / GPT-6 Sol high.
Final private package: /tmp/session-seed-interpreter-compat-r1-cSGmUiCp.
ApprovalPacket.json SHA256 ec2c727148d1974fce7e649bdf92c7d44b94723cfd107d2ec1cd546464290faf.
Script SHA256 ab7facfd973217dad95a77f8bc5535ece4eef986aee12ecb8fec513a36029cc1.
WorkerReport SHA256 d4948b1bfa97f7973ccf820d79b78b748273bd45aa517c1a4c2821827e199fa3.
Independent VerificationReport-R1: /tmp/session-seed-interpreter-compat-r1-verify-vRedRb/VerificationReport-R1.md SHA256 be81e0b36725ccdd5fc04271dfc59acc977381863ade0cfbcc16cef737619ead.
Fixed exact interpreter alias/target reading, retained ordinary O_NOFOLLOW, actual current binding-reader coverage passed. Initial atime false-rejection finding corrected by stable metadata comparison; actual atime-only positive and stable-metadata negative passed. 23 preparation-only checks. Existing launch/observer/cleanup/budgets and other AST preserved. Old packages and source unchanged.
No diagnostic, Docker, database, fixture import or production execution. Runtime/seed cause NOT_VALIDATED, formal qualification FAIL_NOT_QUALIFIED. Revised frozen command requires approval before a single runtime execution.
