# TASK — 旧金老师形象退役与视频模式能力复用梳理

## Identity
TASK ID: COURSE-TEACHER-RETIREMENT-REUSE-11
TITLE: Define bounded legacy presentation retirement and reusable video teaching elements
STATUS: SPECIFIED

## Routing
IMPLEMENTATION PROFILE: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: REQUIRED for migration recommendation touching cross-module runtime/publication/completion boundaries; design-only gate after inventory, no implementation.
VERIFICATION PROFILE: architect_gate | GPT-6 Astra xhigh (independent design boundary review; no deployed acceptance claim)
MODEL ROUTING REASON: Multi-file reference/default/fallback inventory and compatibility-sensitive reuse decisions; reuse completed Tasks09/10 rather than restart investigation.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User wants old Kim teacher visual presentation retired so it cannot be reused inadvertently, with useful elements extracted into video playback mode. This is a feasibility/scope decision, not authorization to delete history or silently change published lessons. Root already stated this round read-only, no source deletion/change. New target remains timed video cue -> pause -> question -> correct durable authoritative completion -> resume, respecting user pause. Teacher name/persona/content is distinct from obsolete visual runtime.

## Scope
WRITABLE SCOPE: one new private /tmp/course-teacher-retirement-* directory0700/reports0600 only; Supervisor Task metadata.
READABLE DEPENDENCIES: AGENTS.md, CODEX_WORKER.md; completed Task09/10; their reports /tmp/course-video-contract-review-09-3abyh4ph/worker-report.md and /tmp/course-video-gate-flow-review-10-9wmlrglo/WorkerReport.md; directly related source/docs/types/test definitions needed for incremental reference inventory.
FORBIDDEN: repository implementation/docs/tests/config edits, DB/API/network/browser/live operations, credentials/env, deployment/assets deletion, published snapshot/history modification, migration/recovery/authority actions, suite/build execution.

## Requirements
1. Reuse accepted previous findings. Incrementally find reactivation points: normal learner entry, legacy authoring selectors/defaults, response headers/fallback, missing/stale video behavior, preview/legacy routes, character resources and relevant tests. Exact paths and references, no huge list of every static asset.
2. Make three evidence-based lists: RETIRE active legacy visual/presentation behavior; REUSE elements (identify reuse as-is vs adapt vs conceptual only); PRESERVE historical data/artifacts/records and shared functionality used elsewhere. Teacher identity/name is not identical to visual avatar fields.
3. Cover subtitles/transcripts, content/script, questions/feedback, pause/resume/replay, learning attempts/progress, teacher metadata/help if applicable. Never copy old wrong-maxAttempts unlock or picture/audio-clock controls into new authoritative cue gate.
4. Recommend no automatic legacy fallback for the new normal student video path. Missing/unavailable media should show clear unavailable/pending state and preserve position; must not count as viewed/completed or let untrusted UI claim completion. Separate historical compatibility requirements from new ordinary entry so user intent is met without deleting immutable history.
5. Source-target component mapping including platform/subject modular boundaries. Explicitly call out published completion/3 integration gap; do not claim existing development player already consumes it. No new auth/learning record system.
6. Propose small dependency-ordered implementation packets and required future tests; mark exact paths indicative vs frozen if publication/runtime contracts still unresolved. Identify needed evidence for production content/video assets/reference migration; no runtime collection now.
7. Plain Chinese conclusion, no repeated permission questions. Do not invent final architecture where unavailable facts determine it. Deliver concise complete WorkerReport and source references; no implementation.

## Contracts / Data / Security
MAY CHANGE PUBLIC CONTRACT: NO in this task; proposals requiring change must be called out for architecture gate.
DATABASE/AUTH/RLS IMPACT: NONE executed. Preserve existing source records and permissions.

## Acceptance / Validation
Traceable inventory + reasonable forward-only retirement strategy + explicit no-reappearance acceptance tests. Static only; no tests/browser validation claimed. Independent gate after report. Explain current unchanged state vs proposal.

## Parallelism / Escalation
Single inventory Worker, then dependent gate. No shared code writes. Worker is not alone and must not revert others. Scope insufficiency -> report only.

## Reports
CODEX_WORKER.md complete report; Gate outputs ALLOW/REVISE/BLOCK, alternative/reasons, compatibility/rollback, frozen requirements and recommended bounded next worker. Root makes final review.

## Supervisor final review — 2026-10-05
STATUS: COMPLETED (read-only inventory and migration direction only)
DECISION: PASS for bounded feasibility/reuse inventory and independent ALLOW of direction. No implementation or production readiness approval.
Worker report: /tmp/course-teacher-retirement-7m88ic0s/WorkerReport.md
Worker SHA256: f5a83750761e0c83ef81b0d9d03d77d88a1a60c43c4cb9ab41b5df0c2e9fc366
Architecture Gate: /tmp/course-teacher-retirement-gate-75tx1_dq/GateReport.md
Gate SHA256: 2cf1e73072bf218bd77becdd91203f83608d4c634d2db2ddf8691caf53513525
Accepted direction: retire old image/animation/speech-driven presentation and automatic fallback from the targeted Korean1 new-video authoring, publication, preview and ordinary learner route. Preserve teacher identity/name, course content, questions/private answers, feedback, history and existing attempts/progress/permissions. Reuse captions and controls only after adaptation to real video revision/time and a single media owner; do not reuse wrong-attempt exhaustion or text-as-ended completion as new mandatory cue authority.
Anti-reactivation must cover create/save/publish/preview/runtime, not just hide image UI. Author form video default and persisted new-node missing teacherVideo are distinct; never fix by globally reinterpreting legacy history. Gate clarification: release-check-actions lives in features/learning-agent-script-studio and rejects a release check with no video nodes, while its per-node loop skips legacy. Do not claim every wholly legacy release passes that check.
Sequence: freeze bounded current target/reference/asset map and explicit historical isolation; block new legacy authoring for that target; complete formally reviewed published completion-to-media binding; validate and forward-publish video versions before switching ordinary route; remove active legacy references; physical deletion only after all consumers and retained historical references are accounted for. No implicit legacy fallback on video error, missing media or rollback. No other-course/subject blanket disable.
Outstanding: current published video/media/cue/Activity/subtitle revision coverage and historical consumers NOT VALIDATED. Published completion/3 is not already consumable as the development media receipt. Exact service contract, target scope and writable implementation paths must be frozen before code changes; no new Auth or learning-record system. Historical data/assets not deleted or rewritten.
Actual operations: source/test/config edits0; live GUI/API/DB/network/tests/build/deploy/asset deletion0. Only private reports and Supervisor Task metadata written. git diff --name-only returned empty.
Next minimum task: bounded read-only current Korean1 publication/media/cue/Activity/history mapping and draft formal media-completion binding, then independent contract gate. Ordinary floating-teacher question testing remains superseded by the intended video-question workflow. No recovery/authority task resumed.
