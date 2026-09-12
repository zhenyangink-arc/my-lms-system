# Phase 4A / 4A-2 第一章旁路 Runtime 验收状态报告

日期：2026-09-09。

## 1. 结论：尚未完整收口

**本次没有达到 Phase 4A-2 的完整验收目标。** 文件名沿用要求的 FINAL_REPORT；它记录的是未通过完整验收的状态，不是完成或上线声明。

```ini
remainingNonUiUnsupported = 0
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
owner browser E2E = 未完成
production student route switched = false
```

本次实装了：挂载式 Browser TTS owner 与 Phase 3D Grant 的服务器桥接、部分复合活动的原判题服务提交、三类语法和听力的冻结分页检查、听力音轨与受授权母稿服务、教师语音/人物图片的私有字节代理、历史进度子集的只读投影，以及句型对话/组句的旁路逐轮检查。Phase 4A-2 新增测试累计 **75/75**，合并回归 **481/481**；隔离 Chromium 不是已登录 owner 验收。

但是，句型流程的正式聚合/历史恢复/媒体 target、角色实战和录音、guided repeat mounted 执行、真实历史读取到 UI 恢复、chapter-test open、完整教师执行时序以及 owner 登录验收仍未完成。**不能将这些缺口归因于单一的“没有登录账号”，也不能因局部测试通过而将 compatibility 登记为 implemented。**

`src/features/smart-textbook-runtime/core/block-registry.ts → runtimeReadiness()` 实际返回的 executableCapabilities 仍为：

```text
layout.v1
navigation.linear.v1
progress.server.v1
block.text
block.multiple_choice
```

`progress.server.v1` 是原有“正式状态只接受服务器投影”的 Core 门禁，不代表所有历史读取适配已经完成。严格 `LessonRuntime` 仍因两个 required compatibility capability 拒绝第一章激活。组件检查模式仍显式标为诊断模式，不冒充可激活章节。

## 2. 基线及证据范围

沿用以下现有文件，没有复制第二套去留决策文档：

- `docs/SMART_TEXTBOOK_CURRENT_STATE_AUDIT.md`
- `docs/SMART_TEXTBOOK_TARGET_STATE_AUDIT.md`（工作区真实名称）
- `docs/SMART_TEXTBOOK_MANIFEST_RUNTIME_V1_DESIGN.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3A_REPORT.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3B_REPORT.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3C_REPORT.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3D_REPORT.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_3E_REPORT.md`
- `docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A_REPORT.md`

本轮测试由 `tests/fixtures/runtime-4a.mjs` 调用真实 `finalizeChapterOneNonUiReadiness()` 编译已冻结的第一章源数据、identity ledger 和 service evidence。未修改这些冻结源文件。仍为 8 Step、19 Activity、orientation 三题、published v23 legacy、零 teacherVideo。

本轮**没有重新运行生产 SELECT 或登录生产站点**。上述 published v23 的内容证据来自先前真实采集并冻结的样本及 Reader 代码，不表述成“本轮在线重新确认生产数据”。真实审计页面仍调用 `readAuditSource()` 的真实 Reader；其 owner 登录到 Reader、Adapter、mount 的端到端路径本轮尚未完成实际访问。

## 3. 文件与实现边界

### 新增旁路实现

以下路径位于 `src/features/smart-textbook-runtime/`：

| 文件 | 职责 |
| --- | --- |
| `core/activity.ts` | 闭合作答 DTO：单选、多选、排序、题组、写作、自检；没有客户端身份或成绩输入 |
| `core/activity-pages.ts` | 冻结 page/part 的公开服务 DTO；不公开旧页码/题目 index |
| `core/patterns.ts` | 句型对话/组句闭合 DTO、stable response 与逐轮布尔反馈；非 Manifest 扩展 |
| `core/playback.ts` | 临时授权 TTS owner 契约与真实 SpeechSynthesis 播放观察驱动 |
| `server/activity-binding.server.ts` | 当前 capsule 活动逐字段投影，stable response → 原 grader response |
| `server/activity-pages.server.ts` | Phase 3C page/part + Phase 3B option ledger → 原分页 Action 参数 |
| `server/pattern-binding.server.ts` | 冻结 turn/option/token → 原检查 Action 的私有 itemIndices/response，无 pageIndex |
| `server/progress-projection.server.ts` | 已授权历史行的子集投影；未接真实 history loader，不是完整恢复服务 |
| `server/audit-tts.server.ts` | 真实 Grant 发行、消费和现有 PreviewState 教学等待事件桥接 |
| `server/audit-speech.server.ts` | 当前服务器 turn 的 speech/buffer/pose 选择边界和私有字节代理 |
| `server/listening-binding.server.ts` | capsule/page → 现有 listening 领域资源；服务器母稿门禁 |
| `components/activity-executor.tsx` | 局部活动表单与现有服务反馈 |
| `components/activity-page-executor.tsx` | 语法/听力分页检查 UI；不自判正式完成 |
| `components/pattern-executor.tsx` | 对话四轮选择、组句六轮检查、定时继续与 Step 取消；仅旁路预览，不替代正式聚合 |
| `components/open-activity-executor.tsx` | 写作与 self-check 服务端提交 UI |
| `components/listening-page-media.tsx` | 逐页听力 bytes/母稿、取消与 URL 清理 |
| `components/tts-playback-owner.tsx` | 挂载授权 utterance、onend observation、停止与 dispose |
| `components/teacher-character.tsx` | 服务器授权人物图片 bytes，不接收对象路径 |

新增的三个 owner-only HTTP 旁路端点：

- `src/app/api/smart-textbook-runtime-audit/speech/route.ts`
- `src/app/api/smart-textbook-runtime-audit/character/route.ts`
- `src/app/api/smart-textbook-runtime-audit/listening/route.ts`

### 更新的既有 Phase 4A 旁路文件

- `core/services.ts`、`core/teacher.ts`：追加局部可选服务端口；没有修改 Manifest。
- `core/target-registry.ts`：挂载的授权 TTS owner 可以获得服务级 play；通用 DOM handle 仍不能假装播放。
- `components/runtime-context.tsx`、`components/learning-content.tsx`、`components/teacher-block.tsx`、`components/audit-client.tsx`：挂接 owner、活动和媒体服务；根 Layout/StepController 仍由既有 Runtime Core 持有。
- `server/audit-actions.ts`、`server/audit-requests.server.ts`、`server/audit-session.server.ts`、`server/audit-source.server.ts`：每个 Action 先执行 `requirePlatformOwner()`；请求 strict parse；绑定只保存在服务器；Reader 同时要求非空 Manifest 与 readiness service bindings。

未新增第二套 PreviewRuntime / StudentRuntime，未嵌入旧 SmartTextbookShell，未改现有正式学生 Route、判题器、录音、Agent 状态机或 Phase 3E selector。

## 4. 19 Activity 的真实状态

表中的“提交”指旁路服务调用原 `submitSmartTextbookActivityForContext()` 的 preview 分支，不是持久化学生 attempt。测试中的私密答案仅为服务器测试传输的合成答案，不声称它们等于生产答案。

| Step / Activity | 本轮状态 | 尚缺 |
| --- | --- | --- |
| orientation / orientation-check | 原 native 单选 Renderer、原 grader 往返测试通过 | 真实 owner 站点验收 |
| orientation / orientation-jimin-occupation | 同上，未合并或遗漏 | 同上 |
| orientation / orientation-wangming-occupation | 同上，未合并或遗漏 | 同上 |
| vocabulary / vocabulary-check | stable item/option 表单、原 grader 提交与反馈；Chromium 验证 | 历史作答/完成恢复、原逐卡体验等价 |
| grammar / grammar-choice | 两页、原分页 Action 检查；全题组提交服务测试 | 连续三活动调度、正式聚合及完整恢复 |
| grammar / grammar-judgment | 两页、原分页 Action 检查；全题组提交服务测试 | 同上 |
| grammar / grammar-fill | 两页、原分页 Action 检查；全题组提交服务测试 | 同上；grammar audio 未接通 |
| patterns / pattern-choice | 专用 Executor：8 轮对话（4 line / 4 choice），原逐轮检查，答错停留、答对后继续；Chromium 通过 | 语音媒体/target、正式聚合、历史恢复 |
| patterns / pattern-order | 排序表单、原 grader 提交与反馈测试 | 句型模块完整连续流程、历史恢复 |
| patterns / pattern-compose | 专用 Executor：6 轮 token 组句、原逐轮检查、通过后延时继续；Chromium 通过 | 语音媒体/target、正式聚合、历史恢复 |
| dialogue / dialogue-fact-check | 单选提交与原 grader 测试 | 模块流程/历史恢复 |
| dialogue / dialogue-response | 单选提交与原 grader 测试 | 同上 |
| dialogue / dialogue-roleplay | `unavailable` | role turn、recording、speaking evidence、原完成 Action |
| listen_speak / listening-identity | 专用分页服务覆盖两轨八题；原 page Action、audio/transcript Route 接通；隔离浏览器通过 | 全活动原提交/聚合、限播差异决策、历史恢复、stable target play |
| listen_speak / speaking-introduction | `unavailable` | 录音、evidence、原完成服务与 UI |
| read_write / reading-profile | 题组表单、原 grader 提交测试 | 模块连续流程、历史恢复 |
| read_write / write-profile | 文本/checklist/rubricConfirmed → 原开放题 grader；Chromium 表单提交 | 正式完成投影、历史恢复、完整读写连续流程 |
| review / review-multiple | 多选、原 grader 提交测试 | 历史恢复与 review 完整流程 |
| review / self-check | stable check/returnTarget → 私有旧 returnNodes → 原开放题 grader；Chromium 提交 | 实际回访目标与章节测试 open、历史恢复 |

当前通用活动投影仍将 5 项标记为 unavailable；其中 listening-identity 由专用分页/媒体组件局部接管，pattern-choice / pattern-compose 由专用句型服务和组件局部接管。dialogue-roleplay、speaking-introduction 两项仍没有执行器。专用路径有真实交互不等于全功能等价，没有为减少数字修改 requiredCapabilities。

原 grader 的 preview 响应包含 `attemptNumber=1`，但它在持久化分支之前返回；该值不代表数据库新增了 attempt。开放题保持 `correct=null / score=null`。本轮没有新增判题/完成公式。

## 5. 八 Step：Old Shell / Runtime v1 对照

`equivalent` 只描述指定且已验证的范围；整项含缺口时标 partial，不用静态内容显示掩盖交互未完成。

| Step（顺序不变） | 标题 | Old Shell | Runtime v1 | 判定 |
| --- | --- | --- | --- | --- |
| orientation | 初次见面交流目标 | 三题、场景、对话及 legacy teacher | 三题与文本、stable TTS 目标可用；教师完整时序/场景媒体仍缺 | partial |
| vocabulary | 问候与人物身份 | 词汇与逐卡练习 | 词汇文本、题组提交 | partial |
| grammar | 主题助词与判断句 | 三活动六页、示例音频、分页完成与恢复 | 三活动六页检查；音频、连续完成/恢复缺 | partial |
| patterns | 姓名与身份介绍 | 连续对话、排序、组句 | 三种交互均有旁路检查/提交；语音、原模块调度、正式聚合和恢复仍缺 | partial |
| dialogue | 初次见面对话结构 | 对话、两题、角色实战、录音 | 内容、两题提交；角色实战缺 | partial |
| listen_speak | 听辨与口头表达 | 两轨听力、跟读、口语证据 | 两轨分页检查/播放/母稿；跟读、录音及完整恢复缺 | partial |
| read_write | 个人介绍读写 | 阅读和写作、原完成规则 | 阅读与写作提交；连续流程/恢复缺 | partial |
| review | 独立交流能力 | 多选、自检、回访和章节测试 | 多选、自检提交；open 缺 | partial |

| 能力 | Old Shell | Runtime v1 | 对照结果 |
| --- | --- | --- | --- |
| 8 Step、标题、顺序 | 当前实现 | 同一冻结 Manifest + Chromium 八步切换 | equivalent（结构范围） |
| 内容 | 原 node 内容/媒体 | 全部 capsule 文本投影；部分媒体未接 | partial |
| 19 Activity 身份 | 原 UUID | 全部保留并扫描 | equivalent（身份范围） |
| orientation 3 题提交 | 原 server grader | 同一 grader，三题均测试 | equivalent（隔离 preview 提交范围） |
| listening | 原音轨 Route | 两轨原 Route 适配、母稿授权 | partial |
| page progress | 原表写入/恢复/聚合 | 私有映射、原 page check；未接完整持久化恢复 | partial |
| guided repeat | 2 track / 14 segment | 只读 round-trip proof，未挂 mounted executor | unsupported（执行） |
| recording | 原录音 Route | 尚无 Runtime 录音端口/UI | unsupported |
| speaking evidence | 原领域证据 | repeat-line 历史子集投影，未接上传/读取/UI | partial（投影），unsupported（执行） |
| role play | 原角色回合和完成服务 | 未实现 | unsupported |
| read/write | 原模块流程 | 两种提交已接；完整流程/恢复缺 | partial |
| review | 原模块流程 | 多选/自检提交；回访缺 | partial |
| chapter test | 原内部 Route + 完成门禁 | Phase 3C 私有 binding 保留；尚无 mounted open | unsupported |
| legacy teacher | 原脚本/人物/黑板 | scoped resolver + 局部媒体/黑板/target | partial |
| speech / buffer | 原自动时序 | 安全 ID + 字节代理 + 手动播放本句/过渡提示 | partial |
| TTS studentTask | 原 browser onend → 教学节奏事件 | 授权 Grant + mounted owner + 只满足教学等待 | equivalent（隔离任务链），实站未验收 |
| blackboard | 原 display/slides | 当前文本类元素；媒体 executor 尚缺 | partial |
| remediation / terminal | 原 resolveScriptStep | 继续调用同一 resolver，但未完成全链 mounted 验收 | partial |

## 6. TTS Grant 的实际挂载链

```text
auditTurn → 原 resolveScriptStep 返回真实 task
  → auditTtsOwner（当前 cue/target/revision/generation）
  → 对应 learning part 中的 TtsPlaybackOwner
  → auditIssueTts → 原 Phase 3D grant service
  → SpeechSynthesisUtterance（服务器返回的精确 text/locale）
  → browser onend → auditObserveTts(grantId)
  → consume once → PreviewState.completedTaskEvents
  → 下一次 ready 由原 resolveScriptStep 进入 task_feedback
```

单次有效观察始终是：

```ini
playbackObserved = true
formalCompletion = false
progressDelta = null
score = null
agentAdvance = false
teachingPlaybackWaitSatisfied = true
```

重复消费只有 duplicate，不重复满足教学等待。没有未签发 onend → Agent 推进的逃生口，没有 activity completion、成绩或正式 progress 写入。浏览器回调只能报告结束，**不能证明服务器验证用户听完**。第一次观察后 UI 禁止再次签发同一逻辑任务；重复 HTTP observation 的幂等测试仍保留。

`RuntimeTargetRegistry.mountTtsOwner()` 注册的是临时、闭合的服务授权能力，不是新增 Manifest 字段或 fake mediaRef。执行时必须有实际 target handle、当前 Step/generation/snapshot/teaching revision。普通 DOM handle 不能获得 play；Step dispose 清理 owner、取消媒体，并撤销旧 generation 的服务器 grant。

审计 store 的 `owner-audit:<ownerId>` 只是内存命名空间，不是租户 ID，不传入数据库或学生领域服务。单进程、30 分钟有界审计 session 继续失败关闭；没有把它当成正式分布式 Agent session 服务。

## 7. Speech、人物与黑板

- `auditTeacherTurn()` 继续调用原 `resolveScriptCharacter()` 和 Phase 3E `resolveBufferLineSpeechAssetId()`。没有将 ready segment 199 行重新直接交给浏览器。
- 新 speech 请求只接受 session/cue/generation/`speech|buffer`。asset、preset、URL、对象键由当前服务器 turn 决定，客户端不能指定。
- `proxyAuthorizedSpeech()` 先调用原 speech Route 授权，再服务器 fetch 固定 R2 origin，禁止跟随外部 redirect，仅转发音频 bytes 和必要 Range 响应头。不再在新 React 中消费旧 Route 的 `audioUrl`。
- 人物图片同样经过原 character Route 授权，302 的签名地址只在服务器消费，浏览器只收到图片 bytes；pose 来自当前 turn。
- 新 React 媒体使用可撤销 blob URL；停止、旧 generation、切页和 unmount 取消请求/播放、回收 URL。
- 本轮没有修改 speech 数据、hash、script、preset、bufferLine、v23 发布状态，也没有制作教师视频。
- 私有 selector proof / 28 个非 199 资源及 16 个错误候选的拒绝规则由原 Phase 3E 测试继续验证。本轮未实际试听线上 R2 媒体。

黑板事实反查：冻结 v23 的 8 个节点中，`welcome`、`observe-scene` 有 text/bullets/expression，`step-8-bbfc46` 有 text/bullets，另 5 个节点没有这些 display 元素；没有 image/video 元素。这里不虚构第一章媒体样本。现有 `auditTeacherTurn()` 对 image/video 仍明确报告 unsupported；没有把通用黑板媒体 executor 声称为已完成。legacy 坐标只存在教学兼容显示内部，根 Layout 不读取它。

尚缺：自动 speech/buffer 生命周期与 voice timeline/形态表现的完整等价、全部教师节点 question/feedback/remediation/terminal 的 mounted 验收、媒体类黑板兼容执行器。

## 8. 分页、听力与历史 State

### 分页与听力

- `activityPages()` 使用 Phase 3C 的冻结 pageId/partId，与 Phase 3B option identity 映射。UI 的“第 1/2 页”仅是展示次序，不作为 Runtime identity。
- `boundPageResponse()` 将稳定 part/option 转回原 Action 的 activityId/pageIndex/itemIndices/response。输入拒绝悬空选项、重复 part、缺项及 score/身份注入。
- `checkBoundPage()` 调用原 `checkSmartTextbookActivityPageAction()`。只返回逐题布尔反馈，不把其私密 answers 数组送入新客户端。
- 冻结映射仍生成完整旧 pageIndex，round-trip 测试不变；唯独 owner tracking-disabled 网关调用原 Action 时省略其可选 pageIndex（它只控制旧 Action 的分页写入分支），以额外保证预览不会写 page progress，而不是依赖角色判断作为唯一保护。
- 这也意味着旧“显示答案后继续”的完整流程**尚未等价**。未通过放出答案或跳过原完成聚合来制造就绪。
- 听力两页分别解析到已冻结领域 track/media ref，再调用原 `audio/[activityId]` 和 `transcript/[activityId]` Route；保留 active-user、课程权限、RLS 和 published chain。
- 母稿需要当前服务器审计 session 已完成相应 page check；即使猜到 URL 也不能靠客户端 checked 标志解锁。测试不读取真实私密母稿。
- 旧 `KoreanLevelOneSmartTextbook.tsx` 当前听力 UI 是原生 `<audio controls>`，没有消费 normalReplayLimit/slowReplayLimit。配置中的 2/1 保留，但不谎称现有 UI 已限播；需要产品/兼容决策，不能在本阶段顺便创造新限制。

### 历史投影不等于已完成恢复

`projectPersistedHistory()` 接受已经由可信服务器读取且授权的行；校验 owner/tenant/version/source，投影 attempts、8 node 状态、8 activity page、2 track/14 repeat segment 及 repeat-line evidence。拒绝未知未完成 node、未知 segment、重复 page/evidence、额外私密字段。旧页和 segment round-trip、binding 数组重排后身份稳定均有测试。

但目前它：

- 没有实际数据库 history Reader 调用；
- 未转换成并接入 Runtime `ServerLearningState` 的完整恢复链；
- evidence 仅覆盖 repeat-line 元数据子集，未覆盖 roleplay/独立口语；
- 本轮未读取用户真实历史或清零其数据。

当前 UI 只保留 Runtime 生命周期内的部分未提交输入与 stable-id Step resume。owner 审计新 session 初始正式进度仍为空；这不是学生历史迁移完成。现有 progress 表和原恢复 loader 均未修改。

### 句型连续交互（本次继续增补）

原行为证据：旧 `KoreanLevelOneSmartTextbook.tsx` 的 `PatternConversationPractice()`、`PatternCompositionPractice()`。前者使用配置中的 choiceIndex 逐轮检查，答对后逐字显示并延时推进；后者将用户语块按空格连接、收紧标点空格，再按轮检查，通过后 520ms 继续。二者在 trackingDisabled 时都不执行末轮正式提交。

旁路新增链路：

```text
当前 Step capsule
→ patternExecutions（冻结 turn / option / token ID）
→ PatternExecutor（局部 activeId、用户选择、已通过回合）
→ auditCheckPattern（requirePlatformOwner + 当前私有 session）
→ boundPatternCheck（服务器还原旧 choiceIndex / composition 位置）
→ 原 checkSmartTextbookActivityPageAction（无 pageIndex）
→ 仅 correct 布尔反馈，formalCompletion=false / progressDelta=null
```

- `choiceIndex`、数组位置仅作为固定 revision 的服务器旧服务地址；不进入公开 DTO 或 Runtime target。客户端 activeId 与响应均使用已有 frozen part ID，没有创建新 identity。
- 覆盖四轮选择和六轮组句；保留用户重复使用同一语块的旧行为。客户端文本拼接仅组合用户输入，不判题。
- 答错留在本轮；答对后才加入对话、按原延时继续。计时器、逐字显示和请求在 unmount/Step dispose 时取消，旧 generation 的反馈不能回写新 Step。
- 新组件尊重 reduced-motion，使用自然语言标题和 `CardTitleWithHint`。不新增全局导航或正式 Learning State。
- 当前只启用 trackingDisabled 的检查流程；非预览明确拒绝，不能把局部“练习结束”解释为已持久化 Activity completion。没有接通正式 final submit 或历史完成恢复，因此仍是 partial。
- 当前未接原可选语音朗读/预生成对话音频、完整 pattern 模块 panel 调度和 stable target owner，不声称句型能力已等价。
- 新测试使用冻结公开结构加合成测试答案，真实执行旧 checker；未获取、修改生产答案。

## 9. Target play/open 与 Preview

- reveal/focus/highlight/dispose：原 Phase 4A 测试继续通过。
- play：本轮仅授权 Browser TTS mounted owner 已接到 stable target；听力 native audio、教师媒体有真实播放 owner，但尚未将所有媒体注册为 stable target play。不能把“有播放按钮”当作 target coverage 完成。
- open：普通 Region reveal/open handle 不等于 chapter-test 导航；后者尚未接通。
- chapter-test binding 仍是 `chapter-test:korean-level-one-01`，保存在 Phase 3C 私有服务；未扩大 Manifest 为任意 URL，未跳过服务器 chapter completion。
- Preview 和将来的正式运行仍共用同一 LessonRuntime 组件与 RuntimeContext。当前只新增 owner 审计服务，没有学生生产入口导入。
- 审计 Action 的 preview 来源固定为服务器上下文，客户端不能传 preview=false。原 preview grader 在正式数据库写入之前返回。

真实旁路入口仍为：

```text
/[space]/dashboard/admin/apps/korean/teaching-scripts/runtime-v1-preview
```

用户授权的账号为 yangzhen075@gmail.com，但用户确认 Chrome 登录会话在其个人电脑、不在开发服务器。本环境未连接该浏览器；未读取/复制 Cookie、账号数据库或令牌，未生成 magic link、冒用 owner 或绕过登录。

**owner browser E2E = 未完成**。不能把匿名隔离 Chromium harness 当成 platform_owner 真实站点验收。

## 10. 测试与回归

| 范围 | 结果 |
| --- | --- |
| TypeScript 全项目，无 incremental | 通过 |
| Phase 3A | 85/85 |
| Phase 3B | 50/50 |
| Phase 3C | 55/55 |
| Phase 3D（原 Grant 等） | 53/53 |
| Phase 3E | 44/44 |
| 相关 legacy 回归 | 83/83 |
| 原 Phase 4A | 36/36 |
| 新 Phase 4A-2 单元/服务测试 | 51/51 |
| 新 Phase 4A-2 句型绑定/服务测试 | 16/16 |
| 新 Phase 4A-2 Chromium | 8/8（1 父测试 + 7 子测试） |
| 最终合并 | **481/481**（无失败、跳过或取消） |
| git diff --check | 通过 |
| owner 真实站点 E2E | 未完成 |

新增测试文件：

- `tests/smart-textbook-runtime-4a2.test.mjs`
- `tests/smart-textbook-runtime-4a2-browser.test.mjs`
- `tests/smart-textbook-runtime-4a2-patterns.test.mjs`
- `tests/fixtures/runtime-4a2.server.mjs`

扩展 `tests/fixtures/runtime-4a-browser.tsx` 的隔离 transport 选项，旧 Phase 4A 测试模式不变。

Chromium 子测试使用真实 React、TargetRegistry、原 resolver、原 grader、原 page Action 和 Phase 3D Grant。替换的是测试身份/SELECT 传输、操作系统语音输出和媒体字节传输。测试反馈答案、静音 WAV、母稿均是明确的合成测试资源，不是生产内容或 fake Renderer。未安装生产测试账号、未向真实数据库提交作答。

本次继续增补的句型测试包含：冻结 ID 数量/重排、四轮选择与六轮组句映射、错误响应、非法 part/option/token、身份/成绩/完成注入、非 owner 在 session 访问前拒绝、遗漏 pageIndex 后原写入分支不可达。Chromium 实际操作所有十轮正确作答并测试四次错误作答；另单独挂起服务器响应，在 Step dispose 后释放，确认新 Step 和重新进入的句型状态不被旧响应污染。以上均未把局部检查标为正式完成。

执行命令：

```bash
npm run typecheck -- --incremental false --pretty false
node --no-warnings --experimental-strip-types --test \
  tests/smart-textbook-runtime-v1.test.mjs \
  tests/smart-textbook-legacy-adapter.test.mjs \
  tests/smart-textbook-readiness.test.mjs \
  tests/smart-textbook-final-readiness.test.mjs \
  tests/smart-textbook-speech-selection.test.mjs \
  tests/smart-textbook-sidebar.test.mjs \
  tests/learning-agent-*.test.mjs tests/teaching-video.test.mjs \
  tests/teacher-kim-*.test.mjs tests/teaching-blackboard.test.mjs \
  tests/smart-textbook-runtime-4a*.test.mjs
git diff --check
```

## 11. 自查及生产保护

按本轮开始时 SHA-256 基线反查，以下保持一致：

- `src/lib/smart-textbook-runtime-v1/`
- `src/lib/smart-textbook-legacy-adapter/`
- `src/app/dashboard/courses/`（含旧 Shell、ContentRenderer、原判题/录音相关 Action）
- `src/app/api/learning-agent/`
- `src/lib/learning-agent-script-runtime.ts`
- `src/lib/smart-digital-textbook.ts`
- `src/lib/learning-agent-buffer-selection.server.ts`
- `supabase/migrations/`

工作区本来已有大量未提交业务改动和 migration；它们被保留，不是本轮新增。没有数据库 schema 修改、migration 执行、生产 DB mutation、发布、新 release pointer、教师视频制作、legacy 删除或学生生产切换。

公开 Manifest 不含 secret/object key/私密母稿，契约与稳定 ID 未更改。新 Runtime React 不直接查询 Supabase，也不接受原始 capsule/configuration；语音与人物签名地址不再由旁路组件直接取得。新增审计端点均有 owner guard；非 owner handler 拒绝和不同 owner 不能使用同一私有 session 均有测试。

UI 技能仅用于可访问表单、明确提交反馈、可取消媒体和生命周期检查；没有重设计教材视觉，标题+说明沿用 `CardTitleWithHint`。

## 12. 剩余阻断（仍属于 Phase 4A-2）

1. pattern-choice / pattern-compose 已接旁路逐轮检查，但仍缺原语音、正式聚合、历史恢复、完整模块调度与媒体 target。
2. dialogue-roleplay、speaking-introduction、录音、speaking evidence、guided repeat 完整服务/UI/lifecycle。
3. 原三语法活动、听辨题的完整连续提交、显示答案后继续、正式聚合语义；grammar audio。
4. 真实历史 attempts/node/page/repeat/evidence 的授权 Reader → ServerLearningState → UI 恢复。
5. 所有必要媒体的 stable target play，以及 review 回访与受服务器完成门禁保护的 chapter-test open。
6. 教师全部节点和 question/feedback/remediation/terminal、自动 speech/buffer/时间轴/人物表现的完整 mounted 等价验收；通用黑板媒体兼容执行。
7. 当前听力配置限播值与旧 UI 实际行为差异的明确决策，不伪造已经存在的限制。
8. 用户正常授权登录路径上的 platform_owner 真实 Reader/Adapter/Runtime/媒体/服务 E2E。

上述任一必要功能未完成，都不能提高 capability 或将 runtimeReady 改为 true。当前仍停留在 Phase 4A-2；没有进入 Phase 4B，也没有生产切换。
