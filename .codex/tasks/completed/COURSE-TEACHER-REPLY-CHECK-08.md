# TASK — 韩语1级金老师实际讲解回复验收

## Identity
TASK ID: COURSE-TEACHER-REPLY-CHECK-08
TITLE: Resume the existing course teacher once and observe the returned teaching UI
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — ordinary authorized acceptance of existing course UI, no implementation/contract change.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: Bounded existing UI interaction and saved response review; use existing verified desktop method.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User requested actual assistant acceptance, selected Korean1 teacher, logged into chen001 in existing remote-server Chrome, and after panel-only PASS explicitly said continue. Supervisor authorizes next ordinary step under that acceptance request: one Continue learning click in existing course teacher panel; observe returned teaching content and available reply controls. Task07 proved panel opens, not replies. No repeated entry/config investigations.

## Scope
WRITABLE SCOPE: one new private /tmp/course-teacher-reply-* helper/evidence/report directory 0700, files 0600. Supervisor alone writes Task metadata.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md, this Task, completed Task07 and its fixed helper/post image/report, static button trace report and directly relevant existing startTutorLesson/tutorReply/renderTutorPanel source. No other-user data.
Fixed window DISPLAY :11, 0x2e00004, Chrome/title identity, 1920x1053. Baseline /tmp/course-teacher-panel-pk6kqab2/post.png SHA256 23db55141a2b92af960817694289d19490f56e85a39d6ec9d62c1c2c6af3ef11. Existing installed X11/Xtst/xwd/ffmpeg and /usr/bin/python3 Pillow; no installation. Worker prepares only, Root reviews and runs once.
Allowed live action: one pointer move and left click on visible Continue learning (이어서 학습), identified from actual baseline, not Restart. Pre screenshot and exact static addressbar/target-region comparison, title/class/geometry guards. Do not click if guard fails. Capture same window at +2 and +15 seconds after click (three screenshots total including pre), no resubmission. At most one additional passive screenshot by separately reviewed Root direction if saved last frame still loading, within original 60-second response observation window. No other UI input this Task.
Application may perform normal teaching API/session/message/activity persistence, scripted or provider-assisted response, as result of this approved normal UI resume. No direct DB/API calls, credential/config/environment reads, network interception, client internals, permission changes, production recovery/backup, source/test edits, service restart, build/install/git commit/push. Do not claim global zero writes/calls. No Restart, navigation, assessment answer, manual completion, audio/mic click, second Continue or question send. No new browser/login. No Explain feature testing.

## Contracts / Data / Security
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE IMPACT: Existing user-authorized UI may update existing learning session/activity/messages; do not directly query/alter database or reset progress.
AUTH/RLS IMPACT: NO change.
SECURITY IMPACT: LOW for bounded normal UI acceptance; no credential access.

## Requirements
1. Read current source only for Continue side effects and initial-reply expectations. Reuse accepted prior trace. Report if actually destructive/reset semantics are found; otherwise proceed preparation.
2. Prepare simple no-shell one-shot private helper with exclusive receipt, target guards, known window-relative coordinate translation and one click with release, fixed passive captures; no retry/fallback. Root is sole live operator.
3. Record exact bytes hashes, capture timing/rc, one click, any observed response/loading/error; distinguish visible scripted content from proven provider response. Account is user-reported chen001, not independently measured.
4. Final Worker Report plus independent saved-only review. No repeated UI actions by verifier.

## Acceptance Criteria
Actual correct Continue clicked once; visible returned teacher content or exact error captured; appropriate in-course greeting/topic and UI state assessed without manufacturing provider success. PASS only for observable teaching interaction when response displayed and no blocking error. Provider provenance NOT VALIDATED unless directly visible reliable evidence; not inferred from fluency. Loading at deadline is NOT VALIDATED, not automatically outage.

## Required Validation
TYPECHECK/LINT/UNIT/MIGRATION: NOT_REQUIRED (no app changes).
BROWSER: REQUIRED one normal UI interaction; helper AST/compile/pure checks before execution and saved receipt/image review after. No suites or duplicate calls.

## Risk / Parallelism
CAN RUN IN PARALLEL: NO live browser operations; one Root operator. Saved-only verification after implementation evidence. External user/window changes can race, retain limitation.

## Escalation Rule
Guard mismatch: save actual no-click result, stop. Need alternate input/navigation/restart/config: report scope change rather than performing it. No repeating failed live action.

## Reports
Complete Worker Report per CODEX_WORKER.md and independent Verification per CODEX_VERIFICATION.md, private paths/hashes and observed vs unobserved claims. Root decides PASS/REVISE/BLOCKED/UNDETERMINED and archives finite Task.

## Supervisor continuation scope — 2026-10-05
The authorized user request is actual course assistant acceptance; one Continue was now executed successfully by Root under the original scope. Process68108 exit0; pre/+2/+15 captures saved in /tmp/course-teacher-reply-k1q0oubo. Post15 image SHA256 9a6be8e6d2f93542842126d526ace0cb5d166a63faf280f7e5da919a3c0da2f9 directly shows welcome narration plus available question textbox/send. Original helper/receipt/images remain immutable. This proves visible teaching initialization, not targeted question answering or provider identity.
Next bounded normal UI action within the same user acceptance is one benign course-related question: `explain annyeonghaseyo in chinese with one example` (exact lowercase ASCII). No answer submission/assessment, progress reset or quiz action. This application question may use existing model resources and persist a normal message; no new paid service is purchased or configured.
Worker prepares in the same private directory two distinct exclusive one-shot helpers: (1) guard exact window and static addressbar/panel/input regions from actual saved image, focus only the visible empty question textbox and type the exact question using installed X11/Xtst ordinary key events, then capture draft without Enter/send; Root must view the saved draft and confirm exact intended text before (2) a single send-button click and passive +2/+15 captures. Source-derived input/button behavior must be checked briefly. No clipboard read/write, no browser internals/DOM/network access, no IME/reconfiguration, no keymap change, no retries, no alternate question, no extra click to pause/restart/media/navigation. Physical-key mapping must be deterministic for lowercase ASCII and spaces; if the actual draft is not exact or input is unavailable, stop without send. A single draft focus and exact typing are allowed, earlier keyboard=0 statement applies only to completed Continue stage.
Single send only after Root saved-draft review and guard. At most one additional passive +45 second observation if the final send frame is still loading, never resubmit. Whole-window captures are restricted to the same known Chrome window; external user races/background application activity remain unmeasured. Current text field/Send coordinates must be read from saved actual frame, not guessed. Saved reports cover separate stages and budgets; independent verifier must distinguish introductory content from answer relevance and provider provenance. No operational source or configuration change is allowed. Worker prepares only, Root remains sole live operator. This is a scope continuation from successful phase, not a retry of it.

## User steering — 2026-10-05
User asks to verify intended teaching product flow: teacher video explanation, interleaved question, pause until answer then resume; questions whether the observed teacher figure is outdated. Ordinary freeform question acceptance is ON HOLD pending design/implementation review. Initial Continue response succeeded. Draft helper completed guard-only: active_modifier_guard_failed_no_input; captures/clicks/keyevents all0, no question sent. Do not infer exact keyboard condition (raw mask not saved). No retry/draft/send/keyboard diagnostic to execute now. Previous private evidence remains immutable. Next Tasks09/10 read existing design and code; no live application action.

## Supervisor closure — 2026-10-05
WORKFLOW STATUS: CLOSED; archived after review.
DECISION: UNDETERMINED for targeted question/provider acceptance; ARCHIVED_SUPERSEDED by user clarification of video-question workflow. One Continue action showed welcome teaching content. Draft guard stopped before any input; no question sent, no keyboard diagnostic executed. No repeat/resubmission.
Worker report: /tmp/course-teacher-reply-k1q0oubo/FinalWorkerReport.md
Worker SHA256: bf9e306de03db3c61a1b6b3821dd32c881167f9e7be1e069d7883c1903dbbf56
Independent verification: /tmp/course-video-combined-verification-hx1o0qv6/VerificationReport.md
Verification SHA256: ae5946346a4d6a3e77598adb7c0d9ef76a76fae5d879ca0070d3583d2e873eb9
Actual requested video-pause-question-answer-resume acceptance remains NOT VALIDATED. Next scope: identify current Korean1 published media/runtime/cue/activity binding, then accept that actual intended flow. No ordinary floating-panel success may substitute for it. No source/config/test changes or new live actions during Tasks09/10. No recovery/authority work resumed.
