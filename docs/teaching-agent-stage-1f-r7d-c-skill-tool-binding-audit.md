# R7D-C1 — Skill / Tool Binding Audit & Contract

## 1. Decision and evidence boundary

**READY FOR R7D-C IMPLEMENTATION**，限于本报告锁定的 C2 未注册 Skill / evidence 合同实施包。正式 production binding 尚未具备启用条件；这不是部署、Agent Run 或 Provider 批准。

主线：Teaching Script → Lesson Runtime → Durable Runtime Facts → Lesson Tool → Skill / Tool Binding → Teaching Agent → Provider E2E → First Enable。本轮只审计 Skill / Tool Binding。

本轮仅读取本地源码和已保存证据，新增本报告及 `docs/evidence/teaching-agent-stage-1f-r7d-c/` 文档。没有调用 Lesson Tool、Core executor、coordinator、浏览器、数据库或 Provider，没有运行测试。下文 VERIFIED 表示源码审计和合同设计完成，不表示新生产接线已经实现或验证。

B1/B2/B3 COMPLETE、R7D Tool Foundation COMPLETE、Build `PjpaYHAz0asyvwh0G-lBo` 作为上一阶段已验收状态继承；没有制造新的线上验证时间。B3 Scope DISABLED，Feature OFF，Allowlists EMPTY。保留 R7D-B2 的业务只读验收结论和历史 STRICT GLOBAL ZERO-WRITE NOT MET，不重新分类或覆盖历史证据。

## 2. Current architecture: source authority

| Concern | Current source / finding |
|---|---|
| Core Skill contract | `src/features/agent-core/contracts/skill.ts`: name/version/status/description/allowedTools/procedure/outputContract |
| Skill registry | `agent-core/skills/registry.ts`: exact VersionRef; global production registry empty |
| Student registry | `teaching-agent/server/skills/student-skill-registry.ts`: only Explain; selector accepts only `explain_segment` |
| Explain | `explain-pinned-korean-segment@1.0.0`; output `student-explanation@1.0.0` |
| Teaching extension | Explain definition already uses `requiredContext`, `evidenceRequirements.mandatory/optional`, `intent`, `locales` |
| Existing mandatory evidence | `get_current_lesson_context@1.0.0`; `get_current_teaching_state@1.0.0` optional |
| Tool availability | `resolveAllowedToolDefinitions`: exact Profile ∩ Skill ∩ enabled registry ∩ risk0 ∩ PermissionPolicy |
| Student Tool composition | Request-local lesson/context + state registry; durable Tool not registered |
| Private execution evidence | `createStudentAiTeacherCapabilities`: sole executor writer, private receipt variables, run/skill/model/tool-call IDs, exact Tool version; rejects duplicate/busy dispatch |
| Server completion | `student-run-completion-guard.ts`: revalidate evidence, validate output, then checked trace events |
| Run coordinator | Explain-specific admission, prompt, mandatory Tool handling and finalization; existing state machine uses failed/cancelled when unable to complete |
| Persistent completion | `202609140001_agent_runtime_completion_evidence.sql`; cancellation wrapper in `202609140002` preserves the gate |
| Planning | `studentPlanningContext` includes verified selection refs/revision/locales; no durable completion facts |
| Persona | `kim@1.0.0` and `generic-korean-teacher@1.0.0`: presentation only; Profile permissions remain fixed |

完整来源、符号和 SHA256 在 `r7d-c-skill-architecture-audit.json`。没有把通用 Core 当作已经支持任意 Skill mandatory evidence 的框架：当前 Teaching coordinator 和 evidence checker 实际专用于 Explain。

现有 `VerifiedStudentBinding` 来自 verifier 的 WeakMap，结构正确或拥有 UUID 不代表获得授权。它包含已验证教学选句上下文，但没有足够的 canonical Activity / execution snapshot 权威绑定。现有 Student read repository 也没有对应的执行快照读取方法。

## 3. Skill decision

没有找到专门处理 progress/completion/mastery/execution status 的现有 Teaching Skill。建议新增最小：

- Skill：`summarize-current-lesson-execution@1.0.0`。
- Intent：`summarize_execution`。
- Output contract：`student-execution-summary@1.0.0`。
- Allowed Tool / mandatory evidence：仅 `get_current_lesson_execution_facts@1.0.0`。
- Optional evidence：无。
- Context：authenticated student、verified own tenant/subject scope、verified execution binding、published content、source revision、locale。

复用现有 SkillDefinition 及 Teaching extension 字段，不新建 Skill registry、Tool router 或 Agent runtime。Skill 定义 procedure/context/tools/evidence/output；Tool 执行受控能力；Domain Port 封装领域读取；Teaching Script 保持教学内容来源；Runtime Fact 不属于 Agent memory；Persona 不授予权限。

Explain 保持当前 ID/version、allowedTools、procedure 和 mandatory lesson-context evidence。Durable facts 不能替代原句、教学内容或 lesson-context 证据；也不把 durable Tool 强加给所有 Skill。

## 4. Availability and production permission contract

| Selected Skill | Tool candidates after Skill filter | Required evidence |
|---|---|---|
| Explain v1 | lesson context v1; optional teaching state v1 | lesson context v1 |
| Proposed execution summary v1 | durable lesson execution facts v1 | durable lesson execution facts v1 |

继续使用现有交集算法和 Core executor 二次权限检查。模型只看到选中 Skill 的可用 Tool；版本精确锁定，单次 Run 不暴露同名多个版本。Durable Tool 仍是 risk0、12秒 timeout、16KiB output、strict `{}` input、`teaching.execution.self.read`。

生产接线设计：正常 Student admission → verifier-issued Run subject/tenant/lesson/version context → canonical published runtime snapshot 的受控 Activity binding → request-local facts issuer / Domain Port / Tool → existing registry intersection / Core executor → 私有 evidence ledger → Skill gate → persisted completion CAS。

`createLessonFactsBindingIssuer` 是现有复用点，但生产 authorize/read adapter 尚不存在。必须验证 Run authority、tenant、subject、lesson/version、Activity、execution node/source node、snapshot、deadline；每次调用及最终 gate 重验。模型不能选择身份、DB、来源或任意 target。Actor/tenant 原始 ID 留在服务器内部，不能进入模型输出或公开 trace。

现有 `createStudentToolPolicy` 尚无 execution permission mapping。未来新增映射只能针对精确 Tool version 和受控 binding，不授予 submit/admin/SQL/play/checkpoint/restore 等能力。

## 5. Three production activation prerequisites

1. **Published execution read authority。** 当前 `native-activity-binding.server.ts` 明确要求 chapter/version 为 draft，且绑定单一开发目标。旧 published session resolver 的 issue 路径固定 chapter-one；旧 Activity adapter 使用 legacy capsules。它们不能自动成为新 canonical production bridge。需要正式 published read adapter，沿用可信 repository / validated same-snapshot projection；不得放宽 StudentPolicy，也不得把 B2 inactive/suspended actor、Draft 内容或 Owner issuer 接入学生路径。
2. **Production provenance。** 当前 v2 receipt / facts grant storage 只有 `CURRENT_DEVELOPMENT_DB` 和 `isolated-test-db`。生产 transport 身份及其 wire version/discriminant 必须单独明确设计、实现和测试；不能改名冒充生产证据。B3 的两次作答一致性策略只属于当前 development target，不能成为全平台完成规则。
3. **Persistent Run completion policy。** 当前 artifact `schemaVersion:1` 只保存单个 `requiredEvidenceToolRef`；strict trace 缺少 Activity/storage/subject-context receipt metadata；SQL completion gate 要求非空 `segmentRef` 且包含在 sourceRefs。Activity ref 不是句子 segmentRef。必须版本化扩展既有 artifact/trace/transition 合同，配套一个另行批准的窄 migration；不建第二套 evidence/progress 表，不改历史 migration，不削弱旧 Explain gate。

这些是生产激活前的真实缺口。本轮只审计 migration 源码，没有查询当前已安装 SQL 定义。C2 未注册 Skill 测试成功也不能直接宣称 production binding 完成。

## 6. Mandatory evidence contract

任何涉及是否完成、是否作答、attempt 次数、最近正确性、progress、completion 百分比、mastery、durable execution state 的权威断言，必须来自精确 durable Tool 的有效 receipt。

沿用现有 private ledger，只允许 Core executor 实际返回结果后写入。receipt 必须关联当前 run、skillRun/Skill version、model call、tool call、Tool version、opaque authority、subject/tenant scope、lesson/version/Activity/content snapshot、可信 source/storage、read start、asOf/observedAt 和 deadline。该关联可以由私有受控对象保存；无需将敏感 ID 写入模型 DTO。

Gate 重验：相同授权和 snapshot、精确版本、成功且一致的 durable facts、当前 call/Run 时间窗、非未来时间、年龄不超过30秒且未过 authority/Run deadline。保留既有 Tool 的 same-snapshot authority；Skill 不重新实现 `isCompleted()`。失败的新读取应失效此前 receipt，不能退回旧成功结果。

模型自写 ref、用户“我已完成”、prompt、memory、UI/video state、另一个 Run 的 receipt、复制的 handle 都不能满足 evidence。Fixture 只能用于隔离测试，不能满足 current-DB 或生产来源要求。UNKNOWN attemptNumber0 不能投影为真实 attemptCount0。

新摘要中的权威状态/数量/分数由服务器从已验证 Tool DTO 投影，禁止接受模型编写的数值或任意完成断言。允许 CORRECT/INCORRECT 分类，不输出具体答案。没有 durable cursor 时保持 currentTeachingNode=null、currentPositionAvailability=unavailable；不能把 sourceTeachingNodeRef 当成当前教学位置。

现有 Explain output 正则只拦截部分“已更新状态”等表述，源码也承认任意改写需要额外评估。不能据此声称所有自然语言完成断言已经被形式化拦截。新 Skill 用 bounded server projection；未来若扩大 Explain 可输出的执行状态断言，必须另行增强其输出合同，不能仅靠提示词。

## 7. Run completion and failure behavior

已有 server gate 与 SQL gate 必须都保留。新 Skill 最终 completed 必须依次满足：fresh authorized receipt → required evidence → bounded output → server-created matching trace evidence → versioned persisted policy → existing fenced/CAS transition。模型不能自行发出 pass metadata。

沿用已有状态机：缺失证据 `REQUIRED_EVIDENCE_MISSING`，无效输出 `SKILL_OUTPUT_INVALID`，最终 failed；取消走 cancelled。不新增持久化 NEEDS_TOOL/BLOCKED 状态。对模型尚未调用 mandatory Tool，未来 coordinator 可复用已有预算内最多一次 corrective planning；对 Tool 的 not_found_or_not_visible/stale/unavailable/READ_UNAVAILABLE，则 fail closed，不隐式重试、不退回 memory、UI、旧 Learning Agent 或直接 DB 查询。最终 gate 发现过期同样拒绝 completed。

一旦生产实现需要多个 mandatory Tool，artifact/SQL 必须校验整个集合，不能继续只取 mandatory[0]。本次新 Skill 仅一个 mandatory Tool，Explain 仍保持原要求，二者不可互换。

## 8. Planning and Persona

当前 planning context 是 refs/revision/locale，不注入 completion/mastery 等 authoritative sentences。Tool choice 在 planning/corrective 为 auto，在 gate 满足后的 final 为 none；保留该策略。新 Skill procedure 可以要求读取 Tool，但不能预填其结果。

Kim 老师只影响语气、简洁程度和中韩说明方式。它不能修改 tool availability、subject、tenant、permission、evidence、completion authority。当前 canonical Teaching Agent/Core 路径未发现旧 Learning Agent fallback；仓库其它 legacy 模块的存在不等于此路径使用它们。

## 9. Negative and regression test plan

`r7d-c-negative-test-plan.json` 锁定35项**计划测试，全部未运行**：可见/不可见、permission、subject/tenant/lesson/Activity/version、arbitrary input、missing/present/wrong-version/stale/cross-run/forged evidence、copied handle、fixture来源伪装、UNKNOWN0、Tool失败、Explain证据不可替代、Persona、fallback、planning、cursor、secret leakage、输出伪造、失败后旧证据、fresh read、duplicate dispatch、finalization drift、无关Skill不强制durable、StudentPolicy、definition pin及未来 SQL gate。

复用现有 Core executor / registries / isolated read ports 做 deterministic harness。禁止正式 Run、Provider/current-DB 调用。SQL 持久化测试须在单独批准的 prerequisite implementation 中进入隔离环境。本轮不声称运行或达到任何 PASS 数量。原 Student Tool/Core/Domain Port/evidence、R7D及相关R7B/R7C/B3回归预期不能被修改以掩盖退化。

## 10. Exact C2 implementation approval package

批准包：`approval-r7d-c-implementation.json`，状态 **READY — AWAITING USER APPROVAL**。仅申请未注册 Skill / evidence 合同实现；本轮未实施。

修改2个产品文件：

- `src/features/teaching-agent/server/composition/create-student-ai-teacher-capabilities.ts`：提取共享 private execution ledger，保持 Explain 行为。
- `src/features/teaching-agent/skills/explain-pinned-korean-segment/definition.ts`：复用命名后的 Teaching Skill 扩展类型，原有定义语义不变。

新增7个产品文件：

- `src/features/teaching-agent/server/skills/teaching-skill-contract.ts`
- `src/features/teaching-agent/server/skills/tool-evidence-ledger.ts`
- `src/features/teaching-agent/server/composition/create-lesson-execution-skill-capabilities.ts`
- `src/features/teaching-agent/skills/summarize-current-lesson-execution/definition.ts`
- `src/features/teaching-agent/skills/summarize-current-lesson-execution/procedure.ts`
- `src/features/teaching-agent/skills/summarize-current-lesson-execution/evidence.ts`
- `src/features/teaching-agent/skills/summarize-current-lesson-execution/output.ts`

新增3个测试及1个 fixture 的精确路径见 implementation plan。没有第二套 registry/executor；新的 capability composition 只组合现有机制，测试用隔离 port，不能创建可调用的生产路由或借用 Owner/B2 production issuer。

此范围不包括 registry/policy/profile 的正式生产注册、runtime coordinator 激活、published read adapter 或 persisted migration。相关既有文件和必要交付物已在 plan 的 `productionPrerequisiteWork` 明确列出，必须先形成另一个精确扩展批准包，不能默默带入。这个划分是实施顺序，不是把未完成项判 PASS：完整生产接线仍需第5节三个前置条件全部闭合，之后才能申请 C3 部署/验收。

C2 范围内 migration/dependency/current-DB writes/Agent/Provider/deploy 均0。实际类型检查、lint、回归及必要的隔离 candidate build 结果到 C2 才报告。未经批准不改产品代码。

## 11. Gate matrix and stopping point

| Gate | Result / meaning |
|---|---|
| Skill architecture / Explain | VERIFIED — actual source names and existing gate |
| Availability / durable evidence | VERIFIED — existing primitives and proposed contract |
| Run completion | VERIFIED audit/design — production extension not implemented |
| Permission / production path | VERIFIED contract / DESIGNED — activation prerequisites outstanding |
| Planning / Persona isolation | PASS source audit |
| Legacy fallback | ABSENT in audited Teaching Agent/Core path |
| Negative plan | READY, 35 planned, 0 executed |
| C2 implementation approval | READY, not granted |
| Production source changes / deployment / PM2 / migration | 0 |
| DB reads / writes / Tool calls / Agent Runs / Provider | 0 |
| Feature / Allowlists / B3 Scope | OFF / EMPTY / DISABLED (retained state) |
| Stage1G | NOT READY |

历史 R7D Tool Foundation COMPLETE 保持。当前只完成 C1，等待 C2 实施批准；没有进行 Skill production binding、Agent Run 或 Provider E2E，也没有自动进入下一阶段。

## 12. R7D-C2 implementation closure

本节追加 C2 获批实施结果，保留上文 C1 的历史状态及其原始证据。结论：**READY FOR R7D-C PRODUCTION PREREQUISITE APPROVAL**。不是 production activation 或 C3 部署就绪。

严格修改批准的2个产品文件并新增7个产品文件；新增3个测试文件和1个 fixture。其余产品、schema、package/lock、既有测试文件保持本轮前的 SHA256。生产 Student Skill registry、Tool registry、Profile、permission mapping、coordinator 均未修改。

新 Skill `summarize-current-lesson-execution@1.0.0`、intent `summarize_execution`、output `student-execution-summary@1.0.0` 已实现但未注册。唯一 allowed / mandatory Tool 为 `get_current_lesson_execution_facts@1.0.0`，optional evidence 无。SkillDefinition 仍来自 Core；新增 Teaching type 仅命名已有扩展字段。

### Shared ledger and isolated composition

将原 Explain 私有 receipt 存储提取为共享 server-only helper。既有 capability composition 保留固定 Core bridge；它覆盖内部 invocation dependency，外部 capability 调用者不能替换 executor、提交 receipt 或设置 evidence。两个 composition 都通过同一个 existing Core executor。没有第二套 router/registry/runtime。

Ledger 记录真实 Core 返回结果的私有副本，并关联 Run/Skill/model-call/tool-call、实际 registry Tool version、authority identity/snapshot、private grant snapshot、read start/return time、deadline 和带 asOf 的结果。WeakSet + private binding/authority identity 拒绝结构复制和跨 Run receipt。新 admitted dispatch 先失效旧记录；错误结果不能满足 summary gate。模型拿到的 Tool DTO 与私有副本隔离，修改返回 DTO 不能改写 evidence。

Explain 的 call parsing、busy/duplicate/budget、allowlists、admission、trace sequence 和 evidence checker 保持原行为。原回归中的静态边界要求 Core executor 直接入口留在既有 composition，因此共享 helper 使用该固定 bridge；没有修改旧测试预期或绕过层次检查。原 Skill definition 只做 type 引用替换。

隔离 composition 只接受 isolated-test-db、合成 subject/tenant 的一致 context、原 issuer opaque handle 及精确 Skill/Tool allowlist。未创建 route，没有 Owner issuer、B2 identity、current-DB transport、Provider 或 coordinator。每次 final gate 再检查 issuer binding、permission、authority、deadline、来源和 observation age。缺失/失效 evidence 为 REQUIRED_EVIDENCE_MISSING；model summary 输入不是 strict `{}` 时为 SKILL_OUTPUT_INVALID。

Summary 完全投影已经由 Tool 验证的 bounded facts，不重写 isCompleted、不让模型填写数量/分数/状态。currentTeachingNode=null、currentPositionAvailability=unavailable 原样保留。

**C1 文字澄清：** 现有 Tool 成功结果是 `partial`，因为独立 durable cursor 不可用，不代表已验证的 completion facts 不可信。C2 接受现有合同的 validated partial result；UNKNOWN、失败或矛盾事实仍拒绝。C1 evidence JSON 中“partial durable evidence不能满足completed”的宽泛描述不作为实现规则；历史文件保留，Tool wire contract 未改动。

### Verification

| Check | Result |
|---|---|
| 新 C2 tests | 52 PASS / 0 FAIL |
| C1 35类覆盖 | 全部保留；34/35为现有 SQL 前置合同静态 guard，不冒充未来 SQL policy 动态验证 |
| Student Tool/Skill + domain + R7D Tool/facts | 170 PASS / 2 SKIP / 0 FAIL |
| Core registry/executor/policy等安全子集 | 11 PASS / 0 FAIL |
| R7D evidence | 8 PASS / 0 FAIL，含自建隔离 PostgreSQL |
| R7B completion/execution/projection | 49 PASS / 0 FAIL |
| 回归合计（不重复计入 C2） | 238 PASS / 2 SKIP / 0 FAIL |
| TypeScript / scoped lint | PASS，锁定源文件的隔离候选 |
| Next webpack build | PASS，隔离验证 artifact |
| Diff / source scope / boundary | PASS，9产品文件精确匹配，无范围外产品改动 |

两个 SKIP 是原 Student domain / Student tools 可选 PostgreSQL suite，未开启其环境开关。没有运行 coordinator / Provider fixture-loop suite；Explain completion guard 直接通过 unit harness 验证。R7D 已有 PostgreSQL 用例仅在自建、`--network none` 容器内 seed/submit/read/teardown，没有当前数据库 endpoint 或凭据。

初轮根目录 TypeScript 扫描包含此前不完整的 `build/r7cb-b3a-candidate/source` 树而失败；没有修改 tsconfig 排除它。正式检查在 R7D-B 锁定候选源码加9个批准文件的独立临时目录执行，通过 typegen / TypeScript / lint / build。初轮 build 因禁止网络导致 Google Fonts 请求失败；最后使用 Next 自带 font mock 机制与已有本地字体完成隔离构建，产品字体/配置未变。

验证 artifact Build ID：`UKkT6kYp5AF8gjNUW4OOx`。它使用 localhost 虚拟配置和非凭据 public key，**不是可直接部署的 production candidate**。没有复制当前 runtime 配置或 env 文件。新 Skill/ledger/private fixture markers 未进入 client chunks；虚拟 public key 按 NEXT_PUBLIC 规则进入 bundle，属于预期公开占位符，不是秘密泄漏。Live Build 继续是继承的 `PjpaYHAz0asyvwh0G-lBo`，本轮没有访问线上环境核验或改变它。

详细结果：`r7d-c2-implementation-result.json`、`r7d-c2-skill-contract.json`、`r7d-c2-shared-evidence-ledger.json`、`r7d-c2-capability-composition.json`、`r7d-c2-negative-tests.json`、`r7d-c2-regression.json`、`r7d-c2-private-boundary.json`。日志保存在同一 evidence 目录。

## 13. Production prerequisite approval package

新增 `r7d-c-production-prerequisites.json` 和 `approval-r7d-c-production-prerequisites.json`。状态 **READY — AWAITING USER APPROVAL**，没有实施。

提案锁定24个现有产品文件、3个新增产品文件，以及一个待批准的新 migration 文件 `202609180001_agent_durable_skill_completion.sql`。完整路径及现有源文件 hash 在批准 JSON 中。覆盖：published canonical read adapter、真实生产 provenance、versioned artifact/trace/SQL completion policy、既有 coordinator/request-local registry/Profile/permission binding。

由于生产 provenance 超出现有 v1.0.0 输出来源 enum，提案明确请求批准 Tool/Skill/output `1.1.0` 及 `activity-completion/3` 的版本化合同，保留已经验收的1.0.0与开发 v2 receipt。这个版本决策未获批、未实施；不会悄悄改变 C2 的 exact mandatory version，也不会用 development receipt 满足未来生产 Skill。

下一包即使获批也只允许指定产品/migration文件实现与隔离验证，**不包括 migration 安装、部署、线上 activation、当前DB业务写入或 Agent/Provider 执行**。既有 frozen Draft target 不会为了适配生产而 Publish。实现前若发现需第28个产品文件或新的 transport/UI范围，必须停止并扩展批准。

到此停止：Current DB reads0/writes0、Agent0、Provider0、Deployment0、PM2 mutation0、Publish0、Pins0、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED、Stage1G NOT READY。B1/B2/B3 与 R7D Tool Foundation 的既有 COMPLETE 结论保持；未进入 C3。

## 14. Production prerequisite fresh audit — scope STOP

本轮用户已明确批准27个产品文件与一个新 completion migration 的实现及隔离验证。上节及原批准 JSON 的“尚未批准”保留为历史；本节记录新的授权和实际停止原因。结论：**BLOCKED BEFORE PRODUCT EDIT**。不是 hash 漂移，也不是要求重批原27文件。

Fresh source audit：原批准包24/24 existing SHA256 MATCH；3个拟新增产品文件和 `202609180001_agent_durable_skill_completion.sql` 尚不存在。已检查直接 imports、Student admission、registry/Profile/permission、coordinator、artifact/trace 与旧 SQL wrapper 依赖。没有开始产品、migration 或测试实现。

### Scope blocker: canonical published snapshot certification

正式 `publicationRepository.current/session` 经 `assertPublishableSnapshot` 调用 `validateSnapshotBundle`。`src/lib/smart-textbook-publishing/artifact.server.ts` 的 private payload/source pins 与 Chapter One compiler/profile/history 绑定，并无条件进入 `readiness-validation.server.ts`。后者强制固定历史 page/repeat 映射、3个 listening/playback 项、以及 Chapter One chapter-test navigation。现有 publisher/capture 也只实现该 Chapter One 编译路径。

因此，独立 native Activity 的 published fixture 不能通过删除这些依赖而仍声称满足现有正式 certification。把历史数据填进 fixture、跳过完整发布校验只检查 published/hash，或在 Lesson Tool reader 内另建 publication authority，都不能证明批准要求的新 canonical published read authority。至少需要重新锁定批准范围外的 `src/lib/smart-textbook-publishing/artifact.server.ts` 合同，触发用户第3/5条的第28个产品文件 STOP 规则。这里**不宣称只改第28个文件就够**；producer、repository/session 返回类型和 dependency fence 的完整影响仍需在修订合同里锁定。

当前 SQL publication foundation 检查 `publish-foundation/1`、document/private association 与 dependency capture/fence；本审计没有证明必需新的 publication migration。是否需要须由 native publication 合同决定，不能塞进本轮仅限 completion policy 的 migration。旧已执行 migration 保持本轮前状态。

另发现公开 Student transport 仍仅允许 `explain_segment`。该入口不在批准范围内，保持不变；它不是本次停止 source-only inactive implementation 的独立理由。

### Evidence and verification status

新增 `r7d-c-prod-fresh-source-audit.json` 保存24个hash核验及带行号/源码hash的依赖依据；`r7d-c-prod-implementation-result.json` 和各 production contract/result 文件明确标为未实施/未执行。新建 `approval-r7d-c-production-prerequisites-revision.json` 为**范围修订草案，完整扩展范围尚未锁定**，不是部署或 migration install 批准包。原批准包和所有C1/C2/B1/B2/B3/R7D历史证据原样保留。

新测试、isolated PostgreSQL、migration install、TypeScript、lint、build 均未执行；没有新candidate。C2 52 PASS与238 PASS/2 SKIP只是历史结果，不计作本轮回归通过。`git diff --check` 通过。没有新增fallback，也没有删除旧依赖；安全可删candidate为0，线上依赖审计未获本轮授权，不能宣称安全删除审计已通过。

本轮 Product changes0 / Migration files0 / Current DB reads0 / writes0 / Agent Runs0 / Provider0 / Deployment0 / PM2 mutation0 / Publish0 / Pins0。Current Build `PjpaYHAz0asyvwh0G-lBo`、ledger458、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED 均为保留基线，本轮没有查询线上重新认证。R7D Tool Foundation和C2既有完成结果不变；Stage1G NOT READY。

## 15. R7D-C-P1 — Canonical Native Publication Contract Scope Audit

本节仅追加源码依赖审计与待批准设计。上一节 **BLOCKED BEFORE PRODUCT EDIT** 保留；原27文件批准及 scope revision draft 没有被改写或追认。结论：**READY FOR EXPANDED IMPLEMENTATION APPROVAL**。原范围不足的原因已通过精确新范围解决，产品尚未实现，migration/deploy仍然 BLOCKED。

### Exact source scope

重新核验原24/24 existing SHA256 MATCH。对1315个本地 TS/JS源码做 literal import/re-export/call-site审计，并人工追踪 publication producer、private payload消费者、Student admission和SQL历史覆盖顺序。publication消费闭包没有未解析的本地imports。

新提案 **34个产品文件 EXACT = 30 existing modifications + 4 new files**。原27个全部保留，没有移除。额外7个为：

| Path | Responsibility |
|---|---|
| `src/lib/smart-textbook-publishing/artifact.server.ts` | 官方version/kind分派，保留v1完整校验及digest解释，加入native union |
| `src/lib/smart-textbook-publishing/capture.server.ts` | 从同一真实capture结果投影native source，不调用Chapter One reader |
| `src/lib/smart-textbook-publishing/publisher.server.ts` | 同一publisher内显式选择native compiler，复用Owner guard/repository/CAS |
| `src/lib/smart-textbook-publishing/repository.server.ts` | current/session返回certified union；可信rpc seam可参与同一只读snapshot |
| `src/lib/smart-textbook-publishing/loader.server.ts` | 旧course loader显式收窄legacy，保持旧返回类型 |
| `src/features/smart-textbook-runtime/server/learning-session.server.ts` | 旧capsule session resolver在私有字段访问前拒绝native |
| **new** `src/lib/smart-textbook-publishing/native-publication.server.ts` | 同一framework内native schema/compiler/certification模块，无DB/Auth/存储或独立publisher |

全部34路径、existing SHA256/mode/presence、逐文件理由和不修改的边界文件hash均在 `r7d-c-expanded-scope.json` 和新 expanded approval中。新增路径目前ABSENT，不伪造未来source hash。若实施再需第35个产品文件或额外能力，仍STOP重新锁范围。

### Versioned contract and compatibility

保留历史 `publish-foundation/1` 的原payload、原hash算法和旧validator。新artifact采用 `revision=publish-foundation/2` + `publicationKind=canonical-native`，private contract为 `canonical-native-publication/1`，compiler为 `native-publication/1`。两者均使用既有 Manifest `1.0.0` / `uply-runtime/1`，不创建第二套snapshot系统。Publication v2与 `activity-completion/2` 是不同namespace，不能混淆。未来production receipt仍是 `activity-completion/3`。

官方artifact dispatcher只按精确tuple选择一个validator；不先试native再fallback到legacy。generic repository可以读取已certify的union。legacy producer→legacy reader允许；native producer→native facts reader允许；两种交叉读取在consumer边界拒绝。unknown/mixed版本拒绝。旧loader/session显式收窄后，learning-boundary、production-learning-boundary、published-teacher-scope及Owner audit的既有类型消费者保持原样，不需要传播native payload到旧capsule ports。

初版native范围明确为真实canonical teaching text + single_choice事实绑定，复用现有native Manifest block类型。每个execution node只支持一个计入completion的Activity；不限制全局为第0章、脚本v1、某个alias、3个选项或2次attempt。它不是generalized media/cue publisher：有必须执行的video/audio/speech/listening/cue或无法表示的配置必须拒绝，不能默默丢弃、伪造空依赖或套用legacy media exception。这个最小能力边界已明确放入新批准提案，未来扩展另锁范围。

Native source-node→Activity association使用已有 `learning_agent_script_nodes.reference_activity_id`，校验同一captured lesson/module/version graph；不按题目、标题、alias或Node7猜。B1写入保持node.content/public_config为空且未修改Frozen source node，不能据此自动生成production关联，更不会Publish B1。隔离测试使用独立真实关联的published fixture。没有module.status时不发明该字段；module publication依赖父chapter/version及StudentPolicy。

### Generic invariants and historical rules

通用：scope/parent association、同snapshot来源、digest/seal、immutable store、pointer CAS、capture/fence、edit-window/drain/retirement、session actor/tenant/TTL、Manifest结构。

Legacy-only：固定identity/profile/history、page/repeat映射、3个listening/playback、Chapter One chapter-test navigation、legacy TTS/speech proof、75-media例外、capsule field paths。`readiness-validation.server.ts`保持原样；其中唯一性/关联校验的概念可以复用，但native不能给legacy结构填空对象来绕过它。`domain-guard.server.ts`也不需修改：新union共同保留snapshotId/dependencies，继续使用原fence。

### Independent publication migration required

**PUBLICATION MIGRATION REQUIRED: YES**。现有snapshot CHECK与base publish只接受 `publish-foundation/1`。提案限定forward migration修改 existing snapshots revision/kind CHECK、`publish_runtime_snapshot_v1`版本准入、`publish_runtime_snapshot_base_v2`版本化secret/dependency检查及入口ACL。无新表、无历史行改写；保留result.manifest/report.sourceRevision这两个通用association字段，不伪造legacy readiness。新migration未创建、未编号，须独立批准。

完整SQL调用链按后续migration校正：110002已恢复single-version outer wrapper；base内保留legacy roleplay例外；130001更新semantic_capture；130003将authoring fence拒绝改为PT409。outer wrapper、capture链、fence/immutable triggers、read/session RPC、retirement、request lease、CAS与history保持。不能只用最初100001/100002 fixture宣称这些行为已验证。

历史snapshot可解释/审计读取不等于允许重新执行retired/revoked/expired session。新设计不解除这些既有禁令，不改变历史digest，不复活session。Completion migration `202609180001_agent_durable_skill_completion.sql`仍是单独proposal，未创建，不承担publication DDL。

### Student transport and native facts authority

公开入口 `src/app/api/teaching-agent/runs/route.ts` → transport/production → `student-handlers.ts:16` 的严格intent当前只有 `explain_segment`。分类 **DEFERRED**：server factory/coordinator/registry可先在隔离中实现，公开summary请求必须在后续Agent activation之前另行批准入口/调用点变更。它不替代publication主blocker，也不在本次34文件内。

未来native读链：formal StudentPolicy + verified selection → server-resolved scope → 同一个verified READ ONLY snapshot中的official publication repository/certification/fence → canonical Activity → trusted durable repository → Tool1.1 → Skill1.1。Owner只做publisher操作者，不是事实subject；既有B2/development issuer、旧Chapter One resolver、B3 scope都不能进入这条链。Tool读不创建publication session或runtime write lease；只读快照与fence/retirement/freshness检查必须真实成立。

### Cleanup and planned verification

A历史certification依赖、B既有runtime消费者、C显式旧producer全部保留。没有任何D类安全删除对象：**cleanup candidates0 / deletions0**。未查询线上active session、runtime request、PM2或external使用情况，不据此假定旧producer已无用途。本范围没有retirement；未来若批准retire，必须先证明历史read不变、无fallback、无dangling/active/external依赖。

已设计36项publication/compatibility/SQL/negative测试，加上原production evidence、C2与回归计划；本轮执行0。隔离fixture未来须覆盖完整historical chain及两份独立forward migration，保留原legacy fixture/golden bytes/expected结果。没有构建、没有部署candidate，审计脚本仅解析本地源码和计算hash，不计production validation。

新增 `approval-r7d-c-production-prerequisites-expanded.json` 状态 **READY_AWAITING_EXPLICIT_APPROVAL / approved=false**，原27批准不自动扩展为34。Product implementation、publication migration authoring、completion migration、current DB install、deploy、readonly acceptance、Agent Run、Provider分别保持明确审批边界。

本轮Product changes0 / Migration files0 / Tests executed0 / Current DB reads0/writes0 / Agent0 / Provider0 / Deployment0 / PM2 mutation0 / Publish0 / Pins0。Build `PjpaYHAz0asyvwh0G-lBo`、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED为保留基线，未访问线上重新核验。B1/B2/B3/R7D Tool Foundation/C2既有完成结果保留。Stage1G NOT READY。


## 16. R7D-C Expanded Implementation — STOP before product edit

本次用户已明确批准34文件实现和两份独立migration的编写/隔离验证；原批准包文件原样保留，不把历史提案中的 `approved=false` 改写成新历史。开始前30/30 existing的SHA256、mode、presence全部MATCH，4/4 new路径ABSENT，completion migration路径ABSENT。

发现新的实际合同冲突：批准的 native `compilerVersion = native-publication/1` 不能通过当前官方Manifest schema。`src/lib/smart-textbook-runtime-v1/contracts.ts:82` 的 `snapshot.compilerVersion` 使用 `I`，即该文件第5、10行的 `idSchema`。它采用 `targets.ts:3` 的 `^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`，不允许 `/`。官方 `validator.ts:35` 调用这个schema；既有 publication artifact 第73行还要求Manifest和envelope compilerVersion一致。

仅对本地真实schema进行了三项诊断：`native-publication/1` 被拒绝；无斜线的两个控制字符串通过。这不是publication、migration或production验证通过。没有修改测试expected，也没有把控制字符串替换成批准的版本名。

**Blocking code: NATIVE_COMPILER_VERSION_REJECTED_BY_MANIFEST_SCHEMA_OUTSIDE_APPROVED_34_FILES**。P1曾将该schema记录为“足够且不修改”，这一判断漏掉了compilerVersion语法限制。P1及原34-file批准包保留原样；本节记录发现与更正，不倒改历史。

遵守本次用户第3/54条STOP规则，停止于产品编辑之前。保持锁定版本并复用官方schema，至少需要将 `src/lib/smart-textbook-runtime-v1/contracts.ts` 从 unchanged boundary 移入修改范围。不能在34文件内通过双版本名、编码/归一化、替代validator或跳过认证绕过这个约束。

已形成 `approval-r7d-c-production-prerequisites-expanded-35.json`，状态 **DRAFT_AWAITING_EXPLICIT_SCOPE_APPROVAL / approved=false**：31 existing + 原4 new = 35，删除0；唯一新增授权请求是上述schema字段。建议只为 `snapshot.compilerVersion` 增加精确的 `native-publication/1` admission，保持stable ID语法不变；v2 certifier锁定该literal，v1 certifier仍严格保留原compiler语法/版本语义。后续必须验证unknown slash版本拒绝、legacy历史不变、双向版本混淆拒绝及全部原回归。该提案未执行，不声称余下实现验证已经完成。

按本地文件名库存锁定publication migration为 `202609180002_native_publication_contract.sql`，与保留的completion `202609180001_agent_durable_skill_completion.sql` 独立。两者均未创建、未安装。文件名锁只记录库存/碰撞检查；不是SQL验证结果。

新增expanded结果证据如实标记BLOCKED / NOT_STARTED / NOT_EXECUTED；没有生成可安装、可部署、可验收的READY批准包。C2 52项和其它regression本轮未重跑，不引用历史PASS冒充新验证。TypeScript、lint、build未执行，validation artifact为NONE，deployment candidate为NO。

本轮Product changes0 / Migration files0 / Current DB reads0/writes0 / Agent0 / Provider0 / Deployment0 / PM2 mutation0 / Browser production requests0 / Publish0 / Pins0。所有线上保护状态为保留基线，未访问线上重新核验。Current Build `PjpaYHAz0asyvwh0G-lBo`、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED；Stage1G NOT READY。下一步只等待新增schema路径的独立scope批准。


## 17. R7D-C compilerVersion naming correction — 34b proposal

本轮仅修订尚未实施的native compiler identifier，不执行产品实现。原斜线identifier的schema拒绝诊断仍是真实历史；原34、35批准包和blocker证据原样保留，35包未获批。

本地全仓库内容搜索（包括hidden/ignored产物，排除.git、第三方node_modules和外部symlink）检查8195个文件及137个gzip解压流，旧字符串仅出现在6份docs/evidence文件中。未发现产品源码、migration、authority fixture、配置或生成产物依赖。没有访问current DB、production browser或外部系统；不声称做过线上数据查询。

新的唯一native compiler identifier为 **native-publication-1**。旧 **native-publication/1** 标记为 **UNIMPLEMENTED SUPERSEDED DESIGN IDENTIFIER**，不是runtime alias。禁止normalization、双名称接受或fallback。修订仅涉及compiler identifier；privateContract **canonical-native-publication/1**、revision **publish-foundation/2**、kind **canonical-native**、Manifest **1.0.0**、runtime **uply-runtime/1**、receipt **activity-completion/3**、Tool/Skill/Output **1.1.0** 全部保留。

compilerVersion当前是stable opaque identifier；reader/writer没有要求slash namespace。官方envelope与Manifest精确相等关系继续保持：二者都必须是native-publication-1，不一致拒绝。它继续参与producer/certificate identity以及相应seal/pins；公共semantic Manifest digest排除snapshot metadata。legacy writer、hash、payload、validator全部不变。artifact dispatch仍仅按revision/kind，不能通过compilerVersion做fallback。

7项纯本地schema检查符合预期：新名称接受，旧名称及native/publication/1、unknown/value拒绝，真实historical fixture compiler名称接受，两个带slash stable ID拒绝。另确认历史Manifest结构仍接受、内存中仅替换compiler字段的新字符串也能通过结构校验；未保存改造fixture，未将此当成native publication certification。没有新增测试或运行implementation/regression/build。

30/30 existing hash/mode/presence MATCH，4/4 new paths ABSENT，24/24 unchanged boundary locks MATCH。无需修改contracts.ts、idSchema或stableIdPattern。原34文件的publication、production provenance、Tool/Skill、persisted evidence及coordinator/registry/permission责任保持完整设计范围；实现时发现新依赖仍STOP。

新增 **approval-r7d-c-production-prerequisites-expanded-34b.json**：**READY_AWAITING_EXPLICIT_APPROVAL / approved=false**，仅获批后取代implementation scope。仍为 **30 existing + 4 new = 34 EXACT**。两份migration文件名保持锁定且未创建：202609180001_agent_durable_skill_completion.sql / 202609180002_native_publication_contract.sql，责任不变。

Product changes0 / Migration changes0 / Tests implemented0 / Current DB reads0/writes0 / Agent0 / Provider0 / Deployment0 / PM2 mutation0 / Publish0。Current Build PjpaYHAz0asyvwh0G-lBo、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED为保留基线；Stage1G NOT READY。停止于34b实现批准之前。


## 18. R7D-C Expanded 34b — implementation and isolated validation

本次用户明确批准34b实现，并裁定publication migration为 `202609180002_native_publication_contract.sql`。独立completion migration仍为 `202609180001_agent_durable_skill_completion.sql`。新增 `r7d-c-34b-approval-resolution.json` 记录决定与编辑前核验；历史34/35/34b批准包、此前BLOCKED记录和compiler命名diagnostic全部原样保留。

实现范围核验：**30 existing modifications + 4 additions = 34 EXACT**；2个独立forward migration；删除0。原有测试预期、历史migration与历史evidence修改0。24个unchanged boundary全部hash MATCH，包括官方Manifest schema/id grammar、domain guard、StudentPolicy、public student-handlers、C2 private ledger。新compiler唯一为 **native-publication-1**；envelope/Manifest必须相等，无alias/normalization/slash fallback。

新的结果保存在 [expanded-34b-implementation](evidence/teaching-agent-stage-1f-r7d-c/expanded-34b-implementation/r7d-c-expanded-implementation-result.json)，避免覆盖父目录既有失败/阻断证据。此节只追加，不改写历史结论。

同一publication framework现在有严格versioned union：v1保持历史payload/hash/compiler/certification解释；v2 `canonical-native` 使用 `canonical-native-publication/1`。Capture来自同一个official captured graph；source node通过explicit `reference_activity_id` 验证完整关联。初版仅text/single_choice，每execution node最多一个counts-toward-completion Activity；多node可以存在。不支持的required media/cue/listening/speech、配置和聚合均拒绝，不生成开发Node5/Node7/cue/cursor。旧consumer在访问旧private payload前明确收窄v1，native/legacy交叉消费拒绝；显式legacy producer保留，不存在失败fallback。

Production读取经既有Student verifier与每次调用的private lease准入，使用固定server pg transport和数据库identity；一个REPEATABLE READ READ ONLY transaction内执行official repository/current、certification、dependency fence、Activity映射及trusted facts projection。Tool/Skill/Output1.1和activity-completion/3严格分版；v1.0与development v2不可满足production gate。最终输出只从verified Tool DTO生成，保留null/unavailable cursor；final revalidation不能刷新原receipt的asOf。这里没有发出真实CURRENT_PUBLISHED_DB receipt，所有正向production-wire验证均为明确标识的隔离fixture。

既有coordinator新增server-side intent dispatch；Profile1.1、request-local registry、PermissionPolicy与typed evidence采用精确版本。Explain1.0原profile/persona/instructions/Skill及definitionDigest逐项与C2基线完全相同；新增的内部intent只用于显式dispatch。Explain仍要求原lesson-context evidence，不强制durable Tool。Planning/corrective auto、final none，planning不预装completion。public summarize transport仍DEFERRED，未修改UI/route/student-handlers。

Persisted artifact2/typed trace检查全部mandatory evidence；Activity拥有独立typed field，不冒充segmentRef。SQL校验run/subject/tenant/content/Activity/version/provenance/time及matching trace/final output digest。新失败使旧成功失效。原Explain artifact1/segment gate、CAS/fencing、cancel wrapper保留，无新表/新store/新状态机。两份migration分别安装并以两种共同顺序验证，001无publication DDL、002无Agent completion DDL。

隔离PG使用自有临时容器、network none、无host port/mount、tmpfs PGDATA，结束后全部stop/remove。加载当前相关的13份真实historical migrations，包括110002 outer wrapper、130001 semantic capture、130003 PT409、140001 evidence与140002 cancellation；基础domain依赖是最小隔离bootstrap，**不声称重建current DB全部458份migration**。保存schema函数/约束/ACL指纹，确认无新增表。真实PG验证native并发CAS只有一个winner、READ ONLY MVCC不混合先后快照、retired/revoked/expired不可复活。

本次新增 **207 PASS / 0 SKIP / 0 FAIL**：native40、binding30、provenance29、publication SQL44、persisted SQL58、latest-chain legacy compatibility6。既有回归 **430 PASS / 3 SKIP / 0 FAIL**，其中C2本次重新执行 **52/52 PASS**；剔除C2为378 PASS / 3 SKIP / 0 FAIL。三个既有opt-in DB case未启用，记录为SKIP，不能冒充PASS。旧测试文件与expected未修改。完整日志、case清单和测试源码hash随evidence保存。

TypeScript、Next typegen、scoped lint（0 warning）、diff check均PASS。隔离build **dtQUY4hWv780Fx52x8nXq** PASS，34份源码与构建输入逐文件hash相同。使用local font fixture、fake localhost/public key和network-deny hook，所以只能是 **VALIDATION ARTIFACT ONLY / Deployment Candidate NO**。构建与34文件source archive在 `build/r7dc34b-validation-artifacts/`，SHA256已锁定；source archive是34-file patch，并非完整可部署源码。393个client/static与公开生成文件扫描未出现新private markers；DTO/trace/secret负向测试PASS。未读取current credentials来扫描，不声称完成真实部署后泄露验收。

已准备四份独立后续包，均approved=false且未执行。两个migration install包READY供单独审阅批准；application deploy包明确BLOCKED于真正production-compatible candidate及源码部署闭包锁定；readonly acceptance包明确BLOCKED于部署和精确published Student target/执行入口。额外列出6个既有未部署C2源码依赖，供未来40-file部署闭包审阅，**不是本轮新增产品修改或自动扩大部署授权**。禁止把validation archive直接部署，禁止Owner/B2替代production subject，禁止发布当前Frozen Draft来制造target。

Current DB reads0/writes0/migration install0/ledger mutation0；Agent0/Provider0/Deployment0/PM2 mutation0/Publish0/Pins0/Browser production requests0。现有B1/B2/B3/R7D Foundation历史保持。Current Build `PjpaYHAz0asyvwh0G-lBo`、Feature OFF、Allowlists EMPTY、B3 Scope DISABLED为保留基线，未访问线上重新核验。First Agent Run NOT AUTHORIZED；Stage1G NOT READY。到此停止，不安装、不部署、不调用Agent或Provider。


## 19. R7D-C3A — production candidate and acceptance target audit

本轮产品业务修改0；34b与两份migration源码hash全部保持。C2六个依赖逐项匹配原C2 final-validation记录。Fresh live Build仍为 `PjpaYHAz0asyvwh0G-lBo`，PM2同一进程online；无restart、HTTP Tool/Agent请求或部署。Live `.next` 的1416文件与R7D-B批准archive逐文件MATCH。

**40-file预测未成立。** 当前部署闭包是 **143文件：142 product + 1既有tsconfig构建配置**。其中34为34b，6为此前C2依赖，其余102产品路径来自已经构建并部署的R7D-B sealed source；live当时只同步8份源码，因此完整binary源清单与live文件系统并不一致。新增candidate复用该精确历史source baseline再覆盖40份锁定源码，没有导入其它workspace改动。143份路径逐项记录live/candidate presence、mode、hash、origin与理由；额外tsconfig只是历史sealed build已有的docs/evidence排除项。它们是后续明确部署范围，不是143个新产品修改。不得以此自动同步src或workspace。

真正production-compatible candidate **KeQ6bud_Us1ED6hnG7YB8** 已构建：正式next/font/google、live真实non-secret public配置、相同Node解释器、直接使用live已安装node_modules，package/lock/next config一致，无install、mock transport、fake key、localhost fixture或font substitution。Typegen/TypeScript/Next build PASS；1360-file完整source archive、143-file部署闭包archive和完整.next archive已锁hash。现有B3 child/media仅构建保全，不执行。旧validation Build `dtQUY4hWv780Fx52x8nXq`及其archive保留，未改名冒充production。

615个client/static/public/reference manifest文件扫描没有实际server secret、DB password、JWT、private subject ref或新authority marker命中；完整source输入未包含.env/runtime private配置。私有值仅在内存比较，未输出。没有读取current private answer，不能把本次扫描解释为线上Tool DOM验收。Candidate route集合与live完全一致。Live依赖56443文件hash在build前后相同，public15文件tree相同；dependencies/package/lock/public mutation0。

Rollback manifest锁定previous.next、143路径存在/缺失与mode/hash、launcher/runtime配置identity、package/lock、依赖/public树；不导出credential/token，不实际执行backup/切换。建议独立批准后先fresh preflight与backup，再001、002、application deploy、safe health，之后STOP。旧App+新schema在仍只有v1流量时临时安全；新App+旧schema对新能力fail closed；新App+新schema仍需要独立激活条件。Native v2或不兼容artifact2数据出现后只能version-aware forward fix，不能删除行或用旧reader回退。两个migration批准包只复核hash与规则，原样保留；458→459→460仅是未来fresh preflight需确认的顺序预期，本轮未查询ledger或安装。

执行2个明确的REPEATABLE READ READ ONLY事务，均ROLLBACK；仅做schema与目标discovery，没有读取真实学生作答。未找到以trusted Auth app_metadata明确标识的安全QA Student，也没有QA/acceptance/test slug的authoring候选。全库13条未知用途Activity关联只计数，不选择、不导出内容。Student read view存在；StudentPolicy不需放松。结论是 **TARGET_PROVISIONING_REQUIRED / DEDICATED_ACCEPTANCE_STUDENT_REQUIRED / expected facts NOT_LOCKED**，不是把UNKNOWN当zero。后续setup合同建议独立QA content+Student、zero attempts/progress，先锁触发器派生write budget和私有身份payload再申请可执行批准；本轮创建0。

入口是实际阻断：现有公开POST只支持Explain，且runtime会先admit persisted Run再调用Provider。仅将intent扩为summarize并不满足零Agent/零Provider只读验收。已记录正常未来Agent transport最小已知路径 `student-handlers.ts` 与负向测试，但**没有把这个一文件改动冒充只读entrypoint完整scope**。零Run只读入口涉及单独admission/operation架构决定，按STOP规则不设计后门、不伪造binding、不用Owner/B2/CLI身份；transport activation包保持BLOCKED draft。另有两个protected published-facts DB配置当前缺失，不修改runtime.json，未来验收前需独立锁定。

Application Deploy Approval现在READY，精确143路径+实际candidate archive供单独审批；Production Read-only Acceptance仍BLOCKED。Target setup仅合同设计供独立审阅，不是已批准或已锁定可执行write budget。Feature OFF、Allowlists EMPTY、B3 Scope DISABLED；Current DB Business/Auth Writes0、Migration Install0、Deployment0、PM2 mutation0、Agent0、Provider0、Publish0、Pins0、production browser requests0。First Agent Run NOT AUTHORIZED；Stage1G NOT READY。到此停止。

C2六文件的import审计进一步区分：5份有产品import consumer；`create-lesson-execution-skill-capabilities.ts` 没有产品importer，只作为完整C2源码/typecheck输入保全，未注册production。本次143路径采用完整sealed build输入与live源码对齐策略，不声称是tree-shaken最小runtime文件集。该分类和每个路径的direct importers已写入部署闭包与批准包。


## R7D-C3B — release stopped during fresh preflight

The explicitly authorized release stopped at STEP 1, before backup, migration installation, or deployment. Artifact hashes and both migration hashes match approval. Current Build remains `PjpaYHAz0asyvwh0G-lBo`; the 143 live source-path states match the C3A rollback manifest. PM2 `uply-first-enable` is online; feature is OFF and allowlists are EMPTY.

One current-DB REPEATABLE READ READ ONLY transaction confirmed ledger 458, both proposed migrations absent, all 43 reviewed function definition hashes matching, all four newly proposed functions absent, matching expected relevant constraints, and zero native v2 publication rows. However, `review_chapter_practice_binding(uuid,uuid,integer,jsonb,boolean)` has an extra `service_role` EXECUTE grant compared with the isolated baseline used by the approval packages. The function body hash matches. The discrepancy's cause has not been established; it is not automatically treated as an unauthorized grant or an acceptable baseline exception.

Per the explicit baseline-mismatch STOP rule, no grant was changed and neither migration was installed. No application/source deployment, rebuild, PM2 mutation, business/Auth write, Tool execution, Agent Run, Provider request, publication, or production browser request occurred. Fresh backup and post-deploy checks were not executed and are not claimed PASS. Historical approval and C3A evidence remain intact. Release is **NO-GO / BLOCKED** pending separate ACL baseline diagnosis. Acceptance remains blocked; R7D-C3C is not advanced.

Evidence: [C3B preflight](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-release-preflight.json), [C3B end state](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-release-end-state.json).


## R7D-C3B ACL Baseline Diagnosis — ACL-D1

Result: **BLOCKED_UNRESOLVED**. Release stopped correctly: function body SHA matched while ACL differed. This read-only diagnosis does not supersede the original NO-GO or approve resuming release. Two REPEATABLE READ READ ONLY catalog transactions completed with ROLLBACK; no target RPC was invoked.

The earliest located dated live evidence (`textbook-grammar-consistency-20260913/deployment-database-preflight.json`, 2026-09-13T02:52:53.957Z) already records service-role execution. The full schema bootstrap, recorded 2026-09-14 and matching its manifest digest, serializes both the target grant and postgres/public function defaults granting service_role. Current catalog agrees. This establishes historical presence, not the original grant event or target-specific least-privilege intent.

The target is SECURITY DEFINER, owned by postgres, with fixed empty search_path. PUBLIC and anon cannot execute. authenticated and service_role hold explicit EXECUTE grants, not PUBLIC/inherited access. Before writing, the function requires non-null auth.uid and an active Platform Owner helper check. Enable paths also enforce published source hierarchy, source equality and revision checks; disable uses Owner authorization and app/chapter/revision CAS. Extra EXECUTE exposes entry to this mutating definer function but does not bypass those explicit guards. No product service-role caller was found in workspace or live source. The actual action uses requireActiveUser -> cookie-backed Supabase server client -> authenticated RPC. Live source additionally has its existing Owner/non-tenant action guard; no source was changed.

**Confirmed isolated-baseline gap:** the 34b PostgreSQL 15 fixture uses minimal bootstrap and 13 selected historical migrations, omits the original 080001 CREATE, 080002 anon repair and Supabase function default ACL, and first creates this function via 130002 CREATE OR REPLACE. A live replacement preserves old ACL; creation in that fixture starts without the service-role grant. The two approved new migrations neither reference nor modify this target. The isolated manifest is therefore incomplete as a full live ACL baseline; it is not final permission-policy authority. PostgreSQL semantics: [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html), [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).

**Still unresolved:** available catalogs/snapshots do not timestamp the initial default grant or exclude a separate grant before the earliest observation. No explicit target-specific product/security requirement for service-role execution was located. Accordingly, default inheritance is a supported mechanism, not uniquely proven historical causation; historical persistence is not proof that the extra grant is the intended minimal contract. The primary classification remains BLOCKED_UNRESOLVED under the user’s non-unique-origin STOP rule. No reconciliation approval or forward ACL migration proposal is issued until original provisioning/DDL provenance and intended permission policy are resolved.

Candidate KeQ6bud_Us1ED6hnG7YB8 and all three archive hashes are unchanged; live Build remains PjpaYHAz0asyvwh0G-lBo. Migration/product changes, ACL mutation, migration installs, business/Auth writes, deployment, PM2 mutation, rebuilds, Tool calls, Agent Runs, Provider calls and Publish are all zero. Historical preflight and approvals are preserved. No tests were executed.

Evidence: [provenance audit](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-provenance-audit.json), [reconciliation decision](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-reconciliation-decision.json), [isolated gap](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-isolated-baseline-gap-analysis.json).


## R7D-C3B ACL-D2 — desired ACL contract and reconciliation design

**Design decision: REMOVE_SERVICE_ROLE_FORWARD_ONLY. Overall: READY FOR FORWARD ACL FIX APPROVAL.** This is a proposed future security contract, not a finding that the historical grant was malicious and not authorization to execute a revoke. Historical origin remains UNKNOWN; the user explicitly removed origin recovery as a prerequisite to choosing the future contract. D1 and the original release NO-GO remain intact.

One REPEATABLE READ READ ONLY catalog transaction retrieved the target, seven nearby public/postgres SECURITY DEFINER RPCs and authorization helpers. No RPC was executed. Target definition SHA remains `3d72415147051a92a0312f56bf6b60d81aa5e0e103aced878a20be21b5d96941`. Fixed empty search_path is safe for this audited body: application objects are schema-qualified, no dynamic SQL/caller-controlled identifiers exist, and no current_user/session_user identity shortcut is used. `auth.uid()` reads request subject claims, not the database role. Missing subject denies service-role requests; an active Owner subject can satisfy the current guard even under service_role, so extra EXECUTE is a real claim-gated entry to a definer mutation, not a system-maintenance capability. [PostgreSQL SECURITY DEFINER semantics](https://www.postgresql.org/docs/17/sql-createfunction.html).

The legitimate product path is the authenticated Owner browser session through the existing server action and cookie-backed client. It supplies reviewed_by attribution and retains source/app/status/revision checks. Local source, live source, and the sealed candidate all use this client path; no current service-role product/infra requirement or indirect caller was found. Generic publication, recording, Agent persistence and statistics RPC wrappers were traced to their own fixed operation sets. Admin-client imports in neighboring modules are used for other reads/worker RPCs and do not make these Owner authoring RPC calls service-role calls.

The seven-peer ACL pattern is **MIXED**: five historical script-review/completion-policy RPCs retain service_role, while the two closest newer content-creation/Activity-binding RPCs explicitly exclude it. All seven expose authenticated guarded Owner authoring paths; none establishes a target-specific service-role requirement. The decision combines the actual identity/attribution semantics, absence of a backend branch, explicit newer peer contracts, and preservation of known callers. It does not rely solely on absence of callers or default ACL history.

Proposed desired contract: postgres + authenticated EXECUTE; PUBLIC, anon and service_role denied. Keep body, owner, proconfig/search_path, defaults, role membership and all other RPCs unchanged. The only proposed ACL statement targets the exact five-argument function, with RESTRICT and strict catalog pre/postconditions. No migration file has been created.

Proposed filename: `supabase/migrations/202609180000_chapter_practice_binding_acl.sql`. It is absent and its version is unused. Repository release/rehearsal code sorts filenames and parses numeric versions; the inventory consistently uses 12 digits. Order is therefore 170001 < **180000** < 180001 < 180002. This puts separately approved ACL reconciliation before the original release preflight and 001. Supabase npm metadata was inspected; an optional CLI version probe failed because its telemetry file write was denied. No CLI database/migration operation ran; no permission escalation was needed for the source-based ordering audit.

Future order requires distinct approval: author/validate000 in isolation; issue exact-hash install approval; fresh historical-ACL/ledger preflight and backup; install000 and verify desired state; then renewed release authorization/preflight for001,002 and application deploy. If the last verified ledger458 is still exact, projected counts are459 after000,460 after001,461 after002. This turn did not reread ledger. Old approvals cannot silently inherit these new preconditions/order; revised metadata must preserve old packages. Current install is not included in the new authoring/isolated-validation draft.

Future tests distinguish **historical environment baseline** (three roles) from **desired security contract** (two roles). The original incomplete 34b manifest is preserved. The 23-case isolated plan covers first CREATE/defaults/replacement lifecycle, guarded service behavior before change, privilege denial after change even with Owner claims, authenticated Owner success and negative cases, drift rejection, strict idempotency/transaction rollback, unrelated ACL/default preservation, and separate/combined001/002 compatibility. No tests were implemented or executed this turn.

All three candidate archive hashes and both001/002 migration hashes remain exact. Candidate `KeQ6bud_Us1ED6hnG7YB8` needs no rebuild for this ACL-only proposal. Current Build remains `PjpaYHAz0asyvwh0G-lBo`. ACL/business/Auth writes, migration changes/installs, deployment, PM2 mutation, Agent/Provider calls and Publish are zero. Feature/allowlists/B3 remain OFF/EMPTY/DISABLED. C3B release remains BLOCKED.

Next package: [approval-r7d-c3b-acl-forward-fix.json](evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-acl-forward-fix.json), approved=false. [Decision](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-least-privilege-decision.json) · [Forward design](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-forward-fix-design.json).


## R7D-C3B ACL Forward Fix — ACL-F1

Result: **READY FOR ACL FIX INSTALL APPROVAL**. This user-approved turn authored only `202609180000_chapter_practice_binding_acl.sql`, corrected one isolated test helper, and added one contract test and one historical-environment fixture. Product source changes: zero. No current DB connection or migration installation occurred. The original C3B NO-GO, D1/D2 evidence, original unknown grant provenance, and incomplete original 34b ACL baseline remain historical facts.

The new migration SHA256 is `cc26f7b26a0aadcfa945ccf18a23ceac42ac5d772f1a0ac3eb9f5a776773d23a`. Its sole target change revokes service_role EXECUTE on the exact five-argument RPC. A single transaction verifies exact body SHA, owner, SECURITY DEFINER, language, volatility, parallel/leakproof flags, empty search_path, grantors/grantees/grant options, and effective permissions before and after. Unexpected state or a second direct application fails. Postcondition failure rolls back the revoke; defaults, other function ACLs and overloads remain unchanged. No function replacement, extension install, new table, default privilege change or unrelated grant is included.

The 23 approved plan categories map to **39/39 passing leaf tests**, including **26/26 negative tests** (Node reports 40 records including the parent). Real isolated calls prove that service-role Owner claims can reach the old guarded mutation, but fail at the privilege gate after000; authenticated active Owner enable/disable still works, while missing/non-owner/inactive subjects and stale/source/published conflicts reject. Test runner checksum skip is distinct from strict migration SQL; a forced postcondition error rolls back both ACL and simulated ledger insertion.

Two baselines are now explicit: the modeled historical environment has postgres/authenticated/service_role, while the desired contract has postgres/authenticated only. The full immutable application bootstrap also restores and validates, followed by nine reviewed incrementals and000/001/002; its isolated ledger model progresses **458 →459 →460 →461**. PG15 handles the minimal historical/lifecycle scenarios; PG17 restores the full application schema. Platform Storage/Realtime/JWT prerequisites are schema-only stand-ins, not a full Supabase/Auth E2E run. For the restore, image creation defaults are neutralized before the immutable application dump installs its own historical default ACLs at the end. No historical SQL is changed. Initial bootstrap diagnostics were confined to this new test setup and are disclosed in the evidence.

Related regression: **126 PASS /3 SKIP /0 FAIL**. The three existing PGlite tests lack a local module and are explicitly skipped; no dependency was installed or old expected result edited. Target authorization/CAS/source scenarios execute in the new owned PostgreSQL tests. Publication, completion, legacy compatibility, RLS surface and durability regressions execute separately. All disposable task containers are removed; data was tmpfs, network none, no host port or host data bind.

001/002 bytes remain unchanged. All three candidate archives and all six local/live caller source hashes match. Candidate `KeQ6bud_Us1ED6hnG7YB8` is unchanged and requires no rebuild. Live Build remains `PjpaYHAz0asyvwh0G-lBo` as retained state; no runtime operation was performed. Feature OFF, allowlists EMPTY, B3 DISABLED; current DB ACL/business/Auth/ledger writes, migration installs, deployment, PM2, Agent, Provider and Publish remain zero.

New [install approval](evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-acl-forward-fix-install.json) is **READY_AWAITING_EXPLICIT_INSTALL_APPROVAL**, approved=false. The [reconciled preflight baseline v2](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-reconciled-preflight-baseline-v2.json) preserves old packages and records historical three-role ACL before000, two-role ACL after000/001/002, and revised ledger preconditions459 for001 and460 for002. Future separately approved order: preflight → backup →000 → verify →001 → verify →002 → verify → sealed candidate deploy → safe health → STOP. This is not install/deploy authorization. C3B release remains blocked; C3C and Stage1G remain NOT READY.

[Result](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-forward-fix-result.json) · [23-category mapping and logs](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-forward-fix-isolated-tests.json) · [Source lock](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-forward-fix-source-lock.json).


## R7D-C3B ACL Exact Install Attempt — ACL-F2

Result: **NO-GO / EXACT_SINGLE_MIGRATION_RUNNER_UNAVAILABLE**. The user explicitly approved current-DB installation of000 only. Local fresh checks confirm000 SHA `cc26f7b26a0aadcfa945ccf18a23ceac42ac5d772f1a0ac3eb9f5a776773d23a`, immutable001/002 hashes, all three sealed candidate archives,1337 product source hashes and six local/live caller locks. Live Build file is still `PjpaYHAz0asyvwh0G-lBo`; runtime configuration remains Feature OFF/allowlists EMPTY. Candidate `KeQ6bud_Us1ED6hnG7YB8` is unchanged.

Installation stopped under this turn's explicit section12 rule. The available R5B runner admits exactly the old eight202609140000..007 migrations, fixes its ledger prefix at449, and its production transport validates the same package and449 backup contract. It has no guarded single000 entrypoint. The historical B1c single170001 install receipt confirms an earlier transaction but provides no currently located reusable executor. F1's `track()` deliberately models an isolated runner; it is not a current-DB installer. Extracting transaction fragments, monkey-patching old locks, building a temporary installer or using db push would not satisfy the specified execution boundary.

F1's READY state established SQL/isolated-contract readiness, not availability of this exact production execution path. Its historical result remains unchanged. This turn contacted no database, dispatched no migration and created no fresh backup. Consequently ledger458 and the three-role live ACL are **last verified history**, not fresh F2 observations; there is no claimed post-install PASS. All current DB ACL/business/Auth/ledger writes, deployment, PM2, Agent, Provider and Publish actions are zero.001/002 were not executed.

C3B ACL Fix and release remain BLOCKED. No release-resume approval was generated because000 did not install. The next requirement is a located, reviewed compatible single-migration runner, or separate scope approval for a locked runner with isolated validation and fresh recovery integration. The user's000 authorization is recognized; asking for that same authorization again does not resolve the missing execution capability.

[Fresh preflight and runner audit](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-f2-fresh-preflight.json) · [No-dispatch receipt](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-f2-install-receipt.json) · [End state](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-acl-f2-end-state.json).


## R7D-C3B Controlled Exact Single Migration Runner — RUNNER-D1

Result: **READY FOR SINGLE MIGRATION RUNNER IMPLEMENTATION APPROVAL**. This turn is local source/ops audit and design only: no current DB connection, tests, operational implementation, migration edit/install or deployment. F2's `EXACT_SINGLE_MIGRATION_RUNNER_UNAVAILABLE` remains a truthful historical/current execution blocker; this design does not claim that a runner now exists.

Scope is exact: **0 existing operational modifications +10 new operational files**, plus3new tests,2new fixtures and1README (**16 new implementation files total**). All proposed paths are absent.31read-only source/evidence dependencies are SHA-locked. R5B's eight-migration engine/transport/package and F1's isolated runner remain byte-identical. No product/migration/package changes, legacy deletion, fallback or arbitrary SQL interface is proposed.

The engine consumes one immutable registered plan per invocation. Plan bytes, approved path/version/name/raw SHA, independently pinned body range/hash, check registry, target profile, backup/restore receipt and exact operator authorization must match. CLI accepts registered names only, with preflight/backup/apply/verify modes; no arbitrary paths/SQL/force/skip/batch. Plan presence or READY status is not approval. Existing repository authorization is a privileged operator's hash/window-bound attestation; it is not cryptographic verification of a chat message, and the runner must never issue its own approval.

Offline B1c catalog confirms `supabase_migrations.schema_migrations(version text PRIMARY KEY, statements text[], name text)` with no checksum column. Honest installation stores the entire original SQL as the sole statements-array element, atomically with the one migration body. Full existing rows (including statements/nulls) are protected by a deterministic PG17 JSONB source-prefix digest, alongside458count, exact version list/latest/duplicates checks. The recorded458version-list digest is `bd04943d80081d131eab351aa20a88e533d362204931f2a5829597561d257310`. A fresh full statements-inclusive prefix has **not** been captured in this DB-forbidden turn;000is only a designed DRAFT, and cannot become executable until separate RO capture and review seal that value. No historical SQL reconstruction is passed off as actual ledger contents.

All000/001/002files contain outer BEGIN/COMMIT wrappers. Raw embedding is incompatible with an engine-owned transaction. The proposed reviewed registry pins exact byte ranges and body hashes for outer-envelope-only removal; original files remain unchanged and complete raw SQL remains in the ledger. PL/pgSQL BEGIN/END remains intact. A bounded top-level lexical guard supplements hashes; it is not a generic SQL parser or authority for unreviewed files. Atomic support is therefore **designed through this explicit envelope contract**, not falsely claimed for raw concatenation.

Apply rechecks inside one READ COMMITTED session after shared migration advisory key `(4171,100)` and the ledger table lock. It performs body, honest INSERT and all precommit postchecks, then COMMIT once and independent readonly verification. Wrong baselines, mutation/ledger/precommit check failures roll back; missing COMMIT acknowledgement is UNKNOWN, never retry. Confirmed-commit verification failure requires forward diagnosis. Cooperative locks do not block arbitrary external privileged DDL; the maintenance window excludes other migration operators and catalog rechecks detect drift.

Backup integration has a complete proposed adapter rather than an assumed reusable449entrypoint. It follows the existing R4D/R5C pg_dump exported-snapshot, full/schema/roles archives,700/600permissions, seals,900second freshness and owned network-none restore procedure under the existing backup root. Legacy class guards are preserved. The new adapter binds plan ledger/target and recovery fingerprints; source credentials never enter plans/evidence/restore containers. Actual current backup/export is a later separately authorized operation. Schema-only platform stand-ins are restricted to future owned implementation tests, never production evidence.

The future000plan preserves exact three-role precondition and two-role postcondition, body SHA and all other ACL/default/schema protections.001/002use the same engine with later independent plans, approvals, receipts and fresh matching backups; no automatic next migration. **51 planned tests** cover contract, transaction/ledger atomicity, failure/UNKNOWN states, concurrency, identity, backup/restore, privacy and the three separate458→459→460→461fixture invocations. No tests executed this turn.

[Implementation approval](evidence/teaching-agent-stage-1f-r7d-c/approval-r7d-c3b-single-migration-runner-implementation.json) is **READY_AWAITING_EXPLICIT_APPROVAL**, approved=false. [Exact scope](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-exact-scope.json) · [Plan schema/000blueprint](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-sealed-plan-schema.json) · [Transaction contract](evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-transaction-contract.json). C3B release remains BLOCKED; C3C/Stage1G NOT READY; first Agent Run not authorized. Candidate `KeQ6bud_Us1ED6hnG7YB8` unchanged by this turn; no rebuild.


## R7D-C3B-RUNNER-I1 — Controlled exact single migration runner implementation

2026-09-18：按明确批准的 RUNNER-D1 machine scope 完成 0 MODIFY + 10 ADD operational files、3 tests、2 fixtures、1 README，共 16 个新增实现路径。未修改 product source、既有 ops、F1 资产或 000/001/002。31 个只读依赖的 SHA256/mode 全部 MATCH；1,337 个产品源文件和 461 个本地 migration 文件保持原样。

新 engine 为 `EXACT_SINGLE_MIGRATION`：有限 registry/strict plan、原始 plan bytes hash、三份 reviewed envelope/body hash、完整 statements-inclusive ledger prefix、固定 advisory lock `(4171,100)`、同一 outer transaction 中的 body + honest ledger INSERT + precommit postchecks。没有 arbitrary SQL/file/DSN/force/batch 接口、自动 retry、自动 next migration 或历史 runner fallback。

Owned PG17 验证了真实 000 的 458 → 459；三个独立 synthetic plan/backup/receipt/invocation 完成 458 → 459 → 460 → 461。Migration、ledger、precommit postcheck 失败均回滚；并发仅一个 apply 成功。Commit ACK 丢失保持 UNKNOWN_COMMIT，独立只读核验分别识别 COMMITTED_VERIFIED / NOT_COMMITTED_VERIFIED，原 attempt 永久保留。

Backup adapter 复用 R4D 的 exported READ ONLY snapshot、full/schema pg_dump、no-password roles、owned restore、catalog/count comparison 和 seal 流程；没有调用或改写历史 stage runner。pg_dump 对显式 owner-only 默认 ACL 的省略，在 owned restore 中按原语义补齐后再执行精确 catalog 比对。Role capture 不具备同一数据库 MVCC snapshot 原子性，必须 before/after fingerprint 相同。完整历史 catalog 与 34b minimal domain bootstrap 明确区分；34b completion/publication 合同没有放松。

测试：RUNNER-D1-01..51 全部逐项映射，51 executed / 51 PASS / 0 FAIL / 0 SKIP；核心安全跳过 0。现有 Node 回归 155 PASS、R5B 原有本地 unit 17 PASS，合计 172 PASS / 0 FAIL / 0 SKIP。R5B 在 byte-identical historical eight-migration temporary tree 中重放，原 evidence 未覆盖。历史 F1/34b helper 的 owned PG15 合同未修改；所有新 runner core/backup 验证及 F1 full-bootstrap 使用 PG17。Python syntax、JSON、命令安全、path/hash/secret boundary、scope diff PASS。Owned runner containers 剩余 0。

本轮 current DB connections/reads/writes、current migration installs、real backups、credential access、deployment、PM2、Agent、Provider、Publish 均为 0。Current Build 继续保留 `PjpaYHAz0asyvwh0G-lBo`（本轮未重新读取 live 状态），candidate `KeQ6bud_Us1ED6hnG7YB8` archive hashes ALL MATCH，未 rebuild。Feature OFF、allowlists EMPTY、B3 DISABLED、Stage1G NOT READY 均保持。

**Production `acl-000-v1` 仍为 DRAFT_NOT_EXECUTABLE。** 未捕获/伪造 fresh production ledger prefix、descriptor、target identity、backup/restore identity 或 operator authorization。Runner 不实现自动 seal/READY；DRAFT CLI 在读取 credential 前拒绝。Operator attestation 是受信 OS 操作员边界，不是机器对聊天批准的密码学验证。

Outcome：READY FOR CONTROLLED PRODUCTION PLAN PREFLIGHT APPROVAL；C3B release 仍 BLOCKED，R7D-C3C NOT READY，First Agent Run NOT AUTHORIZED。新增 `approval-r7d-c3b-runner-controlled-preflight.json` 仅为 approved=false 的下一阶段 READ ONLY capture/review 批准草案。该阶段必须绑定已审阅只读采集过程；本轮没有提前实现 production DRAFT capture/sealing。任何新增实现路径或 guard 变更仍需独立精确批准。禁止据此安装任何 migration、执行真实 backup 或 deploy。

Evidence：
- `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-implementation-result.json`
- `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-source-lock.json`
- `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-contract-tests.json`
- `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-isolated-postgres.json`
- `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-backup-tests.json`
- `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-runner-000-plan-readiness.json`
- `docs/evidence/teaching-agent-stage-1f-r7d-c/runner-i1-validation/`


## R7D-C3B-RUNNER-P1 — Read-only capture stopped before connection

2026-09-19：本轮 READ ONLY capture 已获用户明确批准。Fresh local preflight 确认 10/10 operational files、31/31 read-only dependency locks、000/001/002 raw/body hashes、三个 candidate archive hashes 全部 MATCH。未修改 runner、draft、migration 或历史证据。

Overall BLOCKED：`BLOCKED_DRAFT_PRODUCTION_READONLY_CAPTURE_ENTRYPOINT_UNAVAILABLE`。现有 runner.py 在进入任何 CLI mode 前执行 `plan.ensure_ready()`；plan_contract.authorize、Production MaintenanceTransport constructor 和 Engine constructor 也要求 READY。授权校验还依赖本次 capture 尚未取得的 ledger descriptor/catalog fingerprints。现有 preflight 是对既有 READY plan 的核验，不是首次 baseline capture。I1 的 51/51 tests 验证 DRAFT 全部拒绝，未覆盖 production DRAFT capture 的可执行能力；此前 READY 是批准草案状态，不应被解释成已有可执行入口。

按照本轮第40条，在 current DB connection 之前 STOP。没有生成临时 psql、绕过 private session、伪造 READY、借用历史 transport 或补填 fixture digest。Current DB connections/reads/writes、credential access、ACL/ledger mutation、migration install、backup/restore、deploy/PM2、Agent/Provider/Publish 全部 0。Ledger、function、ACL、target/runtime/build/PM2 等 fresh live 值未观察，P1 evidence 以 null / NOT_CAPTURED 记录；不冒充 fresh PASS。

新增 11 份 P1 evidence；Plan Seal Approval BLOCKED，未生成 seal approval。另生成 approved=false 的 `approval-r7d-c3b-runner-readonly-capture-entrypoint-implementation.json`：建议未来独立修改4个现有ops文件、2个现有test文件和README，共7 MODIFY / 0 ADD，新增严格独立的 read-only capture 授权/入口，并保留现有 READY/apply guard、DRAFT raw hash、registry、transaction/backup及所有历史合同。本轮未实施该修订。Candidate KeQ6bud_Us1ED6hnG7YB8 hashes ALL MATCH，未rebuild；production000仍 DRAFT_NOT_EXECUTABLE。C3B Release BLOCKED，Stage1G NOT READY。


## R7D-C3B-RUNNER-P1A — Separate read-only baseline capture entrypoint

Implemented the explicitly approved 7 MODIFY / 0 ADD scope: four operational
sources, two tests and one README. Product sources, migrations 000/001/002,
transaction/backup/receipt implementations, registry, target profile, DRAFT bytes,
fixtures and historical tooling remain unchanged. The P1 blocked record is preserved.

`capture --plan acl-000-v1` now requires a distinct, explicit
READ_ONLY_BASELINE_CAPTURE authorization binding the registered DRAFT raw hash,
reviewed migration raw/body hashes, package identity, fixed target and fresh
operator authorization. It does not require the future ledger/catalog digest.
All historical install modes still reject DRAFT. Capture cannot construct Engine,
execute backup/restore, mutate/seal the plan or authorize an install.

Capture uses one REPEATABLE READ READ ONLY session and ROLLBACK. Fixed ledger
count/version/descriptor checks precede protected catalog reads; mismatches stop
before that query family. Function/security/ACL/effective privileges are then
checked. Production requires the fixed runtime/project/DB/image identity and TLS.
Receipts contain safe metadata/fingerprints, never raw ledger statements or function
bodies. First capture records the unknown source digest; a separately pinned digest
can reject a subsequent same-count source-history mismatch. No fixture digest is
substituted for production history.

Validation: all 51 historical runner tests rerun and passed; 27 new capture tests
passed; existing Node/R5B regression 172 passed, zero skips/failures. Owned PG17
proved actual write rejection, one snapshot, ledger-first early stop, unchanged
before/after catalogs and receipt safety. Owned containers were removed. Final
syntax/JSON/scope checks passed; 40 unchanged source/dependency locks matched.
The initial two new test setup errors were corrected within the approved test files;
no historical assertion was weakened.

All current DB connections/reads/writes, production credential access,
production backup/restore, migration installs, deployment, PM2 mutation,
Agent/Provider/Publish and candidate rebuild counters remain zero. Candidate
KeQ6bud_Us1ED6hnG7YB8 hashes match. Production acl-000-v1 remains
DRAFT_NOT_EXECUTABLE. The new controlled-preflight-v2 approval is
READY_AWAITING_EXPLICIT_APPROVAL, approved=false; no capture authorization was
issued. C3B release remains BLOCKED; C3C and Stage1G are NOT READY.


## R7D-C3B-RUNNER-P1B — Capture stopped before credential access

The user explicitly approved production read-only capture and a capture-only
operator artifact. Fresh 10-file operational locks, immutable dependencies,
migrations 000/001/002 and all three candidate archives match. Runtime package
digest is 7794a4d2ba30a36ba9362b4c6d782f92ec81448ed41a627ec51545d24902538e.
Local build was freshly observed as PjpaYHAz0asyvwh0G-lBo; pinned runtime/launcher
hashes match, the feature is OFF and allowlists are EMPTY.

BLOCKED_CAPTURE_FUNCTION_GATE_ORDER_MISMATCH: P1B section 25 requires the target
function contract to pass before reading the complete protected catalog. The
locked checks.py implementation instead validates the ledger, calls observe()
(the complete CATALOG_SQL query), then checks function/ACL and definition hash.
P1A validated ledger-first behavior; it did not establish this stricter
function-before-catalog boundary. This is not missing user permission.

Stopped before authorization artifact creation, production credential access,
DB connection or capture command execution. No alternate transport, temporary
SQL or source modification was used. Fresh DB values remain NOT_CAPTURED/null;
no fixture or historical digest was substituted. PM2 and independent B3 status
were not reobserved. Backup capability review was not completed after STOP.

Eleven new P1B evidence files record the blocker and verified local locks. No
plan-seal proposal was generated. DRAFT bytes are unchanged. Current DB reads,
writes, ACL/ledger mutations, installs, production backup/restore, deployment,
PM2 mutation, Agent/Provider/Publish and candidate rebuild remain zero. C3B
release is BLOCKED; C3C and Stage1G remain NOT READY.


## R7D-C3B-RUNNER-P1C-I1 — Stopped before edit: v3 authorization reference outside scope

The explicitly approved three-file pre-edit hashes and all immutable boundary
locks match. Candidate archives also match. No source or test was edited.

BLOCKED_CAPTURE_V3_APPROVAL_REFERENCE_SCOPE_MISMATCH: plan_contract.py:183 fixes
CAPTURE_APPROVAL to controlled-preflight-v2.json; lines 236–239 enforce both its
exact reference and bytes/hash. A v3 operator reference is rejected before any
credential read. The query-order repair alone fits checks.py plus the two test
files. However, this turn additionally requires v3, forbids using v2 as the new
production capture authority, and explicitly prohibits a fourth path or a
plan_contract.py change. The earlier P1C design's retained-v2 lineage assumption
cannot override that newer requirement.

Section 53 STOP therefore applies before implementation. No v3 READY proposal,
authorization workaround, old-evidence overwrite or source patch was produced.
Nine forward evidence files record the blocker. The required 51 + 27 + 20 tests
and 172 regression checks were NOT RUN; historical passes are not presented as
fresh validation. A separate scope decision is required for the fixed v3 approval
reference (potentially 4 MODIFY / 0 ADD, not approved here).

Current DB connections/reads/writes, production credential access, migration
installs, production backup/restore, deployment/PM2, Agent/Provider/Publish and
candidate rebuild remain zero. Production000 stays DRAFT_NOT_EXECUTABLE; C3B
release remains BLOCKED; C3C and Stage1G remain NOT READY.
