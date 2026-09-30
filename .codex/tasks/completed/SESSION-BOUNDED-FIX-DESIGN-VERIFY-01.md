# TASK — Bounded fixture/test fix design verification
## Identity
TASK ID: SESSION-BOUNDED-FIX-DESIGN-VERIFY-01
STATUS: COMPLETED
## Routing
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED for disposable test input/test assertion correction only; no production/security contract alteration.
DISPATCH RECORD REQUIRED: YES
## Objective
Independently verify the two completed read-only packets as a single finite test-only implementation scope. Reuse prior closed diagnostic and assertion-map verification; do not re-run them.
## Context and Inputs
Vault Task .codex/tasks/active/SESSION-VAULT-INPUT-CONTRACT-01.md
Vault WorkerReport /tmp/session-vault-input-contract-4nwui58c/WorkerReport.md SHA ec02709296e0955ea3d7c71774c4f709893b1ea0162b0ff2d2999bb510474c9c
Vault Proposed.diff SHA 4b90d9903038876eb2a7ea97f8638d2ef712f9bdf1deaa5b8d3c083d3d717399
Readiness Task .codex/tasks/active/SESSION-TEST-FIX-READINESS-02.md
Readiness WorkerReport /tmp/session-test-fix-readiness-s2yk1zw0/WorkerReport.md SHA f3492162e1c17c2b3a01ecd53a6ff4b2d626b48df0ce277a4b92731761409e97
Readiness.json SHA 0a1ae5b1ae1a772b1ace309898cb9170ec66b78fa8bd94ecf8cf961efab64bf0
Reuse /tmp/session-test-correction-design-r1-_b0_4dl0/Design.md and AssertionMap.json with earlier independent R1 verification.
## Scope
WRITABLE: new private /tmp/session-bounded-fix-design-verify-* only.
READABLE: AGENTS, CODEX_VERIFICATION, tasks, reports, source caches, current named test/source/evidence needed for key claims.
FORBIDDEN: repo edits; .env/credentials; production; Docker including inspect; SQL; tests/fixture imports; image extraction/download/build; runtime; historical evidence/I/B/authority/lock/completion mutations; git mutation; old retained container query; sensitive approval-b2-provisioning.before-initial-ban-workflow.json.
## Contract / Security
No public contract changes. Test-only new key 24 CSPRNG bytes -> 32 raw ASCII Base64 bytes for AES input, 192-bit entropy explicitly acceptable for disposable synthetic-only fixture. Not claiming 256-bit entropy or decoding in runtime. Do not expand into crypto architecture change.
## Acceptance
1. Match report inputs and actual narrow source/diff; fixed official release source raw-key contract and actual RUN02 boundary support minimal proposed key change, with exact image build/config limitation explicit.
2. One existing test file future scope; frozen30 method IDs and14 assertion obligations retained; no guard mocks/schema relaxations, vendor assumptions, skip/xfail/removal.
3. 003 production-positive input remains PENDING until user supplies exact approved nonsecret Host/User. User clarified yangzhen may be OS account; this is NOT new database identity. Other bounded work may proceed without claiming003wholePASS.
4. 008/016/025 responsibilities match verified earlier map; not rerun complete investigation.
5. Source17/main10 unchanged by test-only scope; I/B bind test in validationContextHashes/fileChanges. No old receipt overwrite authorized; qualification remains pending.
6. Return PASS/FAIL/UNDETERMINED for design only with exact issues and implementation-ready subset. No runtime or recovery PASS.
## Required Validation
Static read/hash/diff/AST only. Cached primary-source texts may be verified read-only. No fresh test execution, no fixture imports. Do not redo915tests or diagnostic.
## Parallelism
Read-only; no competing source writers yet.
## Escalation
If proposal drops coverage, requires public contract change or fails actual evidence, report REVISE to Supervisor; do not fix source or report.
## Report
CODEX_VERIFICATION full report, evidence paths+SHA, counters, remaining limitations, final recommendation.

## Supervisor Closure
DECISION: PASS for read-only bounded design/readiness only; runtime and qualification NOT VALIDATED.
Report: /tmp/session-bounded-fix-design-verify-ygw3kxnh/VerificationReport.md
Report SHA256: f02623c65effdbbf54658f56dfcf135953ccc7d50a833475b8a0f71eae472d4d
Independent verification: /tmp/session-bounded-fix-design-verify-ygw3kxnh/VerificationReport.md SHA f02623c65effdbbf54658f56dfcf135953ccc7d50a833475b8a0f71eae472d4d.
Missing003 exactSESSIONhost/user retained; fullruntime remains separate. Implementation begins under SESSION-BOUNDED-TEST-FIX-01. No oldI/B rewrite permission.
