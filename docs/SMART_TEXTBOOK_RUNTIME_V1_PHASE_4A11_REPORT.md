# Phase 4A-11：Target Contract 修正与 Learning 执行链继续验收

日期：2026-09-10。本报告取代上一版“等待 Schema 授权”的结论。用户已授权 empty capabilities；本轮已实现契约/生成器修正，并继续执行 Pattern ready Audio、Recording SQL/Reader 集成和统一服务边界工作。**学习链尚未完全收口，不能提升 compat.learning.v1，不能声称只剩 Teacher。**

```ini
contractPrerequisite = resolved
remainingNonUiUnsupported = 0
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
```

范围：仓库冻结的第一章真实来源、现有代码及隔离测试。没有重新查询生产数据库/学生记录。新 Manifest 是离线编译产物，不是生产 published pointer。

## 1. Schema 修改前后及理由

`src/lib/smart-textbook-runtime-v1/contracts.ts → runtimeTargetSchema.capabilities`：

- 之前：同一闭合枚举数组必须至少 1 项。
- 现在：去掉 `.min(1)`，允许 `[]`；未扩充命令枚举、未改 target address/Step/Block/part/frozen identity。
- 空数组只表示稳定身份，不授予 imperative command；不是 wildcard。
- `validator.ts` 同步要求 identity-only 的 `acceptedEvents=[]`、`verification=ui-only`，不能凭空接收正式完成事件。
- 有命令的 learning targets 保留 opened/UI-only 原有事件语义。教学 TTS observation 仍是独立私有授权证据，不改为分数或 progress。

原问题不只是 Schema：Adapter 对所有内容身份无条件写 reveal/focus/highlight/open，将“可寻址”错误等同于“必须有四个执行命令”。本轮修复生成语义，不使用假 owner，不批量清空全部 target。

## 2. 显式 capability projection

新增 `src/lib/smart-textbook-legacy-adapter/target-semantics.server.ts`：

`learningTargetSemantics()` 从闭合 legacy 字段族、capsule panels、冻结 identities、progress membership、实际 alias 引用生成语义；`projectLearningTargetCapabilities()` 写入声明。不是标题匹配或 DOM 存在性推断。legacy JSON path 中的索引仅查找既有冻结映射，不生成新 identity。

| 来源 / 用途 | 分类 / 命令 | 依据及 owner 要求 |
| --- | --- | --- |
| 8 个学习 Block/activity 根 | required；reveal/focus/highlight | 旧 activity aliases、prepareLearningTarget；当前 Step/活动 owner |
| 24 个 panel | conditional；reveal/focus/highlight | profile.pages、旧 module:page 定位；必须能进入合法 panel |
| orientation dialogue task/line | conditional；定位 + play | 旧 ContentRenderer TTS、audio_completed alias；授权 mounted TTS owner |
| targets、vocabulary、grammar/pattern examples、替换项、quickResponse 等 | conditional；定位 + play | 旧 Shell 对应 speakKorean 控件；精确冻结韩语文本 |
| scene / role turn / track / card 选择 | conditional；定位 | 旧 DialogueRoleplayPractice、选择卡和录音控件 |
| repeat segment | conditional；定位 + play | 冻结两轨/14句、旧 ListenSpeakLearningPanel；marker 不等于完成 |
| speakingFrame / repeatTracks slot | conditional；定位 | recording-binding / repeat executor；没有擅加 recording play |
| 历史 activity page/item | conditional；定位；听力 page 加 play | Phase 3C 私有映射、实际页/题目定位及媒体 owner |
| 4 个 review return / 1 个 chapter-test | required；定位 + open | learningTools/openLearningDestination；保留服务器完成门禁 |
| 描述性 container/rule/word/coverage/rubric 等 | identity-only；[] | 闭合 DTO 中静态描述；父交互/子控件承担行为，子控件命令保留 |
| 非 review 的 nextNode metadata slot | identity-only；[] | 线性导航由 Step.nextStep/StepController 负责 |
| 未识别字段族 | unreachable-invalid，保持阻断 | 不默认转成 identity-only；Private Binding 校验失败 |

更正上一版报告中的候选判断：`content.targets[]` **不是**纯描述身份。旧 Shell 有 speakKorean 真实播放，本轮保留 play。

旧行为主证据：`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx → ContentRenderer / ListenSpeakLearningPanel / DialogueRoleplayPractice`；`src/lib/smart-textbook-learning-targets.ts`。本轮未修改旧 Shell。

## 3. 359 Target 逐项结果

完整清单：[SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A11_TARGET_SEMANTICS.json](SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A11_TARGET_SEMANTICS.json)。每项包含 address、sourceFamily、sourcePath、classification、capabilities、evidence、requiredOwnerState，并附本轮 Chromium coverage。没有改写 4A10 原始审计文件。

| 语义分类 | 数量 |
| --- | ---: |
| total / 唯一 address | 359 / 359 |
| identity-only | 163 |
| executable-required | 13 |
| executable-conditional | 183 |
| unreachable-invalid | 0 |

163 个 commandless targets 仍留在 Manifest；196 个目标仍有命令。条件目标不是免验收：必须证明合法状态下能 mount 并执行完整声明。

`auditLearningTargets()` 本轮完整隔离 Chromium sweep：

| 执行覆盖 | 数量 |
| --- | ---: |
| mounted-owner（完整命令见证） | 92 |
| mount-on-reveal（合法条件状态完整见证） | 13 |
| commandless-identity | 163 |
| requiredUnsupported（包括尚未证明的 conditional） | **91** |
| danglingCommands | **206** |
| duplicateOwners | 0 |
| invalid target / unknown observation | 0 / 0 |

91 中有 5 个 required、86 个 conditional。表示**尚缺完整执行见证**，不能一律理解为服务完全不存在，也不能降级为 warning：

| 未完整验收的族 | targets |
| --- | ---: |
| panel | 24 |
| orientation-dialogue-task | 14 |
| repeatTracks.lines | 14 |
| review-return | 4 |
| chapter-test | 1 |
| activity-page | 8 |
| activity-page-item | 26 |

review/open 有实际服务器服务，但本轮 sweep 没有取得全部 open 的合法完成态见证。听力/repeat/TTS 也不能因另一孤立组件测试通过就补全本次 target 见证。保留命令，保留阻断。

## 4. Target Contract 消费者检查

| 层 | 本轮处理 |
| --- | --- |
| runtimeTargetSchema / Manifest validator | 允许 []；identity-only 不能声明事件/服务端证据 |
| Adapter.addTarget / readiness.addPart | 不再每个 part 无条件四命令；私有关系完成后统一 projection |
| Private Bindings | 重推闭合语义，精确比较 capabilities；清空真实命令或给 passive 加 play 均拒绝 |
| Block Registry contract | compat.learning 仅允许显式声明的 part play；实际 owner 仍独立验收 |
| RuntimeTargetRegistry | 先查声明再 dispatch；learning/TTS owner 不能绕过或竞争同一播放地址；空目标五种命令均拒绝 |
| Runtime Target component | identity-only 不注册 imperative handle，不加命令 tabIndex/data-runtime-target；内容仍显示 |
| coverage auditor | 空目标不需 owner；条件目标需合法见证；补充 partId 一致性检查 |
| Manifest Loader / strict Runtime | 完整 validate；[] 不变成默认权限；compat.learning unsupported 不豁免 |
| acceptedEvents / private TTS grants | 空目标不接受事件；3D formalCompletion=false/progressDelta=null 保持 |

测试覆盖 command、mount、mountLearningOwner 的拒绝，以及未知语义 family 不得静默清空。没有用 every-part-play/open 替换原四命令问题。

同时取消通用 elementTargetHandle 将 scroll/reveal 伪装成 open 的兜底：open 和 play 必须由实际导航/媒体 owner 提供。否则返回 TARGET_UNAVAILABLE，不以空操作冒充命令执行成功。

## 5. 离线重编译与摘要

冻结 source → Adapter → readiness → finalizeChapterOneNonUiReadiness → Manifest validator → validatePrivateBindings → 3A–3E 回归，均通过。

| 对象 | 旧 | 新 |
| --- | --- | --- |
| Manifest contentDigest | sha256:423bc16d7056e2060198cd4873aa34fabdea45d2d7b48581168da8f6084f476f | sha256:19bb72f491ae7f460d83867b09562e079e8bf1dfb3ee62b3de04775f88471f2e |
| snapshot identity | snapshot-32603dd11ecc8762ccee25187a39ac0e | snapshot-774d8fd07f5e3f6c1c1fe5f0bd6a15f2 |
| finalizer proofDigest | 2e6d6c871116a1be3e800ddfead33b1cc85d1400af083281f82bad880813c594 | 29582af1715166016c04d42d6d3368dae79e7300e1394c2ce778c658f9d6b81b |

`tests/fixtures/runtime-target-contract-history.mjs` 仅在内存恢复旧 learning target capabilities/events，必须重新得到旧 contentDigest：证明其它 Manifest 内容和 stable IDs 无暗改。新 snapshot 绑定新语义 digest，不能复用旧不可变快照身份。

proofDigest 变化只来自私有 TTS binding 引用新 snapshot；仅归一该 snapshot 后严格复现旧 proofDigest。speech selection/授权语义未变。旧测试保留精确 digest 断言，不是删断言。冻结 source/身份映射/v23/3E proof 样本未改写。8 Step、19 Activity、orientation 三题均通过。

## 6. 实际内容播放 owner

新增 `src/features/smart-textbook-runtime/server/content-playback.server.ts → contentUtterances()`：

- 从闭合 capsule 和冻结 child part 提取精确 Korean utterance。
- 复用既有 learningTools browser-tts owner，不发明 R2、URL 或 mediaRef。
- `src/lib/smart-textbook-legacy-adapter/runtime-content.server.ts` 为原来扁平化的真实可播放子项投影对应 child card，不注册所有描述性身份。
- orientation 教学等待仍走授权 TTS owner；repeat marker 不被通用文本播放替代。
- `server/learning-tools.server.ts` 保留 grammar/listening，再附明确有旧播放行为的文本控件。

下文 server/ 均指 `src/features/smart-textbook-runtime/server/`。UI skills 只影响可访问定位、焦点权限和媒体 cleanup，没有重设计教材界面、生成装饰标签或修改旧课堂。

## 7. Pattern ready Audio Chromium

新增 4A11 场景在 `tests/smart-textbook-runtime-4a10-browser.test.mjs`，复用同一 renderer：

- 独立 synthetic-ready binding 返回实际 WAV bytes，**没有修改第一章真实 pending media**。
- Chromium 实际 HTMLMediaElement 播放成功。
- 显式模拟 Audio.play 拒绝 → 已有 Browser TTS fallback。
- Step 切换/unmount 停止、revoke Blob URL。
- delayed bytes 在 generation 取消后不能创建新 Blob 或回写新 Step。
- 原 pending→TTS 回归继续通过。

不是空函数假播放；不是生产 ready 媒体验收。turn 状态 cleanup 保留，没有另宣称新增所有 turn 切换组合的独立验收。

## 8. Recording 联合完成：服务链通过，mounted 全链仍 partial

新增 `tests/smart-textbook-runtime-4a7-rehearsal.test.mjs` 中明确命名的 4A11 service integration：

```text
productionRecordingServices（可信隔离 authority）
→ unified Recording Domain Gateway
→ 隔离 R2 HEAD adapter + real PostgreSQL evidence/proof/v2 RPC
→ speaking / roleplay atomic completion
→ 实际持久化 rows 的 SELECT
→ createLearningHistoryReader
→ ServerLearningState DTO / recording restore
```

结果：

- 上传有 evidence，无 attempt；speaking ≥4 criteria 后原 v2 consume 成功，correct/score=null。
- roleplay required turns evidence 完整，atomic completion；重复完成 already-completed，不增加 attempt。
- 两类正式活动合计 2 个 attempt，Reader 从实际 SQL 结果恢复活动完成。
- 口语完成不把尚缺其它必需活动的 Step 直接完成。
- 新隔离 learner 在最初 coordinated cohort 中声明，不绕过 gate/fence。
- fresh learner 的 page/repeat 无历史，transport 明确返回空集合；不虚构 recording harness 没有的无关表。
- isolated transport 仅白名单支持 Gateway 实际使用的 metadata JSON null filter。

**新增场景不是从同一次 mounted Chromium UI 发起。** 4A8 的 MediaRecorder/preview browser 与此 SQL 链分别通过，不能相加冒充联合验收。recording→SQL→Reader 已证明，mounted recording→SQL→UI refresh 仍 blocking。

## 9. Unified RuntimeLearningSession boundary

新增：

- `server/learning-boundary.server.ts → createLearningBoundary()`
- `server/production-learning-boundary.server.ts → createProductionLearningBoundary()`

闭合输入：opaque learning session + stable target/service ref + 有界 generation + discriminated request。拒绝额外 tenant/student/version/source/snapshot/原始 activity DB UUID 字段。activity service token 由服务器按既有 identity 确定生成，不改 Manifest target/活动身份；response 按原 grader schema。

同一 server boundary 覆盖 content/activity、page/check/reveal/finish/audio/transcript、pattern、repeat、tools/open、history/restore、recording/upload/read/delete/completion。concrete resolver 每次重验正常登录 owner/scope/source/snapshot **及 contentDigest**。Step generation 变更 abort 旧请求，completed-prefix 取正式 Reader，进入 Step 不等于完成。

production composition 真正组合 productionLearningPorts、productionRecordingServices、recordingPlans 和 Gateway；非假 adapter。没有生产 Route，gate 未开。4A11 session 测试使用真实 resolver + 合成授权/DB transport + ports spies 验证路由/拒绝，**不是生产端到端证明**。

**所有现有 Runtime browser transports 尚未全部安装到新 boundary。** Native activity 接线、页面 transports 同一 session E2E 仍需完成。因此统一客户端边界仍 partial，不能因新增 facade 就宣称端到端完成。

## 10. Strict LessonRuntime 正向结果

`LessonRuntime validationMode="learning"` 的**拒绝路径**实际 Chromium 回归通过：只允许忽略 Teacher，不忽略 compat.learning，当前 learning unsupported 仍拒绝激活。

**严格 learning 正向 mount/reload 未通过。** 诊断模式的全章 sweep/内容/恢复不等同 strict 正向。没有切换 inspection 来绕门禁，没有提升 Registry。

## 11. 剩余 blockers

1. 91 个真实命令 target 缺完整合法状态见证；206 个 command 缺见证。必须逐控件实现/验证，不能清空。
2. 同一次 mounted Runtime speaking/roleplay→真实隔离 SQL→history→UI 更新联合场景未完成。
3. unified session 服务端组合已实现；全部 React service transports 安装及整体 E2E 未完成。
4. 因上述项，strict learning 正向 mount、交互、reload 不能通过。

这些是 Renderer/service integration 门禁，独立于 3E 的 Non-UI source/binding readiness。Teacher 未进入本轮。

## 12. 本轮变更范围

- 新增 `src/lib/smart-textbook-legacy-adapter/target-semantics.server.ts`。
- 契约：`src/lib/smart-textbook-runtime-v1/{contracts,validator,registry}.ts`。
- 编译/投影：`src/lib/smart-textbook-legacy-adapter/{adapter.server,readiness.server,bindings.server,runtime-content.server}.ts`。
- Runtime：`src/features/smart-textbook-runtime/core/{target-registry,target-coverage}.ts`、`components/target.tsx`。
- 服务：新增 `server/{content-playback,learning-boundary,production-learning-boundary}.server.ts`；更新 `server/{learning-tools,learning-session}.server.ts`。
- 4A11 target/session tests、4A10 Chromium ready 场景、4A7 SQL rehearsal/transport/entry、历史 digest helper；旧 digest/target 断言按精确新语义更新。
- 本报告及 359-row 语义/执行证据 JSON。

工作区前阶段/用户的其它修改（包括旧学生文件及 migrations）不属于本轮，未回滚覆盖。本轮没改学生生产 Route、旧 Shell、3E selector、教学内容、录音生产 caller 或 migration。

## 13. 测试与自查

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

最终完整测试 **770/770 passed，0 failed / skipped / cancelled**；TypeScript 通过，git diff --check 通过。覆盖 3A–3E、4A–4A10、本轮、legacy、isolated PostgreSQL/并发/rollback 与 Chromium。4A6 是只读 preflight 文档，不虚构同名测试；4A5/4A7 migrations 仅由原隔离 harness 重建验证。完整日志在本机临时文件 /tmp/uply-4a11-complete.log；报告及 JSON 保留持久化结果，不依赖临时文件阅读。

artifact 测试逐项比较当前 semantic rows/snapshot/digest/proofDigest，并验证 coverage 数量一致。通过包括**应当拒绝的负例和保留 unsupported 的审计**，不是所有学习能力 ready。

自查：

- 8 Step / 19 Activity / orientation 三题 / stable target IDs / v23 未变。
- 空 target 五命令拒绝，无 wildcard/TTS owner bypass。
- Manifest 无新增 secret/object key/proof；private service DTO 不进公开 Manifest。
- 3D observation / 3E selector 回归不退。
- 旧 grader、recording transaction、Agent 状态机无重写。
- production DB/真实录音无读写；隔离 SQL 测试不等于 production migration。
- owner browser E2E = 未完成；无 cookie 复制、magic link 或 impersonation。
- 没有切路由、启用 gate、Teacher 收口或进入 Phase 4B。

## 14. 最终状态

```ini
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
```

本轮不是仅修改 Schema 后再次等授权：契约/语义编译/安全拒绝/ready Audio 浏览器分支/Recording SQL-Reader 服务链/统一服务端组合均已落地。**Phase 4A-11 最终 learning 放行条件尚未达到，没有将 partial 冒充 implemented。**
