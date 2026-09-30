# TASK — Revised approved single seed diagnostic

## Identity
TASK ID: SESSION-SEED-DIAGNOSTIC-RUN-02
TITLE: Run approved interpreter-compatible diagnostic once
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED; execute frozen reviewed packet, no contract change.
MODEL ROUTING REASON: One bounded local run with authentic failure capture, privacy and owned cleanup; no redesign.
DISPATCH RECORD REQUIRED: YES

## Objective
Capture the missing original initialization/seed error, or honestly report not-reproduced/preflight-stop/abort. Complete only one fixed local diagnostic and read-only result review.

## Context
The user approved the revised packet with latest confirmation “好，那你继续吧” following the explicit revised-package request. Do not ask again for task approval. Prior RUN-01 stopped in preflight and launched zero processes/containers. New packet corrects interpreter symlink/atime checks and independently passed preparation. This is no test-suite retry; no source fix is authorized.

## Scope
WRITABLE SCOPE:
- Runtime output/action/claim paths already defined by frozen /tmp/session-seed-interpreter-compat-r1-cSGmUiCp packet; never modify its script, binding, prep evidence or approval bytes.
- New private /tmp/session-seed-diagnostic-run02-* for collectors/WorkerReport.
- docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-seed-diagnostic-attempt-2-result.json exclusively, sanitized public outcome.
READABLE DEPENDENCIES: CODEX_WORKER.md, CODEX_VERIFICATION.md, this task, fixed packet inputs and saved source/evidence dependencies.
FORBIDDEN: source/tests/fixture/README/native/authority/completion/lock/history changes; credentials/.env/production data; AGENTS/CODEX/.codex changes (Supervisor owns task); git stage/commit/push; sensitive approval-b2-provisioning.before-initial-ban-workflow.json reads; unrelated container queries or deletion; extra Docker/SQL/network probes beyond frozen driver; downloads/builds; actual suites; research shim; retries; patch-and-run.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. All fixed source, observer, one-use guards, budgets and cleanup unchanged.
DATABASE IMPACT: WRITE_LOGIC solely within original fresh synthetic fixture initialization; production NONE.
RLS IMPACT: NO. AUTH IMPACT: NO. SECURITY IMPACT: MEDIUM (private local runtime/owned cleanup/privacy).

## Requirements
1. Fresh bind /tmp/session-seed-interpreter-compat-r1-cSGmUiCp:
   ApprovalPacket.json SHA ec2c727148d1974fce7e649bdf92c7d44b94723cfd107d2ec1cd546464290faf;
   diagnose_seed_once.py SHA ab7facfd973217dad95a77f8bc5535ece4eef986aee12ecb8fec513a36029cc1;
   bindings.json SHA 750763f4819f93bae116d92b2ff1423c49672e0cd3cf96c4995d8d20a01aef09;
   WorkerReport SHA d4948b1bfa97f7973ccf820d79b78b748273bd45aa517c1a4c2821827e199fa3;
   DeliveryReceipt SHA 6eecc39ee53e5ea2105a3d23ef322890c6ea7df03866cd1bc4e845463beb6e49.
2. Bind independent /tmp/session-seed-interpreter-compat-r1-verify-vRedRb/VerificationReport-R1.md SHA be81e0b36725ccdd5fc04271dfc59acc977381863ade0cfbcc16cef737619ead; StaticReaderProof-R1.json SHA464aaf20e0a38f815bd13af2f4fc357875081c18ba16c550850ab3d7379ec787. Check necessary frozen input pins and output/action/claim absence. Exact interpreter alias is explicitly allowed by reviewed reader; use that policy, not the old blanket O_NOFOLLOW error. Actual byte/identity drift or existing action/output means STOP, no repair/retry.
3. Sole runtime command from /home/yangzhen/projects/my-lms-system:
   env -i PATH=/home/yangzhen/miniconda3/bin:/usr/local/bin:/usr/bin:/bin LC_ALL=C PYTHONDONTWRITEBYTECODE=1 /home/yangzhen/miniconda3/bin/python3 -B /tmp/session-seed-interpreter-compat-r1-cSGmUiCp/diagnose_seed_once.py --run-once --packet-sha256 ec2c727148d1974fce7e649bdf92c7d44b94723cfd107d2ec1cd546464290faf
   Execute once with tool escalation as necessary (up-front since Docker requires access). Record exact argv/cwd, UTC, actual tool session/chunks and exit. Poll same process only. Never restart after any failure. Do not add env flags or wrapper.
4. Frozen budget: at most2freshcontainers(PG1GiB+pooler2GiB),1internalnetwork,no clients/hostports/hostmounts/pulls/retries/production. Init3300s,cleanup360s,kill/reap10s. Preserve all original fixture calls/timeouts. The fixed environment is synthetic; historical ambient reproduction NOT_VALIDATED.
5. Preserve user-retained container 0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89 untouched/unqueried. Use only frozen driver cleanup, no separate Docker inspect/remove by Worker. Unknown ownership remains untouched and disclosed.
6. Capture actual seed reached/rc or timeout/no-rc, original operation and first exception, child outcome, observer validity, owned resource creation/removal proof and cleanup limitations from saved files. Raw argv/stdout/stderr private0600, no secret output. Public only vetted safe facts/codes/hashes. Never dump whole raw logs to tool output.
7. If seed naturally fails, save original error and no retry/fix. If succeeds, report NOT_REPRODUCED, no further experiments. Pre-seed failure or diagnostic interference explicitly classified. This single new run cannot prove exact cause of all historical8events. No formal validation PASS claim.
8. Read-only finite before/after hashes for required frozen package/source/history; no entire-repo immutability claim. Counters observable only or NOT_OBSERVABLE; no invasive wrapping for counts. All production operations0.
9. Publish new sanitized evidence O_EXCL0600,file+parentfsync,sameinode/device,exactreadback/SHA, no overwrite. Link private rawproof hashes without secrets. If preflight stops, publish honest stop rather than fabricated runtime evidence.
10. Complete WorkerReport and next smallest evidence-backed scope, then STOP. No test fix, new diagnostic or formal revalidation.

## Out of Scope
Product/test changes, production, credentials, actual full suites, authority/completion/lock, AgentRun, unrelated cleanup.

## Acceptance Criteria
One exact approved run or honest preflight stop; trustworthy private error evidence; bounded owned cleanup; no code changes/retry/production; immutable inputs and durable sanitized outcome. Diagnostic success is not formal qualification.

## Required Validation
Only sole authorized diagnostic. All test suites/typecheck/lint/build/E2E/migration NOT_REQUIRED and prohibited. Read-only static/hash collection before/after. Independent Verification uses saved data only; no runtime repetition.

## Risk Focus
Missing original stderr, observer effects, exception masking, source drift, unauthorized retry, privacy/ownership, overstated historical cause.

## Parallelism
CAN RUN IN PARALLEL: NO. Execute then independent verifier. No worktree required.

## Escalation Rule
Need to alter packet/source/budgets or access production: STOP and report; only already approved cleanup may continue. Do not patch around unexpected failure.

## Worker Report
Follow CODEX_WORKER.md. Commands/session/exit/output hashes, exact source/artifact binding, limited conclusions, cleanup and operation counts. Selected worker_high GPT-6 Solhigh; runtime metadata if unknown state UNKNOWN.

## Verification Report
Follow CODEX_VERIFICATION.md. Validate saved execution/actual error/cleanup/immutability/privacy, no runtime. PASS evidence sufficiency only.

## Supervisor Final Review
REVIEW RESULT: PASS for diagnostic evidence; formal qualification remains FAIL_NOT_QUALIFIED.
One exact approved command executed, session75219 launch ab57cf/completion63062f, exit1. No retries. Seed RPC original rc1: ErlangError/badarg, Unknown cipher or invalid key size. Private observation confirms AES256-GCM key slot44 UTF8 bytes, strict Base64 decode32; no key/password publicly disclosed. Image configuration input contract and exact fix are not yet verified; this run does not establish all historical8events exact cause.
Observer valid, no deadline kill/supervision abort/finalization incomplete. Two fresh containers and one internal network natural removals serial45/47/48 allrc0. No unresolved or unproved creation outcomes. User-retained old container unqueried/untouched. No source/test fixes, production or extra runtime.
Public result: docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-seed-diagnostic-attempt-2-result.json SHA256 f7cb48f60bae08252ecb2fa349f189ce686a950ec31ed3b5d5d3a8e874b4d1cc.
WorkerReport /tmp/session-seed-diagnostic-run02-3rhd11y4/WorkerReport.md SHA256 18b41cf907a1ceacf4dd88b9358caf385696a39b482b388438db7cbbb25a294b.
Independent VerificationReport /tmp/session-seed-diagnostic-run02-verify-ntx63b_r/VerificationReport.md SHA256 1b39e918cb9c7854cb9c48d857a82b7b3f5fbe831ef7092cd99411f48afe7ae1; PASS/no findings. 48 operations,51 pins,108 private artifacts,22 saved-file checks verified.
Next minimum task: verify the fixed image key-input contract against fixture delivery and define minimal test-fixture correction. No implementation, second diagnostic or formal rerun automatically authorized by this report.
