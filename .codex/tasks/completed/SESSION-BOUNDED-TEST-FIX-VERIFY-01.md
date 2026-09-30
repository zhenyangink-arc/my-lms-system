# TASK — Independent verification of bounded test-only corrections
## Identity
TASK ID: SESSION-BOUNDED-TEST-FIX-VERIFY-01
STATUS: COMPLETED
## Routing
VERIFICATION PROFILE: verifier (GPT-6 Sol high)
ARCHITECT GATE: NOT_REQUIRED; no production/security contract changes permitted
DISPATCH RECORD REQUIRED: YES
## Objective
Review actual single-file implementation delta and pure preparation checks against SESSION-BOUNDED-TEST-FIX-01 including Approved Input Addendum. Independent decision for this fix only, not formalqualification.
## Context
Read AGENTS.md, CODEX_VERIFICATION.md, .codex/tasks/active/SESSION-BOUNDED-TEST-FIX-01.md and WorkerReport supplied at dispatch.
Design verification /tmp/session-bounded-fix-design-verify-ygw3kxnh/VerificationReport.md SHA f02623c65effdbbf54658f56dfcf135953ccc7d50a833475b8a0f71eae472d4d; existing AssertionMap /tmp/session-test-correction-design-r1-_b0_4dl0/AssertionMap.json SHA 2b51037d6942f5e47791ac4ff29d1ba1027f26522ad2849b8a32df4c8c106182.
## Scope
WRITE only new private /tmp/session-bounded-test-fix-verify-*.
READ namedtest/source/baseline/diff/reports/evidence bound byimplementation. Read actualdiff againstworkerbaseline, notblindgitHEAD withunrelatedpreviouschanges. Root .codex taskarchives/metadata are announcedparalleladministrativechanges.
FORBIDDEN repo edits; runtimeDocker/DB/SQL/network/production/credentials/env; full/focusedformaltests; fixture-ownedconstructor; oldI/B/evidence/authority/lock/completion mutations; gitmutation; oldretainedcontainerquery; sensitiveapproval-b2-provisioning.before-initial-ban-workflow.json.
## Required Checks
1. Singleexistingtestfile delta; source17/main10/I/B/contextdoc/history unchanged. TestSHA changes honestly, no currentreceiptacceptanceclaim.
2. keyenvonlyexpressionchanged inOwnedSessionSource,32rawASCII from24CSPRNG192bit syntheticentropy; otherfixture/topology/TLS/seed/order/cleanup same.
3. All30SESSIONmethods retained exactselection and all14assertiongroups; remaining26methods byte/ASTunchanged; helperextraction nosecurityassertiondrop/skip/xfail/catchpass orguardmock.
4. 003 actualuser-suppliedhost/project/user canonicalmatches frozencontract; everypositiveoriginalargvassertion preserved withfakeinputnegative; noDNS/network/production credentials. Sourceguards untouched.
5. 008 PRE/POST True controls +3negativevalues exactACQUISITION_CLIENT_TLS, RolesExporterProof assertions kept, owned3subtests unchanged;016 uses actualbootstrapreceipt while preservesSQL_ASCII;025 policy-onlycontext doesn't pretendproductionidentity, restoresaudit.ctx andpreservesallcounters.
6. Independently review privatepure sanityrunner before executing. May rerun boundedpurechecks innewprivateoutput only if staticnoDocker/DB/network/fixtureownedpath confirmed; originaltestdefinedmocks okay, no operationaldriverpatches. Do not repeat alreadycloseddesign/source-research/diagnostic or915suite. Thesechecks PREPARATION_ONLY, notfreshvalidation.
7. Report allrawchecks/hashes, issues, exactremainingruntime/forwardreceiptgates. Full003pure maynowPASS;008owned NOT_VALIDATED. NoalltestsPASS claim.
## Contracts
PUBLIC CONTRACT CHANGE:NO. SECURITY: testinput/observation correctiononly; frozenproductionisolation/identity/allowlistsunchanged. Sourcecredentialsnotread.
## Acceptance
Implementationpreservescoverage andboundscope, purechecksvalid, no operationalpolicychange, nohiddenfailureorqualificationclaims.
## Parallelism
Read-onlyafterworkerfinishes, noimplementationwritesduringreview.
## Escalation
FAIL/UNDETERMINED with exactfinding to Supervisor; neverfixsource. Noautomaticfullsuite/runtime.
## Report
FullVerificationReport withPASS/FAIL/UNDETERMINED, actualdiff/scope/hashproof, boundedcheckreceipts,counters andremaininglimitations. Supervisor finalreviewseparate.

## Supervisor Final Review
DECISION: PASS — SINGLE_TEST_FILE_PREPARATION_ONLY.
Actualdiff sampled and both reports read. WorkerReport /tmp/session-bounded-test-fix-_22w6fix/WorkerReport.md SHA8beb73873918e73705323f4726577c8f002c10148b444e157f8118bc9753518d.
Independent VerificationReport /tmp/session-bounded-test-fix-verify-gusss0ai/VerificationReport.md SHAb28d9ed7031c2615f38a6a9d717d38f89089e621c96d53369835f69d4be0db50; proofSHAf28f1ed5cff5b25306fb028e0037757119172bd3a260523e45537c860b46b7ba.
Oneapprovedtestfile finalSHA33416171a335aab3b6934a5b410086c48ae161a216f39e1827430b6c3c52ce90; exactdiffSHAa54a2d448388625888e3216699cb94100ef21659325622a5dbf9a21591ae5ddd. 30IDs/14groupsretained; no production/source/securitycontractchanges. UsernonsecretSESSIONidentity gapclosedoffline.
Initialprivate static/audit failures retained; oneauthorizedrevisedpureattempt rc0; verifier204staticchecks rc0 and nofixturetestrerun. Docker/DB/productionoperations0.
Runtime/newseed/008owned/formalqualification remain NOT_VALIDATED. I/Boldtestcontext preserved, noteligible fornewtest. Nextminimumtask: prepare append-only currenttest-context binding and concrete boundedlocalrevalidation scope; nooldreceipt overwrite, build/authority/completionpublication, newruntime orproduction granted bythisclosure.
