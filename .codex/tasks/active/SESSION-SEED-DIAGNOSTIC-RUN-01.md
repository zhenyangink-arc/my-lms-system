# TASK — Approved one-time seed initialization diagnostic

## Identity
TASK ID: SESSION-SEED-DIAGNOSTIC-RUN-01
TITLE: Execute frozen seed initialization diagnostic once and preserve outcome
STATUS: BLOCKED

## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED; no new operational/security contract or source change.
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
MODEL ROUTING REASON: Execute reviewed single-use local packet, handle its authentic failure/cleanup evidence, and distinguish observation from cause. No redesign.
DISPATCH RECORD REQUIRED: YES

## Objective
Run the separately approved frozen diagnostic exactly once to capture missing seed operation details; preserve success, natural failure or abort honestly and establish only evidence-supported conclusions.

## Context
User explicitly approved after the concrete packet was presented. Approval covers only this one new local diagnostic, not a suite retry or fixes. Previous attempt4 formal validation remains FAIL_NOT_QUALIFIED (915 executions: 908 PASS,4 FAIL,3 ERROR). Seed underlying error was missing. Test-only design is completed separately; do not implement it.

## Scope
WRITABLE SCOPE:
- Runtime output/action/claim paths defined by the frozen packet in /tmp/session-seed-diagnostic-prep-r1-_r6zpmbw (not its immutable script/packet/bindings/prep reports).
- New private /tmp/session-seed-diagnostic-execution-* reports and read-only result collectors.
- docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-seed-diagnostic-attempt-1-result.json, exclusive-create sanitized evidence only.
READABLE DEPENDENCIES:
- CODEX_WORKER.md, CODEX_VERIFICATION.md, this Task; frozen packet, referenced source/hash inputs and saved reports.
FORBIDDEN:
- Source/test/fixture/README/native/package/authority/completion/lock/history changes; git stage/commit/push; .env, credentials and private production data.
- AGENTS.md, CODEX_*.md, .codex/** modifications (Supervisor owns task file).
- Sensitive docs/evidence/teaching-agent-stage-1f-r7c-b/approval-b2-provisioning.before-initial-ban-workflow.json must not be read/output/staged.
- Any extra Docker command, manual inspect, ad-hoc SQL, fixture alteration, second initialization, retries, downloads/builds, production, provider/AgentRun, or test suite.
- Old user-retained container 0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89 stays untouched and unqueried; unrelated resources likewise.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO.
All source calls, observer, budgets and cleanup must be exactly the verified R1 packet. No on-the-fly patch or fallback. No research/profile shim.

## Data / Security Impact
DATABASE IMPACT: WRITE_LOGIC limited to the original synthetic fixture initialization explicitly approved; production NONE.
RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: MEDIUM (local synthetic diagnostic/privacy/owned resource handling).

## Requirements
1. Fresh bind packet directory /tmp/session-seed-diagnostic-prep-r1-_r6zpmbw: ApprovalPacket.json SHA f7690c1eb1445c58dbf395ab115ba95c84e71876d6cf312cce3fb6f545e59465; diagnose_seed_once.py SHA 8a6cc137021a1a206fece95fd3dbef9fb1bf39678f4cef775d6482c934d28f99; bindings.json SHA 87c242d748ab8b104b9f0896f9cdc821dc3f293f2c56c535a0174c32281fc9a9. WorkerReport-R1.md SHA 07afff6893168cea589f0ae800262063a8fbcfdf91922b2c27d8c59bfa425122.
2. Fresh bind independent preparation report /tmp/session-seed-diagnostic-verify-r1-cp0jot_z/VerificationReport-R1.md SHA 4b10b6c7aabfcce530d114fbc8c4233caaffce6866d3b32faa35ac73a68214a0, proof SHA e32b1267e848b5dd62d42f763826d7192ad9399a0041902c401bfe77bfc01bcd. Verify necessary packet pins/inventory, planned output absence, no action/child claim already consumed. Any drift/existing result/action means STOP before runtime, not repair/retry.
3. Run sole exact command once from /home/yangzhen/projects/my-lms-system, preserving argv and env:
   env -i PATH=/home/yangzhen/miniconda3/bin:/usr/local/bin:/usr/bin:/bin LC_ALL=C PYTHONDONTWRITEBYTECODE=1 /home/yangzhen/miniconda3/bin/python3 -B /tmp/session-seed-diagnostic-prep-r1-_r6zpmbw/diagnose_seed_once.py --run-once --packet-sha256 f7690c1eb1445c58dbf395ab115ba95c84e71876d6cf312cce3fb6f545e59465
   Use approved tool escalation if necessary. Record exact command, launch count, tool session/chunks, UTC start/end, exit. Poll existing session only; never launch again after failure.
4. Limits from packet: 2 fresh synthetic services (PG1GiB,pooler2GiB),1 internal network,no hostports/mounts/clients,pulls0/retries0; only cached pinned images;3300sinit/360scleanup/10skillreap. Fixed env is a synthetic diagnostic boundary, not historical ambient reproduction. Original source init only; no methods/suites/export/acquisition/capture/restore.
5. Preserve original operation and error. Extract seed numeric rc or truthful timeout/no-rc, original argv and bounded stdout/stderr privately; classify first failure and prerequisite vs actual seed reachability. No unbounded raw log or secret output. Public evidence only sanitized codes/phases/hashes/counts and carefully vetted nonsecret cause description.
6. Let frozen driver run original and approved bounded cleanup, only resources with direct creation proof. No worker-created additional cleanup strategy. Uncertain ownership or incomplete cleanup must be reported, never silently deleted or labeled clean. No Docker verification beyond packet calls.
7. Do not infer all prior8events same cause from one run; actual new diagnostic is separately classified. Any observer/control failure makes diagnostic validity limited/invalid and must be disclosed. If initialization unexpectedly succeeds, report not reproduced; no further probes or retry.
8. Collect saved outputs read-only after completion; fresh finite before/after hash proof for source/package/necessary history/script/packet; don't claim entire repo unchanged. Runtime counters use observation or NOT_OBSERVABLE, not estimates. Production operations all0.
9. New sanitized public evidence exclusive-create0600,file+parentfsync,sameinode/device,exactbyte readback/rawSHA; if path exists STOP,no overwrite. Private report should bind raw artifacts without printing secrets. Publication cannot convert failure to success or grant authority.
10. Deliver complete Worker Report per manual and exact next minimal task based on actual result. Stop after report; no fixes or second runtime.

## Out of Scope
Formal revalidation, test correction implementation, operational code edits, authority/completion/lock, production acquisition/credentials, AgentRun, unrelated Docker cleanup.

## Acceptance Criteria
One exact approved attempt or honest preflight stop; authentic bounded error evidence or not-reproduced result; unchanged frozen inputs; owned cleanup evidence and limitations; privacy-safe durable evidence; no scope expansion.

## Required Validation
TYPECHECK/LINT/UNIT/INTEGRATION/E2E/MIGRATION suites: NOT_REQUIRED and prohibited. Sole authorized diagnostic command above; read-only hash/static collection before/after. Independent verifier must use saved files only, no diagnostic/test/Docker rerun.

## Risk Focus
Consumed authorization/retry; exception masking; observer interference; logs/credentials; unproved deletion; aliasing old preserved container; overclaiming historical cause or formal qualification.

## Parallelism
CAN RUN IN PARALLEL: NO. Worker execution then independent verifier. No worktree needed for source-read-only.

## Escalation Rule
Unexpected need to alter package, exceed resource/deadline or use production means STOP with actual evidence. No patch or runtime retry. Only existing approved cleanup may run.

## Worker Report
Follow CODEX_WORKER.md. Include task/profile and actual model visibility; all actual commands, session/exit evidence, frozen hashes, original and first failure classification, exact scope, counters, cleanup and unresolved limits.

## Verification Report
Follow CODEX_VERIFICATION.md; inspect actual saved artifacts/bindings/ownership/counters/claims, no new runtime. PASS means diagnostic evidence sufficient, not formal recovery qualification.

## Supervisor Review — preflight stop
REVIEW RESULT: PASS for evidence; runtime objective BLOCKED.
Outcome: PREFLIGHT_STOP_NOT_RUN. Classification: HARNESS_NOFOLLOW_INTERPRETER_PATH_COMPATIBILITY_ERROR.
Frozen python3 path is a symlink; O_NOFOLLOW fails with ELOOP before action/child. Resolved target hash exactly matches the pin. This is not input byte drift. Preparation checker followed links and its isolated sanity stub omitted the real bind_inputs open path.
Execution/fixture/Docker/DB/SQL/cleanup/production counters0; no action consumed, no runtime process launched, no retry. User-preserved old container unqueried and untouched. Formal qualification remains FAIL_NOT_QUALIFIED; seed root cause remains NOT_VALIDATED.
Public result: docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-seed-diagnostic-attempt-1-result.json SHA256 5a3078117341b5ac9cecb8ef57ca9834a20f9c62bb1cf8090eb7a120e45f512f.
WorkerReport: /tmp/session-seed-diagnostic-execution-3843o6jr/WorkerReport.md SHA256 16b469db32dd892391a173e17ab373e613b429e27e6c0e967b733c43c2a50aa7.
Independent verification: /tmp/session-seed-preflight-stop-verify-5NQq3T/VerificationReport.md SHA256 de47f6f095f7ea026b24415f73b84e04e67439d16446cdae857aeb33aa66a9c5; PASS trustworthy stop evidence only.
Next minimum scope: private diagnostic packet interpreter pin/read compatibility and matching offline coverage, preserving source/tests and security checks. Do not patch this frozen approved packet or execute another command under this task.
