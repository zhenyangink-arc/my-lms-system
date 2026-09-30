# TASK — Minimal local pooler fixture and test corrections
## Identity
TASK ID: SESSION-BOUNDED-TEST-FIX-01
TITLE: Apply reviewed test-only key/input/assertion corrections with missing production-positive identity kept pending
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6 Sol high)
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED; same production/security contracts, only disposable synthetic input and test construction corrections.
MODEL ROUTING REASON: One file but interdependent fixture, pure observation, identity and frozen assertion obligations need careful preservation.
DISPATCH RECORD REQUIRED: YES
## Objective
Implement the verified finite ready subset in one existing test file. No formal validation/qualification claim; no runtime until separately scoped.
## Preconditions
SESSION-BOUNDED-FIX-DESIGN-VERIFY-01 must PASS (Supervisor supplies report). Current test SHA 3b9bf9205fc71422643889adece6f425ee51ea74055920f098bd38b529d073fb. Bind source17/context2/main10 to current I/B and accepted reports before edit. Drift means STOP.
## Context / Frozen Design
/tmp/session-vault-input-contract-4nwui58c/WorkerReport.md SHA ec02709296e0955ea3d7c71774c4f709893b1ea0162b0ff2d2999bb510474c9c
/tmp/session-vault-input-contract-4nwui58c/Proposed.diff SHA 4b90d9903038876eb2a7ea97f8638d2ef712f9bdf1deaa5b8d3c083d3d717399
/tmp/session-test-fix-readiness-s2yk1zw0/WorkerReport.md SHA f3492162e1c17c2b3a01ecd53a6ff4b2d626b48df0ce277a4b92731761409e97
/tmp/session-test-fix-readiness-s2yk1zw0/Readiness.json SHA 0a1ae5b1ae1a772b1ace309898cb9170ec66b78fa8bd94ecf8cf961efab64bf0
/tmp/session-test-correction-design-r1-_b0_4dl0/Design.md SHA fb714014a566b7f676a6c7f11863546a840260480eb43ef43a6d70c476b165ec
AssertionMap.json SHA 2b51037d6942f5e47791ac4ff29d1ba1027f26522ad2849b8a32df4c8c106182
## Writable Scope
- tests/teaching_agent_source_provenance_acquisition_test.py ONLY existing repository path
- New private /tmp/session-bounded-test-fix-* for baseline snapshot, exact diff/report, pure PREPARATION_ONLY sanity runner and receipts
Added/deleted repository paths: NONE. No public evidence publication in this task.
## Readable Dependencies
AGENTS, CODEX_WORKER, task/design/reports; source and directly bound evidence/schema/config needed for these tests, no credentials/env/privateproductionapproval. You are not alone; preserve unrelated edits and other-agent files.
## Requirements
1. Apply ONLY key expression from Proposed.diff: base64.b64encode(os.urandom(24)).decode('ascii'). Preserve every other OwnedSessionSource byte including topology/TLS/env/callback/SQL/order/memory/cleanup. AES receives32rawASCII bytes with192bit synthetic entropy, notdecoded24bytes. Never output generated key.
2. SESSION003: extract reviewed local assertion blocks into private non-test helper, call helper before retained production-positive block, add exact fake-target rejection. Preserve original production-positive PRE/ROLES/POST no-memory obligation. No supplied validhost/user yet: leave its unresolved input explicitly documented as PENDING, do not skip, catch/pass, guesshost, reversehash or guardmock. Full003 still NOT_VALIDATED and expected unresolved; no assertion deletion. User 'yangzhen' is not evidence of DBidentity. Only Supervisor may supply a subsequent validated nonsecret identity binding.
3. SESSION008: private pure PRE/POST _validate_observation positiveTrue controls and False/'unavailable'/None exact ACQUISITION_CLIENT_TLS assertions, preserve RolesExporterProof checks. Invoke helper before unchanged ownedCA/hostname/route subtests; no coverage removed.
4. SESSION016: preserve DIRECT/SQL_ASCII source_profile acceptance, assert actual bootstrap QueryReceipt canonicalResponse.serverEncoding instead of nonexistent BODY field. No production query/schema changes.
5. SESSION025: only policy-only SimpleNamespace(fixture=False,transport_kind='SESSION') for image_preflight; do not construct fake-valid production identity. Preserve all resource/argv/negativeartifact obligations and restore audit.ctx before counterreader tests.
6. Exactly30 SESSION IDs/methods retained, selectionSHA57e26012c7d73c0f9166f4e409ec78c37f7e8ef4c9e6691448989f6baf10340d. No newtest_* methods, skips/xfails/catchpass, assertion deletion or broadenedacceptance. Other26methods unchanged. All14 prior assertiongroups remain mapped.
7. Existing I/B remain byteimmutable. Newtest SHA changesContext2 only, no SourceClosure17/main10 change, no build rerun. OldI/B do not admit changedtests; document formalqualificationpending and futureforwardbindings separately. Do not publish/guess successor paths or rewrite receipts.
## Contracts / Security
PUBLIC CONTRACT CHANGE: NO. DATABASE/RLS/AUTH IMPACT: NONE. Test-only syntheticinput correction, no production encryption/endpoint/isolation policy change.
## Forbidden
Any other repo source/test/docs/fixture/AGENTS/CODEX/.codex edits; production/credentials/env/authority/completion/lock/old evidence/I/B mutation; Docker includinginspect/imagepull; SQL/clusters/seed/restore; fixture-owned integration; formalfull/focusedsuite rerun; subprocess monkeypatch for operationalsemantics; commit/push; oldretainedcontainer query/deletion; sensitiveapproval-b2-provisioning.before-initial-ban-workflow.json read.
## Required Validation
Syntax/AST and whitespace/diffscope. PREPARATION_ONLY pure sanity permitted: exact keyAST deterministiczero/ff/range24vectors and optional one realCSPRNG withoutprintingvalue,32ASCIIbytes/roundtrip/envline; execute only003private localhelper,008private purehelper,016wholepuremethod,025wholepuremethod after static confirmation noDocker/network. Use original unitmocksetup, notdriveroperationalpatches. No fixtureconstructor orownedbranch. If any dependency could invokeDocker/DB, do notrun; reportblocked. Exactcommands/rc/outputSHA/privatebyteoutputs. This is not fresh formalvalidation. No automaticrepeat aftersemanticfailure; preservefailureandreport.
## Acceptance
Single testfile scoped delta, keyfix+readytestsubset exact, all30IDs/14obligations preserved; relevantpuresanitypasses; otherinputsunchanged; missing003host/user and008runtime are explicit; noqualificationPASS.
## Parallelism
SERIAL writer; samefileallchanges oneWorker. No competing writers.
## Escalation
Need scope/publiccontract/guardrelaxation ornewruntime => SCOPE_CHANGE_REQUEST, no improvisation. Implementation issues reportexactfailure; do notrepurpose915suite.
## Worker Report
Full CODEX_WORKER report with before/afterhashes, exactdiff, pergroupresponsibilities/assertionmap, expectedremainingerrors, purecheckreceipts, counters and nextscope. CONCLUSION may be COMPLETED_READY_SUBSET with full003/runtime NOT_VALIDATED; not claimwholefix/recoveryPASS.
## Verification
Independent verifier review actualdiff and relevantpureproof, no ownedruntime or fullsuite.

## Design Admission
Supervisor design PASS based on /tmp/session-bounded-fix-design-verify-ygw3kxnh/VerificationReport.md SHA f02623c65effdbbf54658f56dfcf135953ccc7d50a833475b8a0f71eae472d4d. User-supplied db.jubdbsjsalpecfvseskz.supabase.co / postgres is DIRECT context only; never use as SESSION-positive input.

## Approved Input Addendum — User supplied exact SESSION identity
The user supplied Host aws-1-ap-northeast-2.pooler.supabase.com and User postgres.jubdbsjsalpecfvseskz directly in this conversation, project jubdbsjsalpecfvseskz. These are nonsecret test inputs, not connection/execution authorization.
Offline proof /tmp/session-bounded-test-fix-_22w6fix/IdentityBinding.json SHA 6a23187999cf7ea10570fedbe01fbb307157235c980b81701f178ccc37040b51:
- host canonicalSHA33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5 exact frozenconst
- project canonicalSHAcad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673 exact frozenconst
- frontenduser canonicalSHAbd003e693b351b3ab505c1ddd03752879fc5116c53f46e6dd74978239c2acaa4; actual pureSessionTarget/validate_session_host pass
This resolves requirement2's input PENDING only. Worker may now replace the old fabricated host/project/user values in the original production-positive003 block with these exact user-supplied values, preserving original positivePRE/ROLES/POST no-memory assertions and allidentitygates. Keep fakeinput as exact expectednegative in localhelper. No mockingguard, no _Context/source/schema change. Add a comment that these are suppliednonsecretidentityinputsforofflineargv only.
Pure sanity now additionally includes entire original SESSION003 with correctedidentity; no network/DNS/DB/production credentialread. All other scope remains unchanged, especially runtime/008owned and formalqualificationstillpending. No new test IDs. This is data-input completion within same reviewed assertion contract, not profile extension.

## Private sanity harness revision allowance
Initial purecheckcommand rc1 occurred at auditbookkeeping finalassertion, relative dir_fd writes were misclassified as repo paths. Preserve /tmp/session-bounded-test-fix-_22w6fix/FailedPureReceipt.json and FailedPureRunner.py SHA4a25c56f2c6c6f7624cc9533ddf7848925530301ad4e3e42136d0f21f9603494. No whole-runPASSclaim for that execution.
Supervisor allows ONE new PREPARATION_ONLY purecheck after narrowprivateauditfix: resolve actualdir_fd through readonly/proc/self/fd for exactlyknownboundsourcecallers; unknown/ambiguousfails; do not intercept/modifyoperationalcalls/args/returns. Persistresults/counters beforeterminalassertions. TestSHA33416171a335aab3b6934a5b410086c48ae161a216f39e1827430b6c3c52ce90 remainsunchanged. NoDocker/DB/newformalrun. Anynewfailure STOP andreport. Verifiermustreviewbothreceipts andprivatehelperdiff.

## Supervisor Final Review
DECISION: PASS — SINGLE_TEST_FILE_PREPARATION_ONLY.
Actualdiff sampled and both reports read. WorkerReport /tmp/session-bounded-test-fix-_22w6fix/WorkerReport.md SHA8beb73873918e73705323f4726577c8f002c10148b444e157f8118bc9753518d.
Independent VerificationReport /tmp/session-bounded-test-fix-verify-gusss0ai/VerificationReport.md SHAb28d9ed7031c2615f38a6a9d717d38f89089e621c96d53369835f69d4be0db50; proofSHAf28f1ed5cff5b25306fb028e0037757119172bd3a260523e45537c860b46b7ba.
Oneapprovedtestfile finalSHA33416171a335aab3b6934a5b410086c48ae161a216f39e1827430b6c3c52ce90; exactdiffSHAa54a2d448388625888e3216699cb94100ef21659325622a5dbf9a21591ae5ddd. 30IDs/14groupsretained; no production/source/securitycontractchanges. UsernonsecretSESSIONidentity gapclosedoffline.
Initialprivate static/audit failures retained; oneauthorizedrevisedpureattempt rc0; verifier204staticchecks rc0 and nofixturetestrerun. Docker/DB/productionoperations0.
Runtime/newseed/008owned/formalqualification remain NOT_VALIDATED. I/Boldtestcontext preserved, noteligible fornewtest. Nextminimumtask: prepare append-only currenttest-context binding and concrete boundedlocalrevalidation scope; nooldreceipt overwrite, build/authority/completionpublication, newruntime orproduction granted bythisclosure.
