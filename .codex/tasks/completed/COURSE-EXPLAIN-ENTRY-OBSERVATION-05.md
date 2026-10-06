# TASK — 韩语1级课程 Explain 现有页面观察

## Identity
TASK ID: COURSE-EXPLAIN-ENTRY-OBSERVATION-05
TITLE: Observe existing course teaching UI without starting Explain
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED (observation only)
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
MODEL ROUTING REASON: Fixed browser DOM projection using existing user-authorized Chrome; no implementation decisions.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User selected 韩语1级 as the scope and previously logged chen001 into the server desktop Chrome; user said continue acceptance. Identify whether an already open relevant page exposes the specific course Explain entry, distinct from generic 金老师 persona and accepted topbar assistant. Task04 static evidence says deployed disk code contains Explain but does not establish current effective configuration. Do not repeat file/config/process probes.

## Scope
WRITABLE SCOPE: new private /tmp/course-explain-entry-* directory0700/evidence/report0600; Supervisor Task metadata.
READABLE DEPENDENCIES: AGENTS.md,CODEX_WORKER.md,this Task, saved Task04 WorkerReport /tmp/course-explain-config-source-l2m5do3_/WorkerReport.md and StaticEvidence.json. Existing Chrome through current chrome_devtools tools only.
Allowed: one list_pages discovery and selection (no bring-to-front needed) of existing page whose origin is https://kmgwak-system-product-name.taila18cd5.ts.net:8443. Reduce discovery output to matching count, page ID and safe pathname; discard unrelated tabs/querystrings/fragments. One pure DOM evaluate projection in selected matching page: pathname without query/hash, document readyState, relevant heading/lesson title if nonsensitive, boolean visible chen001 indication (not identity attestation), login-form presence, specific section counts for 课文讲解/교재 설명 and button-name prefixes 解释这句话/이 문장 설명, generic 金老师 presence separately. Relevant course-navigation link presence/href may be reported only same-origin known Korean courses paths, no query/hash or arbitrary user data. No app object/window state inspection. Only DOM; no network calls, fetching, cookies/storage/token/React internals/form values/readouts of unrelated chat or data.
FORBIDDEN: navigate/reload/newtab/close/click/scroll/type/focus causing app action; snapshots dumping all text; screenshot unless separately scoped; reading cookies/credentials/env/config/process; API/DB/model/Run calls; source/test/config changes; browser connection/restart/reconfiguration; installing tools. Do not disconnect/replace current browser. No repeated connection attempts or diagnostic loops on tool failure.
If multiple matching tabs, prefer existing pathname indicating Korean lesson; if ambiguous output safe list and stop before choosing. If no intended lesson page exists, report actual safe state and minimal navigation required, not liveOFF or denied. Do not silently navigate: known host page can record learning time/activity and busy Explain unmount may cancel. Any such navigation must be separately resolved by Supervisor under user's authorization.

## Contracts / Data Impact
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE/AUTH/RLS IMPACT: NONE from requested DOM read; background page actions unobservable, don't claim global0.
Specific integration visible is evidence for that render's identity/course admission, not current reauthorization/full allowlist dump or provider success. Missing entry inconclusive; generic persona isn't Explain. No formal tenant/student UUID is required to observe an existing permitted UI, but don't claim unmeasured identity.

## Requirements / Acceptance
1. Use actual existing tools/browser, no replacement tests/mock.
2. Read-only discovery+projection, save redacted exact returned result and actualtoolerrors safely; no raw secret error/header/session output.
3. Existing matched page/identity/lesson/entry conclusions stay bounded; page freshness from an existing DOM is NOT_VALIDATED unless independently available without actions.
4. Stop on missing connection/no target/ambiguous tabs; report minimal next needed user/runtime action. Do not poll indefinitely. Root may interrupt if tool yields without output; don't label interruption website failure.
5. Full WorkerReport, receipt hashes, calls actually used and prohibited action counts0; elapsed times if observable.

## Required Validation
Static reducer review and independent saved-result verification. Tests/build/DB/Provider NOT_REQUIRED and not run.

## Parallelism
May run alongside Task04 saved-only verification: separate files, no shared mutation, UI predicate frozen in delivered report. No other browser Worker concurrently.

## Escalation Rule
Need navigation/app actions/connection workaround or broader data -> report exact scope, do not self-expand. No hidden child shell approval waiting.

## Worker / Verification Reports
Follow CODEX_WORKER.md and CODEX_VERIFICATION.md. Saved-only independent verification, no duplicate live browser check.


## Supervisor Saved-Dependency Addendum — 2026-10-05
After the one list_pages discovery returned two tabs and zero matching intended origin, Supervisor additionally allowed saved-only reading of completed ASSISTANT-SESSION-NAVIGATION-CHECK-06.md and its explicitly referenced saved WorkerReport. Purpose: recover the already-proved server-desktop Chrome association/method, not force login/navigation in an unrelated tool browser. No extra live action granted. Known historical desktop association DISPLAY11/window0x02e00004 is a starting reference only, not current proof. Worker must preserve redacted discovery receipt and report any needed OS-window observation as concrete SCOPE_CHANGE_REQUEST. No screenshot or browser reconfiguration is automatically authorized by this addendum.


## Supervisor Scope Resolution — Passive Existing Window Capture
The user's standing request to inspect the actual existing server Chrome and latest continuation for Korean1 authorize ordinary passive observation. Supervisor accepts the Worker scope request for exactly one passive guarded known-window capture, without asking the user to repeat login or opening an unrelated browser. This is not permission to invoke Explain or navigate.
Read the saved targeted screenshot helper explicitly referenced by prior Task06 report; prepare a new private helper using its existing no-focus pattern. The only target is DISPLAY:11/window0x02e00004. Before capture require exact active-window match and known platform title/Chrome identity; stop if absent, wrong or ambiguous. No broad window enumeration/title dump. Capture this window only into new private directory0700/file0600; no desktop-wide capture, focus/scroll/mouse/key events, X properties mutation, browser/debug reconfiguration, navigation, refresh, auth/clipboard/storage/credentials or network/DB/model request. Root executes the reviewed helper once with normal tool escalation; Worker prepares but does not execute a child live capture. No retries upon guard failure.
Observe only visible course/learner/login/page status and specific Explain entry; absence offscreen proves nothing. Screenshots are private; do not print raw learner excerpts or unrelated personal information. Record safe guard/capture timings and command results, image/receipt SHA, actual current host if visually established, no global background-zero-write claim. Root/Worker/Verifier may view the saved target image; no independent recapture. Preserve initial MCP receipt and distinct no-matching-tab conclusion.
This changes only Task05's previous screenshot prohibition for this exact passive method. All other forbidden actions remain. No source/config/deployment change. Stop after the capture/result; any navigation must be explicitly scoped with known course tracking effects. The user already chose Korean1; choose no lesson by guess.


## User-Ready Follow-up Observation — 2026-10-05
The preceding attempt is finished and remains NOT_VALIDATED: Root helper exit0 but initial_active_target=false, captures0, receiptSHA9d70165a60b8d6c34e548f040aced3fe50df9d12ae286674cd6629f866082bf7. The user then explicitly answered 已打开课程并保持前台 to the request to activate existing server Chrome and open a Korean1 lesson without clicking Explain. This is a changed user-prepared state, not a retry that erases the earlier guard failure.
Supervisor authorizes exactly one new passive observation with separate immutable helper/receipt/image filenames. Still DISPLAY:11, no input/focus/nav/refresh/scroll/model. Bind only the current _NET_ACTIVE_WINDOW reported by the user, require nonzero valid window plus the known platform title and Chrome WM_CLASS, and require that same bound window remain active immediately before/after capture. Historical0x02e00004 is comparison metadata, not a hard identity assumption for a newly user-prepared window. No window enumeration or title dump. A current identifier alone does not prove host/account: interpret only the saved target image to confirm visible site/lesson/login markers, and stop if inconsistent or ambiguous. No positive absence claim for offscreen UI. One guarded window-only screenshot, no retry on failure. Root reviews prepared helper and executes once through ordinary GUI permission; Worker and Verifier inspect saved evidence only. All previous receipts/reports are preserved. The earlier no-retry condition still applies to the finished original attempt and to this separate one-shot observation.


## Authoritative Own-Desktop Association / Revised Window Method
Task06 Root observation2026-10-05T05:21:36.233244+00:00 now positively binds UID1001 sessionc2 to active remote x11 xrdp-sesman Display:11. Receipt /tmp/course-explain-desktop-elw6f4yl/receipt.json SHAef6c901ecbd483e8df671a3805d312249781894097cd752709ddc1afd37ba7db. This resolves display ownership, not browser/lesson identity. User explicitly states course open in remote desktopChrome. Earlier active-window assumptions failed and remain unmodified evidence.
Supervisor permits a distinct bounded window-identity diagnostic and direct target capture on this own-user display only; no blind rerun of either old helper. Prepare before execute: inspect available existing screenshot binary paths/help/man only, and syntax/pure tests. Root executes once after review.
Allowed X11 read-only operations: root client-list property if available, otherwise root direct children through XQueryTree; cap candidates100. Read WM_CLASS only to filter Chrome (do not output unrelated classes); only Chrome candidates may have title read for known platform-title match (do not output unmatched titles). Record matching platformChrome windowIDs and viewable status/geometry booleans or dimensions; no unrelated window identifiers/titles. If zero/multiple matching viewable platformChrome windows, stop with metadata only. No recursive arbitrary treewalk (at most fixed Chrome client parent/child levels if documented necessary before Root review). No focus/input/propertywrites.
For exactly one matched viewable platformChrome target, a separately selected exact-window-ID screenshot using an already installed tool is allowed; must truly capture that ID without depending on activewindow or taking entire desktop. Recheck same identity/viewability around capture; no retries and no scene alterations. Before/after identity checks do not create atomic guarantee, retain race limitation. Do not fall back to fullscreen screenshot or package install. Worker must submit exact helper/toolmethod for Rootreview before actual read/capture. If available tools cannot capture exactwindowID safely, report method gap instead of patching browser/session.
New private helper/receipt/image names; all earlier artifacts immutable. Only new fact is one authoritative own-session association and this corrected window-identification method, not website health. User wanted existingChrome inspection; this bounded read is within that request. Actual targetimage may be privately viewed for course/lesson/Explain entry only. No credentials, other app data, browserstorage, API/model calls, navigation or course learning action. This scope supersedes prior no-enumeration rule only for capped own-session top-level Chrome-class filtering described here. It does not permit general window/process/system inventory.


## Actual Saved Course View / Exact Visible Entry Trace
Root exact-ID capture at2026-10-05T05:28:33.435686+00:00 succeeded once:5rootclient candidates,1viewable matching platformChrome0x2e00004,1920x1053; capture/conversionexit0; no input/focus/navigation. Image /tmp/course-explain-entry-0tcz92ck/own-window.png SHAc86cd092679526b14ba78c651a92b3998d3dbb3cb865bc3937053a94ab271d67. This successful distinct method preserves two earlier0capture attempts. Image shows intendedHTTPS host and Korean lesson heading 제1장 · 안녕하세요?1/8 with top-left UPLY 한국어 김 선생님 button. No chen001 account label visible, so identity remains user-provided, not screenshot-attested. Specific课文讲解/解释这句话 labels are not visible within capturedviewport; no absence/disabled claim. Exact URL query/chapter observed privately but need not print it broadly.
Supervisor allows static repository-only trace of this EXACT visible header button label/component/click handler/import dependencies to identify its actual assistant path and whether merely opening panel triggers API/Run/provider/mutation or only later sending does. Grep known label/translation keys under src and read directly referenced components. No runtime or config read, no another source-wide allowlist re-audit. Distinguish generic course persona/teacher button from narrow selected-sentence Explain based on code, without assuming they are the same. Separate private static report only; no source changes. This trace is independent of saved image reporting and may run parallel with it, different output files. No click is authorized by this static extension; submit concrete interaction and side-effect findings first.

## Supervisor final review — 2026-10-05
STATUS: COMPLETED
DECISION: PASS for visible intended-host Korean1 course/teacher entry and static click map only.
Worker report: /tmp/course-explain-entry-0tcz92ck/SavedCourseObservationReport.md SHA256 70e2e6a66fc67e35de2edc41f7571f8e9642f54571a6666c067e20b34e7870c3.
Static button Worker report: /tmp/course-teacher-button-trace-pf5moa6m/WorkerReport.md SHA256 330ae9c1364ed2560a94416a1458346d7d30c009ba430d777cae3527a3b92a72.
Independent verification: /tmp/course-explain-entry-verification-final-uf8m4ar3/VerificationReport.md SHA256 6c077367b1c456fd5a535e9ebf3cd7b934517498dbf8f9eb5404b9d315a5d768.
Actual capture receipt: /tmp/course-explain-entry-0tcz92ck/own-window-receipt.json SHA256 2cf64e72249dfbafa15f2ab5b7d46501b1c26bd13a1f076d13b64f0ff4407394. Image SHA256 c86cd092679526b14ba78c651a92b3998d3dbb3cb865bc3937053a94ab271d67. One exact-ID capture; no click under Task05. Earlier zero-origin MCP discovery and two zero-capture attempts remain preserved, not rewritten as success.
Direct result: loaded chapter1 lesson and UPLY Korean teacher header button visible. chen001 remains user-reported, not visible-account proof. Actual generic teacher panel differs from narrow selected-sentence Explain; previous four-key configuration finding is not a blocker for this button. Interaction proceeds only under Task07. Conversation/provider and narrow Explain NOT VALIDATED. No source/config changes.
