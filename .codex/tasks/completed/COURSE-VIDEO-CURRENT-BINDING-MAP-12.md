# TASK — 韩语1级当前发布与视频迁移映射

## Identity
TASK ID: COURSE-VIDEO-CURRENT-BINDING-MAP-12
TITLE: Map observed Korean1 chapter publication, video, cue, Activity and subtitles without mutation
STATUS: COMPLETED — PASS (bounded map; migration not implemented)

## Routing
IMPLEMENTATION PROFILE: worker_astra_medium | GPT-6 Astra medium
ARCHITECT GATE: Prior Task11 ALLOW is direction-only; any proposed published media/completion contract must return to independent Gate, not implemented here.
VERIFICATION PROFILE: verifier | GPT-6.1 Sol high for bounded read-only evidence/projection; escalate any auth/contract implementation proposal, none authorized.
MODEL ROUTING REASON: Course route, multiple publication systems and metadata privacy create uncertainty; use stronger reasoning on bounded reads, no implementation.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User approved continuing the announced next step: identify actual Korean1 video/course references and precise migration range, before any old-presentation removal or online change. Initial scope is the observed Korean1 Chapter1 on course route korean/korean-basic/korean-beginner/basic-pronunciation?chapter=korean-level-one-01. Broader Korean1 chapters are not silently assumed identical.
State Worker report is supplied in dispatch: main ahead3, HEAD2c073844b6eb22ed0934dcc2b60c1a19bc526ce2, tracked diff empty, 24preexisting untracked Task/docs preserved; Task09/10/11 evidence hashes present. Reuse them, do not repeat broad legacy runtime analysis or old recovery tasks.

## Scope
WRITABLE SCOPE: one new private /tmp/course-video-current-map-* directory0700/helpers/plan/safe receipts/reports0600 only; Supervisor Task metadata.
READABLE DEPENDENCIES: project rules and prior Tasks09/10/11 reports; targeted current course page loader/mappings; smart-textbook-publishing repository/identities/native-publication/assets; legacy-adapter reader and relevant schema/migrations; author teaching-script configuration and directly related source.
FORBIDDEN: all repository source/test/docs/config edits, deploy/build/tests/migration/backup, writes to application database/storage/published data, sessions/attempts/grades/student answer contents, unrelated courses/users/tenants, service restart, media generation or provider/model calls, deleting legacy assets, commit/push.

## Phases
A. First static preparation: map observed route to authoritative candidate IDs and exact source tables/columns. Distinguish ordinary lesson shell, published teaching script and immutable runtime pointer. Existing fixed chapter scope in adapter is a candidate, not proven current page binding. Produce a minimal read plan and safe metadata projection before live calls. No live operation during Worker preparation.
B. Where current metadata is required, prepare an outside-repository temporary read-only client for Supervisor review and execution; it is diagnostic tooling, not a new production reader/API. User's current request permits reading relevant project-owned course publication metadata. Root is sole live operator. Use existing project connection configuration only after the read plan identifies the exact file/key names and target; never dump .env or credential contents. Freeze target to project jubdbsjsalpecfvseskz and reject mismatch. Do not request passwords from user or discover arbitrary credential locations.
Prefer explicit HTTP GET/SELECT metadata projections from known tables using the existing approved server-side connection mechanism. No RPC/POST/auth mutation without a separately reviewed, proven read-only source contract. Do not call load/preview/respond/teacher/audit APIs that may start sessions or fetch full media. No direct raw privatePayload, correct answers, service keys, DSNs or signed URLs in outputs. If authoritative read necessarily includes private structures, propose minimal in-memory allowlist projection and obtain Supervisor review before any call; never persist raw response.
C. Root executes only a reviewed bounded plan; save safe exact response projection, source scope/time, request method/table/column names (no credential URL/query tokens), counts, limitations and hashes. No new course execution. Dynamic requests follow only IDs established by prior result. Cap30metadata requests and200rows per target family; stop on ambiguous target, unexpected scope, truncation or inability to distinguish current/historical. Read pointer before/after if multi-read consistency matters; do not claim atomic snapshot from unrelated queries. Failure remains failure; no automatic retry. Media bytes or HEAD availability checks are not part of this first map unless exact object list/method is separately reviewed within this Task.
D. Produce table for actual course/lesson/textbook/version/chapter/script-version/runtime-pointer references, video config/object reference/duration source, cue to Activity reference, subtitles/revision and legacy dependencies. Each cell says CURRENT_OBSERVED / STATIC_ONLY / HISTORICAL_ONLY / MISSING / NOT_VALIDATED. No asset availability claim from objectKey alone. Draft published completion-to-media binding requirements, not a selected final schema or implementation. Independent saved-result review.

## Contracts / Data / Security
MAY CHANGE PUBLIC CONTRACT: NO
DATABASE IMPACT: narrowly authorized READ_ONLY published course metadata only, after Root reviewed method. No source student records or secret answers.
AUTH/RLS IMPACT: NO change; server privileged credentials if existing needed remain process-private, scope pinned. No ownership bypass through guessed actor IDs.

## Acceptance Criteria
1. Establish exact target or concrete unresolved binding, not assume candidate constants equal observed page.
2. Preserve all historical evidence/repo modifications; zero app writes.
3. Separate three publication systems and current vs static/historical evidence. Native current code with mediaRefs[]/teachingRefs[] is an explicit gap, not proof of arbitrary production rows.
4. Map reusable elements and missing video/cue/subtitle/Activity coverage without promising ready video classroom. Retire/migrate/delete remains future scope.
5. Every live step and output safe fields specified in reviewed plan; root runs, worker/verifier do not repeat. No schema/authority/production mutation or model test.

## Required Validation
Source tracing, pure helper syntax/projection checks, reviewed read-only metadata if available, private hashes and independent evidence review. No application suites/build/browser required.

## Parallelism / Escalation
Dependencies serial: source scope -> reviewed reader -> Root read -> result -> verifier/Gate. Worker is not alone; never revert others. Unknown safe access/target -> report exact gap and complete independent static mapping; no invented approval requirements from unrelated historical tasks. Public contract changes require new Gate/Task.

## Reports
Complete WorkerReport per CODEX_WORKER.md; plan/helper hashes before execution, result/report hashes after; exact requests actually made, data safety, uncertainties and next bounded action. Verifier uses CODEX_VERIFICATION.md. Root records final verdict and archives.


## Supervisor Final Review — 2026-10-05
VERDICT: PASS — bounded current-source metadata mapping only.
VIDEO CLASSROOM / MIGRATION READINESS: NOT VALIDATED.

Actual Worker: worker_astra_medium | GPT-6 Astra medium.
Independent Verification: verifier | GPT-6.1 Sol high, PASS.
Root reviewed fixed GET-only reader before one execution; session13565 exit0.
19 metadata GET requests, all HTTP200; zero DB/storage writes, browser actions, provider requests, source/test changes, builds or application tests.

### Reusable factual result
Scope: ordinary published Korean1 Chapter1 route korean/korean-basic/korean-beginner/basic-pronunciation?chapter=korean-level-one-01.
Course 2f79a679-6e25-4cf9-9f71-455905584787; lesson 26fd3e57-e6cf-4df9-8514-646786f61e1d.
Textbook 7100ab2b-72b0-478e-8847-4df9b4485109; published version1 939ad4f7-3238-425e-91e9-d456c130ca68; chapter1 cda24fb8-c93b-4a19-9577-4418350ff708 (DB slug hello). Catalog slug korean-level-one-01 linked by same chapter_test_id.
8 modules,8 content nodes,19 Activities (17 count toward completion). Only orientation has a published teaching script: feb30ba7-0a5e-4e9f-83e6-8970f715ddd5 v23,8 teaching nodes. All projected teacherVideo mode/objectKey leaves NULL. Current source normalizer infers legacy; no actual playback or storage absence claim.
check-understanding and ready-for-practice reference the same orientation-check Activity aafa6ccc-4d4a-4dba-9315-2f30381e8a13. Other18 Activities lack references from this captured published script, not necessarily from every historical/system consumer.
73 scoped textbook media:8 ready images,2 ready audio,63 pending audio;2 ready listening tracks;44 ready speech rows. Audio duration is not video duration. DB ready does not prove object availability.

### Unresolved boundaries
Private immutable runtime publication pointer/history, actor access and playback, stored unbound videos, media availability/duration/revision, timed cue-to-Activity and subtitle revision NOT VALIDATED. Version/script before-after metadata equality is not an atomic snapshot. Current author source, author script publication and immutable runtime publication are distinct.
No old image deleted; no new video published; no student record read or changed.

### Evidence
WorkerReport: /tmp/course-video-current-map-nol1pwvt/WorkerReport.md
SHA256 ae1690568b6e5860c32cac76bfbbb675feb24bd68f6b4015c2e9bea97bf14787
BindingMap: /tmp/course-video-current-map-nol1pwvt/BindingMap.md
SHA256 f979da00a8b2c12d425f451aabcfbd18a8168a62628bffed02fed1ba2293db32
Safe receipt: /tmp/course-video-current-map-nol1pwvt/safe-receipt.json
SHA256 b9151c87c1f6010b55924f44e8c389e707ced9222101304801822e66aab00254
VerificationReport: /tmp/course-video-current-map-verification-x4y21m8c/VerificationReport.md
SHA256 65b5c25f274b8d04a138b1424915e80747c889731529bf60d40501dc855b80c7

### Next bounded work
Use Chapter1 orientation as initial video pilot scope; retain existing Activity identities and learning records, explicitly bind real video/time-cues/subtitles and published completion to one media owner. Determine media source and safe current runtime binding before final contract selection. Independent Architecture Gate must freeze public completion/media contract and author anti-reactivation applicability before code. Do not globally reinterpret missing video configuration; do not delete historical teacher assets or change other chapters. Ordinary entry switches only after replacement video path is verified.
