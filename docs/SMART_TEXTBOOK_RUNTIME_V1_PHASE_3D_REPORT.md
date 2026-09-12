# UPLY 智能教材 Phase 3D：第一章 Non-UI Readiness 最终反查

日期：2026-09-09。实现仍是 server-only 旁路，没有接入生产。

## 1. 结论：不能宣布 Non-UI Ready

| 指标 | 结果 |
| --- | --- |
| Phase 3C 剩余非 UI blocker | 2 |
| 本阶段解决 | 1：受控 Browser TTS observation grant |
| remainingNonUiUnsupported | **1：speech.voiceTimeline / buffer 选择一致性** |
| 含 Renderer 的剩余 unsupported | 2 |
| nonUiRuntimeReady | **false** |
| runtimeReady | **false** |

关键发现：**现行 loader/恢复路径并不都调用 hash-safe 的 `resolveBufferLineSpeechAssetId`。** 它们会把 ready segment 199 asset 直接交给学生端，并优先于 preset 使用。因而不能把 Phase 3C 的 16 条 mismatch 一概认定为 unreachable-stale。

14 条有 reachable-but-invalid 的代码路径；另外 2 条终点节点资源为 unresolved。没有修改语音、配置、preset、状态或对象，没有删除任何资源。

第一章仍为 8 Step / 19 Activity / orientation 三题 / published v23 legacy。公开 Manifest 与 Phase 3C 相同，没有假 mediaRef 或 Teacher Video。Renderer/Compatibility Executor 继续未实现。到本报告为止停止，不进入 Phase 4。

## 2. 基线与文件范围

沿用现状审计、实际去留文档 `docs/SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`、Manifest/Runtime v1 设计及 Phase 3A/3B/3C 报告。没有重新设计 Manifest、复制去留文档或改写历史阶段结论。

新增文件，均有 `import 'server-only'`：

| 文件（目录：src/lib/smart-textbook-legacy-adapter/） | 职责 |
| --- | --- |
| `final-proof.server.ts` | 闭合 TTS binding、buffer 多路径选择证明、16 条历史资源分类、完整证明反查 |
| `tts-observation-grant.server.ts` | 授权签发、opaque grant/nonce、一次消费、expiry、generation、撤销及竞态保护 |
| `final-readiness.server.ts` | `finalizeChapterOneNonUiReadiness`：旁路调用 Phase 3C，按真实证明重算非 UI 阻断及 proof digest |

修改现有旁路文件 `readiness-validation.server.ts`：在 `validatePrivateBindings` 已使用的上下文中增加可选 finalProof，校验 TTS 和 speech 完整证明。所有原验证保留。

新增 `tests/smart-textbook-final-readiness.test.mjs`（53 项）与本报告。Phase 3A/3B/3C 契约、测试、源样本、身份清单和生产文件均未改动。

## 3. TTS 真实链和 Agent 语义

学生文件：`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx`。

当前链：

```text
orientation.dialogueGroups[greeting].lines[0].ko
 → ContentRenderer / playGuidedDialogueLine
 → SpeechSynthesisUtterance(text), ko-KR
 → onend（onerror 不报告成功）
 → recordTutorLearningEvent(audio_completed, dialogue:greeting:0)
 → /api/learning-agent/events
 → learning_agent_task_events
 → respond / resolveScriptStep 的 requiredTaskPending
 → task_feedback / 后续教学 cue
```

证据：

- `src/app/api/learning-agent/events/route.ts`：检查 active user/tenant/session/node/task，按 session/node/event/target 去重。不会写 digital_textbook_attempts、node_progress 或判题 RPC。
- `src/app/api/learning-agent/respond/route.ts`：读取 task_events，传给 `resolveScriptStep`；明确区分教材进度与 scripted session 生命周期。
- `src/lib/learning-agent-script-runtime.ts → resolveScriptStep`：task 未满足时停在 task；满足时进入 task_feedback；后续问题仍检查 answeredNodeId。完成判题不是 task event 的职责。
- 当前 v23 `model-dialogue` 为 example、非 terminal、没有 reference_activity_id；其唯一 required studentTask 为 play_expression_audio / audio_completed / dialogue:greeting:0。限定此 cue，不泛化到任意 Agent event。

结论：可以等价表达为“教学播放观察满足等待”。**并不证明用户听完、理解或掌握；不产生分数、attempt、activity completion 或 progress。** 旧事件 Route 对 terminal 可能结束 Agent session，但本阶段的 binding 明确不授权 terminal/assessment cue，不能借本 Grant 跳过终点或提问。

## 4. TTS Observation Grant 契约

`buildTtsBinding` 从真实公开学习文本和 Phase 3B 冻结 part identity 构造闭合绑定：

```text
kind = authorized-browser-tts-observation/1
utterance text = 안녕하세요?
locale = ko-KR
textHash = d62d94affe19fbb6ec2cec8cbe94a0cf3f8492308fd795e4d2b8c6eadb47abe9
cueId = 21586656-413b-406c-b9cc-452bc63ee09d
teachingRevision = feb30ba7-0a5e-4e9f-83e6-8970f715ddd5
utteranceId = utterance-29f498f8cd417f08db449a82a8564870
```

target 是既有 compat.learning 的稳定 part；没有创建普通 mediaRef、R2 对象或改 Registry 的 media-play 验证规则。

服务器保存的 `TtsGrant` 绑定：grantId、nonce、actor/tenant、runtimeSession、snapshotId、sourceRevision、teachingRevision、stable target、expectedTextHash、locale、utteranceId、cueId、stepId、generation、issuedAt、expiresAt。

| 步骤 | 行为 |
| --- | --- |
| issue | 客户端输入只允许 sessionId；可信 authorizeSession 回调读取当前授权身份、cue/Step/generation，逐项匹配已编译 binding |
| 返回浏览器 | 只有 grantId、授权 text、locale、expiresAt；身份、预期 hash、nonce 和权限不是客户端声明 |
| observe | 客户端只提交 grantId，可附 diagnostic eventId；strict schema 拒绝 score/completion/target/textHash 等附加字段 |
| 验证 | 重新授权 session；检查 snapshot/source/teaching revision/target/textHash/locale/utterance/Step/cue/generation/phase/expiry |
| 一次消费 | opaque grant 查服务器私有存储；相同逻辑播放重复 issue 重用 grant；消费后不得重新 issue 同一逻辑操作 |
| 重放 | eventId 改变不能重复消费；duplicate 不产生第二次教学等待效果 |
| 撤销 | revokeSession；签发等待期间和消费授权等待期间的撤销都阻断；旧 Step/generation 的迟到 onend 拒绝 |

首次有效观察结果：

```text
playbackObserved = true
observation = authorized-browser-tts-ended-report
formalCompletion = false
progressDelta = null
score = null
agentAdvance = false
teachingPlaybackWaitSatisfied = true
teachingEffect = eligible-for-task-feedback
```

这只表示“一个服务器授权的浏览器 TTS utterance 报告了结束”。`eligible-for-task-feedback` 不是自动切 cue：现行教学状态机仍需自行执行后续反馈/问题条件。本阶段不调用生产事件 Route，也不写 task_events。

服务器实现是有容量上限的独立进程内服务，无全局 singleton。随机 grantId/nonce 属于个性化会话运行态，不进入 Manifest 或确定性 proof digest。多实例部署前必须另行提供保持原子签发/撤销/消费语义的持久服务，不得把本旁路实例当成已接入生产的跨副本服务。当前完成的是非 UI 服务契约与可执行验证，不声称已部署。

## 5. segment 199：真实选择路径并非只有一条

### 5.1 respond 的过渡 helper

`src/lib/learning-agent-script-runtime.ts`：

1. `upcomingScriptNodeBufferLine` 读取下一 node 的配置文本，不为缺 buffer 自动生成默认文本；段内继续和 terminal 不生成下节过渡。
2. `resolveBufferLineSpeechAssetId`：空文本 → null；按实际文本匹配 `learningAgentBufferPresetAssetRef` → preset 优先；否则 node/locale/segment 199/content_hash/ready 精确查询。
3. `src/lib/learning-agent-buffer-presets.ts` 的匹配是 trim 后精确文本，不是反查数据库 199 猜文本。配置 presetId 和文本冲突在新 proof 中拒绝。

第一章入口无“上一 node 过渡进入入口”这条边，因此不伪造该 transition 作为当前可达 cue。入口通过 opening-loader/restart 处理。

### 5.2 opening / session loader

`src/lib/smart-digital-textbook.ts`：

- openingBufferSpeechAssets：按 opening node / locale / segment 199 / ready 读取 **id,script_node_id,locale**。
- activeSessionBufferSpeechAssets：同样按 resolved active-session node / segment 199 / ready 读取。
- 两者不读取、不验证 content_hash；不是调用上面的 preset-first helper。

学生 Shell 的 tutorNextBufferSpeechAssetId / activeOpeningBufferSpeechAssetId **优先使用 loader 的 assetId**，然后才考虑 preset。重启也会传入 opening asset override。因此如果旧 ready asset 请求成功，即使其文本与当前 buffer 不同，也不会触发网络失败 fallback。

### 5.3 恢复初始状态与重新进入还不一样

- 初始恢复 buffer 使用 `??`；空字符串保留，`bufferLineForRequest` 将空内容变为 null，不启动语音。
- activeOpeningBufferLine 使用 `||`；空 resumed buffer 可回落到第一节点 opening text。
- 模块重新进入的 effect / 重置路径把 activeOpeningBufferLine 和当前 session assetId 一起写回 next-buffer 状态。

因此，非空入口文本可能与另一个 node 的旧 199 asset 配对。这里证明的是代码可选择路径，**不是读取了某个学生实际播放日志，也不是断言每次加载都播放**。视频模式、暂停、尚未进入 legacy 教师状态等条件可能阻止播放；不能因此认定该依赖永不可达。

### 5.4 现有 fallback 的准确边界

同一学生文件 `tutorReply`：speech 请求不存在/失败 → browserSpeechFallback → speakTutorCharacterLine；无浏览器语音或 voice disabled 时展示文本。`playTutorBufferSpeech` 中音频播放失败则 finish(error)、保留文本，不会通过 Promise rejection 再强制 TTS。

这些均是旧代码已有行为，不是本阶段新产品 fallback。proof 的 `existing-browser-tts-or-text` 表示这一现有故障路径，不表示已验证 preset R2 字节内容。未读取/签名/制作 preset 音频。

**成功返回但文本不匹配的 ready asset 不属于该 fallback 的触发条件。** 不能为了消除 readiness 阻断让新兼容器擅自换语音或改 preset 优先级。

## 6. 当前 buffer cue / 路径完整清单

每格同时适用于 **zh-CN、ko-KR 两种 locale**；每条实际 proof 分开保存 locale、node、expectedTextHash、preset、selectionMode、candidate/selectedAssetId、fallback、proofStatus。生成结果共有 48 条 buffer 路径证明，其中包含明确标记的终点恢复未确认路径；另保留 28 条 Phase 3C 核验过的非 199 speech asset 证明，共 76 条。

| v23 node（当前顺序） | buffer-transition | opening-loader | resume-loader 初始 | resume-reentry/reset |
| --- | --- | --- | --- | --- |
| step-8-bbfc46 | 不存在入口前驱，不生成 | teacher-introduction 文本，旧 asset 优先：unsupported | 同左：unsupported | 同左：unsupported |
| welcome | 空 buffer：现有 silent | 不适用 | 空 buffer：silent | 回落入口文本，旧本 node asset：unsupported |
| observe-scene | focus-learning preset；现有请求失败 TTS/text fallback | 不适用 | focus-learning 文本，旧 asset：unsupported | 同左：unsupported |
| explain-order | 空 buffer：silent | 不适用 | 空 buffer：silent | 回落入口文本，旧 asset：unsupported |
| model-dialogue | 空 buffer：silent | 不适用 | 空 buffer：silent | 回落入口文本，旧 asset：unsupported |
| check-understanding | 空 buffer：silent | 不适用 | 空 buffer：silent | 回落入口文本，旧 asset：unsupported |
| lesson-mission | 空 buffer：silent | 不适用 | 空 buffer：silent | 回落入口文本，旧 asset：unsupported |
| ready-for-practice | 空 buffer：silent | 不适用 | terminal 活跃会话可达性 unresolved | terminal 活跃会话可达性 unresolved |

终点 ready-for-practice 正常响应会将 scripted session 标记 completed，而 loader 只恢复 active session；没有证据证明历史 active session / 版本迁移是否仍可落到此终点，因此既不断言可达，也不宣布 stale。未读取学生个人会话来伪造覆盖证明。

该清单覆盖本阶段的 buffer/199/preset 选择问题；28 条非 199 是既有资源核验目录，不将所有可能动态生成的 Agent 文本冒称为本阶段认证过的预生成语音。

## 7. 原 16 条 mismatch 的逐条分类

| node | locale | assetId | 分类 |
| --- | --- | --- | --- |
| lesson-mission | ko-KR | 0269cfba-ecd4-43bf-bd50-29e9523bd658 | reachable-but-invalid |
| step-8-bbfc46 | zh-CN | 03e9c447-ac05-4f21-a1ee-aed5bc407503 | reachable-but-invalid |
| welcome | zh-CN | 0aaa0b27-740a-4fc7-8eee-5e5747804a35 | reachable-but-invalid |
| observe-scene | ko-KR | 4c231d36-abe7-43be-b683-beaf25c532c0 | reachable-but-invalid |
| observe-scene | zh-CN | 6873c663-fb5f-4779-9384-8fee0b65641b | reachable-but-invalid |
| lesson-mission | zh-CN | 764d1a44-a97f-47a6-9dad-ba7ca1f7c9ae | reachable-but-invalid |
| welcome | ko-KR | 7b805fee-2608-440c-85ee-a460d49bd32b | reachable-but-invalid |
| step-8-bbfc46 | ko-KR | 87da82fe-5cbe-4e47-9246-96cddab8bd3f | reachable-but-invalid |
| check-understanding | zh-CN | 975156c1-c730-41f3-a063-63857bca064a | reachable-but-invalid |
| explain-order | zh-CN | 9e27f5e3-3f17-4b05-9879-61e9c76f8b8b | reachable-but-invalid |
| explain-order | ko-KR | a0a554c4-42da-4ef0-ba72-3894888fd18f | reachable-but-invalid |
| check-understanding | ko-KR | b4334fd7-1c63-45ff-b75e-6f2b9dec216c | reachable-but-invalid |
| ready-for-practice | ko-KR | b7e3ef6d-5332-4001-8ecd-7e800e34ed28 | unresolved |
| ready-for-practice | zh-CN | ba1280a3-3e32-4ed3-b2dc-cd57dfbb63a3 | unresolved |
| model-dialogue | ko-KR | d4444750-9c2d-4ce4-af88-4e9011b1c893 | reachable-but-invalid |
| model-dialogue | zh-CN | d47641f8-2e64-4103-8fc2-2adbccd428df | reachable-but-invalid |

| 统计口径 | 数量 |
| --- | ---: |
| 原 199 reachable-and-valid | 0 |
| 原 199 reachable-but-invalid | 14 |
| 原 199 unreachable-stale | 0 |
| 原 199 unresolved | 2 |
| 76 条路径证明中的 verified-asset | 28（全部非 199） |
| verified-existing-fallback | 24（22 silent，2 focus-learning preset 的现有失败 fallback） |
| unsupported 路径 | 24（含 4 条终点恢复未确认路径） |
| 可安全选择的真实 asset catalog | 28；16 条旧 199 全部不进入 |

路径数不等于资源数，同一个 asset 可能在多个加载/恢复路径成为候选。`legacyCandidateAssetId` 记录旧代码可能选中的 ID；`selectedAssetId` 只在 verified-asset 时提供给新的安全目录。未通过者不会因为记录候选就被认证可用。

没有任何一条被标记 stale-unreachable，因此没有以“没看见引用”冒充全 published 引用反查。不存在的证明不会被推断为删除许可；16 条数据库行和资源全部原样保留。

## 8. 校验、失败与确定性

`validatePrivateBindings` 的 finalProof 分支通过 `validateFinalProof` 重建规范结果：

- TTS strict schema；target 属于允许的 compat part，冻结文本 hash、cue/revision 一致；formalCompletion 必须 false，progressDelta 必须 null。
- speech 路径全覆盖、ID 唯一；preset/expected hash/selection/资产归属与源证据一致；漏 cue、重复 proof、错误 asset、改造 fallback、将失败资源塞进 selectable catalog 都拒绝。
- 无法证明的当前路径保持 unsupported。finalizer 只在整项证明成立时移除对应原 blocker。

本阶段公开 Manifest 没有变化；内部选择路径、服务授权字段、grant、script text、object key、secret 都不进入 Manifest。每次输出可定位 node/cue/locale/path/asset。

```text
readinessRevision = chapter-one-readiness.2
sourceRevision = 0feb9264ff035a1139cde70e9b1a4611608883d4832f06be87c4a5327f279fc0
Manifest digest（仍是 Phase 3C） = sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f
proofDigest = d2f3e1a75683c2ccb8f83460aa4a81aacf69a165d7053610785dd821ac7e5cd2
```

同输入多次运行、speech SELECT 行顺序反转：TTS binding、speech proofs、分类、digest 相同。随机 grant 与实时 expiry 属于独立个性化运行状态，不参与编译确定性。

本阶段用既有 SELECT-only Reader 和补充 Reader 再读真实第一章：sourceEqual=true、evidenceEqual=true、8 v23 nodes、44 speech，确认使用的 Phase 3B/3C 样本仍与当前数据库一致。没有上传、签名、重生成或更新资源。

## 9. 测试及生产保护

```bash
npm run typecheck -- --incremental false --pretty false
node --no-warnings --experimental-strip-types --test tests/smart-textbook-final-readiness.test.mjs tests/smart-textbook-readiness.test.mjs tests/smart-textbook-legacy-adapter.test.mjs tests/smart-textbook-runtime-v1.test.mjs tests/smart-textbook-sidebar.test.mjs tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs
git diff --check
```

| 项目 | 结果 |
| --- | --- |
| Phase 3A | 85/85 |
| Phase 3B | 50/50 |
| Phase 3C | 55/55 |
| Phase 3D | 53/53 |
| legacy regression | 83/83 |
| 合计 | **326 passed / 0 failed / 0 skipped** |
| TypeScript | 通过 |
| git diff --check | 通过 |

负例覆盖错 session/snapshot/source/teaching revision/target/hash/generation/Step/cue/locale、过期、撤销、未签发 onend、客户端 score/completion 注入；并发消费和签发/消费授权等待中的撤销都测试。speech 包含错 hash/preset、漏 cue、重复证明、假 stale、非法 fallback、当前 unresolved 阻断。

原 import 边界回归继续确认：无生产文件 import Adapter。所有新增实现 server-only；无 React UI、学生路由、Preview、Registry renderer、Agent 自动推进、DB mutation、migration、判题/录音改变或 legacy 删除。工作区原有其他业务改动不属于本阶段产物，未覆盖或清理。

## 10. 停止与剩余前置条件

**TTS 原 blocker 已按诚实 observation 语义解决；语音 blocker 未解决。** 不能将 loader 可能选中的不匹配资产宣布为 stale，也不能在禁止修改生产行为的本阶段悄悄改为 preset-first 或更换 speech。

需要另行获得范围明确的决策后，才能处理当前 loader/恢复选择不一致及终点历史会话未确认问题。本阶段不提出自动修复、不修改原数据，不开始 Renderer。`remainingNonUiUnsupported=1`，`nonUiRuntimeReady=false`，`runtimeReady=false`。

**Phase 3D 到此停止，不自动进入 Phase 4。**
