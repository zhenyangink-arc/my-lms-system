# TASK — Single-case lock failure diagnostic packet preparation
## Identity
TASK ID: SESSION-LOCK-DIAGNOSTIC-PREP-01
TITLE: Prepare one read-only exception observer for original SESSION001
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_high (GPT-6.1 Sol high)
VERIFICATION PROFILE: verifier (GPT-6.1 Sol high)
ARCHITECT GATE: prior local-only Gate reused; no operational/public/security contract change
MODEL ROUTING REASON: preserve masked exception chain without changing original test semantics; bounded private runner change
DISPATCH RECORD REQUIRED: YES
## Objective
Prepare one concrete reviewable future single-SESSION001 command, preserving the exact inner lock-admission failure if it recurs. Preparation only. User said 开始吧 to preparing this packet, not new runtime authorization. Deliver all work needed for final separate one-run approval.
## Context
Previous local30 attempt is consumed: SESSION001 ERROR ACQUISITION_IMAGE_UNAVAILABLE and29NOT_RUN, rc1. Allcurrentofflinepredicates and one originalreadonlyreader callPASS; exacthistoricalcauseUNDETERMINED. No evidence supports sourcefix.
Closed review .codex/tasks/completed/SESSION-LOCK-ADMISSION-REVIEW-01.md.
Independent /tmp/session-lock-review-verify-9wqknb19/VerificationReport.md SHA5788b40f94445ee7f4173ca82ad64165331a9e8e2fdc91ad27b9962c047fdce1.
Offline /tmp/session-lock-reader-offline-zqjavpue/WorkerReport.md SHAe788e009fb297cb4727c023513627be4489832f94a5aaf300c8a5deb72501bfb; ReaderResult SHA ff5b150179ae15a4323d74947ee0678f7f01a5a29e098d7dfee93a32a1213258.
Prior reviewed R1 runner/Packet /tmp/session-local-revalidation-prep-r1-v8wrpjo1/run_local_once.py SHAd2d784af2ce4d11ffeb203dea4e551e83431e12306f367d332b877570e6d3105; Packet SHA047b2254619eace7fb8e4a16da522ad04355a8a976379f2c442de0322c3b0308. Independentprep /tmp/session-local-revalidation-prep-r1-verify-izJG0Y/VerificationReport.md SHAd2078ad4abc5c1873e7c34f0263013b62c920acf46fa7acf85f380ae6e2c3ee5. Reuse closed result/deadline/claim/binding design; do not build a new framework.
Current test SHA33416171a335aab3b6934a5b410086c48ae161a216f39e1827430b6c3c52ce90; acquisition SHA0702a657d8f4e2a58ef83f98955aa5923080e57cc43063fdd8eba068cd60913a; lock451ea9af3a10719703f78dafa6c15f08b55aed3eaf0f11983c7ad55626a3e763. Source17/main10/nativecontracts unchanged. Threecachedimages present inpriorrun; current availabilityNOT_VALIDATED.
## Scope
WRITE only new private /tmp/session-lock-diagnostic-prep-* 0700/0600 script/packet/proofs/report. READ namedboundsource/test/design/lock/oldreport/runtimeoutcomes, rolemanuals. Oldpackets and claims immutable. Supervisor owns .codex metadata.
FORBIDDEN: repository/source/test/fixture/readme/I/B/history/authority/build/lock/schema changes; env/privateproductionapproval/credentials; actual proposedcommand, testmodule/fixture/projecthelper imports/execution; Docker eveninspect; DB/SQL/network; neworiginalreaderinvocation; tests/915/fullfocused; purchases/production; oldretainedcontainerquery/deletion/globaldaemon scan. Youarenotalone; revert nothing.
## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. Originalsole test selected byte-exact: teaching_agent_source_provenance_acquisition_test.ProvenanceAcquisitionSessionContract.test_SESSION_001_packaged_fresh_session_receipt. No replacementtest, no source/testpatch, no helper/subprocess/safe_file/env/argv/fixture semanticmonkeypatch. Keeporiginaltest-definedmocks. New classification DIAGNOSTIC_ONLY_NOT_FORMAL_QUALIFICATION. Newattempt notrunnablewithoutseparateapproval.
## Data / Security Impact
Database/Auth/RLS changes NONE. Private exception observation only. Never serialize arbitrarylocals/rawmessages/credentials.
## Requirements
1. Prepare freshprivate runner as minimaldiff from reviewedR1; exactone-ID selection, originalsource unchanged. Never reuse consumedclaim/output. Oneprocess/onecommand/oneattempt/zeroretry, exclusivelyconsume invocation beforepreflight. Reuse exactPASS/afterhash/deadline gates, adapt exactcount to1. currentpass never historicalproof orqualification. Bind exactinterpreter/newrunner/inputsource/native/lock/report/packet refs and preserve oldhashes.
2. In unittest LoggedResult.addError hook, BEFORE formatting/discarding error, read only err traceback frame matching exact bound acquisition.py path AND function acquire; retrieve its specific local failure exception reference. Preserve sanitized originalfailure traceback and __context__/explicitcause chain, even fromNone. No tracebackframe locals dump. Reading references only: don't clear/change traceback, locals, args, globals, return, exception or cleanup. Operational functions remain unchanged.
3. Record allowlisted primitive class/code/state/errno and relativeboundsource file/function/line only. No str(error), repr(error), arbitrarymessages/locals/files, credentials, authorizationbytes. Cycle/length/frame caps with truthfulTRUNCATED flags, no silentcompletion. Code/state must safeclosedformat or hashedlength metadata. Foreign sourcepaths onlyhash/classification ifnotbound; raworiginalunitteststdout/stderr stayprivate. If OSErrorfilename useful only fixedallowlistednonsecretboundpath. Observerfailure recordedseparately, mark diagnosticinvalid; never suppress originalerror or change test outcome.
4. Observer only addError oforiginaltest, no sys.settrace or operationaloverride. Distinguish originalfailurecaptured, no failurefield, notacquirefailure, originalPASS, observererror. FuturePASS means not reproduced; noautomaticsecondattempt. Futurefailure outside targetedlock reportedtruthfully, noscopeexpansion.
5. Actualcontrolflow includes13 real fixed-lock reads beforeexecute; latermultiple direct/nested calls canfail. Do not assume directline1156 or imageabsence. Current onlyformattedtrace lacks failurelocal. Preserve needed innerpredicate safely, notlogeveryread/process.
6. Resources derive/reuse priorfrozenoriginalpaths: max4simultaneouscontainers/1internalnetwork/4GiBconfiguredmemory/nohostports/noimagepull; PG1GiB/pooler2GiB/PRE512MiB/ROLES512MiB; originaltemporarysynthetic /connectionRO and /proofRW binds only. No production mounts. Choose finite body/termination budget no greater prior2400+600s and justify boundvs originaltimeouts; firstcaseexpectedshort but nopromise. No originalargv modification. Originalfixturecleanup only, noexternalfallbackdelete; no global/oldcontainerqueries or physicalzero claim withoutproof.
7. Same existingtwo-filebeforeafter/packet/interpreterchecks, allerrorsfailclosed, exactonefinalPASS strictlyno skip/expectedfailure/incomplete. OriginalR1timernotabsolutehardrealtime and cutoffsunknownresources limits preserved. New packet is diagnostic, can'tadmit I/B/V/completion. No I/Brefresh now.
8. Offline stdlib synthetic dummy-only probes: acquire-shaped catch inner exception then outsideexcept newouterfromNone; recover failedsourcefunction/line and internalcode from failurelocal; fromNone nestedcontext; ordinarynoacquireerror; observererror doesn't maskoriginal; cycle/truncation; secretlikecode/message notserialized. Use syntheticexceptionframe acceptedonlysyntheticprobe config, never broadmatchingactualpacket. No originalimport/tests/helper. Reuse R1provedcontrolchecks whereunchanged; testonlynewlogic/minimal countadaptation, don'tredoallclosedstatic campaigns.
9. Freeze exactcommand, Packet/runner/proof/report hashes and minimal textualdiff; report currenttest/source/native unchanged. No executionclaim/output fornewcommand. Show concretefutureapproval wording and resources; execution requiresseparateapproval afterindependentPASS.
## Acceptance Criteria
One minimalreviewable diagnosticpacket capableof capturing the missing failureobject if sameerror recurs, no alteredtest/operationalsemantics, originalfailure retained, strictprivacy, boundedresources/attempt, runtimenotexecuted. PASSprep distinct from testPASS orcauseproved.
## Required Validation
AST/syntax, finitehash/currentbounds, newobserverpure dummy unittest only. No originalmodule/tests/runtime/reader. Independentverifier audits exactdiff+savedpureprobes and anysmallnecessarysyntheticcheck withoutoriginalexecution.
## Parallelism
Onepacketworker thenindependentreview, privatescopes only.
## Escalation
Needoperationalchange/secretreads/newruntime =>stop report. Keepminimal. No speculativeframeworksecurityredesign or repeatedGate. Causeknownonlyafterfutureactualrun ifreproduced.
## Reports
Full but concise CODEX_WORKER.md report commands/rc/hashes/no-runtimecounts/remaininglimits. CODEX_VERIFICATION.md separateaudit. Supervisor controlsPASS/REVISE/UNDETERMINED. Keep oldfailedruntime immutable.

## Supervisor Final Review
RESULT: PASS — diagnostic preparation only; actual test/runtime NOT EXECUTED.
R0 was REVISE for overwritten exception observations. R1 closes that finding with append-only observations, event indices, and sticky invalidity; original outcomes remain intact.
Worker Report: /tmp/session-lock-diagnostic-prep-r1-x1xitrq7/WorkerReport.md
Worker Report SHA256: 79b9a89bdea935ccb4e9e142aecef42d1680d0b472b98f42c3fe60cce54f5bb2
Verification Report: /tmp/session-lock-diagnostic-r1-verify-Abfg8UZD/VerificationReport.md
Verification Report SHA256: 50155eed68af2f8066a638718fe8d7f516ced896689606ba68f221ea89cf8c85
Packet: /tmp/session-lock-diagnostic-prep-r1-x1xitrq7/Packet.json
Packet SHA256: a121c702d2b06420421f08b406fbb7301ce8781b0ed9585b7273aca8356235de
Runner SHA256: ecde6b402b2b3ee0988100661a4b48768ffe47196166212e5a5fab92f2878442
Frozen command SHA256: 09e59703bcd3ec0ef2ce669f36000528fd9b1e44bdb01fd8f59b52f523ed9259
Repository implementation changes: 0. Docker/DB/SQL/production/original-test execution: 0.
Historical runtime cause remains UNDETERMINED. No qualification, I/B refresh, authority, or production permission is granted by this review.
Next action: obtain separate explicit approval for the reviewed one-shot local SESSION001 diagnostic, then delegate execution within its exact budget. Previous run authorization is consumed. Do not execute R0 or reuse previous claims.
