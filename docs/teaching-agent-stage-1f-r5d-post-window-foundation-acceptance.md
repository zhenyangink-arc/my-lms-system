# Stage 1F-R5D — Post-Window Foundation Acceptance Closure

## 1. Executive Summary

**Overall: GO. Post-Window Foundation Acceptance: PASS. Current Foundation Technical Status: READY FOR CONTENT PREPARATION.**

这是新的 **CURRENT STATE ACCEPTANCE**，没有重新执行 Foundation。当前 production ledger **457 / 202609140007**；原 449 条 version/name/statements prefix 未变化，新增八条完整 stored SQL 与锁定源文件一致。35 个函数及列、约束、索引、触发器、RLS、policy、ACL、safe view 的当前完整 catalog 记录与 R5C 对齐；源文件契约检查全部通过。

运行中的 R3D Build 为 **6IhDHN8Dm1nCewiCEZnV5**、Next **16.2.10**。1394 个部署文件逐一匹配批准 archive，19/19 required-server-files 存在，没有额外 live 文件。PM2 online，Feature OFF，三份 allowlists EMPTY，Agent 五表全部 0；runtime、launcher、Tailscale 和其他 PM2 apps 均与 R5C 一致。

**R5C Historical Status 仍是 CONDITIONAL — WINDOW EXPIRED / EXECUTION INCOMPLETE。** R5D 不延长原变更窗口、不将原执行记录改为 COMPLETED、不改写 R5C 报告或 evidence。当前结论来自独立授权下的新只读观察。

Authoring Technical Foundation **PASS**；Authenticated Authoring UI **AUTH SESSION REQUIRED**，未冒用任何账号。该限制不阻断本次技术验收。Stage1G **NOT READY / NOT AUTHORIZED**。后续 Production Content Preparation 必须另行明确授权，本任务未进入该阶段。

## 2. Authorization and scope

用户当前 Stage 1F-R5D 请求授权：只读 DB/catalog、PM2 status、runtime/launcher hash、Tailscale status、无业务写入 GET/HEAD、文档/evidence 及私有 acceptance receipt。本次没有 production change window，也没有 production mutation 授权。

实际查询以 Docker PG17.6 client、`sslmode=verify-full`、`default_transaction_read_only=on` 执行；固定 catalog SQL 使用 READ ONLY transaction、statement timeout 和 ROLLBACK。没有执行 migration runner、写 RPC、Agent POST、Provider、reconciler、persistent cancel 或任何部署/进程控制命令。临时连接凭据仅存私有临时目录，使用后自动清理，没有写入证据。

只读 helper：[acceptance.py](../scripts/teaching-agent-r5d/acceptance.py)、[catalog_contract.py](../scripts/teaching-agent-r5d/catalog_contract.py)、[readonly_transport.py](../scripts/teaching-agent-r5d/readonly_transport.py)。没有 apply/deploy/restart 功能或任意 SQL CLI。R5B catalog 查询及断言被复制为静态只读函数；没有修改原 verifier 或 migrations。

输入包含当前 R5C 执行报告/证据、authorization package、R5B engineering closure/expected-state verifier、R4G acceptance、八份完整 migration 原文及锁定 metadata。历史结论仅用于比较，不替代本次观测。

## 3. Read-only observation window

| Field | Observed value |
|---|---|
| r5dStartUtc | 2026-09-16T04:58:40.975487+00:00 |
| r5dStartAsiaSeoul | 2026-09-16T13:58:40.975487+09:00 |
| Observation deadline | 2026-09-16T05:28:40.975487+00:00 |
| Final production read-only observation | 2026-09-16T05:05:08.841843+00:00 |
| Final observation Asia/Seoul | 2026-09-16T14:05:08.841843+09:00 |
| Observation duration | 387.866 seconds；约 6 分 28 秒 |
| Maximum observation duration | 30 minutes |
| Budget exceeded | NO |
| Production maintenance authorization | NONE |

私有 receipt 封存及文档整理在生产观察之后进行，不产生生产变更。最初封存因沙箱只读文件系统 `OSError errno 30` 失败；完成一次额外只读核验定位该错误后，仅私有文件路径提权已获放行并成功封存。该错误不属于 DB/app 检查失败；保留原失败记录及[解决记录](evidence/teaching-agent-stage-1f-r5d/receipt-storage-resolution.json)，未借此重启或修复生产。

## 4. Production identity and installed ledger

| Field | Result |
|---|---|
| PostgreSQL | 17.6 |
| Project identity SHA256 | `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673` |
| Host identity SHA256 | `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5` |
| Target | MATCH；verify-full target 与批准 runtime project 对齐 |
| Ledger / latest | 457 / 202609140007 |
| Old449 version/name SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| Old449 version/name/statements SHA256 | `cfdade473cb06c8169399c2b99686dec7e3d466965ad9d0d3fd8ea26b5899b03` |
| Current457 version/name SHA256 | `a574e8c5b848dbc3c2b29d846ad262333b1077ccd92221a1d356932d3a804323` |
| Eight stored migration SQL | MATCH；逐条比对 version、name、完整 statements 数组 |
| Start/end ledger comparison | UNCHANGED |

证据：[production-identity.json](evidence/teaching-agent-stage-1f-r5d/production-identity.json)、[ledger-verification.json](evidence/teaching-agent-stage-1f-r5d/ledger-verification.json)。完整 SQL 仅在内存中比较，repo 记录 hash/status，不修改 ledger。

| Version | File | Locked/current SHA256 | Stored SQL |
|---|---|---|---|
| 202609140000 | `202609140000_agent_core_foundation.sql` | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | MATCH |
| 202609140001 | `202609140001_agent_runtime_completion_evidence.sql` | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | MATCH |
| 202609140002 | `202609140002_agent_run_cancel_request.sql` | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | MATCH |
| 202609140003 | `202609140003_teaching_operations_reissue.sql` | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | MATCH |
| 202609140004 | `202609140004_completion_policy_management_reissue.sql` | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | MATCH |
| 202609140005 | `202609140005_student_teaching_content_isolation.sql` | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | MATCH |
| 202609140006 | `202609140006_agent_run_reconciliation.sql` | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | MATCH |
| 202609140007 | `202609140007_teaching_content_skeleton.sql` | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | MATCH |

## 5. Foundation objects and RLS / ACL

当前 catalog 先按 R5B 源码推导契约核验，再与 R5C private catalog 完整记录比较。无序 catalog arrays 以完整记录排序后比较；没有忽略函数正文、签名、owner、security definer、search_path、ACL 或 policy 定义差异。九类完整记录均一致。

| Object / contract | Result |
|---|---|
| Five Agent tables + curriculum_plan_assessments | 6/6；列名/顺序与源契约一致，类型/default/not-null 与 R5C 一致 |
| Constraints | Agent 五表及 assessment 数量 7 / 5 / 10 / 8 / 3 / 6，全部 validated；两项 deferred FK |
| Explicit indexes | 6 valid，3 unique；完整定义一致 |
| Guard/immutable triggers | 7 enabled；完整定义一致 |
| Final functions / private wrappers | 35；body、signature、owner、SECURITY DEFINER、config/search_path、各角色 EXECUTE ACL 一致 |
| Agent browser direct privileges | anon/authenticated 直接读取拒绝，authenticated 写权限拒绝，RLS enabled |
| Usage boundaries | 三条 agent_usage_browser restrictive policies 保留 |
| Migration005 teaching isolation | textbook/version/chapter/module/lesson/script/node policies 完整定义一致；raw broad script-node policy 不存在 |
| student_learning_agent_script_nodes | security_barrier=true；owner postgres；authenticated safe-view SELECT，anon 无 SELECT；无 configuration / answer_key 列 |
| Private Agent helpers | anon/authenticated/service_role 均无 EXECUTE；其他 private helpers 按既有受限 ACL 完整比较 |
| Public Agent RPCs / reconciler | 12 个 service-only RPC 契约通过；006 函数定义、deadline index、ACL 一致；未执行 reconciler |
| create_teaching_content_skeleton | 007 签名/函数正文/Platform Owner guards/ACL 一致；authenticated 可 EXECUTE、anon/service_role 不可；未调用 |

证据：[foundation-objects.json](evidence/teaching-agent-stage-1f-r5d/foundation-objects.json)、[rls-acl.json](evidence/teaching-agent-stage-1f-r5d/rls-acl.json)。这是静态 catalog 权限验收，未使用真实学生身份做越权/写入实验。

## 6. Agent empty state and effective OFF boundary

| Table | Rows |
|---|---|
| agent_definition_versions | 0 |
| agent_conversations | 0 |
| agent_runs | 0 |
| agent_messages | 0 |
| agent_run_events | 0 |

首次与结束 COUNT 一致，没有选取业务行。Feature OFF，TENANT / COURSE / USER allowlists 均 EMPTY。transport-config 仅接受精确 `1` 或 `true`；student-handlers 在鉴权/runtime 前 gate；rollout-policy 要求服务端三份 allowlists；lesson-slots 在 OFF 时返回 undefined。批准 launcher 注入批准 runtime，PM2 启动元数据未变，编译制品全量匹配。

**Agent Admission Test: NOT EXECUTED BY DESIGN。** 没有通过 POST 或真实 Agent 请求验证，也没有执行 authenticated student page projection。证据范围是配置、源码边界、部署一致性和表计数；不伪称实际 admission 测试 PASS。

证据：[agent-empty-state.json](evidence/teaching-agent-stage-1f-r5d/agent-empty-state.json)、[effective-no-agent-boundary.json](evidence/teaching-agent-stage-1f-r5d/effective-no-agent-boundary.json)。

## 7. Approved artifact and live application

| Field | Current observation |
|---|---|
| Persistent archive | `/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz` |
| Archive SHA256 | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| File / size | regular, not symlink / 18760388 bytes |
| Archive readability | PASS |
| Live source | `/home/yangzhen/releases/uply-first-enable-20260910/source` |
| Live Build ID / Next | 6IhDHN8Dm1nCewiCEZnV5 / 16.2.10 |
| Compared deployment shape | .next / public / package.json / next.config.ts |
| Approved file equality | 1394/1394 SHA256 MATCH |
| Required server files | 19/19 PRESENT |
| Extra live files under .next/public | 0 |
| Member mapping SHA256 | `607b05f0a387ced8b85d274722d6f4a669d7c1a963fd9513c3ac389d937eb9e1` |
| npm install / build / deploy | 0 / 0 / 0 |

证据：[artifact-verification.json](evidence/teaching-agent-stage-1f-r5d/artifact-verification.json)。仅读取 archive member bytes 和 live files，没有解压覆盖、复制 artifact 或替换依赖。

## 8. PM2, runtime, launcher and Tailscale

`uply-first-enable`: **online**；PID **934715**；restart count **0**；Node **26.5.0**；kill_timeout **15000 ms**。cwd `/home/yangzhen/releases/uply-first-enable-20260910/source`；launcher `/home/yangzhen/.config/uply-first-enable-20260910/start.mjs`。named app 所有选定元数据及其他 apps 的 PID/status/restart/cwd/launcher 与 R5C 一致，开始/结束比较通过。

Runtime SHA：`7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8`。Launcher SHA：`30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039`。均 UNCHANGED。未输出完整环境或运行密钥。

Tailscale canonical SHA：`b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256`，与 R5C 一致：443→127.0.0.1:3001，4000→127.0.0.1:4000，8443→127.0.0.1:3000。9443 absent，Funnel false。仅 `tailscale serve status --json`，没有重开 probe。

证据：[pm2.json](evidence/teaching-agent-stage-1f-r5d/pm2.json)、[runtime-launcher.json](evidence/teaching-agent-stage-1f-r5d/runtime-launcher.json)、[tailscale.json](evidence/teaching-agent-stage-1f-r5d/tailscale.json)。

## 9. HTTP health and authoring acceptance

九项无 Cookie/Authorization 的 GET/HEAD 全部 HTTP 200：homepage、login、platform dashboard、course overview、admin、textbooks、teaching-scripts，以及 pronunciation media HEAD、PWA static asset HEAD。受保护页面多数以 Next stream 返回 redirect；**HTTP 200 只代表基础 response 正常，不代表已登录业务页面验证通过**。没有保存响应正文、Set-Cookie、JWT。

教材制作、Script Studio、classroom 动态 route 均存在于 live app-paths-manifest，编译文件存在。现有 lesson 的 authenticated read flow 未执行，不伪造已有课程/学生上下文。

| Authoring layer | Result / basis |
|---|---|
| Technical Foundation | PASS：compiled routes、schema、007 skeleton RPC/ACL、批准 build 正在运行、基础 HTTP 可响应 |
| Authenticated Interactive UI | AUTH SESSION REQUIRED：没有提供用户本人正常登录且明确授权使用的 session |
| Platform Owner guard interactive verification | NOT EXECUTED；未绕过登录；静态 guard/RPC 定义已核验 |
| Create / Save / Publish / Run / Delete | 0 |

证据：[http-health.json](evidence/teaching-agent-stage-1f-r5d/http-health.json)、[authoring-foundation.json](evidence/teaching-agent-stage-1f-r5d/authoring-foundation.json)。未读取/导出 session，未选择 owner、生成 magic link、修改 Auth 或使用 service-role impersonation。Authenticated UI 的 PARTIAL 不影响其它已通过技术项。

## 10. Provider, content and recovery boundaries

Live Provider Requests **0 in R5D task scope**，Agent Runs **0**。未进行 LLM smoke test；Provider Policy **DEFERRED / NOT APPROVED**，政策文档未修改。该零值来自本任务没有 Provider/Agent 调用路径及 OFF/EMPTY/Agent0 证据，不代表对整个供应商账户流量作全局审计。

R5D Production Content Writes **0**：没有创建教材、lesson、script、node、definition 或 Pins，没有业务写路径；未枚举完整教材或学生名单。R5C content-write receipts 保持原样。本次不声称以 count 证明所有外部并发业务记录内容绝对不变。

R5C recovery point `/home/yangzhen/backups/uply/20260916T030822Z` 继续保留。**No new recovery point required for read-only acceptance closure.** 未创建 backup、未 restore、未删除备份，不将 <=15m migration RPO 作为本次验收前置。备份保留策略不变。

## 11. R5C historical status and R5D closure

R5C 原变更窗口：2026-09-16T02:58:09.328821+00:00 → 2026-09-16T03:58:09.328821+00:00。既有 receipts 记录：八次 migration CONFIRMED、artifact replacement 和 named app stop/start 均在窗口内；最终只读复核为 04:37:59.556448 UTC，故历史结论 CONDITIONAL / WINDOW EXPIRED / EXECUTION INCOMPLETE。该证据及报告未改写。

R5D 的只读授权独立于 R5C mutation authorization。当前状态重新观测符合终态，因此新的 **Post-Window Foundation Acceptance PASS** 可以解除当前 technical HOLD；不追认原窗口延期、不将 R5C Actual Production Execution 写成 COMPLETED、不产生后续执行授权。

Authorization Package 仅追加 Current Closure，原正文保留。见 [authorization package](teaching-agent-production-foundation-install-authorization.md)。

## 12. Production safety and private receipt

| Operation | R5D count |
|---|---|
| Production DB Writes / migrations / deploy | 0 / 0 / 0 |
| PM2 mutations / runtime writes / launcher writes | 0 / 0 / 0 |
| Tailscale mutations | 0 |
| Agent runs / admission tests / Provider requests | 0 / 0 / 0 |
| Content writes / Auth writes | 0 / 0 |
| Reconciler / persistent cancel | 0 / 0 |
| New recovery points / restores | 0 / 0 |

Private receipt：`/home/yangzhen/operations/uply/teaching-agent/acceptance/r5d-20260916T045840Z/acceptance.json`，SHA256 `a2797f58f9f2b3e4587ddb6da62f8c3fe0a7b45e294449bf04e2b99bc9d315b9`；directory 0700 / file 0600，exclusive creation + fsync。内容为独立只读验收范围、观察窗口、技术结论及当时 evidence hash；没有凭据、完整聊天或业务行。repo 仅记录安全摘要。后续文档/gates/scope 属于报告整理，见各独立 evidence。

## 13. Gate matrix

| Gate | Name | Status | Evidence |
|---|---|---|---|
| G-R5D-1 | Read-only Authorization Scope | PASS | [authorization-scope.json](evidence/teaching-agent-stage-1f-r5d/authorization-scope.json) |
| G-R5D-2 | Production Identity Match | PASS | [production-identity.json](evidence/teaching-agent-stage-1f-r5d/production-identity.json) |
| G-R5D-3 | Ledger457 | PASS | [ledger-verification.json](evidence/teaching-agent-stage-1f-r5d/ledger-verification.json) |
| G-R5D-4 | Latest140007 | PASS | [ledger-verification.json](evidence/teaching-agent-stage-1f-r5d/ledger-verification.json) |
| G-R5D-5 | Old449 Prefix Preserved | PASS | [ledger-verification.json](evidence/teaching-agent-stage-1f-r5d/ledger-verification.json) |
| G-R5D-6 | Eight Migration SQL Exact | PASS | [ledger-verification.json](evidence/teaching-agent-stage-1f-r5d/ledger-verification.json) |
| G-R5D-7 | Foundation Objects | PASS | [foundation-objects.json](evidence/teaching-agent-stage-1f-r5d/foundation-objects.json) |
| G-R5D-8 | RLS/ACL | PASS | [rls-acl.json](evidence/teaching-agent-stage-1f-r5d/rls-acl.json) |
| G-R5D-9 | Agent Rows Zero | PASS | [agent-empty-state.json](evidence/teaching-agent-stage-1f-r5d/agent-empty-state.json) |
| G-R5D-10 | Approved Artifact Match | PASS | [artifact-verification.json](evidence/teaching-agent-stage-1f-r5d/artifact-verification.json) |
| G-R5D-11 | Live Build Match | PASS | [artifact-verification.json](evidence/teaching-agent-stage-1f-r5d/artifact-verification.json) |
| G-R5D-12 | PM2 Online | PASS | [pm2.json](evidence/teaching-agent-stage-1f-r5d/pm2.json) |
| G-R5D-13 | Feature OFF | PASS | [runtime-launcher.json](evidence/teaching-agent-stage-1f-r5d/runtime-launcher.json) |
| G-R5D-14 | Allowlists EMPTY | PASS | [runtime-launcher.json](evidence/teaching-agent-stage-1f-r5d/runtime-launcher.json) |
| G-R5D-15 | Runtime Match | PASS | [runtime-launcher.json](evidence/teaching-agent-stage-1f-r5d/runtime-launcher.json) |
| G-R5D-16 | Launcher Match | PASS | [runtime-launcher.json](evidence/teaching-agent-stage-1f-r5d/runtime-launcher.json) |
| G-R5D-17 | Tailscale Match | PASS | [tailscale.json](evidence/teaching-agent-stage-1f-r5d/tailscale.json) |
| G-R5D-18 | Basic HTTP Health | PASS | [http-health.json](evidence/teaching-agent-stage-1f-r5d/http-health.json) |
| G-R5D-19 | Authoring Technical Foundation | PASS | [authoring-foundation.json](evidence/teaching-agent-stage-1f-r5d/authoring-foundation.json) |
| G-R5D-20 | Authenticated Authoring UI | PARTIAL — AUTH SESSION REQUIRED | [authoring-foundation.json](evidence/teaching-agent-stage-1f-r5d/authoring-foundation.json) |
| G-R5D-21 | Provider Zero | PASS | [provider-boundary.json](evidence/teaching-agent-stage-1f-r5d/provider-boundary.json) |
| G-R5D-22 | Content Writes Zero | PASS | [production-safety.json](evidence/teaching-agent-stage-1f-r5d/production-safety.json) |
| G-R5D-23 | Production DB Writes Zero | PASS | [production-safety.json](evidence/teaching-agent-stage-1f-r5d/production-safety.json) |
| G-R5D-24 | Production Mutations Zero | PASS | [production-safety.json](evidence/teaching-agent-stage-1f-r5d/production-safety.json) |
| G-R5D-25 | R5C History Preserved | PASS | [workspace-scope.json](evidence/teaching-agent-stage-1f-r5d/workspace-scope.json) |
| G-R5D-26 | Current Acceptance Record | PASS | [private-receipt.json](evidence/teaching-agent-stage-1f-r5d/private-receipt.json) |

## 14. Workspace and evidence validation

只新增 R5D report/evidence/read-only helpers，并向允许的 authorization package 追加本次 closure。其他已有 tracked/untracked 文件按任务前 SHA 快照核对，R5C report/evidence、产品源码、migrations、baseline、runtime、launcher、artifact 均未修改。保留原有工作区改动，不执行 git add/commit/reset/clean/checkout。

已执行 git diff --check、新增文件 whitespace 检查、JSON parse、Python AST syntax、敏感值/凭据格式扫描及 scope scan；具体计数、路径及结果见 [workspace-scope.json](evidence/teaching-agent-stage-1f-r5d/workspace-scope.json)。

## 15. Final assessment and remaining boundary

**Overall GO；Post-Window Foundation Acceptance PASS；Current Foundation Technical Status READY FOR CONTENT PREPARATION。** Authenticated Authoring UI 仍需用户本人合法且明确授权的 session；本次未验证登录后 UI 展示/交互。

**R5C Historical Status 保持 CONDITIONAL — WINDOW EXPIRED / EXECUTION INCOMPLETE。Stage1G 仍 NOT READY。** 下一阶段可考虑 Production Content Preparation，但需要新的明确授权；本次没有创建 hangul-introduction、没有 Review/Publish、Pins、single-lesson scope 或 definition publication，也没有 allowlist、Feature enable、Provider/Agent 测试。
