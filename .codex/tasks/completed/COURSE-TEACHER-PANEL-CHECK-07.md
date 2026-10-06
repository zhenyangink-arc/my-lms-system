# TASK — 韩语1级实际金老师面板单次打开检查

## Identity
TASK ID: COURSE-TEACHER-PANEL-CHECK-07
TITLE: Open the actual course teacher panel once, without sending or starting teaching
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — ordinary existing UI use, no source/auth/contract change.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: Fixed one-button GUI operation with saved visual baseline and strict no-send boundary.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User requests actual courseassistant acceptance, selectedKorean1 and confirmed lessonopen in remoteserverChrome. Task05 directly captured intendedsite Korean1chapter1안녕하세요 withtop-left UPLY한국어김선생님 button. This generic existing course teacher uses learning-agent/respond, distinct from narrow selected-sentence Explain. Previous fourkeyExplain checks are not a currentteacher button readiness gate. User's continuation authorizes normal reversible opening of this existing panel; no newmodelprompt, settings change, learningrestart or teachingstart.
Source report /tmp/course-teacher-button-trace-pf5moa6m/WorkerReport.md SHA330ae9c1364ed2560a94416a1458346d7d30c009ba430d777cae3527a3b92a72: opening localReactstate only; sending calls respond; hostpointercapture may conditionally recordlessonactivity. Ordinary activityrecord is in scope for thisoneclick; directDB queries/writes and attempts to change progress/completion are not. Backgroundbehavior/currentdeployedfullsemanticparity unmeasured; no globalzero-write/provider claim from screenshot alone.

## Scope
WRITABLE SCOPE: new private /tmp/course-teacher-panel-* helper/receipts/images/reports0700/0600; Supervisor Task metadata.
READABLE DEPENDENCIES: rules,thisTask,Task05current savedcourse screenshot/report and exactwindowhelper; abovebuttontrace, directlycitedsourceifneeded; Task06verifiedsessionreceipt. ExistinginstalledX11/xwd/ffmpeg/xdotool/Pillow only, noinstall.
Fixed UI target DISPLAY:11,window0x2e00004,platformtitle andgoogle-chromeclass,knowngeometry1920x1053. Baselineimage /tmp/course-explain-entry-0tcz92ck/own-window.png SHAc86cd092679526b14ba78c651a92b3998d3dbb3cb865bc3937053a94ab271d67 showsclosedpanel/coursechapter1. Prepare helper only; Rootreviewthenexecuteonce. Before1clicktakeexactwindow-ID image; compare staticaddressbar andteacherbuttonpixelregions toboundbaseline using existinglocalPillow in memory (no alteredimage output) to avoidclickingunexpectedpage. Requireexactmatch andsamewindowtitle/class/geometry. Coordinate chosenfromactualbaselineheaderbutton, notguess. No coordinateaction ifguardfails.
Allowed UI action: one pointermove relativetoexactwindow to centerofknownteacherbutton andoneleftclick. No windowactivation/focuscommand, keyboard, scroll, navigation, reload, resize or secondclick. Clickmaynaturallyfocuswindow andtrigger normalcourseactivity; explicitlynotclaimnofocus/globallyzerowrites. Waitboundedbriefsettle andcapture sameexactwindowafter viaxwd-ID/localPNGconversion; no poll/retry. Stopafterpostimage whetherpanelappearsornot. Neverclickstart/continue/restart/send/close, submitprompt, selectlesson, startaudio/mic/fullscreen or modifyconfiguration. Do not use wrongMCPbrowser.
Prohibited: credentials/env/config/proc/PM2/database/clientinternals/networkinterception; appsources/tests/build/deploy/permissionschanges; using research shim, anotherbrowser/profile, arbitrarywindows/fullscreen capture; packageinstall. No explicitAPI/modelcalls. Unknown runtime/backgroundcalls NOT_OBSERVABLE. Onlyobservedentry/panelstate accepted, notresponse quality or accountUUIDparity.

## Requirements / Acceptance
1. Worker reads baseline image, preparesone-shot no-shell helper withprivateoutputs andknownwindowguards, checksAST/pureargv/region bounds only. No liveGUI fromWorker; Rootoperator executes.
2. Record pre/postimagehashes,exactregionguard results,oneclickcommandrc/time andcapturerc. Capturemayraceexternaluserchanges; retain limitation, no automaticrepair.
3. Inspect savedpostimage forteacherpanelheader/input/controls/visibleerror/loading; do not infer provideravailability or an unobserved request. Userchen001reported identity notvisiblelabelproofunlessactualshown.
4. Independent saved-only verifier, no duplicateclicks/captures.

## Contracts / Data Impact
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE IMPACT: normal UI activitytracking possible, not directlymeasured; no SQL/backups/migrations.
AUTH/RLS IMPACT: NO changes.

## Validation
Sourcehandlerreview,helperAST/purechecks,singleUIoperation,savedimageindependentreview. Applicationtests/build/DB/E2E suitesNOT_REQUIRED. This is finite UIacceptance only.

## Parallelism
Helperpreparation mayparallelTask05savedverification; onlyRootoneGUIoperator. ExecuteafterRootreview; no other liveGUIworker.

## Escalation
Beforeguardmismatch -> stopwithactualreceipt. Needanotherclick/send/teachingstart/configchange -> reportconcreteaction fornewscope. No retries or fallback. PreservepreviousTask05findings.

## Reports
CODEX_WORKER.md/CODEX_VERIFICATION.md. Privatecomplete reports andhashes; genuinePASSlimitedtopanelonly.

## Supervisor method clarification — 2026-10-05
The installed xdotool executable is unavailable; no live attempt has occurred. Use existing libXtst through ctypes under /usr/bin/python3 (installed Pillow) for the same authorized one pointer move and one left-button press/release. XTranslateCoordinates converts the fixed target-window button center to root coordinates. No install, keyboard, explicit focus/activation, extra click, or semantic scope expansion. Ensure successful press is followed by release in finally. Existing exact-window identity/geometry and baseline pixel guards remain required. This is a preparation method revision, not a runtime retry. Root reviewed helper /tmp/course-teacher-panel-pk6kqab2/open-panel-once.py SHA256 0ae8efb63d2a06b6e760bedbc61ac4b98f917d9fa6c27547df0c8fd917852ed3; approved for one operator execution. External user/window stacking races remain a limitation.

## Supervisor final review — 2026-10-05
STATUS: COMPLETED
DECISION: PASS limited to opening the actual course teacher panel.
Worker report /tmp/course-teacher-panel-pk6kqab2/FinalWorkerReport.md SHA256 4aeee8902d30cbee0d5eaf94b59cd098833c020cdfd28c330dd36563955e152e.
Independent verification /tmp/course-teacher-panel-verification-_icz4tu4/VerificationReport.md SHA256 2e40e78153bb17b44214b9bde62c952c41a33894f661cd18ba1db3666f1affe5.
Receipt /tmp/course-teacher-panel-pk6kqab2/receipt.json SHA256 3a99ea6ccb2d5f8b1caf257bc0929642226cff3e5f8f08af6407ecebefa3e4e0.
Post image /tmp/course-teacher-panel-pk6kqab2/post.png SHA256 23db55141a2b92af960817694289d19490f56e85a39d6ec9d62c1c2c6af3ef11.
Root operator executed the unchanged prepared helper once; process17896 completed exit0. UTC2026-10-05T06:18:19.164507, elapsed1681ms. Preimage fully matched previous course baseline; two captures, one pointer move/left click, no keyboard/scroll/navigation. Postimage directly shows course teacher panel and continue/restart controls, without visible error/loading at capture time. No further live action performed by Worker/Verifier. No source/config changes; no application test suites needed.
Teacher response/provider and formal account identity NOT VALIDATED. User reports chen001; no visible account label in screenshot. Conditional normal lesson activity/background requests remain unmeasured, not claimed zero. No start/resume/restart/question/send occurred in this Task. Next remaining acceptance is a separately scoped actual course teacher interaction and reply observation; do not count panel opening as complete conversation acceptance. No recovery/authority task resumed.
