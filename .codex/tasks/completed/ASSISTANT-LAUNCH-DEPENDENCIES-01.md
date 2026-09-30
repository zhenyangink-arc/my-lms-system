# TASK — Assistant launch dependency and priority review
## Identity
TASK ID: ASSISTANT-LAUNCH-DEPENDENCIES-01
TITLE: Determine whether database recovery/provenance is mandatory for assistant first use and identify shortest valid route
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: reconcile current release/authorization contracts and actual dependency without weakening gates
DISPATCH RECORD REQUIRED: YES
## Objective
Read current contracts/tasks/evidence to distinguish genuine assistant launch prerequisites from maintenance/recovery research. Recommend a minimal ordered plan with clear stop conditions, reusing completed work.
## Context
User asks why this took so long and approves re-planning. Assistant explanation proposed checking necessity before any more experiments. This turn is read-only reprioritization, not authority successor or runtime. The latest consumed one-case local diagnostic is recorded in .codex/tasks/completed/SESSION-LOCK-DIAGNOSTIC-RUN-01.md and /tmp/session-lock-diagnostic-result-verify-wqslcbbp/VerificationReport.md SHA e3709ae586e97a634538cf61302a9e65cce62deac17efb9f88e47d9a936d2739. package probe rc nonzero, deeper cause unknown; do not redo that diagnosis. Current source may be later than old D11 V2; use actual current files/statuses.
## Writable Scope
Only new /tmp/assistant-launch-dependencies-* reports. No task/source/authority edits.
## Requirements
1. Read active/recently completed task metadata and current authoritative launch/Stage1/first-agent conditions via bounded rg; distinguish current from historical. Another Worker owns feature code inventory. No broad full-history review.
2. Cite exact source/doc/evidence path+line for every required prerequisite. Are backup/recovery/provenance required to apply pending ACL migration, to run any agent, to use existing read-only feature, or only specific maintenance? Keep technical dependency, policy authorization and unknown production state separate.
3. List exact already-completed items NOT to redo and current blocker chain. Do not say historical test PASS is current qualification. No production state inferred from local files.
4. Assess alternate paths: existing authorized local/synthetic demonstration or read-only feature route if explicitly supported; no weakening safety/reclassifying previously forbidden Agent Run. If choosing new product scope would need user decision, formulate one concrete decision with consequences.
5. Recommend shortest lawful sequence (prefer3–5 work packages, no guaranteed duration/count). For each: concrete output, hard acceptance, dependencies, exact likely file scope, suitable worker profile/effort, necessary user approval, stop condition. Group related prep/review into one task; avoid making every internal check a new user round. If local package probe truly remains critical path, explain why in plain language.
6. Conclude whether more current diagnostic is justified NOW, can defer for first useful experience, or unresolved. Explain certainty with evidence. Keep concise ~2pages and send key findings early. No new diagnostic packet/run or source fix in this inventory.

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
