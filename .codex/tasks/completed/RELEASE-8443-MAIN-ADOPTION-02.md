# TASK — Adopt the accepted8443 reconciliation into local main

## Identity
TASK ID: RELEASE-8443-MAIN-ADOPTION-02
STATUS: COMPLETED
TITLE: 核验已验收提交并合入本地主项目，整理上线前置条件；不推送、不部署。

## Routing
IMPLEMENTATION PROFILE: worker_medium / GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED for byte-exact Git adoption; previous reconciliation Gate/critical acceptance remains bound. No code/contract redesign authorized.
VERIFICATION PROFILE: verifier / GPT-6.1 Sol high
DISPATCH RECORD REQUIRED: YES

## Objective and authorization
The user replied “好的” to the completed reconciliation and proposed next step to review/adopt main then assess rollout prerequisites. Root proceeds with local-only adoption after fresh preflight and explicit Supervisor release of the Git step. Remote push, deployment, production DB access and migration execution remain excluded. Do not rerun already completed implementation/semantic tests just to adopt identical bytes.

## Frozen inputs
- Current expected main before adoption: c3503cb50298a8118008cf143ad87837e6a3d6b3.
- Accepted candidate: codex/merge-8443-into-main,64f51c8b1040a82be5815a0498a6c7398bde010e; sole parent is expectedmain.
- Completed Task01: .codex/tasks/completed/RELEASE-8443-RECONCILE-01.md, SHA25607a2986d01f54f88d4ba168c4ee85c18cbbb2de62f4ab86e803f7cd2a266f4ad.
- Critical acceptance: /tmp/release-8443-reconcile-verify/PhaseB/VerificationReport-PhaseB.md, SHAc436e5b5119c069b4d35ecaada940985b6d7c4366dd3154f62e5421b63ea6103.
- CommitReport /tmp/release-8443-reconcile-impl/CommitReport.md SHA7b858413d38c30ac9df591d34ea32a7912a2f8909470e6c8b6f9ae90756872ab.
- Accepted94-path freeze /tmp/release-8443-reconcile-impl/all-changed-paths-final-freeze.json SHA12b2e63ef53fa77f5f509c764fa3d76eb2718090633470b108ac51c1bf92195f.

## Scope
Phase A: readonly preflight; private report/scripts /tmp/release-8443-main-adoption-02/ only. Read root Git state, tracked/untracked path metadata, accepted commits/frozen manifests, previous reports and repository deployment docs. Do not read real env/credential/private config contents. Main worktree any existing user changes must be preserved, never stash/reset/clean/overwrite.
Phase B: only after Supervisor consumes preflight and sends proceed; sole Git owner may fast-forward local main to EXACT acceptedOID with git merge --ff-only. Check branch/head immediately before operation. Git checkout/update of exactly accepted94 paths only; no manual source edits/new source paths, no extra merge/cherry-pick/rebase. Keep other branch refs and worktrees. If divergence, source mismatch, unexpectedchanges or executable hooks: STOP, report, do not adapt.
Task metadata is root-owned. Worker cannot edit .codex/AGENTS/CODEX docs. May retain completed Task01 and newactiveTask02 as untracked metadata; do not accidentally stage them or anything else. No additional commit requested during adoption.

Allowed readonly runtime check: process metadata ONLY to ensure main is not serving the live8443 site. Prefer already-running PM2 daemon's jlist parsed in-memory into name/status/pid/cwd/restart_time; never print/save raw env or raw jlist. Check daemon existence before invoking to avoid spawning one. No PM2 mutation/start/restart/save, no Tailscale mutation, no live HTTP/browser, no sockets/credentials/DB. If current main cwd is an active app server or runtime mapping cannot be bounded safely, report before adoption.

## Contracts and forbidden operations
MAY CHANGE PUBLIC CONTRACT: NO; bytes already independently accepted.
DATABASE/RLS/AUTH IMPACT: NO NEW CHANGES; no DB operations.
Forbidden: remote fetch/pull/push, forced refs/historyrewrite/reset/clean/stash, deployment/build/appstartup/packageinstall/Docker/SQL/migrations, realenv/privatecredentialread, production access, capture/authority/completion/lock changes, source/test fixes.
Do not repair five baseline test failures or existing lint/SQL gaps in this Task. No automatic full tests; Git/blob/hash checks are sufficient for identical-byte adoption. New drift requires review, not silent validation reuse.

## Requirements
1. Freshhash all bindings, candidate94 Git blobs/modes and worktree vs frozenmanifest; exact parent/ref/mainHEAD and emptyindex/trackedclean precondition. Enumerate untracked paths safely; preserve unrelatedfiles.
2. Check absence of active Git hooks/configured hooks that could mutate runtime. Identify local ref ahead/behind cachedorigin only, no network.
3. Collect non-sensitive runtime identity metadata as above; ensure live release/source location remains separate from main. Record limits, no claim of applied DB schema or runtime compiled-source match.
4. Worker Report A: PASS/blockedpreconditions, exact proposed command, preservation proof, knownvalidationdebt and minimal rollout prerequisite list recovered from existingevidence. STOP at mutation boundary pending Supervisor proceed (not another user permission by default).
5. On proceed: git merge --ff-only exactcandidate; verify main == acceptedOID and exacttree/blobs; no newcommit; trackedworktree/index clean; untrackedunchanged; migrationtree unchanged; release-source baseline and allowed runtime metadata unchanged if observed. No unrelatedfile cleanup.
6. Final WorkerReport and independentVerification; root archivesTask.

## Acceptance criteria
- main adopted exactly acceptedOID, no newcode or accidentalchanges, no historyrewrite.
- main source bytes equal acceptedcandidate,464migrations unchanged.
- all existingmetadata/untrackedfiles preserved; no stage/extra commit.
- online website unmodified by this Task; no push/deploy/DB calls.
- concise rollout readiness summary identifies actualunknowns: appliedmigrationledger, currentcompiled/configmapping, fivebaselineunit failures+lint+SQL gap, build/preview/rollback/productionacceptance; no fabricatedgreen.

## Required validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E: NOT_RERUN (identical acceptedcommit, noimplementation). Prior pass/fail/skip retained as history.
GIT/HASH/DIFFCHECK: REQUIRED.
PRODUCTION: NOT_AUTHORIZED.

## Parallelism
Serial Git owner; verifier read-only after adoption. No other root-index writers.

## Escalation
Any divergenthead, drift, dirtytracked/index, mainruntime risk, hook or neededsourcechange: STOP, reportSCOPE_CHANGE_REQUEST. No automatic repair.

## Worker/Verification Report
Read CODEX_WORKER.md / CODEX_VERIFICATION.md respectively. Fullreport withcommands/results/hashes/risks/notvalidated required. Explain result in plainChinese for user.


## Runtime metadata clarification (pre-merge, readonly)

WorkerReport-A Git/hash gates PASS, but PM2 cezar is online with cwd=main. No merge performed. Supervisor allows the existing Worker to read TWO additional non-sensitive PM2 fields for the named cezar/uply processes: pm_exec_path and exec_interpreter. Never output/read saved env, args, command lines, logs, private config or socket content. Parse already-running daemon output in memory and discard all other fields. May inspect safe package.json name/bin/scripts metadata associated with the exact resolved program path and tracked repository references to cezar (exclude env/private state). May read /proc cwd/comm/exe symlink metadata for the identified PID only; no environ/cmdline. Goal is distinguish external developer tooling from a server executing/watching main's changed94 files. No HTTP requests or process actions. If entrypath cannot prove dependency isolation, report bounded unknown rather than guess or terminate the process. Root consumes updated report before permitting FF. This adds readonly metadata only; no architecture/code scope change.


### Final bounded runtime identity resolution

The known cezar process is a bash/npm wrapper; historical tracked preflight calls it an auxiliary service, but final executable has not yet been identified. Root permits one consolidated readonly resolution: enumerate ONLY this PID's descendants via pid/ppid/comm/cwd/exe metadata; for node processes in this tree read only the first two NUL-delimited argv tokens, stop before other arguments, and emit only a verified executable/script filesystem path (otherwise record REDACTED/UNRESOLVED). Do not dump full cmdline or args and never read environ, configs, logs or socket payloads. Inspect the exact externally installed package's safe name/version/bin metadata and narrowly relevant executable source imports/server-root/watch behavior only if needed to establish that it runs the auxiliary tool rather than the LMS frommain. No broad npm/cache search, package execution, HTTP, credentials or dependency installation. Correlate with releasePID5778/cwd and expectedmain94paths. This is read-only system/tool identity, not production data access. The full report must distinguish a tool observing workspace changes from a server executing LMS source; generic workspace observation alone does not prohibit a localGit fast-forward. No further probe expansion without reporting; root decides from completed bounded facts.


## Supervisor final review

DECISION: PASS — local exact-byte adoption only.
FINAL MAIN: 64f51c8b1040a82be5815a0498a6c7398bde010e.
PREVIOUS MAIN: c3503cb50298a8118008cf143ad87837e6a3d6b3.

The runtime HOLD was resolved before mutation: the cezar process serves its own external developer-tool package rather than the LMS from main. Supervisor reviewed WorkerReport-A and RuntimeResolution and explicitly authorized the single exact fast-forward. The initial sandbox attempt failed before adoption; the same command ran with approved escalation and exited 0. No additional commit, source edit, remote operation, deployment, database operation or service action was performed.

WorkerReport-B: /tmp/release-8443-main-adoption-02/WorkerReport-B.md
SHA256: f0f26ec6b117c002f4bb7bc1c3e3232453dce163189a9ec82a331ce0afbbf9a8.
Independent VerificationReport: /tmp/release-8443-main-adoption-02-verify/VerificationReport.md
SHA256: e86ad62be875cfb3013288eae9d0bc9675ca56b8e066f3df68db76d4a6580d87.
Independent result: PASS, 131 assertions. Exact94 file hashes/OIDs/modes match the frozen accepted commit; all464 migration entries unchanged; tracked worktree/index clean; other refs/worktrees and both root-owned task files preserved at verification time. This subsequent root-owned Task02 archival is metadata-only and remains untracked; Task01 is unchanged.

Prior validation remains historical: 542 PASS / 5 baseline FAIL / 1 SQL SKIP; source lint 1 preexisting error / 8 warnings. No semantic test suite was rerun for adoption. Production applied migration ledger, real DB/RLS/RPC, build/config/source parity and actual deployed UI/native/media behavior remain NOT VALIDATED. Runtime evidence proves recorded PID/cwd/restart continuity only, not live byte equality.

Next minimum task: prepare a separately scoped release-readiness review: disposition existing test/lint/SQL debt; bind build/preview and rollback plan; establish production migration/config prerequisites under suitable authorization. This task does not authorize pushing, deployment, migration or runtime activation.

Plain-language outcome: 已验收的界面调整已合入本地主项目 main，并保留新视频教学代码；8443 仍运行原发布副本。未推送、未部署。
