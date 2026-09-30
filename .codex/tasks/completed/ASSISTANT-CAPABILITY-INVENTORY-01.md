# TASK — Assistant capability inventory
## Identity
TASK ID: ASSISTANT-CAPABILITY-INVENTORY-01
TITLE: Establish what the user's assistant actually implements and the smallest meaningful first-use scenario
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: bounded source and saved-result inventory; no implementation or execution
DISPATCH RECORD REQUIRED: YES
## Objective
User asks to reorganize work after long database-recovery detour. Identify actual assistant UI/API/runtime/tools already present and concrete missing first-use behavior, in plain Chinese, without treating recovery infrastructure as the whole product.
## Context
Recent single SESSION001 diagnostic failed package self-check. Latest report /tmp/session-lock-diagnostic-result-verify-wqslcbbp/VerificationReport.md records evidence valid, test ERROR, exact shell subcommand unknown. Do not investigate that failure here. Main project my-lms-system teaching assistant/agent. Prior user wants first useful agent and clear progress.
## Writable Scope
Only new /tmp/assistant-capability-inventory-* report files; no .codex edits.
## Requirements
1. First recover git branch/status/changed path names read-only (no sensitive diff bodies). Identify relevant source modules and current task/docs, using rg. Do not independently re-audit infrastructure gates; other Worker owns that.
2. Trace actual assistant entry UI/API -> runtime/provider -> tools/storage. Separate learner-facing tutor, teacher/admin assistant/content workflow, and unrelated app features if multiple exist; do not invent their equivalence.
3. Up to10 capability rows: user-visible action, exact source path/line, implementation status, saved test evidence if directly available, remaining unknown. Review only closest current saved result; don't read every historicalD file or execute tests.
4. Recommend one smallest meaningful first use supported by actual design. Identify required credentials/services/config by categories only, no secret reads. Do not propose bypassing disabled flags/Auth/RLS/gates.
5. List what can be worked on now without production (docs/static/product gaps/test design), what requires separate approval, and exact likely implementation paths ONLY if actually needed. Do not write implementation.
6. Aim concise ~2pages report. Give first findings promptly. Need practical next task and completion condition, not another open-ended research programme.

## Scope and constraints
Repository is read-only for Worker. Write only your own new private /tmp directory (0700/files0600). Supervisor owns task metadata. No source/test/fixture/README/config/migration/authority/history changes. No Docker, DB/SQL, network, Provider/model calls, Agent Run, server/browser launch, tests/build/import execution, environment/credential/private approval reads, purchases, commits/pushes or cleanup. Never read .env* or the private provisioning-before-initial-ban approval file. Never scan/query/delete old containers. You are not alone; preserve unrelated edits.
## Contracts / Data impact
MAY CHANGE PUBLIC CONTRACT: NO. No schema/Auth/RLS/agent-core changes. Existing production/Agent Run gates stay in effect; this inventory cannot authorize execution or remove a gate. Architecture Gate NOT_REQUIRED for read-only inventory; flag any recommendation that would change contract/security for future Gate.
## Required validation
Read-only file/line/source-status evidence. Reuse saved validation reports; don't rerun tests. Distinguish implemented, previously tested (date/scope), current-runtime NOT VALIDATED, authorized/not-authorized. Source existence is not usability proof. No broad history audit or redoing closed diagnostic. Hash your final report.
## Parallelism
Two inventory Workers may run in parallel: no repository writes, separate private report directories, distinct questions. Verification follows both reports, no runtime.
## Escalation
Stop expanding scope for credentials/runtime/public-contract decisions. Report concrete missing evidence; do not invent percent complete, completion date or guaranteed remaining step count.
## Reports
Read CODEX_WORKER.md. Full but concise Worker Report with scope, findings, exact evidence pointers, known limitations, prioritized next task recommendation and report SHA. Supervisor gives final judgment. Read CODEX_VERIFICATION.md only when assigned verification.

## Supervisor Dispatch Status
REVIEW: BLOCKED — Worker service returned account usage-limit error before a Worker Report was delivered. No report directory exists for either new inventory task. Neither capability readiness nor mandatory-launch dependency has been freshly established. Do not record PASS or substitute a report from the older package diagnostic.
Dispatch attempted once per assigned Worker; no model escalation, purchase, or repeated dispatch used to work around the limit. Existing source/runtime/production unchanged by this planning round.
Provisional scheduling only: (1) capability inventory and launch-dependency inventory in parallel; (2) one combined independent report review to select a concrete first-use scenario and its actual prerequisites; (3) implement only the proven minimum missing piece, or continue a narrowly scoped package diagnostic only if first-use contracts require that path; (4) validate the selected user-visible scenario. Items3/4 are not executable task packets or runtime authorization and must be specified from the inventory findings.
Priority guard: do not continue database diagnostic experiments merely because they were the previous workstream. Preserve closed test fixes, completed diagnostic evidence and existing authorization gates. Any local demonstration/production route must be grounded in actual current contracts. No guaranteed time-to-use, remaining task count, percentage-complete or feature readiness is asserted.
Resume: complete these exact tasks when Worker service becomes available, retaining current scopes and prior work; do not restart historical research. Supervisor has read task metadata only for provisional scheduling and has not performed substitute feature/source verification.

## Resume
User requested continuation; same assigned Worker resumed on existing read-only scope. Prior quota interruption remains historical. No tests, Docker, DB, Provider or new diagnostic authorization.

## Supervisor Final Review
RESULT: PASS — bounded read-only inventory and evidence review, not product runtime qualification.
Capability report /tmp/assistant-capability-inventory-qxh1uhq8/WorkerReport.md SHA256 484f460023fdcb65ce350afef014b8733d9f9fa0dbc0e07479b0d4ab8c464815.
Dependency report /tmp/assistant-launch-dependencies-z1_y47wk/WorkerReport.md SHA256 1c3ef83823a51d09bc34cad9142b5243987bc342d91ab9b6e08909dcbc4f1dbf plus required ReportCorrection.md SHA256 bf2352148f8daaba44f9a0af7deced45c4bde447f1c18985ec17bcea4719c917. Original metadata error corrected by immutable addendum; actual assigned worker_high/GPT-6.1 Sol high.
Independent /tmp/assistant-inventory-review-2EPqQ6dY/VerificationReport.md SHA256 ff3b5da93d1ac75ae579bcb3a7a75fc2ff8667a9050d99b1519b2e8c87c7a8ea. Eight decisive static claim groups independently supported, no tests/runtime.
Explain is the original first-delivery scenario. UI/API/runtime/Tool/persistedRun implementation exists; current deployed/live behavior NOT VALIDATED. Summary server implementation does not imply public UI availability or first-use necessity. First Enable still requires exact bounded scope, recovery point, known-good artifact and separate ON/Provider/Agent authorization; mandatory runner backup gates remain intact. No claim that SESSION can be deferred; unresolved until next scoped Gate/current-state evidence.
Next task EXPLAIN-FIRST-USE-PREPARATION-01 freezes one existing scenario, finite seven-category gap matrix and actionable acceptance card. No new product preference question needed. No database diagnostic/source fix/production activation authorized by this review. Preserve all completed work. Current turn changed only Supervisor task metadata; Worker/Verifier private reports, runtime/DB/Docker/Provider/Agent counts0.
