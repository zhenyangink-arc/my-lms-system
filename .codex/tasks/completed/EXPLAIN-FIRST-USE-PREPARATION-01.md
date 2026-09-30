# TASK — Explain first-use preparation
## Identity
TASK ID: EXPLAIN-FIRST-USE-PREPARATION-01
TITLE: Freeze one useful assistant scenario, its actual launch prerequisites, and one reviewable acceptance card
STATUS: COMPLETED
## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high (preparation/report only)
ARCHITECT GATE: REQUIRED | architect_gate | GPT-6 Astra xhigh
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high (focused final packet consistency; no duplicate Gate review)
MODEL ROUTING REASON: reuse current product but reconcile release/recovery/authorization dependencies; Gate owns boundary decision, Worker assembles finite packet
DISPATCH RECORD REQUIRED: YES
## Objective
Deliver ONE combined preparatory packet for the original first-delivery scenario: one eligible student selects one sentence from one published Korean lesson, requests Explain, sees source-grounded explanation, and reaches completed or explicit cancelled/failed without advancing lesson progress. Not a newfeature rollout or actual FirstAgentRun.
## Context
User approved re-prioritizing toward useful assistant after maintenance research. Capability inventory /tmp/assistant-capability-inventory-qxh1uhq8/WorkerReport.md SHA484f460023fdcb65ce350afef014b8733d9f9fa0dbc0e07479b0d4ab8c464815.
Dependency inventory /tmp/assistant-launch-dependencies-z1_y47wk/WorkerReport.md SHA1c3ef83823a51d09bc34cad9142b5243987bc342d91ab9b6e08909dcbc4f1dbf and ReportCorrection.md SHAbf2352148f8daaba44f9a0af7deced45c4bde447f1c18985ec17bcea4719c917.
Combined inventory review must be accepted before dispatch. Explain is originalfirstdelivery, not a newproductpreference requiring redundant confirmation. Actual enable/Provider/run still need specific authorization. Current source exists, runtime/deployedbaseline NOT VALIDATED.
## Scope
Writable: Gate only new /tmp/explain-first-use-gate-*; Worker only new /tmp/explain-first-use-preparation-*; verifier only /tmp/explain-first-use-verify-*. Directory0700/files0600; no new operational repo artifact. Supervisor owns this Task metadata.
Readable: relevant current Explain UI/API/runtime and directly cited product/gate docs; saved report evidence. Use finite source paths/hash snapshots if needed; avoid fullmaintenancehistory audit.
Forbidden: source/tests/fixtures/README/schema/authority/approval/lock/completion/history/AGENTS/CODEX/.codex edits by workers; env/credentials/private approvals; DB/SQL/Docker/network/provider/Agent/browser/server/tests/build/import runtime; production/purchases/deploy; new packageprobe/preparation/run; oldcontainer scans/deletion; git mutation/reverts. You are not alone, preserve existingchanges.
## Contracts / Data Impact
Public/runtime contracts unchanged by this preparation. DB/Auth/RLS NONE. No broad “read-only AI” exception: Explain persistsRun and sends Provider data. FirstEnable requires recoverypoint/known-goodartifact and independently approved scope. Technical nondependency on summarydurablefacts does not waive globalrelease/securitygates. C3B migrations retain exactfreshbackup requirements.
## Requirements — serial inside one task
1. Architecture Gate first: inspect only decisive contracts to issue ALLOW/REVISE/BLOCK for a bounded proposed FIRST-USE preparation route. Determine whether an existing approved Explain release/schema/recovery process may be reused, or the fullC3B path is mandatory. Never assume undocumented exemption or absenceofdependency=permission. Gate itself cannot authorize live operation/change historical authority. If currentproduction evidence needed, output exact minimal fields/readscope for a future authorized check and retain UNKNOWN.
2. Gate output freezes: scenario, permitted futureenvironment, source/release closure requirements, schema/artifact compatibility predicates, recovery/stop requirements, providerdataapproval needs, all nonwaivablegates, conditions under whichSESSION maintenance can defer, rejectedshortcutreasons, risk/rollback and recommended executionprofile. Reuse alreadycompletedresearch. No newopen-endeddesignseries.
3. Worker follows Gate in sameTask: write FirstUseAcceptanceCard.md, LaunchGapMatrix.json, WorkerReport.md. Card normalcase plus cancel/denied/stalepin/missingevidence behavior; correct explain-quality and source attribution; completednotfalse; progressunchanged; runaudit and budget/stop explicit. No fakeprovider output described as actualAI success. Exact unknown values remain NOT VALIDATED, never fabricated.
4. Finite gap matrix only: (a) candidateExplain release/importclosure/digest, (b) actualschema/RPC/artifact compatibility, (c) published lesson/sentence/pins and courseeligibility, (d) tenantdefinition/internal user/allowlist/OFF, (e) recoverypoint/known-goodartifact/restoreauthority, (f) Provider-approvedfields/budget, (g) cancellation/stop/drain. Each has currentevidence, hardpasspredicate, minimalverificationaction, whetherneedsproductionread/actionauthorization, accountabletask.
5. Choose ONE next action from findings, not a long branchingresearch programme. If maintenance trulycritical, reuse packageprobe location and prescribe minimum isolatedevidence (no execution here); otherwise don't work onit. If a concreteproductimplementation defectnotproven, no speculativecodechanges. Output likelyexactfiles only when evidence requireschanges, not forcompleteness.
6. Finalreview validates packet consistency/unknowns against Gate; do not repeat all historical tests/sourceaudits. User approval, if needed for futureexecution, comes after concretepacket is reviewable and must identifyactualoperations. CurrentTask remains preparationonly.
## Acceptance Criteria
A practical one-page user-visible acceptance card and finite blocking-prerequisite list, one unambiguous nextaction, gateboundaries preserved, all completedworkreused. No promise of launchsuccess/remainingrounds. Preparationdone is not productionready.
## Required Validation
Static source/doc/hash/report review only. No tests or runtime. Historical207PASS/430PASS3SKIP are scopedhistoricalevidence, not currentqualification.
## Out of Scope
TeacherCopilot, execution-summary publicUI, arbitrary assistanttools, newauth/RLS/schema, formal915, experiments, actualactivation/Provider/Run/production.
## Parallelism
NO between Gate->packetassembly->focusedreview because dependencies. No samefiles concurrentlywritten.
## Escalation
If contractrelaxation/newinfrastructureexception is needed, BLOCK/referexactdecision toSupervisor/user. No implicit scope expansion. If neededstate notobservable offline, prepareboundedreadrequest and stopdependentwork, don't speculateruntimevalues.
## Reports
CODEX_WORKER and CODEX_VERIFICATION formats. Gate eightrequireditems perCODEX_SUPERVISOR. Reports/outputSHA and concise plainChinese explanation of what letsuserdo and whatremains. Supervisor finalPASS/REVISE/BLOCKED/UNDETERMINED.

## Admission from inventory review
Supervisor accepts inventory-only PASS. VerificationReport SHA256 ff3b5da93d1ac75ae579bcb3a7a75fc2ff8667a9050d99b1519b2e8c87c7a8ea sampled this task scope. Ready for preparation dispatch; NOT EXECUTED. Original Agent/Provider/production gates unchanged.

## Execution status
User requested continuation after accepted inventory. Preparation started with architect_gate/GPT-6 Astra xhigh, then worker_high packet assembly and independent focused verifier; serial. No runtime authorized or executed.

## Supervisor final review
RESULT: PASS — preparation packet only. Runtime / production qualification remain NOT VALIDATED and HOLD.
Architecture Gate: /tmp/explain-first-use-gate-B1QE9dvY/GateReport.md
SHA256: 6790252d9fe2131a1e930e064ae996737d4bf93f4efe6ab3d685fdf9691ef25f
Worker Report: /tmp/explain-first-use-preparation-mf7u65_t/WorkerReport.md
SHA256: ee5c024110814a9a64ce4c434b7591423cbaee54bfac3cdc7f062c3314cd3e3e
Verification Report: /tmp/explain-first-use-verify-rqmw8p6x/VerificationReport.md
SHA256: 9ef01c7babf127515ce81fa9b5e6f06e3eaa46aa4eb4f9c3f39a70eeb85a9352
Acceptance Card: /tmp/explain-first-use-preparation-mf7u65_t/FirstUseAcceptanceCard.md
SHA256: e9ed60393b3273d50d72c1b36f7acf8094f0dbe8c83a88cd3d29902cdd51b7ca
Launch Gap Matrix: /tmp/explain-first-use-preparation-mf7u65_t/LaunchGapMatrix.json
SHA256: 43d746e13fbdc2aadf7d14de984e37b1a7b9309d6496f2cf5280916756acbdcd
Read-only qualification preparation: /tmp/explain-first-use-preparation-mf7u65_t/ReadOnlyQualificationRequest.md
SHA256: c7c6eedfa72af1803c7b0d0ebfec6d7a0da40b72a94ee4c78688a768b8f6ffd3

Supervisor read Worker and Verification reports, acceptance card and finite matrix. Independent focused verifier checked all seven bound input hashes, directory/file modes, JSON consistency and 28 finite source bindings; no runtime tests or duplicate historical Gate review. Seven categories a-g remain NOT VALIDATED; historical Explain release reuse is unproven. No source/DB/Auth/RLS/authority contract changed.

Next minimum action: using existing non-secret records, bind the actual target/worker to each bounded read projection, filter, maximum result count and eligible existing entry; then present the concrete single read-only operation for authorization. Current read request NOT RUNNABLE. This request-preparation gap is not the only launch gap: all seven current launch fact categories remain unvalidated. No production probing to fill unknowns, no reading credentials/private approval bodies, no enable/Provider/Agent run. No promise of remaining rounds or launch date.

This archive closes preparation only. No First Enable, Provider-data permission, Agent execution permission, purchase, deployment, SQL, or additional local diagnostic was authorized or executed by this Task. Existing operational package, authority pins and historical evidence remain outside write scope. Supervisor task metadata archival only.
