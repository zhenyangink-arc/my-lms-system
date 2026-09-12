# Phase 4B-1C：首次上线前的单版本编辑与重新发布

日期：2026-09-10。以用户本轮“无正式用户、无需旧版持续服务”的更正为准，覆盖前一条 copy-on-write / 新旧版本并行要求。

## 1. 实施与 patch 基线

- 全部代码、独立 migration、SQL、构建和 Chromium 均位于 `/tmp/uply-phase4b1b.WHog5G`，继续使用前轮独立 node_modules 和无生产环境变量的隔离副本。
- 4B-1B checkpoint：`67f5d57bcfc2399306a57f4ad544fa806f6d3a4a`；更早复制当前脏工作区的 baseline：`0003f57fb910b5b2b207a16577d0c97c27b6bef7`。两者都是隔离副本本地提交，不是生产 Git 发布。
- `SMART_TEXTBOOK_RUNTIME_V1_PHASE_4B1C_INCREMENTAL.patch`：仅本轮增量，基于 67f5d57；只用于已经应用 4B-1B patch 的副本。
- `SMART_TEXTBOOK_RUNTIME_V1_PHASE_4B1C_CUMULATIVE.patch`：基于 0003f57，包含 **4B-1B + 4B-1C** 全部业务代码/migrations/tests，避免遗漏前轮尚未回写的接线。两个 patch 二选一，不叠加。
- 原项目目录只接收本报告及可审查 patch，不接收业务代码。不访问生产 DB/R2，不部署、不重启任何正在运行的服务。

交付校验：累计 patch 对当前原工作区 `git apply --check` 通过（只读，未应用）；增量 patch 对当前隔离副本 `git apply --reverse --check` 通过。前轮 4B-1B patch 保留且未覆盖。

|artifact|SHA256|
|---|---|
|4B-1C incremental|`7077935422c3d2f7b123cb4d37de38b40a3a92357a5c6af4190d43549cd073c0`|
|4B-1C cumulative|`0abdf5432158d3c8d8b3b7729b5c4649bd26fd352fea8229be2cf4941fb09cb2`|
|保留的 4B-1B|`37a74516277538d5d83c51e729ea684d2b0d9f35c3a47437aeda959b4175d25a`|

## 2. 单版本工作流

```text
已发布当前教材
 → platform_owner: beginChapterOneEditing()
 → draining：拒绝新的正式 Runtime 请求，等待在途请求真实结束
 → 再调用 beginChapterOneEditing()，确认 inflight=0
 → editing：该教材旧测试 locator revoked，快照标记不可再执行
 → 修改当前 DB 内容 / answer（或现有受权限保护的制作服务）
 → 现有 publish_digital_textbook_chapter：原章节/测试发布校验
 → compileChapterOnePublication → publishChapterOne(expected pointer)
 → 原 immutable store + dependency fence，原 CAS
 → open：原 Published Loader → 新 durable session → strict complete Runtime
```

不是后台编辑器：新增的是 owner-only 服务 DAL 与事务接口。现有制作服务仍被 DB fence 保护，不能略过编辑窗口。机构负责人/成员不能开启窗口或调用本轮编辑服务。

未实现版本克隆、UUID 替换、新旧并行、进度迁移或另一套 Publisher/Runtime。数据库中的 version、chapter、module、node、activity、全部 stable target 保持原身份；本轮“修订”是同一套当前制作行的内容变更及新 immutable snapshot，不是假造旧 UUID。

## 3. 修改清单

|文件|改动|
|---|---|
|`supabase/migrations/202609100004_runtime_single_version_authoring.sql`|编辑窗口、真实请求生命周期、旧快照执行退休、session 拒绝、窄语义 capture、原 Publisher 包装、闭合题目编辑 RPC|
|`supabase/migrations/202609100005_chapter_publish_semantic_compatibility.sql`|版本化替换现有章节发布函数体，统一先 advisory 后 row lock；已发布状态不做无意义重复写入；保持 authenticated + platform_owner 权限|
|`src/lib/smart-textbook-publishing/authoring.server.ts`|`beginChapterOneEditing`、`editChapterOneActivity`、`withChapterOneRuntimeRequest`；认证身份只来自服务器|
|`src/features/smart-textbook-runtime/server/application-runtime.server.ts`|所有正式 Learning/Teacher HTTP 操作（含 Recording）包在真实请求生命周期中；不改领域实现|
|`tests/fixtures/published-chapter-one.mjs`|隔离 PG 安装本轮事务 migration；不连接生产|
|`tests/fixtures/single-version-authoring.mjs`|真实 edit/republish、并发 submit/drain、旧会话拒绝、数据保留、CAS 与无变化重发验收|
|`tests/smart-textbook-runtime-4b1b.test.mjs`|保留前轮入口验收，更新旧 RPC 误锁断言，新增本轮场景及新版内容 Chromium 验收|

没有修改 Renderer、Manifest v1、稳定身份、Phase 3E speech selector、现有 grader、Recording v2 consume/lifecycle/RPC 或 Agent 状态机。管理 UI 未新增制作按钮；服务接线与实际部署分开。

## 4. 为什么不只是操作前 SELECT

### 请求排空

`runtime_publication_request_v1` 以数据库 `runtime_requests` 行登记整次应用请求。进入和退出使用同一 authoring advisory lock `(4171,2)`；应用 `try { return await operation(); } finally { ...leave... }`，覆盖所有被 await 的领域事务和对象 I/O。

`begin_runtime_textbook_edit_v1` 在同一锁内停止接纳新请求并统计未完成请求。有任一在途请求就只返回 `draining`，不退休快照、不允许编辑。最后一个请求真实返回以后再进入 `editing`。这样即使判题 SELECT 和 attempt RPC 是两个连接，也不能在它们中间解冻答案。

不以浏览器 abort、TTL、Promise 发起或进程本地计数作为“已停止写入”的证明。崩溃/leave 失败留下未完成请求时 **fail closed**；本轮没有 force-clear、自动过期或管理按钮。需要确认进程确实不再写入后才能另行批准清理该精确请求记录，不能自动解锁。

### 会话与快照

session issue/resolve 与编辑切换串行；`editing` / `draining` 或 retired snapshot 均明确拒绝。Loader 仍调用 `assert_runtime_dependency_fence_v1`，同时验证 fence 存在、该快照未退休、教材 open。

只对当前教材的 SQL locator 做 `revoked=true`。snapshots、bindings、history、dependency_fences 不删除、不改写；新增 append-only retired_snapshots 使它们不再作为运行依赖锁住当前制作行。其他教材的活动 fence 仍保护实际共享依赖，不能靠编辑本教材改掉另一本教材的教学 profile。

编辑窗口有单调 revision；它作为**私有 capture provenance**进入依赖摘要和 snapshot identity，不进入公开 Manifest props。无内容修改的“结束编辑再发布”也会产生新 snapshot，不复活旧 locator。

被退休的快照不能直接 rollback 成运行版本。若要恢复旧内容，须经当前编辑窗口写回受控内容，再重新编译发布；本轮没有实现自动写回工具，更没有删除历史素材。未进入编辑窗口时原无内容改写的 CAS/rollback 基础回归仍保留，不再为退休快照维持执行兼容。

## 5. 共享依赖和语义冻结

仅下列 **顶层 `updated_at`** 从 capture 语义中排除：

- `digital_textbooks`
- `digital_textbook_versions`
- `digital_textbook_chapters`
- `chapter_tests`

代码证据：`reader.server.ts` 的 SELECT 只读身份/状态/展示内容；`service-reader.server.ts` 只读章节测试身份/slug；`adapter.server.ts` 依据明确 ID、module sort_order、状态和内容编译；`loader.server.ts` 用当前身份、membership、chapter/version RLS 授权。这四表的更新时间不参与上述教学/判题/导航/权限决策。

反例不能混用：`learning_agent_sessions.updated_at` 用于恢复顺序，attempt.created_at 用于历史分页；它们 **没有** 被豁免。没有豁免整块 metadata、status、profile 配置，也未豁免媒体 readiness。

新 capture 由原完整 SQL capture 经过窄投影生成；fence 对当前 capture 与历史 capture 使用同一语义函数；新 bundle 的 dependency digest 和 Loader fence 校验仍覆盖完整语义集合。历史 immutable payload 不被重写。

原 `publish_digital_textbook_chapter`：

1. 仍验证正常 JWT 的 platform_owner，仍验证单选测试题数量/四选项/答案完整性，仍保持原事务发布规则。
2. 先取得全局 authoring advisory lock，再锁 chapter/version/textbook/test/questions；与新 Publisher 同序。
3. status 已为 published 的共享 test/textbook/version 不再被重复 UPDATE；章节 production_status 的真实变化仍正常执行。
4. updated_at 只是审计触碰，不再误伤其他章节。真正改变共享教学字段仍被活动 fence 拒绝。

隔离实际验证：发布第一章以后，其他章节可改 title 并通过**真实旧 RPC**完成发布；关联题目也真正变成 published。没有用直接写 published 状态替代这项正向结果。

## 6. 可编辑范围与媒体

本轮正向样本使用实际第一章 orientation-check：修改双语 prompt 和原 `answer_key {kind:index,value}`，调用原 grader，未改变完成规则、分数或题型。新增编辑 DAL 只接收闭合 prompt 和索引；服务器验证作用域、四选项实际范围及 owner，客户端不能传租户/学习者/完成状态。

编辑窗口不是 Compiler Validator 的 bypass。匿名数组增删/重排身份、未经过审计的媒体变更、未知字段、缺失 required media 仍会被现有编译/媒体准入拒绝。当前没有承诺任意内容编辑都自动获得新的媒体证明，也不在本轮制造素材。

pending→ready 不会原地升级一个仍执行的旧快照：须先停止、编辑，媒体实际合格后经既有 media publication audit 再编译发布；本轮没有修改 pending、没有改 object key/hash、没有上传或覆盖对象。已有 75 个媒体引用和其准入证明保持不变。

## 7. 隔离验收证据

使用前轮实际应用 HTTP → Published Loader → durable session → 生产领域服务组合，以及同一个 `PublishedRuntimeEntry` / strict complete `LessonRuntime`。认证、SQL 传输及 R2 bytes 限于隔离 fixture；不将它称为真实账号或生产 E2E。

|验收|结果|
|---|---|
|初次正式发布 → 当前内容与 19 个秘密判题依赖捕获|通过|
|正式提交卡在真实 attempt SQL 时开启编辑|返回 draining；不能编辑；新请求拒绝；请求完成后才解冻|
|组织负责人 / 普通 API 角色开启编辑或改题|拒绝，应用与 SQL 双层 owner guard|
|当前题目/答案实际 UPDATE → 原章节发布 RPC → 正式 compiler/publisher|通过，不是 detached draft|
|新版 Loader、旧会话拒绝、新会话用新版答案正式判题|通过|
|同一 expected pointer 两个真实 Publisher 并发|一个成功，另一个 CAS conflict|
|退休旧快照直接回滚|拒绝，不让旧页面使用当前新答案|
|无变化结束编辑 / 重发|新 snapshot，旧 locator 仍拒绝|
|shared updated_at 与其他章节真实发布|通过，status/profile/答案/媒体直接篡改仍拒绝|
|旧快照原 document hash / 教材稳定身份|保留不变|
|attempt/evidence/node progress 数量|编辑与发布不清零、不复制、不制造完成|
|新版 strict complete Chromium|实际显示新版题目并通过 HTTP 提交新版答案；8 Step、3 道 orientation、Teacher、刷新正常|

本轮证据文件：`/tmp/uply-4b1c-single-version-proof.json`，仅记录 digest、数量和判定，不输出学生记录/答案/对象路径。测试原脚本本来等待固定旧反馈文案，本轮改为观察真实服务端 native-submit JSON 判定，未放宽行为验收。

本次实际内容变更的 Manifest digest：

- 前：`sha256:5c941f3aa4bc57fd93e7ad9b8fb3ab548ef50a8bb9d50029054c0a0379efff58`
- 后：`sha256:e1cfc988cbf2e3301c3c1cbe7392cfb154c9f14785093877b94de0172de04d1b`

快照 ID 同时固定私有答案/语义依赖与 authoring revision；相同 Manifest 内容也不能绕过退休或 CAS。旧快照仍可在数据库审计，但不再经学生 Loader 执行。

Migration 自审：新 RPC 为 service-role-only / SECURITY DEFINER / 空 search_path；旧章节发布 RPC 仍撤销 anon/service_role，仅 authenticated 且函数内 owner 判断可执行。私有表全部 RLS、无浏览器写授权；无动态 SQL；固定锁序 authoring→scope/row，不用 expiry 猜测在途状态。任一编辑/发布校验失败事务整体回滚；没有对象存储与数据库的伪分布式事务，也没有删除/修改历史 migration。

## 8. 测试与构建

完整回归 **1179/1179 passed，0 failed、0 skipped、0 cancelled**，380.5 秒。包含 Phase 3A–3E、4A、Publish Foundation、Recording SQL rehearsal、既有 legacy、正式应用 strict complete Chromium 及本轮实际数据库工作流。

本轮集成文件 **9/9**（含 parent）通过。单版本 drain/edit/republish/判题场景 46.4 秒；新版 Chromium 实际提交、Teacher 与 reload 通过。不是以单元测试总数替代功能链验收。

非增量 TypeScript、相关 ESLint、`git diff --check` 均通过。Next 16.2.10 `next build --webpack` 优化构建成功，31 个静态页面与实际 formal learning/teacher Routes 完整产出。仅构建，没有启动/发布产物。

隔离执行命令：

```sh
LMS_PGLITE_MODULE=/tmp/lms-practice-binding-test/node_modules/@electric-sql/pglite/dist/index.js node --no-warnings --experimental-strip-types --test --test-concurrency=4 tests/*.test.mjs
npm run typecheck -- --incremental false --pretty false
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=isolated-build-only SUPABASE_SERVICE_ROLE_KEY=isolated-build-only SMART_TEXTBOOK_RUNTIME_ADMISSION_ENABLED=false node_modules/.bin/next build --webpack
git diff --check
```

日志：`/tmp/4b1c-full-regression.log`、`/tmp/4b1c-typecheck.log`、`/tmp/4b1c-next-build.log`、`/tmp/4b1c-lint.log`。

## 9. 数据边界与停止

```ini
singleVersionWorkflowImplemented = true
sharedChapterPublishCompatibilityImplemented = true
production migration executed = false
production caller cutover executed = false
student production Runtime switched = false
production data/object operations = false
production gate enabled = false
PM2 restarted = false
progress/evidence/attempt reset = false
snapshot/content/media deleted = false
```

已授权的会话失效仅针对编辑教材的测试 locator；它不是清空数据。现有测试作答、page/repeat/node progress、录音和 Agent 持久记录都保留，原历史 Reader 仍可能恢复既有测试记录；未将其重判成新版学习结果。若首次上线需“干净测试状态”，必须另列准确的 tenant/student/activity/version 范围并得到确认，不能自动清空。当前回归验证不依赖删除这些记录。

没有因为“无旧版用户”删除旧 Shell 或素材，也未实现新版本克隆/多版本持续服务。远端首次部署、schema/key/Recording gate/正常测试账号与运维操作仍需未来明确授权；本轮停在隔离代码、验收与可审查 patch，不自动上线。
