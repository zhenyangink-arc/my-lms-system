# TASK — 顶部学习助手单次课程中心导航验收

## Identity
TASK ID: ASSISTANT-GUIDE-NAVIGATION-CHECK-05
STATUS: BLOCKED

## Routing
IMPLEMENTATION PROFILE: worker_medium | GPT-6.1 Sol medium
ARCHITECT GATE: NOT_REQUIRED — existing ordinary UI only, no contract changes.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: Bounded existing-window UI observation, one known prompt and one known safe list target; no implementation or architecture design.

## Objective
Observe whether the topbar 学习助手 actually opens the current learner's course center after one ordinary UI request. Reuse accepted basic-chat/current-statistics evidence without repeating it.

## Context
User requested assistant acceptance, confirmed topbar assistant, logged chen001 into the server desktop Chrome, authorized direct browser operation, and now says 继续 after current-statistics completion. Supervisor determines this continues normal UI acceptance and authorizes one bounded navigation prompt. This is not reuse of the completed CHECK-04 read-only server-data authorization.
State-restoration WorkerReport: /tmp/assistant-acceptance-resume-gxwqnf4k/WorkerReport.md
SHA256: 65ec274eb69ef8353b9d2871df341d1f43c3d9b356eb4698466abe26a22ab011
Already accepted: two user-operated chat examples; current 5 completed nodes/100%, 4 assessments38/40/95%, pending0. No repeat.

## Scope
WRITABLE SCOPE: Worker new private /tmp/assistant-guide-navigation-* directory0700/files0600 for temporary GUI helper/sanitized screenshots/report. Supervisor Task metadata only.
READABLE DEPENDENCIES: AGENTS.md; CODEX_WORKER.md; this Task; bound report and directly cited existing desktop/browser helper/report if necessary. Ordinary visible current user interface only; no secret/config/profile/session-token access.
FORBIDDEN: source/test/config/schema/RLS/authority changes, old recovery tasks, direct backend/database/auth/model API calls, browser cookie/localStorage/sessionStorage extraction, broad process/tab/profile discovery, fresh login, app service restart/deploy/install, new browser/debug-port/profile, tests/build, course/lesson/assessment activity, assignments page/RPC, favorites/start/submit/completion controls, other account/tenant, retries/additional prompts. Do not operate the known unrelated retained Docker container.

## Contracts
MAY CHANGE PUBLIC CONTRACT: NO.
Known actual Chrome: DISPLAY :11, historical window0x02e00004, title PUFFY; confirm with one targeted current screenshot before interacting. Do not use unrelated unauthenticated MCP Chrome or restart discovery. Target platform https://kmgwak-system-product-name.taila18cd5.ts.net:8443, current learner chen001 (visible display name chen), tenant yuanzhi.
One exact prompt: 打开课程中心
One allowed final target: /yuanzhi/apps/korean/courses
Read-only source audit found this course-list initial Korean load uses SELECTs and no progress/attempt/grade writes. Chat itself may persist messages and use configured model; never call this entire task mutation-free/model-free. Ordinary access/auth/session logs are not measured.

## Data / Security Impact
DATABASE IMPACT: Ordinary chat session/message persistence and normal page reads only, no deliberate learning-record writes.
AUTH / RLS IMPACT: NO changes.
SECURITY IMPACT: Bounded own-account UI; private screenshot minimization.

## Requirements
1. One targeted confirmation of existing window/platform/visible learner. If unavailable, wrong user, login screen or tool control fails, stop with exact blocker; no alternate browser/login/detection loop.
2. Use existing topbar 学习助手. If a confirmation or page state is ambiguous, stop; do not blindly click coordinates without fresh screenshot.
3. Submit the exact prompt once. No second submission/retry/refresh, no parallel GUI or data operation. Bounded observation up to90 seconds; record actual timestamps, response text, address and loaded page heading/list only.
4. Do not manually navigate to or click the course-center sidebar to manufacture assistant navigation success. Only assistant-triggered transition counts.
5. Capture safe before/after UI evidence. Keep any raw permitted current-account screenshot private; do not inspect tokens, network auth headers or unrelated history. No clipboard secret access. Read address through visible UI or safe bounded existing helper without console scripts/session extraction.
6. Normal sandbox escalation if GUI helper needs it; do not route around denial. Stop if screenshot/UI action fails, record tool failure without inventing app failure.
7. Prompt cap1. Model/provider call count NOT_OBSERVABLE unless direct non-sensitive visible evidence; do not equate one submitted message with one provider call. Report chat/request counters honestly.
8. No follow-up experiment after success or failure. Freeze report/screenshot hashes for independent saved-evidence review.

## Out of Scope
All broader assistant security/role-isolation/error testing, alternate course paths, fixes, new prompts and statistics rechecks.

## Acceptance Criteria
PASS for this single navigation example requires actual correct assistant response/action, automatic final expected URL, and visible loaded course-center page. Correct text without navigation is text-only outcome; navigation NOT VALIDATED, no automatic conclusion of global bug. Unexpected target or error is reported as observed discrepancy. Existing accepted checks remain unchanged.

## Required Validation
TYPECHECK / LINT / UNIT / INTEGRATION: NOT_REQUIRED — no application changes.
E2E / BROWSER: exactly the one scenario above.
Independent verifier reads saved report/screenshots and source cited only as needed, no second browser/model request. Supervisor reports PASS / REVISE / BLOCKED / UNDETERMINED with scope.

## Risk Focus
Wrong Chrome/user, false automated-navigation claims, unsupported runtime rule vs source seed, accidental learning mutations, unnecessary extra prompts.

## Parallelism
CAN RUN IN PARALLEL: NO — one existing mutable desktop/window.

## Escalation Rule
Missing safe current window/control or wider data/write/implementation need => stop and report, no scope expansion. One blocked tool is not a reason to try alternate wrappers.

## Worker Report
Follow CODEX_WORKER.md. Include exact actual UI result, prompt count, timestamps, screenshot/report SHA, private artifacts, no code changes, precise limitations.

## Verification Report
Follow CODEX_VERIFICATION.md. Review saved evidence only; distinguish direct UI proof from source expectations and user-operated prior cases.


## Supervisor Final Review — 2026-10-04
SUPERVISOR DECISION: UNDETERMINED for positive automatic navigation; saved-evidence/procedure PASS.
This finite one-prompt observation is finished. No retry or further browser action remains running. The unresolved navigation objective stays BLOCKED pending an independently scoped authentication/session diagnosis.

Actual prompt: 打开课程中心, submitted exactly once at UTC2026-10-04T06:36:38.010972 (Korea15:36:38).
Actual visible result: 请先登录后再使用导航助手。
After screenshot around UTC06:36:43 still shows /yuanzhi/apps/korean/records and the chen page shell; no automatic course-center page/list was observed. Manual course navigation0, prompt retries0, screenshots4. Provider/model/backend-write counts NOT_OBSERVABLE; do not infer them from the displayed error. No implementation/test/config/Auth/RLS changes or deliberate learning-record writes were requested.
The pending GUI call ultimately completed normally through its original unified-exec session; it was not an approval rejection. The temporary tool-state pause was lifted only after original completion and screenshot review, with prompt count still0. Subsequent single submission completed; no pending session remains. No alternate wrapper/reexecution manufactured a PASS.

Static attribution: current checkout src/app/api/agent-chat/route.ts:102–104 returns this exact message in unauthenticated401 branch. Adjacent403 has a different message. This is source correspondence, not captured live HTTP status or evidence of definite token expiration, Auth defect or deployed-source parity. Rendered chen shell is not evidence that this later API request had valid authentication.
Previously accepted two manual chat cases and CHECK-04 current statistics PASS remain unchanged and were not rerun. No global assistant/site failure is concluded.

Bound evidence:
- /tmp/assistant-guide-navigation-kfa3ati9/WorkerReport.md
  SHA256 b25f98a6e377301af34e33e2872afb062441017405540a0622ee32e2cbf9c474
- /tmp/assistant-guide-navigation-kfa3ati9/FinalArtifactState.json
  SHA256 785422776a54ff4811e4e4c6668e77f92497c343c608fd23aeca41b2e7c3a490
- /tmp/assistant-guide-navigation-kfa3ati9/after-window.png
  SHA256 7652c02fc323c044c23dcbfabf349e48ff1114398fac5b4c73b78bbb14449bd6
- /tmp/assistant-guide-navigation-verification-31nncdux/VerificationReport.md
  SHA256 2799c4aaf97777613774b3cda2ee366d58d94ca78e815de6dfaeec57e105da11
Supervisor read actual Worker/Verification Reports and sampled open/after screenshots. Private screenshots/receipts remain0700/0600; no raw authentication material read or persisted.

Next minimum task: a narrow authentication/session discrepancy review of already existing sanitized evidence for the original request and serving revision, if available. Do not read cookies/tokens/credentials, repeat statistics, automatically resend the prompt or change Auth logic. If existing evidence cannot establish session state, define one appropriate normal-UI session check before any later navigation example. No code-fix scope is established by this observation alone.


## Supervisor Administrative Closeout — 2026-10-04
ARCHIVE_STATUS: CLOSED_WITH_LINKED_FOLLOWUP
SUPERVISOR REVIEW: PASS for administrative closeout only; all earlier execution verdicts and evidence bindings remain unchanged.
Original-prefix SHA256: 1f5cde8feec0363cbe77929bee60d245ac865643bd061b267284d6966240c3f3

本例实际提示“请先登录后再使用导航助手。”且未到达课程列表的历史结果不变，根因仍未知。用户重新登录后的独立单例在 ASSISTANT-SESSION-NAVIGATION-CHECK-06.md 自动到正确已加载课程列表并 PASS。后例不抹去本例错误或证明历史 Auth 根因；不存在自动重试或已立项 Auth 修复。

后续证据均位于本目录 completed Task04/06。当前顶部学习助手有限验收无必要剩余运行；保留所有 NOT VALIDATED 限界，不切换至单句 Explain 或历史恢复/authority 项目。
