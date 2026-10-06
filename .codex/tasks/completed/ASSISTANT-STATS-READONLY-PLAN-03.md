# TASK — 学习助手统计只读核对方案

## Identity
TASK ID: ASSISTANT-STATS-READONLY-PLAN-03
STATUS: BLOCKED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED for offline planning; no API/Auth/RLS/schema modification.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high, offline plan audit only.
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: Reuse established field mapping and prepare a concrete finite read-only operation, without another browser loop.

## Objective
Determine whether existing referenced non-sensitive evidence can substantiate the guide's learner statistics. If not, prepare one concrete, bounded read-only comparison proposal for the current learner, before requesting any new live access.

## Context
User says continue after ASSISTANT-LEARNING-DATA-LIVE-CHECK-02. Prior manually operated two-chat basic acceptance PASS; actual records page loaded with learning time/completed-lesson summaries. Those summaries have different scopes from guide node/test/assignment statistics. Current source route trace found no matching model-free context GET. Agent-chat POST and assignment GET with grade-release RPC are unsuitable. No repeated UI/login/port discovery; old recovery/authority work is unrelated.

## Scope
WRITABLE SCOPE: Worker new private /tmp report only. Supervisor owns Task metadata.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, recent active/completed acceptance Tasks and referenced reports, docs/ASSISTANT_AGENT_HANDOFF.md and only directly referenced non-sensitive evidence indexes; guide-agent-progress.ts and immediately relevant existing user-identity lookup/data-client source if needed to freeze the proposal.
FORBIDDEN: .env/secrets/credentials/authorization/private source dumps/browser profiles/cookies/storage; executing database clients or scripts; browser/network/DB/SQL/model/test/build/runtime operations; source/test/config/Auth/RLS/schema/authority changes; new API; scanning unrelated historical recovery evidence or arbitrary /tmp scripts. Do not read the known sensitive approval-b2-provisioning.before-initial-ban-workflow.json artifact.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO.
Historical snapshots, if any, are not current data or deployed-version proof. The old Task did not authorize database/credential access; this Task designs a concrete proposal only. Supervisor evaluates existing user authorization and any required separate confirmation before live work.

## Data / Security Impact
Offline source/report reads only. No student raw data acquisition. Proposed future method must be current-project/current-learner scoped, no secrets in reports, no writes or RLS alteration.

## Requirements
1. Restore current git/Task state from narrow evidence and preserve other work. No rerun of passed acceptance/source tracing.
2. Follow only handoff/Task-referenced learner evidence; stop if no corresponding real snapshot is available. Do not guess /tmp scripts or read unrelated private artifacts.
3. If no direct proof, specify a single minimal read-only proposal: project my-lms-system / jubdbsjsalpecfvseskz; unique chen001 tenant/student mapping; same guide filters/fields/order/limits; only necessary aggregates and timestamps; fail closed on ambiguous identity/project/secret-source/authorization.
4. List exact relevant tables/fields and existing identity lookup semantics from source, or state UNKNOWN. Do not pretend a connection is established, an environment file is already approved, or a run is ready before its prerequisites are checked.
5. No INSERT/UPDATE/DELETE/RPC/agent-chat/model/automatic retry. Do not suggest changing source to obtain a PASS. Normal page scope must not silently become privileged service-role access.
6. Produce a concise complete Worker Report with one recommended next action and concrete scope ready for review. No live attempt in this Task.

## Out of Scope
Implementing diagnostics/API, reading live learner data, new tests/deployment, old recovery credentials/authority chain.

## Acceptance Criteria
Actual prior evidence either supports explicitly limited historical facts, or exact gap plus bounded reviewable read-only proposal. No generic preparation programme or request that user recopy screenshots.

## Required Validation
Offline source/report review only; browser/API/DB/tests/build NOT_REQUIRED and forbidden. Verifier audits saved plan without live access.

## Risk Focus
Ambiguous learner identity, broad service-role reads, logging secrets, hidden mutation RPC, different statistical grain or snapshot time.

## Parallelism
No shared mutable runtime. Planning only; no concurrent GUI.

## Escalation Rule
If a live connection/credential is needed, stop actual execution; present the fully specified request to Supervisor. Do not retrieve it under planning scope.

## Worker Report
Follow CODEX_WORKER.md; facts, unknowns, concrete next operation and explicit unexecuted status.

## Verification Report
Follow CODEX_VERIFICATION.md, offline-only plan sufficiency review.


## Supervisor disposition — 2026-10-04

Offline bounded proposal review: PASS. Live execution: BLOCKED pending explicit access confirmation AND all concrete preflight requirements. Original assistant numeric accuracy remains NOT VALIDATED. No current same-grain snapshot was found in the specifically referenced handoff/acceptance evidence; this is not a claim of global artifact absence.

Worker Report: /tmp/assistant-stats-readonly-route-l0bc9hrb/WorkerReport.md
SHA256: 2bbaab9b9c405e437bf5aa8b2dde549c2af2d7810d4aeade87447acc4646413d
Verification Report: /tmp/assistant-stats-plan-verification-_lldr92h/VerificationReport.md
SHA256: 11dcab2cbf07635cb58e987faaaaf96a825cf56936eeb6c5414ac58921795519
Supervisor read both actual reports. Worker began with the preceding Task's state restoration; this plan Task records the later explicitly assigned offline design scope. Actual profiles: worker_medium / GPT-6.1 Sol medium and verifier / GPT-6.1 Sol high.

Proposed one-time operation for user confirmation: inspect only the necessary existing project server connection configuration, then only if safely bound read the unique chen001 learner's matching source records within project jubdbsjsalpecfvseskz and tenant yuanzhi. Return only learning-statistic aggregates, read time and match/limitation receipts. No raw credentials/UUID/student-row export, other-user enumeration, new API, source/Auth/RLS/schema change, model/chat/RPC/business mutation or retry. Connection details and credential contents must never be requested in chat or printed. Prior browser authorization and unrelated historical recovery approvals are not treated as a blanket service-role-data authorization.

Approval does not bypass preflight: choose and bind one existing exact-email identity lookup and one transport/config source; service-role capability is not read-only enforcement. Enforce parameterized SELECT allowlist + READ ONLY or equivalently reviewed GET-only bounded client; no auth listUsers scan. Identity mapping is derived from existing login-id source, not guessed profiles.username. Membership role is authoritative; require exactly one permitted student membership with a real active yuanzhi tenant, not a null embedded join or default/oldest fallback. Profile status policy must either match actual source or explicitly HOLD on any stricter condition.

Match actual helper projections/filter/order/limits/arithmetic, including implicit PostgREST response caps, NULL order and cutoff/tie uncertainty. No implicit unlimited-return assumption, DISTINCT/latest-per-assignment rewrite, pagination, new sorting/tie-breaker or arbitrary submission cap can masquerade as the source helper. At-cap/ambiguous ordering or read error => affected result HOLD/NOT VALIDATED, not zero or manufactured equality. Current data proves only current state, not earlier chat-time truth; source hash is not deployed parity.

No further GUI/login/screenshots are needed. No live/credential/DB/API/browser/model/test operation executed in this planning Task; source/test/config/service changes0. The only authored changes are private reports and Supervisor Task metadata.

Next minimum action: obtain confirmation for this finite source-record read and necessary connection preflight. Then prepare/review the concrete selected executor under that authority before executing once. If identity, read-only enforcement or helper equivalence cannot be established, stop and report the exact blocker without expanding scope. Do not resume old recovery/authority work or build a public diagnostic API.


## User approval received — 2026-10-04
User explicitly approved the proposed one-time read-only check including necessary connection/identity checks. Execution and preflight are governed by ASSISTANT-STATS-READONLY-CHECK-04.md; previous no-access state is historical. No repeated user approval required for that bounded operation. All technical preflight and read-only constraints remain.


## Supervisor Administrative Closeout — 2026-10-04
ARCHIVE_STATUS: CLOSED_WITH_LINKED_FOLLOWUP
SUPERVISOR REVIEW: PASS for administrative closeout only; all earlier execution verdicts and evidence bindings remain unchanged.
Original-prefix SHA256: 64a7a61f2b881f3b2f012e11fa338b2a47fbc7ec30d1ee712f82935abde16afa

本 Task 的离线方案 PASS 和历史未执行状态保留。后来单独批准的有限读取已在 ASSISTANT-STATS-READONLY-CHECK-04.md 执行并独立核对当前统计 PASS。计划 Task 不被改写为执行记录；一次读取授权已使用，无再次读取待办。

后续证据均位于本目录 completed Task04/06。当前顶部学习助手有限验收无必要剩余运行；保留所有 NOT VALIDATED 限界，不切换至单句 Explain 或历史恢复/authority 项目。
