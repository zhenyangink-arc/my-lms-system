# TASK TEMPLATE — Published video completion consumer

## Identity
TASK ID: COURSE-VIDEO-PUBLISHED-MEDIA-14
TITLE: Implement gated formal completion consumer in the single media owner
STATUS: COMPLETED — bounded consumer functionality PASS; whole repository typecheck NOT PASS

## Routing
IMPLEMENTATION PROFILE: worker_xhigh | GPT-6.1 Sol xhigh
ARCHITECT GATE: ALLOW /tmp/course-video-pilot-gate-qcdny_v3/GateReport.md SHA256 eedcfd0d57942526c6b1fb91f77ffb609a7f7fda07d92c4513474bc257b21488
VERIFICATION PROFILE: verifier_critical | GPT-6 Astra xhigh
MODEL ROUTING REASON: Frozen contract with complex asynchronous owner/attachment/read/write/play state; independent public-contract validation.
DISPATCH RECORD REQUIRED: YES

## Objective / Context
User approved continuing video replacement and will supply existing teaching videos later. Deliver the real existing controller's explicit published/3 consumption branch, strict unchanged /3 envelope validation, durable independent readback and adversarial functional tests. This package does not connect production issuer or ordinary course entry. It prepares actual player code; fake media are isolated test apparatus. No video is generated or uploaded.

## Scope
MODIFY ONLY:
- src/features/smart-textbook-runtime/core/execution-contracts.ts
- src/features/smart-textbook-runtime/core/native-media-controller.ts
ADD ONLY:
- src/features/smart-textbook-runtime/core/published-media-contracts.ts
- tests/course-video-published-media-contracts.test.mjs
- tests/course-video-published-media-controller.test.mjs
- tests/fixtures/course-video-published-media.mjs
Worker private artifacts/reports: one /tmp/course-video-published-media-impl-* directory0700, files0600. Root alone owns Task metadata.
READABLE DEPENDENCIES: project role rules; Task13 Proposal/Gate below; directly related media runtime/context/facts/execution schemas, existing R7B tests/fixtures, package.json/tsconfig. Prior accepted Task12 evidence as context, no new survey.
FORBIDDEN: all other source/tests/config/docs edits, AGENTS/CODEX/.codex (Worker), package/dependency changes, frontend/pages/routes/server/DB/Auth/RLS/schema, publication compiler, production tool/session/issuer, old avatar deletion, deployment/commit/push, live DB/browser/network/media/provider, credentials. No recovery tasks or production writes.

## Contracts
MAY CHANGE PUBLIC CONTRACT: YES only six-path explicit consumer contract as bound Gate; no original /1,/2,/3/restore schemas semantic changes.
Normative order: GateReport > Proposal. Both frozen full texts appended below to preserve review requirements. Unknown implementation necessity outside scope must be reported, not patched.

## Requirements / Acceptance
Implement all Gate section2 and Proposal first-slice invariants; exact explicit mode, immutable expected cue bindings, strict readId/op/request/generation/scope/revision/freshness, 10s monotonic call bound, local UNKNOWN, submit feedback never authorizes, independent readback, tokens retire stale success/failure, single-flight restore, detach/reattach fencing, no write retry, seek/two-cue chain, user pause/autoplay error, facts/1 non-authority. Legacy mode behavior and schemas unchanged except allowed mechanical private helper extraction.
No server installer: public schemas do not certify authority. Tests synthesize receipts only in test files; runtime cannot import fixtures.
Record before/after hashes and exact diff, commands/results; do not overwrite existing edits. First check current status and only touch allowed paths. User video absent does not block these tests; do not manufacture actual media keys/cues.

## Required Validation
- node --experimental-strip-types --test tests/course-video-published-media-contracts.test.mjs tests/course-video-published-media-controller.test.mjs tests/teaching-agent-r7b-execution.test.mjs
- npm run typecheck
- git diff --check
No full suite/build/Docker/DB/browser. Focused red/green iteration allowed while implementing. Typecheck may write tsbuildinfo; use existing ignored artifact only, no committed config adjustment. No frontend edit expected, so local Next guide not needed unless reported new scope.

## Parallelism / Escalation
One implementation Worker owns all six paths. Others may read; do not revert others. Follow CODEX_WORKER.md report. If necessary scope or contract ambiguity cannot be handled by Gate, return SCOPE_CHANGE_REQUEST/ESCALATION_REQUIRED with exact evidence. Do not invent a weaker invariant. Independent verifier reads actual diff and required tests, does not implement.

## Frozen Proposal
# COURSE-VIDEO-PILOT-CONTRACT-13 — selected proposal

Design only. Profile worker_astra_high / GPT-6 Astra high. User has an existing teaching video and will provide it later. No generation, live access, repository edit, tests, builds, or deployment performed.

## Selected first implementation

Add an explicit published /3 consumption branch to the EXISTING NativeMediaController. Its ports require a strict, request-bound outer envelope containing an unchanged activity-completion/3 receipt. The existing /1 and /2 parser stays unchanged; legacy/default service callers keep their behavior. No server issuer, route, production composition, publication compiler, author UI, or live entry is installed in this slice.

This is useful executable code: the actual media owner will enforce correct durable readback through the new branch and functional tests will drive play/pause/seek/submit/restore/races. It is not a production authorization mechanism. Test-only services create synthetic /3 data solely inside tests; they are not production issuers. The current native-execution/1 test manifest can exercise this consumer without claiming to represent the actual v23 orientation script.

## Existing conflicts, with direct source evidence

- core/execution-contracts.ts:6–40: /1,/2 binding and parser require session/snapshot/cue/request/generation; :46–52: /3 carries publication/Tool provenance and has neither this request binding nor UNKNOWN.
- core/native-media-controller.ts:40–49,76–115: restore/checkpoint/submit/readback all use the old parser; submit must read back independently before accept/play. Only this owner controls media.
- server/published-native-activity-read.server.ts:20–28: actual per-call Tool authorization and production fixed transport; :37–54: reads CURRENT publication plus dependency fence and persisted facts, not a supplied media session snapshot. Its WeakSet snapshot is server minted (:15–16,55). A browser string or a copied ToolExecutionContext does not authorize it.
- server/durable-activity-completion.server.ts:74–92: formal COMPLETED means at least one target Activity correct attempt and consistent formal progress; max-attempt exhaustion alone does not count. This projection lacks an attempt definitionDigest check. A receipt's current contentRef alone must not be interpreted as proof that old attempts were recorded for that content revision.
- lib/smart-textbook-runtime-v1/execution.ts:10–15: native-execution/1 hardcodes scriptVersion 1 and exactly source node numbers 5/7. Do not put actual v23 into that schema.
- server/learning-session.server.ts:26–40: existing durable session resolver requires legacy publication, while formal /3 requires publish-foundation/2. It is not already a native-media production session provider.
- lib/smart-textbook-publishing/native-publication.server.ts:23–49,111–112: strict text/single-choice source projection, rejects media requirements and emits empty mediaRefs/teachingRefs. It cannot simply ingest current video content.
- components/video-block.tsx:13–28 is a thin native owner adapter. Preserve it; no second player/controller.

All abbreviated runtime paths above are under src/features/smart-textbook-runtime/. Accepted Task12 BindingMap and Task11 Gate are retained as evidence, not re-surveyed. Exact current target: textbook 7100ab2b-72b0-478e-8847-4df9b4485109; observed version 939ad4f7-3238-425e-91e9-d456c130ca68; chapter cda24fb8-c93b-4a19-9577-4418350ff708; module orientation; script feb30ba7-0a5e-4e9f-83e6-8970f715ddd5 v23; first selected mandatory Activity aafa6ccc-4d4a-4dba-9315-2f30381e8a13. Two script references to this Activity are not two answers. No other mandatory activities are added by inference.

## Frozen first-slice wire/type contract

Names below are chosen; implementation may only make type-preserving local helper choices.

NativeExecutionServices becomes a discriminated union of the existing service shape (completionMode absent or 'legacy') and PublishedNativeExecutionServices (completionMode exactly 'published/3'). Selection is EXPLICIT service composition, never receipt sniffing, missing video headers, manifest sourceState alone, or absent mode.

PublishedNativeExecutionServices retains mediaSource and onFactsPort. Its publishedBindings is a readonly array of PublishedCueBinding, exactly one for every owner cue and no duplicate/extra cue. Constructor parses and copies/freezes these bindings rather than retaining caller-mutable objects. It also requires context.sourceState='published' and trackingDisabled=false; these checks are consistency checks, not server authorization.

PublishedCueBinding is a strict object:
- execution: the existing ExecutionBinding, byte-for-byte field equality to executionBinding(manifest,context,cue).
- activityRevision: exact manifest.activityRefs entry revision.
- mediaRef: exact source video block props.mediaRef.
- completionPolicy: literal 'correct-durable-readback/1'.
- published: strict {subjectRef,tenantRef,lessonRef,snapshotRef,scopeRef,contentRef,activityRef,executionNodeRef,sourceTeachingNodeRef,versionRef}, every ref nonempty max200. These are server-derived opaque expected identities, NOT body-selected permissions. Expected values arrive with authenticated mounted services in future production composition. Raw actor IDs/tenant IDs/answer keys do not enter this contract.

PublishedReadRequest is strict {binding:ExecutionBinding,requestId,generation,readId,operation}. requestId/generation follow existing CompletionRequest; readId is fresh UUID EACH restore/checkpoint/readback dispatch; operation is 'restore'|'checkpoint'|'readback'. A readback after submit retains the logical requestId but uses a NEW readId and operation='readback'. No readback ID is shared between concurrent calls. Submission uses existing CompletionRequest plus optionId.

PublishedMediaReadEnvelope is strict:
{contract:'published-media-read/1',request:PublishedReadRequest,authority:PublishedCueBinding,acceptedAt:ISO datetime,receipt:PublishedCompletionReceipt,pending:boolean}.

receipt remains EXACT existing activity-completion/3 (including genuine Tool provenance); this slice does not invent a non-Tool production issuer or broaden its parser. pending is only used on restore. For checkpoint/readback pending must be false. For restore, pending must be false if COMPLETED; otherwise true may conservatively reopen the cue. Position is never contained in /3 or manufactured from pending.

Published ports: restore/checkpoint/readback(request:PublishedReadRequest,signal):Promise<unknown>. submit(request:CompletionRequest,optionId,signal):Promise<{result:ActivityResult}>. The submit return carries feedback only and is NOT completion evidence. Parser rejects a submit-like envelope used as readback. No submit receipt is needed or synthesized. A successful or failed submit is always followed by a fresh independent readback; do not automatically retry a write after timeout/lost response.

Published receipt acceptance function parses both schemas, then verifies:
1. exact request operation/readId/logical requestId/generation and every ExecutionBinding field;
2. exact expected authority, including mediaRef/activityRevision/policy and all opaque published identities;
3. receipt.provenance equality for snapshotRef,scopeRef,contentRef,activityRef,executionNodeRef,sourceTeachingNodeRef,versionRef. Subject/tenant/course authorization is enforced by the future trusted boundary, represented by the expected scope and outer authority; the browser cannot prove it from receipt strings;
4. acceptedAt <= receipt.provenance.readStartedAt <= asOf == observedAt <= deadlineAt; all times parse; current time >= asOf and <= deadlineAt; current time-asOf <=30000ms; existing controller call deadline remains 10000ms. Client clock skew fails closed. A server must use its admission time for acceptedAt and must not rewrap an older branded snapshot as a fresh read;
5. attemptSequence >= last accepted sequence for THIS complete binding. Sequence is a lower bound, NOT a content revision or CAS. COMPLETED additionally requires latestAttemptAt, progressUpdatedAt, completedAt and positive attempts; those timestamps must not exceed asOf. /3 schema's existing invariant remains intact. An invalid read is UNKNOWN locally; no forged /3 UNKNOWN or zero attempt is minted.

The first code slice cannot cryptographically establish production provenance. Its threat boundary is an authenticated trusted service delivering genuine per-request domain evidence. Schema parsing does not turn untrusted object JSON into authority. Future server wiring must independently implement and test that boundary before production admission.

## Controller behavior to freeze

- Keep sole existing NativeMediaController and Step lease. All published callbacks are fenced by live lease, active cue, current requestId, latest readId per cue, and attachment lifecycle as appropriate. Older overlapping readbacks must not update evidence, unknown, completed set or play state. Handle stale failure as well as stale success; do not let an older rejection overwrite newer success. Serialize or discard concurrent readbacks with explicit last-read tokens.
- Correct submit feedback alone never unlocks; independent COMPLETED readback may unlock. Incorrect/INCOMPLETE holds. Exceptions/timeout/parser mismatch become local UNKNOWN and hold. Readback retry is read-only and can clear UNKNOWN upon a valid fresh result.
- restore is itself an independent durable read; COMPLETED can restore completed cue but does not autoplay. Failed restore remains non-playable (existing ERROR behavior); no fake completion or old-media fallback. Refresh reconstructs evidence, not a saved client completion list.
- checkpoint is an independent read. A prior correct, same-binding completion can satisfy the cue; it is not necessary to answer the same already-completed gate again. Cross-binding/revision completion cannot be imported. Media replay can revisit satisfied cues; seek across unsatisfied cues pauses, and multiple crossed cues are resolved in order before play.
- User pause wins against delayed successful readbacks. Autoplay rejection leaves RESUME_READY; only a new explicit play intent retries. Error/missing media never emits successful completion. media-ended is a presentation event, not Activity, step, or course completion.
- Evidence preservation: extend NativeMediaState with publishedReceipt:PublishedCompletionReceipt|null. For this mode store unchanged receipt there; retain legacy evidence:null. Do NOT project /3 into the legacy evidence shape or fabricate evidence.source. The existing runtime-facts/1 port therefore does not accidentally become a production /3 issuer. Direct controller state is sufficient for first-slice tests; a future formal facts DTO is separately owned.

## Exact implementation package to authorize next

Modify ONLY:
1. src/features/smart-textbook-runtime/core/execution-contracts.ts — discriminated service type, shared common services type as necessary. Existing /1,/2,/3 schemas and legacy acceptance semantics unchanged. Type-only import of the new module is allowed; avoid runtime circular import.
2. src/features/smart-textbook-runtime/core/native-media-controller.ts — explicit published service branch, request/read correlation, gate acceptance, publishedReceipt state and regression-safe controller behavior.
Add ONLY:
3. src/features/smart-textbook-runtime/core/published-media-contracts.ts — strict new binding/request/envelope schemas, acceptance/identity helpers, published services type. Imports existing /3 schema; no server imports or issuer.
4. tests/course-video-published-media-contracts.test.mjs — parser/binding/freshness adversarial tests.
5. tests/course-video-published-media-controller.test.mjs — actual existing controller functional tests.
6. tests/fixtures/course-video-published-media.mjs — test-only synthetic /3 responses and ports; reuse test manifest data from tests/fixtures/teaching-agent-r7b/ where actual path/export is confirmed before implementation. Do not modify that existing fixture.

If TypeScript reveals another actual consumer needs modification, report precise scope change instead of widening silently. No first-slice changes to execution/1, public facts Tool, server authorization/readers, schema, author UI, actual course data or production entry. This scope is the smaller packet explicitly requested by Root after seeing the hardcoded /1 and resolver obstacles.

Required execution for NEXT task (not run in this design):
- node --experimental-strip-types --test tests/course-video-published-media-contracts.test.mjs tests/course-video-published-media-controller.test.mjs tests/teaching-agent-r7b-execution.test.mjs
- npm run typecheck
- git diff --check
Use exact repository node:test convention from package.json test:navigation; do not run test:navigation wholesale or durable SQL tests without need. /3 schema unchanged, so formal Tool/DB tests are not a substitute for this new seam and need only rerun if touched/impact found. No frontend edit in this package, so no Next code/doc dependency. If later routes or UI are authorized, first read node_modules/next/dist/docs/01-app/02-guides/data-security.md and 01-app/01-getting-started/15-route-handlers.md, plus actual relevant server action docs discovered by rg.

New tests must cover exact positive /3 consume, raw /3 without envelope rejected, /1 or /2 in published mode rejected, /3 rejected by legacy parser, extra/missing fields, wrong every scope/ref/request/session/generation/cue/media/activityRevision, expired/future/stale/read-before-admission timestamps, missing durable completion evidence, descending sequence, wrong operation/readId, mutated binding input, duplicate/extra/missing cue bindings, draft/tracking-disabled context, completed submit feedback with incomplete readback, correct readback resumes, wrong/unknown/timeout holds, lost-submit response readback without duplicate write, concurrent readback ordering (success and failure), step disposal/generation, user pause race, restored completion with no autoplay, refresh incomplete no client skip, seek/replay/two crossed cues, media error and autoplay denial. Fake media and clocks are test apparatus, not actual video/DB proof. Tests must assert media.play count and state, not only regex/source matching.

## Remaining path to pilot; not this implementation scope

1. Forward publication and attempt revision: select a NEW textbook version/publication for the orientation pilot; do not rewrite the observed published v23/version. Preserve logical activity/source lineage. Existing attempt rows bind version/node/activity but not definition/media revision; fresh version-scoped attempts plus immutable dependencies are the minimal safe rollout policy. If immutable revision or fresh version isolation cannot be guaranteed by existing domain APIs, add a separately gated durable binding, not a client workaround. No copying old completed statuses into new cues.
2. Schema-free media source representation candidate: existing authored configuration JSON and existing mediaRefs/video props already carry keys/refs/transcript/captions; timelineCue already carries trigger time and source/target. A narrow versioned videoPilot JSON config can carry verified duration, byte/content revision, one cue to orientation-check, and same-timebase captionsRef/revision. No new table is necessary merely to store these fields. Its persisted exact schema and capture/compiler fence must be Gate-approved in the publishing slice; it is NOT frozen or written by this first consumer package. Existing teacherVideo explanations/turns alone cannot represent timed cues/revisions, so do not fabricate them from transcript or speech duration. User video plus measured duration/hash, cue placement and actual subtitle timing are the concrete content inputs still needed.
3. Native execution/publication support: introduce a separately versioned native-execution/2 for real source/script IDs and one pilot media owner, retaining /1 unchanged. Extend native compiler/capture/fence to cover that small configuration, media revision and activity revision; default rejects missing/stale media or subtitles claiming an unverified timebase. The current text-only native compiler must not silently strip unsupported content.
4. Trusted server media boundary: authenticated mounted session -> existing course authorization + durable immutable publication session -> current generation/step/cue lookup from pinned bundle -> exact Activity submit using existing domain record path -> separately authorized published read -> new outer envelope -> same controller. The /3 reader currently requires genuine Tool authorization and reads current rather than pinned publication. Connecting it requires an explicit server-boundary Gate: either use a genuinely authorized Tool read with real provenance and deny pointer mismatch, or split its validated repository projection/transport for a native authenticated read provenance variant. This proposal selects NO fake Tool context or production issuer in the first package. Until that server choice and pinned-session support are implemented, production composition MUST NOT install published/3 services. This is a named code dependency, not missing-video blockage.
5. Author new-mode retirement: server policy targets explicit new pilot release identity (server-owned tuple textbook + newly minted version/chapter + orientation script version). It never activates from missing config or a posted boolean. Create/save of its nodes must set/require explicit video mode and reject legacy/missing-video-mode/mixed content; drafts may have missing actual media but remain invalid for preview playback/publish. Publish/release-check validates EVERY covered node and immutable media/cue/activity bindings; preview receives same policy and shows blocked state for missing media, never old avatar or text-ended. Existing v23/live version stays on historical semantics until forward switch. UI can remove legacy choices only after these server checks exist.
   Exact future touch points: src/app/dashboard/admin/teaching-scripts/actions.ts (createTeachingScriptDraftAction/addTeachingScriptNodeAction/saveTeachingScriptNodeAction/publishTeachingScriptAction); src/features/learning-agent-script-studio/release-check-actions.ts (inspectChapterRelease); src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx; src/app/api/learning-agent/preview-respond/route.ts; shared policy helper under src/features/learning-agent-script-studio/ (new exact schema/path fixed in its Task). src/lib/teaching-video.ts global missing->legacy normalization remains unchanged.
6. Verified ordinary entry: route the NEW admitted pilot version into the native owner after real media, durable write/read, permission and browser tests. Preserve old immutable snapshots, attempts and assets via an explicitly authorized history path. No global fallback to old avatar in new mode, no deletion. Rollback of new entry is another verified video publication, or blocked/retry if none. Old still-live course remains functional before cutover.

Alternatives rejected: broad union of /3 into legacy receipt; fabricated /2; installing dev fixture as service; direct submit feedback unlock; LLM grading/authority; global missing->video; prematurely disabling every legacy course; generating a replacement teacher video; adding a second controller; building whole-platform media schema now.

用户说明：第一片先把播放器真正接上“正式答题结果必须独立读回，确认答对才继续”的接口，并验证暂停、跳转和迟到回包不会绕过题目。已有视频稍后提供不会挡住这段代码。上线还需要接入真实视频的时长与题点、正式会话和发布通道；当前课程和旧学习记录此时不变。


## Frozen Gate (overrides Proposal)
# GateReport — COURSE-VIDEO-PILOT-CONTRACT-13

Profile: architect_gate | GPT-6 Astra xhigh
Decision: **ALLOW — 仅下述六路径 consumer/controller 首包，按本报告澄清冻结 Task14。**

这不是 production issuer、正式服务器接入、原 v23 可播放或上线批准。Proposal.md 的首包合同采纳；冲突处以下条款优先。无需为本首包补齐 server/publication/author 链路。实施后仍须独立 Critical Verification。

## 1. 授权范围与路由

只修改：
- src/features/smart-textbook-runtime/core/execution-contracts.ts
- src/features/smart-textbook-runtime/core/native-media-controller.ts

只新增：
- src/features/smart-textbook-runtime/core/published-media-contracts.ts
- tests/course-video-published-media-contracts.test.mjs
- tests/course-video-published-media-controller.test.mjs
- tests/fixtures/course-video-published-media.mjs

Implementation 推荐 worker_xhigh | GPT-6.1 Sol xhigh：合同已冻结，但同一 owner 内异步代际与恢复状态较复杂。
Verification 推荐 verifier_critical | GPT-6 Astra xhigh：新增公开消费合同及信任边界。

所有新增行为默认限定 published 分支；允许为避免重复机械抽取 private helper，但不得顺带重设计 legacy 行为。现有 /1、/2、/3 receipt schemas、restoreSchema、acceptCompletion 的语义与 native-execution/1 schema 均不变。其他消费者若必须改动，提交精确 scope change，不能自行扩围。

## 2. 可直接写入 Task14 的冻结条款

### A. 模式、绑定与信任

1. services.completionMode 缺失或 'legacy' 走原服务；只有显式 'published/3' 走新增服务。未知模式拒绝，不能靠 receipt sniffing 或缺媒体推断。新分支要求 context.sourceState='published'、trackingDisabled=false，context.snapshotId 与 manifest.snapshot.id 一致；这只是消费一致性，绝非授权。
2. 使用 Proposal 的严格 PublishedCueBinding、PublishedReadRequest、PublishedMediaReadEnvelope 三个形状及 PublishedNativeExecutionServices。每个本 owner cue 恰好一个 binding，无缺失/重复/额外 cue。构造时逐一核对 executionBinding 的全部字段、Activity revision、源 video 的 mediaRef、cue 的 mediaRevision 与 manifest media revision、固定 policy；解析后复制并冻结 nested execution/published 和数组。保存不可变的本 owner cue/预期身份，后续请求不得因外部修改原 bindings、context 或 cue 对象而改变关联。不得全局冻结调用方对象而影响 legacy。
3. authority 的 opaque published refs 全量等于预期值；receipt 的七个对应 provenance refs 全量等于 authority。opaque Activity ref 不等于 manifest Activity alias，不得在浏览器自行 hash/拼接推导这种关联。该关联只能来自未来可信安装边界。subjectRef/tenantRef/lessonRef 没有 /3 对应字段，不能声称仅凭 parser 已认证这三项。
4. 原样保存 /3 字段及值到独立 publishedReceipt（可解析复制/冻结，不要求同一 JS 对象）。legacy evidence 始终 null。禁止 /3 重标 /2、伪造 UNKNOWN receipt、ToolExecutionContext、production storage 或域完成。fixtures 明确仅测试，不从任何 production 文件导入。
5. onFactsPort 可保留兼容类型。现有 facts/1 的完成字段仍是 client owner 观察，并不因为 /3 分支存在就成为服务器凭据；stateEvidence/attemptSummary 保持 null，不输出伪 legacy evidence。首包无任何 production service 安装或事实 Tool 接线。

### B. 每次读的身份与时间

6. 每次 restore/checkpoint/readback 创建新 UUID readId 和对应 operation；读取后 exact match requestId、generation、全部 execution binding、readId、operation、authority。submit 沿用 CompletionRequest；其后的独立 readback 沿用该逻辑 requestId，但必须新 readId、operation='readback'。checkpoint/readback 的 pending 只能 false；restore COMPLETED 的 pending 也只能 false。
7. 保留 30,000 ms 接收新鲜度和每次调用 10,000 ms 上限。一次接收捕获一次 wall-clock now，验证 acceptedAt <= readStartedAt <= asOf == observedAt <= deadlineAt，asOf <= now <= deadlineAt，now-asOf <= 30,000；并验证 asOf-readStartedAt <= 30,000（与当前 reader 一致）。COMPLETED 要正数 attempt、latestAttemptAt/progressUpdatedAt/completedAt 均存在且不晚于 asOf。attemptSequence 不低于此不可变完整 binding 已接受的下界；错误/反馈不能推进下界。
8. 10 秒不能只依赖 Promise.race 定时器：dispatch 时记录本地 monotonic 时间，接收时实际 elapsed 超过 10,000 ms 一律丢弃/本地 UNKNOWN，防止 event-loop 延迟接受已超时结果。timeout 也退休对应 token，迟到返回没有副作用。submit 的 10 秒与后续新读的 10 秒分别计时，不复用提交 deadline。没有自动重试写入。
9. acceptedAt/readStartedAt 等属于服务端时间域；不增加 client dispatch wall <= acceptedAt 这种零容差跨机器比较。wall-clock 新鲜度或 deadline 验证不通过则 fail closed，不声称能检测所有时钟偏差，也不动态放宽时间窗。服务端必须真实按本次 request/readId 入站后 admission，再开启独立读；旧 snapshot 不能重新包 acceptedAt。这项 provenance 要由未来可信边界落实，客户端 schema 无法证明。30 秒是接收新结果的条件，已经合法接受的不可变绑定完成不会因稍后播放超过该时间而自动失效。

### C. 请求代际、恢复与异步失败

10. 所有 published 异步分支（成功、异常、timeout、submit feedback、readback）先检查 live lease、attachment generation、本次 cue/logical request，以及适用的最新 read token，再修改任何 state、sequence、completed set 或播放意图。旧 failure 与旧 success 都不得污染新状态。新 submit 替换此 cue 的逻辑请求并使旧读失效；并行 readback 只有最后 dispatch 的读可生效。
11. 同一 write 尚未 settle/timeout 时，重复 submit 不发请求；外部 readback 不得提前把状态变成可再次提交。可直接忽略 write-in-flight 时的外部 readback。提交 settle 后，只为仍当前的 captured cue/request 发起独立读，不能调用时重新选择已切换的活动。过时提交不再驱动新 cue。反馈解析成功/失败都不能授权播放；有效独立 COMPLETED 可以。
12. published restore 同一 attachment 单飞、成功后重复调用无操作；refresh 通过新 owner 重建。恢复期间禁止 play/submit，不允许部分恢复结果提前解锁。全部读有效后才标 restored；恢复失败保持 ERROR/non-playable，无 fallback。restore COMPLETED 不自动播放；INCOMPLETE+pending 可恢复待答界面，不能制造位置。
13. detach 立即使旧读/写/播放回调失效、撤销自动播放意图。再次 attach 必须重新独立恢复，不能借旧 restorePromise 直接解锁；可保留同一不可变 binding 的 sequence 下界，但不能保留未重新确认的完成许可。dispose/Step generation 失效同理。mediaError 是该 owner 的终止状态，旧成功不能复活。

### D. 唯一媒体 owner 与题点

14. 在每次真正调用 media.play 之前，除 live/attachment/restored/无错误/无 userPause/无 active cue 条件，还检查有效当前位置是否越过任何未满足 cue；包括 restore 中发生 seek 或 attach 时 currentTime 已越过 cue 的情况。位置不作为完成依据。最早未满足 cue 先暂停并读 checkpoint，两个跨越 cue 要依次处理；完成第一题后绝不能先播放再找第二题。
15. 从原本播放进入的一串跨越 cue，保留最初 resume 意图直到全部满足；不能因第二次 trigger 看见 media 已暂停而意外丢失该意图。用户主动暂停随时撤销，迟到正确读回不覆盖。restore 或原本已暂停的 seek 不制造自动播放意图。
16. autoplay rejection 停留 RESUME_READY，清除自动重试意图；只有新显式 play 才重试。迟到 play promise 不得覆盖当前状态；若被 userPause/cue/error/恢复门禁阻止，需保持 media 暂停。旧 attachment 的迟到 play 不得使旧 media 留在播放中，但不得用旧 promise 暂停当前新合法 play。media-ended 只作呈现事件，不完成 Activity/Step/course。重播已合法满足的 cue 不要求再答同一绑定题。

## 3. 必须验证的首包证据

沿用 Proposal 全部 adversarial/functional 测试清单，特别补显式未知模式、原输入 mutation、不同行为的双 readback 乱序、旧 rejection/timeout、write-in-flight 重复交互、restore 重入/部分结果、detach/reattach、seek-before-restore/初始已跨 cue、两题链保持 resume 意图、userPause 后迟到 play、旧 attachment play、facts/1 null evidence。测试断言实际 media.play 次数和暂停状态；禁止仅正则源检查。两题 fixture 仅测试 owner，不冒充真实 orientation 有两道必答题。

Task14 指定命令：
- node --experimental-strip-types --test tests/course-video-published-media-contracts.test.mjs tests/course-video-published-media-controller.test.mjs tests/teaching-agent-r7b-execution.test.mjs
- npm run typecheck
- git diff --check

既有 /1 legacy 用例必须继续通过；补显式 'legacy' 分支回归。用可控测试时钟/延迟验证 timeout，不能缩短生产 10 秒常数讨好测试。本 Gate 未运行任何测试。此包不改 frontend，无新增 Next.js 指南依赖；若实际扩到 route/UI 则先回报 scope 并读本地相关文档。

## 4. 有据的剩余生产阻碍与边界

静态确认 published-native-activity-read.server.ts:20-23 必须有真正 Tool 授权，:38 当前 publication，:50-55 原 /3 和 WeakSet server snapshot；不存在本包可直接借用的浏览器权威 issuer。learning-session.server.ts:35 必须 legacy publication；native-execution/1 的 scriptVersion 固定 1、sourceNodes 固定 5/7；当前 native compiler 只支持 text/choice 且输出空 mediaRefs/teachingRefs。因此本包不能安装 production published/3 services，不能伪装现有 v23。未来需另 Gate 冻结 pinned session/合法 native read provenance 和版本化发布；这些不阻止本次 consumer tests。

旧 attempt 没有定义/media revision 的可靠绑定，不能凭新 receipt.contentRef 搬运旧正确历史；沿用 Proposal 前向新 version + 不可变依赖/新尝试隔离策略，若 domain 不保证则另作持久化绑定。用户真实视频稍后提供；duration/hash/cue/subtitle 和 author 防复活仍为明确后续内容与接线工作。本 Gate 没有选择新持久化 Schema，也不改变旧 live/history 语义。

拒绝方案：/3→/2 重标、任意 JSON 变权威、伪 Tool provenance、提交反馈直接解锁、猜测视频/题点、缺模式自动转新视频、第二播放 owner、借本包重构 server/publication/legacy。现有旧代码中本次暴露的相似 race 不自动扩展为全量 legacy 修复。

回滚：未接 production，撤回这六路径本 Task 的具体 diff 即可；保留其他人的改动，不重置数据库/学习记录/发布历史。无新增生产数据迁移。

## 5. 核对依据及限制

关键独立静态核对：execution-contracts.ts:6-52（分离 schemas/services）；native-media-controller.ts:31-49、51-119（restore/播放/读回/迟到 failure）；runtime-facts.ts:5-18（client DTO）；runtime-context.tsx:27-29（facts callback）；video-block.tsx:13-28（唯一 owner）；execution.ts:10-35（/1限制及 cue/media 校验）；durable-activity-completion.server.ts:74-92（正确 attempt 投影）；原 R7B functional tests、package.json:16-17（命令）。沿用已接受 Task11 Gate 与 Task12 映射，不重查历史/线上。

只读上述仓库源与设计资料；只写本 private /tmp 报告。无 repo/live/env/测试/build/browser/网络/发布操作。一次尝试读取不存在的 tests/fixtures/teaching-agent-r7b/manifest.json 返回 exit 1；实际 fixture 从 fixture.server.mjs 导出 manifest，已核对，未将失败读取作为验证通过证据。运行实现、真实视频和生产链路均 **NOT VALIDATED**。

Input SHA256:
- .codex/tasks/active/COURSE-VIDEO-PILOT-CONTRACT-13.md: b70798e49e88aff21c36eb2888f0efc83fe20d2675839210c12745bf924cb946
- /tmp/course-video-pilot-contract-e3njous9/GatePacket.md: 25073425377bc2ff925ad0f7c32e512693daf743b051d99a9a94cf9fc04d2e56
- /tmp/course-video-pilot-contract-e3njous9/Proposal.md: 7348331fcebc706327f8caa8506e1be3d016ace6986e742713f4d235b4c31b93
- /tmp/course-video-pilot-contract-e3njous9/WorkerReport.md: cc3bba9edf2eb11875aa56dd43bed0a058e94287a6dab4f2c12c982f2f2ca7c3


## Gate clarification — default legacy type compatibility
This addendum supersedes the unparameterized union alias shape only; all runtime invariants and exact six-path scope remain unchanged.
Source: /tmp/course-video-pilot-gate-qcdny_v3/TypeSurfaceAddendum.md
SHA256 68b4f7b3c15beac087d6f159ec8ad8a13630b37006fd38528bb6b6095fc8737f

# Type surface compatibility addendum — Task14

Decision: **ALLOW**. Profile: architect_gate | GPT-6 Astra xhigh.
Parent Gate SHA256: eedcfd0d57942526c6b1fb91f77ffb609a7f7fda07d92c4513474bc257b21488.

仅澄清服务类型别名，授权范围仍为原六路径。本次修正只需 execution-contracts.ts 和 native-media-controller.ts；不修改其他 consumers、RuntimeServices、schemas 或 production 接线。

冻结方案：

```ts
export type NativeExecutionMode = 'legacy' | 'published/3';
export type NativeExecutionServices<
  Mode extends NativeExecutionMode = 'legacy'
> = Mode extends 'published/3'
  ? PublishedNativeExecutionServices
  : LegacyNativeExecutionServices;
export type AnyNativeExecutionServices = NativeExecutionServices<NativeExecutionMode>;
```

NativeMediaController 的 constructor services 参数和 readonly services 属性改用 AnyNativeExecutionServices。它是精确 discriminated union，不是 TypeScript any。原运行时显式 mode 选择、未知 mode 拒绝和分支缩窄不变。

默认 NativeExecutionServices 仍严格等于 LegacyNativeExecutionServices，保留现有 contextual function 参数类型及 submit 必须返回 receipt 的合同；NativeExecutionServices<'published/3'> 严格等于既有 PublishedNativeExecutionServices。后者依然必须有 completionMode='published/3'、publishedBindings 和含 readId/operation 的 PublishedReadRequest，submit 只返回反馈形状。不得改为 optional receipt、共同宽松 request、any、全局断言或改旧 consumers 来消除错误。

此项覆盖原 Proposal 要求 NativeExecutionServices 无参数别名直接等于 union 的命名安排，保留原 Gate 的行为与安全不变量。RuntimeServices.nativeExecution 通过默认类型继续只容纳 legacy，符合本包未接生产/React 服务 composition 的边界；未来真正挂载 published 服务仍需显式另包设计接线，不用强制断言绕过此限制。

依据：实际 typecheck-01.log:73-97 显示旧 execution-console 的 indexed ReturnType 被 union 扩宽，submit 缺 receipt 分支使旧对象不再赋值；read ports 的两种不同 request 签名也破坏旧 object literal contextual typing。已核对当前 execution-contracts.ts:25-37、published-media-contracts.ts:39-45、services.ts:33 及 execution-console.tsx:11-14。问题是兼容类型导出，并不要求放宽 published 请求。

后续 Worker/Verifier 必须证明默认类型保留 legacy submit 返回与 CompletionRequest 参数，显式 published 类型及 controller 仍接受严格 published 服务；不得把反馈-only published 服务赋给默认旧类型。重跑已要求的 typecheck，并确认日志所示 src/ 与 tests/ 的该批新增错误消失；剩余 build/r7cb-b3a-candidate 旧副本缺模块错误独立记录，不在此 Gate 授权治理，也不能将仍失败的整库 typecheck 标为 PASS。原有功能验收继续适用。

本 addendum 仅静态审查；未修改源码、运行测试/typecheck/build 或触达 live/env。实现结果 **NOT VALIDATED**。原 GateReport 保持不变。模型路由保持 worker_xhigh / GPT-6.1 Sol xhigh 与 verifier_critical / GPT-6 Astra xhigh。


## Supervisor final review / 完成记录

Decision: **PASS，仅冻结六路径的播放器消费接口与控制逻辑功能范围。**
Whole repository typecheck: **NOT PASS**。Production / browser / actual media / release: **NOT VALIDATED**。这三个结论彼此独立，不得将本任务归档解释成全项目通过或已上线。

给用户的大白话：播放器的“视频到题点暂停，答对且后台结果独立确认后才能继续”核心已经写好，并覆盖跳进度、连续两题、用户暂停、超时和迟到回包。独立复核发现的两处题序漏洞均已修复并重放通过。当前还没有接入真实视频及正式服务器页面通道，旧金老师形象入口没有在本任务中删除或切换。用户已有教学视频，稍后提供；不生成替代视频。

### Actual scope and validation

- Modified: execution-contracts.ts、native-media-controller.ts；added: published-media-contracts.ts、两份功能测试、一份测试 fixture。精确路径及最终 hashes 见下方证据。
- Gate 审查、Worker 实施、Critical Verifier 独立复核完成。Supervisor 读取报告、检查实际文件列表与关键 delta；未重复独立验证的整套测试。
- 最终指定 focused 命令 262/262 PASS（176 contract/subtests +65 controller/subtests +21 unchanged legacy tests），exit0。
- 两份原独立复现文件不修改重放：7/7 PASS，exit0。
- git diff --check PASS，exit0。
- npm run typecheck 仍失败：Worker Revision2 exit2；原独立运行 exit1。55条诊断均位于 build/r7cb-b3a-candidate/source/，Revision2 诊断行与原独立日志逐字相同，src/及tests/诊断0。未删除旧构建副本、未改tsconfig；不能把局部类型兼容检查替代整库成功。
- 没有运行整库suite/build、浏览器、Docker、DB、生产访问、媒体生成、发布、commit或push。
- 保留了初次与Revision1失败报告、日志及复现，未将失败历史覆盖成成功。

### Closed revision findings

1. V1：恢复时已跨过早题，但晚题 pending 优先，造成题序错误。修复后最早未完成题优先。
2. V1-R1：seek后无需play即可直接提交晚题。修复后observe/submit都先重查真实位置并激活早题，退休旧request/read；已有write保持single-flight到settle/timeout，过时回包不能改变新题。
3. 两项均为顺序漏洞，原复现中media仍暂停；不夸大为已经证明视频完成门禁被绕过。

### Remaining tasks / 下一步

1. 已有视频到位后，绑定实际文件、时长/内容revision、出题时间点和对应题目、同时间轴字幕；不得用语音时长猜视频时间。
2. 在单独冻结的后续Task中接入可信服务器会话、独立答题读回和新的发布版本。当前client/parser只能检查一致性，不能凭空制造权限或Tool来源证明。
3. 完成新模式的编辑/发布限制及页面入口切换，验证缺视频或报错时不会回退旧形象；保留旧学习记录和历史版本。旧素材删除需要消费者清点后再处理。
4. 使用真实视频完成浏览器验收，包括答错、答对、跳进度、刷新和主动暂停。当前课程上线状态不能由本次模拟媒体测试推导。
5. 整库typecheck的旧构建副本问题单独处理，不能在本Task内通过删文件或扩大忽略范围隐藏。

本次代码与任务记录未提交/推送。历史未提交文件保持原状。

RecordedAt: 2026-10-05T09:12:31.538366+00:00
Pre-archive Task SHA256: 43bfac395182f3ee8e28904f4cd67be50766d0ccb026cf0a9cf21cf890015290

### Durable report bindings

- `/tmp/course-video-published-media-impl-XhZOGY/Revision2-WorkerReport.md` SHA256 `e9c663c71e7d7d4a10f7b7e3c7a820708fa4858af0f7321dd07410cae1ca58fe`
- `/tmp/course-video-published-media-impl-XhZOGY/Revision2-ExactDiff.patch` SHA256 `a8707b407d27479e5ff8f406afb93ad867b0e0c069589130c4d03ae3a37deedc`
- `/tmp/course-video-published-media-verification-bqz4ja4k/Revision2-VerificationReport.md` SHA256 `795ecced64cf1a66cbba3b151bcf4c544fc5d0802788665ca408d08ffa186ec5`
- `/tmp/course-video-published-media-verification-bqz4ja4k/Revision2-Evidence.json` SHA256 `33b543955db0fe7072f7cf3b46caead1133df7428c377fdafdb510b2f8e6167a`
- `/tmp/course-video-published-media-verification-bqz4ja4k/Revision2-focused.log` SHA256 `36a8541c137f2e8008e4ac6563e39d5aefe1f6908ae2b5cfc1fa2870a60eb51a`
- `/tmp/course-video-published-media-verification-bqz4ja4k/Revision2-previous-reproductions.log` SHA256 `7bb52977566b4e3f433a807f78e55c04e3e4b96ee0385ad0fbe0bead38da4ad9`

### Final independent evidence (embedded)

```json
{
  "files": {
    "src/features/smart-textbook-runtime/core/execution-contracts.ts": {
      "sha256": "636cc37ca53412d3c5c16a3c13bff27c683026ab4db504f0250bf5362bb13bf5",
      "matches_worker": true,
      "unchanged_from_initial": true
    },
    "src/features/smart-textbook-runtime/core/native-media-controller.ts": {
      "sha256": "f22ee40e83b8bc16b3dc951a55194b260b992d461e9361d1de58cc9391603799",
      "matches_worker": true,
      "unchanged_from_initial": false
    },
    "src/features/smart-textbook-runtime/core/published-media-contracts.ts": {
      "sha256": "776bd8bac6c1d78e8e6b5fca675148296e436aa54ef900a52791a60808142408",
      "matches_worker": true,
      "unchanged_from_initial": true
    },
    "tests/course-video-published-media-contracts.test.mjs": {
      "sha256": "6a3f03a21a3fd461b17aeb60cd0b7fa522344ba231734c9a6afbcf890b91a5f0",
      "matches_worker": true,
      "unchanged_from_initial": true
    },
    "tests/course-video-published-media-controller.test.mjs": {
      "sha256": "1bb3262b9d75d5cb51537cdf10b00caea84edc4ea468c06e61851a749f893218",
      "matches_worker": true,
      "unchanged_from_initial": false
    },
    "tests/fixtures/course-video-published-media.mjs": {
      "sha256": "eb3d52a2df5df3878911aecdef395d5822a59496b13228aa37a4609cac7a56bf",
      "matches_worker": true,
      "unchanged_from_initial": true
    }
  },
  "before_snapshots_match_revision1": {
    "Revision2-before-controller.ts": true,
    "Revision2-before-controller.test.mjs": true
  },
  "full_diff_sha256": "a8707b407d27479e5ff8f406afb93ad867b0e0c069589130c4d03ae3a37deedc",
  "matches_worker_full_diff": true,
  "delta_diff_sha256": "54ae30f3d14c5acc1ded206fb1ba6cdd0ec5c0573b63491f3ed6e04d7b51f996",
  "matches_worker_delta_diff": true,
  "reproduction_hashes": {
    "adversarial.test.mjs": "a5a0403b0ef9863b7509ebccd3c1c09c5ca82cd7917b4da1c9c06b34fc18fdd8",
    "Revision1-seek-without-play.test.mjs": "4f724d6fa260e971ca930dbaa107f3e091d2eb040a7cd92674879b564fd4a3a0"
  },
  "typecheck": {
    "rerun_by_verifier": false,
    "worker_exit_code": 2,
    "previous_verifier_exit_code": 1,
    "diagnostics": 55,
    "diagnostic_lines_equal_previous_independent_run": true,
    "all_copied_build": true,
    "src_tests_diagnostics": []
  },
  "focused": {
    "exit_code": 0,
    "tests": 262,
    "pass": 262
  },
  "previous_reproductions": {
    "exit_code": 0,
    "tests": 7,
    "pass": 7
  },
  "diff_check_exit": 0
}
```

### Final independent Verification Report (embedded)

## VERIFICATION REPORT — Revision 2 (final bounded delta)

TASK ID: COURSE-VIDEO-PUBLISHED-MEDIA-14
PROFILE: verifier_critical | GPT-6 Astra xhigh
RESULT: PASS — authorized consumer/controller functionality and focused regressions
RECOMMENDED NEXT ACTION: PASS_TO_SUPERVISOR for the bounded offline consumer package
WHOLE REPOSITORY TYPECHECK: NOT PASS (unchanged existing copied-build diagnostics)
PRODUCTION / RELEASE READINESS: NOT VALIDATED; no production service installation

These are separate conclusions. This bounded functional PASS must not be represented as a green whole repository typecheck or authorization to install/publish the production path.

SCOPE CHECK: PASS
- Actual Revision2 delta is only native-media-controller.ts and course-video-published-media-controller.test.mjs. Other four authorized file hashes remain equal to initial verified implementation.
- Independently reconstructed full patch matches Worker Revision2-ExactDiff.patch byte-for-byte: a8707b407d27479e5ff8f406afb93ad867b0e0c069589130c4d03ae3a37deedc.
- Independently reconstructed delta matches Worker Revision2-DeltaDiff.patch byte-for-byte: 54ae30f3d14c5acc1ded206fb1ba6cdd0ec5c0573b63491f3ed6e04d7b51f996. Both pre-delta source snapshots match this verifier's Revision1 hashes.
- Supervisor-supplied report/patch/evidence hashes confirmed. No verifier repository or implementation edits. Original failed tests/reports/logs remain unchanged; new evidence is in private Revision2 files.

ARCHITECTURE / CONTRACT / SECURITY CHECK: PASS within frozen consumer scope
- No further schema, public type, authority, legacy, server/DB/Auth/RLS or production composition changes. Previously verified unchanged contracts retain their acceptance.
- Delta introduces one private earliest-crossed-cue helper used by restore/play/observe/submit. Observe handles priority synchronously before publishing the new position. Submit separately checks actual media position before dispatching a write.
- Displaced later cue logical request and read token retire before the earlier checkpoint. Existing write token survives preemption until settlement/timeout, preventing a duplicate write; old results fail captured request/active cue checks and cannot drive a new cue's readback or accepted sequence.
- A legitimate later pending hint remains available when no earlier cue is crossed. Pause intent, no-autoplay restoration and ordered two-cue completion remain intact in independent test replay.
- This validates consumer behavior and consistency, not authentic server Tool provenance or subject/tenant authorization. No source fixture or production issuer was introduced by the delta.

TESTS — INDEPENDENT EXECUTION:
1. node --experimental-strip-types --test tests/course-video-published-media-contracts.test.mjs tests/course-video-published-media-controller.test.mjs tests/teaching-agent-r7b-execution.test.mjs
   PASS: 262/262, no failures/cancellations/skips, exit 0. Log: Revision2-focused.log.
   Includes 176 contract/subtests, 65 controller/subtests and 21 unchanged legacy regression tests. New affected tests cover no-play immediate seek, direct actual-position submit guard, pending before crossing, displaced read success/rejection and sequence lower bounds, displaced write settlement/duplicate suppression, and user pause.
2. node --experimental-strip-types --test /tmp/course-video-published-media-verification-bqz4ja4k/adversarial.test.mjs /tmp/course-video-published-media-verification-bqz4ja4k/Revision1-seek-without-play.test.mjs
   PASS: 7/7, exit 0. Log: Revision2-previous-reproductions.log. Both original private reproduction files were rerun unchanged.
3. git diff --check
   PASS, exit 0. Log: Revision2-diff-check.log.
4. npm run typecheck
   NOT PASS; no unnecessary independent rerun of unchanged diagnostics. Revision2 Worker actual exit 2. Its 55 diagnostic lines independently compare exactly equal to this verifier's initial actual run (exit 1), all under build/r7cb-b3a-candidate/source, zero src/ or tests/ diagnostics. Revision2-Evidence.json records this comparison. No build-tree cleanup or tsconfig edits performed. Prior isolated type-surface PASS remains applicable because public type files are unchanged.

ACCEPTANCE CRITERIA / CLOSED ISSUES:
- PASS — V1 initial crossed position with a later pending restored cue now activates/checkpoints vowel-cue first, media.plays=0 and paused=true.
- PASS — V1-R1 seek-after-restore without play now immediately activates/checkpoints vowel-cue; stale second submit returns null and dispatches no write.
  Captured independent evidence:
  {"afterSeek":{"active":"vowel-cue","position":20,"checkpoints":["vowel-cue"]},"resultCorrect":null,"submits":[],"completed":[],"activeAfterSubmit":"vowel-cue","plays":0,"paused":true}
- PASS — Both questions process in order without intermediate play; paused restoration does not invent automatic resume; explicit later play succeeds only after completion gates.
- PASS — User pause and old read/write callbacks preserve the current cue and immutable accepted-sequence boundary; original single-flight behavior is retained.
- PASS — Focused strict contracts, published preservation, independent readback, timeout/attachment/error fences and legacy regression suite.
- NOT PASS — Whole repository typecheck, independently distinguished from the functional result above.

ISSUES:
- V1 and V1-R1 are CLOSED in the bounded implementation after independent reproduction replay.
- No remaining implementation defect identified in this delta review.
- Existing copied-build typecheck failure remains documented; it is outside this six-path task and is not repaired or hidden.

MISSING EVIDENCE / NOT VALIDATED:
Real teaching video, actual browser/media integration, trusted server issuer/session/publication wiring, production authorization, live DB and release readiness. These remain explicitly deferred by Task14. No full suite/build/Docker/browser/network/live operations were run.

ARTIFACTS:
Revision2-Evidence.json contains actual source and patch hashes, unchanged-file checks, diagnostic equality and independent counts. Revision2-Commands.json contains commands and actual exits. Prior initial/Revision1 FAIL artifacts are preserved. Directory 0700; artifacts0600.

### Final Worker Report (embedded)

## WORKER REPORT — Revision 2

TASK ID: COURSE-VIDEO-PUBLISHED-MEDIA-14
PROFILE: worker_xhigh | GPT-6.1 Sol xhigh
OBJECTIVE: Complete the same V1/Gate D14 earliest-crossed-cue correction for observe/seek and direct submit, without an extra play action. No contract or scope expansion.

INPUTS:
- Task SHA256: 43bfac395182f3ee8e28904f4cd67be50766d0ccb026cf0a9cf21cf890015290.
- Revision1 VerificationReport SHA256: 6f0be358ecd75e3f8802cd5342a72b71811236511c4e8ccdf3da75399cc79ad1.
- Existing adversarial.test.mjs SHA256: a5a0403b0ef9863b7509ebccd3c1c09c5ca82cd7917b4da1c9c06b34fc18fdd8.
- Existing Revision1-seek-without-play.test.mjs SHA256: 4f724d6fa260e971ca930dbaa107f3e091d2eb040a7cd92674879b564fd4a3a0.
- Both private verifier tests remain byte-unchanged; existing Worker/Verifier reports and logs preserved.

ACTUAL REVISION SCOPE:
- src/features/smart-textbook-runtime/core/native-media-controller.ts only: add private prioritizePublishedCue shared by observe/seek, submit and existing restore/play correction. An earlier crossed incomplete cue synchronously displaces a later active cue, retires its logical request and latest read token, hides the stale question and checkpoints the earlier cue. Observe reorders before notifying the new position; submit also independently checks actual media position before any write. Existing single-write token is kept until settle/timeout, so preemption cannot create duplicate writes. Late old success/failure no longer belongs to the active request and cannot parse feedback, update receipt/sequence/state, or read back a new cue. A not-yet-crossed earlier cue does not displace a legitimate pending hint. User pause and original auto-resume intent are retained; no position or completion is inferred from pending.
- tests/course-video-published-media-controller.test.mjs only: strengthen all six Revision1 scenarios by removing the pre-assertion play action. Add immediate no-play seek/stale submit (pause false/true), actual-position submit guard, valid pending before earlier cue crossing, displaced read success/rejection with no sequence poisoning, and displaced write success/rejection with duplicate interactions suppressed and correct captured-request handling. Existing assertions retained.
- Other four authorized file hashes exactly match prior handoff. No schemas, public types, legacy implementation, consumers, config, production installer, DB or other source edits; no commit/deploy.

ACTUAL VALIDATION:
1. node --experimental-strip-types --test tests/course-video-published-media-contracts.test.mjs tests/course-video-published-media-controller.test.mjs tests/teaching-agent-r7b-execution.test.mjs
   Exit 0; 262 tests / 262 pass / 0 fail, cancelled or skipped. Breakdown: 176 contracts including subtests + 65 controller including subtests + 21 unchanged legacy R7B/R7C regressions.
   Log: Revision2-focused.log.
2. node --experimental-strip-types --test /tmp/course-video-published-media-verification-bqz4ja4k/adversarial.test.mjs /tmp/course-video-published-media-verification-bqz4ja4k/Revision1-seek-without-play.test.mjs
   Exit 0; 7 tests / 7 pass / 0 fail, cancelled or skipped. Both existing files run directly without modification.
   No-play reproduction actual evidence: afterSeek active=vowel-cue, position=20, checkpoints=[vowel-cue]; stale second submit result=null, submits=[], completed=[], activeAfterSubmit=vowel-cue, plays=0, paused=true.
   Log: Revision2-private-adversarial.log. These were Worker-run tests; independent approval remains pending.
3. npm run typecheck
   Actual exit 2; exactly the same 55 diagnostic lines as Revision1-typecheck.log, all build/r7cb-b3a-candidate/source; src/ and tests/ zero diagnostics. Full repository typecheck remains NOT PASS. No copied-tree/config changes.
   Log: Revision2-typecheck.log.
4. git diff --check
   Actual exit 0.

NOT RUN / NOT VALIDATED:
Build/full suite/Docker/real media/browser/live DB/server issuer/publication/release readiness. Deferred production trust and real-video dependencies remain as in the original report. No fake receipts leave test fixtures and no production service is installed.

ISSUES / RISKS:
- Independent delta verification still required from the same verifier; do not equate Worker-run verifier fixtures with independent acceptance.
- Whole repository typecheck continues failing solely on the unchanged documented copied-build tree; not marked PASS.

SCOPE CHANGE: None.
ESCALATION: None needed; bounded correction converged with all focused and supplied adversarial cases passing.
CONCLUSION: REVISION IMPLEMENTED; functional and supplied adversarial checks pass. Ready for independent critical delta confirmation. Full repository typecheck remains failed with the unchanged copied-build diagnostics.

ARTIFACTS (directory0700/files0600, no prior report/log overwritten):
- Revision2-WorkerReport.md.
- Revision2-DeltaDiff.patch: actual two-file delta from Revision1; Revision2-ExactDiff.patch: complete current six-path Task diff.
- Revision2-Evidence.json: input and six source hashes, unchanged four-path proof, exact diagnostic equality and actual test results.
- Revision2-Commands.json: exact commands and actual exits.
- Revision2-focused.log; Revision2-private-adversarial.log; Revision2-typecheck.log.
- Revision2-before-controller.ts; Revision2-before-controller.test.mjs: original Revision1 bytes for delta audit.
