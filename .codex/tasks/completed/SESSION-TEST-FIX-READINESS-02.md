# TASK — Existing test design readiness and bindings
## Identity
TASK ID: SESSION-TEST-FIX-READINESS-02
TITLE: Resolve exact test-only implementation subset and remaining identity prerequisite
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_medium (GPT-6 Sol medium)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED; no security contract redesign allowed.
MODEL ROUTING REASON: Reuse already verified design, map exact small edits and binding impact; no fresh causal investigation.
DISPATCH RECORD REQUIRED: YES
## Objective
Prepare exact implementation scope from verified SESSION003/008/016/025 design, documenting unresolved003 production-positive prerequisite without weakening its assertion or faking authority. Determine test changes' receipt/validation impact without editing receipts.
## Requirements
1. Read verified design/assertionmap and its verifier; don't redo closed analysis. Current relevant source/tests must still match its source bindings. Report drift if any.
2. Identify exact ready subset (008 observation validator assertion,016 bootstrap value,025 policy-only context,003 local assertion relocation where valid) while keeping all existing30methodIDs and obligations. No skip/xfail/catchpass, no removing positive assertions to make green.
3. For003 missing positive production raw identity: inventory only already-authorized non-secret explicit project/endpoint identities in readable repository documents/artifacts. Don't open env/credentials, reverse hashes, guess endpoints, broaden production schema or bypassvalidate_session_host. User previously explicitly provided project name my-lms-system and projectId jubdbsjsalpecfvseskz; this is allowed plaintext context, but no endpoint may be guessed. If no complete matching non-secret binding exists, retain precise pending. Do not demand secret credentials for a pure argv test unless source truly requires them.
4. If safe local/pure substitution would change original production scope, explicitly state separate-design need; don't quietly adopt it. Bound scan to direct referenced artifacts, not entire historic repo.
5. Determine current I/B validationContextHashes/fileChanges relationship, exact test hash changes, operational package membership effect and forward-only handling. No existing receipt overwrite/update authority. Explain whether test-only edits can proceed with qualification pending, and what future receipts must bind them; do not invent a sealed package.
6. Deliver exact candidateFutureModifyPaths/add/delete and assertionmap references, dependency on parallel vault input contract, minimal validation set after implementation (pure versus runtime), and per-methodready/pending state. No tests or edits now.
## Writable Scope
New private /tmp/session-test-fix-readiness-* only.
## Out of Scope
Vault key format research (parallel worker), production access, code edits, authority/receipt rewriting, test execution.
## Acceptance Criteria
Clear finite test-only scope and honest remaining identity prerequisite; no safety coverage loss; binding effects concrete. Reuses verified work, no runtime or broad rescanning.

## Shared Context
User requested continuation into bounded fixes after one actual local diagnostic. Runtime result: seed encryption received44UTF8 bytes strictly base64-decodable32, error Unknown cipher or invalid key size; unique runtime finished, all2containers+1network removed. No historical8event exact cause assertion. Do not rerun diagnostic.
Bind public result docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-seed-diagnostic-attempt-2-result.json SHA f7cb48f60bae08252ecb2fa349f189ce686a950ec31ed3b5d5d3a8e874b4d1cc.
Worker /tmp/session-seed-diagnostic-run02-3rhd11y4/WorkerReport.md SHA18b41cf907a1ceacf4dd88b9358caf385696a39b482b388438db7cbbb25a294b; verifier /tmp/session-seed-diagnostic-run02-verify-ntx63b_r/VerificationReport.md SHA1b39e918cb9c7854cb9c48d857a82b7b3f5fbe831ef7092cd99411f48afe7ae1.
Existing test design /tmp/session-test-correction-design-r1-_b0_4dl0/Design.md SHAfb714014a566b7f676a6c7f11863546a840260480eb43ef43a6d70c476b165ec; AssertionMap.json SHA2b51037d6942f5e47791ac4ff29d1ba1027f26522ad2849b8a32df4c8c106182; independent /tmp/session-test-design-r1-independent-verify-4xu772zc/VerificationReport-R1.md SHA8738d6e58c56d9c626e62db86d03640d88e67e7fc09cd815ba2c0e1f9094a28e.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. Production identity/TLS/resource contracts and all test IDs/security assertions preserved. No fake-valid production context, no weakening validation gates, no secret disclosure.
DATABASE IMPACT: NONE. RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: MEDIUM, read-only review of test identity/encryption boundaries.

## Scope
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, CODEX_VERIFICATION.md; named evidence/design and needed current source/tests/build manifests/version documents. Source reads bound to actual hashes.
FORBIDDEN: source/test/fixture edits at this review stage; old evidence/approval/I/B/authority/completion/lock changes; .env/production credentials or connections; Docker including inspect; cluster/SQL/runtime/test/fixture execution; builds/downloaded images/purchases; git commit/push; AGENTS/CODEX/.codex writes (Supervisor owns task); old user-retained container query or deletion; sensitive approval-b2-provisioning.before-initial-ban-workflow.json reads.

## Required Validation
Static/source/hash review only. No suites, fixture imports or runtime. Don't repeat915test validation or prior forensic proof. Any exact evidence unavailable must remain NOT_VALIDATED.

## Parallelism
CAN RUN IN PARALLEL: YES with the other read-only readiness task; disjoint private output directories and no repository mutations.

## Escalation Rule
Any needed production credentials/runtime/source change or public contract relaxation means stop and state exact blocker. No permission inferred for extra experiments. New architectural/security strategy requires independent Gate, not an improvised test fix.

## Worker Report
Read CODEX_WORKER.md. Complete report with selected/actual visibility, inputs/citations, exact proposed path/method/line responsibilities, behavior/assertion preservation, validation set, risks, counters, output SHA and readiness. Keep conclusions concise and source-grounded.

## Verification Report
Read CODEX_VERIFICATION.md. Review packet against frozen contracts, no runtime; PASS design evidence only.

## Supervisor Closure
DECISION: PASS for read-only bounded design/readiness only; runtime and qualification NOT VALIDATED.
Report: /tmp/session-test-fix-readiness-s2yk1zw0/WorkerReport.md
Report SHA256: f3492162e1c17c2b3a01ecd53a6ff4b2d626b48df0ce277a4b92731761409e97
Independent verification: /tmp/session-bounded-fix-design-verify-ygw3kxnh/VerificationReport.md SHA f02623c65effdbbf54658f56dfcf135953ccc7d50a833475b8a0f71eae472d4d.
Missing003 exactSESSIONhost/user retained; fullruntime remains separate. Implementation begins under SESSION-BOUNDED-TEST-FIX-01. No oldI/B rewrite permission.
