# Phase 4B-1B：正式 Runtime 入口接线与发布影响验证

日期：2026-09-10。基线：4B-0 前置核验、4B-1A Publish Foundation。**代码实现不等于实际部署。**

## 1. 隔离交付边界

- 工作副本：`/tmp/uply-phase4b1b.WHog5G`。从当前脏工作区完整复制源码/测试/migrations，保留此前未提交的变更；独立 `node_modules`，不是指向运行目录的 symlink。
- 排除 `.env`/`.env.local`、Supabase 连接缓存、`.next*`、部署缓存；`.env.example` 仅为既有测试读取的模板，不参与 Next 环境加载。
- 所有实现、SQL、Chromium、TypeScript、Next build 都在副本执行。没有将业务修改回写到 `/home/yangzhen/projects/my-lms-system`，避免现有 dev 服务热加载。
- 本报告及交付 patch 可以保存在原项目 docs；它们不是上线动作。patch 需要以后在合适的隔离发布流程中审查应用，**不得直接套进正在热加载的工作目录**。
- 交付 patch：`docs/SMART_TEXTBOOK_RUNTIME_V1_PHASE_4B1B_APPLICATION.patch`（仅代码、migration 和测试的相对路径差异；报告独立保存）。隔离副本保留完整源码、构建结果和前阶段基线；没有覆盖用户未提交代码。
- 实施前后对原 `page-content.tsx` 和 `production-learning-boundary.server.ts` 做 SHA256 比对，均与复制基线一致。

## 2. 实际应用调用链

```text
原 course page-content
  现有身份/分类/课时/会员/章节顺序检查
  → runtimePageDecision（仅第一章、非 owner audit）
      legacy：原 loadSmartDigitalTextbook → 原 SmartTextbookShell
      unavailable：明确服务拒绝，不降级提交方式
      runtime：PublishedRuntimeEntry
         POST /api/smart-textbook-runtime/learning (bootstrap)
         → runtimeAdmissionPolicy + assertRuntimeDependencies
         → 已有 Published Loader / durable SQL LearningSession
         → 同一 snapshot 的既有 Learning / Recording / Teacher ports
         → LessonRuntime validationMode="complete"
```

新增路径是正式应用形态，不是 audit Route。正式代码没有 fixture、Preview store 或合成 bytes 分支。测试替换的是认证、SQL 和对象传输，不是 Renderer/Loader/领域实现。

|文件|职责|
|---|---|
|`src/app/.../[lessonSlug]/page-content.tsx`|只追加默认关闭的选择分支；原访问检查和旧 Shell 保留|
|`server/application-access.server.ts`|每次正式请求重查会员、分类/course/lesson/chapters 的 published 可见性；复用 `isLessonUnlocked`、`getUnlockedChapterSlugs` 和 overview completion Reader|
|`server/application-admission.server.ts`|服务器开关、DB cohort、Recording 真实依赖、严格 capability admission|
|`server/application-runtime.server.ts`|安装既有 `createProductionLearningBoundary`、`createTeacherRuntimeBoundary`、`productionTeacherBackend`；请求级 AsyncLocalStorage，不接受浏览器身份|
|`server/application-http.server.ts`|同源检查、限流式 body 上限、JSON/multipart 封包、统一安全错误与 byte response|
|`src/app/api/smart-textbook-runtime/{learning,teacher}/route.ts`|薄 POST Route；复用上述应用组合|
|`components/published-runtime-entry.tsx`|仅 bootstrap、HTTP ports、opaque locator restore、加载/拒绝状态；调用已有 strict complete Renderer|
|`server/production-learning-boundary.server.ts`|增加可选请求 guard；正式安装点必传 guard，既有隔离/审计调用不改变|

上述 server/components 路径前缀均为 `src/features/smart-textbook-runtime/`。没有新增平行 grader、Agent 状态机、Recording bucket/table 或 Renderer。

## 3. Admission 与 Recording 域边界

### 3.1 默认关闭与统一停止

服务器部署 ceiling：`SMART_TEXTBOOK_RUNTIME_ADMISSION_ENABLED`，只有精确 `true` 才继续，默认关闭。客户端 query/header/cookie/body 不能修改它。

独立 migration：`202609100003_runtime_admission_control.sql`，只在 network-none disposable PostgreSQL 执行：

- `runtime_publish_private.admission_control`：singleton、enabled=false、revision=1、空 cohort。
- `runtime_admission_state_v1(tenant,student)`：service-role-only，只返回该可信身份是否入组与 policy revision，不公开成员名单。
- 只有服务器可信身份参与 cohort 匹配；管理员/owner audit/其他章节不进入 formal learner 模式。
- 控制表不授权匿名、普通用户、service_role 直接写；本阶段不提供管理 UI 或可从浏览器调用的切换 Action。将来由获批控制面操作，不把数据库管理员权限伪装成普通 owner 浏览器会话。
- 每次决策重新读 DB，绝非进程 TTL cache。DB enabled=false 统一停止新 admission，无需 PM2 重启；revision 单调递增覆盖 ABA。
- session issue 前后重查政策。政策变化时撤销刚创建的 locator，返回拒绝；真实 SQL trigger 测试覆盖签发中关闭。

### 3.2 Recording 是实际依赖，不是可选 Preview 替代

`assertRuntimeDependencies()` 检查：

1. 当前课程、课时与章节权限。
2. 现有 `recordingEvidenceV2` 对同一个可信 learner/tenant 必须得到 v2。
3. 当前 env epoch / instance 必须与 DB open、enabled、cohort、acknowledged epoch 一致。
4. 应用 `EnvironmentRecordingProofKeyProvider` 的 key 必须与 DB enabled key 相同。
5. 所需 Recording consume/roleplay/delete/协调 RPC 的**精确签名及 service_role EXECUTE**存在。
6. R2 配置存在且 origin 形态有效；已发布 snapshot/private fence/完整 Runtime capability 可用。

新增 `runtime_recording_dependency_v1` 是只读探针：短时 nonce + purpose-separated HMAC，绑定 tenant/student/epoch/instance/keyId/时间；DB 核验 enabled key。既不返回 key，也不签发 evidence proof、写 attempt 或取得消费权限。未来每次真实 Recording 操作仍进入已有 `withRecordingDomain → gateway → proof/RPC`，不以探针结果绕过 lease。

缺迁移/函数、关闭或不匹配 key、wrong epoch、非 Recording cohort、无发布快照、无权限都会拒绝新 Runtime。没有 Preview/旧录音补成功路径。

R2 配置存在不被描述为所有远端对象已实时 HEAD；实际 speech/character/listening/recording 继续走原授权服务与 byte proxy，远端故障保持既有错误/fallback。生产对象健康检查仍属未来授权的上线前置，本轮未触碰生产对象。

### 3.3 停 admission 不等于 Recording rollback

- 新页面请求停止后走原 Shell；原 Shell 已含 Recording coordinated gateway，而不是回到不认识 v2 metadata 的旧 binary。
- 已挂载/已签发 session 可按原 TTL 继续或用 opaque locator 恢复，保持旧 snapshot；不自动迁移 pointer、不清除 consumed/lifecycle/runtimeBinding。
- 这不保证页面路由仍展示新 Runtime：完整课程页刷新会重新执行 gate；关闭时返回旧 Shell。HTTP resume 仍能验证既有 locator，是独立的会话语义。
- Recording drain/fence/epoch/key 故障仍独立 fail closed；不因 Runtime gate=false 自动切 v1，不修改既有排空/回滚协议。
- App guard 的重复检查只在**一个 HTTP 请求内部**合并；跨请求仍重查。每个领域写入继续自己的事务/权限检查。

## 4. 权限、公开 DTO 与生命周期

保留现有页面验证，正式 API 另行验证，不能借一个有效 session 跳过后续会员/课时/章节锁定。复用旧 evaluator，而非另写学习顺序判定。没有 platform_owner 审计 bypass：正式 cohort 限 student。

公开内容仅 Manifest、RuntimeContext、ServerLearningState、catalog 稳定 service refs、mount continuation 与 opaque sessionRef。Teacher 只接收 opaque Teacher session/cue；raw speech ID 由服务器调用原 speech Route。复用 `audit-speech.server.ts` 中**纯授权 byte proxy helpers**，不调用 audit Route、audit 编译器或 Preview store。

JSON payload 不公开 objectKey、signed URL、proof、key、tenant/student 参数或 private capture。body 上限 11 MiB，JSON envelope 上限 64 KiB；multipart 只接受 request/recording。异常不输出内部错误对象；无跨站 POST。客户端请求 shape 继续由既有闭合边界校验。

客户端 StrictMode 重复挂载共用 in-flight bootstrap；sessionStorage 只保存不可信 opaque locator。失效 locator 明确拒绝，不偷偷创建新版本会话；用户可清除旧 locator 后重新检查 admission。Renderer/Step cleanup 仍由原实现负责。

使用 `ui-styling` 技能检查薄入口的可访问状态：中文 `role=status` 加载、`role=alert` 失败和原生键盘可用按钮；没有新增风格、装饰标签或重做课堂布局。

Learning session locator 和 snapshot 关联持久化 SQL，pointer 更新不影响已签发 session。既有 Learning/Teacher 的**presentation generation/handle**仍为进程内状态，重启后须重建，不能把旧 handle 无条件跨副本继续使用；Agent/学习正式状态仍由原 DB Reader 恢复。多副本粘性/handle 重建运维验收仍为上线前置，不声称本轮创建了分布式 Teacher owner。

## 5. 发布后编辑影响：真实 SQL，不是内存 detached draft

|对象/操作|隔离结果|性质与影响|
|---|---|---|
|已发布 Activity public_config / answer_key|事务拒绝|设计要求：原版显示与原版判题一致|
|已发布 Teacher script|事务拒绝|设计要求：v23/Agent 依赖固定|
|独立新 version/chapter/module/node/activity/secret 创建、编辑|SQL 成功|新身份行不改变原捕获集合；不是所有 authoring 都被冻结|
|新 version 直接设 published 状态|SQL 可写|**不等于**整个新教材已通过正式发布；不能用此状态写入当 Publisher 正向验收|
|新身份 capture → 现有 compiler|拒绝|当前 Reader/冻结 identity ledger 只支持原第一章身份集；没有新版本 identity/copy-on-write 生产流程|
|旧 `publish_digital_textbook_chapter` 发布新 version 的 chapter|事务拒绝|原 RPC 会更新共享 chapter_test / textbook 的 updated_at，触发原 snapshot fence；此前测试题状态写入一起回滚|
|其他 chapter 独立 title 编辑|SQL 成功|普通未捕获章节行可编辑，但仍共享 authoring advisory lock|
|旧 RPC 发布另一 chapter|事务拒绝|同样会触碰已固定的共享父记录/关联测试；是工作流阻断，不应宣称“其他章节完全不受影响”|
|共享 learning_agent_profile display_name/config|事务拒绝|同 profile 的其他章节也不能原地修改该共享教学依赖|
|digital_textbooks title/status/updated_at|事务拒绝|冻结完整父行，包括非教学审计时间；扩大了编辑影响面|
|已有 media production_status/metadata 更新|事务拒绝|不能在原 snapshot 下把 pending 原地改 ready；需要新发布依赖策略，不能绕过 fence|

测试使用真实 SQL INSERT 克隆独立版本子链（最小链，不是假称已克隆完整 16 章），执行原 `publish_digital_textbook_chapter` 函数体；不是只修改 detached JSON。当前**新版本完整发布工作流不可用**，不做相反结论。

原 publisher/fence 没有在本轮放宽。共享完整行保护虽然防止 TOCTOU，但旧发布函数先 `FOR UPDATE` 多个 parent/child、随后 statement trigger 取得 authoring lock；与新 publisher 并发时还需要评估锁序/受控维护。单请求影响测试通过不等于所有旧 authoring 工作流可立即与新 publish 并跑。

### 需要用户决定的工作流/共享依赖策略

1. 是否采取完整 copy-on-write 新版本（包括共享 Teacher profile/test 及身份映射），还是批准区分语义字段与审计字段的固定依赖策略。
2. 原章节发布 RPC 如何避免触碰其他快照固定的 parent/shared rows，并统一锁序。
3. pending→ready 内容制作更新应进入怎样的新 revision/publish 流程。

本轮仅验证并报告，不实现后台编辑器、不克隆其他章节、不修改共享依赖或教学业务语义。上述决策阻断后续上线/编辑流程开放，不否定原固定第一章的旁路技术接线。

## 6. 隔离验收

`tests/smart-textbook-runtime-4b1b.test.mjs` 使用实际新 Route / application HTTP composition / PublishedRuntimeEntry；认证与课程数据明确合成，source 为仓库冻结真实第一章，答案为既有隔离 grader transport，DB 为 network-none PostgreSQL，R2 签名/bytes 仅在测试覆盖。

- 默认 gate=false、非 cohort、其他章节、owner audit → legacy 决策；课程分支仍保留旧 Shell，Next 构建验证实际入口可编译。
- env + DB 测试 cohort → 正式 publisher 已发布数据 → durable session → strict complete Runtime。
- policy 关闭重叠 issue、无效 policy、ACL、缺函数/key/epoch/媒体配置、无快照、权限/手工锁定、错 owner、未知/过期 session、跨站请求拒绝。
- pointer A→B，原应用 bootstrap 仍 A，新 session 为 B；新 admission 关闭后不签发新 locator，旧 locator 仍固定。
- Chromium 使用实际新增客户端组件和 HTTP transport，3 道 orientation / 8 Step 导航、提交、Teacher、reload、停止 admission；不是原 audit browser harness。
- 课程整页的登录/Server Component 外层没有冒充真实用户 E2E；完整浏览器采用隔离 HTTP host，直接挂载实际应用组件，服务实现不替换。旧 Shell fallback 是实际 RSC 分支 + gate 决策验证，不宣称本轮用真实用户进入线上旧 Shell。
- 8 Step / 19 Activity / orientation 3 / v23/稳定 IDs 不变；Phase 3E selector、旧 Recording/Agent/判题与所有 Renderer 未改。

## 7. 测试和构建结果

全量运行：**1178 项，1174 passed / 0 failed / 4 skipped**，327.9 秒；其中本轮 4B-1B **8/8 通过**（含 parent），实际应用 Chromium 99.0 秒。四个 skip 是未自动找到 PGlite 的既有 SQL 测试，随后使用已有本地 PGlite **补跑 4/4 通过、0 skip**。因此合计 **1178 个唯一用例全部通过**，不是虚称首轮没有 skip。TypeScript 非增量检查、`git diff --check` 通过。

命令均在隔离副本，无 `.env.local` 或生产 URL：

```sh
node --no-warnings --experimental-strip-types --test --test-concurrency=4 tests/*.test.mjs
LMS_PGLITE_MODULE=/tmp/lms-practice-binding-test/node_modules/@electric-sql/pglite/dist/index.js node --no-warnings --experimental-strip-types --test --test-concurrency=4 tests/chapter-practice-binding-db.test.mjs tests/completion-policy-management-db.test.mjs tests/teaching-operations-db.test.mjs tests/teaching-script-source-review-db.test.mjs
npm run typecheck -- --incremental false --pretty false
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=isolated-build-only SUPABASE_SERVICE_ROLE_KEY=isolated-build-only SMART_TEXTBOOK_RUNTIME_ADMISSION_ENABLED=false node_modules/.bin/next build --webpack
git diff --check
```

Next 16.2.10 webpack optimized build 已成功，生成了真实 learning/teacher Route；仅本地 build，未启动或部署产物。最初副本未复制 `.env.example` 导致一个旧测试文件读取失败；补入原模板后重新全量测试。非增量 typecheck 先运行本地 Next typegen（新副本无 `.next` 的 RouteContext 生成类型），并修复本轮 discriminated union 分支类型收窄。没有放宽业务测试。

日志：`/tmp/4b1b-full-regression.log`、`/tmp/4b1b-pglite-regression.log`、`/tmp/4b1b-types-final.log`、`/tmp/4b1b-next-build.log`。早期测试媒体列名/导航计数错误已修正，不拿早期失败轮次统计当最终结果。

## 8. 最终状态与停止

```ini
applicationWiringImplemented = true
isolatedEntryAcceptance = true
runtimeTechnicalReady = true
newVersionPublicationWorkflowReady = false
sharedDependencyEditingWorkflowReady = false
productionCutoverReady = false
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
Recording production gate enabled = false
Runtime production gate enabled = false
production key installed = false
production object storage operations = false
PM2 restarted = false
```

剩余上线前置：本报告工作流决策、4B-0 的生产 schema/preflight/定向部署/密钥信任边界/实例清单/首次维护排空/正常测试 cohort/恢复点窗口，以及真正生产等价的多实例运行验收。没有定向 migration runner、后台编辑器、release 部署或 legacy 删除。

完成本报告与隔离验收后停止；不把代码 patch 自动应用到运行服务目录，不自动上线。
