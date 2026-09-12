# UPLY 智能教材 Phase 3C：第一章非 UI Readiness 阻断收敛

日期：2026-09-09。本阶段只有服务器旁路契约、转换、私有绑定、只读验证及测试；没有学生 Runtime UI。

## 1. 结论

| 指标 | 结果 |
| --- | ---: |
| Phase 3B unsupported 原数量 | 14 |
| 本阶段已解决的原阻断 | 11 |
| 剩余原阻断 | 3 |
| nonUiRuntimeReady | **false** |
| runtimeReady | **false** |

剩余三项是：`dialogue:greeting:0` 的服务端播放完成证据、segment 199 语音与当前配置的一致性、Renderer / Compatibility Executor。没有把其中任何一项降为 warning。

候选仍完整覆盖 **8 Step、19 Activity、orientation 三题、v23 的 8 个 legacy 教学节点**。12 个 Block 不变，增加活动题组的真实页/题 part 声明后共有 351 个 part targets（Phase 3B 为 317）。未伪造 teacher video。

基线保持：`docs/SMART_TEXTBOOK_CURRENT_STATE_AUDIT.md`、实际去留文档 `docs/SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`、`docs/SMART_TEXTBOOK_MANIFEST_RUNTIME_V1_DESIGN.md`、Phase 3A/3B 报告。没有复制第二份去留文档。

## 2. 原 14 条逐项结果

下表证据编号在后续各节给出真实路径和函数。`已解决` 表示该数据/映射阻断通过旁路验证，不等于已上线或已经存在 Renderer。

| Blocker | Phase 3B 状态 | Phase 3C 结果 | 证据 | 是否仍阻断 |
| --- | --- | --- | --- | --- |
| repeat-01 alt 缺失 | unsupported | 精确 audioAssetKey 对应 `안녕하세요?`，生成双语 accessibility description | A | 否 |
| repeat-02 alt 缺失 | unsupported | 对应 `저는 수진이에요.` | A | 否 |
| repeat-03 alt 缺失 | unsupported | 对应 `한국 사람이에요.` | A | 否 |
| repeat-04 alt 缺失 | unsupported | 对应 `저는 학생이에요.` | A | 否 |
| repeat-05 alt 缺失 | unsupported | 对应 `한국어를 배워요.` | A | 否 |
| repeat-06 alt 缺失 | unsupported | 对应 `만나서 반가워요.` | A | 否 |
| chapter-01-listening-identity alias | unsupported | 旧单轨活动的默认 page 0 → 冻结 listening track ref | B | 否 |
| chapter-01-listening-dialogue-normal alias | unsupported | 当前活动第二组/page 1 → 冻结 listening track ref | B | 否 |
| review nextNode → chapter-test | unsupported | 真实 chapter_test_id/slug → 闭合私有内部目的地 | C | 否 |
| studentTask dialogue:greeting:0 / audio_completed | unsupported | target 已识别；browser TTS 没有授权媒体身份及服务端完成证据，拒绝 play/evidence 提升 | D | **是** |
| activity-page 历史关联/聚合 | unsupported | 冻结 8 页/26 题身份；投影、恢复及原 Action/submit 参数往返验证 | E | 否 |
| guided-repeat 历史索引关联 | unsupported | speaking activity + 2 track / 14 segment ↔ 稳定身份，沿用原唯一 upsert 键 | F | 否 |
| speech timeline/segment/授权 | unsupported | 44 条扫描：28 条核验通过，16 条 segment 199 不符，隔离而非替换 | G | **是** |
| Renderer / Compatibility Executor | unsupported | 未实现，继续禁止激活 | H | **是** |

## 3. 文件与入口

新增服务器文件均在 `src/lib/smart-textbook-legacy-adapter/`，都有 `import 'server-only'`：

| 文件 | 职责 |
| --- | --- |
| `readiness.server.ts` | `adaptChapterOneReadiness`：在原 Adapter 结果上作证据约束的旁路收敛；返回 manifest/bindings/services/report/resolved/nonUiRuntimeReady |
| `readiness-contracts.server.ts` | strict source-evidence / frozen-service-map schemas；ReadinessBindings、LegacySpeechBinding 类型 |
| `readiness-validation.server.ts` | 私有 listening/page/repeat/navigation/playback/speech 关联及 revision/coverage/重复检查 |
| `compatibility-services.server.ts` | 授权上下文约束、alias/导航/语音解析、page/repeat 投影及原 Action 参数、播放观察校验与幂等端口 |
| `service-reader.server.ts` | `readChapterOneServiceEvidence`：补充 chapter-test 关系与 speech timeline 的两类 SELECT |
| `speech-proof.server.ts` | `verifySpeechSlot`：复用现有分段/去富文本函数检查文本 hash、segment 和时间轴 |

唯一改动的既有 Adapter 文件是 `bindings.server.ts`：`validatePrivateBindings` 增加可选的 readiness 验证上下文；原两参数检查全部保留。Phase 3A Manifest 类型、Registry、Validator、targets 和 Phase 3B `adaptChapterOne` 均未修改，原 14 条基线仍可重现。

测试资产：

- `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-service-identities.server.ts`：从 Phase 3B 冻结身份提取并固定的历史 page/item/track/segment 关联，不在每次转换时重新按数组位置分配。
- `tests/fixtures/smart-textbook-legacy-adapter/chapter-one-service-evidence.server.ts`：真实 SELECT 采集的 chapter-test 关系及 44 条 cue timeline；仅服务器测试使用，不含媒体对象地址、用户数据或 secrets。
- `tests/smart-textbook-readiness.test.mjs`：55 项新增测试。
- 本报告。

调用示意（不是新 Route，也不自动发布）：

```ts
const source = await readChapterOneLegacySource(authorizedClient);
const evidence = await readChapterOneServiceEvidence(authorizedClient, source);
const result = adaptChapterOneReadiness(source, frozenIdentities, frozenServiceMap, evidence);
// 不能把整个 result 返回浏览器；bindings/services/evidence 都是服务器资产。
// result.nonUiRuntimeReady === false
// result.report.runtimeReady === false
```

## 4. A：六个跟读音频 alt

真实媒体 metadata.kind 为 `listen_speak_repeat`，purpose 为逐句正式示范音，六项均 pending。`content.repeatLines[].audioAssetKey` 与 media.asset_key **直接相等**；不是按 metadata.lineIndex 或名称相似度寻找文本。

确定性规则：唯一关联、同 node、audio 类型、非空 Korean text 时，输出 `韩语跟读示范：${ko}` / `따라 말하기 예시: ${ko}`。缺失/歧义关联保留 unsupported，不输出泛化的“音频”作为成功结果。生产 alt_text 不变，媒体仍是 pending，不伪造可播放资源。

现行 `KoreanLevelOneSmartTextbook.tsx → ListenSpeakLearningPanel` 优先使用 repeatTracks，逐句按钮调用 `speakKorean`，不是依赖这六条 pending asset 的 alt。原 repeatLines 是公开学习内容，已由 Phase 3B compat 保留；这里的描述不会揭示秘密听力稿。

证据：`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx` 的 repeatTracks/repeatLines/playRepeatLine；源 fixture 的 media / repeatLines；新 `readiness.server.ts` 的 alt 精确关联。

## 5. B：听力 alias 的真实链路

当前 React 实际播放：`Activity → /api/digital-textbook/audio/${activity.id}?page=${activeGrammarPage}`。public_config.audioId **不是 URL 解析器的入参**；Activity 的 items 按 group/groupKo 分组决定当前页。跟读整轨参考同样按 listeningActivity.id + repeatTrackIndex 请求该 Route。

Route 顺序：登录及 korean_course 权限 → 用户客户端/RLS 读取 activity/node/module/chapter/version/textbook published 链 → 私有 listening_tracks(activity_id,page_index) → 兼容 activity secret 音频 fallback。对象签名及音频字节代理仍留在原 Route。

真实数据和迁移证据：

- `supabase/migrations/202608180005_chapter_one_golden_smart_textbook.sql` 中旧单轨 activity public alias。
- `supabase/migrations/202608240006_split_chapter_one_listening_into_two_tracks.sql` 明确同 activity 的 page 0 自我介绍、page 1 双人对话、两组各四题。
- 当前 SELECT 的两个 listening_tracks 及 Phase 3B 已冻结的音频摘要映射。
- `src/app/api/digital-textbook/audio/[activityId]/route.ts`。

私有绑定包含三个精确 alias（额外保留本就可解析的 identity-normal）：`alias → activityId / legacyPage / frozen trackId / mediaRef / revision`。`resolveListeningAlias` 要求授权上下文和相同 source/version；不认识的 alias 拒绝。返回旧 Route 参数，不返回对象地址或签名 URL。

## 6. C：review → chapter-test

新增 SELECT 得到：chapter `cda24fb8-c93b-4a19-9577-4418350ff708` 的 chapter_test_id 为 `4b946d1c-798a-40d2-901d-598c6202f121`，关联 `chapter_tests.slug = korean-level-one-01`。

现行链：`src/lib/smart-digital-textbook.ts → chapter_tests(slug) → chapterTestSlug`；学生 Shell 构造 `/dashboard/assignments/korean/{slug}`，在 progressPercent >= 100 时开放入口；测试页面位于 `src/app/dashboard/assignments/korean/[testSlug]/page-content.tsx`。

新的私有 Navigation Binding 只允许 `kind: chapter-test`、该真实 testId/slug、`requires: server-chapter-completed`。解析需要调用方提供已授权服务器完成状态。它不是任意 URL/跳转系统，review 的 Step.nextStep 仍为 null；未扩大 Manifest，也未替代测试页面自身授权。

## 7. D：Teaching Bridge 非 UI 契约

`compatibility-services.server.ts` 明确区分：

| 责任 | 本阶段约束 |
| --- | --- |
| target resolution | stable target 必须存在于私有 playback mapping / Manifest 声明 |
| allowed command | 有已绑定 listening media 的内部 page target 可提出 play；browser TTS target 只允许 reveal |
| accepted event | 仅闭合 `media-ended` 请求；拒绝客户端 score、audio_completed 等扩展字段 |
| evidence | 只接受 playback observation，不声称学习完成 |
| server validation | 已授权服务端 scope，source/version、session、snapshot、generation、target、media、有效期匹配 |
| idempotency | 注入原子 consumeOnce 端口，以 tenant/student/session/snapshot/revision/generation/target/media 构成逻辑键；换 eventId 重播也不重复 |
| 结果 | formalCompletion=false、progressDelta=null、agentAdvance=false |

`ServiceScope` / `PlaybackGrant` 是可信服务器上下文，不是从请求体照抄的授权布尔值。真实调用前必须由既有 auth/RLS/会话服务建立。没有接入生产持久化 ObservationStore；测试使用内存原子实现验证端口语义，绝不是 fake renderer。跨进程持久幂等仍须未来提供满足端口约束的服务端实现；当前不允许把此模块直接当生产事件 API。

对于第一章真正的 `dialogue:greeting:0`，`ContentRenderer → playGuidedDialogueLine → SpeechSynthesisUtterance.onend` 仅产生浏览器 audio_completed。现行 `src/app/api/learning-agent/events/route.ts` 检查 session/node/task 并去重，但没有强媒体播放证据。新绑定 `mediaRef=null`，拒绝 play/正式完成；原阻断保留。不能借“接口存在”宣称已经证明听完。

公开 Registry 对 compat.learning 的 play 限制没有放宽。私有 Bridge 的听力观察契约也不会自动给公开 target 增加 play capability。

## 8. E：Activity Page 历史等价

证据：同目录 `smart-textbook-actions.ts → checkSmartTextbookActivityPageAction`；`src/lib/smart-digital-textbook.ts` 的 pageProgress 恢复；学生 `Activity` 的 groupedChoicePages/fillBlankPages/checkGrammarPage/revealGrammarAnswers/submit。

真实表键：`tenant_id,student_id,activity_id,version_id,page_index`。item_indices 是 **public_config.items 原始题目序号**，不是选项显示顺序或教材 panel 序号。response/results/answers 数组按 item_indices 对齐。Action 继续用服务端 secret 判题和 upsert，本阶段不调用它写入。

第一章持久 page 工作流为 grammar-choice、grammar-judgment、grammar-fill、listening-identity：各两页，共 **8 页、26 题**。其他 vocabulary/pattern/dialogue 等流程可能调用无 pageIndex 的分页检查；没有 pageIndex 就不写该表，不能把它们伪造成 module page progress。Phase 3B 八个 node 级 activity-page ref 被私有 projection 明确解释，只有这两类 node 有真实活动页成员，其余没有持久页成员。

首次从冻结身份找到 item partId，将其旧 page/item 关联固定保存，并固定整个映射 digest。新 pageId 由既有题目身份集合及 activity 派生，**不使用当前页号或标题作为身份**。后续 items 重排时仍用原 frozen part/fingerprint 查找，发送给旧服务的索引不变。修改内容、group 或历史索引必须重新审查认证，不自动猜对齐。

往返：

```text
授权旧 row（page_index + item_indices + 用户结果）
 → projectActivityPage
 → stable pageId / item partIds
 → activityPageServiceInput
 → 原 checkSmartTextbookActivityPageAction 参数
```

`activitySubmissionInput` 还原全活动 response 的旧 grader 顺序。`legacyPageSubmitEligibility` 对齐当前“听力所有页已检查/揭示，或最后活动最后页正确”等提交资格条件，**不代替 grader**。正式 node/activity completion 仍来自原提交、attempt/RPC。用户态答案/反馈只在授权 projection 内，永不进入 Manifest。

测试使用合成用户 progress 数值，未读取真实学生记录。证明是确定字段往返/服务语义等价，不是已执行线上写入的端到端证明。

## 9. F：Guided Repeat

真实链：`ListenSpeakLearningPanel.playRepeatLine` 在设备 TTS 成功结束时调用 `saveGuidedRepeatProgressAction({activityId, practiceKey:'repeat-line', trackIndex, segmentIndex})`；activity 为同 node 的 speaking-introduction。

原表唯一键：`tenant_id,student_id,activity_id,practice_key,track_index,segment_index`；没有 version_id，因此新服务 scope 额外固定教材版本和历史 source。loader 仅恢复 repeat-line 行。这个记录表示旧系统的逐句练习标记，不是录音证据、正式分数或 Activity completion。

冻结绑定覆盖 2 track / 14 segment，使用 Phase 3B 已分配 track/segment 身份。重排 track 和 line 不改变历史调用的唯一键；restore 对重复行集合去重；旧 Action upsert 原键，不会新增第二个完成实体。未知 segment 拒绝。未改录音、speaking evidence、原 Action 或数据库。

## 10. G：Speech 核验结果及未解决原因

补读 44 条 id/node/locale/segment/hash/duration/status/cue_timeline，**没有读语音 object_key 或 voice_manifest**。固定 v23 下：28 条非 199 资源通过；16 条 segment 199 被记录在 `services.speechRejected`，不进入可解析语音列表。

核验复用：`src/lib/teaching-video.ts → teachingScriptSegments`、`src/lib/rich-teaching-text.ts → stripRichText`。普通 segment 按当前段落/显式分段；197/198 对应 hint/example。文本 SHA-256 必须相等；cue 时间非负、单调、在 duration 内；字符区间合法并覆盖原文范围。供给端 cue.text 可能省略标点，不能用拼接 cue.text 猜原文替代 hash 检查。

现行选择证据：`src/lib/learning-agent-script-runtime.ts → resolveScriptCharacter` 使用 node/locale/segment/content_hash/ready，并从所选 scriptPerformances 取得角色/voiceEnabled；`resolveBufferLineSpeechAssetId` 对 buffer **先匹配 preset**，再按 segment 199/hash 查表。完整 performance 仍在原 teacher capsule，新语音绑定不改角色逻辑。公开无 script 行/语音时间轴。

16 条 199 不能与当前配置或现有 provision 脚本默认文本 hash 完全对应。例如 observe-scene 当前 buffer 已改为引导学习区，数据库 199 仍为旧过渡句；部分未配置 buffer 的节点也存在旧 199 资源。**这不表示学生端必然正在播放错误资源**：现行 hash 检查、空 buffer、preset 优先都可能使其不被选中。但在本阶段无生成/替换/生产改动权限下，不能声称全部固定语音和 preset 的选择已认证。

授权证据：`src/app/api/learning-agent/speech/[assetId]/route.ts` 每次 requireActiveUser，ready asset → script version published；非 published 要求 platform_owner。新 `resolveLegacySpeech` 只返回已验证 assetId/hash/duration，原 Route 仍负责授权与对象签名；不改善、不弱化其当前权限行为，也不宣称它已有更细教材注册权限。未知版本/node/segment 和被隔离的 199 一律拒绝。

因此原 speech 阻断保留，并附 16 条可定位私有诊断；不是把它拆成更多阻断后混淆原 14 条统计，也不是降级 warning。

## 11. 私有 Validator、确定性和公共边界

`validatePrivateBindings(manifest, bindings, readinessContext)` 保留原所有检查，额外检查 source/version/history digest、覆盖数量、重复身份、activity/track/media/revision 关联、page/repeat part 存在、导航真 FK、playback target 与 page/media 归属、speech node/segment/version/hash/timeline。

Validator 会重新核验语音文本/时间轴：不能把 rejected 项移到 verified 数组来洗成合法资源。未知 alias/错误版本/悬空 part/错媒体/错误导航均有负例。

未扩大 Manifest v1。只在原 Schema 允许的 compat.parts/runtimeTargets 中补充冻结活动页/题身份、改善现有 media.alt；没有公开 old indices、任意 URL 或 service schema。server/private bindings 仍不能作为可下载 Manifest。

固定摘要：

```text
readiness revision = chapter-one-readiness.1
source revision = 0feb9264ff035a1139cde70e9b1a4611608883d4832f06be87c4a5327f279fc0
historical mapping digest = a6fb74b165aa19cb0be225b709f7650703dc9540d947c754a82626e5123ee413
manifest digest = sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f
```

相同输入重复转换全结果相同，supplemental speech 行顺序反转仍相同；compiledAt 不进入语义 digest。历史 map 被 pin；snapshot ID 额外包含规范化 supplemental evidence/map 摘要。只读 live Reader + Adapter 再次得到同一 source/digest、8/19、11 resolved / 3 remaining、28/16 speech 结果。多 SELECT 仍不是生产事务快照，不构成发布服务。

## 12. 测试与自我验证

```bash
npm run typecheck -- --incremental false --pretty false
node --no-warnings --experimental-strip-types --test tests/smart-textbook-readiness.test.mjs tests/smart-textbook-legacy-adapter.test.mjs tests/smart-textbook-runtime-v1.test.mjs tests/smart-textbook-sidebar.test.mjs tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs
git diff --check
```

| 验证 | 结果 |
| --- | --- |
| Phase 3A | 85/85，通过；原测试/公共契约未改 |
| Phase 3B | 50/50，通过；原 14 条基线仍可重现 |
| Phase 3C | 55/55，通过 |
| 相关旧系统回归 | 83/83，通过 |
| 合计 | **273 passed，0 failed，0 skipped** |
| TypeScript | 通过，无新配置/抑制错误 |
| git diff --check | 通过 |
| 非 UI/Runtime ready | false / false，无降标 |
| 数据保护 | Manifest 不含 secret/object key/service role/私密 transcript/语音 capsule payload |
| 生产引用 | 原 Phase 3B import 边界反查测试通过，无范围外生产文件 import Adapter |
| 数据库 | 必要 SELECT-only；无写入、migration、RPC、发布、上传、签名调用 |

新增服务测试同时覆盖播放重放、错误 session/snapshot/generation/media、过期授权、客户端分数注入、历史页/题往返、整活动顺序、track/segment 重排、错语音和任意 URL 拒绝。所有失败样本都断言具体拒绝，不只检查本来就为 false 的总 readiness。

## 13. 生产保护和停止

未修改学生路由、SmartTextbookShell、ContentRenderer、Agent 推进、判题、录音、数据库 schema 或 legacy 角色。所有新能力为 server-only，除注入的幂等端口外都是无写入的转换/解析函数；端口没有连到生产存储。没有实现 React Renderer、Step UI、visualCue、发布 pointer 或新 Runtime。

工作区已有其他业务改动和未跟踪 migration，本阶段未覆盖或清理它们；它们不属于本阶段交付。历史报告保留原阶段结论，Phase 3C 使用独立 refinement 入口记录本阶段收敛。

**尚需解决的非 UI 项仍是 TTS 播放证据和 segment 199/preset 语音选择。Runtime Renderer 也仍不存在。本阶段完成后停止，不自动进入 Phase 3D。**
