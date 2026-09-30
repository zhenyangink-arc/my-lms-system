# TASK — Session attempt4 failure review

## Identity
TASK ID: SESSION-ATTEMPT4-FAILURE-REVIEW-01
TITLE: Read-only causal review of seven session-focused non-PASS methods
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED (forensics only; no changed contract)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
MODEL ROUTING REASON: Bounded multi-file test/fixture trace and saved failure evidence.
DISPATCH RECORD REQUIRED: YES

## Objective
Determine what seven non-PASS methods establish, distinguish shared prerequisites from independent causes, and specify the smallest evidence-backed next task. No implementation or rerun.

## Context
Attempt4 completed once: 915 executions, 613 unique IDs, 908 PASS / 4 FAIL / 3 ERROR. First eight phases: 885 PASS. Session focused: 23 PASS / 4 FAIL / 3 ERROR. First safe code OWNED_DOCKER_OPERATION_FAILED. Formal validation remains FAIL_NOT_QUALIFIED.

## Scope
WRITABLE SCOPE:
- New private /tmp/session-attempt4-failure-review-* directory for static collectors/reports.
- docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-attempt-4-failure-review.json (exclusive-create only; sanitized).
READABLE DEPENDENCIES:
- CODEX_WORKER.md, CODEX_VERIFICATION.md, this task.
- Bound audit/reports, referenced private driver/artifacts and necessary related source/tests/contracts/history.
FORBIDDEN:
- Source, tests, fixtures, README, historical evidence, authority, completion, lock, native products, credentials, .env, AGENTS.md, CODEX_*.md and .codex/** changes (Supervisor owns task).
- Docker commands including inspect; DB/SQL/network/tests/build/install/experiments/retries/container cleanup; git staging/commit/push.
- Sensitive file docs/evidence/teaching-agent-stage-1f-r7c-b/approval-b2-provisioning.before-initial-ban-workflow.json must not be read/output/staged.

## Contracts
PUBLIC CONTRACTS: All current contracts, policies, error behavior and budgets unchanged.
MAY CHANGE PUBLIC CONTRACT: NO.
DATABASE IMPACT: NONE. RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: LOW; protect private evidence.

## Requirements
1. Bind audit docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-fresh-validation-failure-attempt-4.json: SHA 84ef9c97975d676fdd56937b1baea877d55b42872c077f1263650c8678774e76, 8818222 bytes.
2. Bind /tmp/session-validation-attempt4-execution-2bjmqp2k/WorkerReport.json: SHA 12e78102d7e61d29f68a74c2780980e321f11c454f0df8761a5562a403730b87; /tmp/session-attempt4-independent-verify-yub6i0s6/VerificationReport.json: SHA 67160be1f70c0476e254ba4b028809c5cbb7c30fadb0767f4c3f1d2dc1cdc778. Do not revalidate 915 tests.
3. Cover all seven ProvenanceAcquisitionSessionContract methods SESSION_001/002/003/007/008/016/025 and all twelve events: 4 FAILURE,5 SUBTEST_FAILURE,3 ERROR. Subtests are not independent methods.
4. Recover assertions, first failures, call sites, operation/phase and gate reachability only when observable. Separate proven causes, inferences and UNRESOLVED. Map shared prerequisites and independent causes.
5. Read relevant current helper/argv code and compare hashes to saved execution inputs. Source drift forbids treating current as executed code. No private raw environment or credential disclosure.
6. Determine if actual Docker stderr/rc/argv is preserved; inspect saved diagnostics first. If absent specify missing evidence; do not invent daemon or product cause. No new runtime.
7. Passed related checks and attempt3 observer error are contextual only. Do not reopen passed work or claim the old observer cause solved.
8. Propose separate minimal fix or missing-evidence diagnostic scopes, exact files/responsibilities/validation and budgets. Proposals only. No observed cause means no unsupported fix proposal.
9. User-retained old container 0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89 remains untouched/unqueried. All runtime counters zero. Preserve finite inventoried source/package/history inputs.
10. Evidence publication exclusive-create 0600, fsync file and parent, same inode/device and exact readback/raw SHA. Existing output path means STOP. Include durability receipt and evidence size/SHA in Worker Report.

## Out of Scope
Fixes, test reruns, production, Agent Run, authority successor, completion/lock/qualification, ownership cleanup, runtime investigation.

## Acceptance Criteria
All seven methods/twelve events covered with actual artifact/line/hash references. Evidence-backed causal map, explicit uncertainty and minimal next action. No source/test/runtime changes. Complete report and review evidence.

## Required Validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION: NOT_REQUIRED. Test execution prohibited.
Only static JSON/hash/source analysis; finite before/after input hashes. Do not claim entire repo unchanged.

## Risk Focus
Fixture vs product cause; absent stderr; uncertain gate reachability; secret exposure; unrelated container; accidental retry.

## Parallelism
CAN RUN IN PARALLEL: NO. Worker then independent verifier. Source-read-only, no worktree required.

## Escalation Rule
Runtime/scope/contract changes require SCOPE_CHANGE_REQUEST, not execution. Model escalation only for a specific reasoning need.

## Worker Report
Read CODEX_WORKER.md and submit full format, actual selected profile/model/effort or UNKNOWN, commands/checks/counters/findings/limitations.

## Verification Report
Read CODEX_VERIFICATION.md, independently inspect saved evidence and causal claims; no tests/Docker. Review PASS does not mean formal validation PASS.


## Revision R1 — independent verifier proposal finding
SUPERVISOR REVIEW: REVISE (causal evidence accepted; next-action scope not closed).
Verification report: /tmp/session-attempt4-review-verify-sr_p5n_g/VerificationReport.md
SHA256: ce2147c300aa401c6948f8cc57df6d912e7f599930a6cbd6b3c7415e7125d5e1.
Existing immutable review SHA: 94e33b1ba4610f999be409a38150fbeacedbf9cc1a69ef795d2e46f72844d820.
Finding: SESSION_003 fake production endpoint also fails validate_session_host; replacing target hashes alone cannot reach original positive argv assertions. Correct schema rejection is not proof of those assertions. No forged identity or production guard bypass permitted.
Additional Writable Scope (review-only):
- docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-attempt-4-failure-review-addendum-1.json (exclusive-create, same privacy and durability requirements).
R1 requirements:
1. Preserve old review bytes. Addendum supersedes only incomplete future-fix recommendation, not raw outcomes/causal evidence.
2. Separate SESSION_003 from SESSION_025 where fix preconditions differ. Specify which future corrections are statically ready and which positive assertions are NOT_VALIDATED/pending design or approved exact bound synthetic data.
3. Never claim changing fake hash constants alone fixes SESSION_003; never propose production gate relaxation, forged production binding, or unapproved private credential access.
4. If cannot close positive production argv test within known authorized data, explicitly defer that part. Review may complete with a precise blocker; no fabricated completeness.
5. Seed RPC exact cause remains UNRESOLVED. Design only the smallest extra diagnostic evidence required; no runtime.
6. Submit R1 Worker Report and append-only evidence links/hashes, with original finding disposition and remaining limitations. No other Task scope changes.


## Supervisor Final Review
REVIEW RESULT: PASS (read-only review evidence; formal validation remains FAIL_NOT_QUALIFIED).
Worker profile: worker_high, selected GPT-6 Sol high. Verifier profile: verifier, selected GPT-6 Sol high.
Evidence: original review SHA 94e33b1ba4610f999be409a38150fbeacedbf9cc1a69ef795d2e46f72844d820; R1 addendum SHA f7ba6cf94d822014f83e312911e310a87bf59fb9e5e41d48138aca2c4bf59840.
Final independent verification: /tmp/session-attempt4-review-verify-r1-q983zuny/VerificationReport-R1.md, SHA 32c58cc3a77ffe0102c44cf7f353de32e5b6ef2bb5c5c730646dc25690845ecd.
Seven methods / twelve non-PASS events are covered. Four causal groups include an unresolved seed RPC setup failure, frozen target identity test-input errors, a misplaced TLS assertion, and a wrong bootstrap field lookup.
SESSION_003 original positive production argv assertion remains NOT_VALIDATED / PENDING; SESSION_025 policy testing does not establish production identity coverage. SESSION_008/016 correction directions are design-only. No production gate change proposed.
Remaining work: bounded seed diagnostic design/authorization and test-only correction/design scopes. No fix or runtime attempt executed by this task. User-retained container untouched. No qualification, completion, lock or authority published.
