# TASK — Approved one-shot local SESSION30 run
## Identity
TASK ID: SESSION-LOCAL-REVALIDATION-RUN-01
STATUS: SPECIFIED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high), independent receipt review without rerun
ARCHITECT GATE: reused SESSION-CONTEXT-TRANSITION-GATE-01 ALLOW local design
MODEL ROUTING REASON: finite actual runtime execution and honest failed-run/cleanup evidence management
DISPATCH RECORD REQUIRED: YES
## Objective
Execute the frozen reviewed R1 command exactly once and preserve actual local30 outcomes. No fixes/retries. NONQUALIFYING_LOCAL_FOCUSED_REVALIDATION, not formal915 or production admission.
## Authorization / Context
User answered 继续吧 to Supervisor's exact one-run approval request: max4containers,4GiB total configuredcontainer memory,1internalnetwork, temporarysynthetic binds only, nohostports;40minute process policy +10minute terminationgrace; firstfailure stops, zeroretries; nopull/purchase/production/oldcontainer access. This is current one-time authorization, not reuse of prior diagnostic approval.
Frozen directory /tmp/session-local-revalidation-prep-r1-v8wrpjo1.
Packet.json SHA047b2254619eace7fb8e4a16da522ad04355a8a976379f2c442de0322c3b0308.
run_local_once.py SHA d2d784af2ce4d11ffeb203dea4e551e83431e12306f367d332b877570e6d3105.
WorkerReport.md SHA86ee8c1389936f6be628826a2970404ab2600b95109a4ad7e21f2b0e0614668c.
Independent /tmp/session-local-revalidation-prep-r1-verify-izJG0Y/VerificationReport.md SHA d2078ad4abc5c1873e7c34f0263013b62c920acf46fa7acf85f380ae6e2c3ee5 PASS preparation-only.
Gate /tmp/session-context-transition-gate-7e8qxfuu/GateReport.md SHA0363d910ddd8a4d373b1530a555cfa246281580fe62db6d7ec98f33cca3ac920.
## Scope
WRITE only frozen runner-owned claim/outputs as defined in Packet; original tests' fresh private synthetic temp/runtime artifacts; new /tmp/session-local-revalidation-run-* report directory0700/files0600. Source/tests/repository/I/B/authority/design/nativebuild/lock/history readonly. No implementation change.
READ named frozen files and original finite bindings only, approved local image inspect and owned runtime results. Never read env/productioncredentials/privateapprovals.
Docker local owned resources only through original tests, cached pinnedimages --pull=never. Max4 simultaneous containers,1internalnetwork,4GiB containerlimit,0ports. Original /connection readonly and /proof readwrite fresh synthetic private mounts exactly perpacket. No externaltarget.
No query/delete retained container0e3b36cc35285c64e3b0b29e76a44e5abf76b7778513262565b5a0b4f837dc89 or global daemon cleanup/scan. Original fixture cleanup only; no fallback deletions or fabricatedremaining0.
You are not alone; revert nothing. Supervisor owns Task metadata.
## Exact command
/home/yangzhen/miniconda3/bin/python3.14 -B /tmp/session-local-revalidation-prep-r1-v8wrpjo1/run_local_once.py --execute-once --packet-sha256 047b2254619eace7fb8e4a16da522ad04355a8a976379f2c442de0322c3b0308
Cwd /home/yangzhen/projects/my-lms-system. Use actual regular interpreter; no wrapper/env/argv substitution. Run with required filesystem/Docker permissions from first invocation; do not start a trial invocation. If sandbox/tool refuses before launch, distinguish from actual claimed attempt. Once claim created anyfailure consumes attempt, no rerun.
## Requirements
1. Read AGENTS/CODEX_WORKER and Task. Check exact packet/runner/report bindings and claim/output absent. Readonly imageinspect of only packet-required images allowed before command; missing image=>STOP withoutpull. Do not import tests until exactcommand. No duplicate closed verification.
2. Execute command once, preserve tool process/session id+rc/timestamps and rawstdout/stderr/hashes privately. If ongoing poll sameprocess, never restart. No subprocess/safe_file/helpers/fixtures/env/semantics monkeypatch. Testdefined mocks unchanged.
3. 2400s initialalarm+600s terminationgrace perreviewedrunner, separate600s reportreview allocation; noabsolute hardrealtimeclaim. Firstfailure failfast. No repairs/retry/newvariant. Monitor private events metadata only, keep secrets/raw syntheticcredentials out of public messages.
4. Save actual PASS/FAIL/ERROR/SKIP/NOT_RUN per exact30. Iffailure identify exactfirst ID/code/function/phase fromraw traceback with safe description+hash, downstreamNOT_RUN honest. Preserve artifacts. Do not refresh I/B based on failure.
5. Respect original cleanup only, report observable cleanup and remaining NOT_OBSERVABLE if no directproof. No oldcontainer inspection, globalzero claims, fallbackdeletion. Unknowncounters NOT_OBSERVABLE. Known pulls0, production0 only supported by actualscope.
6. Read runner post-inputsnapshot and independently bounded rehash if run hardterminated before it. Preserve source/test/receipt hashes. No runfix/publish/formal915/nativebuild/deploy/mint/authority/AgentRun/purchases.
7. Complete WorkerReport with exactcommand/rc/rawfilehashes/process id, actualselected/executed results, firstfailure(ifany), immutableinputs, cleanup limits and counters. Original test stdout may have syntheticsecrets: privateonly; sanitized public report, no rawenvironment.
## Acceptance
Execution task complete once exactlyone authorized attemptedcommand is evidenced with honest result+cleanup+immutability. Testsuccess requires30PASS zeroallother and unchangedinputs, no timeout. Executioncompleted does not mean testsPASS. Formal qualification remainsNOT_VALIDATED. Fail=>STOP after report; noautomaticfix.
## Parallelism
Exclusive runtime writer, independent Verification follows with readonly evidence; no concurrenttests/mutations.
## Validation
Actual frozen local30 once only. Independent verifier audits saved results notrerun. No formal915 or broader suite.
## Escalation
Hashdrift/unexpectedresources/interference/need forbiddenmutation=>stop report; user approval no greaterauthority.
## Worker / Verification Reports
Use respective CODEX manuals, report selectedprofile vs introspectionUNKNOWN, failures/limitations precisely. Review final Supervisor PASS/REVISE/UNDETERMINED separated from actual localtestsPASS/FAIL.
