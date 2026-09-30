# TASK — Approved single-case lock diagnostic execution

## Identity
TASK ID: SESSION-LOCK-DIAGNOSTIC-RUN-01
TITLE: Execute frozen original SESSION001 once and review sanitized inner failure
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
ARCHITECT GATE: NOT_REQUIRED; reuse approved local-only Gate and independently PASS diagnostic packet; no contract change
MODEL ROUTING REASON: bounded runtime evidence and exception-cause interpretation, not new implementation
DISPATCH RECORD REQUIRED: YES

## Objective
Execute the already-reviewed command exactly once under user's latest 开始吧 approval, preserve raw private outputs and sanitized diagnostic, and report exact causal evidence without patching or retrying. Then independent read-only audit.

## Context
Prep completed .codex/tasks/completed/SESSION-LOCK-DIAGNOSTIC-PREP-01.md.
Packet /tmp/session-lock-diagnostic-prep-r1-x1xitrq7/Packet.json SHA256 a121c702d2b06420421f08b406fbb7301ce8781b0ed9585b7273aca8356235de.
Runner /tmp/session-lock-diagnostic-prep-r1-x1xitrq7/run_local_once.py SHA256 ecde6b402b2b3ee0988100661a4b48768ffe47196166212e5a5fab92f2878442.
WorkerReport /tmp/session-lock-diagnostic-prep-r1-x1xitrq7/WorkerReport.md SHA256 79b9a89bdea935ccb4e9e142aecef42d1680d0b472b98f42c3fe60cce54f5bb2.
Independent /tmp/session-lock-diagnostic-r1-verify-Abfg8UZD/VerificationReport.md SHA256 50155eed68af2f8066a638718fe8d7f516ced896689606ba68f221ea89cf8c85.
Frozen ProposedCommand.txt SHA256 09e59703bcd3ec0ef2ce669f36000528fd9b1e44bdb01fd8f59b52f523ed9259.
Prior attempt consumed; R0 packet forbidden. Prior exact cause UNDETERMINED despite offline reader PASS. User was shown exact one-case/zero-retry/local-only resources and explicitly said 开始吧 after runtime approval question. This authorizes this command only, not other tests/fixes.

## Scope
WRITABLE SCOPE: frozen runner's predeclared new claim/results paths and original test-owned synthetic temporary resources; new private /tmp/session-lock-diagnostic-run-* report/receipt for Worker, /tmp/session-lock-diagnostic-result-verify-* for Verifier. Supervisor owns Task metadata.
READABLE DEPENDENCIES: bound Packet/source/test/reports and generated private results; role manuals. Read specific original source lines only as needed for sanitized causal interpretation.
FORBIDDEN: edits to runner/Packet/test/source/fixture/README/authority/I/B/history/build/lock/schema; reads of production credentials/env/private approvals; native rebuild/pull/install/production/mint/deploy; broad process/container scans; old retained container query/deletion (0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89); retries/another command/other test selection. You are not alone: preserve all unrelated edits, never revert.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO.
Classification DIAGNOSTIC_ONLY_NOT_FORMAL_QUALIFICATION.
Original sole test: teaching_agent_source_provenance_acquisition_test.ProvenanceAcquisitionSessionContract.test_SESSION_001_packaged_fresh_session_receipt.
No additional instrumentation or monkeypatches. Use frozen addError observer unchanged.

## Data / Security Impact
Only synthetic test-owned local Docker/DB. No production operations, no public contract/Auth/RLS changes. Raw output stays private0600/directory0700. User-facing output only safe codes/hashes/phases, not raw exception strings, credentials, locals or SQL.

## Requirements
1. Read CODEX_WORKER.md and this Task. Fresh-hash named anchors, ensure fresh claim/output absent; stop on drift without editing/rebinding. No duplicate broad prep validation.
2. Execute exact command once from /home/yangzhen/projects/my-lms-system:
/home/yangzhen/miniconda3/bin/python3.14 -B /tmp/session-lock-diagnostic-prep-r1-x1xitrq7/run_local_once.py --execute-once --packet-sha256 a121c702d2b06420421f08b406fbb7301ce8781b0ed9585b7273aca8356235de
Use required execution permission for Docker runtime upfront, no wrapper/env/argv changes. Do not relaunch after invocation/claim; poll the same process/session. If launch is denied before execution, report blocked rather than consuming alternative run. No automatic retries.
3. Reuse runner's preflight/postflight, exact test result, claim, deadlines. Max4 simultaneous containers/1internalnetwork/4GiB configured, PG1GiB+pooler2GiB+PRE512MiB+ROLES512MiB; no host ports/pulls. Original synthetic host binds /connection RO and /proof RW are allowed (not zero mounts). 2400s body +600s termination grace; additional operator evidence review600s. No hard-realtime or guaranteed cleanup claims.
4. Original fixture cleanup only. No fallback deletion/scans or touch old unrelated container. Physical remaining NOT_OBSERVABLE if no direct proof. Record whether framework cleanup returned or produced additional error without equating that with physicalzero.
5. Preserve output SHA/rc/start/end/claim, raw result, per-error diagnostic observations; distinguish runtime test result, observer validity and causal certainty. PASS means not reproduced, not historical cause proven or formal qualification. Failure may prove only current attempt. If exact failed predicate safely recoverable, cite its source lines and minimal next review scope; do not implement fix.
6. If exception graph is missing/truncated/observer invalid, retain uncertainty, no speculative cause or second test. Honor failure stop/cleanup. No I/B refresh, formal915, authority, production.
7. Verify finite bound source/test/package hashes from produced before/after evidence. No whole-repository immutability claim from finite snapshot. Counters unobservable stay NOT_OBSERVABLE. Independent verifier only reads, does not rerun.

## Out of Scope
Code fixes, complete30, fresh915, production, publication, authority.

## Acceptance Criteria
One authorized command attempt honestly captured; unchanged input contract; safe exact inner failure if observable; original cleanup only; no retries or sensitive output; full Worker Report with evidence and limitations. Test may fail while diagnostic evidence review passes.

## Required Validation
Only frozen one-case runtime. No other tests/build/typecheck/lint/browser. Independent output/binding/scope/causality audit after Worker; no rerun.

## Risk Focus
Masked acquire failure versus outer ACQUISITION_IMAGE_UNAVAILABLE, no original exception mutation; sticky diagnostic invalidity; distinguish source startup from acquisition admission; do not infer image missing from public code alone.

## Parallelism
CAN RUN IN PARALLEL: NO. Sole runtime then verifier. No mutable resource competition.

## Escalation Rule
Any drift, scope expansion, missing authorization, runtime inability, observer interference: stop, preserve evidence, report BLOCKED/UNDETERMINED. Do not repair or rerun.

## Worker Report
Full CODEX_WORKER.md Worker Report with exact command/rc/runtime observations/counters/scope/bindings/root certainty/next minimum task. Report hash to Supervisor; no raw secret-bearing outputs.

## Verification Report
Full CODEX_VERIFICATION.md report for this Task and Worker Report; independent read-only audit. Do not rerun or fix. Classify audit PASS separately from test outcome.

## Supervisor Final Review
RESULT: REVISE for strict output-minimization compliance. Bounded diagnostic attempt and results-only review completed; no retry/fix authorized. Diagnostic evidence audit PASS, original test ERROR, deeper root cause UNDETERMINED.
The approved command eventually executed after the prior waiting turn. Current turn resumed from saved claim/results and did not relaunch. One recorded test/error, runner returnCode1; original shell completion rc NOT_OBSERVABLE. Original cleanup returned without added recorded framework error; physical remainder NOT_OBSERVABLE, not claimed zero.
Current exact location: acquire1819 -> image_preflight1362 -> require58; exporter-package probe rc nonzero. Numeric package rc/stderr/failing subcommand absent. Earlier image identity checks returned; image absence is not established. Historical local30 _Run constructor failure is different and remains UNDETERMINED.
WorkerReport /tmp/session-lock-diagnostic-run-3q2tg_hf/WorkerReport.md SHA256 3e04b28f5dd06ad82eb444b4de87ee5a7801c4998866d41cf2b81790a9d7e6ae.
ResultReceipt /tmp/session-lock-diagnostic-run-3q2tg_hf/ResultReceipt.json SHA256 d67a26362fdc1e007916c6efd58c1793c7166613767bb0ceb5cfee4781191828.
VerificationReport /tmp/session-lock-diagnostic-result-verify-wqslcbbp/VerificationReport.md SHA256 e3709ae586e97a634538cf61302a9e65cce62deac17efb9f88e47d9a936d2739.
EvidenceProof SHA256 23a3d4475f4c2f712c7a4f1afc73f931563eaea9447e42571b94b8a549291c41.
Worker disclosed initial raw traceback/tool-output overexposure beyond minimal safe fields. Cannot undo that emission or retroactively grant strict PASS; preserve deviation and reports. Verifier found no evidence this altered diagnostic artifacts, but did not have the complete original emitted transcript to establish blanket secret-free output. Future result reads must use explicit safe projections.
Finite61 inputs/60unique currently match; recorded runtime inputSnapshot UNCHANGED. No whole-repository immutability claim. No source/test/fixture/I/B/authority changes or production operations in current review. No purchase, download or rebuild.
Next minimum task: prepare a bounded isolated package-probe diagnostic preserving numeric rc and closed failed-check identifier/private stderr, one512MiB container/network none/no mounts, no source/pooler/SESSION001 rerun. Preparation/approval must precede any new execution; existing attempt consumed. Isolated PASS would not prove prior transient cause. No new probe packet or runtime authorized by this review. Recommended effort high.
Formal qualification remains NOT VALIDATED; production/AgentRun not authorized.
