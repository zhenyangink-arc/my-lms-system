# Phase 4A-13：Teacher 执行链核验、会话边界与剩余阻断

日期：2026-09-10。**本轮没有完成 compat.teacher.v1 的最终收口。以下是部分实现报告，不是完整 Runtime 验收通过报告。**

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

不能把服务端 resolver 全节点通过，等同于 mounted Teacher、timeline 和 complete Runtime 通过。剩余项主要是尚未完成的实现/联合验收工作，不是已经证明不可实现，也不是授权不足。没有修改 Registry 来绕过这些项。

## 1. 本轮文件与架构边界

新增：

- `src/features/smart-textbook-runtime/core/teacher-readiness.ts`：`teacherCapabilityReadiness()`、`auditTeacherTargets()`，证据缺失/重复/过期版本/目标未执行/owner 冲突均阻断。
- `src/features/smart-textbook-runtime/server/teacher-inventory.server.ts`：`teacherSourceInventory()`，从真实冻结节点和 private bindings 导出节点、黑板类型与三处目标引用。
- `src/features/smart-textbook-runtime/server/teacher-session.server.ts`：`createRuntimeTeacherSessions()`、严格请求 schema、无内部标识的 `RuntimeTeacherCue`；隔离 owner-audit 会话，不是第二个 Agent resolver。
- `tests/smart-textbook-runtime-4a13.test.mjs`：12 项证据、会话和真实 resolver 测试。
- 本报告。

没有修改现有 React Teacher、学生 Shell、Agent Route、speech selector、Manifest、SQL、Recording gateway 或 Registry。

新服务边界目前是：

```text
可信 server composition / 每次 authorize()
  → RuntimeTeacherSession（opaque reference，进程内有界存储）
  → auditTeacherTurn()
  → 原 resolveScriptStep() / resolveScriptCharacter()
  → RuntimeTeacherCue（不包含 DB node / speech asset ID）

issue-tts / observe-tts
  → 原 Phase 3D Grant service / observeAuditTts()
  → 原 taskEventKey，只有下一次 resolver turn 才决定教学推进
```

**这个新边界尚未接到 audit HTTP/Server Action 与 mounted Teacher。** 原 `audit-client.tsx` 仍调用已有 audit actions；不能宣称浏览器 Teacher 已统一为新边界。新服务仅作为 server-only 旁路代码和隔离测试运行。

## 2. RuntimeTeacherSession

可信 `open()` 绑定 owner authority、snapshot、source revision、teaching revision、Step、generation、locale、当前节点/教学状态、当前 Step 的 allowed targets 和 expiry。只有实际存在一个 `compat.teacher.v1` Block 的 Step 才允许打开；非 owner、错误 Step/绑定、过期或撤销会话拒绝。

浏览器请求形状只接受 opaque `session` 与闭合 operation/intent、当前 opaque cue、问题选项回答或 grantId；不接受 user/tenant/scriptVersion/node/asset/snapshot/source/generation/score/completion。所有操作重新调用可信 authorizer。

`RuntimeTeacherCue` 不传 `speechAssetId`、buffer asset ID、DB node ID 或原 resolver state；只传 `speechAvailable`、buffer availability 和临时 `teacher-cue-*` handle。媒体 transport 只在服务器接收已经选定的 asset ID。`readSpeech` 必须由可信组合层接现有授权字节代理；**当前没有将测试 Blob transport 当成实际生产授权代理已接通的证据。**

实现限制：单进程 owner-audit、默认 30 分钟 TTL、最多 32 个 session；过期在 open 时清理。不是多实例生产 Agent session persistence。没有新增表或第二套 Agent 状态机。

串行 turn/媒体操作有 busy guard；cancel 可以中断 in-flight 操作。晚到 resolver/bytes 必须再次验证同一 row、revision 和撤销状态，不能提交到新 session。取消撤销旧 grant，旧 cue 不能在新 session 读取音频。

## 3. v23 的真实节点覆盖

来源：`tests/fixtures/smart-textbook-legacy-adapter/chapter-one-source.server.ts`，经现有 finalizer/private binding；不是对线上重新 SELECT 的声明。

8 个教师节点全部属于 **orientation 的一个教师 Block**，不是“一节点对应一个学习 Step”。原顺序和 next-node 选择由 `resolveScriptStep()` 决定。

| 顺序 | node key | 类型 | 中文讲解 segment 数 | 实际分支/效果 | 本轮证据 |
| --- | --- | --- | --- | --- | --- |
| 1 | step-8-bbfc46 | explanation | 2 | next=null，原 resolver 按 sort_order 继续 | 隔离 resolver 通过 |
| 2 | welcome | opening | 2 | → observe-scene | 隔离 resolver 通过 |
| 3 | observe-scene | instruction | 1 | 场景 visualCue | resolver 通过，mounted cue 未验收 |
| 4 | explain-order | explanation | 1 | → model-dialogue | 隔离 resolver 通过 |
| 5 | model-dialogue | example | 1 | 必需 audio_completed task | Grant/feedback 服务链通过，完整挂载未验收 |
| 6 | check-understanding | question | 1 | 引用教材活动；答错使用 model-dialogue 的补救内容 | 原 resolver + 合成私密答案 transport 通过 |
| 7 | lesson-mission | explanation | 1 | → ready-for-practice | 隔离 resolver 通过 |
| 8 | ready-for-practice | summary | 1 | terminal=true；focus_activity | terminal 服务测试通过；focus 动作尚未接通 |

测试用源教材活动/选项，私密答案 transport 是明确合成值，没有读取生产答案或普通学生记录。没有把该答案称为第一章真实答案，也没有更改原 grader。

## 4. Character

旧行为证据：`src/lib/learning-agent-script-runtime.ts → resolveScriptCharacter() → virtualCharacterForScriptSegment()`，按 segment 解析 pose、position、普通/split/narrow 坐标、scale、voice 设置。

现有 `auditTeacherTurn()` 调用原 resolver，但只投影 pose/voice；`components/teacher-character.tsx` 通过授权字节代理显示图片。**完整 position/visibility/scale 与 cue timeline 尚未由新 mounted executor 承接。** 不将显示一张图片视为 character 生命周期等价。

坐标没有进入新 Layout；本轮不修改根布局，也不把旧 `learningLayout` 用来控制 StepController。

## 5. Normal speech / buffer / fallback

Normal：原 `resolveScriptCharacter()` 对当前 node/locale/segment 的真实文本求 hash，选 ready 音频。已有 `audit-speech.server.ts → proxyAuthorizedSpeech()` 保留原 speech Route 授权、固定 R2 origin、禁止重定向与私密 URL/headers 外传。新 opaque 会话将当前服务器 selection 留在私有 row，仅返回 bytes port 的 Blob。

Buffer：继续复用 `resolveBufferLineSpeechAssetId()` → `selectBufferSpeech()`。Phase 3E 的 preset 优先、version/node/locale/segment/hash/status 检查没有变；16 条错误 segment199 不会因本轮新增代码重新被补选。无生产语音读写或重生成。

旧浏览器行为证据：`KoreanLevelOneSmartTextbook.tsx` 中 `playTutorSpeech()`、`speakTutorCharacterLine()`、`bufferSpeechDone`、`pauseTutorLesson()` / `resumeTutorLesson()` 以及响应读取后的 speech manifest / TTS 分支。

现旁路 `teacher-block.tsx` 仍是手动“播放本句/过渡提示”。音频异常路径显示文本错误提示，未完成与旧流程等价的完整自动 buffer→speech→TTS fallback、pause/resume 和 cue-completion 时序。**这不是安全 selector 的回退，而是 mounted orchestration 仍缺失。**

28 条非 199 的既有证明和 16 条拒绝策略通过原 Phase 3E 回归继续保护；本轮八节点服务测试只播放该测试实际选出的正常段，不能另算为 28 段 Chromium 播放成功。

## 6. TTS Observation Grant / task

真实 task：`model-dialogue → studentTask.targetKey=dialogue:greeting:0`。

新会话复用 `auditTtsService()` / `observeAuditTts()` 和 `createTtsObservationGrantService()`。隔离测试证明：未签发拒绝、跨 session 拒绝、一次消费、重复观察无第二次教学效果、离开 task/Step 后拒绝、普通 ready 不代替 observation。

结果始终：

```ini
formalCompletion = false
progressDelta = null
score = null
agentAdvance = false
```

第一次有效观察只令 `teachingPlaybackWaitSatisfied=true`，随后由原 resolver 得到 task_feedback。浏览器 onend 仍仅是授权 utterance 的结束报告，不是服务器验证学生听完。

既有 `tts-playback-owner.tsx` / `speakAuthorizedUtterance()` 的独立 mounted Grant 测试继续回归。**新 RuntimeTeacherSession 与完整 Teacher 时间轴中的同一次 mounted Grant 联合链未完成；没有把服务级 observe 调用冒充浏览器 onend。**

## 7. Blackboard

对每个真实 segment 使用现有 `teachingBlackboardDisplayForSegment()`。标准化后仅有 text / bullets / expression，没有 image/video。

注意区分 raw JSON 与标准化结果：5 个旧 `display.kind` 节点没有 raw `slides` 数组，但旧 normalizer 会产生对应元素；不能因此报告这些节点没有黑板。`teacherSourceInventory()` 已逐节点检查标准化结果。

现 `teacher-block.tsx` 可显示内容和 translation，但类型/字重/tone/完整布局表现未完成新 Teacher 对照验收。本轮不伪造媒体黑板、不引入 arbitrary HTML。

## 8. Question / feedback / remediation / terminal

`resolveScriptStep()` 在问题阶段读取当前 referenced activity 与私密 grader 数据。`answer` 必须属于当前 questionOptions；错误返回既有 remediation 文本并继续 awaitingAnswer；正确按原反馈规则继续。

本轮隔离测试实际走到错误反馈、重答、task_feedback、terminal。没有自己计算教材 Activity 分数；没有写 attempt/progress/events 表。

terminal 后新 audit 会话返回既有 terminal cue，不产生新的 resolver turn、task 或 next cue。**这不等价于已接通生产 `learning_agent_sessions.status=completed`**：旧 `respond/route.ts` 由 `resolved.isFinalStep` 和原 task 条件决定 sessionStatus，并明确与教材完成分离。该生产持久化流程本轮未动。

## 9. TeacherTargetAudit

实际需要审计三处引用、七个 command requirement：

| 来源 | 稳定目标定位 | 命令 |
| --- | --- | --- |
| observe-scene.visualCue | orientation 场景 panel，既有 alias `orientation:page:scene` | reveal、highlight |
| model-dialogue.studentTask | orientation greeting 首句，既有 alias `dialogue:greeting:0` | reveal、focus、play |
| ready-for-practice.action_type | orientation-check 的 native multiple_choice Block | reveal、focus |

完整 address 由 `teacherSourceInventory()` 返回并在测试核对，没有修改 stepId/blockId/partId。

第三处不能遗漏：旧 Shell 收到 `focus_activity + targetActivityId` 会滚动并聚焦；现 `auditTeacherTurn()` 的公开 TeacherTurn 没有承接该 action。也不能直接继承旧 DOM selector；后续必须使用已经声明的 native Block stable target。

`play_expression` 的实际 v23 配置与上面的 TTS studentTask 同节点；旧 Shell 没有与 `focus_activity` 对应的独立通用 play_expression 执行分支，不能额外捏造命令/owner。

当前没有将 Phase 4A12 的 learning witnesses 充作完整 Teacher 发令 witnesses。对本轮尚缺的完整 mounted Teacher 输入空 witness 集，得到：

```ini
teacher source references = 3
unresolved source mappings = 0
required teacher target unsupported = 3
dangling teacher commands = 7
observed duplicate owner conflicts = 0
```

这里 unsupported/dangling 表示**缺少 Teacher 发令的完整挂载证据**，不是断言 learning owner 不存在。0 个已观察冲突也不代表完整所有权切换验收已通过。

审计器拒绝未声明 command、错 snapshot/Step、重复 owner、未知 witness；受控拒绝会记录，但不能被用来填满可执行覆盖率。

## 10. 生命周期与 reload

新增服务器测试：busy 串行、cancel 中断 resolver/bytes、旧 cue 拒绝、TTL/capacity、非 owner、来源 snapshot 改变、grant phase/跨会话/撤销。不存在第二套学习状态。

仍缺：新 Teacher mounted timeline 的 pause/stop、角色/黑板/正常语音/过渡语音同步；Step dispose 和 learning/Teacher 独占播放 owner 在同 Root 下的完整 Chromium 联合证据。

恢复语义必须分开：

- 当前 owner audit 的 `createRecordingAuditContinuation()` 保留录音审计 scope，但新建 Teacher state/grants。新会话遵循这种 audit 行为，测试重新从首 cue 开始。
- 旧学生 `learning-agent/respond/route.ts` 会按 authenticated tenant/student/lesson 查找 active session，并有 published version 变化处理及历史 task events。**不能因为 audit reset 测试通过就声称生产 Teacher reload 等价；这条连接仍未完成。**

## 11. Old / New Teacher 对照

下列判定是“完整新 Teacher 验收”口径；blocking difference 同时包括确定的实现缺口和尚缺的必要联合证据，不掩盖二者差别。

| 能力 | Old Shell | 当前 Runtime | 结果 |
| --- | --- | --- | --- |
| character | 原 resolver + 舞台人物 | 图片/pose 投影；完整位置状态未承接 | blocking difference |
| pose | segment performance | 已调用 resolver，未完成 timeline 挂载对照 | blocking difference |
| speech | 原自动播放/时间轴 | 安全选择、字节代理、手动播放 | blocking difference |
| buffer | 先 buffer 再正文 | 安全 selector 不变，自动衔接未完成 | blocking difference |
| TTS fallback | 现行自动降级 | 旁路错误分支仍不完整 | blocking difference |
| blackboard | 标准化类型/样式/位置 | 文本投影，完整表现验收未完成 | blocking difference |
| student task | events + resolver | 授权 Grant 服务已通过，完整 Teacher 挂载未完成 | blocking difference |
| visual cue | 旧目标定位 | stable 命令已有；缺整条 Teacher witness | blocking difference |
| question | 既有 resolver | 同 resolver 隔离测试通过，完整 UI 场景未验收 | blocking difference |
| feedback | 既有 resolver | 同上 | blocking difference |
| remediation | 原分支和文本 | 服务测试通过；未硬编码新分支 | blocking difference |
| terminal | session completed + focus activity | audit terminal 无新 turn；focus action 仍缺 | blocking difference |
| Agent session | authenticated 持久 session | 新 server-only audit session，无第二个 resolver；生产 restore 未接 | blocking difference |
| lifecycle | pause/resume/stop/恢复 | 服务器取消通过；mounted 联合清理未验收 | blocking difference |

服务端 resolver 的已覆盖分支可称“服务级等价”；这里不把它扩展为完整组件 equivalent。

## 12. Readiness 重新计算

`teacherCapabilityReadiness()` 要求 20 类证据、完整节点清单、全部真实 target requirements 与执行 witnesses，并且 Registry 实际 implemented。缺失、重复、错 revision/snapshot 都失败。它不是授权 API，也不能修改 Registry。

本轮能提供新隔离会话证据及 8 个节点的服务测试；其余完整 mounted 类别继续 unverified。重新计算得到 teacherReady=false，21 个检查阻断（包括 targets 和 renderer-registry；这是验收检查数，不是 21 个新的 Non-UI Adapter unsupported）。

可执行 capability 仍是：layout.v1、navigation.linear.v1、progress.server.v1、block.text、block.multiple_choice、block.compat.learning.v1。

`runtimeReadiness()` 仍只返回一个 Manifest required capability blocker：`block.compat.teacher.v1`。保留严格拒绝，不运行假 complete UI、不使用 inspection 冒充通过。

### 明确的剩余工作

1. 将新 opaque TeacherSession 接入现有 owner audit transport 和 scoped Teacher executor；不再把内部 cue/speech ID 返回浏览器。
2. 完整 character/blackboard/speech/buffer 时间轴、暂停/取消/错误降级、generation 清理。
3. 同一 Teacher timeline 的 mounted TTS Grant 与 learning playback owner 独占切换。
4. 承接 resolver 的真实 target action，尤其 terminal focus_activity；三处目标七个命令获得真实 Teacher witnesses。
5. 接通并区分 audit reload 与学生 Agent session 的实际恢复语义；不得复用旧 grant。
6. 同一 Root 下运行严格 complete Runtime 的八节点/八 Step 联合 Chromium，并重新评价上述 20 类证据。

这些尚未完成，所以不提升 Teacher capability，也不宣布 runtimeReady=true。

## 13. 测试与生产保护

最终完整回归 **797/797 passed，0 failed / skipped / cancelled**，其中本阶段新增 12 项；TypeScript 全量检查（关闭增量）和 `git diff --check` 均通过。完整测试命令：

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

日志：`/tmp/uply4a13-final-regression.log`、`/tmp/uply4a13-final-typecheck.log`。旧阶段 785 项全部继续通过；新增 12 项已经包含在 797 内，不重复相加。隔离 SQL rehearsal、mounted Recording 联合链和原 Chromium 测试均包含在上述完整回归中。

Chromium 包含既有严格 learning、target、录音联合和 TTS tests；**strict complete Teacher Chromium 正向场景未完成**。不能把全部已有测试通过当成这一新场景通过。owner browser E2E 仍未完成；没有冒用登录。

SQL 只运行已有隔离 rehearsal；没有加载生产连接执行 migration、没有真实录音/音频对象读写。

Manifest snapshot 仍为 `snapshot-774d8fd07f5e3f6c1c1fe5f0bd6a15f2`；Manifest digest 仍为 `sha256:19bb72f491ae7f460d83867b09562e079e8bf1dfb3ee62b3de04775f88471f2e`。8 Step、19 Activity、orientation 三题、published v23 和 Phase 3E selector 均未修改。没有 production import 新服务的接线，没有生产路由切换、gate 开启、release pointer、migration 或 legacy 删除。工作区前阶段/用户已有修改保持原样。

**按本阶段允许的“仍有 Teacher blocker 则精确列出后停止”条件停止；未进入 Phase 4B。**
