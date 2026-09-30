# TASK — Session revalidation state and binding recovery
## Identity
TASK ID: SESSION-REVALIDATION-STATE-01
TITLE: Restore completed fix state and identify minimum next validation binding scope
STATUS: IMPLEMENTING
## Routing
IMPLEMENTATION PROFILE: worker_medium (GPT-6 Sol medium)
VERIFICATION PROFILE: verifier (GPT-6 Sol high) for subsequent concrete preparation packet; state report reviewed by Supervisor
ARCHITECT GATE: NOT_REQUIRED for read-only inventory; public-contract/security changes require Gate later
MODEL ROUTING REASON: Bounded reuse of existing evidence, no new root-cause analysis
DISPATCH RECORD REQUIRED: YES
## Objective
Recover current immutable-source/test/receipt status and exact legal next steps without repeating completed work.
## Context
User requests continue toward local connection revalidation. Completed SESSION-BOUNDED-TEST-FIX-01 and VERIFY passed singlefilepreparationonly. Source/oldI/B remain unchanged; changedtest no longer matches oldContext2. No runtimequalification yet.
## Scope
WRITE: new private /tmp/session-revalidation-state-* only.
READ: AGENTS/CODEX manuals, completed Tasks/report references and named receipt/source/schema/directly referenced forward-design evidence.
FORBIDDEN: repo/source/test/evidence/Task edits; .env/credentials/production; sensitiveapproval-b2-provisioning.before-initial-ban-workflow.json; Dockerincludinginspect/retainedcontainerquery; network/SQL/DB/tests/importfixtures/builds/gitmutation.
## Contracts
PUBLIC CONTRACT CHANGE: NO. Keep oldI/B and histories immutable at this stage. No prior run reuse as newtestvalidation, no rebuild claim. NewuserHost/User is nonsecret offlineidentity only.
## Data / Security Impact
DATABASE:NONE. AUTH/RLS:NO. SECURITY:read-only receipt/admission inventory.
## Requirements
1. Read completedfixTasks and Worker/Verifier reports; bind testSHA33416171a335aab3b6934a5b410086c48ae161a216f39e1827430b6c3c52ce90, WorkerReportSHA8beb73873918e73705323f4726577c8f002c10148b444e157f8118bc9753518d, VerifierSHAb28d9ed7031c2615f38a6a9d717d38f89089e621c96d53369835f69d4be0db50.
2. gitstatus names only and exact minimal source/context/package binding status; preserveallunrelatedchanges.
3. Identify actual fixedreceiptpaths/schema/rawreference rules and directly available prior forward-reference design; avoid redesigning existingwork.
4. Explain possible nextprep with unchangedsource/nativebuild, changedtestContext2, oldreceipts preserved. If append-only cannot satisfycurrentreaders, showexactcheck/source and state contractdecisionneeded rather thaninventlegalpath.
5. Give concrete remainingtasks/dependencies/blockers, safeimmediatework and scope requiringGate/userdecision. No artifactpublication/newruntime.
## Acceptance Criteria
Actualcurrentstate restored with complete finite evidence references and no reopenedclosedwork. Nextscope concrete andhonest.
## Required Validation
Staticread/hash/AST only. No test execution/fixtureimport/runtime.
## Risk Focus
Do not confuse historicalbuildproof withvalidationcontextreceipt; no freshqualificationclaim.
## Parallelism
Read-only, privateoutputs; initialrecoverybeforedependenttasks.
## Escalation Rule
Any source/publiccontract mutation or runtime needed: reportSCOPE_CHANGE_REQUEST only.
## Worker Report
Use CODEX_WORKER fullreport, exactpaths/hashes/counters/readiness. You are notalone; dorevert nothing.
## Verification Report
Supervisor reviews recoveryreport; futureconcretepacket independentlyverified without repeating closedfix.
