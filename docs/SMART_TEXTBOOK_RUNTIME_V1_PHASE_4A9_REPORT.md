# Phase 4A-9：第一章学习执行链

## 修改前差距审计（2026-09-10）

基线：Phase 4A、4A_FINAL、4A3、4A8 报告；实际 frozen source / Manifest / Capsule 与旧 `KoreanLevelOneSmartTextbook.tsx`，不是推定生产部署状态。

| Step | 原实现证据 | 修改前缺口 |
| --- | --- | --- |
| orientation | Activity + 三道必需单选 | 服务端历史反馈恢复 |
| vocabulary | Activity 的 activeCardIndex 属临时状态；vocabulary-check 整组提交 | 逐卡、反馈/完成恢复 |
| grammar | Activity → checkGrammarPage / revealGrammarAnswers / nextGrammarPage；三活动各两页 | 检查后继续、整组提交、历史、音频 |
| patterns | PatternConversationPractice / PatternCompositionPractice：错留、对后计时继续；末轮原 submit | 三子活动调度、最终提交、响应恢复、可选朗读 |
| dialogue | 两题 + DialogueRoleplayPractice | 模块调度、共同历史刷新；4A8 录音执行器保持 |
| listen_speak | ListenSpeakLearningPanel / Activity；两轨听力 + 2轨14句跟读 | 分页聚合、历史、媒体目标；不新增限播 |
| read_write | ReadWriteLearningPanel / Activity | 阅读→写作调度和恢复；写作不是章节必需项 |
| review | ReviewResultPanel / Activity；原测试链接需 progressPercent >= 100 | 自检回访、服务端 chapter-test gate；self-check 非必需项 |

重要边界：冻结源 `counts_toward_completion=false` 的两项是 write-profile、self-check。所有 Step 的正式完成仍来自 node progress，不从前端练习数推算。旧语法卡示例点读直接 `speakKorean(example.ko)`；预生成语法音频另在 media bindings。当前 Manifest 所有 target 的 play 声明数量为 0；不能给普通 DOM handle 伪造播放。教师不在本轮范围。

## 本轮结论

第一章学习侧已有可执行的旁路连续流程，但**没有达到“全部学习执行能力最终收口”**。本报告不把测试通过等同于完整 Old/New 等价。尤其句型既有预生成音频优先路径、全部学习目标挂载、原生三题的选项历史恢复与部分录音联动仍有缺口，不能提升 capability。

```ini
remainingNonUiUnsupported = 0
nonUiRuntimeReady = true
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
```

`executableCapabilities` 保持：`layout.v1`、`navigation.linear.v1`、`progress.server.v1`、`block.text`、`block.multiple_choice`。严格 `LessonRuntime` 继续拒绝整个第一章激活；本轮通过现有审计/隔离 inspection 路径验证，不用假 Renderer 绕过 capability gate。

## 1. 文件与边界

新增文件均在旁路 Runtime 或测试范围：

- `src/features/smart-textbook-runtime/core/learning-flow.ts`：闭合的活动响应、逐题检查、历史反馈恢复 DTO。
- `src/features/smart-textbook-runtime/core/learning-flow-transport.ts`：共享服务转接及 AbortSignal 边界。
- `src/features/smart-textbook-runtime/core/learning-tools.ts`：学习播放 owner / 受控内部 destination DTO。
- `src/features/smart-textbook-runtime/server/learning-flow.server.ts`：分页检查→显式订正→整组原提交、句型逐轮检查→整段原提交；隔离审计练习状态。
- `src/features/smart-textbook-runtime/server/learning-history.server.ts`：真正执行现有表 SELECT 的授权历史 Reader。
- `src/features/smart-textbook-runtime/server/history-response.server.ts`：旧 response→稳定 part/option/token 的明确字段转换。
- `src/features/smart-textbook-runtime/server/production-learning.server.ts`：未安装到任何生产路由的授权领域服务适配器。
- `src/features/smart-textbook-runtime/server/audit-flow.server.ts`、`audit-flow-actions.ts`：Owner 审计服务与每次请求的权限校验。
- `src/features/smart-textbook-runtime/server/learning-tools.server.ts`、`audit-tool-actions.ts`：冻结媒体 owner 与回访/章节测试绑定。
- `src/features/smart-textbook-runtime/components/learning-tools.tsx`、`operation-lease.ts`：真实点读、open，以及 Step/子活动双生命周期取消。
- `tests/fixtures/runtime-4a9.mjs`、`tests/smart-textbook-runtime-4a9.test.mjs`、`tests/smart-textbook-runtime-4a9-browser.test.mjs`：合成 transport，运行真实 grader / checker / Reader / Chromium 组件。

局部接线文件：`core/services.ts`、`core/target-registry.ts`；`components/audit-client.tsx`、`activity-executor.tsx`、`activity-page-executor.tsx`、`open-activity-executor.tsx`、`pattern-executor.tsx`、`learning-content.tsx`、`listening-page-media.tsx`、`runtime-context.tsx`、`choice-block.tsx`；`server/activity-binding.server.ts`。`recording-executor.tsx` 只增加按 activityRef 嵌入和正式结果后刷新，`guided-repeat-executor.tsx` 只增加 production-domain 标记后的服务端刷新；未重写 4A8 录音链。共享 Chromium harness 增加可选 learningFlow 接线，旧测试路径默认不启用。

没有修改 Manifest、frozen identity、Adapter source、3D TTS Grant、3E speech selector、Teacher Executor、旧 Shell、原判题/进度 RPC、学生正式路由、数据库 migration 或部署配置。工作区原本有其他阶段的未提交改动，本轮保留它们，不把整个 dirty worktree 误算成本轮变更。

## 2. 8 Step 学习侧 Old / New 对照

下表判定是完整学习侧验收结论，不只是“组件能显示”。

| Step | Old Shell | Runtime 本轮结果 | 判定 |
| --- | --- | --- | --- |
| orientation | 三单选、反馈、已有 attempt/完成恢复 | 三 Native Block 与原服务继续可用；Reader 能投影三题 attempt，原生选项的跨刷新恢复尚未闭合 | partial |
| vocabulary | 逐卡选择，整组原判题，正式完成由服务端保存 | 逐项按钮、响应恢复、反馈恢复、原整组提交；浏览器整页刷新已验证；不是逐卡正式进度 | partial：全部 declared activity/子项 targets 尚未验收 |
| grammar | 3 活动×2 页，检查/订正、继续、全向量提交；例句 TTS | 六页完整检查→订正→继续→原提交、逐题结果与响应恢复、九处例句点读 | partial：全部页/题目目标挂载尚未闭合 |
| patterns | choice→order→compose；错留/对后推进；现成 audio 优先，失败 TTS | 三活动连续调度、4 次 choice/6 次 composition、原整段提交、恢复；临时可选 TTS | partial：尚未接回现成 audio 优先路径；逐轮 target 覆盖不足 |
| dialogue | 两题→录音 roleplay→原完成 | 两题连续原提交，最后按 activityRef 嵌入原 4A8 Roleplay；正式结果触发 Reader 刷新 | partial：继承 4A8 Roleplay 缺口，完整模块+录音历史联动仍需验收 |
| listen_speak | 两页/两轨听力→跟读/表达；正式 speaking 完成独立 | 听力整组聚合、母稿门控/恢复、两真实播放 owner；保留两轨14句/full recall/口语 | partial：继承录音组缺口、全部目标与正式组合验收不足 |
| read_write | 阅读检查→可选开放写作，原服务结果 | 连续调度、响应/反馈恢复、原开放提交；null correct/score 不变 | partial：全部目标与真实历史 UI 全链验收不足 |
| review | 多选→可选 self-check→回访/章节测试 | 连续提交、恢复、四个冻结回访点、受控章节测试 open/服务器 gate | partial：全量 targets、权威状态下完整旁路联合验收尚缺 |

没有因“不切生产路由”本身判 partial；上述是实际剩余行为、覆盖或联合验证缺口。Teacher 不在本轮验收范围。

## 3. 19 Activity 与 Step completion

| Step | Activity key（逐项） | 正式必需 | 执行 / 恢复状态 |
| --- | --- | --- | --- |
| orientation | orientation-check | 是 | Native 原单选提交；选项历史恢复 partial |
| orientation | orientation-jimin-occupation | 是 | 同上，无遗漏 |
| orientation | orientation-wangming-occupation | 是 | 同上，无遗漏 |
| vocabulary | vocabulary-check | 是 | 原 grouped checker/grader、响应/反馈恢复已接，目标覆盖 partial |
| grammar | grammar-choice | 是 | 两页检查/订正/聚合/恢复已测，目标覆盖 partial |
| grammar | grammar-judgment | 是 | 两页检查/订正/聚合/恢复已测，目标覆盖 partial |
| grammar | grammar-fill | 是 | 两页检查/订正/聚合/恢复已测，目标覆盖 partial |
| patterns | pattern-choice | 是 | 四选择轮及上下文行；原最终提交/恢复已测，音频优先路径 partial |
| patterns | pattern-order | 是 | 原排序向量提交与恢复，模块顺序已测，targets partial |
| patterns | pattern-compose | 是 | 六轮拼句、原 checker/grader、完整成功响应恢复已测；targets partial |
| dialogue | dialogue-fact-check | 是 | 原单选，反馈/响应恢复，整体 targets partial |
| dialogue | dialogue-response | 是 | 原单选，反馈/响应恢复，整体 targets partial |
| dialogue | dialogue-roleplay | 是 | 复用 4A8，partial；不是改成开放文本题 |
| listen_speak | listening-identity | 是 | 两页/两轨，原提交/检查、稳定 owner、恢复已测，整体 partial |
| listen_speak | speaking-introduction | 是 | 复用 4A8，partial；跟读/full recall 不替代正式完成 |
| read_write | reading-profile | 是 | grouped 原判题/恢复；整体 partial |
| read_write | write-profile | **否** | 原开放作答、null 分数/正确性；恢复已接，整体 partial |
| review | review-multiple | 是 | 原多选、恢复、连续流程；整体 partial |
| review | self-check | **否** | 原开放自检、回访选择与恢复；不作为 chapter completion |

共 19 项，其中 17 项 `counts_toward_completion=true`。原 RPC `record_smart_textbook_attempt` / 已有 speaking、roleplay 完成服务仍决定 attempt、activity 与 node progress。Runtime 不从“进入步骤”“检查页数”“本地答完”“音频 ended”“录音上传”“repeat marker”推算 Step 完成。

UI 的“已检查”来自审计临时结果；“已完成”只读 `ServerLearningState.activityProgress`。Step navigation 完成只读 `completedStepIds`。Preview accepted 不写服务器正式完成投影。

## 4. 各学习流程与媒体证据

### Vocabulary、Grammar、Patterns

`ActivityExecutor` 只调度当前 Step 内子活动，不创建第二套全局 navigation / LearningState。顺序来自 frozen capsule（测试核对 choice→order→compose 等顺序），长期 identity 使用 activityRef / partId，不用页码或标题。

`learning-flow.server.ts → pageCheck()` 将稳定 page/items 通过 `boundPageResponse()` 转给 `checkSmartTextbookActivityPageAction`。Preview 明确去掉 pageIndex，避免写正式 page progress；生产适配器把冻结旧坐标传原服务。订正只能在已有检查之后显式请求，复用旧 `revealGrammarAnswers` 语义；不会在初始 props、Manifest 或 history 暴露答案。逐题检查结果单独保存/恢复，不把一页未全对误成每题全错。

`finishPages()` 要求每页服务状态 ready，按 frozen legacy item coordinates 汇总完整向量，拒绝缺页、重复/不连续覆盖，再调用原 `submitSmartTextbookActivityForContext`。正式判分仍由原 grader 做，不能靠客户端 passed 布尔值完成。

`patternCheck()` / `finishPattern()` 复用 `boundPatternCheck` 与原 checker/grader；错误停留、正确后延迟推进、最后整段提交。已检查轮次可在同审计 session 恢复；正式完整 attempt 可反向投影。Composition 只能从已有 token 精确还原，无法解析的历史失败关闭，不凭标题/位置猜新 ID；未完成的新中间轮次仍是临时练习状态，不伪装原数据库持久进度。

旧 `KoreanLevelOneSmartTextbook.tsx → PatternConversationPractice` 实际以 ready `audioAssetKey` 匹配音频优先，播放失败才 `speakKorean`。新执行器当前仅接可选 TTS，**尚不等价，保留 blocker**。

语法 `grammarCards` 的 3×3 示例对应九个 pending media refs。旧组件实际直接 `speakKorean(example.ko)`；`learningTools()` 同时检查 frozen example identity、metadata.script 与 Korean text，保持 browser TTS。未把 pending 资源升 ready，未制造 R2 mediaRef。此播放不进入 Teacher Grant/正式 evidence。

中文界面发现 Manifest 部分选项仅有 `ko-KR`，原 DTO helper 没有回退会显示空选项。本轮为 scoped activity 与 Native choice 补回 Korean fallback，没有修改教学数据或正确答案。

### Listening、Guided Repeat / Full recall

两条播放 owner 来自 Phase 3C `authorized-listening` / `listeningAliases`，校验 target、page、mediaRef、revision、ready 状态。`ListeningPageMedia` 只收 Blob；object key、signed URL 留在现有 Route 内部。首次加载单通道化，避免重复设置 src 使 play promise 被浏览器 abort；卸载/Step dispose 撤销 Blob、停止媒体、丢弃晚到响应。

`production-learning.server.ts` 的 audio/transcript port 重新授权后解析 private page，再调用现有 `/api/digital-textbook/audio/[activityId]` / `/api/digital-textbook/transcript/[activityId]` 的内部 GET，保留原 RLS、已发布链、字节代理。**没有给学生路由安装这个 port**。母稿只在服务端有已检查页面记录后返回；审计整页续接时 restore 重建 pageChecks 门控。

`compatibility behavior = legacy actual UI behavior`：不新增 `normalReplayLimit` / `slowReplayLimit` 限播。旧 UI 没有真正消费这些字段，本轮不能以配置为由发明产品限制。

Guided repeat 保留冻结 2 tracks / 14 segments、原 Browser TTS→practice marker→`saveGuidedRepeatProgressAction`。生产 Adapter 的 `readGuidedRepeatHistory()` 读取真实表并投影稳定 identity；mark 后可刷新权威 LearningState。Preview 仍用隔离 repeat store，不写正式表。Full recall 继续复用 4A8 RecordingRuntimeServices，不重复实现录音；实践、播放、录音均不代表正式 speaking 完成。

### Dialogue、Read/Write、Review

Dialogue 两题使用原 server grader；第三个子活动按 ref 嵌入同一 4A8 `RecordingExecutor`。Roleplay/speaking 的正式完成返回后只触发 `refresh()`，不在 UI 新建 completion。4A8 的可选 recognition、完整旧准备行为等缺口原样保留，不能因两题串起来就宣布 Roleplay equivalent。

Read/Write、Review 使用现有 `OpenActivityExecutor` 与 `boundActivityResponse`；写作 checklist、自检 returnNode 明确反向投影。开放题继续 `correct=null`、`score=null`，不增加 AI 评分。服务反馈和 response 可以恢复，未知 returnNode 拒绝。

## 5. Chapter test / return target

`learning-tools.server.ts → openLearningDestination()`：

1. 输入只有 capsuleRef 与稳定 target；拒绝外部 URL、客户端 slug 和未知 target。
2. 四个 returnMap 项通过 `content.returnMap[n]` 的**既有 frozen mapping**找到 part，再通过可信源 node_code→nodeId→Step；旧坐标只在服务器解释，不作为新 identity。
3. Review nextNode 使用既有 `chapter-test:korean-level-one-01` private binding，不塞进 Step.nextStep。
4. 打开章节测试需同时满足当前 snapshot/revision、正式全部 Step 与 17 个必需活动完成、原 `isKoreanChapterLearningCompleted` gate；目标页面自身的 assignment / sequence gate 保留。
5. 返回 URL 只有 `/dashboard/assignments/korean/korean-level-one-01` 这一闭合内部值；React 使用返回的 destination，不能任意跳转。

Owner audit 无普通学生完成身份，故真实 Owner Preview 的 chapter-test open **拒绝**。Chromium 正向测试使用明确的隔离权威完成状态验证同一 resolver/按钮跳转，并未给 Owner 伪造正式 completion；目标 assignment 页的真实 Owner 登录验收未完成。

## 6. History Reader → ServerLearningState → UI

`productionLearningPorts()` 每次 `requireActiveUser`、tenant/学习权限校验、可信 session resolver、当前 chapter/version RLS 可见性检查后调用 `createLearningHistoryReader()`。Resolver 必须来自未来服务器持有的 immutable session/source，不接受客户端自报 user/tenant/snapshot。该 production port 尚无生产 import。

| 数据 | Reader 实际来源 | 投影 | UI / 限制 |
| --- | --- | --- | --- |
| attempt / activity completion | `digital_textbook_attempts`，限定 tenant/student/version/activity IDs | 最新服务结果、成功/满足 completion 的记录；响应字段显式转换 | grouped / writing / self-check / pattern 恢复；Native 三题选项仍缺完整接线 |
| node / Step | `digital_textbook_node_progress`，限定同 owner/version/node IDs | status=completed→对应稳定 Step | Provider 更新 StepController，不本地推算 |
| activity pages | `digital_textbook_activity_page_progress`，显式 item_indices/response/results | frozen page/item ↔ stable part；保留逐题 true/false | 响应、检查结果、ready 页面恢复与原服务回传 |
| guided repeat | `digital_textbook_guided_repeat_progress`，既有 Reader | stable track/segment→practiced IDs | 原两轨14句状态，不产生 activity completion |
| recording / speaking evidence | 现有 Recording Domain Gateway scoped restore port | 闭合 RecordingPlan/Restore DTO；校验 capsule/activity/Step/block/part | consumed/expired 只表示历史 evidence，不据此推导 attempt 或完成 |

Reader 不只是接受预构造 rows：实际执行 `select/eq/in/order/limit`，隔离测试只替换数据库 transport。记录超过 1000 条时当前显式拒绝，不静默截断；未来需要安全分页。查询故障、未知页面/node/recording part、版本/会话不符均失败关闭。

`LearningStateProvider` 在提供 refresh port 时初始读取服务端状态，正式提交/repeat marker/recording completion 后重新读取。当前读取失败保留最后已验证状态；并未新建 progress 表或复制数据库。完整 native selection 恢复、所有历史 variant、全量生产服务组合的 UI 验收仍不足，属于 partial。

Preview `createLearningPracticeStore` 限 32 个 owner/session/snapshot/source/capsule scope，固定审计 TTL；恢复只使用同 owner 4A8 continuation，不继承 Teacher session/grant。不是正式 progress、重启后不保证持久，存满/过期明确拒绝。当前 flow action 的反馈 locale 固定 zh-CN，韩语审计反馈本地化仍需独立验证。

## 7. Lifecycle、stable targets 与未覆盖项

新增 `useOperationLease()` 将 Step generation 和子活动 mount 生命周期合并。仅换子活动、不换 Step 时也 abort 旧请求；晚到结果不能回写新子活动。Pattern timer 清理、录音 lifecycle 沿用已有实现；Server Action 已发出的操作不能“撤销已提交事务”，但结果不得进入失效 UI。

`RuntimeTargetRegistry.mountLearningOwner()` 仅接受当前 Step/capsule/snapshot 的闭合 owner DTO。普通 DOM handle 仍不得实现 play。原 Manifest 没有新增 play 声明；本轮用服务范围的真实学习 owner（同已有兼容 owner 分层方式），不把 TTS 说成服务器可信听完，也不修改 3D Teacher observation/grant。

已实测：九个 grammar 例句点读、两个 listening page play、四个 review return open、一个 chapter-test open，Step dispose/错误媒体/错误 target 拒绝；既有 reveal/focus/highlight 回归继续跑。

全量学习 target 扫描：当前 359 个 compat.learning 声明，分 Step 是 31 / 19 / 52 / 48 / 91 / 80 / 20 / 18。ContentCard、repeat、recording 的可见拥有者已有挂载；**活动卡/题目/句型轮次、旧 panel 与隐藏区域的全部声明并没有一一建立可揭示的 mount-time owner**。这些未建立/未验证者保持 `unsupported`，不是默认“有 stable ID 就可执行”；实际命令由 registry 拒绝 `TARGET_UNAVAILABLE`。当前没有完成 359 项逐一浏览器覆盖，这是 learning capability 不能提升的独立 blocker。

## 8. 测试与安全核验

本轮新增 27 项：18 项服务/Reader/绑定单测 + 9 项 Chromium（包含外层测试计数）。

服务测试覆盖 frozen 8/19/3/v23、六页语法/两页听力检查/订正/聚合/恢复、两种句型原服务向量、全部支持 response 的 round-trip、owner/version/session 范围、重复/未知 history、录音 DTO 检查、null 正式完成、pending grammar TTS、真实 listening binding、导航 gate、TTL/capacity、韩语-only 文案和 partial-page 逐题结果。

生产 port 协议测试实际运行授权 Reader 与 private mapping，替换的只是隔离 auth/DB/route transport；禁止意外 mutation。两个听力 page 映射到原内部 GET 的 0/1，仅 server 内部使用坐标。wrong session/snapshot/expiry/tenant、未检查母稿均拒绝。不宣称发出了真实生产音频请求。

Chromium 本轮运行：8 Step、词汇逐项/刷新、三种语法六页/九 TTS owner、句型 choice→order→compose、dialogue 两题调度、两轨听力 byte playback/母稿/刷新、reading→writing、review→self-check、回访/章节测试 gate、Step stale response。新的角色录音完整流程没有在同一 4A9 browser scenario 中重复；4A8 的真实 Chromium MediaRecorder / full recall / speaking / roleplay 与 4A3 repeat 测试作为回归运行。**不能把两套独立通过的 scenario 说成已经完成整章联合 Owner E2E**。

Browser payload 扫描排除 `answer_key`、`object_key/objectKey`、signed URL、proof、tenantId/studentId、service role；初始 DTO/Manifest/history 不含原答案。订正是旧体验已有的、检查后显式授权的学习反馈，不等于开放私密 answer_key；测试答案为隔离 synthetic secret，不读取生产答案/录音/学生 transcript。

Owner browser E2E = **未完成**。用户登录会话在用户电脑 Chrome，本环境无正常授权可用会话；未冒用 Owner、未生成 magic link、未复制 Cookie/Token。

合并回归：**739/739 通过**（既有 712 + 本轮 27），无失败、跳过、取消；包括 Phase 3A–3E、4A/4A-2/4A-3/4A-4/4A-5/4A-7/4A-8、legacy、Chromium、隔离真实 SQL rehearsal。TypeScript 与 `git diff --check` 通过。

复现命令（仅本地/隔离 harness，不部署）：

```bash
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

## 9. Remaining blockers / 停止边界

1. 所有 declared learning targets 的可达挂载/reveal/真实 owner 覆盖尚未完成；不可假装全量支持。
2. PatternConversationPractice 现有 ready audio 优先播放路径尚未接回；目前 optional TTS 不等价。
3. Native orientation 三题完整选项历史恢复及刷新后的反馈同步仍需闭合；不能因 Reader 有 attempt 就算 UI 恢复完。
4. 4A8 录音组仍是 partial（可选识别辅助、部分旧准备行为及全模块历史联合验收），本轮未重做它；未将其冒充 implemented。
5. 完整真实授权 Session Resolver 安装、全领域服务组合与权威 persisted state 的整章旁路验收未完成。生产 port 不启用；Owner E2E 未完成。
6. History 当前 >1000 attempts 失败关闭，尚无分页；partial/旧变体不能安全还原时仍拒绝。审计反馈语言仍需补齐。

本轮不降低 readiness 标准；未修改 production migration / gate / caller / 学生路由，未删除 legacy、未开展 Teacher 收口、未进入 Phase 4B。
