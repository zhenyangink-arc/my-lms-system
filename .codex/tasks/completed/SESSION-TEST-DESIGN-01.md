# TASK — Test correction design closure
## Identity
TASK ID: SESSION-TEST-DESIGN-01
TITLE: Close bounded test-only design for SESSION_003/008/016/025
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED if all proposals preserve operational/public security contracts; otherwise escalate.
MODEL ROUTING REASON: Need to preserve exact production identity and TLS assertions while correcting test inputs and observation layer.
DISPATCH RECORD REQUIRED: YES
## Objective
Produce exact test-only correction design without implementation. Resolve SESSION_003 positive argv coverage honestly or specify smallest remaining decision; avoid repeating closed causal analysis.
## Requirements
1. Reuse read-only review/addendum and independent findings. Bind relevant test/implementation hashes.
2. SESSION_003: frozen target hashes alone cannot make fake endpoint valid. Identify contract-preserving input strategy using already authorized non-secret synthetic/local data only, or separate negative fake-identity assertion from explicitly deferred production-positive coverage. Do not forge target validity or weaken validate_session_host. Do not read env/private production credentials. Public endpoint identity may be referenced only if already bound/available in authorized artifacts; do not guess or reverse hash.
3. Keep original security assertions (argv/conn/environment override rejection) and identify exact portions that can be tested without production credentials or network. Explicitly map old assertions to proposed replacements and NOT_VALIDATED gaps. Unit mock only if existing test contract permits and it does not impersonate end-to-end identity validation; document limits.
4. SESSION_025: distinguish target-independent image_preflight memory policy from target/endpoint identity. Design a bounded policy-only context without inventing authenticated production context.
5. SESSION_008: choose actual responsible pure/observation TLS gate, show negative assertion reaches it and fails expected exact code; keep fixture integration branches unchanged and blocked pending seed diagnostic.
6. SESSION_016: correct bootstrap/SQL_ASCII assertion source while preserving full intent; no unsupported recovery input widening.
7. For every recommendation list exact file/method, minimal behavior change, assertions preserved, proposed focused validation set, package/receipt binding impact and any missing prerequisite. No test execution/code edits now.
8. Produce readiness per correction. If complete compatible design cannot be shown, mark pending; do not manufacture a all-ready conclusion.
## Acceptance Criteria
Exact test-only design and coverage map; no gate weakening or fake identity claims; no runtime/source mutation; honestly bounded remaining blockers.
## Writable Scope
- new private /tmp/session-test-correction-design-* only; no repo output.
## Out of Scope
Seed diagnostic implementation/execution, product source changes, identity schema/contract changes, real production inputs or network.
## Parallelism
CAN RUN IN PARALLEL: YES with SESSION-SEED-DIAGNOSTIC-PREP-01. Read-only dependencies, disjoint private outputs.

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
RESULT: PASS (design completeness, not implementation or runtime validation).
Final packet: /tmp/session-test-correction-design-r1-_b0_4dl0.
WorkerReport-R1.md SHA256 6a9093e5f5019a7de44fae541c5a6a54cd1df1fcf3c9068f1f03f4010e4e3f69.
Design.md SHA256 fb714014a566b7f676a6c7f11863546a840260480eb43ef43a6d70c476b165ec.
AssertionMap.json SHA256 2b51037d6942f5e47791ac4ff29d1ba1027f26522ad2849b8a32df4c8c106182.
VerificationReport-R1.md: /tmp/session-test-design-r1-independent-verify-4xu772zc/VerificationReport-R1.md, SHA256 8738d6e58c56d9c626e62db86d03640d88e67e7fc09cd815ba2c0e1f9094a28e.
Single initial finding was exact method line range extending into SESSION_004; fixed to 1814-1828, producer_env 1823-1828. No other blocking findings.
All 30 test method IDs and original coverage obligations preserved. SESSION_003 production-positive argv remains PENDING/NOT_VALIDATED; SESSION_008 owned integration remains BLOCKED_SEED. Other ready subset is proposal only, no source/test changes or runtime executed. Formal qualification remains FAIL_NOT_QUALIFIED.
