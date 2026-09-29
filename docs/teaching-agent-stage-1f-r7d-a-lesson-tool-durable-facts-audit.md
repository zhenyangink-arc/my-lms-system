# R7D-A — Lesson Tool ↔ Durable Runtime Facts

## 1 Result and Scope

**READY FOR R7D IMPLEMENTATION。** 本轮完成源码/合同审计、fresh current-DB authority只读复核、现有工具隔离单元测试、最小接口设计和精确实施计划。没有实现新产品工具、没有部署，因此不是“已完成Lesson Tool current-DB integration”。

UPLY Teaching Agent / AI韩语教师助手主线保持：Teaching Script → LessonRuntime → Durable Facts → Lesson Tool → Skill/Tool Binding → Teaching Agent。B1/B2/B3 COMPLETE，B3 Current DB Durable E2E PASS；数据保留。本轮DB业务写入0、Agent Runs0、Provider0、Publish0、Pins0、Feature OFF、Allowlists EMPTY、B3 scope DISABLED、Stage1G NOT READY。

## 2 Existing Architecture

| 实现 | 当前合同 | 本阶段差距 |
| --- | --- | --- |
| agent-core ToolRegistration/ToolResult | 版本化定义、Zod输入/输出、权限、timeout、结果大小限制 | 可直接复用，不另造Tool框架 |
| get_current_lesson_context@1.0.0 | 已发布、绑定选句/目标；输入lessonRef+segmentRef | 没有Activity/attempt/progress |
| get_current_teaching_state@1.0.0 | last_saved_teaching_position；严格空输入 | 不是视觉current，也不是Activity completion |
| CurrentLessonReadPort/TeachingStateReadPort | revalidate已授权selection、sourceRevision和来源 | 依赖published-only、active student和WeakMap签发binding |
| Student Tool/Skill registries | request-local两个工具、一个explain Skill；全局Core registry空 | 未注册durable facts工具 |
| createDurableActivityCompletion | private readRows验证 + independent readback + activity-completion/2 | 需要从同一已验证snapshot导出受限summary |
| createRuntimeFactsReadPort | lesson-runtime-facts/1，绑定/观察/cue state + receipt evidence | React owner依赖，不能直接作为服务器fresh authority |

Tool是受控Agent能力；API是运输入口；Domain Port是域读取边界。Skill包含procedure/context/tool/evidence/output合同，不是单纯prompt；冻结Script是教学内容，不是Skill。Runtime事实属于Domain evidence，不是Agent memory。

实际源码路径和SHA见 `r7d-lesson-tool-architecture-audit.json`。已读Next本地data-security与server/client指南；不修改生产源码。

## 3 Durable Authority and Fresh Database Audit

2026-09-17T13:57:15.472318Z的新独立READ ONLY连接确认：当前existing B2 actor绑定正确、banned、inactive、membership suspended/non-default，sessions0、refresh0；B1 canonical1/1/1、R6F freeze MATCH，B3 scope disabled，两条dispatch claim保留。

Attempt1 incorrect、attempt2 correct；node_progress唯一一行为completed、completion100、mastery100、attempt_count2；activity_page_progress0。progress xmin与B3最后记录一致。线上Build仍为KaSWaVYOIk7ZjWGpvVWIf，35个部署文件hash MATCH。

这是**DB authority只读审计PASS**。不是通过新Lesson Tool取得的验收结果；**Current DB Lesson Tool Validation: NOT EXECUTED**。B3旧receipt只作历史证据，不作此次fresh completion authority。

正式completion检查必须继续复用现有readRows：身份/版本/node绑定、definition匹配、attempt sequence与binding、progress count/status/percent一致。本target继续采用two-attempt-development严格政策：第一错、第二对、count2、completed100/mastery100。不能推广“必须两次”到其它课程，也不能因progress行存在就输出完成。

Source content revision、student evidence digest/sequence、client generation是三个不同概念。state digest和时间/sequence不是CAS revision。旧attempt时间可以保留；freshness要求的是本次新读取的observedAt，不是强迫旧完成事实不断更新。

## 4 Current Position Is Not Completion

客户端facts的currentTeachingNode目前固定取manifest Node5，completion取completedCueIds，position来自media observation。这些值可供呈现，但不作为新server Tool的durable authority。Node7是Activity语义来源，digital textbook node是执行绑定，二者都不能被命名成已证明的“学生此刻所在节点”。

新DTO明确提供sourceTeachingNodeRef和executionNodeRef；没有独立权威cursor时currentTeachingNode=null、currentPositionAvailability=unavailable，结果可为partial，同时durable completion仍可单独验证。不得用旧Runtime、布局或journal补造当前位置。

## 5 Proposed Minimal Tool Contract

建议在**现有Tool框架**加入 `get_current_lesson_execution_facts@1.0.0`：riskLevel0，12秒timeout，16KiB输出上限，权限 `teaching.execution.self.read`（待实现政策中正式定义）。它读取不同的受控事实，不替换现有选句工具，不添加legacy fallback。

模型输入为strict空对象 `{}`；拒绝actor/tenant/lesson/activity/version/DB配置以及额外字段。target不由模型选择。服务端从已验证上下文绑定tenant、subject、lesson、Script/Textbook版本、Activity、execution node、freeze/snapshot及期限；对象结构或UUID本身不是授权。

输出沿用ToolResult外壳、现有opaque ta1 refs、bounded DTO及activity-completion/2证据。最小字段为lesson/title/version/content binding、source node/execution node、Activity alias/ref、completionStatus、attemptCount、latestResult、nodeProgress status/percent/mastery/count、evidence/storage/asOf/revision。不能spread底层repository数据。

成功结果和receipt/metrics必须来自**同一个已验证READ ONLY snapshot**。不能先取一个receipt、再无验证读取第二组progress拼接；不能重新手写一份completion布尔算法。

错误映射复用现有合同：未授权/错误身份为not_found_or_not_visible；revision/binding漂移为stale；读取失败、数据矛盾、UNKNOWN receipt为unavailable/READ_UNAVAILABLE。UNKNOWN receipt中的attemptNumber0不是已证实空基线，不得输出假零次attempt。

## 6 Development and Production Authorization

现有VerifiedStudentBinding由WeakMap签发，StudentPolicy要求active学生及published内容。B2 actor和Draft教材被拒绝是正确行为，不是要修的缺陷。

未来production调用必须来自正式已验证Agent Run context。本阶段direct Tool test不创建Run；使用独立只读audit capability，受正常Platform Owner operator和固定development环境/DB/subject校验保护。Owner只执行审计授权，不能变成student/subject。生产composition不加载development issuer。不得伪造StudentBinding、Owner JWT或调用Run coordinator来获得测试身份。

Development read capability不激活B3 write scope，不修改B3 config/journal。签发和readback权限应单独清晰实现；这是本轮选择先锁定合同而没有直接把B3 actor塞进旧Student Tool的原因。

## 7 Evidence and Mandatory Lesson Tool Gate

保留wire来源区别：CURRENT_DEVELOPMENT_DB、isolated-test-db（ISOLATED_TEST_DB语义）、isolated-fixture。current来源必须由固定server transport/DB identity保证，不能仅凭字符串或fixture标签。模型不能选择或改写来源。

默认每次Tool调用新READ ONLY事务，不使用B3内存、旧POST或scenario journal作为truth。建议server observation最大年龄30秒，并限定在此次调用时间范围内；超过deadline、授权失效、scope/content/state不一致均fail closed。该30秒是拟定合同，尚未产品实现。

未来Tool execution receipt继续采用现有private ledger模式，绑定run/skill/model/tool call、精确Tool version、scope/snapshot/state refs、storage和asOf，model supplied refs不能满足证据门槛。本轮不写任何Run或Tool persistence事件。

Explain Skill目前强制get_current_lesson_context的选句证据，state可选。新增durable evidence不能取代解释原句所需证据；未来要讨论完成状态的Skill再显式增加durable Tool evidence要求。本轮Skill/Profile/registry不修改。

Planning审计通过：studentPlanningContext只携带已验证refs/revision/locales，不注入权威原句或“学生已完成”的句子；coordinator首次toolChoice=auto，缺Lesson evidence不能completed。仅查看源码，没有执行coordinator或Provider。

## 8 Private Answer Boundary

existing repository在server内部读取secret以验证definition是允许的；Tool只接收read port的安全投影。权限最小化到read/evidenceStorage，不暴露submit、checkpoint、restore、play或SQL。DB只读事务作为额外保护。

输出禁止private answer、secret row、private definition digest、可逆答案hash、raw response、Actor/Tenant UUID、PII、凭据；允许correct/incorrect分类及mastery。当前B3的公开边界证据保留，新Tool leakage tests尚未执行，不能将设计PASS写成新工具生产扫描PASS。

## 9 Tests and Current-DB Acceptance Plan

实际运行existing Student Tool/Core/Domain Port合成测试：**55 PASS、0 FAIL、1 SKIP**。fetch被测试替身全面拒绝且确认调用0；没有Provider，没有正式Agent Run，没有DB写入。跳过项是可选隔离PostgreSQL测试。该结果验证现有基础设施，不代表新Tool已实现。

`r7d-negative-test-plan.json`列出20项计划：wrong tenant/actor/lesson/Activity/version、missing progress、sequence/count冲突、无correct但progress completed、correct但progress incomplete、mastery冲突、read failure、stale、fixture冒充current、secret leakage、模型任意ID、复制授权handle、UNKNOWN假零次、旧完成新读取、缓存receipt冒充fresh、current cursor缺失。仅使用隔离read-port override/内存数据，不修改canonical内容。

后续current-DB验收：只读绑定existing B2 subject → 直接Core executor/Tool → 新Domain Port → existing trusted repository/readRows → same-snapshot DTO → 新独立DB读核对2 attempts/completed100/mastery100/CURRENT_DEVELOPMENT_DB → 比较前后fingerprints。整个验收业务写0；不执行B3 wrong/correct、cleanup、scope activation或Run。若需要live Owner入口，先完成候选并单独请求部署批准。

## 10 Exact Implementation Plan

拟修改：

- `src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts`：提取复用现有validated read/projection，保持原submit/readback行为。
- `src/features/teaching-agent/server/domain-ports/index.ts`：增加受限facts只读接口。
- `src/features/teaching-agent/server/tools/contracts.ts`：增加精确输入/输出schema。

拟新增：

- `src/features/teaching-agent/server/domain-ports/lesson-execution-facts-binding.ts`
- `src/features/teaching-agent/server/domain-ports/lesson-execution-facts-read-port.ts`
- `src/features/teaching-agent/server/tools/get-current-lesson-execution-facts.ts`
- `src/features/development-execution/server/lesson-facts-readonly.server.ts`

拟测试：`tests/teaching-agent-r7d-lesson-facts.test.mjs`、`tests/teaching-agent-r7d-lesson-tool.test.mjs`、`tests/teaching-agent-r7d-evidence.test.mjs`、`tests/fixtures/teaching-agent-r7d/readonly-fixture.mjs`。

实施顺序为共享一致性校验 → bounded单snapshot投影 → read authority/Domain Port → existing ToolRegistration/Core executor测试composition → negative/regression/type/lint/build → current-DB Tool验收。新Tool暂不进入正式Student registry，未来Skill/Run接线独立处理。无新Runtime/Manifest/Activity/Progress/Tool框架，无migration/package/Auth/RLS/StudentPolicy变化。

## 11 Stop State

本轮仅docs/evidence和只读审计harness落盘，产品源码0修改、live源码hash不变、部署0、B3 private scope DISABLED。没有候选build，不生成虚假的Deploy Approval包。**R7D-A Deploy Approval: NOT REQUIRED for this audit**。

结论：READY FOR R7D IMPLEMENTATION；不是READY FOR DEPLOY，也不是Lesson Tool current-DB PASS。B1/B2/B3 COMPLETE；Agent0/Provider0/Feature OFF/Allowlists EMPTY/Stage1G NOT READY。到此停止。


## 12 R7D-B Implementation — Historical Audit Preserved

本节追加 R7D-B 实施结果，保留以上 R7D-A 只读审计及 B1/B2/B3 历史结论。主线仍为 UPLY Teaching Agent：本阶段建立受控的持久事实读取能力，Agent/Provider 均未运行。

**Overall: READY FOR R7D TOOL DEPLOY APPROVAL。** 新 Tool `get_current_lesson_execution_facts@1.0.0` 已实现；current-DB Tool 验收尚未执行。部署需要本次独立 Approval R7D-B Deploy，当前没有部署授权，也没有执行部署。

## 13 R7D-B Tool and Domain Port

复用 agent-core ToolRegistration、ToolResult、Zod、request-local registry、PermissionPolicy 和 Core executor。输入 strict `{}`，额外 actor/tenant/target/DB/source 字段被 Core 拒绝；risk 0、permission `teaching.execution.self.read`、timeout 12 秒、max output 16 KiB。现有权限接口无需新增全局权限注册表。

新 Domain Port 调用共享 `readDurableActivityFacts`。原 `readRows` 校验被提取复用，原 submit/readback/restore、grader、repository、RPC、进度模型和判定条件保持原行为。返回 attempt、progress、completion、receipt、revision、asOf 只来自一次 READ ONLY REPEATABLE READ repository snapshot。授权安全复核可以单独读取，但不拼入返回的学习事实。

Issuer-local WeakMap 持有不可序列化授权 handle，绑定服务器 domain/content/snapshot 和精确 authority 引用、run/skill correlation、deadline。每次调用前后重新检查授权；请求 nonce 和时间边界拒绝缓存 receipt。最大 observation age 30 秒，Core timeout 12 秒优先终止调用。旧 completedAt 可以保留，observedAt 必须来自本次读取。

UNKNOWN 或不一致事实返回 unavailable，不输出假零次。错误 subject/tenant 为 not_found_or_not_visible，binding/revision 漂移为 stale；具体错误码沿用 READ_UNAVAILABLE。当前 fixed development target 使用现有 two-attempt-development 策略；没有把“两次作答”变成全平台完成规则。

## 14 Development Read Capability and Output Boundary

正常 Platform Owner 仅为审计操作者，B2 actor 是固定读取 subject。没有伪造 VerifiedStudentBinding、Student JWT 或正式 Agent Run，没有调用 Run coordinator。Core 所需 correlation IDs 仅存在本次内存调用，没有持久 Agent/Skill/ModelCall 记录。

Development composition 使用既有固定 cwd/runtime hash、DB identity、Auth origin 校验和 actor safety READ；要求 B3 disabled marker。复用 actor 安全检查时仅传入 DISABLED 校验对象，不调用 B3 scope issuer、不写 approval/journal、不激活 scope。生产 Student/Agent registries、StudentPolicy、RLS、Auth、Skill、planning prompt 均未修改。

DTO 仅输出 opaque refs、正确/错误分类、次数、进度、mastery 和安全来源证据；无 raw actor/tenant UUID、答案、secret row、private definition digest、原始 response 或凭据。`currentTeachingNode=null`、`currentPositionAvailability=unavailable`，同时提供 sourceTeachingNodeRef/executionNodeRef；活动完成不等于当前位置已知，因此 ToolResult/completeness 为 partial。

CURRENT_DEVELOPMENT_DB 来源只能由固定 currentDatabaseTransport 构成；真实隔离 PostgreSQL 保持 isolated-test-db。activity-completion/1 isolated-fixture 被明确拒绝为非 durable evidence。单元测试的 read override 是合同模拟，不宣称真实 DB 来源。

原 Explain Skill 的 get_current_lesson_context mandatory evidence 不变。新 evidenceRefs 表达 durable activity completion；未来涉及 completion/mastery 的 Skill 和正式 ledger 接线另做。本阶段不注册生产 Tool，不生成 completed Agent Run。

## 15 Exact R7D-B Product Scope

原计划修改三个文件：

- `src/features/smart-textbook-runtime/server/durable-activity-completion.server.ts`
- `src/features/teaching-agent/server/domain-ports/index.ts`
- `src/features/teaching-agent/server/tools/contracts.ts`

新增五个文件：

- `src/features/teaching-agent/server/domain-ports/lesson-execution-facts-binding.ts`
- `src/features/teaching-agent/server/domain-ports/lesson-execution-facts-read-port.ts`
- `src/features/teaching-agent/server/tools/get-current-lesson-execution-facts.ts`
- `src/features/development-execution/server/lesson-facts-readonly.server.ts`
- `src/app/[space]/dashboard/admin/development-execution/lesson-facts/page.tsx`

第八个产品文件是极简 Owner 只读 server page，实施前已记录 scope-extension.json。现有部署没有能够使用正常 Owner session 调用新 read capability 的入口；此页面提供正式验收入口，避免 CLI 模拟 Owner。无导航链接、可编辑身份、按钮或业务写入。普通生产环境受固定 server environment contract fail closed；不是 Student registry 入口。

## 16 R7D-B Validation

新增 **49 PASS / 0 FAIL**，包括全部要求的负向类别、Core strict input、复制 handle/authority、来源伪装、UNKNOWN 假零次、旧完成 fresh read、缓存 receipt、current cursor unavailable，以及真实 owned isolated PostgreSQL 经 Core → Tool → Domain Port 的 single-snapshot 验收。该隔离验收先通过既有 grader/repository 建立隔离事实，Tool 读取前后 attempt/progress 指纹一致；从未接触 current DB 写入。

相关旧回归合计 **201 PASS / 1 SKIP / 0 FAIL**：非浏览器 184 PASS / 1 SKIP，加 R7B/R7C 浏览器 17 PASS。包含原 Student Tool/Core/Domain Port 55 PASS / 1 SKIP、durable repository、B3 scope/budget/transaction 和 seek/refresh/dedupe/media 回归。唯一 SKIP 是原 Student Tool 可选 isolated DB 项；新的真实隔离 DB Tool 测试已执行，不改旧测试预期。

候选 TypeScript、八文件 scoped lint、Next build、diff check 均 PASS。fresh candidate 先执行 Next 官方 typegen 生成 RouteContext；root tsc 会扫描工作区旧 partial build/source 副本，因此不将该工作区污染作为候选类型失败或修改产品 tsconfig。

扫描 352 个 candidate client 文件，未发现实际私有配置值或目标 server-only markers；新 route 的 client reference manifest 不含 read service/Tool。DTO、隔离浏览器 DOM/HTTP 和旧 Runtime client bundle 检查通过。current-DB 新 Tool 页面 DOM/network 验收尚未执行，不能签该项生产 PASS。

## 17 Current DB Boundary

独立 READ ONLY baseline 与结束复核确认：B1 binding 1/1/1，R6F freeze MATCH，B2 actor banned/inactive/suspended/non-default，actor sessions/refresh 0；attempts 2（incorrect、correct），progress 1 completed/100/mastery100/count2，page progress 0。两次核验结果一致，ledger 458、RPC hash 和 live Build 保持不变。

这些是独立 DB 审计，不是新 Lesson Tool current-DB acceptance。因此不生成 r7d-current-db-tool-readback.json 或 r7d-current-db-zero-write-receipt.json。真实验收需先批准部署，随后使用现有正常 Owner browser session，按 r7d-current-db-readonly-plan.json 比较相关域的前后指纹。正常 Owner token 活动须单独披露，不能误算为 actor session。

本轮 current DB 业务写 0、attempt/progress/Auth/内容写 0、B3 scope DISABLED、PM2 操作 0、部署 0。未清理 B3 两条 attempt、progress、receipt 或 journal。

## 18 Approval R7D-B Deploy Package

Current Build: `KaSWaVYOIk7ZjWGpvVWIf`。Candidate Build: `PjpaYHAz0asyvwh0G-lBo`。

- `candidate-build.tar.gz` SHA256: `c95ba807a5e4094062a2af1e465d01e3ec5413765a31fd14359a84499eb046fd`
- `candidate-source.tar.gz` SHA256: `2cd8714bad62443c813d436267b8dd37f3a330e0f9723b8febc075be139fda7d`

完整精确八文件 hash/presence/mode、归档路径和 rollback 合同位于 `docs/evidence/teaching-agent-stage-1f-r7d-b/approval-r7d-lesson-tool-deploy.json`。候选基于 B3A sealed source manifest 逐文件核对后覆盖八个 R7D 文件，没有同步其它 workspace 修改。既有 B3 child/media 随同新候选从锁定源码构建；没有运行 child/current scenario。

待批准的部署范围仅为 canonical :8443 的 `.next` 与八个精确产品路径，PM2 仅 uply-first-enable。保留旧 `.next` 和八路径 existed/absent、mode/hash；失败时精确恢复，仅删除原本 ABSENT 的新增路径。不修改 dependencies/package/lock、public、launcher/runtime config、Tailscale、migration/RPC/RLS/Auth、DB 行或 B3 journal。业务写 0，不需要 activation config。

部署后仍只允许现有正常 Owner 访问 `/platform/dashboard/admin/development-execution/lesson-facts`，读取 current DB evidence 并独立核对；不得运行 B3 scenario 或 Agent。用户批准前停止。

## 19 R7D-B Stop State

B1/B2/B3 COMPLETE；Lesson Tool/Domain Port IMPLEMENTED；single snapshot/completion/private boundary PASS；new tests 49/49；regression 201 PASS / 1 SKIP；TypeScript/Build/Lint PASS。Current DB Tool read-only acceptance NOT EXECUTED。Deploy Approval READY，尚未批准/执行。

Agent Runs 0、Provider 0、Publish 0、Pins 0、Feature OFF、Allowlists EMPTY。R7D Agent Binding NOT STARTED，Stage1G NOT READY。


## 20 Approved R7D-B Deployment — 2026-09-18

用户明确批准同一候选 `PjpaYHAz0asyvwh0G-lBo` 部署及一次现有正常 Owner 会话的 Current DB Tool READ-ONLY acceptance。归档 SHA256、八源码 path/hash/mode/presence、ledger 458、RPC/trigger、B1/B2/B3、R6F freeze 和 B3 disabled state 在停止 PM2 前重新核对通过。部署前还记录了 83 张相关 public/auth 表的内容及 xmin 指纹；原始指纹只保留本地私有 /tmp，公开证据不包含 secret/身份原始行。

首次部署在 mode 检查停止：Python tarfile data filter 将批准归档里的 0664 收紧成 0644，内容 hash 全部匹配。已按 presence manifest 精确回滚旧 Build，确认 online。随后在 staging 恢复八文件的精确批准 mode、再次完成 fresh preflight，使用同一归档成功部署。没有重新 build 或修改任何产品代码。两次部署历史分别保存在 deployment-attempt-1-rollback.json 和 deployment-receipt.json。

成功部署 rollback：`/home/yangzhen/operations/uply/teaching-agent/r7d-b/20260918T020821Z/rollback`。仅操作 uply-first-enable，当前 Build `PjpaYHAz0asyvwh0G-lBo`、PM2 online，root/dashboard/textbook routes HTTP 200，八文件 EXACT。runtime/launcher/Tailscale/public/package/lock/dependencies/B3 private journal 均保持不变。没有 migration、schema/RLS/StudentPolicy/Auth 配置修改。

## 21 Actual Current DB Tool Acceptance

通过现有 Owner Chrome 会话，对 `/platform/dashboard/admin/development-execution/lesson-facts` 执行一次 document GET，HTTP 200。没有 Cookie/JWT 转移、重新登录、impersonation、CLI Owner 或 repository 替代 Tool。网络记录只有一个 lesson-facts 请求，没有重试；普通 dashboard 导航有既有 GET prefetch，不是重复 Tool 执行。

实际 pipeline 为已部署的 Core executor → get_current_lesson_execution_facts@1.0.0 → Domain Port → shared validated repository read。页面显示：attemptCount 2、latest CORRECT、completion COMPLETED 100%、mastery 100、CURRENT_DEVELOPMENT_DB、当前位置不可核验。fresh asOf/observedAt 为 `2026-09-18T02:10:24.196Z`。完整 ToolResult/receipt 留在服务器，未额外导出；页面成功分支只在真实 Core output validation 成功后渲染。

随后新的独立 READ ONLY 连接确认 attempts #1 incorrect/#2 correct，progress completed/100/mastery100/attempt_count2，page progress0，与 Tool 完全 MATCH。独立读只用于比较，未拼进 Tool DTO。same snapshot 由已锁定且部署 hash MATCH 的共享 validated projection 保证。无 cursor，currentTeachingNode=null/currentPositionAvailability=unavailable，不能推断学生当前在 Node7。

真实验收证据：r7d-current-db-tool-readback.json、post-tool-independent-readback.json。事实读取部分 **PASS**。

## 22 Strict Zero-Write Gate — Owner Auth Refresh Delta

**总体 CONDITIONAL；严格全库零写入验收不能签 PASS。** 验收前后 83 张表中 80 张指纹完全一致，所有 public 业务表（attempt/progress、教材/冻结内容、Actor profile/membership、tenant、Agent/Provider/Publish/Pins 等）未变。部署前到验收前的 83 表指纹也完全一致。

验收窗口内变化仅为 `auth.refresh_tokens`、`auth.sessions`、`auth.users`：refresh token 总数 657 → 658；sessions/users 总行数不变但指纹变化。独立时间窗核查定位到一个 Platform Owner 主体（非 development actor），可见 refresh INSERT 1、既有 refresh UPDATE 1、session UPDATE 1、user UPDATE 1 的行变化。该分类基于更新时间、角色和内容/xmin 指纹，不宣称有完整 SQL statement 审计计数。

这是正常 Owner 会话刷新造成的 Auth 数据副作用；没有脚本直接执行 Auth mutation，没有给 B2 actor 发 session/JWT。B2 actor sessions0、refresh0、banned/inactive/suspended/non-default 保持。仍然必须承认用户要求的全局 Auth WRITE DELTA=0 未满足，不能把 business domain writes0 写成所有 DB writes0。

r7d-current-db-zero-write-receipt.json 明确记录 **STRICT GLOBAL ZERO-WRITE GATE NOT MET**、变化表、时间窗和限制。没有通过清理、删除 refresh token 或额外写入抹平差异，也没有再次调用 Tool。功能 Tool foundation 已部署且事实可信；严格验收关闭仍 BLOCKED，需用户审阅这一 Auth 会话边界，不能自动进入下一阶段。

## 23 Deployed Private Boundary and Stop State

完整捕获的 HTTP response body、完整 DOM、352 个已部署 client 文件、锁定 DTO/Core projection 和过程日志完成扫描：未发现 private answer/private grading payload、B2 actor/tenant UUID、DB credential/service key/JWT/refresh grant 泄漏。普通 Auth 日志包含 `refresh_token_not_found` 错误码；这是错误标签，不是 token 值。未把 Owner UI 个人信息保存到公开验收 evidence。原始网络请求 headers 不输出、不用于执行。

Current Build `PjpaYHAz0asyvwh0G-lBo` 保留，部署 PASS、Owner Tool functional facts PASS、独立比较 MATCH、strict overall acceptance FAIL / Overall CONDITIONAL。B1/B2/B3 COMPLETE，B3 scope DISABLED，attempt/progress writes0，Frozen/Canonical unchanged。Auth configuration unchanged，但 Owner session-refresh 数据变化已单独披露。

Agent Runs0、Provider0、Publish0、Pins0、Feature OFF、Allowlists EMPTY。R7D Agent Binding NOT STARTED、Stage1G NOT READY。没有数据库 rollback/cleanup、scope activation、第二次 Tool 验收或后续 Agent 阶段。到此停止。


## 24 R7D-B2 — Read-only Boundary Revision and Foundation Closure

按用户明确批准的验收边界修订，本节仅重新分类已保存的 R7D-B 验收证据，并只读核对部署文件。没有再次打开 lesson-facts 页面、调用 Tool/Core、访问数据库、执行 B3、激活 scope、修改产品、部署、操作 PM2 或 cleanup。Current Build 保持 `PjpaYHAz0asyvwh0G-lBo`，八部署文件 hash 与原批准包一致。

**新主 Gate：R7D_READ_ONLY_BUSINESS_DOMAIN；A + B + C 全部 PASS。R7D Tool Foundation 正式 COMPLETE，Overall GO。** 这是新合同下的关闭结论，不是把旧 Gate 的历史结果改成 PASS。

### Historical gate preserved

原 `r7d-current-db-zero-write-receipt.json` 原样保留：STRICT GLOBAL ZERO-WRITE = NOT MET。原 CONDITIONAL/阻塞结论与报告正文均未删除或覆盖。新 closure 记录原证据 SHA256 和历史报告前缀 hash；旧 Gate 现在仅为 HISTORICAL / NON-BLOCKING，由新业务域 READ-ONLY 合同取代为主验收 Gate。

### Gate A — Business domain write isolation: PASS

保留的 83 表指纹中，80 表未变；变化仅在三张 Auth 表。已测 Teaching/Learning、attempt/progress、Activity/secrets/nodes/version/textbook、Script/version、tenant/profile/membership/permissions、Agent、Publish 等业务表指纹均未变。Attempt Write Delta=0，Progress Write Delta=0，Business Domain Write Delta=0。

Tool → Domain Port 仅暴露 read 和 bounded evidence projection；交给事实服务的 repository 是冻结的 read/evidenceStorage 能力，SQL admission 要求 READ ONLY，实际现有 repository read 使用 REPEATABLE READ READ ONLY。准备和安全核验路径也只读；没有调用 submit/checkpoint/restore、B3 composition/issuer、Auth Admin 或 SQL write API。共享 repository 模块为其它已授权流程保留 submit，不等于本 Tool 具有该能力。

证据范围仍准确区分：保存的 inventory 没有逐表覆盖到的 course/ebook/objective 等存储，本节不补造“已测指纹”；Tool 对这些域的零写能力由 READ ONLY transaction/capability 边界证明，结合已有 freeze/binding 证据判定隔离。没有进行新的 DB 查询或把分类工作声称为新一次线上验收。

### Gate B — Development subject Auth isolation: PASS

B2 actor 是 facts subject，Owner 仅为 operator。既有前后安全证据显示 actor banned、sessions0、refresh0、profile inactive、membership student/suspended/non-default。auth.identities、profiles、memberships 和 tenants 指纹未变；验收时间窗 Auth 变更归属非 actor 的 Platform Owner。没有可归因于验收的 actor identity/auth.users/profile/membership mutation、interactive login 或 JWT issuance。

### Gate C — Operator Auth maintenance: OBSERVED_AND_ALLOWED

既有正常 Platform Owner browser session 维护在 auth.refresh_tokens、auth.sessions、auth.users 中产生过变化：观察到新 refresh row、旧 refresh row 更新、session row 更新、user row 更新。该历史观察继续披露；本节不执行任何新 refresh/login，也不删除或补偿已有 Auth 数据。

允许条件按主体、表、原因和能力边界判定：existing_platform_owner、非 B2 actor、existing_browser_session_maintenance、没有 Tool 显式 Auth mutation、新 login flow、magic-link 重新登录、impersonation、新测试用户、profile/membership 业务修改或人为诱发刷新。此归因来自保存的时间窗、角色、指纹及一次正常浏览器请求证据，是合理归因，不宣称完整 SQL statement 取证。

合同没有“允许写一行”或其它行数阈值。未知 subject、actor session/refresh、new identity/unrelated user、任何 profile/membership/tenant/permission/business 写入、显式 Auth Admin、unexpected login 或无法归因的 Auth 变化仍 fail closed。

### Read-only semantics and retained facts

TOOL MUTATION、BUSINESS DOMAIN MUTATION、SUBJECT AUTH MUTATION 均禁止；OPERATOR AUTH MAINTENANCE 仅按 Gate C 的严格条件允许。Lesson Tool READ-ONLY 表示 Tool/Domain Port/facts read path 没有业务写能力，不表示认证浏览器使用期间整个数据库所有物理行绝对不变。新证据分别记录 businessDomainWriteDelta、developmentActorAuthDelta、operatorAuthMaintenanceObserved/SubjectClass、strictGlobalZeroWriteHistoricalResult 和 toolMutationCapability，不用一个 dbWrites 值混淆这些语义。

复用原实际事实：attemptCount2、latest CORRECT、completion COMPLETED、completionPercent100、mastery100、nodeProgress.attemptCount2、CURRENT_DEVELOPMENT_DB；原 observedAt/asOf `2026-09-18T02:10:24.196Z` 保留，不换成本轮时间。currentTeachingNode=null、currentPositionAvailability=unavailable；same snapshot PASS，独立 DB comparison MATCH，Private Answer Leakage NONE。没有再次运行 Tool。

### R7D-B closure gates

| Gate | Result |
|---|---|
| G-R7D-B-1 Lesson Tool Deployed | PASS |
| G-R7D-B-2 Functional Facts | PASS |
| G-R7D-B-3 Same Snapshot Authority | PASS |
| G-R7D-B-4 Independent DB Comparison | PASS |
| G-R7D-B-5 Business Domain Writes Zero | PASS |
| G-R7D-B-6 Attempt Writes Zero | PASS |
| G-R7D-B-7 Progress Writes Zero | PASS |
| G-R7D-B-8 Development Actor Auth Delta Zero | PASS |
| G-R7D-B-9 Operator Auth Maintenance Attributed | PASS |
| G-R7D-B-10 Tool Mutation Capability None | PASS |
| G-R7D-B-11 Private Boundary | PASS |
| G-R7D-B-12 B3 Scope Disabled | PASS |
| G-R7D-B-13 Agent Runs Zero | PASS |
| G-R7D-B-14 Provider Zero | PASS |

Historical STRICT GLOBAL ZERO-WRITE：NOT MET / NON-BLOCKING。

新增证据位于 `docs/evidence/teaching-agent-stage-1f-r7d-b/`：`r7d-readonly-boundary-contract.json`、`r7d-operator-auth-maintenance-classification.json`、`r7d-readonly-acceptance-closure.json`。原始 receipt、readback、deployment/end-state 等历史文件保持原样。

R7D Tool Foundation COMPLETE。R7D-C — SKILL / TOOL BINDING 仅 READY FOR PLANNING，未实现、未注册正式生产 Tool/Skill、未运行 Agent/Provider。Agent0、Provider0、Publish0、Pins0、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED、Stage1G NOT READY。到此停止。
