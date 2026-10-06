# TASK — Explain target and read-method preparation

## Identity
TASK ID: EXPLAIN-TARGET-READMETHOD-PREPARATION-01
TITLE: Bind existing non-secret records to a finite first-use qualification request
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED — reuse EXPLAIN-FIRST-USE-PREPARATION-01 accepted Gate, no new design/security exemption
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: bounded multi-record method and target tracing under frozen safety/read scopes; no runtime or source changes
DISPATCH RECORD REQUIRED: YES
EXPECTED DISPATCH FORMAT: [SPAWN] task -> worker_high | GPT-6.1 Sol high | reason

## Objective
Produce ONE useful, durable Chinese preparation file with concrete existing read-method bindings or exact unavailable-method/input gaps. Move beyond the prior generic seven-category inventory. Do not repeat it as if new work. Prepare the smallest next reviewable read operation; do not execute it.

## Context
User resumed paused assistant work 2026-10-02. First task is student one-sentence Korean Explain; product/launch inventories, Gate and first-use preparation already accepted. User does not want endless review loops. Resume WorkerReport /tmp/assistant-resume-state-p3ke0KoV/WorkerReport.md SHA fc2be845bdbb382b70f3632ae5efdbd332a754543fec8bfd99b870c08d510a3b reports clean main HEAD 2c073844b6eb22ed0934dcc2b60c1a19bc526ce2; handoff SHA19494beb5fe1d5b0bebdb9c7158bed9d1d23d90aca6321c8a52d28d0df7102be unchanged; no named completed binding task found. Runtime/production qualification NOT VALIDATED, request NOT RUNNABLE. SESSION diagnostic remains paused, unrelated active SESSION tasks not owned here.

## Scope
WRITABLE SCOPE:
- docs/EXPLAIN_READONLY_QUALIFICATION_PREPARATION.md (new only; if exists stop/report)
- new /tmp/explain-target-readmethod-* directory 0700/files0600 for binding JSON, SourceHashes and WorkerReport
Verifier writes only new /tmp/explain-target-readmethod-verify-*.
Supervisor owns this Task metadata. No worker .codex modification.
READABLE DEPENDENCIES:
- AGENTS.md/CODEX_WORKER.md/CODEX_VERIFICATION.md, this Task, docs/ASSISTANT_AGENT_HANDOFF.md
- completed EXPLAIN-FIRST-USE-PREPARATION-01 and ASSISTANT-AGENT-HANDOFF-01
- accepted /tmp/explain-first-use-gate-B1QE9dvY/GateReport.md and SourceHashes.txt
- accepted /tmp/explain-first-use-preparation-mf7u65_t/ReadOnlyQualificationRequest.md, LaunchGapMatrix.json, SourceHashes.txt
- /tmp/explain-first-use-verify-rqmw8p6x/VerificationReport.md, resume WorkerReport above
- docs/teaching-agent-stage-1f-r3-production-operations-gate.md, docs/teaching-agent-stage-1f-r7d-a-lesson-tool-durable-facts-audit.md, docs/teaching-agent-stage-1f-r7d-c-skill-tool-binding-audit.md: only decisive deployment/compatibility/reader locators
- scripts/teaching-agent-r3/operator-monitor.sql, operator-active-runs.sql, operator-run-lookup.sql as text
- finite directly linked non-secret runbooks/release summaries/source reader files if needed to resolve a specific binding. Log why each added read is needed; no broad archive/source audit. Metadata such as opaque tenant/course or historical worker paths may be captured privately; do not expose real student identity.
FORBIDDEN: modifications to existing source/tests/fixtures/README/handoff/history/approval/authority/completion/lock/AGENTS/CODEX/.codex; env/credential/private approval/raw customer content reads; sensitive approval-b2-provisioning.before-initial-ban-workflow.json; any DB/SQL execution/Docker/network/Provider/Agent/browser/server/process/service inspection/tests/build/import runtime/production/purchases/deploy/new diagnostic/git mutation. Preserve concurrent changes. No hidden permission expansion because user said continue.

## Contracts
PUBLIC CONTRACTS: unchanged. MAY CHANGE PUBLIC CONTRACT: NO.
Reuse accepted Gate: historical approved Explain release may only be a candidate, C3A/C3B NO-GO and applicable practice-binding ACL gate remain, SESSION deferral conditional. First Enable/ON/Provider/Agent Run separate permissions. Explain writes Run/usage/trace and sends approved data. Seven current categories stay NOT VALIDATED until actual valid observation.

## Data / Security Impact
DATABASE IMPACT: NONE (SQL text review only). RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: LOW for current preparation; future sensitive reads need exact authorization.

## Requirements
1. Read existing packet, reuse frozen seven categories and accepted boundaries. Verify immediate input hashes; don't revalidate old test packs or enumerate entire history. Report stale references as stale, not freshly valid.
2. For each a-g derive a concrete entry from existing repository records if possible. Record target/worker candidate, source/date/hash/line, read object/necessity, exact entry and parameters, output fields, filter, maximum results, operator/window/auth-ref status. Values unknown remain null/HOLD. Distinguish recorded contract limits from proposed limits; do not invent a source-supported cap.
3. Existing SQL limitation is already known: monitor is tenant/timewindow aggregate; active runs reveals IDs and lacks course/lesson/count-only/cap; lookup unnecessary; C3B capture writes authority/receipts. Do not spend another round only rediscovering these. Find a directly relevant existing method or state exact absence within finite search. Never claim exhaustive absence.
4. If a candidate existing entry overreads, don't call it suitable by proposing after-the-fact output filtering. Read must itself satisfy scope. No new shell/Python/SQL program, runtime import or operational tool in this task. Command text using existing suitable entry may be documented but not executed. Mark non-runnable placeholders explicitly; never label them ready for actual approval.
5. Choose the smallest useful NEXT operation from actual findings, not another broad inventory: if exact existing safe read can be prepared, list its actual command/target/projection and explicit approval boundary. If it cannot, deliver a precise blocker table distinguishing missing factual target, missing eligible reader, missing approval/window, and necessary separately-scoped implementation/design. Do not invent a permanent infrastructure exception. Don't make user manufacture technical binding or dump credentials.
6. Document one finite sequence and stop conditions, preserving all seven gates. No new endless branching review programme. If blocked by unavailable current metadata, explain exactly what authorized operator would provide or inspect, with non-secret scope and minimum fields. Do not claim seven launch facts verified.
7. Persist essential results in the new Markdown so /tmp loss cannot erase handoff. Include original evidence hashes and link existing handoff rather than rewrite it. Clearly state actual per-task progress, what remains and no production/Agent execution. No speculative code fix without evidence.

## Out of Scope
Live qualification, creating queries/tools, source changes, enabling/stopping service, real student/provider request, resuming maintenance probes, changing approvals.

## Acceptance Criteria
One concrete binding or blocker row per a-g with exact source citations, no duplicated generic inventory, no fabricated current facts, a single actionable next step or exact external dependency. Static checks of own output consistency, links/hashes and scope. If runnable binding impossible, report BLOCKED for execution while marking only the completed preparatory work; no false PASS.

## Required Validation
Static read/document/JSON/hash checks only. TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED. No business tests. Independent reviewer audits new packet against frozen accepted Gate and only key method references, not old full history.

## Risk Focus
Confusing historical target with current serving; requiring vague unnecessary approvals; overreading before filtering; newly invented reader hidden in documentation; accidentally running service/SQL; exposing secrets; repeating completed work.

## Parallelism
CAN RUN IN PARALLEL: NO — worker then verifier, dependent. WORKTREE: OPTIONAL. Disjoint from all active SESSION tasks, no shared mutable runtime resources.

## Escalation Rule
If a new reader/source/public/security contract must change, stop implementation and give exact scope/necessity to Supervisor. If evidence drift prevents frozen boundary interpretation, report UNDETERMINED. Runtime remains unauthorized until concrete request and approval.

## Worker Report
Full CODEX_WORKER report with exact new paths/SHA, input bindings, concrete new findings, independent gaps, commands/rc, checks, counters and minimum next step. Send concise progress within a few minutes; do not run open-ended research.

## Verification Report
Full CODEX_VERIFICATION format; finite method/citation and permission review. No writes to worker output; no runtime. PASS applies only to accurately scoped preparation.

## Supervisor Final Review — 2026-10-02
RESULT: PASS for finite preparation deliverable; actual qualification execution BLOCKED / NOT RUNNABLE. Seven a-g current facts remain NOT VALIDATED.

Resume-state report /tmp/assistant-resume-state-p3ke0KoV/WorkerReport.md SHA fc2be845bdbb382b70f3632ae5efdbd332a754543fec8bfd99b870c08d510a3b accepted for finite state recovery only. Its interpretation that newest commit metadata was unrelated is superseded by the directly read 10/02 deployment context below; clean tree/handoff hash facts remain supported.

Delivered docs/EXPLAIN_READONLY_QUALIFICATION_PREPARATION.md
SHA256 da26b46a7a361fa43460a364e834a3f1aaf40d4200621fa4190288b4c03d5239
Original WorkerReport /tmp/explain-target-readmethod-y4jo57zg/WorkerReport.md
SHA256 2965f8aa6124316de3d5f1379c3eafcae8b25ed8d6153559acb51e781268704b
WorkerReportRevision /tmp/explain-target-readmethod-y4jo57zg/WorkerReportRevision.md
SHA256 6311657868b2153be1f077787875246b7a81caca216b80cbf2c9c2dcd447c5f8
VerificationReport /tmp/explain-target-readmethod-verify-4l6o42j6/VerificationReport.md
SHA256 b46a4d1653b32550fa9609cd939352eb2e6d0eb37a54114055b9cc028d29b678

Supervisor sampled doc/reports and latest git log, directly found docs/HANDOFF-subject-modules-2026-10-01.md L6-20 material context and returned only that bounded omission to Worker. Worker preserved original private reports and produced revised doc plus Revision artifacts. Independent verifier accepted actual final doc and decisive existing-reader sources; no history/runtime rerun.

New context: 10/02 subject-module merge and Vercel/Cloudflare build attempts; old pushes failed per handoff, latest result/actual public serving target unverified. Source lock differences reported by other work remain historical report observations, not fresh measurements or permission to rewrite locks. No automatic seal/authority update.

Concrete findings: historical deployment identity/course candidates exist, but current target and eligible Student/published scope unbound. Existing artifact generator has writes/runtime import, full-course query exceeds target, business Student reader exposes full content; none is a ready metadata-only qualification reader. Missing factual target, eligible method and authority/window are separate dependencies. A conditional future single-file release identity reader is only a proposal, not implemented or approved.

Next minimum action: await user's ordinary platform URL (asked once via async question, no answer at archival); use it as target locator with existing non-secret deployment records. Supervisor/authorized agent handles technical binding; no user-manufactured technical packet and no presumed external operator. No actual network/production/Agent operation authorized by a URL answer. If current record/eligible reader absent, report exact gap and separately scope necessary work; do not loop through generic inventories.

Writes: only new preparation doc, private reports and Supervisor task metadata. Existing source/tests/fixtures/handoff/history/authority/locks unchanged by this task; no full shared-repository immutability claim. No runtime tests, DB/SQL, Docker, builds, credentials, production, Provider, Agent, purchases, commits or pushes. New user clarification required before dependent target selection; old SESSION diagnostic remains paused.
