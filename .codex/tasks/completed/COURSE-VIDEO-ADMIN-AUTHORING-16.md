# TASK — Course video administration authoring

## Identity
TASK ID: COURSE-VIDEO-ADMIN-AUTHORING-16
TITLE: Align teaching-script administration with the selected video pilot
STATUS: COMPLETED — bounded draft authoring/material inspection PASS; production integration pending

## Routing
STATE RECOVERY PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: REQUIRED, /root/course_video_admin_gate | GPT-6 Astra xhigh
IMPLEMENTATION PROFILE: pending Gate, split only with frozen disjoint files
VERIFICATION PROFILE: verifier_critical | GPT-6 Astra xhigh
DISPATCH RECORD REQUIRED: YES
MODEL ROUTING REASON: Versioned authored configuration and owner-only local media stream affect shared contracts/security; actual bounded implementation follows Gate.

## Objective / Context
User: Continue new video teaching mode, with corresponding backend administration. Existing Task14 player consumer code is independently passed; Task15 selected sample01.mp4. Deliver real existing-admin draft video/cue/Activity configuration and safe material preview. Do not claim unpublished draft is student runtime ready. End-user goal remains common video/quiz flow plus old-avatar retirement after publication/session integration.

## Scope
Current stage: Gate writes only its private /tmp report. Root alone owns Task metadata.
Implementation EXACT writable paths and contracts will be appended from accepted Gate before any edit. No implementation authorization by this unfinalized proposal.
READABLE: existing admin actions/studio/NodeForm/videoPicker, direct preview/publish/release dependencies, original atomic publish/save SQL as read-only, Task14/15. Selected media exact path only and stat/hash verification as needed.
FORBIDDEN: credentials/env, liveDB/API/uploads/providers/deploy/commit/push; migrations/Auth/RLS/agent-core; rootconfig/dependencies; Task14 six source/tests, global teaching-video normalization, ordinary student entry, old-avatar assets, unrelated active Tasks or historical evidence. Never overwrite others' work.

## Contracts / Data
MAY CHANGE PUBLIC CONTRACT: YES only Gate-frozen new draft namespace and restricted media preview request; existing contracts preserve.
DATABASE IMPACT: implementation of existing draft save logic only; no database operations/migrations during task.
RLS IMPACT: NO. AUTH IMPACT: reuse existing owner guard only; do not alter it.
Source sample: /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4
SHA256 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe; size5487747; video30s/container30.016s. Selected local asset is not an R2 object or published MediaRef; no invented transcript/cue/answer.

## Requirements
- Real existing-form draft editing and existing atomic save; server validates stored draft, exact CAS and same-module single-choice association.
- Explicit pilot marker/schema; invalid/missing config cannot return to legacy; partial drafts remain visibly incomplete.
- Old full preview blocks BEFORE old shell render for pilot. Old API/publish/release checks also block unsupported pilot until formal server/compiler integration.
- App-level draft publish block does not certify direct SQL RPC enforcement; no database safety claim without future separately gated enforcement.
- Sample material accessible only through approved fixed-alias owner-only local route if Gate allows; no local path in browser, no arbitrary filesystem access, no fabricated R2key.
- Material preview never creates /3 receipt, learning result or second authoritative media controller.
- UI uses existing design, natural language labels, CardTitleWithHint; visible field errors/aria-describedby and focused error summary on failed submit.
- Read installed relevant Next guides before writing routes/actions/components. ui-ux-pro-max applied; focused search guidance already recorded in conversation.

## Validation / Acceptance
Gate will freeze exact tests/limits. Minimum strict schema/policy tests, save input/CAS/association mock integration, local route authorization+range+path denial tests, focused UI/local fixture where feasible; lint touched paths, git diff --check, typecheck distinguish known 55 build-copy diagnostics. Do not rerun Task14 solely for confidence; no broad suite/build or production browser by default. No media generation/install/network.

## Parallelism
Only independent frozen file scopes parallel. One worker for pure contract+fixed-asset route first if UI depends on them, then UI/actions integration. Shared file changes serial. Verifier read-only.

## Escalation
Any new schema/auth/security/contract necessity outside accepted Gate: stop widening and submit precise SCOPE_CHANGE_REQUEST. No self-authorized SQL or production writes. No source edits by Supervisor.

## Report binding
State recovery Worker Report /tmp/course-video-admin-resume-4nlp8bo8/WorkerReport.md SHA256 19b2ba721f26c35456d7906e8f39967d0d9166ebce4a8975682bf657daa625d7.
Report PROFILE line is a metadata error: actual selected dispatch was worker_high | GPT-6.1 Sol high, not its self-described Astra. Preserve original bytes; this correction does not alter source findings.

## Embedded recovery report
## WORKER REPORT

TASK ID: COURSE-VIDEO-ADMIN-RESUME (parent dispatch; no formal repository Task file assigned)
PROFILE: worker_astra_high | GPT-6 Astra high (parent-assigned profile)
OBJECTIVE: Read-only restore of administration authoring, persistence, preview, publication and student media paths; propose the smallest implementable backend/editor packet.
ACTUAL SCOPE: Read AGENTS.md/CODEX_WORKER.md, completed Task14/15, active task scopes, current related source/SQL/package and git state. Wrote only this private /tmp report. No implementation, credential/environment file reads, DB/API/browser/network calls, fixtures imports or tests.
CHANGES: No repository changes. This report is a proposal and source inventory, not delivery of user-requested editable UI.
FILES: WorkerReport.md only.

### 1. Current state and conflicts

HEAD: 2c073844b6eb22ed0934dcc2b60c1a19bc526ce2.
Tracked diff: execution-contracts.ts 8 additions/1 deletion, native-media-controller.ts 306 additions/16 deletions. New source/tests: published-media-contracts.ts; course-video-published-media-contracts.test.mjs; course-video-published-media-controller.test.mjs; fixtures/course-video-published-media.mjs. Together these are Task14's six existing implementation paths, uncommitted. Numerous completed Tasks and two existing docs are untracked; preserve all.
Active directory has seven SESSION-* Tasks: state restore (IMPLEMENTING), context Gate and preparation/verification/run specs, and blocked diagnostic. Their writable scopes are private /tmp packet/report/runtime resources, plus the diagnostic Task's named session evidence JSON. No declared overlap with the proposed admin/form/video paths. This is scope evidence, not proof no external process can edit the workspace. Do not revert or clean.
Task14 accepted prior verification: 262 focused + 7 adversarial tests, whole typecheck blocked by 55 prior build-copy errors. This Worker did not rerun or re-certify those results.
Task15 selected file: /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4; SHA256 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe; 5,487,747 bytes; container duration30.016s, video duration30.000s. No embedded or adjacent matched subtitle; narration/transcript and pedagogical cue relevance unknown. Technical frame samples 0/5/10/15/20/25 are never authored teaching cues. No R2 registration/upload or DB binding is established.

### 2. Exact existing chain and real support

Management route: src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/page.tsx::ManagementAppTeachingScriptsRoute awaits params/searchParams, calls requireManagementApplicationSection, passes appId/chapter to src/app/dashboard/admin/teaching-scripts/page-content.tsx::TeachingScriptStudioPage. That calls src/features/learning-agent-script-studio/service.ts::getTeachingScriptStudioData (135+), filters chapter and renders TeachingScriptStudio.
Service loads textbook-selected current version, chapters/modules/content nodes, learning_agent_script_versions and digital_textbook_activities (205+), then learning_agent_script_nodes including configuration/reference_activity_id/updated_at (225+). Activities are grouped by module (298+); returned activity DTO has id/key/type/prompt only. It has no activity definition revision, trusted media registry, or video execution manifest. configuration is passed through as Record<string,unknown> (330+), so a gated namespace can round-trip using existing JSON column without a new table.
TeachingScriptStudio.tsx::TeachingScriptStudio (318+) chooses module/version/node, supplies selectedModule.activities, updated node and form action props to TeachingScriptNodeForm (951). Preview URL (331-334) supports chapterNumber1 only and points to existing /preview?scriptVersionId=...&moduleIndex=... . No new native-video preview URL exists.
TeachingScriptNodeForm.tsx::TeachingScriptNodeForm (669+) uses normalizeTeachingVideo, with editable rows missing teacherVideo visually defaulted to video (720-721); hidden teacher_video_json (1389); legacy/video selector (1457-1458); per-script-row TeacherVideoPicker (1620); turn pickers (2168); referenced Activity select (2320). Existing reference select is module-grouped but includes all activity types. No timeline time-point input, cue id list, immutable media revision, captions timebase or native controller mapping. UI offers custom inline single-choice/private answers as well as referenced Activity; the new pilot should initially use existing referenced single_choice Activity only.
TeacherVideoPicker.tsx has browse/bind, server HEAD validation, title/transcript value, optional plain <video> controls preview (64), and browser metadata duration shown only in local component state. It has NO file input/upload action; empty-state tells user to upload MP4 to R2 manually. Bind accepts only R2 teacher-video/...mp4 via verifyTeacherVideoAction. A local file path cannot bind or play here.
Teacher-video-actions.ts::listTeacherVideosAction requires platform owner, lists R2 prefix and usage from nodes' configuration.teacherVideo; verifyTeacherVideoAction requires platform owner, validates key, existence/nonzero size/content type. No SHA, decode duration, immutable content revision or local source intake. New namespace will need its usage collection added if reuse library usage display.
src/lib/teaching-video.ts configuration shape is {mode:'video'|'legacy',explanations:[{objectKey,title,transcript}|null],turns:{task,question,operationFeedback,correctFeedback,incorrectFeedback},continuous,taskInExplanation,questionInExplanation}. normalizeTeachingVideo missing/unrecognized becomes legacy. teachingVideoIssues validates script/bindings/transcript equality and prompt turns; activeTeacherVideoBindings only tracks used segment/turn objects. This is segment-driven behavior, not one-media internal timeline cues. Do not globally change this normalizer or invent cues from segment text.

Persistence actions (src/app/dashboard/admin/teaching-scripts/actions.ts):
- createTeachingScriptDraftAction (252) uses create_learning_agent_script_draft, copies private interaction secrets; initializes teacherVideo mode video ONLY on cloned nodes lacking teacherVideo (263-268). Existing explicit legacy survives; this is not a new-pilot server policy.
- addTeachingScriptNodeAction (274) checks draft then inserts virtualCharacter/scriptPerformances config (295+) WITHOUT teacherVideo. Current form may visually infer video but persisted node can be missing mode.
- saveTeachingScriptNodeAction (336) requires platform owner, parses nodeSchema/form inputs, selects current row+version and checks draft/updated_at (482-496), merges existing configuration, parses teacher_video_json via permissive normalizer (504-511), sets current interaction/ref/node/action types, then calls save_teaching_script_node_atomic (643+) with configuration and private secret separately. Success revalidates studio and says saved draft. Non-video config keys are preserved by shallow merge, but there is no videoPilot schema or consistency validation. referencedActivityId currently gets UUID/nonempty check only at JS schema level; module/type/revision validation for new cues must be server-derived.
- SQL supabase/migrations/202609070001_teaching_script_atomic_video.sql (4-60) implements owner guard, draft and updated_at CAS, atomic node+private secret write. JSON configuration round-trip is real existing code capability. No SQL new-mode/media/cue enforcement. It is NOT VALIDATED against running DB here.
- publishTeachingScriptAction (899) uses teaching_script_publish_snapshot, loops EVERY node but skips normalizeTeachingVideo mode!=video, checks current video issues, HEAD existence, then publish_teaching_script_checked(expected token). SQL same migration (66+) fingerprints node/version/secrets and does final locks/token check; it does NOT evaluate new media/cue policy or digest. The checked RPC is granted to authenticated users with platform-owner internal guard: JavaScript-only refusal is a user-flow blocker, not proof direct RPC cannot publish a malformed new pilot. Any hard global server/DB retirement claim needs a separately approved Gate/database boundary.
- release-check-actions.ts::inspectChapterRelease (38+) reads published versions, assesses source reviews/access and legacy teacherVideo configs; loops only existing video nodes, does HEAD and MP4 header range GET. No draft/native pilot checker, duration/hash/cue/activity revision or native runtime admission. “视频文件读取ready” is not new native readiness.

Existing full student-style preview:
src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx::TeachingScriptPreviewPage requires owner, loads selected node/config and buffer/display/character, loads hardcoded Korean chapter1 with tenantId=null/trackingDisabled=true, renders old SmartTextbookShell with previewScriptVersionId. It can render legacy opening character before preview API replies; blocking only API is insufficient to prevent old-avatar initial UI.
src/app/api/learning-agent/preview-respond/route.ts::POST authenticates owner (59+), loads version/nodes, decodes signed preview state, calls shared resolveScriptStep (104) and teacherVideoForTurn, returns old teacher-video/interactions headers. It writes no session/messages/attempts. It has no new-pilot discriminator, manifest compiler or pinned services. It must refuse flagged new videoPilot scripts before legacy resolver.
SmartTextbookShell leads to KoreanLevelOneSmartTextbook.tsx; its preview fetch is preview-respond (5003), parses old teacher-video header (5062+) and renders src/components/learning-agent/TeacherVideoPlayer.tsx (6442). That player's onTimeUpdate caches position, onEnded sets presentation ended, and missing/error allows “阅读文字后继续” -> onStatus ended. It does not use NativeMediaController or formal independent /3 readback. Therefore neither saving JSON nor this old preview proves Task14 student behavior.

New runtime separate chain:
src/features/smart-textbook-runtime/components/runtime-root.tsx rejects video manifest lacking execution/nativeExecution; runtime-context.tsx (28) constructs sole NativeMediaController when both exist; video-block.tsx::NativeVideoBlock is the thin owner adapter for attach/timeupdate/seek/play/pause/ended/error. Task14 adds explicit published/3 services but no production installer. Preserve these files in admin packet.
Local runtime-v1-preview/page.tsx is isolated AuditRuntimeClient with trackingDisabled=true and no ordinary-entry switch; it cannot install published/3 which requires trackingDisabled=false.
Frozen Task14 remaining-path findings stay valid: src/lib/smart-textbook-runtime-v1/execution.ts native-execution/1 fixes scriptVersion1 and source node numbers5/7; src/lib/smart-textbook-publishing/native-publication.server.ts sourceNodeSchema requires strict empty configuration and emits empty mediaRefs/teachingRefs (111), so cannot compile new video fields. src/features/smart-textbook-runtime/server/learning-session.server.ts::createRuntimeLearningSessionResolver.resolve requires requireLegacyPublication (35). published-native-activity-read.server.ts::readPublishedNativeActivity requires genuine per-call Tool authorization/production fixed transport and CURRENT publish-foundation/2 fence, not merely a supplied pinned browser session. No fake Tool context or copied receipt permitted.

### 3. Recommended smallest immediately deliverable packet

Do one narrow Architecture Gate first for persisted private namespace/discriminator and guarded draft save; Gate need not finish native-execution/2, publication/compiler/session design before this UI packet. The deliverable after this Gate should be real editable/saveable existing-studio form and guarded nonformal media inspection. This Worker proposal alone must not close the user task.
Recommended first pilot scope: explicit opt-in on a draft node; one selected media owner + one mandatory pause cue to one existing referenced single_choice Activity per node. Multiple per-video cues require widening the frozen schema/compiler and should be stated honestly; existing reference_activity_id can represent only one associated Activity per node. New/blank draft can remain incomplete and saved; preview playable/publish readiness stays blocked. No automatically authored cue for sample01.
Draft schema candidate under configuration.videoPilot (Gate fixes exact bytes/names):
{contract:'video-pilot-authoring/1',mode:'video',media:null|{objectKey:string,title:string,transcript:string},cue:null|{id:string,atSeconds:null|number,activityId:null|uuid},captions:null|{objectKey:string,timebase:'media-start',sourceMediaSha256:string}}.
Bounds: strict objects, legal existing teacher-video MP4 key, transcript bounded, finite nonnegative atSeconds; absent media/cue/at/activity allowed for incomplete draft. For first packet captions can be null-only (no subtitle source confirmed). No answer keys, provenance/tenant/session refs, COMPLETED fields or runtime receipts stored here. Media byte SHA/duration/activity revision must eventually come from trusted admission/metadata, not browser assertions. If draft shows authored duration, label it author supplied until verified. Actual selected duration/hash stay in server intake record, not universal truth for arbitrary R2 key.
Use cue.activityId == node.reference_activity_id; synchronize both on save under same atomic RPC. Existing shared helper validates single cue/Activity mapping; server loads association via script version->lesson->module->content node->activity and rejects wrong module/type. Do not build a second answer store or parse grading keys. Initial new-pilot save rejects mixed inline interaction/avatar/task modes, normalizes only permitted new-mode presentation fields, and strips active legacy configuration under explicit contract if Gate authorizes; do not silently destroy historical config.
The new pilot must be selected explicitly and server rechecked from stored row; no mode detection from missing video, posted completion flag or absent headers. For existing draft conversion, first save creates stored discriminator with explicit owner action. Without server-owned admitted forward release tuple, call this an opt-in authoring draft, not formal retirement of all nodes in new release. Actual new version/chapter tuple remains future admission work.
Gate-approved draft packet safeguards: old /preview page reads full version and returns blocked new-mode view before rendering SmartTextbookShell; preview-respond rejects any covered new-mode script before resolveScriptStep; publishTeachingScriptAction refuses new-mode versions with clear pending integration message before checked publish RPC; inspectChapterRelease reports new-mode readiness blocked. UI never invokes old preview for flagged draft or renders old avatar/text-ended fallback. These app checks can support honest author workflow, but direct checked RPC is a separate high-risk boundary: do not advertise strict production retirement without SQL/domain hard enforcement.
A plain <video controls> inside editor is useful non-scored source inspection; it may display raw media and user-chosen time, but must not synthesize /3 completion or claim full student equivalence. Save round-trip after reload is minimum acceptance. User request “preview student一致” remains open until common native manifest and native owner preview are genuinely wired; reporting blocker is acceptable within first packet, claiming completed parity is not.

Exact proposed paths for this packet (freeze in Task after Gate):
MODIFY src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx (explicit pilot fields, hidden pilot JSON, cue input and Activity select, field errors/summary, disable legacy full-preview path).
ADD src/features/learning-agent-script-studio/TeachingVideoPilotEditor.tsx (small isolated editor, reuse TeacherVideoPicker and CardTitleWithHint; no second player-controller).
ADD src/features/learning-agent-script-studio/video-pilot-authoring.ts (strict draft parser, completeness/check result, no server imports; authoritative parse failures never become legacy).
MODIFY src/app/dashboard/admin/teaching-scripts/actions.ts (parse+server association+atomic save; explicit new draft/add policy only with Gate tuple; app publish refusal).
MODIFY src/features/learning-agent-script-studio/teacher-video-actions.ts (library usage includes namespace if helper added; existing verify semantics remain existence only).
MODIFY src/features/learning-agent-script-studio/TeachingScriptStudio.tsx (new draft status, no old full-preview link for pilot).
MODIFY src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx and src/app/api/learning-agent/preview-respond/route.ts (stored new-mode refusal, including pre-render guard).
MODIFY src/features/learning-agent-script-studio/release-check-actions.ts (explicit native/pilot blocked readiness).
ADD tests/course-video-admin-authoring.test.mjs and tests/course-video-admin-policy.test.mjs (pure parser/policy and meaningful save integration seam). Existing types/service need no change if configuration stays opaque; only add them to scope if implementation demonstrably requires typed policy/DTO, then freeze separately.
No Task14 six-path changes, no lib/teaching-video global normalization change, no root config/package changes in this packet. Gate must decide RPC bypass blocker and conversion strategy explicitly, not leave Worker to infer production authority.

### 4. How selected sample can actually enter preview

TeacherVideoPicker has no upload entry. r2.ts already exports createR2SignedUploadUrl and assertR2ObjectUpload; those are reusable infrastructure, not a teacher-video upload workflow. Current local sample has no known R2 object key. Do not prefill fake R2 key as ready or put server absolute path in HTML/JSON.
Smallest no-R2-write inspection option: separately Gate a server-only fixed asset catalog record (opaque sample alias -> exact local path/hash/size/durations) and owner-only GET media route; range-aware MP4 streaming, no arbitrary path/key input, no symlink/path traversal, verify expected bytes/hash, private/no-store, abort handling. Example exact ADD paths: src/features/learning-agent-script-studio/selected-video-asset.server.ts and src/app/api/learning-agent/selected-video-preview/route.ts; optional editor uses only opaque alias URL. This is administrative non-scored source preview, not published MediaRef, so selected local alias must not be accepted by compiler/student services. Portability limitation: path exists on this host only. Gate may accept temporary local source inspection without polluting persistent playable-media contract; save local alias only if frozen draft contract explicitly marks pending ingestion.
Alternative production-aligned intake: isolated authorized server ingestion task reads exact selected file, chooses immutable content-hash object key teacher-video/<sha>.mp4, rechecks source hash, uses existing signing/upload helper, PUTs exact bytes once then verifies size/hash through trusted metadata, records catalog ref. Upload is an external write and was not performed/assumed authorized by this Worker. Follow task authorization; do not read credentials in the state recovery. A future teacher-video upload UI is a separate new server API/public security contract and requires Gate, size/type limits and immutable object handling. Plain material preview can proceed before formal cue approval; real teaching cue remains empty.

### 5. Later necessary Gate-owned dependencies

A. Freeze immutable new version/release identity, authoritative video byte/duration/captions revision, actual teaching transcript/cue relevance and activity definition revision; no carry-over old completion.
B. Introduce native-execution/2 and widen compiler/capture/fence to explicit pilot JSON and verified media+Activity revisions, preserving /1. Validate every covered node, reject unsupported mixed content. Include rollback/history without deleting old artifacts.
C. Pin durable native publication in learning-session resolver; authenticate current step/generation/cue from server-owned bundle; submit existing Activity domain write, then independent authorized durable read envelope. Decide genuine Tool /3 provenance vs separately gated native reader variant; consumer schemas alone do not authorize source.
D. Common native-owner preview and ordinary route service composition, isolated tracking-disabled preview semantics separate from formal published/3 services. Then real browser parity, seek gates, readback timeout/error/user pause and refresh checks. Never call old TeacherVideoPlayer completion semantics equivalent.
E. Strict server policy create/add/save/publish/release/preview and checked RPC cannot be bypassed; SQL/migrations/Auth/security changes require explicit Architecture Gate + critical verification, not unannounced scope widening.

### 6. Verification plan and actual validation status

Already run THIS TASK: read-only git status/diff --stat/numstat/HEAD, rg and bounded source/SQL/package reads. Actual commands returned successful source output; initial guessed paths page.tsx/data.ts/learning-state-store.ts were absent and were corrected to page-content.tsx/service.ts/runtime-context.tsx. No repository writes. No dynamic validation.
Proposed future focused checks (NOT RUN):
node --experimental-strip-types --test tests/course-video-admin-authoring.test.mjs tests/course-video-admin-policy.test.mjs tests/teaching-video.test.mjs
npm run typecheck (retain baseline build-copy errors distinctly; no global config workaround)
node_modules/.bin/eslint <only frozen touched TS/TSX paths>
git diff --check
Future authorized integration: mocked/injected save seam must verify strict parsing before RPC, server-derived same-module single_choice association, existing CAS token preserved, exact configuration round-trip and rejection paths. Real local DB draft-save/reload only when authorized; current live DB save NOT VALIDATED. Browser backend edit/save/reload/media-preview/accessibility/switch-to-blocked old-preview tests only after task grants browser/API/runtime; no uncontrolled production writes. Old SQL test tests/teaching-script-atomic.sql rerun only if database boundary is changed and environment is explicitly authorized. Do not rerun all Task14 tests for unrelated admin code.
Next docs before any frontend/server-action/route implementation: node_modules/next/dist/docs/01-app/02-guides/server-actions.md, 01-app/02-guides/data-security.md, 01-app/01-getting-started/15-route-handlers.md. Current version package next^16.2.10; rely on installed docs. Read UI skill ui-ux-pro-max once per assigned worker if not inherited; root already enabled it. Reuse existing styles, natural Chinese labels, CardTitleWithHint, field error aria-describedby, focusable submit failure summary links. No image/video generation skill needed; local source clip already selected. Hyperframes unnecessary for raw media streaming inspection unless request expands to editing/rendering video.

TEST RESULTS: No tests run; not requested/allowed. Exit code for dynamic tests: N/A, NOT VALIDATED.
NOT RUN: DB/API/browser/network/provider/R2/upload/credentials, tests/build/typecheck, production data changes. Reason: read-only recovery scope and preserve accepted Task14 verification.
ISSUES: No existing timed-video authoring schema/production composer; local source not R2 registered; real transcript/cues unknown; direct checked RPC lacks new-pilot policy enforcement.
RISKS: App-level draft blockers do not certify hard publish policy; JSON persistence is not native manifest admission; metadata cannot be trusted from browser; raw material preview is not student-flow equivalence.
SCOPE CHANGE: None. Proposed implementation is future scope, requires root Task/Gate.
ESCALATION: Narrow Architecture Gate required before persisted contract/server policy/local stream boundary implementation; no need to repeat Task14 Gate.
CONCLUSION: COMPLETED — read-only recovery/report only. Real backend editing/save, new-mode preview and student parity NOT IMPLEMENTED / NOT VALIDATED by this task.


## Accepted frozen Architecture Gate (overrides earlier proposal)

Supervisor: PASS for this design scope, not implementation. Foundation owns Gate section7 first5 paths, Integration owns next10. Execute serially as recommended. No permanent test fixture route or bypass. Any exact scope change must return to Supervisor. Whole typecheck known build failures remain explicit.

# Task16 Independent Architecture Gate

DECISION: ALLOW — only the frozen draft-authoring and owner-only local-material inspection package below. This does not allow publication, student admission, production rollout, DB operations, R2 uploads, or a claim of student-preview parity.

PROFILE: architect_gate | GPT-6 Astra xhigh. Task: COURSE-VIDEO-ADMIN-AUTHORING-16. Read-only gate; only this report is written.

## 1. Evidence and decision

Read AGENTS.md, CODEX_SUPERVISOR.md, Task16, the accepted recovery report, actual NodeForm/Studio/video picker/action/service/type sources, preview page and API, release checks, existing owner guard, and existing atomic save/publish SQL. Read installed Next route-handler/data-security guidance. Accepted Task14/15 findings were not re-audited. No tests, DB, browser, providers, credentials, network, uploads, or source edits were performed by this Gate.

The existing JSON column and owner-guarded atomic draft/CAS RPC are sufficient for an explicitly incomplete authoring record. A new schema migration is unnecessary for this package. Existing formal native consumers/compiler/session contracts remain untouched. The current checked publication RPC does not understand this marker; application blockers are therefore workflow controls, not a complete DB-level publication prohibition. This limitation is acceptable only because this package is explicitly draft-only, has no deployment/live DB execution, and never claims all production entry points are protected.

Important actual-source finding: save_teaching_script_node_atomic deletes node inline-answer secrets whenever configuration.interaction.kind is not single_choice. Consequently the minimal conversion path MUST reject existing inline-question nodes and any node with an existing private secret row; it must not erase or copy their answer keys.

## 2. Frozen persisted draft contract

Only configuration.videoPilot is new. All objects below are strict: unknown keys, arrays in place of objects, coercion, unknown contracts/enums, unknown asset IDs, nonfinite values, additional cues, and non-null captions fail validation. JSON input size maximum: 8,192 UTF-16 code units before parse. No browser-supplied SHA, duration, Activity revision, admission evidence, grading data, publication/session IDs, or completion receipts are accepted.

```ts
type VideoPilotDraft = {
  contract: 'video-pilot-authoring/1';
  mode: 'video';
  state: 'draft';
  media: null
    | { kind: 'selected-local'; assetId: 'course-video-sample01'; state: 'pending-ingestion' }
    | { kind: 'r2-library'; objectKey: string; title: string; state: 'unverified' };
  cue: null | {
    id: 'pause-1';
    atSeconds: number | null;
    activityId: string | null;
  };
  captions: null;
};
```

R2 objectKey uses the unchanged isTeacherVideoKey predicate (teacher-video MP4, maximum 500 characters). R2 title is a trimmed nonempty string of at most 100 characters. UUID Activity IDs use the existing UUID convention. atSeconds is a finite number in [0,86400]. The selected-local media additionally requires 0 <= atSeconds < 30 whenever time is non-null; use video-track duration 30, never container duration 30.016. The pure validator may enforce this bound from the frozen sample identity; the server also validates the actual fixed file before accepting a non-null local selection. R2 duration is unknown: a valid numerical time can remain draft data but cannot be described as verified against media duration.

One node has at most one media, one cue, and one referenced Activity. A draft can omit any of these through null. An empty draft has media:null, cue:{id:'pause-1',atSeconds:null,activityId:null}, captions:null. Never prefill a pedagogical pause point for sample01; its teaching transcript has not been established. No transcript field is introduced by this package. Existing unrelated teacher_script text is preserved, not repurposed as the sample transcript.

cue.activityId is the sole authored question association; server atomically writes the same value to reference_activity_id, or null when absent. The server derives same-module/type eligibility from current DB records. Private Activity answers stay in the original Activity domain. No copied answer object or Activity revision is persisted here. Current association checking is draft validation; future formal admission must independently pin and validate Activity revisions, including races after this draft read.

All filled fields may be called “草稿字段已填写，待接入”; not “可发布/学生端已就绪”. Derived runtimeReady is always false. Local media stays pending-ingestion even after its bytes play correctly. R2 HEAD is existence/type/size checking only and does not promote state from unverified.

## 3. Frozen shared exports (Foundation owns these)

ADD src/features/learning-agent-script-studio/video-pilot-authoring.ts, client-safe/pure, no server or filesystem imports. Existing teaching-video.ts may be imported only to reuse its key predicate; it must not be modified.

```ts
export const VIDEO_PILOT_AUTHORING_CONTRACT = 'video-pilot-authoring/1';
export const SELECTED_VIDEO_ASSET_ID = 'course-video-sample01';
export type VideoPilotDraft = /* section 2 */;
export type VideoPilotIssue = {
  field: 'videoPilot' | 'videoPilotMedia' | 'videoPilotCueAtSeconds' | 'videoPilotActivityId';
  message: string;
};
export type SelectedVideoAssetInfo = {
  assetId: 'course-video-sample01';
  title: string;
  sizeBytes: 5487747;
  videoDurationSeconds: 30;
  containerDurationSeconds: 30.016;
  previewUrl: '/api/learning-agent/selected-video-preview';
};
export function hasVideoPilotMarker(configuration: unknown): boolean;
export function parseVideoPilotDraft(value: unknown):
  | { ok: true; draft: VideoPilotDraft }
  | { ok: false; issues: VideoPilotIssue[] };
export function readVideoPilotDraft(configuration: unknown):
  | { kind: 'absent' }
  | { kind: 'invalid'; issues: VideoPilotIssue[] }
  | { kind: 'pilot'; draft: VideoPilotDraft };
export function createEmptyVideoPilotDraft(): VideoPilotDraft;
export function inspectVideoPilotDraft(draft: VideoPilotDraft): {
  authoring: 'incomplete' | 'configured';
  issues: VideoPilotIssue[];
  runtimeReady: false;
};
```

hasVideoPilotMarker checks own-property presence, not truthiness and not successful parse. `{videoPilot:null}`, `{videoPilot:{contract:'unknown'}}`, malformed markers, and marker-with-missing-media are all pilot-covered for refusal purposes. parse/read must never turn invalid data into legacy. inspect reports missing authoring fields but is not an authorization or server admission check. All absent fields in a valid shape are explicit null; missing required keys fail parse.

ADD src/features/learning-agent-script-studio/selected-video-asset.server.ts with `import 'server-only'`. Only these exports cross into other production files:

```ts
export async function getSelectedVideoAssetInfo(): Promise<SelectedVideoAssetInfo>;
export async function serveSelectedVideoAsset(request: Request): Promise<Response>;
```

Both functions call the existing requirePlatformOwner before any filesystem access. Do not replace it with a role-only predicate: it also rejects tenant-provisioned platform-looking accounts. Catalog/path/digest and internal byte/range helpers are not client exports. No runtime/config/environment override for path, catalog, or authentication. Test substitution is confined to test-loader/module mocks, never request-controlled or environment-controlled production seams.

ADD src/app/api/learning-agent/selected-video-preview/route.ts. Export runtime='nodejs', GET(request), HEAD(request); both delegate to serveSelectedVideoAsset. No route parameters. No query is accepted; nonempty URL.search yields 400 after owner authorization. The one URL represents exactly the one selected asset. Additional assets require a future frozen catalog/route change.

## 4. Fixed local media security and HTTP contract

Server-only catalog record:

- ID: course-video-sample01.
- Exact path: /home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4.
- SHA256: 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe.
- Exact size 5,487,747 bytes; video-track duration 30s; container duration 30.016s; video/mp4.
- No embedded/adjacent subtitle or approved transcript is inferred.

Use a bounded immutable byte snapshot per request, suitable for this fixed 5.5MB file: verify realpath equals the fixed canonical path, open with O_RDONLY|O_NOFOLLOW, fstat regular file/exact size, read at most expected size+1 through that descriptor with abort checks, require exact length and expected SHA, then close the descriptor in finally before returning bytes. This avoids verifying one path then streaming changed/unverified bytes from another descriptor. Reject symlinked paths and hash/size/type mismatches; no path/digest/fs stack in client errors. Do not read arbitrary paths, resolve a query into a path, shell out, upload/copy into public, or use credentials. No persistent global byte cache is needed.

Return the verified bounded snapshot through a Web ReadableStream (chunking is fine), with request-abort and consumer-cancel handling and listener cleanup. Check already-aborted signals, stop reading on abort, and close the FD on every outcome. Do not directly pass a Node Readable as a Web Response body without correct conversion. Since the complete snapshot is only 5.5MB, this deliberate bounded-buffer approach is simpler and safer than an unverified file-range stream. A new large-file intake system is out of scope.

HTTP behavior: GET with no Range => 200 full bytes; one valid bytes=start-end/start-/-suffix => 206 exact selected slice, inclusive Content-Range and Content-Length; oversized end/suffix clamp to file extent. Invalid, unsatisfiable, zero suffix, noninteger/overflow, unsupported unit, or multi-range => 416 and Content-Range: bytes */5487747. HEAD returns the corresponding status/headers and null body, including range handling, after validating the source. Missing/unreadable/mismatched source => 503 generic text/JSON; owner rejection => 403 generic response (catch the existing guard rejection at this API boundary; fail closed). Query =>400. No 304/public caching. Unsupported methods use the framework's 405.

All explicit media/error responses: Cache-Control: private, no-store; Vary: Cookie; X-Content-Type-Options: nosniff; Cross-Origin-Resource-Policy: same-origin. Successful responses additionally Content-Type:video/mp4, Content-Disposition:inline, Accept-Ranges:bytes and accurate length/range. No CORS allow-origin. Do not forward upstream headers; there is no upstream. No absolute local path appears in DTO, HTML, JSON, response error, or client bundle. This preview is host-local and availability on other deployments is NOT VALIDATED.

## 5. Exact draft-save/conversion policy

Reuse saveTeachingScriptNodeAction and save_teaching_script_node_atomic, but dispatch pilot handling BEFORE legacy schema/normalization/mutations. Read current node/version server-side early enough that a forged/missing pilot intent cannot force a stored marker through the legacy branch. Extend that current-node read as necessary to preserve every untouched node column; do not refactor unrelated actions.

Form fields for this branch: node_id, node_updated_at, return_to, video_pilot_intent ('enable'|'save'), video_pilot_json. Require exactly one string for node_id/token/intent/json; no File or duplicate entries. If no stored marker and neither pilot field exists, retain original legacy behavior. Otherwise:

- Stored marker absent: only explicit intent=enable + valid JSON can create it. Intent=save is rejected.
- Stored marker present and valid: only intent=save + valid JSON can update it. Missing JSON/intent, legacy submission, or enable is rejected; no removal/disable contract in this package.
- Stored marker present but invalid/unknown: reject modification with an unsupported-config error, while all refusal guards remain active. No silent repair/reset/fallback.
- Draft status and exact submitted updated_at must match the server row before external checks; pass that original token to the atomic RPC. RPC errors/late CAS failure must not report success.
- For initial conversion and later pilot saves, reject active inline interaction and any existing private secret row (select existence/node_id only, never read/copy answer fields in this path). Reject any active studentTask kind other than absent/none. No new inline question/avatar/task modes are accepted from pilot form fields.
- Preserve the existing legacy configuration keys and teacher_script/title/flow fields verbatim as INACTIVE draft history, with the new marker authoritative for UI and application blockers. This includes existing virtualCharacter/display/teacherVideo/scriptPerformances; do not silently strip them, normalize them, reactivate them, or write an archive of private answers. The UI explains conversion to the new draft editor, and pending integration means old flow preview is unavailable. Dormant keys do not constitute a second executable mode.
- Only configuration.videoPilot, reference_activity_id, node_type (question if a referenced cue Activity exists, otherwise explanation), and action_type (focus_activity if Activity exists, otherwise none) change. Keep all other stored row fields unchanged. Null p_secret is safe only after the above secret/inline checks. This deliberately does not add title/script/flow editing to the new pilot form.
- Resolve module from current stored script version -> learning_agent_lessons.module_id. Resolve Activity by ID -> digital_textbook_activities.node_id/activity_type -> digital_textbook_nodes.module_id. Require exact same module and activity_type='single_choice'; every query error, missing/ambiguous association, or mismatch rejects before RPC. Never trust a posted module ID/type/list/Activity revision. No Activity answer/definition loading is needed.
- Non-null local media must resolve through getSelectedVideoAssetInfo (verified fixed bytes), and cue bounds use 30s. Non-null R2 selection must pass existing key and server HEAD existence/nonzero size/MP4-or-octet-stream rules, but remains unverified. All checks can be mocked during task execution; no live providers are authorized.

ADD video-pilot-save.server.ts in the studio feature for a focused, testable server save implementation/helper. Integration worker owns its internal signatures and adapter shape; it must not export a new public action or independently bypass authorization. The actual action must use this helper, and tests must execute the same save orchestration with mocked owner/DB/media/RPC dependencies. Do not satisfy save acceptance using an unrelated pure fake implementation.

Create/add draft behavior stays unchanged; the owner explicitly enables the new editor on an eligible draft node, including a newly added blank node. No chapter-wide default policy or automatic rewriting of existing/new drafts is introduced. This is the smallest honest authoring opt-in before a formal release tuple is frozen.

## 6. UI and existing-flow protection

TeachingScriptNodeForm mounts the isolated TeachingVideoPilotEditor when the stored marker exists, or after explicit unsaved opt-in. For invalid stored markers it displays a blocked unsupported-config view; never show legacy controls. For eligible legacy nodes expose an explicit “启用视频暂停题草稿” control, with short scope text. Unsaved conversion can be cancelled before save; persisted conversion cannot be silently toggled back. Ensure hooks and mounting do not violate React hook ordering.

The new editor selects the fixed local sample or reuses the existing TeacherVideoPicker for R2. Do not modify TeacherVideoPicker to invent local R2 keys. Map its returned binding to the new R2 media union; its transcript and browser duration are not persisted or trusted. Local selection obtains the safe DTO through new inspectSelectedVideoAssetAction in teacher-video-actions.ts, then uses only DTO.previewUrl. This action returns `{ok:true,asset:SelectedVideoAssetInfo}` or `{ok:false,message:string}` and consumes getSelectedVideoAssetInfo; no path exposure. Raw video controls are labeled “素材试看”; no auto-pause quiz, fake grade, readback receipt, second formal controller, or claim of student parity.

Offer nullable pause-seconds input and same-module single_choice-only Activity select from the existing activities prop. No fixed sample question/time is authored automatically. Selected Activity absent from the current list should show an error rather than silently clear. Distinguish invalid values from empty/null. Existing stored field values must round-trip after save/reload; version/token refresh must not auto-resubmit stale CAS data. Save failures show linked/focused field-error summary and aria-describedby. Preserve dirty/pending notifications so Studio save navigation remains correct. Reuse CardTitleWithHint and ui-ux-pro-max accessible natural-language field guidance. No decorative English labels.

Studio detects any marker in the selected version, replaces old full-flow preview link/publish affordance with clear pending-integration state, and does not call legacy summary/readiness helpers for pilot nodes in a way that labels them speech-ready. Plain orchestration path visualization may remain only if it does not execute the lesson. A top-level pilot status is sufficient; do not redesign the whole Studio.

Server protections, all based on own-property marker existence (even malformed/null):

1. Full preview page queries EVERY node in the chosen version before opening-node character/buffer computation, textbook load, or SmartTextbookShell render. Any marker => explicit unsupported-preview message. Failed/incomplete node query => fail closed, not old shell. startNodeKey cannot narrow this guard away.
2. preview-respond checks all loaded nodes before decode/state/resolveScriptStep and returns 409 with a clear pending-integration message for any marker; query failure also refuses. Do not execute resolver or return legacy avatar/video headers.
3. publishTeachingScriptAction checks every snapshot node before legacy video checks, R2 calls, or publish_teaching_script_checked; any marker returns ok:false/nodeKey/message. The snapshot call itself is read-only and remains allowed by implementation semantics; task execution uses mocks only.
4. inspectChapterRelease adds an explicit blocked “视频暂停题接入” check if any selected chapter module has pilot markers in draft OR published versions. If a published version is pilot-covered, skip treating its pilot nodes as legacy-ready; never report the pilot integrated. Legacy published-version checks may remain separate and truthful.

These application guards must be delivered together with persistence. They do not cover direct RPC publication, every unrelated mutation action, or ordinary student entry. No blanket retirement or global publish-safety claim is allowed. Direct-RPC/DB hard enforcement and common native-owner student preview remain a later separately gated task.

## 7. Exact writable scope and division

Foundation Worker (first; owns 5 files):

1. ADD src/features/learning-agent-script-studio/video-pilot-authoring.ts
2. ADD src/features/learning-agent-script-studio/selected-video-asset.server.ts
3. ADD src/app/api/learning-agent/selected-video-preview/route.ts
4. ADD tests/course-video-admin-authoring.test.mjs
5. ADD tests/course-video-selected-asset.test.mjs

Integration Worker (after Foundation exports/tests accepted; owns 10 files):

1. MODIFY src/app/dashboard/admin/teaching-scripts/actions.ts
2. MODIFY src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx
3. MODIFY src/features/learning-agent-script-studio/TeachingScriptStudio.tsx
4. MODIFY src/features/learning-agent-script-studio/teacher-video-actions.ts
5. MODIFY src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx
6. MODIFY src/app/api/learning-agent/preview-respond/route.ts
7. MODIFY src/features/learning-agent-script-studio/release-check-actions.ts
8. ADD src/features/learning-agent-script-studio/TeachingVideoPilotEditor.tsx
9. ADD src/features/learning-agent-script-studio/video-pilot-save.server.ts
10. ADD tests/course-video-admin-policy.test.mjs

Both can write their own disjoint /tmp report/test-loader/browser-fixture directories. No permanent fixture route, auth bypass, environment flag, package, config, dependency, or browser helper needs to be added to src. Foundation may report before Integration starts; do not have both edit shared files or let Integration alter Foundation contracts. After Foundation return, independent policy guard work could be split from editor/action work only with an additional Root-frozen ownership table; serial Integration is the recommended smallest coordination plan.

Remove TeacherVideoPicker.tsx from writable scope: reuse it unchanged. service.ts/types.ts need no changes because configuration is already opaque and Activity IDs/types are present. Keep all Task14 six paths, src/lib/teaching-video.ts, student runtime/entry, publishing compiler, session services, SQL/migrations, Auth/RLS/credentials, root configs, AGENTS/CODEX/.codex files outside Worker scope. Root alone manages Task metadata. No git commit/push/deploy/production database calls or network/provider execution.

teacher-video-actions library usage query may be minimally extended to count R2 media in valid videoPilot drafts as well as legacy bindings; do not list local aliases as R2 or query private answers. An invalid marker cannot be normalized to a fake binding. Preserve existing legacy picker semantics.

## 8. Required verification

Foundation tests: strict full/partial schema; every unknown-key/contract/mode/state/asset case; exact own-property marker behavior for null/malformed data; no implicit legacy fallback; cue time 0,29.999 valid and 30 invalid for fixed sample; invalid UUID/multiple cues/captions/revision/duration/SHA fields rejected; inspect never runtimeReady. Test real sample hash/size by the implementation reader on the authorized exact path, not by trusting DTO constants alone.

Asset tests: mocked existing owner rejection is before disk access; active owner path; no arbitrary query/path; symlink/nonregular/wrong-size/wrong-hash/missing failure; exact full bytes and all range variants, inclusive last byte and 416s, HEAD null body; cache/security headers on successes/errors; no local path in returned DTO/errors; pre-abort, during read abort, consumer cancel and FD/listener cleanup. Test substitutions must not modify the source sample; temporary files/module mocks remain /tmp. Exercise actual production reader/response code, not only source-string checks.

Integration tests: execute the actual pilot action/helper with mock DB/RPC media seams; partial save persists exact JSON; mock readback/JSON reload reproduces fields and synchronized reference; original other fields retained; stale token and non-draft fail, late RPC CAS failure fails; enable/save state matrix; stored null/unknown marker refuses legacy requests; inline/secret/studentTask conversion refused without deleting secrets; wrong module/type/missing/query-error Activity rejected; forged browser metadata rejected; local SHA unavailable and R2 failed HEAD reject; no copied answers; unchanged legacy save still reaches its prior path. Test all four refusal integrations (including marker on a later node and startNodeKey selecting a legacy node); published/3 consumers are not touched.

Browser fixture: isolated localhost fixture with mocked owner/backend writes, using the actual editor component and actual server sample bytes where available. Demonstrate opt-in, local media actual playback/metadata, nullable cue, Activity filtering, invalid-time linked error/focus, save -> mock readback/remount, and unsupported full-flow preview state; inspect desktop and narrow viewport/keyboard focus. No real production DB/auth cookies/providers. A browser fixture may live under /tmp with transpilation/stubs using already installed tooling. Test explicit absence of local path in client network payloads/UI. It must be described as an isolated fixture, not live admin/student acceptance. If fixture tooling cannot execute, report NOT VALIDATED rather than substituting screenshots/source assertions for a pass.

Run the three new Node test files plus tests/teaching-video.test.mjs once after Integration, appropriate focused lint on touched TS/TSX, git diff --check, and typecheck with known 55 build-copy diagnostics classified separately. Workers can stage their bounded tests before handoff; do not rerun Task14 or the entire project suite without a new relevant failure. Independent verifier reviews actual diff and runs focused adversarial cases, especially malformed marker bypass, mock save/RPC ordering, route auth/hash/range/abort, and forbidden-file drift. No real live DB save/load or full student browser equivalence is validated by this packet.

## 9. Alternatives rejected, compatibility, rollback, routing

Rejected: treating missing teacherVideo as new pilot; using normalizer failure to fall back to legacy; fake R2 key for local file; plain public file copy; unconstrained file route; browser duration/Activity revision as authoritative; hand-built grading/receipt; auto-authored sample cue; multiple cues now; silently converting inline-answer nodes; adding SQL production enforcement inside this draft task; retrofitting Task14 consumers merely to make an editor demo play. Each either expands scope or crosses an unfrozen truth/security boundary.

Legacy versions with no marker retain original behavior. Drafts cloned from an existing pilot may preserve their marker and therefore remain blocked; no normalization back to legacy. Dormant legacy keys can only be reactivated through a future explicit rollback contract. Safe operational rollback is to leave pilot drafts unpublishable and continue the unchanged previous published version. Do not blindly revert marker guards while pilot JSON remains stored; do not delete or rewrite pilot drafts automatically. No DB migration/rollback is required here because no DB execution is authorized.

Recommended Foundation: worker_astra_high | GPT-6 Astra high (filesystem/media security and abort behavior). Recommended Integration: worker_high | GPT-6.1 Sol high (frozen multi-file UI/action integration); escalate if it cannot preserve the old save path or reliable test seams, not by silently broadening scope. Required independent final Verification: verifier_critical | GPT-6 Astra xhigh. Root reviews final source boundaries/evidence, and reports this delivery as draft authoring plus material inspection with publication/session/student parity still pending.

GATE VALIDATION STATUS: source/design review completed. Dynamic implementation validation NOT VALIDATED by this Gate. ALLOW applies only after Root appends this exact contract/scope to Task16 and dispatches implementation; it is not evidence that implementation already exists.


## Supervisor final review / 本轮交付与后续

Decision: **PASS，限冻结的后台草稿编辑与管理员素材试看。**
用户目标“后台和学生视频教学完整对齐”尚未全部完成；本记录不得被当成正式上线或学生完整流程验收。

### 已完成（大白话）

- 在现有教学脚本后台增加明确的视频暂停题草稿编辑入口。
- 可以选择 sample01.mp4 并试看真实视频，也可改选既有视频库素材。
- 每个视频节点当前支持一个暂停时间点、一道同模块的单选题；可以先保存不完整草稿。不会自动猜出题位置。
- 新保存逻辑保留原标题、讲稿和历史配置，检查版本冲突，拒绝覆盖旧自定义题的私有答案。
- 带新视频标记的节点会被旧完整预览/发布流程拦住，避免误回旧形象；明确显示仍待正式接入。
- 仅管理员可读取固定试点视频，验证同一文件的大小/哈希后提供带Range支持的素材试看。未上传R2，未改原片。

### 验证事实

- 独立55项Node测试全部通过：44项指定测试+11项额外边界检查。Foundation17+5源未变，按指纹复用，其余27+6独立执行；不重复计为新的另一套验证。
- 独立浏览器11组检查通过：真实视频推进、30.016秒metadata、模拟保存/回读、30秒边界错误、只读/冲突/畸形标记、键盘操作、桌面及375px布局。
- 浏览器使用实际NodeForm/Editor和正式文件读取实现；owner/DB/RPC均隔离模拟。两次mock保存不是线上课程保存；12.5秒只是测试输入，不是实际教学cue。
- 定向lint、whitespace检查通过。整库typecheck仍exit2，55条旧build/r7cb-b3a-candidate/source诊断与先前独立基线逐行相同，当前src/tests新增诊断0；整库检查**NOT PASS**。
- 精确15个本轮实现/测试路径绑定在FinalEvidence；Task14六路径保持不变。未改Auth/RLS/SQL/migration、根配置、旧全局normalizer、正式学生入口或无关工作。
- Critical Verifier曾因模型capacity中断，但测试结果已写盘；恢复后读取既有结果，只完成报告，没有重做已通过工作或改源码。

### 未完成与下一步

1. 可信发布/会话/学生播放接线：将同一份新视频草稿编译成可验证的发布配置，绑定媒体与Activity版本；正式答题独立读回走已验证媒体owner。当前学生预览与新后台尚未真正共用完整执行链。
2. 发布必须补齐数据库/直接RPC等边界，当前应用层阻断不能宣称全局不可绕过。不要在该门槛闭合前发布pilot草稿。
3. 核对sample视频讲解内容后确认正式题点/题目，处理正式媒体入库与需要的字幕；不能把测试数据复制成教学内容。
4. 用真实管理员草稿保存、真实学生完整流程完成验收后，再发布网站并切换普通课程入口。新模式不得回退旧形象；历史课程/学习记录仍须保留。
5. 既有构建副本类型检查问题独立处理，不通过删目录/放宽忽略规则隐藏。

本轮没有部署、commit/push、真实DB写入、凭据读取、R2上传、收费provider调用或生产课程切换。你正在使用的网站尚未安装本轮改动。

Next minimum task: COURSE-VIDEO-PUBLICATION-SESSION-INTEGRATION — 先冻结后台同源配置到可信发布/学生会话的接线合同，再实施；不重做Task14/15/16。
Model routing: 架构/安全接线设计用worker_astra_high + architect_gate；边界冻结后的常规多文件实现按实际复杂度用worker_high，避免自动继承最高强度。

RecordedAt: 2026-10-05T10:36:54.122034+00:00
Pre-archive Task SHA256: eec44deb26206d5d8bd68585ea629caef4f6079c8220a8cac64288b577da7e14

### Report bindings

- `/tmp/course-video-foundation-16/WorkerReport.md` SHA256 `17deb001ba903b01761b278ab924ec6e49acfbcbbf8cff14d9fb9d865edc6695`
- `/tmp/course-video-admin-integration-notes/WorkerReport.md` SHA256 `56e9d2c1e485f95a35e7925e67d71c42c05418be3148df4427f3aeb92fb05d30`
- `/tmp/course-video-admin-integration-notes/SourceEvidence.json` SHA256 `c2608d5f5799630912bff4a21524bd98d1b6c8ded9842e5b06f9ea988c42c7ca`
- `/tmp/course-video-admin-integration-browser/BrowserReport.json` SHA256 `5ccedefd1454fc43dec5b70133cc0d8a94b4b215e2931ddd8fd50689499e16c0`
- `/tmp/course-video-admin-verify-16/FoundationVerificationReport.md` SHA256 `3f2bda6bbc89b8d35fff054ab8ae235e79010199a24af1ae9f036859e8ab93bb`
- `/tmp/course-video-admin-verify-16/VerificationReport.md` SHA256 `bead47591442981072887db35479d467405410f80d7407f89c8efd001c26b725`
- `/tmp/course-video-admin-verify-16/FinalEvidence.json` SHA256 `c47ee8e6954e189d8b4d6fb60a73d6150a3fbd6db31c7ad738e450e77e6f063f`
- `/tmp/course-video-admin-verify-16/browser/BrowserReport.json` SHA256 `5003a15b07a73195dceda2dc9a22da358cd3ab7eeb2e8f5225540456ad69db4e`


## Embedded /tmp/course-video-foundation-16/WorkerReport.md

## WORKER REPORT

TASK ID: COURSE-VIDEO-ADMIN-AUTHORING-16 / Foundation
PROFILE: worker_astra_high | GPT-6 Astra high
OBJECTIVE: Implement Gate-frozen strict authoring contracts and owner-only selected local video inspection/streaming.
ACTUAL SCOPE: Exactly the five Gate7 Foundation additions below; private /tmp/course-video-foundation-16 report/patch/scoped-tsconfig and transient private /tmp/course-video-foundation-test-* negative fixtures (removed by test cleanup). No other repository files edited.

CHANGES:
- Client-safe draft contract, own-property marker guard, strict parser/read/empty/inspect helpers; malformed marker never becomes absent/legacy. inspect.runtimeReady always false.
- Input convention agreed with Root: parse accepts an object or JSON string (8192 UTF-16 units before JSON.parse); read only accepts persisted object marker. R2 title must already be trimmed/nonempty/max100; parser does not silently transform persisted values. Reuses existing R2 predicate and z.uuid convention.
- Server-only fixed catalog remains private. Both production exports call existing requirePlatformOwner before filesystem access; no runtime or environment override/test seam.
- Canonical realpath, O_RDONLY|O_NOFOLLOW, same-FD regular/exact-size validation, bounded expected-size+1 read and SHA verification. FD always closes before returning snapshot bytes. Read abort checks and Web stream cancellation/abort listener cleanup.
- GET/HEAD fixed route, no query, generic 403/400/503/416 errors, exact single byte ranges and HEAD null body; private no-store/Cookie vary/nosniff/same-origin resource headers. No path/SHA in safe DTO or client errors. Existing framework owns unsupported method 405.
- Tests use module loader mocks only, actual source path bytes read-only for success and private /tmp files for negative cases. Actual route and production reader/stream functions execute; owner dependencies are mocked, not live authentication.

FILES / BEFORE-AFTER BINDING:
- src/features/learning-agent-script-studio/video-pilot-authoring.ts: before ABSENT; after SHA256 1ecadc293a456321d8117b27ccff2e0e87b12e0d04627b7310088da044dd29ac; 124 added lines.
- src/features/learning-agent-script-studio/selected-video-asset.server.ts: before ABSENT; after SHA256 381bf41a42e85034f7cef95b62d26de6d5b5bcaeae78bbbeeb7f9c89333f3c84; 130 added lines.
- src/app/api/learning-agent/selected-video-preview/route.ts: before ABSENT; after SHA256 01fe4f00521bfbab19e99b7e3db95cd39bb122b0aa45a802ba91ef45418e9419; 11 added lines.
- tests/course-video-admin-authoring.test.mjs: before ABSENT; after SHA256 62dd12d4209a15cb82461e5fa9293f1b62b2f4752cf1e9c5113381119167bd56; 101 added lines.
- tests/course-video-selected-asset.test.mjs: before ABSENT; after SHA256 94b8434ca0d44f42bfb6afbbcada96bdc6eb31a439fd4e34bdbe5d3cfab2077a; 236 added lines.

VALIDATION / TEST RESULTS:
Command: node --experimental-strip-types --test tests/course-video-admin-authoring.test.mjs tests/course-video-selected-asset.test.mjs
Result: 17 tests passed, 0 failed; final exit code 0. First run had 16/17 due to truncate test-mock state not continuing into the second invocation; fixed the mock's position-based truncation. No production reader change was needed for that failure. Following run passed; final additional realpath-mismatch case was then added and final run remained 17/17. Standard existing MODULE_TYPELESS_PACKAGE_JSON warnings only.
Coverage: partial/null combinations, required/unknown keys, contract/mode/state, local ID/state, R2 key/title/state, forged metadata, JSON length, own marker null/malformed/inherited cases; UUID, one cue, selected 0/29.999 versus30, R2 unverified bounds; actual sample hash/size/bytes; owner-first rejection, all query denial, realpath mismatch, symlink, missing/unreadable/nonregular/wrong-size/wrong-hash/changing-length failures; inclusive/clamped/suffix/open ranges and invalid/overflow/multiple 416; HEAD success/error; pre-abort/during-read/stream abort/cancel; descriptor/listener cleanup and security headers.
Actual full snapshot output hash: 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe; bytes 5487747. This is computed by the test from the production response, not only DTO constants.
Command: node_modules/.bin/eslint src/features/learning-agent-script-studio/video-pilot-authoring.ts src/features/learning-agent-script-studio/selected-video-asset.server.ts src/app/api/learning-agent/selected-video-preview/route.ts tests/course-video-admin-authoring.test.mjs tests/course-video-selected-asset.test.mjs
Result: no findings, exit code 0.
Command: node_modules/.bin/tsc --project /tmp/course-video-foundation-16/tsconfig.json --noEmit --pretty false
Result: exit code 0, no diagnostics. Temporary config extends project tsconfig, disables incremental, limits include to the three Foundation production files (and their transitive imports). This is focused type validation, NOT the whole-project typecheck. Root/Integration retain full typecheck and known preexisting 55-error classification.
Command: git diff --check
Result: exit code 0. New untracked files additionally inspected with git diff --no-index --check /dev/null <file>: each returns1 for additions with empty diagnostic output; no whitespace findings. The first report-helper initially asserted0 for no-index and stopped; corrected the report-helper expectation without source changes.
Diff artifact: /tmp/course-video-foundation-16/Foundation.patch captures all five additions. Existing Task14 tracked changes and untracked files remain present untouched.
Task input SHA256: eec44deb26206d5d8bd68585ea629caef4f6079c8220a8cac64288b577da7e14.
Gate report SHA256: a1f5502bbe725bffd4b40991c808672e99a657e031bfb8329a48b794ad7234d9.

NOT RUN:
- Task14 tests, broad suite/build, full-project typecheck: outside this bounded Foundation validation; no rerun solely for confidence.
- Live owner/DB/provider/browser/deployment/student behavior: NOT VALIDATED and not authorized here. No network, credentials/env, uploads, DB, R2, commits or deployments.
- Actual Next HTTP server 405: NOT VALIDATED; route exports only GET/HEAD and runtime per installed framework contract, and tests invoke these real handlers directly.

ISSUES: None blocking Foundation handoff. Integration and independent final review remain required for complete Task16.
RISKS: Fixed local file availability on other deployments NOT VALIDATED. Snapshot intentionally buffers at most 5487748 bytes per request; no cross-request cache. Material inspection is not ingestion/publication/admission or student runtime readiness. Current owner behavior is reused unchanged, mocked only in tests.
SCOPE CHANGE: None.
ESCALATION: None.
CONCLUSION: COMPLETED (Foundation only; production exports frozen and handed to Root for Integration).


## Embedded /tmp/course-video-admin-integration-notes/WorkerReport.md

## WORKER REPORT

TASK ID: COURSE-VIDEO-ADMIN-AUTHORING-16
PROFILE: worker_high | GPT-6.1 Sol high (Root-selected Integration dispatch)
OBJECTIVE: Deliver the Gate-frozen existing-admin draft video/pause-question authoring, real atomic-save orchestration, four old-flow refusal integrations, and isolated actual-editor/material browser evidence.
ACTUAL SCOPE: Exactly Gate section 7 Integration ten repository files, plus private /tmp notes, mock browser fixture and evidence. Foundation's five paths consumed only. No additional repository fixture/module/configuration or authentication bypass was added.

CHANGES:
- Actual saveTeachingScriptNodeAction invokes the private production helper after existing owner authorization and before legacy schema parsing. The helper performs server current-row read, strict one-string form fields, stored marker and enable/save matrix, draft/exact CAS, private-secret existence (node_id only) and active inline/student-task rejection, same-module single_choice association, verified fixed-local/R2 HEAD checks, then the original atomic RPC. Only the four Gate-authorized row fields change; title/script/flow/legacy history stay verbatim. Partial JSON persists; cue Activity synchronizes reference_activity_id. Late CAS failure never reports success.
- A second marker guard at the existing legacy current-row read prevents a no-marker early dispatch read from becoming a concurrent-conversion bypass. Absent marker/no pilot fields retain the prior real legacy atomic save path.
- Stable NodeForm wrapper selects a separate actual pilot editor without conditional hooks or legacy effects in pilot mode. Explicit opt-in is disabled while legacy edits are dirty/pending, so conversion does not discard edits or race an old-mode save. Stored invalid marker blocks editing; persisted pilot cannot silently disable; unsaved conversion can cancel.
- Actual editor uses the existing save action, nullable raw seconds with strict invalid/empty distinction, current-module single_choice filtering and unavailable Activity display, linked/focused error summary, inline errors and aria-describedby, CardTitleWithHint, dirty/pending callbacks and explicit save. Server token refresh never auto-resubmits dirty content. Local sample is named sample01.mp4; R2 picker is an optional collapsed replacement when local is selected. TeacherVideoPicker and schema are unchanged; its transcript/browser duration never enters persisted pilot JSON.
- Studio detects markers for pending preview/publication status and excludes pilot nodes from dormant legacy readiness helpers. Existing preview page and API query all nodes with exact counts, refuse errors/truncated results, and block any marker before character/buffer/textbook/legacy resolver/shell work. Publication refuses every snapshot marker before old checks/R2/publish RPC. Release checks explicitly block pilot integration for draft or published markers and skip pilot legacy media readiness.
- Safe selected-asset inspection action exposes only the Foundation DTO and generic failure; library usage includes valid R2 pilot selection, never local alias/invalid marker/dormant legacy binding.

FILES:
1. src/app/dashboard/admin/teaching-scripts/actions.ts: actual early save dispatch, late legacy marker guard, snapshot publication refusal.
2. src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx: stable opt-in/editor wrapper and dirty/pending conversion protection.
3. src/features/learning-agent-script-studio/TeachingScriptStudio.tsx: marker-aware preview/publish affordances, status and helper short circuits.
4. src/features/learning-agent-script-studio/teacher-video-actions.ts: safe inspection action and accurate pilot R2 usage.
5. src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx: complete version guard before legacy shell setup.
6. src/app/api/learning-agent/preview-respond/route.ts: complete version guard before decode/resolver.
7. src/features/learning-agent-script-studio/release-check-actions.ts: draft/published integration blocker and legacy pilot skip.
8. src/features/learning-agent-script-studio/TeachingVideoPilotEditor.tsx: new accessible draft-only editor.
9. src/features/learning-agent-script-studio/video-pilot-save.server.ts: new private actual save orchestration.
10. tests/course-video-admin-policy.test.mjs: 16 executable production action/helper/guard tests with DB/media/RPC/framework mocks.

VALIDATION:
- Installed local Next forms, Server Actions, route-handler, client directive guides read before source changes. ui-ux-pro-max form/keyboard/error guidance applied.
- 16 policy tests execute actual production action/helper and all four refusal integrations. Coverage includes strict partial/full JSON mock reload, untouched column/config preservation, synchronized reference/no copied answers, exact intent matrix, malformed stored marker/null/unknown refusal, duplicate/File/missing fields, forged metadata, stale/non-draft and late RPC CAS, inline/secret/task rejection, bad/missing/error Activity associations, local unavailable and R2 failed HEAD, prior legacy save path, concurrent marker appearance, later-node marker with legacy startNodeKey, node-count truncation and query failure, release marker handling.
- Isolated localhost fixture renders the actual NodeForm wrapper/editor and actual CardTitleWithHint/TeacherVideoPicker. Client action boundary uses mocked localhost backend writes; backend calls the actual private save helper with mock DB/RPC. Fixed-local inspection and video bytes are provided by the unchanged actual Foundation getSelectedVideoAssetInfo/serveSelectedVideoAsset with mocked existing owner, exercising real source digest/size verification. No production auth cookie, DB, R2/provider call or course save occurred.
- Browser observed sample metadata duration 30.016s and advancing video.currentTime on actual playback. The authoring constraint remains video duration 30s. Nullable cue saved, then 12.5s/Activity saved and mock readback/remount reproduced fields. 30s rejection linked inline errors with aria-describedby, focused summary then field. Single_choice list excluded multiple_choice. Dirty legacy edits disabled opt-in. sample01.mp4 visible; alternative R2 controls hidden until expansion. Desktop and 375px keyboard/focus/overflow inspected; zero page errors and no absolute path in client UI/network payloads. 12.5s is only private fixture test input, never authored production course data.
- Browser pending-full-preview text is fixture host status after persisted marker. Actual full preview refusal is separately executed by production page/API policy tests; this is not a claim of live Studio/student acceptance.
- Desktop/narrow screenshots actually viewed. Final narrow screenshot reflects requested source-choice clarification.

TEST RESULTS:
Command: node --experimental-strip-types --test tests/course-video-admin-authoring.test.mjs tests/course-video-selected-asset.test.mjs tests/course-video-admin-policy.test.mjs tests/teaching-video.test.mjs
Result: PASS, 44 tests (7 authoring + 10 asset + 16 policy + 11 existing video), 0 fail/skip/cancel.
Exit code: 0.
Notes: Existing MODULE_TYPELESS_PACKAGE_JSON performance warning appeared; no configuration was changed to suppress it. Policy was first staged at 14 tests, then final two adversarial cases added; final prescribed command ran once. Later UI-only clarifications were checked by the actual browser plus focused lint/typecheck; the unchanged policy suite was not needlessly repeated.

Command: node /tmp/course-video-admin-integration-browser/run.mjs
Result: PASS on final source, two isolated mock saves, real verified sample playback, eight browser finding groups, zero page errors.
Exit code: 0.
Evidence: /tmp/course-video-admin-integration-browser/BrowserReport.json; desktop.png; narrow.png. Fixture runner and client/css artifacts remain private /tmp only. Browser reruns were justified by Root's source-label/source-choice changes and the dirty opt-in branch addition.

Command: node_modules/.bin/eslint <all nine touched TS/TSX Integration paths>
Result: PASS, no errors or warnings.
Exit code: 0.
Evidence: /tmp/course-video-admin-integration-notes/Lint.log (empty successful output).
Notes: Initial editor lint found two synchronous effect setState errors. Corrected to action completion and conditional prop synchronization; final full touched-path lint passed.

Command: git diff --check
Result: PASS, no whitespace errors.
Exit code: 0.

Command: npm run typecheck
Result: BLOCKED BY BASELINE: exactly 55 diagnostics, all under build/r7cb-b3a-candidate/source/**; zero diagnostics in current src or other paths. Final source run confirms unchanged classification.
Exit code: 2.
Evidence: /tmp/course-video-admin-integration-notes/Typecheck.log. Whole-project typecheck is not claimed passing.

BEFORE/AFTER EVIDENCE:
- HEAD 2c073844b6eb22ed0934dcc2b60c1a19bc526ce2. Initial git status showed no modifications in the seven existing Integration paths, so their before bytes are HEAD; the three new Integration files were absent.
- Complete before/after SHA256 for ten owned files and current five Foundation consumption-only hashes: /tmp/course-video-admin-integration-notes/SourceEvidence.json.
- Owned tracked diff: /tmp/course-video-admin-integration-notes/OwnedTracked.diff. SHA256 b633386417c2651c83d6adb86f98cb2d57e527baf2d7af8a2d0e9be562c63086. New files are independently bound by after hashes in SourceEvidence.json; tracked diff alone does not include them.
- Source is frozen at these hashes after final validation; no repository source edits are pending from Integration.

NOT RUN:
- Live DB save/load, SQL RPC/database enforcement, production browser/auth/student paths, R2/provider/network uploads, build/full suite, Task14 rerun, commit/push/deploy.
Reason: Explicit frozen task scope; isolated mocks are used for mutations. Existing Task14 source/tests and unrelated existing work preserved. No new schema/auth/security contract was introduced.

ISSUES: No unresolved Integration implementation issues found by this bounded validation. Whole typecheck baseline remains a repository limitation.
RISKS:
- App-level guards do not cover direct SQL RPC publication or every unrelated mutation/student entry. Database-wide hard enforcement, published tuple/compiler/session/native-owner preview integration and global old-avatar retirement remain separately gated future work.
- Activity association checking is current draft validation; no immutable revision/race guarantee or student admission evidence is persisted.
- Local source remains pending-ingestion and host-local, even after bytes play; availability on other deployments NOT VALIDATED. R2 remains unverified after HEAD; duration/cue alignment is not certified.
- Actual real live administration persistence and full student-browser equivalence NOT VALIDATED. Browser evidence is explicitly isolated, with mocked owner/DB/RPC.
SCOPE CHANGE: None.
ESCALATION: None.
CONCLUSION: COMPLETED for the authorized draft authoring/material inspection Integration packet; ready for Root's independent critical verification. Publication/session/student parity remains pending, as required by Gate.


## Embedded /tmp/course-video-admin-integration-notes/SourceEvidence.json

```json
{
  "head": "2c073844b6eb22ed0934dcc2b60c1a19bc526ce2",
  "trackedOwnedDiffSha256": "b633386417c2651c83d6adb86f98cb2d57e527baf2d7af8a2d0e9be562c63086",
  "files": [
    {
      "path": "src/app/dashboard/admin/teaching-scripts/actions.ts",
      "beforeSha256": "4ef9669971974df7bcf3aba27dd65ad558653c390bee00fc26c0658e8ce734c9",
      "afterSha256": "83ca69ba0265b7a47aee8e14c596bf29982b0850b41ac9f2960a81166a652a00"
    },
    {
      "path": "src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx",
      "beforeSha256": "b18a3e20ac75be2a55bb0c46029f24aa06575dddc588d5f4db9c9bcd4d1e231e",
      "afterSha256": "a93e211c026ec59dd1ff8c263a250c7df5936a72ada1c64367b47e10665f3be2"
    },
    {
      "path": "src/features/learning-agent-script-studio/TeachingScriptStudio.tsx",
      "beforeSha256": "e85b0f00fd033079986226f65db2aa17fa4f2965334b44de0cea236649eb5496",
      "afterSha256": "4c01a00a3eff163154db26afc9cc4b1999349dc9219b04850035608ed7b1e9d6"
    },
    {
      "path": "src/features/learning-agent-script-studio/teacher-video-actions.ts",
      "beforeSha256": "dfe7ec0ab55bbc894a87ce9acdb6c353c47504e163cbca04310368f4d30aa09c",
      "afterSha256": "cbe03061d8f35442e3cdae338d396aae8fe59a5970502c44e8125a647f5e21f3"
    },
    {
      "path": "src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx",
      "beforeSha256": "32f6e91f0dbbe9e2f462c69755e9d8ce9d9154e40acef268d31c0ce7b9c52925",
      "afterSha256": "a3c1ea94972e07bc50ed719adf1893a127370c04041f2155cc2f5a2a636fdcc1"
    },
    {
      "path": "src/app/api/learning-agent/preview-respond/route.ts",
      "beforeSha256": "1b3c8a48c38289e058fd61d8ed3061ed82b4c95cae4634e613013490cf6994c7",
      "afterSha256": "dc03a09c4c48a2470e1eca67e6a6578fdc7e11012d1bb098b804493be1b434e9"
    },
    {
      "path": "src/features/learning-agent-script-studio/release-check-actions.ts",
      "beforeSha256": "21f2ec35ede7fcdff52d946a189f930e75aecdc5655afb47f6b469beb72e327b",
      "afterSha256": "311aad30b4a3963c25c41d0aaf0213015b9571b18c56e2d465179ee6259342c7"
    },
    {
      "path": "src/features/learning-agent-script-studio/TeachingVideoPilotEditor.tsx",
      "beforeSha256": null,
      "afterSha256": "bd103380c06dc659780766f0161a271bdd95379834c6d911ffd0f99954411024"
    },
    {
      "path": "src/features/learning-agent-script-studio/video-pilot-save.server.ts",
      "beforeSha256": null,
      "afterSha256": "a7a31e40bb6e26150a0d33813c0878591a90f080d51d2c45f6b126515ccd19ed"
    },
    {
      "path": "tests/course-video-admin-policy.test.mjs",
      "beforeSha256": null,
      "afterSha256": "d55f1b526906c624f2b95051b101e30dd57dd74789ae96929fd8e7e4967cf015"
    }
  ],
  "foundationConsumptionOnlyHashes": {
    "src/features/learning-agent-script-studio/video-pilot-authoring.ts": "1ecadc293a456321d8117b27ccff2e0e87b12e0d04627b7310088da044dd29ac",
    "src/features/learning-agent-script-studio/selected-video-asset.server.ts": "381bf41a42e85034f7cef95b62d26de6d5b5bcaeae78bbbeeb7f9c89333f3c84",
    "src/app/api/learning-agent/selected-video-preview/route.ts": "01fe4f00521bfbab19e99b7e3db95cd39bb122b0aa45a802ba91ef45418e9419",
    "tests/course-video-admin-authoring.test.mjs": "62dd12d4209a15cb82461e5fa9293f1b62b2f4752cf1e9c5113381119167bd56",
    "tests/course-video-selected-asset.test.mjs": "94b8434ca0d44f42bfb6afbbcada96bdc6eb31a439fd4e34bdbe5d3cfab2077a"
  }
}

```


## Embedded /tmp/course-video-admin-integration-browser/BrowserReport.json

```json
{
  "status": "PASS",
  "scope": "isolated localhost fixture, actual NodeForm wrapper/editor and actual verified sample server functions; mocked owner/DB/RPC, no production parity",
  "findings": [
    "opt-in protects dirty legacy edits before conversion",
    "sample01.mp4 visible identity; alternative R2 source collapsed when local selected",
    "actual verified server sample playback/metadata",
    "explicit opt-in, nullable cue partial save and synchronized readback",
    "invalid-time inline error, aria-describedby, focused linked error summary",
    "save -> mock JSON readback/remount preserves fields and pending full-preview state",
    "desktop/narrow 375px no overflow, keyboard focus",
    "no absolute local path in UI/network payloads; zero page errors"
  ],
  "duration": 30.016,
  "saves": 2,
  "requests": [
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    },
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    },
    {
      "method": "GET",
      "url": "/mock-inspect"
    },
    {
      "method": "GET",
      "url": "/api/learning-agent/selected-video-preview"
    },
    {
      "method": "POST",
      "url": "/mock-save"
    },
    {
      "method": "POST",
      "url": "/mock-save"
    },
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    }
  ]
}
```


## Embedded /tmp/course-video-admin-verify-16/FoundationVerificationReport.md

## VERIFICATION REPORT

TASK ID: COURSE-VIDEO-ADMIN-AUTHORING-16 / Foundation stage
PROFILE: verifier_critical | GPT-6 Astra xhigh
RESULT: PASS (Foundation only; Integration/final Task16 acceptance pending)

SCOPE CHECK: PASS for the five Foundation additions.
The five current source/test SHA256 values exactly match the bound Foundation WorkerReport. Its SHA256 is 17deb001ba903b01761b278ab924ec6e49acfbcbbf8cff14d9fb9d865edc6695. Its Foundation.patch SHA256 is 21e4bd3482fcbda7bfb2e2e76fd67190730e837c1120b929dac90b635ed0bea6. All five files remain additions; no Foundation file changed during verification. Existing admin.ts and teaching-video.ts have no diff. Integration edits are concurrent, expressly excluded from this stage, and are not treated as failures. This stage does not claim a whole-worktree forbidden-file drift audit.

ARCHITECTURE CHECK: PASS.
Read AGENTS.md, CODEX_VERIFICATION.md, Task16 including accepted Gate, bound WorkerReport, all five Foundation files, unchanged owner guard and R2-key predicate, and installed Next route-handler guide. Frozen export shapes/namespace match Gate. Client-safe schema has no server/path/digest import. Server module has server-only, private fixed catalog, only two permitted exports, no request/config/environment authentication or catalog seam. The existing requirePlatformOwner is called before all filesystem access; its role plus tenant-provisioning rejection remains unchanged.

TESTS:
Command: node --experimental-strip-types --test tests/course-video-admin-authoring.test.mjs tests/course-video-selected-asset.test.mjs
Result: 17/17 PASS, 0 failures, exit code 0. Ran once independently.
Command: node --experimental-strip-types --test /tmp/course-video-admin-verify-16/foundation-adversarial.test.mjs
Result: 5/5 PASS, 0 failures, exit code 0.
Independent cases cover abort immediately after realpath/open/fstat/close; FD equality and zero reads where appropriate; legitimate short reads; generic response and DTO errors on close failure; maximum-safe-integer range clamp and leading zeros; no conditional 304; own nonenumerable/null-prototype malformed markers; forbidden JSON prototype/metadata keys.
Both commands show only the existing MODULE_TYPELESS_PACKAGE_JSON warning.
Focused whitespace inspection: all five git diff --no-index --check /dev/null file checks have exit 1 (normal additions) with no diagnostics. No lint/typecheck rerun was necessary after unchanged source: worker evidence is lint exit 0 and focused temporary-project tsc exit 0 only. Whole-project typecheck is explicitly NOT VALIDATED at this stage; scoped tsc is not relabeled as a repository pass.

SECURITY / RLS CHECK: PASS for this bounded server/file boundary; live authentication/RLS NOT VALIDATED.
- Own-property presence is independent of parsing/truthiness; null/unknown/malformed stored markers never return absent. Strict JSON shape, all required null fields, no extra cue/metadata/caption payloads, exact selected ID and pending state, R2 unverified state, and 30-second exclusive selected bound hold. inspect always returns runtimeReady:false.
- Canonical realpath plus O_NOFOLLOW, one opened descriptor, regular/exact-size fstat, bounded size+1 read, exact length and SHA verification, and finally-close protect the returned snapshot. Actual response bytes independently match 5,487,747 bytes and SHA256 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe. Selected source is read-only; no source mutation performed.
- Existing owner rejection precedes query/disk; query inputs cannot select paths. Generic errors contain no path, SHA, stack, or redirect detail. DTO contains only the frozen safe metadata and fixed URL.
- GET/full, inclusive/open/suffix/clamped ranges, invalid/overflow/multi-range 416, HEAD source verification and null bodies, 403/400/503, no-store/Cookie/nosniff/same-origin headers, no CORS, no ETag/304, pre/read/post-read abort, stream abort/cancel/EOF listener cleanup pass actual production-function tests with test-loader mocks only.
- Auth/schema/RLS changes are not part of Foundation. No live credentials, DB, network, providers, production browser, deployment, publication, or student-runtime execution occurred.

ACCEPTANCE CRITERIA:
1. PASS — frozen strict partial/full authoring schema, markers, bounds, readiness semantics.
2. PASS — actual fixed source size/digest reader; unchanged owner guard invoked before disk.
3. PASS — fixed GET/HEAD route, range/status/header contract, generic failures, cancellation/resource cleanup.
4. PASS — tests exercise real implementation with loader-only mocks, not a fake implementation or production test override.
5. PENDING — Integration ten-file behavior, isolated UI fixture, final forbidden-file diff review, and whole-project typecheck classification.

ISSUES: No blocking Foundation finding.
MISSING EVIDENCE: Live owner/DB/provider/student/other-host behavior and actual Next HTTP-server unsupported-method 405 are NOT VALIDATED. Installed framework guide specifies framework-owned 405; route itself exports only GET/HEAD plus nodejs runtime. Integration acceptance remains pending and must not be inferred from this report.
RECOMMENDED NEXT ACTION: PASS_TO_SUPERVISOR for Foundation; retain this verifier for final Task16 phase after Integration freeze. Do not rerun these already-passed focused cases if their source hashes remain unchanged.


## Embedded /tmp/course-video-admin-verify-16/VerificationReport.md

## VERIFICATION REPORT

TASK ID: COURSE-VIDEO-ADMIN-AUTHORING-16
PROFILE: verifier_critical | GPT-6 Astra xhigh
RESULT: PASS — ONLY the frozen draft-authoring / owner-only material-inspection package.
This is not approval of production deployment, live persistence, publication, student admission, full-flow preview parity, or global avatar retirement. Whole-project typecheck remains NOT PASS due to its unchanged baseline.

### Scope and evidence binding

SCOPE CHECK: PASS.
- Reviewed actual implementation/diff for all 15 frozen Task16 files. Integration's seven tracked before bytes match HEAD 2c073844b6eb22ed0934dcc2b60c1a19bc526ce2; all ten after hashes match SourceEvidence.json. Foundation's five after hashes match their previously independently passed values and were reused without rerunning unchanged tests.
- Reconstructed Integration owned tracked diff SHA256: b633386417c2651c83d6adb86f98cb2d57e527baf2d7af8a2d0e9be562c63086. Foundation reconstructed five-addition patch matches 21e4bd3482fcbda7bfb2e2e76fd67190730e837c1120b929dac90b635ed0bea6. The embedded frozen Gate matches a1f5502bbe725bffd4b40991c808672e99a657e031bfb8329a48b794ad7234d9.
- All six Task14 files match its accepted Revision2 independent evidence. Current tracked changes are the seven authorized Integration paths plus the two preserved Task14 tracked paths. The authorized new files and preexisting Task/docs artifacts are retained. No new change to Auth/RLS/SQL/migrations, agent-core, student entry/compiler, TeacherVideoPicker, service/types, teaching-video.ts, root configuration/dependencies, AGENTS/CODEX or unrelated source was found.
- Verifier wrote only /tmp/course-video-admin-verify-16 artifacts. No implementation fixes, live DB/auth/provider request, credential/environment read, deployment, commit or upload occurred. Worker artifacts were not overwritten.
- Complete per-file and artifact hashes: FinalEvidence.json SHA256 c47ee8e6954e189d8b4d6fb60a73d6150a3fbd6db31c7ad738e450e77e6f063f. It also records unchanged Task14 files, exact baseline diagnostic comparison, actual independent test counts and browser results.

Bound Worker inputs:
- Foundation WorkerReport.md: 17deb001ba903b01761b278ab924ec6e49acfbcbbf8cff14d9fb9d865edc6695.
- Integration WorkerReport.md: 56e9d2c1e485f95a35e7925e67d71c42c05418be3148df4427f3aeb92fb05d30.
- Integration SourceEvidence.json: c2608d5f5799630912bff4a21524bd98d1b6c8ded9842e5b06f9ea988c42c7ca.
- Original Worker BrowserReport.json: 5ccedefd1454fc43dec5b70133cc0d8a94b4b215e2931ddd8fd50689499e16c0; rechecked unchanged after verifier browser execution.

### Architecture, security and acceptance

ARCHITECTURE CHECK: PASS. SECURITY / RLS CHECK: PASS for the authored application/file boundary; live Auth/RLS NOT VALIDATED.

1. PASS — Strict persisted draft namespace and marker authority. Foundation rejects unknown fields/modes/states/asset identity, malformed/encoded stored markers, extra cues, non-null captions, browser metadata/answers and missing required fields. Own-property marker detection is independent of parse/truthiness. The selected local cue bound is [0,30), not the 30.016-second container duration. Partial drafts round-trip and inspect.runtimeReady remains false. No legacy fallback is introduced for invalid markers.
2. PASS — Owner-only fixed local source. Existing requirePlatformOwner, including its tenant-provisioning restriction, remains unchanged and precedes filesystem access. Private fixed path/catalog, canonical realpath, O_NOFOLLOW, one descriptor, regular/exact-size check, bounded size+1 read, SHA verification and finally-close produce the same verified snapshot returned by GET/HEAD. Actual response bytes are 5,487,747 bytes with SHA256 68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe. Fixed URL/DTO do not expose path/digest. Query denial, generic failures, single-range handling, 416/HEAD/null body, private no-store/Cookie/nosniff/same-origin headers, no CORS/304, abort/cancel/listener/descriptor cleanup passed actual production functions under test-loader mocks.
3. PASS — Real save orchestration. The actual owner-authorized saveTeachingScriptNodeAction invokes the production private helper before legacy schema/normalization. It rereads the current server row, requires exactly-one-string fields, explicit enable/save matrix, supported stored marker, draft version and exact submitted updated_at. Invalid/ambiguous joins and stale/non-draft inputs fail before external checks. Existing private-secret rows and active inline/studentTask configurations reject conversion, with secret lookup limited to node_id. Same-module single_choice association comes from current server records; no answer/definition/revision data is loaded or copied. Local source verification and existing R2 existence/type/nonzero-size checks precede the original atomic RPC. Only videoPilot, reference_activity_id, node_type and action_type change; untouched columns/configuration history survive. Late RPC/CAS failures are errors. Legacy submissions use the prior atomic path, with an additional current-row marker check preventing concurrent conversion fallback.
4. PASS — All four legacy-flow protections execute real code. Preview page reads the whole version with count validation before opening-node character/buffer/textbook/shell work, regardless of startNodeKey. API refuses query/truncation/marker before decode/resolver and does not emit legacy character/video headers. Publication scans every read-only snapshot node before R2/legacy validation/publish RPC. Release reports an explicit blocked integration item for draft or published markers and skips dormant pilot legacy media readiness. These are application controls; direct SQL publication enforcement is outside this contract.
5. PASS — Actual editor and Studio integration. Stable wrapper avoids conditional hook order; explicit unsaved opt-in is blocked while legacy dirty/pending. Persisted malformed marker shows a blocked view, not legacy fields. The actual editor supports nullable raw time, single_choice filtering, absent Activity error, selected sample01.mp4 identity, collapsed alternative R2 source, material-only playback, explicit save, linked field errors and focused summary, dirty/pending callbacks, and CardTitleWithHint. No sample pedagogical cue or answers are invented. Studio removes full-preview/publish affordances for any marker and short-circuits legacy readiness paths. Actual Studio derives editable only from draft version status; isolated editable=false testing disables mutations and hides save/clear. Dirty external-token refresh retains local edits without resubmission, and explicit stale save is refused.
6. PASS — Library usage extension counts valid R2 pilot references only. Selected-local and malformed markers do not reactivate dormant legacy video bindings. Safe inspection action converts private reader failures to generic messages.

### Independent execution

Commands executed by this verifier; each completed with exit code 0:

1. node --experimental-strip-types --test tests/course-video-admin-authoring.test.mjs tests/course-video-selected-asset.test.mjs
   Result: 17/17 PASS in the Foundation stage. Unchanged source hashes confirmed; not rerun at final stage.
2. node --experimental-strip-types --test /tmp/course-video-admin-verify-16/foundation-adversarial.test.mjs
   Result: 5/5 PASS in the Foundation stage. Abort after realpath/open/stat/close; short reads; close failure; maximum-safe-integer/leading-zero ranges; conditional no-304 and own/prototype-key cases. Reused on unchanged source.
3. node --experimental-strip-types --test tests/course-video-admin-policy.test.mjs tests/teaching-video.test.mjs
   Result: 27/27 PASS (16 actual production policy/helper/action/guard tests, 11 existing legacy-video regression tests), no fail/skip/cancel.
4. node --experimental-strip-types --test /tmp/course-video-admin-verify-16/policy-adversarial.test.mjs
   Result: 6/6 PASS. Owner rejection before DB/RPC, missing/ambiguous version join, exact untrimmed CAS, malformed private-secret response, actual library usage suppression, generic selected-inspection error.
5. node /tmp/course-video-admin-verify-16/browser/run.mjs
   Result: PASS, 11 finding groups, two successful mock saves, actual verified sample playback and 30.016-second metadata, zero page errors.
6. git diff --check
   Result: PASS, no diagnostics. Foundation new files additionally passed independent no-index whitespace checks (exit 1 denotes additions, with no whitespace diagnostics).

Distinct independent Node tests across stages: 55 PASS = 44 prescribed focused tests + 11 adversarial tests. No Task14 suite, broad suite or build was rerun. Only the existing MODULE_TYPELESS_PACKAGE_JSON warning appeared in applicable commands.

### Browser evidence and its limits

Reviewed the frozen runner before execution. It bundles actual NodeForm, TeachingVideoPilotEditor, TeacherVideoPicker and CardTitleWithHint; legacy visual editors alone are fixture stubs. Browser actions cross a mock localhost boundary, and saves execute the actual private production helper with mocked DB/RPC. Inspection and video serving call the unchanged actual Foundation reader/functions with the existing owner guard mocked. File/digest verification reads the actual authorized sample. No production auth cookie, database, R2/provider or learning-result write occurs.

Copied the runner into the verifier's own directory to preserve Worker evidence. Instrumentation.txt records the only changes: fixture-local editable state/test setter and appended readonly, external-token conflict and null-marker checks. Production source/helper and original assertions remain unchanged. The fixture's pending-full-preview text is host status; actual full-preview rejection is separately tested through the production page/API, not claimed from that host text.

Observed explicit opt-in, protected dirty legacy edits, visible sample identity, collapsed R2 controls, actual advancing media.currentTime, nullable save, invalid 30-second error/aria-describedby/focused summary and linked field focus, 12.5-second/Activity save and JSON readback/remount, keyboard navigation and no overflow at 1280px/375px. Desktop/narrow screenshots were viewed. Readonly, stale dirty CAS, and null-marker blocked state passed additional independent checks. Absolute local paths are absent from checked UI/request payloads. Test cue values exist only in private fixtures, never authored course data.

Evidence: browser/BrowserReport.json, browser/desktop.png, browser/narrow.png, browser/run.mjs and browser/Instrumentation.txt. Their hashes are in FinalEvidence.json.

### Lint, types and remaining limits

Worker focused lint evidence: nine Integration TS/TSX paths exit 0, empty Lint.log; Foundation five-path lint exit 0 is bound in its report. No source changed after those runs. Worker scoped Foundation tsc exit 0 is only focused validation.

Worker whole-project npm run typecheck: exit 2, exactly 55 diagnostics in build/r7cb-b3a-candidate/source/**, zero current src/tests or other-path diagnostics. Independently compared all 55 diagnostic lines with the accepted prior independent typecheck.log: byte-for-byte equal. No redundant typecheck rerun was needed after this comparison and source-hash confirmation. Whole-project typecheck is NOT PASS; the scoped pass is not a substitute.

NOT VALIDATED: live DB save/reload and SQL RPC enforcement; live owner/Auth/RLS; production browser; R2 provider execution; deployment/other-host local file availability; actual Next HTTP-server unsupported-method 405; native compiler/session/published tuple wiring; student preview/playback/grading/learning-record parity; global old-avatar retirement. Installed Next guide specifies framework-owned 405 and this route exports only GET/HEAD/runtime. Local media remains pending-ingestion; R2 remains unverified. Current Activity checking is draft association validation, not immutable revision/admission evidence. No database-wide safety or student-readiness claim is made.

ISSUES: No blocking defect found within the frozen Task16 package. The existing whole-project typecheck baseline remains a repository limitation.
RECOMMENDED NEXT ACTION: PASS_TO_SUPERVISOR for Task16 draft authoring/material inspection only. Formal publication/session/student integration requires the later separately gated package.


## Embedded /tmp/course-video-admin-verify-16/FinalEvidence.json

```json
{
  "files": {
    "src/app/dashboard/admin/teaching-scripts/actions.ts": {
      "sha256": "83ca69ba0265b7a47aee8e14c596bf29982b0850b41ac9f2960a81166a652a00",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx": {
      "sha256": "a93e211c026ec59dd1ff8c263a250c7df5936a72ada1c64367b47e10665f3be2",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/TeachingScriptStudio.tsx": {
      "sha256": "4c01a00a3eff163154db26afc9cc4b1999349dc9219b04850035608ed7b1e9d6",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/teacher-video-actions.ts": {
      "sha256": "cbe03061d8f35442e3cdae338d396aae8fe59a5970502c44e8125a647f5e21f3",
      "matches_worker": true
    },
    "src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx": {
      "sha256": "a3c1ea94972e07bc50ed719adf1893a127370c04041f2155cc2f5a2a636fdcc1",
      "matches_worker": true
    },
    "src/app/api/learning-agent/preview-respond/route.ts": {
      "sha256": "dc03a09c4c48a2470e1eca67e6a6578fdc7e11012d1bb098b804493be1b434e9",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/release-check-actions.ts": {
      "sha256": "311aad30b4a3963c25c41d0aaf0213015b9571b18c56e2d465179ee6259342c7",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/TeachingVideoPilotEditor.tsx": {
      "sha256": "bd103380c06dc659780766f0161a271bdd95379834c6d911ffd0f99954411024",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/video-pilot-save.server.ts": {
      "sha256": "a7a31e40bb6e26150a0d33813c0878591a90f080d51d2c45f6b126515ccd19ed",
      "matches_worker": true
    },
    "tests/course-video-admin-policy.test.mjs": {
      "sha256": "d55f1b526906c624f2b95051b101e30dd57dd74789ae96929fd8e7e4967cf015",
      "matches_worker": true
    },
    "src/features/learning-agent-script-studio/video-pilot-authoring.ts": {
      "sha256": "1ecadc293a456321d8117b27ccff2e0e87b12e0d04627b7310088da044dd29ac",
      "matches_worker": true,
      "reused_pass": true
    },
    "src/features/learning-agent-script-studio/selected-video-asset.server.ts": {
      "sha256": "381bf41a42e85034f7cef95b62d26de6d5b5bcaeae78bbbeeb7f9c89333f3c84",
      "matches_worker": true,
      "reused_pass": true
    },
    "src/app/api/learning-agent/selected-video-preview/route.ts": {
      "sha256": "01fe4f00521bfbab19e99b7e3db95cd39bb122b0aa45a802ba91ef45418e9419",
      "matches_worker": true,
      "reused_pass": true
    },
    "tests/course-video-admin-authoring.test.mjs": {
      "sha256": "62dd12d4209a15cb82461e5fa9293f1b62b2f4752cf1e9c5113381119167bd56",
      "matches_worker": true,
      "reused_pass": true
    },
    "tests/course-video-selected-asset.test.mjs": {
      "sha256": "94b8434ca0d44f42bfb6afbbcada96bdc6eb31a439fd4e34bdbe5d3cfab2077a",
      "matches_worker": true,
      "reused_pass": true
    }
  },
  "task14_hashes_unchanged": {
    "src/features/smart-textbook-runtime/core/execution-contracts.ts": true,
    "src/features/smart-textbook-runtime/core/native-media-controller.ts": true,
    "src/features/smart-textbook-runtime/core/published-media-contracts.ts": true,
    "tests/course-video-published-media-contracts.test.mjs": true,
    "tests/course-video-published-media-controller.test.mjs": true,
    "tests/fixtures/course-video-published-media.mjs": true
  },
  "worker_artifacts_and_verifier_artifacts": {
    "/tmp/course-video-admin-integration-notes/WorkerReport.md": "56e9d2c1e485f95a35e7925e67d71c42c05418be3148df4427f3aeb92fb05d30",
    "/tmp/course-video-admin-integration-notes/SourceEvidence.json": "c2608d5f5799630912bff4a21524bd98d1b6c8ded9842e5b06f9ea988c42c7ca",
    "/tmp/course-video-admin-integration-notes/OwnedTracked.diff": "b633386417c2651c83d6adb86f98cb2d57e527baf2d7af8a2d0e9be562c63086",
    "/tmp/course-video-admin-integration-browser/BrowserReport.json": "5ccedefd1454fc43dec5b70133cc0d8a94b4b215e2931ddd8fd50689499e16c0",
    "/tmp/course-video-admin-verify-16/FoundationVerificationReport.md": "3f2bda6bbc89b8d35fff054ab8ae235e79010199a24af1ae9f036859e8ab93bb",
    "/tmp/course-video-admin-verify-16/foundation-adversarial.test.mjs": "6527add379925f7e54f9f8c0c01922e3f969ecb8952dc5be4a1a9f8d2011aa2c",
    "/tmp/course-video-admin-verify-16/policy-adversarial.test.mjs": "111c89068cc1c151932de41a83f7b4a258c05569367c35f14c02d9eb20399e3b",
    "/tmp/course-video-admin-verify-16/browser/run.mjs": "4092a1a9a97fc136ababf070838118b43156b6ba961815737b68ac7d3954d541",
    "/tmp/course-video-admin-verify-16/browser/BrowserReport.json": "5003a15b07a73195dceda2dc9a22da358cd3ab7eeb2e8f5225540456ad69db4e",
    "/tmp/course-video-admin-verify-16/browser/desktop.png": "9662ff06cf44e3a5cdf88dcfe2035b8ddfae229d7229e50caa5011076def0b34",
    "/tmp/course-video-admin-verify-16/browser/narrow.png": "5349ec0c9582712d78a6f82c263f43eff22226b9974cb4cbd1e21cb5b39f61f6",
    "/tmp/course-video-admin-verify-16/browser/Instrumentation.txt": "472f233351dff0a9645857c101dfffbb75ae3d0c22220abeb0d53ac221ddebee"
  },
  "typecheck": {
    "independent_rerun": false,
    "worker_exit": 2,
    "diagnostics": 55,
    "exactly_matches_prior_independent_baseline": true,
    "outside_build_copy_diagnostics": 0
  },
  "independent_tests": {
    "foundation_reused": 17,
    "foundation_adversarial_reused": 5,
    "policy_and_legacy": 27,
    "policy_adversarial": 6,
    "total_distinct": 55,
    "failures": 0
  },
  "browser": {
    "runner_exit": 0,
    "findings": 11,
    "real_video_duration": 30.016,
    "mock_saved_count": 2,
    "production_db_or_provider": false
  },
  "git_diff_check_exit": 0
}

```


## Embedded /tmp/course-video-admin-verify-16/browser/BrowserReport.json

```json
{
  "status": "PASS",
  "scope": "isolated localhost fixture, actual NodeForm wrapper/editor and actual verified sample server functions; mocked owner/DB/RPC, no production parity",
  "findings": [
    "opt-in protects dirty legacy edits before conversion",
    "sample01.mp4 visible identity; alternative R2 source collapsed when local selected",
    "actual verified server sample playback/metadata",
    "explicit opt-in, nullable cue partial save and synchronized readback",
    "invalid-time inline error, aria-describedby, focused linked error summary",
    "save -> mock JSON readback/remount preserves fields and pending full-preview state",
    "desktop/narrow 375px no overflow, keyboard focus",
    "no absolute local path in UI/network payloads; zero page errors",
    "independent: editable=false disables pilot mutation controls and hides save/clear; actual Studio derives editable only from draft status",
    "independent: dirty external token refresh preserves unsaved value, does not resubmit, and explicit stale save fails without RPC mutation",
    "independent: own null marker renders blocked view with no legacy/editor fallback"
  ],
  "duration": 30.016,
  "saves": 2,
  "requests": [
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    },
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    },
    {
      "method": "GET",
      "url": "/mock-inspect"
    },
    {
      "method": "GET",
      "url": "/api/learning-agent/selected-video-preview"
    },
    {
      "method": "POST",
      "url": "/mock-save"
    },
    {
      "method": "POST",
      "url": "/mock-save"
    },
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    },
    {
      "method": "POST",
      "url": "/mock-save"
    },
    {
      "method": "GET",
      "url": "/"
    },
    {
      "method": "GET",
      "url": "/fixture.css"
    },
    {
      "method": "GET",
      "url": "/client.js"
    },
    {
      "method": "GET",
      "url": "/mock-readback"
    }
  ]
}
```
