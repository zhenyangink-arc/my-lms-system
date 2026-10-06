# TASK — Topbar assistant learning-data accuracy cross-check

## Identity
TASK ID: ASSISTANT-LEARNING-DATA-CROSSCHECK-01
STATUS: COMPLETED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — read-only source and user-supplied visible evidence; no change to Auth/RLS/schema/contracts.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high, only if data findings become ready for final acceptance; do not rerun live tests.
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: narrow route/context-to-visible-statistics trace, not recovery audit or redesign.

## Objective
Identify where current source obtains the learner statistics claimed by the topbar 学习助手 and exactly where the user can compare authoritative visible values. Review user-supplied page figures if available. Do not confuse source trace with live database accuracy.

## Context
User confirmed topbar guide assistant and manually tested2 benign prompts. Replies described learning/progress overview and navigation guidance, continuity succeeded; user confirmed no automatic navigation. Supervisor accepted limited user-assisted basic chat. Tool browser remains unauthenticated and unaligned with user desktop; do not retry that work. User now says continue. Next bounded question is data accuracy, not new deployment. Assistant's pasted first answer claimed smart-textbook5 completed nodes,100percent completion,recent Korean preliminary lesson,4 assessments/38of40 correct/95percent,no pending tasks. These are CLAIMS, not proven facts. User has been asked for corresponding visible homepage card figures, without opening courses or starting assessments. Do not collect credentials.

## Scope
WRITABLE SCOPE: new private /tmp/assistant-learning-data-crosscheck-* report only (0700 dir/0600 files). Supervisor owns this Task metadata. No application/repository/document changes by worker.
READABLE DEPENDENCIES: AGENTS.md,CODEX_WORKER.md,thisTask; existing /tmp/assistant-acceptance-route-map-uv6o2t2r/WorkerReport.md; narrowly relevant src/app/api/agent-chat/route.ts, guide-agent runtime context construction, portal statistic components and their query/helpers. Follow only necessary data-source chain, not full UI or backend inventory. Use rg.
FORBIDDEN: browser/network/DB/SQL/private credentials/env/profile/cookies/live release or process reads; model/Agent calls; tests/build/app runtime imports; operational/source/schema/fixture/authority changes; old recovery diagnostics; unrelated student data. Preserve other work.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO. Current source trace does not establish deployed source parity or live values.

## Data / Security Impact
Read-only source. User voluntarily supplies their own visible page figures. No database/tool access or intentional learning progress changes. No raw user learning-data dump in public repo Task/report; private evidence may include the already provided limited synthetic acceptance figures.

## Requirements
1. Reuse prior route mapping: guide topbar calls /api/agent-chat, not /api/teaching-agent/runs. Do not repeat discovery.
2. Trace exactly where each claimed statistic derives: completed smart-textbooknodes/completion percent; recentlesson; assessmentcount/correct/total/accuracy; pendingtasks. Identify real query vs computed field vs static/profile text vs model-inferred/unmodelled. Cite exact source file lines. Mark unknowns, do not assume answer factual.
3. Identify existing visible homepage/apphome cards/pages permitting user read-only comparison, with exact Chinese label and route pattern supported bysource. Avoid course lesson navigation because interactions can writeprogress. If UI doesn't expose a field, say so; no invented button instructions.
4. Identify grade/attemptcount/grain caveats necessary for comparison; e.g. latest vs aggregate, smarttextbooknodes vs wholecoursecompletion. Do not call a difference a defect before matching domains.
5. Briefly report cross-tenant/currentuser filters present in narrowqueries as static evidence only; do not claim securityvalidated or read actualstudent rows. No new security research.
6. Send early concise findings useful for guiding user; finalize concise WorkerReport plus source references and limits. If user figures absent, static mapping canfinish; actualnumericaccuracy stays NOT_VALIDATED.
7. No runtime retry, no second independent chatpromptset. Remaining original budget1 is not used by thisTask.

## Out of Scope
Full security/deployment/recovery qualification; matching checkouttoinstalledruntime; fixing problems; fullRepositorytests.

## Acceptance Criteria
Concrete source-to-statistic map and safe visible comparison instructions, or exact evidence gap. Actual data PASS only if same-grain authoritative user-visible evidence supplied, labeled user-assisted not independent DB proof.

## Required Validation
Static trace only. Browser/test/build/DB all NOT_REQUIRED and forbidden in thisTask.

## Risk Focus
Model fabricated metrics; static fixturetext vs live records; aggregate denominator confusion; wrongassistant; unnecessary serverdesktop troubleshooting.

## Parallelism
Independent of user supplying visiblefigures; only thisworker uses/source reads, no concurrentbrowser.

## Escalation Rule
If exact data proof requires auth/DB, report gap only; never silently expandaccess. If sourcebugsuspected, record minimal future scope, do notfix.

## Worker Report
CODEX_WORKER.md concise fullreport with sourceevidence and conclusion separated from unknown livefacts.

## Verification Report
Limited to final evidence, no duplicated UI/DB execution.

## Read-only score/history list continuation — 2026-10-03
Actualwindowcapture nowconfirms authenticatedlearningapp PUFFY成长首页, displaynamechen, 二级会员学生; user independently assertedchen001 account. Screenshotshows leftnavigation 我的成绩 and 学习记录. Visiblehomepagefigures (weekly0/5learningdays, recent7days0minutes, total2026=3.7hours) differ in grain from guide's reportedsmartnodes/assessmentaggregate; not mismatchproof. ActualURL andaccountloginID stillnotseen, do notinvent.
Userexplicitrequest operatesChrome directly covers ordinaryreadonlynavigation of these existing two listviews. Supervisor allows up to2 leftnavclicks total: first 我的成绩, inspectvisiblelist; then 学习记录 after freshwindowpictureconfirmscurrentcoordinates. No course/assessment-start/attempt/continue/submit/complete links, no furtherbuttons/filters/scroll needed; no dialogs/logininputs/deletion/settings. Eachview oneprivatewindow-onlyscreenshot (max2additionalcaptures), focusonlyownedexistingwindow. If page suggests mutation orambiguous targetstop. Existing installedGUIautomation library orstandardctypesX11/XTest mayissue exactcheckedclick throughcurrentauthorizeddisplay:11; helper private/tmp, noinstallation/newports/processkill/browserlaunch/configchanges. Use only actualcurrent screenshotcoordinate+windowgeometry; don't blindclick afterunexpectedlayout.
Source mapworker may read narrow score/history page components and immediate loaders first toconfirm these are read-only listnavigation rather than invokingwrites. Send route/label andknownquerygrain tobrowserworker; no DBsourcequery. Actual normalUI mayperformregular session bookkeeping; report no deliberatebusinessmutation, not allserverwrites0.
No newchat/modelprompts. NumericPASS requires samegrain evidence; absentaggregate ordifferentgrain remains NOT_VALIDATED. No morefollow-upsceneexpansion underthis boundedcontinuation.


## Supervisor scoped closure — 2026-10-03

Disposition: PASS for the bounded observation and source-mapping reports. Live learning-statistic accuracy remains UNDETERMINED / NOT VALIDATED; full assistant acceptance is incomplete. COMPLETED below denotes this finite diagnostic/report task, not verified learner numbers or complete browser E2E.

Supervisor reviewed actual Worker Reports and independent Verification Report. Existing server Chrome was successfully inspected through its normal X11 session. The original automation browser is a different window; do not ask the user to repeat login or redo endpoint discovery. The visible display name was chen; exact login ID chen001 is user-reported, not independently displayed.

Two saved views establish the growth homepage and the teacher-homework category of 我的成绩. Their learning-day/time and homework metrics have different scopes from the assistant's tracked textbook-node and chapter-test aggregates. The visible page explicitly directs chapter tests to their chapter. These views neither prove nor disprove the assistant's numeric claims. Same-grain authoritative node, chapter-attempt and pending-assignment evidence is still missing; source-to-deployed parity is also unverified.

One grades navigation and capture succeeded. The later 学习记录 action request was interrupted at the tool layer after Supervisor interruption, with no completed execution receipt or screenshot. Its execution/click state is UNKNOWN; do not label it a website failure, count two verified clicks, or claim no possible normal UI side effects. Worker was stopped and did not retry. No more GUI action is scheduled in this finite task. User browser was not deliberately closed; final page after the interrupted request is unverified.

No application/source/service changes, credentials retrieval, direct DB query, test suite, or additional chat prompts were performed by this task. Normal UI bookkeeping is not observable. Prior user-assisted two-prompt basic-chat PASS remains a separate result. Next unresolved acceptance item is same-grain learning-data accuracy, not recovery work or another login exercise.

Evidence (private local files):
- /tmp/assistant-learning-data-crosscheck-z16cbm2l/WorkerReport.md — SHA256 49ba9835cca3c6797bfc6e2b2a298be0b4af3fd0dbeb52df783799d2b5212cbb
- /tmp/assistant-browser-connection-20261003/WorkerReport.md — SHA256 47fe8fcaa638ccd4aff8b8a3c480e8060424d9aba6fea54531dd3b4cffa361a3
- /tmp/assistant-browser-connection-20261003/ListObservationReport.md — SHA256 20635045ccafca10172763edd4cb256b402d3b205dbb880a77e9db275776068c
- /tmp/assistant-data-crosscheck-review-ljn74wm9/VerificationReport.md — SHA256 8de1490fe15b45a220b7750bcc962faa05a0ff2d7d7ea52d7092bd7b2e79f23b

Process note: verifier dispatch visibility was emitted immediately after creation instead of before; Supervisor acknowledged the ordering error. This does not alter the evidence conclusions; do not report perfect dispatch compliance.
