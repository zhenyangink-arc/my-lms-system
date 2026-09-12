# Phase 4A-12：第一章 Learning Runtime integration 收口

日期：2026-09-10。范围：第一章冻结真实内容、隔离学习/录音执行、Target owner、opaque session、严格 Learning Runtime。不是 Teacher 收口，不是生产部署验收。

## 1. 结论

```ini
remainingNonUiUnsupported = 0
nonUiRuntimeReady = true
learningReady = true
compat.learning.v1 = implemented
compat.teacher.v1 = unsupported
runtimeReady = false

production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
```

`core/learning-readiness.ts → learningCapabilityReadiness()` 已用实际测试证据重新计算，learning blockers 为 `[]`。`core/block-registry.ts → runtimeReadiness()` 的唯一必需 capability 错误是 `Unsupported capability block.compat.teacher.v1`。

这不代表 Recording v2 已在生产部署或可绕过部署前置条件：productionMigrationReady / productionCallerCutoverReady 的前阶段阻断未在本轮处理。所有正式事务验证仅发生在 disposable PostgreSQL 和隔离对象 transport。

持久化证据：

- [359 个 target 最终覆盖](SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A12_TARGET_COVERAGE.json)：逐地址、owner 状态、缺失命令、见证状态。
- [readiness 输入与计算结果](SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A12_READINESS.json)：Manifest/proof digest、严格 Chromium/SQL 联合见证、11 类检查、19 Activity 证据及最终计算。
- 4A11 语义分类 JSON 保持为当时的历史审计，不覆盖其 91/206 历史结论。

## 2. Target Contract 与内容没有重新设计

4A11 的 359 个 identity、capabilities、acceptedEvents、frozen mappings 均保留。本轮没有修改 Manifest Schema 或重新生成教材内容。

| 指标 | 4A11 | 4A12 |
| --- | ---: | ---: |
| Total learning targets | 359 | 359 |
| identity-only | 163 | 163 |
| executable-required | 13 | 13 |
| executable-conditional | 183 | 183 |
| requiredUnsupported | 91 | 0 |
| danglingCommands | 206 | 0 |
| duplicateOwners | 0 | 0 |
| invalidTargets | 0 | 0 |
| unknown observations | 0 | 0 |

最终执行覆盖分为 143 个初始 mounted-owner、53 个合法状态 owner 见证、163 个 commandless identity。它们与语义分类不是同一维度；没有把条件控件改成 identity-only。

旧/新 Manifest digest 相同：

```text
sha256:19bb72f491ae7f460d83867b09562e079e8bf1dfb3ee62b3de04775f88471f2e
snapshot-774d8fd07f5e3f6c1c1fe5f0bd6a15f2
proofDigest = 29582af1715166016c04d42d6d3368dae79e7300e1394c2ce778c658f9d6b81b
```

`finalizeChapterOneNonUiReadiness()`、Manifest Validator、Private Binding Validator 和 4A11 frozen/digest 回归继续通过。8 Step、19 Activity、orientation 三题、published v23 legacy 保持不变，无 teacherVideo。

## 3. 原 91 个 target 的控件族实现

下列路径省略共同前缀 `src/features/smart-textbook-runtime/`。

| 族 | 数量 | 真实 owner / 行为 | 最终 |
| --- | ---: | --- | --- |
| panel | 24 | `LearningPanelOwner` 包裹实际内容/练习容器；`NativeLearningPanel` 包裹真实三道原生题 | 完整命令见证 |
| orientation dialogue/task | 14 | `Card` 的实际句子容器 + 受控 utterance 播放 owner；活跃 Agent task 仍由既有授权 TTS owner 独占 | 完整命令见证 |
| repeatTracks.lines | 14 | `GuidedRepeatExecutor` 的真实 line 控件，`playTarget()` 使用现有 Browser TTS，不保存 practice/completion | 完整命令见证 |
| activity page | 8 | `ActivityPageExecutor` 的当前真实页；两条 listening page 额外使用已有授权媒体 owner | 完整命令见证 |
| activity page item | 26 | 当前题目 fieldset 的稳定 part owner；非播放题不冒充媒体 | 完整命令见证 |
| review return | 4 | `LearningNavigation → learningTools.open → openLearningDestination()`，实际 Step 切换 | 完整 open 见证 |
| chapter-test | 1 | 同一导航服务，检查 17 required activities、8 个已完成 node/Step、旧章节完成门禁及 private destination | 完整 open 见证 |

`src/lib/smart-textbook-legacy-adapter/panel-projection.server.ts` 用已有闭合 `legacyPageKey` 映射内容 section、活动族和导航。未以 title、数组位置、CSS selector 或“DOM 存在”推导 capability。输出是运行服务的内容 DTO，不改变公开 Manifest。

`RuntimeTargetRegistry.prepare()` 注册的是状态激活过程，不是成功 owner。命令先检查声明权限、当前 Step，再至多经过三层受控准备，让实际 activity/page mount；最终仍必须找到真实 handle。没有隐藏 DOM、无通用假 play/open、无 capability wildcard。

浏览器专门测试了：grammar 的未激活第三组第二页 item，从无 mounted handle 开始，由 reveal 激活真实 group/page，再 focus 到该 item。空准备回调仍返回 unavailable。身份 target 的五类命令仍拒绝。

`open` 的真实导航 owner 返回受控内部结果 `navigated`，使主动 Step 切换不被误判为失败的 stale response；其它异步结果继续检查 generation。测试中的 DOM 查询仅用于观察实际聚焦/可见性，不作为 Runtime identity 或分发逻辑。

## 4. 浏览器 TTS 与现行媒体语义

`server/content-playback.server.ts` 增加闭合 dialogueGroups line 解析。普通学习点读只产生播放行为；如果同一 target 已挂活跃 Teacher task owner，`Card` 不再竞争注册普通点读 owner。

Teacher task 继续沿用 Phase 3D 授权 grant/onend observation；未修改 grant、教学推进或评分语义。4A2 mounted grant 和 3D replay/expiry/generation 测试继续通过。

跟读 imperative `play` 与学生按钮的“播放后记录练习”分开：前者只播放，不调用 mark；后者仍调用旧语义的 practice marker。14 segment、两轨、full recall 与独立口语完成的隔离由原测试继续验证。

Pattern frozen pending 资源没有伪造 ready；4A11 的独立 ready bytes → 实际 Chromium Audio 成功/失败转现有 TTS、Blob revoke、abort、Step dispose 测试继续通过。未修改 Phase 3E speech selector。

## 5. 同一次 mounted Recording → SQL → Reader → UI

证据入口：`tests/smart-textbook-runtime-4a7-rehearsal.test.mjs` 的 **4A12 mounted Chromium recording** 子测试，调用 `tests/fixtures/mounted-recording-4a12.mjs`。

```text
mounted Runtime Recording UI
  → 实际 Chromium MediaRecorder / 非空 WebM Blob
  → withLearningSession（opaque session + 稳定引用）
  → createLearningBoundary
  → productionRecordingServices
  → 既有统一 Recording Domain Gateway
  → isolated R2 PUT/HEAD/GET transport
  → 真实 disposable PostgreSQL v2 RPC
  → fresh SELECT attempts / node_progress + scoped recording restore
  → createLearningHistoryReader
  → LearningStateProvider.refresh
  → 同一个 mounted Runtime 的 ServerLearningState / UI
```

使用专属合成 learner；没有读取普通学生记录，没有连接生产 R2。MediaRecorder 使用 Chromium 测试音源，计时时钟显式加速；不是空 Blob、空函数或 mock RPC。

### Speaking

- 真实 outline + 至少 4 criteria，录制、上传、提交。
- 上传后 SQL attempts 为 0。
- v2 atomic consume 后，同一 provider 出现一条服务器 attempt，`correct=null`、`score=null`。
- 其它必需活动未完成，Reader 的 completedStepIds 仍为空；没有把 speaking 完成等同整个 Step。

### Roleplay

- 同一 mounted 页面切换 dialogue，选择左侧角色，播放对方台词，逐个录制全部四个 required student turns。
- 每次 turn upload 后 attempt 数仍为 1（仅前一 speaking attempt）。
- v2 roleplay atomic completion 后 Reader/provider 共 2 条 attempt。
- duplicate completion 返回 already-completed，仍只有 2 条正式 attempt；UI 恢复既有完成结果。
- 实际 page reload 后，通过 opaque session continuation 重载 speaking/roleplay recordings 和正式完成状态。

SQL harness 继续验证：并发、锁、rollback、consume/delete/re-record race、proof、disabled key、legacy Storage、full recall 不产生 speaking attempt。不是把两个独立测试相加当作联合验收。

旧 Step 的读取可能在服务器 generation 切换后被拒绝。联合测试只接受**可证明 requestGeneration 小于服务器 currentGeneration 的取消读取**；上传/完成错误没有豁免。

## 6. 统一 RuntimeLearningSession browser boundary

新增/扩展：

- `core/learning-session-transport.ts → withLearningSession()`：所有 learning browser ports 的唯一 envelope。
- `core/learning-session-http.ts → learningSessionHttp()`：JSON/FormData 请求、授权 Blob 返回。
- `server/learning-boundary.server.ts → catalog/resume/enter/dispatch`：严格输入解析、每次 reauthorize、capsule/activity 私有解析、Step/generation/capability 校验。
- `server/audit-learning-boundary.server.ts`：server-only owner preview 服务组合，调用既有 grader、flow、repeat、recording、媒体和导航服务。
- `src/app/api/smart-textbook-runtime-audit/learning/route.ts`：owner guard、same-origin、防跨站、11 MiB 流式限额、JSON 64 KiB、严格 multipart 字段和无缓存响应。
- `server/production-learning.server.ts` 补原生选择题 submit 端口；生产工厂仍没有安装到学生路由。

每次实际 browser dispatch：

```text
sessionRef + generation + stable target + closed operation payload
```

活动使用不透明 `activity-ref-*` 服务引用，由服务器 catalog 与已有 public runtime ref 对接。capsule、数据库 activity UUID、tenant/student/version/source/snapshot/private binding 均由服务器解析，不出现在新的学习请求中。

统一范围：native submit、grouped submit、page check/reveal/finish、pattern check/finish/audio、listening audio/transcript、repeat load/mark、recording load/upload/audio/delete/restore、speaking/roleplay completion、history refresh、review return/chapter-test。

已有纯内部旧 transport 测试 helper 保留用于 regression。真正 `AuditRuntimeClient` 不再安装那些 direct learning transports；只保留本轮不处理的既有 Teacher service 定义。旁路页面学习展示现在使用同一个严格 `LessonRuntime validationMode="learning"`；complete 模式仍显示 Teacher 阻断，不再把 inspection 当学习放行。

### 生命周期与 continuation

Step enter 是串行的服务器 generation 变更。客户端保留已发送 enter 的有界确认，即使来源 Step 已 dispose，也记录服务器的新 generation，然后拒绝来源旧读；避免客户端因取消确认而重用已失效 generation。所有领域读/上传继续接受 AbortSignal；迟到结果不得写入新 Step。

`resume()` 重新验证 session，返回 generation 和 stable activeStepId；浏览器把这个 Step 交给同一 LessonRuntime/StepController，不从客户端重新声明 source/version。未知 session、过期、跨用户/tenant、revision、跨 Step/activity、注入 score/identity 等仍由现有 strict boundary 与领域服务拒绝。

## 7. 严格整章 Chromium 与重载

`tests/smart-textbook-runtime-4a12-browser.test.mjs` 使用真实 `LessonRuntime validationMode="learning"`，不是 RuntimeBlockInspection，也没有替换 Registry/假 renderer。Teacher 是此模式唯一忽略的 capability。

同一个 opaque session 下执行下列全章流程，并验证 19 个不同活动引用全部进入相应提交操作：

| Step | 真实 Activity | 严格执行及恢复 |
| --- | --- | --- |
| orientation | orientation-check、orientation-jimin-occupation、orientation-wangming-occupation | 三题提交、反馈、reload 三个选择 |
| vocabulary | vocabulary-check | 全部题目输入、原 grader、恢复 |
| grammar | grammar-choice、grammar-judgment、grammar-fill | 六页检查/订正/聚合，刷新恢复第二页 |
| patterns | pattern-choice、pattern-order、pattern-compose | 对话轮次、排序、组合、整组提交、恢复进度 |
| dialogue | dialogue-fact-check、dialogue-response、dialogue-roleplay | 两题 + 完整角色录音证据/预览完成、reload |
| listen_speak | listening-identity、speaking-introduction | 两页真实 Audio bytes、母稿门禁、repeat marker、口语录音/提交/恢复 |
| read_write | reading-profile、write-profile | 阅读作答、写作原 open grader、文本恢复 |
| review | review-multiple、self-check | 多选、自检、返回选择、reload |

整章严格测试的 persistence 是隔离 preview，因此 completion 返回 `formalCompletion=false / progressDelta=null / score=null`；ServerLearningState attempts/completedSteps 始终为空。正式完成的正向 Reader/UI 证据来自上一节同 mounted 的真实 SQL 场景；两类证据没有混写。

重载验证：Step、原生选项/反馈、词汇、grammar page、pattern 状态、repeat marker、录音/roleplay/speaking、写作和 review。权威已完成历史状态的整章恢复另由 4A10 Reader + Chromium synthetic persisted fixture 覆盖。

## 8. 本轮整合发现并修复的恢复问题

1. 原生题原 auditSubmit 只返回反馈，未进入已有 TTL practice store。新 boundary 的 native port 调用 `auditLearningFlow.submitNative()`：验证 native Block、私有活动/version、稳定 option，再调用**原 grader**；保存 preview response/feedback。不是新增判题或正式 attempt。
2. `MultipleChoiceBlock` 对 trackingDisabled 场景从既有 learning restore 读取 preview-only UI 反馈，仍与正式 ServerLearningState 分开。跨活动/选项、非 preview 伪反馈和迟到响应不被接受。
3. Native panel 的异步包裹会重新挂载题目，丢弃临时输入。现在先完成实际 panel 定位再 mount 题目，避免 reparent；没有复制三套题目或隐藏 DOM。

## 9. Readiness 与剩余项

`learningCapabilityReadiness()` 的输入必须包含全部 19 个 Manifest Activity（不能传空列表规避）、完整 target 审计，以及 pattern/audio、native restore、mounted recording SQL、分页历史、session binding、整章恢复、服务器权威、生命周期、统一 boundary、strict mount/reload 共 11 项证据。

缺失、重复、旧 snapshot 的证据会保持 false。保存的审计不是客户端授权凭据，也不启用 production feature gate。

最终 executable capabilities：

```text
layout.v1
navigation.linear.v1
progress.server.v1
block.text
block.multiple_choice
block.compat.learning.v1
```

剩余 Runtime capability blocker：**block.compat.teacher.v1**。未实现其它不被第一章要求的 Native Block 不会被批量标记 implemented。

独立限制仍保留：

- owner browser E2E = 未完成；没有可连接的正常授权 owner 浏览器。Chromium 是明确隔离测试，不是冒用账号。
- production Recording v2 migration/gate/caller cutover 未执行，前置上线审批状态不因本轮变化。
- Teacher timeline/Agent 执行收口不在本轮，没有因此宣布完整 runtimeReady。

## 10. 文件范围与生产保护

主要新增：`panel-projection.server.ts`；Runtime 的 `learning-panel.tsx`、`learning-session-transport.ts`、`learning-session-http.ts`、`audit-learning-boundary.server.ts`；旁路 `/api/smart-textbook-runtime-audit/learning`；4A12 unit/strict-browser tests、两个隔离 session/recording fixtures；本报告和两个 JSON 证据。

最小更新：内容 DTO/panel projection；ActivityPage/ActivityExecutor/GuidedRepeat/Card/NativeChoice；target prepare/dispatch；audit client；native Flow restore；boundary native/resume；production native service port；capability/readiness。历史测试中“尚不支持某命令”的断言按本轮真实实现升级，继续保留非法命令的拒绝测试。

没有修改正式学生页面/课程路由、旧 Shell/ContentRenderer、生产录音 Route、SQL migration、3E selector、Teacher 状态机/事件 Route或教学脚本。本工作区已有前阶段/用户的大量修改不属于本轮，没有回滚或覆盖。

使用 ui-ux-pro-max / ui-styling 技能约束真实容器、可访问聚焦和生命周期；未重设计 UI，标题提示继续复用 CardTitleWithHint。

## 11. 测试与自我验证

```sh
node --no-warnings --experimental-strip-types --test --test-reporter=spec \
  tests/smart-textbook-runtime-v1.test.mjs tests/smart-textbook-legacy-adapter.test.mjs \
  tests/smart-textbook-readiness.test.mjs tests/smart-textbook-final-readiness.test.mjs \
  tests/smart-textbook-speech-selection.test.mjs tests/smart-textbook-sidebar.test.mjs \
  tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs \
  tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs \
  tests/smart-textbook-runtime-4a*.test.mjs
npm run typecheck -- --incremental false --pretty false
git diff --check
```

最终整套 **785/785 passed，0 failed / skipped / cancelled**。TypeScript（关闭增量、完整检查）与 `git diff --check` 均通过。完整日志：`/tmp/uply4a12-verified.log`；类型检查：`/tmp/uply4a12-tsc-verified.log`。临时日志不是报告唯一证据，上述两个 JSON 与可重跑测试保留在仓库。

其中 4A12 unit/安全/证据自查 8 项；严格整章 Chromium 5 项（含父测试）；target/ready-Audio Chromium 8 项；4A7 SQL rehearsal 18 项，包含同 mounted Recording → SQL → Reader → UI 子测试。各项已包含在 785 总数中，不重复相加。覆盖 3A–3E、4A–4A11、本轮、legacy 和隔离 SQL；4A6 是只读文档阶段，不虚构同名可执行测试。

自查清单：Manifest/private binding/digest 未变；8 Step/19 Activity/三题/v23 不变；无 capability 清空；359 个 target 全覆盖；preview 与 formal state 分离；录音 SQL 真正联合；请求无私有身份/对象/proof；SQL 仅隔离重建；生产 import 未接入；Teacher 未收口；没有进入 Phase 4B。
