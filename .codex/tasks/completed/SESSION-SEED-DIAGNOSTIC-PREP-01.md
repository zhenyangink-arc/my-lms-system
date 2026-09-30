# TASK — Seed diagnostic preparation
## Identity
TASK ID: SESSION-SEED-DIAGNOSTIC-PREP-01
TITLE: Prepare one concrete bounded seed initialization diagnostic
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED provided no security/operational contract changes.
MODEL ROUTING REASON: Existing fixture control flow and safe exception evidence collection; no architecture redesign.
DISPATCH RECORD REQUIRED: YES
## Objective
Prepare, but DO NOT RUN, a source-bound private diagnostic script and approval packet that captures the previously missing Docker operation rc/stderr/argv evidence for one exact fixture initialization. Reuse prior review proposal. Do not re-investigate all failed tests.
## Requirements
1. Bind frozen review/addendum and current fixture/source inputs. Explain the precise missing evidence.
2. Use exact existing OwnedSessionSource initialization, original args and artifact build; no research/replacement executor. Single fresh fixture lifecycle only, zero retry, no suites/export/capture/restore/SQL replay after planned initialization. Stop naturally on error; no suppress/rewrite exception.
3. Observer design must only record original call/return/exception data without changing argv, process inputs, result, gate ordering or timeouts. Prefer narrowly-scoped read-only frame observation; prove no mutation of operational functions or source. Root-cause claim remains unresolved until actual run.
4. Freeze exact planned command, file SHA pins, fixed cached image IDs, dependencies, memory/network/port/mount resource constraints and limits inherited from source. Determine smallest actual container/network budget from code, do not invent limits that break fixture. Execution and cleanup deadlines explicit. No pull, no production credentials/hosts, no existing-container cleanup.
5. Collect failed seed Code.eval_file operation returncode plus original stderr/stdout/argv only into private 0600 synthetic-only evidence. Define bounded redacted safe public fields; do not emit secret env or logs. Any unexpected sensitive content must not enter public output.
6. Ownership-safe cleanup: only resources whose creation is directly proved by this run. Preserve existing user container and unrelated resources. Define behavior if failure before registration/ownership proof, and ensure uncertain resources are not deleted. If exact safe runnable packet cannot be closed, stop at concrete design blocker instead of unsafe script.
7. Create private files exclusively, bind source/hash before execution in script; require explicit run action, no import-time Docker. Validate syntax/AST/static contracts only; do not execute real diagnostic.
8. Output a single ready-for-approval packet with objective, exact command, all effects/budgets, cleanup, success/failure evidence requirements and remaining uncertainties. Do not claim runtime PASS.
## Acceptance Criteria
Concrete reviewable next diagnostic, no execution; safe evidence capture preserves original failure; frozen budgets/ownership/privacy; dependency binding and complete report.
## Writable Scope
- new private /tmp/session-seed-diagnostic-prep-* only; no repo output.
## Out of Scope
Any test fix or SESSION_003 identity redesign. No runtime.
## Parallelism
CAN RUN IN PARALLEL: YES with SESSION-TEST-DESIGN-01. Read-only common dependencies, disjoint private outputs.

## Context
Read-only attempt4 review is complete. Formal validation remains FAIL_NOT_QUALIFIED. Prior 915 tests must not be rerun. Preserve user-retained container 0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89 without querying or deleting it.
Bindings:
- docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-attempt-4-failure-review.json SHA 94e33b1ba4610f999be409a38150fbeacedbf9cc1a69ef795d2e46f72844d820.
- docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-attempt-4-failure-review-addendum-1.json SHA f7ba6cf94d822014f83e312911e310a87bf59fb9e5e41d48138aca2c4bf59840.
- Final verifier /tmp/session-attempt4-review-verify-r1-q983zuny/VerificationReport-R1.md SHA 32c58cc3a77ffe0102c44cf7f353de32e5b6ef2bb5c5c730646dc25690845ecd.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. Preserve identity, TLS, pooler, source and test contracts. No mocked production binding or security gate bypass proposed as validation.

## Data / Security Impact
DATABASE IMPACT: NONE. RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: MEDIUM (diagnostic privacy/identity test design; no runtime).

## Scope
READABLE DEPENDENCIES: above saved evidence, necessary frozen source/test/contracts and prior private diagnostic packet referenced therein. Only necessary dependency source hashes should be rebound.
FORBIDDEN: source/test/fixture/README changes; AGENTS.md/CODEX_*.md/.codex changes (Supervisor owns tasks); any historical evidence overwrite; .env/credential files; docs/evidence/teaching-agent-stage-1f-r7c-b/approval-b2-provisioning.before-initial-ban-workflow.json; Docker including inspect; DB/SQL/network; repository tests; production; builds/downloads; cleanup; git stage/commit/push.

## Required Validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED. No repository suite/test execution. Static AST/syntax/read-only hashes permitted; any private pure sanity is explicitly preparation-only and cannot run subprocess/Docker/DB/network. No arbitrary import with startup side effects.

## Risk Focus
Changing application behavior through instrumentation; escaping narrow failure scope; missing stderr; secrets; falsely claiming production identity coverage; accidental execution/retry.

## Escalation Rule
Runtime requires separate approval after concrete packet and independent review. If existing data cannot close design, state exact blocker; do not invent identity or broaden gates. Contract/security architecture changes require separate Gate, not this task.

## Worker Report
Read CODEX_WORKER.md. Complete report with selected/actual model evidence, exact scope, checks, files/hashes, uncertainties, operation counters and next minimum task. No runtime validation claim.

## Verification Report
Read CODEX_VERIFICATION.md. Independently inspect completed packet and source-bound claims only; no runtime. Report PASS/REVISE with exact findings.

## Supervisor Final Review
RESULT: PASS (preparation only). Runtime not authorized or executed.
Final packet directory: /tmp/session-seed-diagnostic-prep-r1-_r6zpmbw.
ApprovalPacket.json SHA256 f7690c1eb1445c58dbf395ab115ba95c84e71876d6cf312cce3fb6f545e59465.
diagnose_seed_once.py SHA256 8a6cc137021a1a206fece95fd3dbef9fb1bf39678f4cef775d6482c934d28f99.
WorkerReport-R1.md SHA256 07afff6893168cea589f0ae800262063a8fbcfdf91922b2c27d8c59bfa425122.
VerificationReport-R1.md: /tmp/session-seed-diagnostic-verify-r1-cp0jot_z/VerificationReport-R1.md, SHA256 4b10b6c7aabfcce530d114fbc8c4233caaffce6866d3b32faa35ac73a68214a0.
Independent result PASS_PREPARATION_R1; child one-use guard F1 and atomic marker/parent abort cleanup F2 CLOSED_STATIC_PREPARATION. 32 static checks and 16 pure stub checks; no real process/fixture/Docker/DB/network/signal/test operations.
Prepared scope: original one OwnedSessionSource initialization, at most 2 fresh synthetic service containers / 1 internal network, cached pinned images, zero pulls/retries/production. PG 1GiB and pooler 2GiB, no host ports or mounts. Init deadline 3300s, cleanup 360s, kill/reap 10s maximum. Preserve user-retained old container.
Fixed env is declared synthetic diagnostic boundary; historical ambient reproduction NOT_VALIDATED. Seed root cause remains UNRESOLVED and formal qualification FAIL_NOT_QUALIFIED. Exact command and SHA in packet require separate explicit runtime approval.
