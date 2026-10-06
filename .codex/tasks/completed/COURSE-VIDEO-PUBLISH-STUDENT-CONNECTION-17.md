# TASK — Course video publication and student connection

## Identity
TASK ID: COURSE-VIDEO-PUBLISH-STUDENT-CONNECTION-17
TITLE: Connect saved video pilot configuration to a forward published runtime and real student interaction
STATUS: COMPLETED — Supervisor PASS; Packets A/B/C code and bounded local validation PASS; production rollout NOT VALIDATED

## Routing
STATE RECOVERY: worker_high | GPT-6.1 Sol high
ARCHITECT GATE: REQUIRED | architect_gate | GPT-6 Astra xhigh
IMPLEMENTATION: pending Gate; complex security/data integration, choose bounded Astra high or Sol xhigh after contract freeze
VERIFICATION: verifier_critical | GPT-6 Astra xhigh
DISPATCH RECORD REQUIRED: YES

## Objective / Context
The user approved continuing video teaching with corresponding backend configuration. Task16 completed draft authoring/material inspection; Task14 completed the strict independent-readback native media consumer. Deliver the smallest coherent connection from saved explicit videoPilot configuration through publication, authenticated pinned student execution, existing Activity grading/durable completion, independent readback and the sole native media owner. Preserve all old history and old unconverted releases. Do not claim production rollout or actual content readiness from local implementation.

Current known gaps: native-publication-1 SQL and TS accept only empty configuration/no media; native-execution/1 fixes historical source scope; student session is legacy-only; published /3 reader requires genuine fresh Tool provenance. Existing sample01 is fixed owner-only pending-ingestion material, not a student MediaRef. These boundaries must be resolved honestly, not bypassed.

## Scope
CURRENT WRITABLE: Gate/Worker private report directories in /tmp only; root owns this Task metadata. No repository source authorized until exact accepted Gate paths/contracts are appended.
READABLE: Task14/15/16 archives/reports, actual directly related publishing/compiler/capture/fence, execution, learning session, existing Activity write/read authorization, routes, native runtime services/controller, fixed media helper, pertinent migrations/tests.
FORBIDDEN: credential/env reads, production DB/API/providers, R2 upload, deployment, runtime switch, commits/push, image/asset creation, modifications to prior evidence, AGENTS.md/CODEX_*.md/config/dependencies, unrelated recovery/SESSION Tasks. Never revert existing work. Gate may propose additive forward SQL migration but no DB application during design.

## Public Contracts / Security
Architecture Gate must freeze minimal new-version contract and exact partitioned scope before edits. Do not silently mutate /1 or /3 semantics. Do not fabricate Tool context/modelCallId/provider invocation/receipt. Prefer honest authenticated native-session provenance if genuine Tool invocation is inappropriate; preserve current /3 verbatim and explain consumer adaptation.
Reuse existing Auth/RLS/tenant/course permission and Activity grading/attempt storage; no second authorization/answer store. Browser feedback does not authorize playback; independent durable result read does. No global normalization/filtering of historical completion. Forward release pin must include definition/media revisions and prevent old attempts completing new video.

## Requirements / Gate questions
1. One explicitly opted-in node, one video, one pause-1 cue, one same-module existing single_choice Activity initially; incomplete draft remains blocked. No invented production cue/time/answer/transcript.
2. Compiler+SQL acceptance must agree; immutable content/media/Activity bindings and atomic source fence. Preserve existing publication/read history. No JS-only claim of DB enforcement.
3. Decide current fixed sample authorized student media delivery vs immutable existing media infrastructure; no absolute path in client, no public media auth bypass, no fake R2 object. Exact bytes/duration trusted server-side.
4. Resolve current legacy-only session scope with honest authenticated native release identity. Decide smallest versioned durable completion receipt integration without agent/provider work or fabricated provenance.
5. Reuse actual Activity domain write and independent read; cross-tenant/user/session/version/cue/revision mismatch fails. Wrong answer, duplicate/stale write/read, seek, refresh, timeout and user pause must retain safe player behavior.
6. New native route/component must be actual installable app composition, not only dependency-injected test harness. Keep ordinary existing release path until explicit new release selected/installed. Old avatar cannot render for new-mode marker.
7. Preserve accepted Task14/16 tests; rerun only newly affected tests. No full broad suites merely for confidence. Existing 55 build-copy typecheck errors remain distinct; no rootconfig workaround.
8. Clearly distinguish code complete, local validation, schema installed, media admitted, authored cue readiness, production publication and browser verification. Do not stop after design when an authorized bounded implementation can proceed.

## Required Gate output
ALLOW / REVISE / BLOCK; preferred path and rejected alternatives; exact contracts/schema versions; exact modify/add/no-change paths; phase/Worker split and dependencies; RLS/Auth/data/security impacts; local validation plan; compatibility/history/rollback; any actual user decision missing. If whole path must split, provide implementable connected tranche and explicit remainder, not repeated inventory.

## Acceptance / Validation (finalize after Gate)
Typecheck current src/tests no new diagnostics, lint touched paths, exact diff scope, meaningful compiler/fence/auth/session/write/read/controller integration plus browser common player proof; local-only SQL tests if migration scope/environment authorized. Real production NOT VALIDATED unless separately authorized and actually executed.

## Parallelism
No implementation before Gate. Parallel only frozen disjoint paths with no shared mutable state. Main security/schema integration serialized; independent UI only after contract frozen.

## Escalation / Reports
Any outside-scope changes require SCOPE_CHANGE_REQUEST. Workers read CODEX_WORKER.md; Verifier reads CODEX_VERIFICATION.md and accepted report. Supervisor only edits Task metadata. Completed prior work not repeated. All direct evidence/report paths, hashes, exact command exit codes, limitations and final Worker Report required.


## Supervisor accepted Packet A - implementation authorized
Decision: PASS for frozen Packet A design; implementation/validation not yet PASS. Exact list contains 12 source/test paths (7 ADD + 5 MODIFY). Reserved migration path does not exist before implementation. Worker owns only these paths, must record per-file baseline including existing Task14 changes. No source creation/promotion/production SQL allowed. B/C remain Gate-only and are NOT implementation-authorized.
Recovery report: /tmp/course-video-release-resume-17/WorkerReport.md SHA256 cad75d76bf4fadd1b7b087ff0a93750c9279431f116db4edfa80100929a71f78.
Gate A: /tmp/course-video-release-gate-17/PacketA-Frozen.md SHA256 374c6366af2908d23948bd76a854777606deeed44208ed00841d8816f9f83397. Full immutable spec embedded below.
Worker: course_video_publication_impl -> worker_astra_high | GPT-6 Astra high; read CODEX_WORKER.md; not alone, preserve all existing edits. Root does not implement.
Local verification permission: new/affected focused Node tests, touched lint, current typecheck with old55 baseline. Isolated PostgreSQL SQL tests may use at most one task-owned cached pinned17.6 container, no pulls, no host ports/mounts, network none, no external data/credentials; use synthetic rows and stdin. Inspect cached image first. If absent use NOT VALIDATED and report; no install/download. Exact ownership cleanup required. No production queries or schema installation. No rerun unrelated passed tests.
# Task17 Architecture Gate — Packet A FROZEN

Decision: ALLOW bounded implementation, code and isolated fixtures only. This file is immutable after handoff. No DB application, content creation, real cue, production pointer or route selection is authorized. Task14/15/16 accepted evidence is inherited, not rerun by this Gate.

## Exact write ownership

ADD:
- src/lib/smart-textbook-publishing/native-video-source.server.ts
- src/lib/smart-textbook-publishing/fixed-selected-media.server.ts
- src/lib/smart-textbook-publishing/native-video-publication.server.ts
- src/lib/smart-textbook-runtime-v1/execution-v2.ts
- supabase/migrations/202610050001_native_video_publication_contract.sql
- tests/course-video-native-publication.test.mjs
- tests/course-video-native-publication-sql.test.mjs

MODIFY:
- src/lib/smart-textbook-runtime-v1/execution.ts
- src/lib/smart-textbook-runtime-v1/contracts.ts
- src/lib/smart-textbook-publishing/artifact.server.ts
- src/lib/smart-textbook-publishing/publisher.server.ts
- src/lib/smart-textbook-publishing/capture.server.ts

No other existing source path is implicitly permitted. If typecheck identifies another real union consumer, report its precise path and minimal narrowing before changing it. Existing published-native-activity-read.server.ts already explicitly rejects anything except publish-foundation/2; preserve that guard. No new broad compatibility casts. Tests may share fixtures in the two named test files, without production importing them. Root must confirm migration name unused before implementation.

## Version dispatch and exports

New exact tuple: revision `publish-foundation/3`, publicationKind `canonical-native-video`, compilerVersion `native-video-publication-1`, privatePayload.contract `canonical-native-video-publication/1`, manifest.execution.contract `native-execution/2`. Keep manifest schemaVersion `1.0.0`, runtimeContract `uply-runtime/1`, compatibility `{profile:'native',adapterRevision:null}`. Unknown/mixed tuples fail closed.

native-video-publication.server.ts exports `projectNativeVideoPublicationCapture(input:unknown,scope:PublicationScope)`, `packageNativeVideoPublication(capture,scope)`, `certifyNativeVideoPublication(input:unknown)`, `NativeVideoPublicationBundle`, and the inferred capture/binding types. Export no DB authority or unsigned browser admission constructor.

artifact.server.ts adds this exact third discriminated bundle member and `requireNativeVideoPublication(bundle)`. `validateSnapshotBundle` has three explicit branches. `assertPublishableSnapshot` returns already-certified /2 or /3 only in separate exact branches; /1 still runs its legacy binding validator. `draftFromSnapshot` rejects /3 with `NATIVE_VIDEO_RELEASE_REQUIRES_NEW_VERSION`; it must not return an editable detached promoted-source object masquerading as the draft schema. Existing /1 and /2 behavior stays unchanged.

capture.server.ts adds `captureNativeVideoPublication(admin,actor,scope)` using the existing `capture_runtime_publication_v1` RPC once, then the /3 projector. It neither calls legacy readers nor reads mutable tables separately.

publisher.server.ts adds owner-only `compileNativeVideoPublication(scope)` and `publishNativeVideoPublication(scope,expected)`. Both use the fixed-media verifier and the one-capture /3 compiler; publish uses existing repository.publish and its CAS. No overload of old compile/publish functions admits video. No source creation occurs in this packet. A valid captured new-version source is an input; Packet C installs the owner promotion path.

## Captured promoted source: exact private schema

native-video-source.server.ts exports `nativeVideoSourceSchema`, `fixedSelectedMediaProofSchema`, their inferred types, and pure `parseNativeVideoSource(input)` only. Every nested object is strict.

`learning_agent_script_nodes.configuration` MUST equal `{videoPilotPublication:S}` with no other keys for this release. The source node must have no video/audio URL or asset columns, interaction JSON, speech/listening requirements, segments or branching; absent/null/empty legacy optional fields may be accepted exactly as by the /2 projector, never projected away when nonempty. video_mode remains database-supported `legacy`/absent; only the explicit new configuration+publication tuple selects the new runtime. Task16 configuration.videoPilot stays unchanged and draft-only; it is NOT accepted here.

S = {
  contract: 'video-pilot-publication-source/1',
  mode: 'video', state: 'promoted',
  origin: { teachingNodeId: UUID, scriptVersionId: UUID, draftDigest: HEX64 },
  approvedBy: UUID, approvedAt: ISO_DATE_TIME,
  media: FixedSelectedMediaProof,
  cue: { id: 'pause-1', atSeconds: finite number >= 0 AND < 30, activityId: UUID },
  captions: null
}.

`origin` identifies the original saved draft node/version; `draftDigest` is server-computed canonical digest of the original selected complete authoring node plus selected Activity/secret and association rows at promotion, never supplied as authoritative browser content. New source/cue reference the NEW cloned Activity ID. Packet C atomically validates the old save token and copies new rows without changing historical rows; origin is audit lineage, not live runtime permission and not a dependency on editing the old draft later. `approvedBy/At` are server-auth/DB values. SQL and TS validate syntax, exact shape and internal relationships; publication owner checks provide authority, hashes alone do not.

FixedSelectedMediaProof = {
  adapter: 'fixed-selected-host/1', assetId: 'course-video-sample01',
  sha256: '68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe',
  sizeBytes: 5487747, mime: 'video/mp4',
  videoDurationSeconds: 30, containerDurationSeconds: 30.016,
  revision: 'media-sample01-68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe'
}.

No path, object key, URL, host name or provider option is part of this proof. fixed-selected-media.server.ts contains the one server-only fixed path already used by Task16, `/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4`. Export `readFixedSelectedVideoSnapshot(signal?:AbortSignal):Promise<{proof:FixedSelectedMediaProof;bytes:Uint8Array}>`. It checks realpath equality, O_NOFOLLOW, regular file, exact bounded size and complete SHA256 from ONE descriptor, and returns exactly the bytes hashed. No path/asset argument, no cache keyed only by stat, no route bypass. It performs no authorization itself; only owner compiler/promotion or the authenticated session media boundary may call it. Missing/mismatched bytes fail closed. The old owner-preview helper and route remain unchanged. Every serving replica must have these exact bytes at that path; no claim of portable deployment follows.

## Exact cardinality, binding and capture

Exactly one textbook/version/chapter/module/execution node/Activity/teaching lesson/published script/source teaching node and one Activity secret in the existing capture. Exactly one matching published profile; profile secrets may remain in PRIVATE dependencies as captured, never emitted. Media-assets/listening/audio/interaction-secret/chapter-test arrays must be empty. Book/version/chapter/lesson/script/profile must have published status. All parent IDs and subject/profile associations must agree. The sole Activity is existing-model single_choice, options 2..100, max_attempts 1..20, counts_toward_completion TRUE, exact supported public_config {shuffle?:boolean,showScore?:boolean}; private answer_key {kind:'index',value:integer in range}. Execution node content is {}; source action_type focus_activity; reference_activity_id equals S.cue.activityId; source next/remediation null/absent; Activity and source share module via actual graph. No external Activity, anonymous option, duplicate ID or extra uncaptured node allowed.

Private binding exact keys:
{ activityId, activityAlias, executionNodeId, sourceTeachingNodeId, moduleId, teachingLessonId, scriptVersionId, scriptVersion, countsTowardCompletion:true, activityRevision, mediaRef, mediaRevision, cueId:'pause-1' }.
IDs derive from captured rows, never reallocated during compile. activityAlias = activity_key. activityRevision is `activity-` + digest of ALL public Activity semantic fields (id, type, prompt, instruction, options, public_config, max_attempts, counts_toward_completion), never answer key/secret. Entire raw capture and promoted source enter PRIVATE seal and captureDigest. A change to grading/private policies must change the private seal and fail the old fence; real rollout must create another new version/new Activity ID.

## Manifest and execution /2

One step id = source teaching node UUID; exactly two blocks: `video-${sourceId}` in teaching and `choice-${activityId}` in interaction.main. Public mediaRef id = `video-${sourceId}`; mediaRef kind video, readiness ready, proof revision, no URL/path/private proof. Public choice activityRef remains captured Activity UUID, choice options `option-0`..`option-(n-1)` preserving order and localization. Activity prompt/instruction/options/settings must exactly project source. Manifest title uses authored title; do not generate decorative labels/transcript or avatar. teacherRefs empty, no compat blocks. Layout split initially; navigation one-step, free/linear, autoAdvance false. Runtime targets: video play/pause/focus as supported existing contracts; choice reveal/focus with server-attempt and response-submitted. Completion uses existing chapter/node/activity progress refs and server authority. Required capabilities include video, multiple choice, layout/navigation/progress, `timeline.cue.v1` and no unsupported extras.

execution-v2.ts exports `nativeExecutionV2Schema`, `NativeExecutionV2`. Its exact shape mirrors /1 except:
- contract literal native-execution/2;
- scriptVersion integer >=1, taken from the actual captured script;
- sourceNodes length EXACTLY 1, nodeNumber integer >=1 from actual source sort_order;
- sourceNodes item exact {nodeNumber,binding:HEX64,rowHash:HEX64,blockIds:[videoBlockId,choiceBlockId]}; blockIds exactly 2 distinct;
- media length EXACTLY 1, existing item shape {blockId,revision,durationSeconds}; duration=30;
- cues length EXACTLY 1, existing strict timelineCueSchema; id pause-1, triggerTime exactly S.cue.atSeconds, target/source/step/media associations exact;
- targetAlias `native-video-${chapterId}`; lessonBinding=digest({teachingLessonId}); scriptVersionBinding=digest({scriptVersionId,scriptVersion}); node binding=digest({sourceTeachingNodeId}); rowHash=digest({title,activityRevision,mediaRef,mediaRevision,cue}) using PUBLIC projections only;
- initialLayout split.

execution.ts retains /1 schema unchanged, adds a disjoint union used by LessonManifest, and exports NativeExecution as the union. Keep the old exported nativeExecutionSchema accepting /1 unless existing contract ownership demonstrably requires the alias to be union; prefer new `anyNativeExecutionSchema` for contracts.ts. The validator dispatches first, retaining exact /1 checks (including sourceNodes 5/7). /2 checks cardinality, source block coverage, one source/step, IDs, capability/target/Activity/media readiness/revision, finite cue time STRICTLY LESS THAN duration. Unknown contract rejected. No native /1 evidence gets relabeled /2.

Envelope /3 otherwise uses the same envelope keys as /2: snapshotId prefix `snapshot-native-video-` + UUID, scope, schemaVersion, runtimeContract, manifestDigest, sourceRevision, compilerVersion, manifest, privatePayload, privateDigest, pins:{captureDigest,sourceRevision},seal. PrivatePayload exact {contract,source,bindings,dependencies,result:{manifest,report:{sourceRevision}}}; `source` is the typed projection of the above captured graph including promoted source; `bindings` length1. Public content digest uses semantic manifest excluding snapshot, never secrets or a hash of secrets. sourceRevision/privateDigest/seal use existing canonical digest internally. Certifier reprojects the same raw capture and compares source, binding and complete semantic manifest, not just self-consistent hashes.

## Forward SQL — frozen seams and no recursion

Do NOT edit any prior migration. New migration only:
1. CREATE OR REPLACE runtime_publish_private.publication_version_admitted(jsonb), preserving /1,/2 expressions exactly and adding exact /3 tuple.
2. Replace named snapshot_version_kind constraint with original /1,/2 branches unchanged plus exact /3 document tuple. Fail if prerequisite named constraint/functions differ; no wildcard dropping of unrelated checks.
3. ADD runtime_publish_private.native_video_admission(b jsonb,c jsonb) with the above exact one-node cardinality, strict source/proof/cue/Activity/secret and manifest-binding checks. It must compare all authorable semantic manifest fields to capture (prompt/instruction/options/settings, title, graph, cue, duration/revision/IDs/completion/capabilities) and reject unknown keys/unsupported media; direct service-role RPC cannot publish mutated cue/Activity/private binding by merely recomputing hashes. It must require public media only and no leaked private source/secret in manifest. Use JSONB structural equality for projection rather than inventing a second ambiguous canonical digest algorithm. Do not widen native_admission /2.
4. CREATE OR REPLACE public.publish_runtime_snapshot_base_v2 with its current full body unchanged except explicit /3 -> native_video_admission alongside existing /2 -> native_admission. Order remains owner_guard -> authoring_lock -> one capture -> exact dependencies equality -> corresponding admission -> existing grader coverage -> publish_runtime_snapshot_v1 -> insert fence. Rollback retains existing fence requirement. Outer public.publish_runtime_snapshot_v2 remains unchanged, as do runtime_publication_session_v1, lease, authoring lock/control, old edit-window and retirement behavior. No rename/wrapper delegation to the same name; no wrapper recursion; no stripping unknown revision to legacy.
5. Preserve/reapply grants: new private function executable by no public/anon/authenticated/service_role, public base/v1 private, service role only outer v2. No new tables, content rows, RLS policy changes or authoring_control row insertion. No schema edits to versions; these would change select-* dependency captures for historical versions.

SQL may validate semantic fields with exact targeted JSONB construction; full JS seal recomputation in SQL is not required. The mandatory security properties are exact current capture, public/private association, fixed literal media and tight type/version admission. TS certifier remains mandatory for all server consumers and repository operations.

## Acceptance and next packets

Meaningful A tests: valid TEST-ONLY one-node fixture; all missing draft/promoted fields; wrong media/hash; malicious capture association/secret/options/cue boundary; /1 and /2 unaffected; mixed compiler/private tuple rejection; private data absent from manifest; full re-signing of altered semantic manifest rejected; execution /2 no 5/7 fabrication; publisher owner+one capture+CAS/fixed-media failure. Isolated SQL test must exercise direct outer RPC admission rejection and valid capture/fence/CAS, preserve old /1-/2 fence/session/history across new graph insertion, no edit window. SQL source tests alone are NOT SQL execution evidence. Missing isolated DB: report NOT VALIDATED, do not use production. Baseline existing build-copy diagnostics remain separate.

Recommended Worker: worker_astra_high | GPT-6 Astra high. Verification: verifier_critical | GPT-6 Astra xhigh. Worker reads installed Next documentation before any Next code (none newly added by A), CODEX_WORKER.md and parent Task. It must not fill genuine course cue/content from fixtures.

Next frozen interfaces (not A write authorization): B consumes requireNativeVideoPublication and private binding/source to mint authenticated `activity-completion/4` with completionMode `native-published/4`, never Tool /3. C consumes same source schema and fixed-byte reader for owner promotion, session media, and native entry; legacy full-version pins MUST be installed before any sparse published graph is created. Source authoring IDs are newly allocated by C, not by A compiler. Exact B/C protocol and paths are in the final Gate report.



## Supervisor Gate review and local verification clarification
Full Gate design: PASS for sequential A/B/C technical design. /tmp/course-video-release-gate-17/GateReport.md SHA256 19f2e25eccddb4e32b21b28d2d3d1c275d88920d043679287aa472ce5bb43610. Packet A remains the only currently implementation-authorized packet; B/C must be dispatched and scoped after A verification. Old /1-/3 behavior and original history remain strict; no fake Tool provenance. No production rollout or source cue fabricated.
User decision: real pause time/question will be configured later in administration. Continue code and isolated fixture validation independently; live draft incomplete blocks publication.
Packet A local resource clarification: first owned container a3ab06e06bfc3c2fea15bfa2015e623bf4f92ad57d942da08b33f7d18cba5997 exited127 due wrong PostgreSQL binary path; actual PG instances0, SQL0. Worker must retain failure evidence, remove only this exact owned stopped container, inspect correct fixed-image path, and may make one corrected start. Maximum simultaneous owned containers1, actualPGinstances1, total creation attempts2. No pull/ports/mounts, networknone and no production unchanged. No permission to suppress real SQL failures/retry semantics.


## Packet A implementation freeze / independent verification
Supervisor: REVISE for execution-scope deviation and incomplete final-revision tests; source correctness not prejudged. Worker froze all12 files and cleaned exact-owned PG17.6; unrelated containers untouched. WorkerReport /tmp/course-video-publication-impl-17/WorkerReport.md SHA256 f7a47e40000296a201e58bfcee966828da82b48907b68eb7daf1d4ab194b0cac. Incident.md SHA256 e646b884b96a600dec26c76411c6fd1820be58aece32de2a3ccb68295c29c767. Frozen hashes60d87b4708b28501168406399ec883b01b1738dca7e7244a631031ee234959f3; diff b83bdca688b26153522e5c08c3a4011ed465521e5d9cf1db7d9eb1d28246bd31. Directed raw83 predates accidental legacy-suite invocation; accidental111 NOT_ACCEPTED, actual accidental creation/pull totals unobservable, do not claim zero. Final13 SQL negatives and fixed-reader test NOT_VALIDATED.
Independent verifier may read all these artifacts/current12files/direct dependencies and write only private /tmp report/tests. No repository writes. Preflight inspect exact test imports/commands before executing; never whole old foundation suite or automatic fixture container launch. One fresh verifier-owned PG17.6 container total, exact cached image sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f, correct /usr/lib/postgresql/bin path, --pull=never, networknone, no ports/mounts, synthetic stdin, identity label, cleanup. Existing new SQL file takes explicit owned-container env and must never create one. Verify that before use. No retry cluster. Fresh new final-revision directed tests, minimal impacted non-DB regressions, lint/whitespace and source fingerprint; use raw subprocess exit, not tail's exit. No production/realcredentials/deploy/publish. Review incident transitive-import risk from source only, not rerunning accidentalcommand; acknowledge unknown counters. B/C remain unstarted until A code+scope review closed.


## Packet A Revision1 - four-path timestamp correction
Supervisor: REVISE based on V17-A-01 in independent Report82cafb0e389c29710d59f35c4c836be21ea36f32b2a9ff0f927440cb7b8667d9; Evidence fc99be0e6c9741d26d8c3120e401f331cf221ad7ed28927efe2c76314babb168. Independent97/97 and other boundaries stand but do not override this finding. Verifier completed/cleaned onlyownedPG, source frozen.
Accept targeted Gate25ec409a3cf94e39173c3ab6eb64433a060ab36094dc109dba7af8bd74d79d36: PASS design. Authorize original implementation Worker to modify ONLY the four paths listed in immutable addendum below; all other8files frozen. Existing report/incident/verification bytes immutable.
New local check authorization: inspect exact command/imports first; one task-owned new cached PG17.6 container total1creation, fixedimage sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f, --pull=never networknone noports/mounts. Correctknownbinarypath, exactlabel/fullIDcleanup. Before using requiredfixedname prove absent then additionaluniqueRevision1label. Run only tests/course-video-native-publication-sql.test.mjs (imports all new TS unit), directprocessrc/stdout/stderr/hashes. No old foundation suite or implicitclusterfactory. Narrow lint/typechecking/whitespace; do not rerun other predecessor suites. Rawfailedtest evidence retained; neededcodefix rerun uses same ownedcluster, no replacement. Noproduction/credentials/env/deploy/publish. Worker submit Revision1 report+hash/diff/beforeafter/cleanup then stop for independentverification; B/Cstillunstarted.
# Task17 Packet A — approvedAt timestamp contract addendum

Decision: **ALLOW** the bounded correction below. Current implementation requires this correction before Packet A can pass the timestamp contract check. This addendum freezes only `video-pilot-publication-source/1.approvedAt`; it does not reopen the wider Gate.

Profile: architect_gate | GPT-6 Astra xhigh. Date: 2026-10-05. Original GateReport.md and PacketA-Frozen.md remain immutable. Their generic ISO-datetime wording for this ONE field is narrowed by this addendum. No other receipt, session, deadline, snapshot or history timestamp changes.

## Evidence and limitation

Read directly:

- `src/lib/smart-textbook-publishing/native-video-source.server.ts`: approvedAt currently uses `z.iso.datetime()`.
- `supabase/migrations/202610050001_native_video_publication_contract.sql`: native_video_admission currently requires seconds with optional variable-length fractional digits, then performs a timestamptz cast.
- Both existing Packet A test files and `/tmp/course-video-publication-verify-17/date-contract-probe.json`.

The supplied verifier probe establishes that `2026-10-05T00:00Z` passed the TS source schema and compiler/certifier but did not match the SQL required pattern. This is an actual producer/admission domain mismatch. The probe also shows SQL PATTERN matches for 24:00 and seconds=60 while TS rejects them; it does NOT demonstrate that actual SQL admission/casting accepts those values. This Gate did not run tests, imports, DB, env or network operations and makes no claim about unexecuted reverse cases. Parent's existing SQL test result is inherited evidence, not proof of timestamp equivalence.

## Exact authorized correction scope — four paths only

1. `src/lib/smart-textbook-publishing/native-video-source.server.ts`
2. `supabase/migrations/202610050001_native_video_publication_contract.sql`
3. `tests/course-video-native-publication.test.mjs`
4. `tests/course-video-native-publication-sql.test.mjs`

Changes are limited to the approvedAt validator, its local SQL declarations/checks, and meaningful timestamp cases. No shared timestamp helper/export, new dependency, changed capture/hash algorithm, other compiler file, new migration, grant, SQL wrapper, trigger, fixture module or general date cleanup is authorized. Necessary additional paths require an exact scope request first.

The named SQL file is the NEW, still-unreleased Packet A candidate migration, so correcting it is allowed here. This is not permission to edit an installed historical migration. No migration is applied as part of this Gate.

## The one accepted domain

The value MUST be an unchanged JSON string of exactly 24 ASCII characters:

```
YYYY-MM-DDTHH:mm:ss.sssZ
```

- Year: exactly four decimal digits, numeric range 1..9999. `0000` is forbidden.
- Calendar: proleptic Gregorian; month 1..12; day 1..actual days in that month.
- Leap year iff `(year % 4 === 0) && (year % 100 !== 0 || year % 400 === 0)`.
- Hour 00..23; minute and second 00..59. No 24:00 or leap-second spelling.
- Fractional seconds: exactly three digits 000..999.
- Literal uppercase `T` and terminal uppercase `Z`; no offset, whitespace, newline, sign, extended year, alternative separator or missing component.

This is a FORMAT/CALENDAR contract, not an approval freshness rule. Valid old/future dates within the stated year range are structurally admissible. Existing authenticated owner/source-promotion logic supplies the real approval actor/time. Do not add comparison to current time here.

## Minimal identical validation algorithm

Use the same two-stage algorithm in TS and SQL. Do not repair or normalize input.

Stage 1: require string type, exact length 24, and this ASCII shape/range pattern (shown as a regex, not a language-specific quoted string):

```
^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$
```

Stage 2: only after Stage 1 succeeds, extract year/month/day integers. Reject year zero. Compute daysInMonth from `[31,28,31,30,31,30,31,31,30,31,30,31]`, replacing February with 29 for the above leap-year rule. Require day <= daysInMonth. The shape already enforces positive month/day and all clock component ranges.

TS implementation: a private predicate/local schema in the named source file, used as the approvedAt string refinement. Guard shape/length before slicing/converting; use non-global regex. Return the original string unchanged. Keep inferred approvedAt type string and existing exports. Do not depend solely on z.iso.datetime precision settings or JS Date's parser/calendar rollover, and do not add a transform/coercion/trim/pad/toISOString conversion to the authoritative input.

SQL implementation: local variables in existing native_video_admission, with an explicit `jsonb_typeof(source->'approvedAt') IS DISTINCT FROM 'string'` failure and length/pattern checks. Parse integer substrings only in a subsequent block after those checks; do not put unchecked integer casts in the same OR expression and assume evaluation order. Use the same Gregorian arithmetic/CASE or array. Reject shape, year or calendar failures using the existing `NATIVE_VIDEO_PROMOTION` error. Replace the existing loose timestamp pattern and remove the standalone `PERFORM ...::timestamptz` as the validator. No date/time cast, `to_timestamp`, permissive parser or timezone setting is needed to establish this domain.

The exact length check is mandatory in both languages even with anchors; it closes trailing-newline/end-anchor differences. ASCII `[0-9]` avoids dialect-dependent digit classes. Bounds are small, so both implementations use exact integer arithmetic without time-zone, numeric-overflow or date-range dependencies.

## Required positive and negative acceptance

All values below are TEST ONLY, never production approval content. Both TS and actual isolated SQL must accept/reject the same case matrix. Cases may be grouped to keep the existing two test files concise; no new fixture path is needed.

Positive minimum:

- `0001-01-01T00:00:00.000Z` — lower year boundary.
- `0004-02-29T00:00:00.001Z` — early leap year without JS 0..99 year conversion quirks.
- `1900-02-28T23:59:59.999Z` — nonleap century valid last February day.
- `2000-02-29T12:34:56.789Z` — leap century.
- `2024-02-29T12:34:56.000Z` — normal leap year.
- `2026-04-30T23:59:59.999Z` — 30-day month boundary.
- `2026-10-05T00:00:00.000Z` — existing canonical fixture.
- `9999-12-31T23:59:59.999Z` — upper year boundary.

Negative minimum categories (use these concrete representatives):

- Missing precision/components: `2026-10-05T00:00Z`, `2026-10-05T00:00:00Z`, and fractions `.0Z`, `.00Z`, `.0000Z` on the same complete date/time.
- Calendar/year: `0000-01-01T00:00:00.000Z`, `0001-02-29T00:00:00.000Z`, `1900-02-29T00:00:00.000Z`, `2100-02-29T00:00:00.000Z`, `2026-02-29T00:00:00.000Z`, `2024-02-30T00:00:00.000Z`, `2026-04-31T00:00:00.000Z`, month `00`/`13`, day `00`.
- Clock: `2026-10-05T24:00:00.000Z`, `2026-10-05T00:60:00.000Z`, `2026-10-05T00:00:60.000Z`.
- Offset/case/layout: `2026-10-05T00:00:00.000+00:00`, lowercase `t` or `z`, space replacing T, leading/trailing space, terminal newline, signed/extended year (`+002026` or `10000`), and a non-ASCII digit replacing a digit.
- Type: null, number, missing field. Existing missing-field coverage may be reused if its assertions are explicit.

TS tests exercise the exported source schema AND package/certifier path. Canonical positive inputs must round-trip byte-for-byte in captured/private source; an invalid value must be rejected, never emitted in normalized form. Include a malicious re-signed invalid approval source to show the certifier revalidates it rather than trusting seal consistency.

SQL tests must call the actual isolated outer publication RPC/admission against a freshly matching current capture. For timestamp negatives, mutate only the unfenced TEST graph's approval value, capture again, use a TEST-ONLY malicious bundle/re-sign helper as necessary to bypass TS rejection, and require the date-specific `NATIVE_VIDEO_PROMOTION` rejection. A generic PRIVATE_SOURCE/CAPTURE_CONFLICT failure, JS regex match or caught arbitrary SQL exception does NOT prove timestamp rejection. Do not rely on compiler rejection as SQL coverage.

For positive variants, compile the matching capture, invoke real SQL admission/publication in an isolated rollback transaction or independent unfenced fixture scope, and verify exact stored JSON timestamp if storing within that transaction. Keep successful publication fences from preventing later test setup mutations; restore test graph before the existing final publication/history assertions. Tests must not mutate a fenced production graph or relax original immutable-fence checks. SQL parser/cast behavior for 24:00/leap seconds is irrelevant after explicit shape/range rejection; record actual new SQL rejection results rather than claiming the old behavior was measured.

After this localized correction, run the two affected Packet A tests and already-required narrow type/lint checks as appropriate. No broad rerun is authorized by this addendum alone. If isolated SQL cannot run, mark its acceptance NOT VALIDATED and do not infer a pass from source tests.

## Version and future promotion decision

No contract-version bump is required under the stated facts: this new /3/source /1 family is not deployed and has no real published artifacts. This is a pre-release consistency correction to its single frozen contract, not a compatibility adapter. Keep all revision/compiler literals unchanged; do not accept the old loose spellings as aliases. The existing canonical `.000Z` synthetic fixture already belongs to the final domain. If implementation discovers an actual deployed/persisted production artifact using a rejected spelling, stop and report that specific fact before applying this assumption; do not silently rewrite signed/captured data.

Packet C's future DB-owned promotion MUST generate this exact spelling from trusted fresh DB time. A suitable producer expression is:

```
to_char(
  date_trunc('milliseconds', clock_timestamp() AT TIME ZONE 'UTC'),
  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
)
```

Generate once for the new source and validate/store the resulting string. This truncates DB microseconds when PRODUCING new metadata; it is not permission to normalize an existing submitted/captured approvedAt. No C file is authorized for editing by this four-path repair. No additional user content/decision is needed.

Gate evidence status: static targeted review only; implementation and new tests **NOT VALIDATED** by this Gate. Supervisor may route the exact four-path repair, then obtain independent verification of the matched domain.



## Packet A Revision1 independent verification authorization
Revision1WorkerReport final SHA25685692b5b88c6c79fa29853e9ca6f4ab95557ce9e09744672016277622488b483 (Worker explicitly superseded preliminary0c6e report before final handoff; source hashes unchanged). Revision1.diff03f9c84a7e4268f574d37897d1bd7318c8c746d8b0fd06cddaac15aa14735cf8; source-after c6d1db2b7d7471881617b1686dff1ead967a5d490fdb10c0f6a6be3f2077cdd6. Worker175/175 directexit0, exact8positive/31negativeSQL, cleanup; pendingindependentacceptance.
Authorize original critical verifier R1 targeted followup: read actual4pathdiff+TimestampAddendum and finalreport, inherit allunchanged8path/baseline97 evidence, do not wholeprojectrescan. One new unique-verifierlabel cachedPG17.6 container total1create, samefixedimage/no pulls/networknone/noports/mounts/correctbinary/knownfixednameabsent/fullIDcleanup as original verifier protocol. Run only finalnew SQLtest once (includesunitcases), rawprocessrc+streams/hash, no otheroldDBharness. No repositoryedits/production/credentials/B/C. Narrowstatic/lint/type evidence check, explicit TS/actualSQL date domain parity and no timestamp normalization; per-originalGate otherreceipt timestamps unchanged. Write new Revision1VerificationReport/Evidence only, preserve originalreport. Complete and stop for Supervisorreview.


## Supervisor Packet A PASS / Packet B implementation authorization
Packet A: PASS at code and bounded local verification; V17-A-01 CLOSED. Independent Revision1Report ea4131ecb8b187695a3cc396471aacaded23af762863f4d5e4422d988f82581e; Evidence73db4c70292ed0f3345d33250dddc467145aa674a2750bde1414648aaa419106. Independent175/175 realexit0; current-host fixedbyte positive inherited; cleanup complete. Original execution deviation remains recorded and unknown historical counters remain unknown. No production installation or content publication implied.
Packet B: IMPLEMENTING authorized now only after A acceptance. Full immutable GateReport19f2e25eccddb4e32b21b28d2d3d1c275d88920d043679287aa472ce5bb43610 sections4B/5/7/8 are normative. TimestampAddendum applies only A/C approvedAt; do not change /4 receipt timestamps. Worker: worker_astra_high | GPT-6 Astra high. Critical independent verification required.
EXACT ADD:
- src/features/smart-textbook-runtime/server/native-learning-session.server.ts
- src/features/smart-textbook-runtime/server/native-published-transport.server.ts
- src/features/smart-textbook-runtime/server/native-published-activity.server.ts
- src/features/smart-textbook-runtime/core/native-published-media-contracts.ts
- src/features/smart-textbook-runtime/core/native-learning-session-transport.ts
- src/app/api/smart-textbook-runtime/native/route.ts
- supabase/migrations/202610050002_native_video_session_activity.sql
- tests/course-video-native-session.test.mjs
- tests/course-video-native-completion.test.mjs
- tests/course-video-native-atomic-sql.test.mjs
EXACT MODIFY:
- src/features/smart-textbook-runtime/core/execution-contracts.ts
- src/features/smart-textbook-runtime/core/services.ts
- src/features/smart-textbook-runtime/core/native-media-controller.ts
- src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts
All other source, A12files, original /3 Tool/receipt contracts, Auth/RLS/schema/table, old attempt RPC body, agent-core/config/dependencies/credentials/history are forbidden. Read exactTask/Gate/Worker manual and relevant installedNextdocs. No copies of oldfallback into nativewriter, no simulated Tool lineage, no browseridentity/grade trust. Current source/test baseline must preserve Task14/16/A. Required new native-only attempt INSERTguard is specifically Gate-authorized; no broader RLS redesign.
Future C needs Response stream authorization lifetime: withNativeLearningSession must hold its authority/lease until privileged byte I/O and returnedResponse stream close/cancel, exactly as Gate6 demands; no premature finally release or artificial force-clear. Resolve within frozen export/ownership or report targetedcontractrequest before broadening.
Local validation: inspect/enumerate exact proposedtest entrypoints/hookimports before execution; submit commandlist toSupervisor. Only three newBtests + directly affected existingpure controller/submission/regression cases; never implicitoldDBfactories. No broad oldfoundation/fullprojecttests. One ownedcachedPG17.6 container maximumconcurrent1 totalcreation1, exact86a...pinnedimage, --pull=never networknone noports/mounts, correctknownPGpath, minimalenv syntheticstdin, ownershiplabel/fullID/finallycleanup. RealSQL uses unchangedexistingrecord_smart_textbook_attempt + newwrapper/guard; mock cannotreplace. Missingenvironment reportsNOT_VALIDATED; no downloads, replacementclusters orproduction. Sourcefixes mayneedrerun appropriatecases on sameownedinstance; preserve failures and realexitcodes. Typecheck/lint scoped, inherited55buildcopydiagnostics distinct. Bnohostmedia/prodURLreads required. No content/promotion/registry/routeUI installation (Cpending).
Required acceptance covers Gate5/8 auth+RLS/fence+lease/idempotency+nativeonlywriteguard+independentdurableread freshness/strict/4+onecontroller and oldmodes preserved. Actualprovider/production NOT_VALIDATED. When codefrozen deliver completeWorkerReport/hash/diff/baseline/resourceproof and stop forindependent review. Do not startC.


## Supervisor Packet B native-history addendum acceptance
Decision: PASS for targeted design; implementation/runtime acceptance remains pending. Bind NativeHistoryAddendum.md SHA256 5dfe8bbdc359174c1c41a0eaff3fb93ea17b8594c86f643c695528201da58a3d. Adopt only proposal 1 and all clauses below. Exact Packet B paths remain unchanged; no new private-table grants or public DTO changes. Existing expired/revoked origin is private historical proof, never current authorization. Current session lease and permission checks remain mandatory.

# Task17 Packet B — original native attempt session verification

Decision: **ALLOW proposal 1 only**, with the exact bounded contract below. The rest of Packet B may continue. This closes one private history-association seam; it does not reopen A, the wider Gate, Auth or release policy.

Profile: architect_gate | GPT-6 Astra xhigh. Date: 2026-10-05. Original GateReport.md, PacketA-Frozen.md and TimestampAddendum.md remain immutable. Packet A's independent PASS is accepted from the parent (R1 report hash `ea4131ecb8b187695a3cc396471aacaded23af762863f4d5e4422d988f82581e`); it was not rerun here.

## Finding and choice

The frozen Gate requires private runtime tables to remain inaccessible to service_role and permits valid new sessions to restore attempts written under expired/revoked original sessions. Existing runtime_publication_session_v1 correctly refuses expired/revoked locators and cannot serve that historical lookup. A current-bundle-only native RPC result leaves the fixed service-role transport without the original private bundle needed for actual TS certification.

Select the narrow server-only result expansion, not an SQL-only claim of certification. SQL must establish the real original-session/storage association and bounded disclosure. The existing Packet A `certifyNativeVideoPublication` must actually validate each original bundle in TS. Comparing SQL revision strings or apparent graph JSON is not a substitute for that certifier. Proposal 2 is therefore rejected: its smaller return shape leaves that required certification unperformed unless more logic/privileges are introduced.

Read evidence: original private sessions/snapshots/bindings schema, existing repository/session behavior, and the frozen Gate's exact B clauses. The proposed B source/migration/test files were not yet present at their shared-checkout paths when probed; this is a contract addendum, not a review or PASS of their implementation. No tests, SQL execution, DB/env access or source edits were performed.

## Exact private RPC contract

Keep the name, arguments, SQL role and privileges of the already authorized new RPC:

```
public.read_native_video_session_v1(
  p_actor uuid, p_tenant uuid, p_session uuid,
  p_lease uuid, p_expected jsonb
) returns jsonb
```

Its one result shape is now STRICT:

```
{
  bundle: unknown, // CURRENT admitted session's complete private /3 bundle
  attemptOrigins: [
    {
      sessionRef: "learning-session-" + UUID,
      actorId: UUID,
      tenantId: UUID,
      bundle: unknown // ORIGINAL session's complete private /3 bundle
    }
  ]
}
```

`attemptOrigins` is required, length 0..20, exactly one item per distinct original sessionRef appearing in the COMPLETE exact current actor/tenant/version/Activity attempt set. No duplicate sessionRef or unreferenced extra item is permitted. A current session that has its own attempts appears as an origin too. Zero attempts means an empty origins array. Stable lexical sessionRef ordering is recommended for deterministic results; set membership/uniqueness, not order, is the integrity rule.

The two object levels reject unknown keys. TS initially treats bundle values as unknown and then runs the actual certifier. Do not add a new bundle version, HTTP DTO, RPC argument, client-selected origin list, table, direct private-table grant, token, endpoint or history API.

The private native_video_session_guard keeps its original current-session bundle result, so native write/trigger callers need no result-shape change. Only the NEW read RPC wraps that returned bundle and appends origins. No fallback accepting the old bare-bundle RPC result is allowed; this new RPC is not deployed and has no compatibility obligation to a previous result shape.

## SQL responsibility — storage association and bounded disclosure

Inside the existing SECURITY DEFINER read RPC, with fixed empty search_path and SELECT-only behavior:

1. Invoke the existing private current-session guard first. It still requires active owned current session, current authorization lease, exact expected binding, expiry, current fence/control/retirement rules. An expired/revoked current session cannot use this RPC to inspect history.
2. Derive textbook/version/node/Activity IDs from that admitted current bundle. Read the entire attempt set with exact p_actor + p_tenant + admitted versionId + sole ActivityId. Do not obtain an Activity, origin locator or snapshot selector from an added argument. Enforce count <=20 and the current admitted max_attempts. Do NOT LIMIT/truncate an oversized set and then treat the subset as valid.
3. Require each row's response to have a syntactically valid native original sessionRef and snapshotId. Malformed or missing origin metadata is an integrity error, not a row to ignore. Detailed full response/grade checks remain mandatory in TS below.
4. For every distinct referenced original locator, look up the EXISTING sessions row by its UUID and require actor_id=p_actor and tenant_id=p_tenant. Join its actual snapshot_id to the immutable snapshot and private bindings with `bindings.snapshot_id=snapshots.id`, `bindings.digest=document.privateDigest`, and consistent document snapshotId. For every referencing attempt, response.snapshotId must equal this actual original session.snapshot_id. Require the original /3 tuple and same textbook/version/chapter scope as the admitted graph before returning private content. No unrelated or foreign tenant/actor bundle is returned even to this server-only result.
5. Reconstruct the original bundle exactly as existing repository/session code does: immutable public document plus its matching privatePayload. Original expiry/revoked status is intentionally NOT an exclusion. No original live lease, current pointer or current-session RPC lookup is required. This is reading immutable historical evidence, not reactivating the original locator. The CURRENT session's live authority remains mandatory.
6. Return all required origin items exactly once. Missing original session/snapshot/private binding, digest-link mismatch, foreign ownership/scope, conflicting response snapshot IDs for one session, unsupported namespace or duplicate/missing mapping raises a private integrity error. Use explicit completeness checks/LEFT JOIN checks or equivalent; an INNER JOIN that silently drops a missing origin is insufficient.

SQL does not claim to verify the JS canonical seal or TS semantic certifier. Its role is authoritative selection from protected stored rows and real relation checks. No exception handler may convert a missing origin to `[]` or an INCOMPLETE success.

Private table permissions stay revoked for service_role, authenticated and anon. The new read RPC alone remains executable by service_role and denied to authenticated/anon/public. Existing session resolve/revoke policy remains unchanged. Errors are scrubbed by the existing native HTTP boundary.

## Transport responsibility — actual certification and complete history validation

All steps below occur on the fixed verified DB connection in the SAME existing REPEATABLE READ READ ONLY transaction, under SET LOCAL service_role. Keep current server auth/lease, database-identity check, deadline/abort and successful-COMMIT requirements.

1. Strictly parse the expanded read RPC result. Run Packet A's actual `certifyNativeVideoPublication(rawBundle)` for the CURRENT bundle and compare the frozen expected current snapshot/digests/authority. A type assertion or requireNativeVideoPublication alone is not certification.
2. Read the existing complete facts plus native response-envelope rows with the identical actor/tenant/version/node/Activity predicates. The origin enumeration and these facts therefore share one MVCC snapshot. A concurrent write cannot appear in one but not the other; a fresh later read may observe it normally.
3. Validate ALL attempt envelopes, not a filtered subset: exact native-video-choice-response/1 shape, requestId/sequence, option index, response snapshot/session/cue/revisions and grade/score consistency. Require that the distinct referenced sessionRef set is exactly the origin result set. Reject extra/unreferenced/duplicate origins and any missing one, even if SQL is expected to have checked them. Compare each origin actorId/tenantId to the authenticated current actor/tenant.
4. For EVERY original origin bundle, call `certifyNativeVideoPublication` on its actual full value. Within this transaction it is acceptable to memoize a successfully certified identical raw bundle/snapshot for multiple origins; never use a cross-request/process cache or assume equal snapshotId means an unchecked payload is equal. At minimum validate each returned raw payload before reusing a memoized result.
5. Require the certified original snapshotId to equal every referencing response.snapshotId. Match original domain binding to the exact current actor's Activity/node/version/source/cue/media definition. A genuinely different immutable definition cannot be imported as current completion.
6. Use this exact equality rule for a recompiled same-version snapshot: both bundles pass /3 certification; compare scope, sourceRevision, pins, complete privatePayload.source, complete privatePayload.bindings, complete privatePayload.dependencies, manifestDigest and the complete semantic manifest with ONLY the top-level manifest.snapshot excluded. Use the existing canonical JSON structural comparison, not a partial subset of selected fields. The source/secret/media/cue definition must be identical. Snapshot IDs/compiledAt and their derived whole privateDigest/seal may differ because compilation allocated a new snapshot. Do NOT compare the complete privatePayload.result.manifest or full bundle byte-for-byte and accidentally forbid the intended identical-source republish. Do NOT waive any source/capture/definition difference merely because public manifestDigest matches.
7. Only after all certification/ownership/definition/envelope/grade checks pass, call the unchanged projectPublishedDurableFacts. Finish the existing freshness and consistency checks, COMMIT, and mint /4 from this CURRENT authenticated session and fresh read. Original actor/tenant/bundles remain private inputs, not receipt additions. No valid receipt is returned on integrity failure; the client remains paused with local UNKNOWN under existing policy.

Original session expiry/revocation does not invalidate an already committed legitimate same-definition attempt. Original-session historical data confers no current authorization: the new current session, course permission, fence and lease provide it. This addendum does not relax the current session's checks or auto-revive an old snapshot for execution.

## Public/private boundary and exact ownership

The expanded object is SQL-to-server ONLY and contains private captures/secrets. It MUST NOT appear in NativeSessionBootstrap, NativeMediaReadEnvelope, ActivityResult, /4 provenance, a client service state, HTTP response/log/error, browser storage or debug fixture imported by production. Server responses retain their existing strict public projection. No raw historical actor/tenant or original bundle is added to a public contract.

Allowed changes stay within ALREADY AUTHORIZED Packet B paths only:

- `supabase/migrations/202610050002_native_video_session_activity.sql`: new read RPC result/selection/completeness logic; keep current private guard and write RPC contracts intact.
- `src/features/smart-textbook-runtime/server/native-published-transport.server.ts`: strict private return parser, origin certification/equality and history validation.
- Other already authorized B server files ONLY for mechanical read-result destructuring if actually necessary; do not change their exported public contracts or current authorization semantics.
- `tests/course-video-native-session.test.mjs`, `tests/course-video-native-completion.test.mjs`, `tests/course-video-native-atomic-sql.test.mjs`: targeted private-seam and regression acceptance.

No added path, fixture module, schema-version file, Packet A file or generic publication/session repository change is authorized. If an additional path is required, name the exact dependency and request scope first. Worker can continue all other B work while implementing this private seam.

## Acceptance required before B PASS

- Valid zero-attempt current session: bundle certifies, origins=[], fresh INCOMPLETE.
- Attempt written under another owned native session with identical graph: valid current session restores it after original expiry and after original revoke. Original locator itself still fails ordinary runtime session resolution. Current expired/revoked locator still fails the new read RPC.
- Different snapshot IDs with exact same certified source/dependencies/bindings/semantic manifest: accepted. Different secret/policy/source/cue/media/Activity/version: rejected even with matching superficial tuple or copied public content digest. Do not normalize or silently migrate history.
- Multiple attempts referencing one original session produce one origin; several owned original sessions map completely; >20/over-max attempts fail without truncation. An exact retry still produces only one persisted attempt under existing idempotency checks.
- Missing/malformed response locator, nonexistent origin session, missing snapshot/private binding, mismatched private digest link, wrong actor/tenant/snapshot/scope, extra/duplicate origin, unsupported namespace or bad original seal/certifier projection: reject. No silent dropped history and no minted /4 on failure.
- Test the actual TS certifier on original payloads, including a self-consistent-looking/re-signed invalid semantic origin; a mocked certifier returning success is not evidence for this condition. Test strict public serialization excludes private origins and secrets.
- Actual isolated SQL tests show service_role can call the bounded RPC and cannot SELECT private tables; authenticated/anon cannot call it. A locator from a foreign session referenced by a synthetic integrity-error attempt must not leak that foreign private bundle. Use owned isolated setup for malformed storage fixtures; do not relax the production insert guard to create them.
- Origin selection and response/facts reads are in one repeatable-read transaction; no second connection or read-committed follow-up is allowed to create a torn origin set. Existing read freshness/abort/commit tests remain applicable; no cached completion or Tool /3 changes.

This adds no namespace bump: read_native_video_session_v1 is a new uninstalled private RPC still under implementation. Its sole final return shape is the expanded object. The correction changes no deployed /1,/2/Tool /3 contract and does not modify Packet A's independently passed artifacts.

Gate validation status: **NOT VALIDATED** at runtime; static contract decision only. Worker and independent verifier must supply actual TS/isolated SQL evidence. No production operation or new user decision is required to implement this addendum.


## Packet B mechanical legacy consumer scope adjustment
Supervisor accepts narrowly bounded SCOPE_CHANGE_REQUEST for contextual typing after already-frozen RuntimeServices nativeExecution union. Add exactly these existing MODIFY paths:
- src/features/development-execution/components/execution-console.tsx
- tests/fixtures/teaching-agent-r7b/browser.tsx
- tests/fixtures/teaching-agent-r7c/browser.tsx
Only add explicit completionMode: legacy to each already-legacy nativeExecution object. If the execution-console existing submit ReturnType cast resolves to the new union, narrow that type-only cast to the already-existing legacy NativeExecutionServices variant. No runtime behavior/URLs/request fields/receipt schema/fixture semantics changes. Record before/after hashes and exact mechanical diff. No tests/browser/SQL beyond previously authorized B protocol; include narrow typecheck evidence. Total B becomes 10 ADD + 7 MODIFY; all remaining prohibitions and contracts unchanged.


## Packet B independent verification authorization
Worker frozen 17 paths; frozen-source.json SHA80cfcc6bb2f60e458e9613439685b4fc5144f5784cd09822d71cf35c296831cf; baseline-relative PacketB.diff SHA7c2f09181ec0dc7c9a5e284642b454731d3111fb8ae26395a3ff626209b3f044; packet-a-unchanged.json SHA31623ceea1c4cb098ebf4b67430a5499c2c7953a34ca194ce69f321977e2b4c7 in /tmp/course-video-native-session-impl-17. Complete WorkerReport must be read before verdict. Reported final pure54/54, actualSQL26/26, affected oldpure241/241; earlier pure/SQL failures retained. Worker own container fullID23470f97fd92446ac2fa82e9f686b893c40b6ded804d2768d2e6c067871f79ba removed, exact inventory empty. No production.
Authorize verifier_critical | GPT-6 Astra xhigh for independent actual diff/scope/security review against Full GateReport and NativeHistoryAddendum plus narrow3path mechanical adjustment. Read CODEX_VERIFICATION.md and WorkerReport. Read-only all repo; reports/temp harness only in new /tmp/course-video-native-session-verify-17. No fixes/source mutations. Independently run new B completion entry (includes session tests) and new B SQL entry, after confirming full import/hook closure. Inherit unaffected predecessor and old241 raw evidence; do not broad rerun oldfoundation/full suites/automatic Docker harnesses. One verifier-owned unique-name/label cached fixed PG17.6 container totalcreation1, --pull=never/networknone/noports/mounts/minimalenv, correct /usr/lib/postgresql/bin, actual unchanged027record RPC + B wrapper/guard; fullID proof and finallycleanup. Do not modify resource topology or create replacement if preflight fails. Additional isolated negative probes only within sameownedinstance and frozen acceptance, no repository test additions. Save direct process exitcodes/stdout/stderr/hash.
Verify fresh current authority/lease/Auth/RLS/fence, strict private current+origin certification in sameRR, expiry/revoke history not revived, no fallback atomic path/old native writes, grade/idempotency/concurrent/replay/lost response, only independent read grants /4, stale/foreign/deadline/abort/controllerlegacy compatibility, stream I/O lease finalizer lifecycle for future C. Verify report type/lint limitations honestly: whole typecheck59 in build/ (previous55 plus4 legacybuildconsumer typings), current src/tests0; existing helper v2Record:any lint remains unchanged. Any defect REVISE with exact lines/case, no self-fix. No C, media/credentials/production/Auth/schema changes or deployment.


## Supervisor Packet B REVISE V17-B-01 / Revision1
Independent VerificationReport SHA883e3b5235187a2db49608280ba20ca267d97629b652a6a1e6b446fcb086d0d4; evidence-hashes SHA5624194168caa27f6c1dadb27b45a099f9a3ed794233f250373dcbb8a8e57841. Supervisor decision REVISE; one reproduced P1 pending-read/cancel/abort lease release race. Independent54/54 pure+26/26 SQL pass; 0/2 trueWebStream interleavings pass. Verifier own fullID5330e08d357c618fa145673d66c20be8f51c531772eaef38cf48a0d6effbcf72 removed, remaining0. No second established source finding. Preserve all original reports/failures. Recovery on 2026-10-06 confirmed original17source hashes unchanged and interrupted metadata append absent, before this append.
Authorize worker_astra_high | GPT-6 Astra high Revision1 exactly TWO MODIFY paths: src/features/smart-textbook-runtime/server/native-learning-session.server.ts and tests/course-video-native-session.test.mjs. Record baseline against B frozen hashes. Coordinate returned Response stream termination so pending read done caused by cancellation cannot bypass actual upstream cleanup. Concurrent cancel/abort/error share completion barrier, leave exactly once only after I/O and cleanup stop; normal EOF/bodyless/callback-error/no-read-ahead semantics remain. No timeout force clear, SQL/transport/helper/controller/schema/API/C/otherpath changes. No Gate contract change. If these two paths insufficient, stop with exact scope request.
Required targeted regression: actual pending downstream read + delayed upstream cancellation for consumer cancel, signal abort, overlapping both; final leave once after cleanup; authority active while cleanup pending, inactive after. Integrate in existing session test, reuse trueWebStreams and synthetic auth/repo only. Frozen independent adversarial test SHA b236d26379a0c8033e798f5af73fbdb9ecff64b887a31255a8c04527026391c8 must remain byte-unchanged and be rerun against fixed actual code. New completion entry imports session and may be rerun for changed lifecycle; scopedlint/type/scope. No Docker/DB/newSQL or old241 rerun: unchanged BSQL26 and compatibility evidence inherited. Save actual failure/pass rc/streams/time sequences without driver monkeypatch. Freeze final two-file diff/all17hashes and complete new /tmp/course-video-native-session-revision1-17/WorkerReport.md; independent critical targeted reverify then C remains pending until accepted.


## Packet B Revision1 independent targeted verification
WorkerReport SHAe861490117665998637db013d517bca85fd2471654a8af4a935bb2f45a5a1606; Revision1.diff SHA67e12cd033cdf9470b3694de8a9d66cc10691d98b25ace7021e2db478d73f70d; all17source-after SHAe10c1e8bd3aeb85349ddfb5df6aa97fd9a36c0d4c748b30268bcadee70702ac4, evidence-hashes SHAfb1f13314cc9d73974faf18253c283895986222a439fcb2ad68dd5526208e9ee. Worker57/57+unchangedindependentprobe2/2 directexit0; twofilelint0; wholetsc2 with exactly identical59builddiagnostics. OtherB15+A12 unchanged, noDB/Docker. Supervisor read report and exacttwofilediff, proceeds to verifier_critical | GPT-6 Astra xhigh targeted R1 verification before PASS.
Read-only repository, newprivate /tmp/course-video-native-session-revision1-verify-17 only. Read originalcriticalreport and R1WorkerReport/Task. Independently rerun newcompletion entry (includes57session/completioncases) and originalfrozen2probe, same minimalenv and directrawexit/streams/hash. Inspect sharedbarrier for pendingdone/cancel/abort/error/normalEOF/bodyless/no read-ahead/leavefailure/exactonce/no deadlock; required overlap regression. Inherit unchangedSQL26/old241/A evidence; NO Docker/DB/SQL/broadtests/production/credentials/browser/C/sourcefix. Check twofiledelta and protectedhashes plus unchangedtype/lint raw evidence. Report PASS/REVISE with exactdirectevidence and limitations, then stop.


## Supervisor Packet B PASS / Packet C implementation authorization
B Supervisor PASS at code/bounded local validation. V17-B-01 CLOSED per independent R1 Report877e3c35ab6e901f41c112ab17fedecee1aba94d030345f4f978656389a3547f and evidence90d402bd349e77b997e62d57840b50be24534fff77fcb87cb1aded4be62ea009. New independent57+2+5=64pass directexit0; unchanged independentSQL26 and oldpure241 inherited. Original failure/incident evidence preserved. Known59builddiagnostics and originalhelperlint remain, no wholeprojectgreen claim. A/B publication/session contracts frozen; no production readiness implied.
C authorized EXACT 11ADD+5MODIFY (all ADD absent at authorization):
ADD:
- src/lib/smart-textbook-publishing/course-release-selection.server.ts
- src/features/learning-agent-script-studio/video-pilot-publication.server.ts
- src/features/subjects/korean/native-video-entry.server.ts
- src/features/smart-textbook-runtime/server/native-published-media.server.ts
- src/app/api/smart-textbook-runtime/native-media/route.ts
- src/features/smart-textbook-runtime/components/native-course-runtime.tsx
- supabase/migrations/202610050003_native_video_source_promotion.sql
- tests/course-video-native-promotion.test.mjs
- tests/course-video-native-entry.test.mjs
- tests/course-video-native-media.test.mjs
- tests/course-video-native-browser.test.mjs
MODIFY:
- src/lib/smart-digital-textbook.ts
- src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx
- src/app/dashboard/admin/teaching-scripts/actions.ts
- src/features/learning-agent-script-studio/release-check-actions.ts
- src/features/learning-agent-script-studio/TeachingScriptStudio.tsx
PARALLEL OWNERSHIP: course_video_release_connection_impl -> worker_astra_high | GPT-6 Astra high owns 14paths: all above EXCEPT native-course-runtime.tsx and course-video-native-browser.test.mjs. course_video_runtime_ui_impl -> worker_high | GPT-6.1 Sol high owns ONLY those2ADDpaths. Shared contract already frozen by Gate/B: export named NativeCourseRuntime with props {bootstrap: NativeSessionBootstrap, backHref:string}; import NativeSessionBootstrap and createNativeLearningSessionTransport from current B core/native-learning-session-transport.ts. Server course page uses this export. No extra production injection prop or test service provider. Browser harness may supply TEST-ONLY same-origin HTTP/storage simulation, never production imports test fixtures. All other C helper choices remain within Gate; UI does not depend on new mutable C server implementation. Workers do not edit each other files or A/B; read reports/source and preserve earlierTask16work. No other path modifications without exact scope request.
Normative fullGate sections6-8 below and existingTimestampAddendum apply. Root original design Gate file hash19f2e25eccddb4e32b21b28d2d3d1c275d88920d043679287aa472ce5bb43610; no redesign needed. Read installedNextdocs before code; UI skill ui-ux-pro-max required for interface changes. Schema/Auth/RLS/newtables/agentcore/publicTool3/oldRPCs/config/deps/.codex/history forbidden. Empty actual release registry only; no production UUID/token/real cue/question invented. User explicitly deferred actual pause/question to admin. No production connection/credential/env reads/media mutation/upload/providers/deploy/publish/switch/git. Fixed selected media may be READ ONLY at exact approved hostpath for bounded local verification.
C backend localvalidation: only3new backend testpaths plus directly affected existingpureTask16/loader tests after completeimport/hook review and exactcommand preapproval. One total cachedpinnedPG17.6 owncontainer maxconcurrent1 create1, image86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f, --pull=never/networknone/noports/mounts, knownbinary/minimalenv/fullIDlabel/finallycleanup; no implicitoldtestfactory or replacementcluster. Actual SQL forwardpromotion+existingpublish/fence/session paths must run; tests preserve oldcapture/history/twochapterpin. Private reportdir /tmp/course-video-release-connection-impl-17. C UI localvalidation: newbrowser entry only + targeted static/type checks after command/import preflight; existingcachedbrowser and owned127.0.0.1 randomport/tempdir, no downloads/Docker/DB/realchen001window/externalnetwork/providers. ActualRuntimeRoot+solecontroller+newtransport-shaped client with TEST-ONLY synthetic endpoint persistence; rawscreenshots/assertions truthful local-only. Servertempresources private/tmp/course-video-runtime-ui-impl-17. No repo fixture add paths. Resourceownership disjoint from backendPG. Scopedlint/type checks may run at finalbothfreeze; do not changeknownbuilderrors/config.
EachWorkerReport must bind ownbaseline/finalhashes/exactdiff/rawrc/tests/counters/cleanup/NOTVALIDATED. No finalCpass without both coherent results + independentcritical verification. No runtime promotion or activation as side effect.

## 6. Frozen C source promotion, routing and media

### Explicit server selection and legacy pin

course-release-selection.server.ts is server-only generic publication infrastructure. Export strict CourseReleaseSelection schema/type, `getLegacyVersionPin(textbookId)`, and `getNativeVideoReleaseSelection({lessonId,chapterNumber})`. Its installed production registry starts EMPTY. It has no client setter, environment fallback or lesson-name branch. Later deployment supplies one reviewed entry with `{contract:'course-release-selection/1',textbookId,textbookSlug,lessonId,legacyVersionId,phase:'prepared'|'active',chapterNumber,chapterSlug,reserved:{versionId,chapterId,moduleId,executionNodeId,activityId,teachingLessonId,scriptVersionId,sourceTeachingNodeId},sourceDraft:{scriptVersionId,teachingNodeId}}`; UUIDs are genuinely allocated/reviewed later, not illustrative fixture values. Uniqueness: one legacy pin per textbook and one selected release per lesson/chapter, all reserved IDs distinct and fresh. Active scope derives from reserved version/chapter/book; snapshot selection always uses repository.current for this server-owned scope. No browser snapshot/version parameter.

Both existing legacy loader functions consult getLegacyVersionPin and add exact `id` equality before their existing ordering/limit; where no pin exists preserve behavior. A prepared entry already pins the old FULL version across all old chapter calls even before native publication. The chapter-progress helper additionally accepts an optional server-resolved versionId; validate that version belongs to the textbook and is published, and do not expose it as URL input. For an active native chapter, the page overview uses the native version explicitly so old completion does not mark the new pilot completed. Other chapters continue the pinned legacy version. No global progress reset or filtering.

New graph creation/promotion is DISALLOWED unless the prepared legacy pin and matching reserved IDs are installed on every serving replica. This is a deployment ordering precondition, not proof obtainable by an SQL row. Actual promotion action checks the current compiled registry for exact source node/textbook/legacy/reserved scope; operations documentation and isolated acceptance demonstrate install-pin-before-promote. It must not claim this check proves old binaries elsewhere are updated. Keep all production registry entries absent until real rollout is authorized. A C test fixture supplies an explicit TEST-ONLY registry and verifies both chapters' queries.

The public Korean entry resolves the requested existing lesson/chapter from current authorized course data and this registry. It returns legacy (unselected/prepared) or a selected native scope. Selected native loads/validates /3 and issues through B; failures produce a blocked/retry page. It must not run the legacy loader or loadStudentTeachingSlots after selected native fails. Platform audit mode does not acquire a student writable session; it gets an explicit unavailable/native-preview-not-installed view for selected release. Old unselected audit path stays unchanged.

### Promotion from saved draft and new graph

video-pilot-publication.server.ts exports owner-only `inspectNativeVideoPromotion(input)` and `promoteAndPublishNativeVideoRelease(input)` with strict owner form input `{sourceNodeId,sourceScriptVersionId,expectedToken,changeNote}` (UUIDs; existing saved script snapshot token; note <=500). Resolve all target UUIDs and legacy version pin from prepared registry, never use owner form values as a free target scope. requirePlatformOwner at entry, existing authenticated supabase snapshot RPC for saved draft, parse Task16 complete videoPilot, require selected-local exact asset, cue time finite [0,30), captions null, same-module single_choice with secret and counts_toward_completion true. Owner must have authored cue/Activity relevance; do not infer it from media filename. Reject unverified R2 and every other asset for this compiler.

Use A's fixed-byte reader before promotion/publication. The app can present a readiness report without mutation. Real promote call first invokes new `public.promote_native_video_source_v1(p_source_node uuid,p_source_version uuid,p_expected_token text,p_target jsonb,p_media jsonb,p_change_note text)` via owner-authenticated supabase. SQL uses auth.uid() and private.is_platform_owner (same existing owner system), no browser p_actor. p_target strict reserved IDs + textbookId/legacyVersionId/chapter identity; check correct source parent textbook/legacy version and all destination IDs absent. SQL itself does not know deployed registry; server action checks registry, SQL verifies graph and owner.

Forward C migration adds only this narrow function and private validation helpers; no table or RLS edits. It takes existing authoring_lock FIRST, then checks saved script is draft and uses teaching_script_publish_snapshot under that lock to compare expectedToken; exact selected node and original Activity/secret/parent rows participate in captured source validation. Avoid SHARE ROW EXCLUSIVE table locks after advisory lock, which can invert existing editor table/advisory ordering; existing before-statement authoring triggers and row locks protect the source. Fail on missing required trigger/fence prerequisites in isolated verification, rather than disable them. Compute origin.draftDigest server-side from the selected original node+Activity+secret+association projection using one documented canonical representation; it is private audit data, not public manifest identity. To match A's canonical digest, a private canonical-JSON helper may be implemented in this new migration and tested against TS for the admitted source values; do not redefine old hash functions. Use DB actor/time for approvedBy/At and exact fixed proof constants; no arbitrary media JSON accepted.

Within ONE transaction allocate/copy only the registered fresh new version/chapter/module/execution node/Activity+private secret/teaching lesson/script/source node. New version_number = max(existing)+1 under the authoring lock; unique constraint still authoritative. New script version_number=1 is legitimate because it belongs to a NEW teaching lesson, not fabricated old v23 provenance. Preserve source node_key/activity_key; copy existing authored titles/prompts/instruction/options/public_config/answer/explanation/max_attempts, with strict A support checks. Rewrite all parent/reference IDs to new IDs; execution node content {}; source action focus_activity; is_required true; next/remediation null; no segment/audio/avatar/old interaction content copied. New configuration is only A's videoPilotPublication object; Task16 original draft stays untouched. New book/profile are NOT created or updated. New graph statuses are published so existing capture/RLS can see them; no student runtime sees this sparse graph through legacy highest-version loading because the prior pin is mandatory. This operation returns new scope and origin digest, not a student-ready claim.

Then owner compiler uses the one official capture and repository CAS with expected null for this new scope to create a fresh immutable /3 snapshot/fence. If compilation/publication fails after graph creation, keep registry phase prepared; report source-created/publication-blocked truthfully. Do not delete content, mutate historical rows, or auto-enable native routing. Retrying recognizes only the exact reserved fresh graph and certified original source; it may retry the publication stage, not clone a duplicate graph or accept drift. A distinct changed cue/media/definition needs another reserved new version/IDs.

Source promotion does not invoke publish_teaching_script_checked on the original multi-node script or turn its draft runtimeReady true. The old publishTeachingScriptAction still refuses all videoPilot markers, and now also refuses videoPilotPublication markers through that legacy path. Native action is explicit and one-node only. This closes the saved-backend-to-publication connection without globally publishing/retiring an old textbook.

### Student media route

native-published-media.server.ts exports `serveNativePublishedMedia(request)` used by GET/HEAD Node route. Query exact sessionRef/mediaRef/revision only; reject duplicates, extra keys, invalid query length, URL/path/key/asset input. Authenticate through B on every GET/HEAD/Range, resolve saved /3, exact public media membership and private fixed proof, recheck course/actor/tenant/expiry/fence. Under that authorization use A's readFixedSelectedVideoSnapshot, verifying full file before responding and streaming/slicing the SAME verified bytes. Do not call owner helper with spoofed owner context. Hold request lease through all privileged byte I/O and response stream close/cancel; finalizer runs once and never pretends a crashed operation completed.

Accept one RFC-style bounded bytes range: closed/open/suffix; clamp end; reject multipart/malformed/out-of-bounds with 416 and Content-Range bytes */5487747. GET/HEAD return 200 or 206, video/mp4, inline, exact Content-Length, Accept-Ranges and Content-Range as appropriate. `Cache-Control:private,no-store`, `Vary:Cookie`, CORP same-origin, nosniff; no CORS allowance or bearer redirect. HEAD also reauthenticates and verifies snapshot. File absent/changed ->503, no metadata-only pass or media substitute. Cancellation stops stream and cleanup. Do not expose absolute path, hash proof/private binding, credentials or provider URLs in an error.

The adapter is deployable ONLY on hosts/replicas with exact A fixed path/bytes and permitted file access; readiness tests must demonstrate that before active selection. There is no requirement to upload to R2. Other hosting topologies remain unavailable until deliberately given an independently designed storage adapter. This limitation does not block code/local validation.

### Actual runtime mount

native-course-runtime.tsx receives B's public bootstrap and backHref, constructs the native-learning-session transport and calls the EXISTING RuntimeRoot in complete activation mode. Native services include the explicit /4 mode, bindings, mediaSource and independent operations. Existing context/initialState/refresh are real server projections. Required legacy-only services (learning/teacher/generic submit) receive explicit unsupported/no-op presentation adapters that cannot start any avatar/provider/audio or write through another Activity path; no fake successful data. The manifest has no teachingRefs/compat blocks, so no teacher slot is rendered. Reject unexpected block/service requests instead of silently supplying legacy teacher.

The page's authorized Korean branch uses this selected component before loadSmartDigitalTextbook and never calls old teacher-slot loaders in that branch. Preserve LessonActivityBoundary, actual lessonId, back link and existing access checks. Do not alter unrelated course routing. Show natural localized readiness/errors; no technical version labels or decorative English eyebrow in learning UI. Any title+hint uses existing CardTitleWithHint. Implementation reads relevant installed Next Route Handler/server/client/data-security docs and ui-ux-pro-max skill before interface changes, following their applicable requirements.

## 7. Compatibility, migration and rollback

All three SQL files are forward migrations, no historical SQL edits. Migration names must be reserved against actual root state. A extends exact admission tuples and only base publisher's branch; B adds native service-role RPCs; C adds one authenticated-owner promotion function. No new Auth/session/attempt table or RLS policy, no provider or dependency addition. Old /1,/2 snapshots, /1 execution and Tool /3 remain strict. Existing /2 native text admission is not broadened.

Publishing another version under the same book does not itself mutate old book/profile/capture. Every new row's parent is new-version scoped. The current wrapper permits that; its name 'single-version' does not require retiring the whole textbook, but its edit-window function WOULD do so and is forbidden here. Isolated SQL must prove old capture/fence equality and old session resolution across new graph insertion/new pointer installation. Shared book/profile/title/status/config changes are outside scope; if any current trigger makes an unavoidable shared mutation, stop with exact evidence, not global retirement.

Rollout sequence after code/SQL verification: deploy code with reviewed prepared registry and legacy full-version pin everywhere -> separately authorized forward SQL installation -> owner-authored complete draft and fixed media health -> new source promotion/new snapshot publication -> private owner inspection -> explicit registry phase active for one course chapter -> real authenticated student validation. Real content and switch are not performed by these code packets.

Rollback: set the reviewed release selection back to prepared/unselected for NEW admissions while keeping the legacy pin; serve old course route. Already valid native sessions remain pinned until expiry or explicit session revoke, which is consistent with existing publication policy. If a bad native snapshot must be stopped immediately, revoke only the new release's sessions by a separately reviewed narrow owner operation; no blanket textbook edit window. Never delete history or attempts. Existing repository pointer rollback can return to a previously certified same-scope /3 snapshot; it cannot be used to relabel old /1 or change scope. For first native scope with no predecessor, selection disable is the rollback. Leave forward schema support installed while any native artifact/history/session exists; do not roll old binaries back if they may receive /3 without fail-closed handling. Shared runtime fixes can be redeployed with native selection disabled.

## 8. Verification and completion evidence

Gate performed only direct source/SQL/doc reads and report hashing. No repo source mutation, imports/build/tests/browser/network/DB/env/credentials/media read. Recovery Worker report hash verified `cad75d76bf4fadd1b7b087ff0a93750c9279431f116db4edfa80100929a71f78`. Initial scope/path probes had expected missing guessed filenames and were corrected; they are not passing test evidence. Task14 262+7 and Task16 55 tests/browser11 are accepted predecessor evidence only. Existing 55 build-copy diagnostics remain NOT PASS and must not be hidden by root config.

A verification uses its frozen acceptance. B independent critical verification must cover same/different actor+tenant+session, expiry/revocation/pointer move/pinned fence, missing/wrong DB identity, current RLS denial, exact media/Activity/revision, no raw client IDs/grades, actual nativeAtomic no-fallback path (including PGRST202), secret/fence mismatch, identical concurrent duplicate/changed-option request, old attempts not counted, atomic rollback/failure, lost response + independent readback, fresh readId/acceptedAt/deadline/no cached receipt, no Tool provenance or /3 parser widening. Isolated SQL must exercise actual new wrapper with original record_smart_textbook_attempt, not just stubbed result. It must reject the old generic action/scalar RPC/direct fallback INSERT for a new native Activity, prove a historical Activity still uses the original RPC unchanged, and restore a valid earlier native attempt under a newly issued locator without accepting foreign/unbound history. No direct attempt inserts as test success substitutes.

C validation must run actual RuntimeRoot+existing controller+new client transport-shaped services with an explicitly TEST-ONLY one-video/one-cue fixture: reaching cue pauses; seek past cue pauses; wrong answer stays paused; feedback alone cannot resume; fresh correct persisted read resumes; stale/reordered/foreign receipt and timeout remain UNKNOWN; user pause survives late success; refresh restores; one video/one controller and no avatar; narrow/mobile layout works. A browser fixture uses isolated test services/data and is labelled accordingly; it is not production student proof. Media checks cover real full-byte fixed hash/same descriptor+range, wrong session/tenant/media revision, auth lost, altered/missing file and HEAD. Owner preview remains owner-only. Source promotion test proves exact saved token/private Activity relation/new IDs, old draft untouched, unsupported assets/incomplete cue blocked, two old chapters pinned despite higher sparse version, active selected failure blocked/no legacy fallback, new chapter progress cannot import old version completion.

Run touched-path lint/typecheck and only affected old/new tests; no repeat full suite purely for reassurance. Independently review actual diff and SQL function bodies/privileges. SQL source inspection or mocked RPC tests are not SQL execution; if isolated DB absent report NOT VALIDATED and keep real rollout disabled. Similarly separate code complete, local checks, schema installed, media available on replicas, authored content ready, snapshot published, route active and real student browser validation. A PASS for one does not imply the rest.



## Supervisor C public server entrance amendment and verification
Supervisor decision: PASS for the targeted architecture Gate; C implementation/runtime acceptance remains pending. Bind /tmp/course-video-public-entry-scope-17/GateReport.md SHA256 6a2ec8937f5bef895c88036e315f56037090221484e8f748d553095772ca7c26. Authorize backend worker to ADD exactly src/features/subjects/native-video-entry.server.ts, absent at this amendment. Its entire code is server-only import plus named re-export of loadKoreanNativeVideoEntry and getKoreanNativeProgressVersion from ./korean/native-video-entry.server (extensionless existing style). No wildcard, wrapper, behavior, state or new API shape. The already-authorized course page changes this import specifier from the Korean deep path to @/features/subjects/native-video-entry.server with the same names. C total becomes 12 ADD + 5 MODIFY, backend15/UI2. Generic subjects/index.ts, ESLint/root configuration and all other scope remain unchanged. Scoped lint + existing final typecheck + precise scope review required. No extra runtime resources follow from this amendment.
Independent verifier course_video_release_connection_verify (verifier_critical, GPT-6 Astra xhigh) is reviewing C read-only. Final runtime validation follows backend15/UI2 freeze and backend container cleanup; exact new C entry/media tests, actual promotion SQL including scoped concurrency regression on max one separately owned cached PG17.6, and one new isolated browser run are authorized. No A/B or broad historical suite repeat, no production/schema install/content publication/registry activation/deploy/git. Original evidence remains immutable.
V17-C-01 preliminary static finding: new promotion advisory-then-source-version-row lock inverted unchanged editor row-then-advisory order. REVISE sent to backend; permitted C-only correction removes unnecessary source row lock while preserving existing authoring-lock/triggers. Actual two-connection regression on the backend already-owned PG is authorized with explicit sentinels/wait_event and bounded timeouts; no extra cluster. Verification must independently assess final fix. The static finding is not labelled runtime reproduction.


## Supervisor final acceptance — 2026-10-06

Decision: **PASS for the authorized implementation and bounded local acceptance.** Packet A and Packet B accepted independent evidence is inherited without retest; Packet C now has coherent final Worker Reports and independent critical PASS. No unresolved blocking C finding remains. This is not production deployment, installation, publication, activation or release authorization.

### 大白话进展

本轮已完成后台与学生播放器的技术连接：后台可检查已保存的视频草稿，并创建独立发布版本；学生播放器使用同一视频与关联单选题，到暂停点停止，答对且独立读取确认学习记录已保存后才继续。答错、结果过期、保存未确认、拖动跳过题目时不能绕过。新视频入口不启动旧头像老师；旧课程、旧脚本和旧学习记录保留。

用户选择真实暂停秒数和题目稍后在后台设置。sample01.mp4 已在本地作为只读固定视频验证；测试暂停秒数与题目只属于合成测试，不是正式课程内容。当前生产选择注册表保持 EMPTY。线上课程尚未切换。

### Final scope and validation

C scope exactly17 paths: backend15 + UI2, 12ADD +5MODIFY, including separately gated root subject server-only two-export facade. Scope audit verifies exact Worker delta, not attribution of unrelated existing working-tree changes. Final46 hashes (C17+A12+B17) unchanged through independent verification.

Independent final evidence: entry/media11 PASS; browser9 substantive child cases plus parent=10 PASS; promotion command3 owner orchestration cases+7 actual SQL subtests+parent=11 PASS. All child return codes0, no skip. Counts include Node parent tests; do not describe this as32 distinct business scenarios. Resumed final verification executed ONLY remaining SQL; inherited prior independent entry/media/browser runs were rehashed, not rerun. Real SQL function bodies ran in a narrowly synthetic owned schema/auth fixture; browser used actual Root/controller/transport plus clearly TEST-ONLY local endpoint/file persistence/receipts. Neither proves live production Auth/RLS or real student execution.

V17-C-01 CLOSED: removed C-only unnecessary source-version row lock which inverted existing editor locking. Real independent synchronized two-connection test observed editor row lock, promotion advisory lock, editor actual advisory wait, successful promotion rollback, then successful original save. Original finding was static, not a claimed pre-fix runtime deadlock. Legitimate editor timestamp/token update retained.
V17-C-02 CLOSED: stale final import-manifest promotion-test hash corrected in separate final2 artifact; original evidence retained. All6 entry+295 transitive hash records match frozen code.

Touched lint PASS. Whole-project typecheck remains rc2 with exactly59 existing build-copy diagnostics and zero current src/tests diagnostics; NOT a whole-project typecheck PASS. The inherited usable768px seek-label wrapping remains a nonblocking visual limitation. No rootconfig workaround.

New final independent SQL container fullID2e0171c59a174134143a1fc0a3555e006700aadf305ac7fb8f758e3a6b76cb19: create1, pulls0, replacement0, pinnedcachedPG17.6, networknone/noports/mounts. FullID/label/isolation verified; stop/rm0; exactnameempty/fullIDabsent/tasklabelinventoryempty. Worker and prior browser resources already cleaned. No production credentials, DB/API, provider, upload, deployment, live schema installation/content publication, registry activation, commit or push was performed.

### Frozen report bindings

- `/tmp/course-video-release-connection-verify-17/VerificationReport.md` — SHA256 `6ea44903ee2bc22e881f42f51149d59a6b8fd764bea0297e8f009fa0c2858902`

- `/tmp/course-video-release-connection-verify-17/evidence-index.json` — SHA256 `c98a66d8732f23d4bc5aa36a7dae7ac85667de14f3d62a7d387012bf5b2882a4`

- `/tmp/course-video-release-connection-verify-17/final-source-after.json` — SHA256 `26e1c027d1bcfbd708826a9fb106353db36fbec14fd8f73d7db47084a43a0edb`

- `/tmp/course-video-release-connection-impl-17/WorkerReport.md` — SHA256 `f929f0246631988075ad54c564f6c4651415d797ab93538c0266be5aad9b9bb2`

- `/tmp/course-video-runtime-ui-impl-17/WorkerReport.md` — SHA256 `c96af44088643398748bd4c2e7c5e52d302a328533fb25185ad1370b6f25187a`

Additional authoritative C manifests: backend source-after.json SHA256 ffb472bad4a3c9007482e6740447fa53dd9176573c5afeb40483744699c93df3; UI source-after.json SHA2564a3f4ef5d34deca370062ef3cc7c41f37426eb16e38bf3a439106f7669f249d1. Final scope/public-entry Gate SHA2566a2ec8937f5bef895c88036e315f56037090221484e8f748d553095772ca7c26. Backend110 evidence items and independent107 evidence items checked; prior raw failures remain retained.

### Next minimum task and rollout boundary

Next minimum task: **视频课程上线准备检查与具体发布方案**. Read-only planning first: reconcile existing app deployment/build state, frozen forward migration prerequisites, exact selected host media availability, explicit target chapter/legacy pin and replica deployment ordering. Prepare a concrete reviewable rollout and rollback; do not assume local synthetic schema equals production. Recommended worker strength for this bounded but security/data-sensitive review: high; architecture/critical verifier as required by actual changes.

Ordered real rollout remains: reviewed prepared selection and full legacy pin installed on all serving replicas → separately authorized forward SQL installation → owner completes and saves actual cue/question and fixed-media readiness → explicit source promotion and snapshot publication → owner inspection → separately approved active selection → real authenticated student acceptance. This completed Task did none of these live mutations. Content authoring may remain deferred while technical readiness is prepared. Do not invent IDs, cue/questions or infer authorization from test success. Do not automatically create production materials or execute rollout.

No remaining authorized implementation work in Task17. Root archives this Task after PASS.
