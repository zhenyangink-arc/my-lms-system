# Phase 4A-10：学习侧恢复、媒体与 target 核验

核验日期：2026-09-10。范围为第一章学习侧；本轮未进入 Teacher 或 Phase 4B。

## 结论

**本轮没有达到 compat.learning.v1 全部收口。** 已实现安全历史分页、三道原生选择题恢复、具体的服务器学习会话解析器、句型音频服务及全量 target 审计；新增整章隔离历史恢复 Chromium 场景。但全量 target 仍有 223 个未取得完整执行证据，严格 LessonRuntime 仍拒绝第一章学习侧激活。不得将“测试通过”解释成“所有产品能力完成”。

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

基线为仓库 Phase 3A–3E、4A/FINAL/4A3–4A9 报告及实际代码。第一章仍为 8 Step、19 Activity（17 必需、2 可选）、orientation 三题、published v23 legacy。没有重写 Manifest、稳定 ID、3D TTS observation 或 3E speech selector。仓库已有大量前阶段未提交内容；本报告不把这些已有差异认作本轮新增。

## 1. Target 359 全量分类

新增 `src/features/smart-textbook-runtime/core/target-coverage.ts → auditLearningTargets()`，枚举 Manifest 全部 compat.learning targets，而不是只统计 DOM 命中。

全量逐 target 明细在 [SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A10_TARGET_COVERAGE.json](SMART_TEXTBOOK_RUNTIME_V1_PHASE_4A10_TARGET_COVERAGE.json)：359 行，每行包含完整稳定地址、Step/part、类别、缺失命令、重复 owner、见证状态。它是本轮 Chromium 实际观察结果，不是手工填的完成名单。

| Step | 总数 | mounted-owner | mount-on-reveal | commandless-identity | optional-hidden | invalid | unsupported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| orientation | 31 | 24 | 0 | 0 | 0 | 0 | 7 |
| vocabulary | 19 | 16 | 0 | 0 | 0 | 0 | 3 |
| grammar | 52 | 16 | 0 | 0 | 0 | 0 | 36 |
| patterns | 48 | 13 | 0 | 0 | 0 | 0 | 35 |
| dialogue | 91 | 12 | 13 | 0 | 0 | 0 | 66 |
| listen_speak | 80 | 28 | 1 | 0 | 0 | 0 | 51 |
| read_write | 20 | 8 | 0 | 0 | 0 | 0 | 12 |
| review | 18 | 5 | 0 | 0 | 0 | 0 | 13 |
| 合计 | 359 | 122 | 14 | 0 | 0 | 0 | 223 |

自动状态遍历：8 Step、每个实际子活动、已有题目定位/分页、roleplay 全场景/左右角色/每个学生轮次。通过真实导航生成合法挂载状态，不永久挂载全部隐藏内容。Runtime registry 只提供只读 `mountedTargets()`；测试使用真实 `command()`，检查 focus 的 activeElement、highlight 标记和 reveal 可见区域。DOM 检查仅在测试中，未变成 Runtime identity/selector。

`mount-on-reveal` 表示在后续合法 UI 状态下已实测的 owner；不表示已为每个 target 实现通用的懒挂载命令代理。**Auditor 尚未为所有剩余条件内容生成状态和 owner。** `unsupported` 是未获得完整证明，不断言这些目标永远不可达，也不是因为初始页面没显示就自动判失败。后续不能用静态显示投影或手填 witness 将其转绿。

## 2. Required target 阻断

```ini
required unsupported target = 223
duplicate owner = 0
dangling command capability = 877
unknown observation = 0
```

877 是逐 target 缺失命令总数，不是 877 个目标。当前 target 无显式 optional 标志，因此不能把有命令的未覆盖目标解释为 optional-hidden。导航返回/章节测试 open 的正式完成授权未在本轮全量 target 场景中伪造；相关目标仍缺见证，既有 4A9 导航独立测试不冒充本场景覆盖。

## 3. Pattern audio parity

旧链证据：`KoreanLevelOneSmartTextbook.tsx → PatternConversationPractice`，由当前 step 的 `audioAssetKey` 查 ready `audioAssets`，Audio 播放失败才 `speakKorean()`；`smart-digital-textbook.ts:426` 不为非 ready 媒体签 URL。

本轮重新核对**冻结样本**：8 个 guided-conversation-line 均有私有对象路径，但 `production_status=pending`，Manifest 也为 pending。不能把“存在 object key”推定为 ready。本轮未对生产数据库执行新的 SELECT，故不将冻结样本状态宣称为此刻线上状态。

新增：

- `server/pattern-media.server.ts → resolvePatternMedia()`：capsule → pattern-choice → frozen turn identity → 配置中的精确 audioAssetKey → 唯一 media metadata / 私有 binding → revision/access/type/ready 校验。
- `patternAudioBytes()`：复用现有 R2 签名 helper，签名地址留在服务器，拒绝 redirect、非音频、空文件和超过 10 MiB 的内容，只返回 Blob。
- `/api/smart-textbook-runtime-audit/pattern-audio`：正常 platform_owner guard、会话 owner/TTL、snapshot、重复/未知参数校验，private/no-store 字节响应。
- `PatternExecutor`：服务返回 ready bytes 后 Audio；无 ready 字节或播放失败才既有 Browser TTS；turn/Step/unmount 中 abort、pause、revoke Blob、取消 TTS，晚到结果不播放。
- 同一 `PatternServices.audio` 安装到 owner 旁路与未挂载的 production service port。React 不认识存储路径。

Frozen activity turn identity 与 Manifest target 不等同：当前部分 conversation turn 没有 target 声明，服务按冻结活动身份解析，不新增 play target。

验证：八条 pending 必须返回 null；单独的**合成 ready 契约样本**验证八条映射、字节返回、MIME/容量拒绝。Chromium 验证真实冻结 pending→TTS、媒体服务失败→TTS。**ready Audio 成功/失败及 Blob 释放尚未完成同一整章 Chromium 正向验收**，不把服务器单测冒充该项完成。

## 4. Orientation 三题 restore

`server/native-choice-history.server.ts → restoreNativeChoice()` 按 frozen `options[n]` ledger 解释旧整数，再映射到稳定 optionId。不是读取当前 presentation 数组第 n 项。拒绝负数、越界、字符串/null、重复 path/part、重复 option 和映射不完整；presentation 重排不改变恢复身份。

`learning-history.server.ts` 给三道 native choice 输出闭合 `selectedOptionId` 和对应 attempt 反馈。`MultipleChoiceBlock` 在首次载入和服务端刷新后恢复选中态，保留尚未提交的本地 draft，不把进入 Step 当作完成。

旧 loader `smart-digital-textbook.ts:633–639` 仅加载 qualifying attempts。新恢复选择最新 qualifying response；无 qualifying 时可以恢复最新未通过 response，仍不宣称完成。Native feedback 与所恢复的同一 attempt 配对，避免晚一次错误反馈套到早一次正确答案。其他复合活动继续区分最新反馈和最新 qualifying response。时间相同由稳定 id 提供确定顺序；不依赖 transport 返回数组的偶然顺序。

三题全部通过真实 Reader→React 的两次 full page reload 检查：选中稳定 ID、反馈、第几次作答均恢复；完成仍来自权威 projection，不从 radio 推算。

## 5. Recording-group integrated result

保留 4A8 的 RecordingRuntimeServices、controller、preview-isolated backend 与生产 Gateway port，没有另造录音或证据系统。

本轮整章场景增加：roleplay 全场景/角色/轮次历史 evidence 恢复、已消费录音的授权合成字节回听恢复、speaking-introduction 录音状态、full recall / guided repeat 与 listening Step 同挂载。为旁路 roleplay 的场景 select 补充准确可访问名称，没有改角色规则。

**仍未完成**“在同一次 mount 内重新录音→证据→两个原 completion 服务→正式 refresh”的联合验收。本轮综合历史场景只有 SELECT/恢复端口；写入被明确拒绝。此前 4A8 各自完整录音场景与 4A7 SQL 事务 rehearsal 继续通过，但不能相加后宣称本项全链已通过。该项仍 blocking。

## 6. Runtime Session Resolver

新增 `server/learning-session.server.ts → createRuntimeLearningSessionResolver()`，不是只有未来回调类型：

1. `issue()` 使用正常 `requireActiveUser`、tenant/学习权限、现有只读第一章 Reader/Adapter/finalizer、RLS chapter/version 查询。
2. 从 scoped `digital_textbook_preferences.interface_locale` 取得受支持的 zh-CN/ko-KR；默认 zh-CN。
3. 服务器保存 user/tenant/textbook/version/chapter/snapshot/source revision/private bindings/locale/30 分钟 TTL；最多 32 个会话，过期清理。
4. 客户端仅取得 opaque `learning-session-<UUID>`；`resolve()` 严格仅接受 sessionRef，拒绝附加 identity、version、source 或 activity UUID。
5. 每次 resolve 重做正常认证、实际源编译和 chapter 可见性，并比较所有 scope/revision；过期、跨账号、跨 tenant、源变化都拒绝。`revoke()` 先认证再撤销。

这是单进程旁路服务，不是生产分布式会话存储；切实例/进程丢会话时 fail closed。不是第二套 Agent session。具体 resolver 已在隔离 auth/DB transport 中实际接通 `createLearningHistoryReader()`；没有学生 Route 安装它。

限制：现有 productionLearningPorts 的全领域调用安装仍未由它统一接管，旧旁路活动服务形态仍包含既有 activityRef。**不声称已经完成所有新 Runtime 请求只携带 opaque session/stable target 的统一远程边界。** 本轮不修改既有 Manifest UUID 身份来规避此问题。

## 7. Full ServerLearningState restore

`tests/fixtures/runtime-4a10.mjs` 构造明确隔离的 learner persisted rows，覆盖全部 19 Activity（含两个 optional）、8 node progress、grammar/listening 八页、patterns、14 repeat segment、speaking/role/full-recall gateway 恢复 DTO。不是读取真实学生数据，也不是仅把预造 ServerLearningState 塞入组件。

实际链：normal-auth 合成 transport → **具体 Session Resolver** → **真实 SELECT Reader + keyset** → private mappings → ServerLearningState / capsule restore → 现有 RuntimeClassroom / providers / renderers → 8 Step UI → full reload。

Chromium 使用同一 mount 遍历全部 Step/活动并刷新，再核对页位置、三题选择、反馈、记录恢复；全部 schema/payload 校验仍在。node progress 清空的负例证明活动/证据存在也不会产生 completedStepIds。Consumed evidence 不变成新的 completion。

**严格 LessonRuntime 正向整章恢复未完成**：学习 capability 仍不足。因此上面是同一真实 renderer 的 diagnostic 路径，不是严格激活通过，更不是正常登录 owner E2E。`owner browser E2E = 未完成`；没有借用账号、magic link 或转移 Cookie。

## 8. History pagination

`server/history-pagination.server.ts → readAttemptHistory()`：

- SELECT-only、tenant/student/version/activity scope，默认每页 250，总上限 20,000。
- `(created_at,id)` keyset，按 PostgreSQL 微秒精度比较；不使用 offset，不以 attempt 数组下标做 identity。
- 开始固定最大坐标；扫描前后用同一上界的 exact count。新记录高于上界留给下次 refresh；旧事务晚提交在游标之前时计数变化→本次失败重试，不能漏行后返回成功。
- 重复 ID、非单调/越界 transport、未知 count、读取错误、超过 cap、AbortSignal 均拒绝。恰好满页继续读取以确认结束，不以满页推测全部完成。
- 这是 immutable attempt 领域上的一致性检查，不是跨 HTTP 请求的 MVCC 快照；不保证特权后台在扫描期间删除/修改旧 attempt 且保持计数不变的情形。没有为此创建 DB RPC 或修改生产 schema。

隔离测试覆盖 1201 行、相同时间的复合游标、重复、总上限、非法坐标、取消、上界后追加以及游标前晚提交拒绝。正式 Step completion 仍由 node progress 决定。

## 9. Locale

History feedback 使用可信 authority.locale，ko-KR 的真实 Reader 路径已测试。Owner preview 只接受 zh-CN/ko-KR 的偏好，服务器创建 session 时冻结为 learningLocale，RuntimeContext 与之相同；`auditLearningFlow` 和原生/复合 auditSubmit 使用会话 locale，不再固定 zh-CN 或将任意客户端 locale 注入 grader。

相关文件：`audit-session.server.ts`、`audit-flow.server.ts`、`audit-actions.ts`、现有 owner `runtime-v1-preview/page.tsx`。没有更改答案或评分函数。未进行真实 owner 浏览器切换语言 E2E。

## 10. Strict learning Runtime activation

`LessonRuntime validationMode="learning"` → `validateLearningActivation()`。仅将 compat.teacher.v1 从本模式的 unsupported 检查中豁免；其它 capability 一律继续校验。RegionRenderer 也只省略该具体类型，不能将 Teaching Region 里的其它 Block 整体吞掉。

Chromium 实际请求 learning-strict 后得到拒绝激活，且无 Step navigation。这是**预期阻断通过的负例**，不是第一章正向激活通过。未修改 Registry 的 compat.learning/teacher 状态，没有 fake Renderer。

## 11. 8 Step 最终对照

| Step | 已验证内容/恢复 | 最终状态 | blocking 差异 |
| --- | --- | --- | --- |
| orientation | 三题稳定选择、原 grader 既有测试、feedback/attempt/reload | partial | Step 内 7 个 target 尚缺完整证据；三题 restore 子项已通过 |
| vocabulary | 词汇、整组题、逐题答案/反馈与恢复 | partial | 3 targets |
| grammar | 三类活动六页、订正/聚合、恢复、原例句 TTS | partial | 36 targets |
| patterns | 三流程/最终提交既有回归、历史向量；新增授权音频分支 | partial | 35 targets；ready Audio Chromium 正向验收 |
| dialogue | 两题、role 全场景/角色/轮次历史与 owner 遍历 | partial | 66 targets；录音→completion→refresh 综合场景 |
| listen_speak | 两听力页、2 tracks/14 segments、speaking/full-recall 恢复 | partial | 51 targets；录音组完整联合场景 |
| read_write | 阅读/optional 写作响应与反馈恢复 | partial | 12 targets |
| review | 多选/optional 自检/回访既有服务与恢复 | partial | 13 targets；本次 auditor 未补正式授权 open 见证 |

这些 partial 均明确 blocking，所以没有提升整个 learning capability。

## 12. 19 Activity 状态

| Activity | 领域/恢复证据 | 全能力状态 |
| --- | --- | --- |
| orientation-check | 原 submit 回归 + native restore/reload | restore equivalent；受 Step target 总门禁限制 |
| orientation-jimin-occupation | 同上，独立选项映射 | 同上 |
| orientation-wangming-occupation | 同上，独立选项映射 | 同上 |
| vocabulary-check | 原 grader、整组响应、Reader/逐卡恢复 | partial：required targets |
| grammar-choice | 两页检查/订正/聚合/恢复 | partial：required targets |
| grammar-judgment | 两页检查/订正/聚合/恢复 | partial：required targets |
| grammar-fill | 两页检查/订正/聚合/恢复 | partial：required targets |
| pattern-choice | 旧连续流/原提交、冻结向量、音频 binding | partial：targets/媒体正向浏览器 |
| pattern-order | 原 ordering 提交与向量恢复 | partial：targets |
| pattern-compose | 原 composition 提交与 token 恢复 | partial：targets |
| dialogue-fact-check | 原 submit 与响应/反馈恢复 | partial：targets |
| dialogue-response | 原 submit 与响应/反馈恢复 | partial：targets |
| dialogue-roleplay | 4A8 完整独立场景、4A7 atomic 回归、本轮多状态恢复 | partial：综合 completion/refresh 与 targets |
| listening-identity | 两轨/两页/检查后 transcript/聚合及恢复 | partial：targets/整组验收 |
| speaking-introduction | 4A8 独立流程、本轮 consumed evidence/UI 恢复 | partial：综合 completion/refresh 与 targets |
| reading-profile | 原提交、全部题响应/反馈恢复 | partial：targets |
| write-profile（optional） | 原开放题、信息项/确认/文本恢复 | partial：targets；不是第 18 个必需活动 |
| review-multiple | 原多选提交、响应/反馈恢复 | partial：targets |
| self-check（optional） | 原 checks/returnNode/note 恢复 | partial：targets；不是第 19 个必需活动 |

17 required 判定仍来自原 counts_toward_completion；不因为本轮 19 行都有样本就宣称 17 required 全部验收通过。

## 13. Blocking / non-blocking

仍阻断：223 targets 的真实 owner/合法状态/命令证明；recording 两个模块与正式 refresh 的整章联合验收；严格 LessonRuntime + 全领域 production ports 的具体 session 安装；ready Pattern Audio 的组件浏览器正向/释放验证。

非阻断差异有代码证据的仅限 optional SpeechRecognition：旧 `KoreanLevelOneSmartTextbook.tsx:2889–2969` 在识别缺失/失败后仍录音上传，等待识别最多 2500ms；`completeDialogueRoleplayAction:121–148` 检查 required evidence coverage，不以 recognition 匹配判分。v2 gateway/SQL 回归亦按 evidence/turn coverage。没有 recognition helper 可以作为非权威辅助差异，但绝不能把录音、必需轮次或消费事务也降级为 optional。

## 14. learningCapabilityReadiness

新增 `core/learning-readiness.ts → learningCapabilityReadiness()`，综合 Manifest/实际 Renderer Registry、target 报告、required activity 列表、绑定同一 snapshot 的测试证据（pattern/audio、native restore、recording integration、分页、session、full restore、server authority、lifecycle），输出可定位 blockers。

缺失、重复、失败、过期 snapshot 或无测试来源的证据均不能视为 passed。该函数是报告计算工具，不是允许客户端提交 readiness=true 的授权接口。当前至少会返回 `learning.targets`、`renderer:compat.learning.v1` 及未完成联合验证项；输入空证据时的拒绝已测。

## 15–17. Capability / Runtime 状态

```ini
compat.learning.v1 = unsupported
compat.teacher.v1 = unsupported
runtimeReady = false
```

可执行注册表仍只有 layout.v1、navigation.linear.v1、progress.server.v1、block.text、block.multiple_choice。未进入 Teacher 收口，未接新学生页面。nonUiRuntimeReady=true 是继承且重新回归的 3E 非 UI 结论，不代表本轮 renderer 通过。

## 18. 文件、测试与生产保护

主要新增：

- `server/history-pagination.server.ts`、`native-choice-history.server.ts`、`learning-session.server.ts`、`pattern-media.server.ts`。
- `core/target-coverage.ts`、`learning-readiness.ts`。
- owner-only `src/app/api/smart-textbook-runtime-audit/pattern-audio/route.ts`。
- `tests/fixtures/history-db.mjs`、`runtime-4a10.mjs`、两个 `tests/smart-textbook-runtime-4a10*.test.mjs`。
- 本报告及全量 target JSON。其余修改限于旁路 Runtime 相关组件/服务、现有 owner 审计页、测试 transport；旧学生 Shell/ContentRenderer/录音 Route/Agent 状态机未修改。

本轮新增 **12 个非浏览器测试 + 4 个 Chromium 子场景及其父测试 = 17 项**。合并总计 **756/756 passed，0 failed / skipped / cancelled**；包含 Phase 3A–3E、4A/2/3/4/5/7/8/9、legacy 和本轮。真实隔离 PostgreSQL 4A5 原子事务/并发/rollback、4A7 coordinated rehearsal 随回归执行，未接生产数据库或真实录音对象。正常 owner E2E 未完成。

执行命令：

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

浏览器回传 payload 扫描无 answer_key/object_key/objectKey/signedUrl/tenantId/studentId/service_role/proof；录音恢复只用授权合成音频字节。没有生成/安装真实 proof key，没有上传或删除学生录音，没有 DB migration/schema/data 修改，没有打开 v2 gate。新旁路音频路由会在部署后供 owner 访问；**本轮未部署应用**。

自审：8 Step/19 Activity/三道 orientation/v23 测试不变；3E selector、3D observation 回归通过；全部 359 targets 明细真实存在；未将 pending 媒体改为 ready；未将 diagnostic 场景冒充严格激活；未将 optional helper 与正式 completion 混淆。无 production caller/学生路由切换。

到此停止。下一步需用户另行确定剩余学习阻断的处理范围；不自动进入 Teacher 或 Phase 4B。
