# TASK — Assistant Agent durable handoff

## Identity
TASK ID: ASSISTANT-AGENT-HANDOFF-01
TITLE: Save completed work and the concrete next task for Claude/Codex
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — document accepted decisions, no new design
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: bounded documentation task requiring context synthesis; no code or runtime
DISPATCH RECORD REQUIRED: YES
EXPECTED DISPATCH FORMAT: [SPAWN] <task_name> -> <profile> | <model> <effort> | <reason>

## Objective
Produce docs/ASSISTANT_AGENT_HANDOFF.md in Chinese: a portable, self-contained handoff another agent can read and use to continue the actual next task without repeating completed work.

## Context
User explicitly requests a Markdown file in the project with completed work and next tasks for Claude/Codex. EXPLAIN-FIRST-USE-PREPARATION-01 is completed and independently verified preparation-only PASS. Runtime/production eligibility remains NOT VALIDATED. Existing working tree is dirty; preserve all pre-existing changes. Current branch main HEAD 8cf97261037ffbce53e55e083ea9026be4e993f1 (read snapshot, not package authority).

## Scope
WRITABLE SCOPE:
- docs/ASSISTANT_AGENT_HANDOFF.md (new; STOP if exists)
- new private /tmp/assistant-agent-handoff-* WorkerReport
Verifier: new private /tmp/assistant-agent-handoff-verify-* only.
Supervisor: this task metadata and archival only.
READABLE DEPENDENCIES:
- AGENTS.md, CODEX_SUPERVISOR.md, CODEX_WORKER.md, CODEX_VERIFICATION.md
- .codex/tasks/completed/EXPLAIN-FIRST-USE-PREPARATION-01.md
- .codex/tasks/completed/ASSISTANT-CAPABILITY-INVENTORY-01.md
- .codex/tasks/completed/ASSISTANT-LAUNCH-DEPENDENCIES-01.md
- .codex/tasks/completed/ASSISTANT-INVENTORY-REVIEW-01.md
- .codex/tasks/completed/SESSION-LOCK-DIAGNOSTIC-RUN-01.md
- /tmp/explain-first-use-gate-B1QE9dvY/{GateReport.md,SourceHashes.txt}
- /tmp/explain-first-use-preparation-mf7u65_t/{WorkerReport.md,FirstUseAcceptanceCard.md,LaunchGapMatrix.json,ReadOnlyQualificationRequest.md,SourceHashes.txt}
- /tmp/explain-first-use-verify-rqmw8p6x/VerificationReport.md
- finite directly cited non-secret project docs/source if needed; do not repeat inventories
FORBIDDEN: modifying any existing repository files, source/tests/fixtures/README/rules/.codex/history/authority/completion/lock; env/credentials/private approvals; runtime imports/tests/build/browser/DB/SQL/Docker/network/Provider/Agent/production/deploy/purchases; commits/push/reverts; container inspection/deletion. Do not read the sensitive approval-b2-provisioning.before-initial-ban-workflow.json file.

## Contracts
PUBLIC CONTRACTS: unchanged. MAY CHANGE PUBLIC CONTRACT: NO.

## Data / Security Impact
DATABASE IMPACT: NONE. RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: LOW (documentation; preserve constraints).

## Requirements
1. Explain user-facing purpose first: student selects one published Korean sentence, gets grounded explanation, terminal result, no learning progress mutation. Distinguish existing implementation from live validation, teacher assistant/summary from this first feature.
2. Document completed inventories, Gate, packet and independent review with durable repository task links and original report hashes. Include essential acceptance and seven launch-gap facts inline; /tmp can disappear, so the handoff must not depend on merely following temporary links.
3. Record current unknowns: release/import closure, schema/RPC/security, student/lesson/pins, tenant definition/allowlist/actual OFF, recovery/known-good/restore authority, Provider fields/budget, stop/drain. All remain NOT VALIDATED. No live authorization created by this document.
4. Give ONE immediate next task: build concrete non-secret target-to-readmethod binding from existing records. Specify inputs, finite actions, output fields/projections/filters/max results/operator/window/authorization references, acceptance and stop conditions. Do not invent serving state/endpoints/approvals. This is preparation for a single separately approved bounded read, not seven open-ended design rounds. Current request NOT RUNNABLE; binding is only immediate request-readiness gap, not the only launch gap.
5. Preserve existing route: qualify historical approved Explain release first, do not equate historical deployment with serving now or bypass C3B NO-GO/security/known ACL. SESSION deferral is conditional. Explain writes Run/usage/trace and sends data to Provider.
6. Summarize paused SESSION diagnostic precisely from completed task, not current main task: single attempt consumed, observed image_preflight package probe failure, deeper cause unknown, no automatic rerun/pull/build/production, no speculative fix. Preserve user-kept unowned container policy. Old D-series milestones are history, not current task authority.
7. Include concise ordered later steps conditional on findings, no promised count/date, no manufactured authority. Add copyable prompt for Claude/Codex: read rules/handoff, resume immediate preparation task, preserve worktree, follow Supervisor/Worker/report process, choose effort by actual task.
8. Include known worktree snapshot and warnings: existing unrelated modifications are not this work; no broad git add/reset/commit; no secrets in handoff. User requested no service purchases; real Provider costs require explicit bounded approval.
9. Do not create extra repository artifacts or rewrite old evidence. Markdown links should work inside repository; temporary reports labelled machine-local/nonportable. Make useful and readable (aim 180–260 lines, not a history dump).

## Out of Scope
Any implementation, database inspection, runtime qualification, new diagnostics, authority, enabling the assistant, real Agent or Provider run.

## Acceptance Criteria
One self-contained project Markdown file, truthful completed/unknown separation, actionable next task, references and scope intact; no unauthorized files changed.

## Required Validation
Static Markdown/link/hash/scope check only. TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED. No runtime tests for documentation. Worker reports actual checks; independent verifier checks finite handoff consistency, not all historical assertions.

## Risk Focus
Stale history mistaken for current validation, temporary evidence loss, accidental authorization widening, new agent restarting old work, secret leakage, dirty-worktree damage.

## Parallelism
CAN RUN IN PARALLEL: NO — Worker then verifier. WORKTREE: OPTIONAL (single new doc).

## Escalation Rule
Scope/contract/runtime changes: report SCOPE_CHANGE_REQUEST, do not perform. No new architecture decisions.

## Worker Report
CODEX_WORKER.md format; doc path/SHA, sources, actual checks, limitations.

## Verification Report
CODEX_VERIFICATION.md format; result, consistency, scope, limitations.

## Supervisor Final Review
RESULT: PASS — documentation only.
Delivered docs/ASSISTANT_AGENT_HANDOFF.md, 203 lines. SHA256 19494beb5fe1d5b0bebdb9c7158bed9d1d23d90aca6321c8a52d28d0df7102be.
WorkerReport: /tmp/assistant-agent-handoff-d3es2cr1/WorkerReport.md
SHA256: 141739a9e9ed6ab9504bdb913155dde468392d222c496630b790fbd9965ed9c3.
VerificationReport: /tmp/assistant-agent-handoff-verify-sp4c7o5_/VerificationReport.md
SHA256: 6276c635e877297fe342582908ee9b1a98db3c627990c857b5da8ae905e84a63.
Supervisor read the actual document and both reports. Independent verifier PASS: self-contained handoff, 15 links, recent evidence hashes, actual versus unknown separation, paused SESSION scope, no runtime authorization expansion. Verifier corrected one overly strict historical citation assertion; no document defect or modification resulted. No historical audit or business test repeated.
Scope: new handoff Markdown, private reports, Supervisor Task metadata only. Existing unrelated dirty files preserved; no claim of process-level whole-repository immutability. No commit/push, source changes, runtime tests, credentials, database, production, Provider, Agent or purchases.
Next action for recipient: read AGENTS/CODEX manuals and handoff, then prepare finite target-to-readmethod bindings from existing non-secret records. All seven live qualification categories remain NOT VALIDATED. Current read request NOT RUNNABLE; no actual read/enable permission supplied by this document.
