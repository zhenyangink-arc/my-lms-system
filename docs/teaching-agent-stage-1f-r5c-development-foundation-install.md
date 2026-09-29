# UPLY Teaching Agent — Stage 1F-R5C Development Foundation Install

## 1 Executive Summary

**Overall: CONDITIONAL。Production Foundation: INSTALLED。Foundation Technical Status: HOLD。WINDOW EXPIRED / EXECUTION INCOMPLETE。Stage1G NOT READY / NOT AUTHORIZED。**

Fresh backup/隔离restore PASS；000–007全部CONFIRMED、逐份ledger/objects PASS，生产449→457/latest202609140007，旧449完整SQL prefix不变。锁定R3D已部署，Build `6IhDHN8Dm1nCewiCEZnV5`，named PM2 app online；Feature OFF/三名单EMPTY，Agent表0，Provider/内容写入0，RLS/ACL PASS。所有production变更均在授权窗口内开始并完成。

**不能签整阶段GO**：授权截止2026-09-16T03:58:09.328821+00:00，最终只读复核记录于2026-09-16T04:37:59.556448+00:00，已超60分钟。最后production变更为2026-09-16T03:32:34.971149+00:00的named app启动，安全核验随后完成；截止后没有migration/deploy/PM2/runtime/Tailscale/业务写操作。只读验证与必要回执收尾不追认延长授权。保持已安全启动的新app online，停止下一阶段。

## 2 Explicit Authorization

用户杨震在当前R5C明确授权：本窗口fresh recovery point、精确000–007 migrations、精确持久R3D deploy、仅uply-first-enable stop/start/restart及Foundation verification。Development FORWARD-ONLY；single-operator exception ACCEPTED。授权安全摘要原件位于 `/home/yangzhen/operations/uply/teaching-agent/foundation-install/20260916T025809Z`，目录0700/回执0600，repo不保存聊天全文或凭据。

Feature ON、allowlist、Provider、Agent Run、definition、content/Pins、StudentPolicy Pilot、reconciler/cancel、Tailscale、Auth/enrollment修改、production restore/down migration/baseline/历史重放均未获授权且未执行。参见[当前授权记录](teaching-agent-production-foundation-install-authorization.md)。

## 3 Maintenance Window

| 项目 | 事实 |
|---|---|
| Window start UTC | 2026-09-16T02:58:09.328821+00:00 |
| Start Asia/Seoul | 2026-09-16T11:58:09.328821+09:00 |
| Maximum window / deadline | 60m / 2026-09-16T03:58:09.328821+00:00 |
| Authorized window end | 2026-09-16T03:58:09.328821+00:00；没有自行延长 |
| PM2 stop completed | 2026-09-16T03:05:06.827340+00:00 |
| Candidate replacement completed | 2026-09-16T03:32:34.410845+00:00 |
| Named app start | 2026-09-16T03:32:34.971149+00:00 |
| Final read-only observation | 2026-09-16T04:37:59.556448+00:00 |
| Elapsed to final observation | 5990.228s；99.837min，超过窗口 |
| Production mutations started after deadline | 0 |
| Final execution classification | WINDOW EXPIRED / EXECUTION INCOMPLETE |

工具授权交互与核验期间时钟持续运行；没有重置windowStart。最终终态脚本检测deadline超时并停止完成签署，不把技术PASS改写为窗口内COMPLETED。[window.json](evidence/teaching-agent-stage-1f-r5c/window.json)。

## 4 Locked Inputs

持久candidate：`/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz`；SHA `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28`；Build `6IhDHN8Dm1nCewiCEZnV5`；Next16.2.10。R5B runner、maintenance transport、fixed package、runtime、launcher均重新计算，6/6 MATCH；8份文件exact order，无missing/extra。

| Version | Filename | SHA256 | Result |
|---|---|---|---|
| 202609140000 | `202609140000_agent_core_foundation.sql` | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | MATCH |
| 202609140001 | `202609140001_agent_runtime_completion_evidence.sql` | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | MATCH |
| 202609140002 | `202609140002_agent_run_cancel_request.sql` | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | MATCH |
| 202609140003 | `202609140003_teaching_operations_reissue.sql` | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | MATCH |
| 202609140004 | `202609140004_completion_policy_management_reissue.sql` | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | MATCH |
| 202609140005 | `202609140005_student_teaching_content_isolation.sql` | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | MATCH |
| 202609140006 | `202609140006_agent_run_reconciliation.sql` | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | MATCH |
| 202609140007 | `202609140007_teaching_content_skeleton.sql` | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | MATCH |

锁定runner/transport未修改，也没有另一套事务执行器。[input-locks.json](evidence/teaching-agent-stage-1f-r5c/input-locks.json)。

## 5 Production Preflight

PG17.6；project SHA `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673`；host SHA `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5`；ledger449/latest202609130003；ordered version/name SHA `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981`；000–007未安装、Agent表0。runtime OFF/EMPTY，PM2online、Tailscale及锁定配置与R5B MATCH。

Maintenance identity postgres，TLS verify-full / PG17.6 client；catalog确认DB/schema CREATE、目标12表owner authority、function/RLS/policy/view/grant权限基础和ledger INSERT、role expiry VALID。没有用DDL测试权限。preflight helper曾因另一个stopped PM2记录缺pid字段停止；只调整摘要读取使用缺省0后重读成功，没有修改任何PM2应用。

## 6 Fresh Recovery Point

路径：`/home/yangzhen/backups/uply/20260916T030822Z`。Snapshot：`2026-09-16T03:08:22.747139+00:00`。使用R4D现有Execution.backup/restore实现，唯一新batch；输出目录转到R5C，预期生产app状态为本次已授权的stopped。没有直接调用旧stage CLI或写旧报告。

完整custom/gzip pg_dump、schema dump、roles capture、两份pg_restore --list exit0；REPEATABLE READ READ ONLY exporter覆盖dump/ledger/catalog采集。Roles不声称与MVCC快照原子一致。Seal VALID，manifest SHA `03d4d8e25e9dff50c6cff7cef3c750cbcf314f2000fa85dc0fa982ead1c3c787`。database.dump SHA `72e133f8b162bc3b248816dbcadf678a84489f1131cf47d02b42e97b1e3c0749`。

本次fresh backup实际恢复至network-none、无host port、无production credentials的PG17.6专用容器，26项schema/table/RLS/policy/function/constraints/index/role/ACL/extensions/count检查PASS。旧449ledger恢复一致；临时容器与volume已删除。不是完整Supabase平台配置/Storage bytes灾备验收。

Migration000 dispatch时snapshot age **181.183s <=900s**，无RPO例外或replacement backup。Backup保留：至少7天，且Stage1G Pilot稳定结束前不得删除；无自动清理任务。

## 7 Migration Execution

执行原R5B `runner.main()` 的真实 `apply-authorized --connection ... --authorization ... --receipts ...` 路径；私有machine record满足README/schema，绑定本窗口、目标、完整hash、candidate、backup manifest及OFF/EMPTY/零Provider/Agent。没有绕过MaintenancePsql guards。

补充的外层观察器只在原snapshot后查询只读catalog、在写dispatch前重核window/PM2stopped/launcher/source hashes；不改变原SQL、事务、ACK分类或循环。BEGIN、timeouts、advisory lock、ledger锁、prefix检查、原migration body、完整SQL ledger INSERT和COMMIT仍由锁定runner生成；每份DDL+ledger同事务。无retry/repair/skip/resume。

## 8 Per-Migration Verification

| Migration | Dispatch UTC | Commit | Post ledger | New connection objects |
|---|---|---|---:|---|
| 000 | 2026-09-16T03:11:23.930093+00:00 | CONFIRMED | 450 | PASS |
| 001 | 2026-09-16T03:11:26.777749+00:00 | CONFIRMED | 451 | PASS |
| 002 | 2026-09-16T03:11:28.895609+00:00 | CONFIRMED | 452 | PASS |
| 003 | 2026-09-16T03:11:30.986155+00:00 | CONFIRMED | 453 | PASS |
| 004 | 2026-09-16T03:11:33.307694+00:00 | CONFIRMED | 454 | PASS |
| 005 | 2026-09-16T03:11:35.444368+00:00 | CONFIRMED | 455 | PASS |
| 006 | 2026-09-16T03:11:37.636370+00:00 | CONFIRMED | 456 | PASS |
| 007 | 2026-09-16T03:11:39.712602+00:00 | CONFIRMED | 457 | PASS |

8份均在03:11 UTC附近完成；每个下一migration前，上一份CONFIRMED、全SQL ledger及source-derived prefix functions/objects检查已PASS。没有UNKNOWN/FAIL production migration，没有手写DDL修补。私有immutable receipt保持原结果，repo仅投影status/hash/timing摘要。

## 9 Final Database State

Ledger457/latest202609140007；旧449 version/name/statements JSONB digest `cfdade473cb06c8169399c2b99686dec7e3d466965ad9d0d3fd8ea26b5899b03`保持；新增8条version/name/完整原SQL精确匹配。该完整SQL digest与version/name SHA不是同一种输入。

五张Agent表存在、各行数0；新增列、约束、6个显式索引、7个触发器、35个最终函数及safe view/reconciler/skeleton符合R5B语义约定。既有教学、身份和usage相关表仅核计数、不读取业务行；计数与fresh snapshot一致。没有创建definition/conversation/message/run/event。

## 10 Application Deployment

先在本窗口private candidate-staging解压精确artifact；验证safe members、Build、19/19 required-server-files、1394成员hash和23个依赖的既有安装版本与R5B一致。无npm install/update/ci、无rebuild。

named app stopped下，仅替换固定source的 `.next`、`public`、`package.json`、`next.config.ts`；逐项window检查、rename及fsync、最终所有archive成员hash通过。旧四项保留到 `/home/yangzhen/operations/uply/teaching-agent/foundation-install/20260916T025809Z/pre-foundation`；没有删除旧内容、历史backup或persistent candidate。该保留不承诺旧app post-migration兼容。

部署source仍为 `/home/yangzhen/releases/uply-first-enable-20260910/source`，runtime/launcher入口保持。FORWARD FIX FIRST，不恢复旧app、不DROP Agent表，不自动restore。

## 11 PM2 Start

只操作uply-first-enable：stop exit0，PID 1176676→0，3000不再监听；start exit0，PID 934715，online。start调用及确认耗时0.752s。未delete/save/kill、未操作其他app；其他app摘要首尾一致。启动新增日志无已检查fatal patterns。

## 12 Feature / Allowlist Safety

启动后任何HTTP前先核：Feature OFF，TENANTS/COURSES/USERS EMPTY；核验依据unchanged launcher将精确runtime覆盖PM2继承环境，未公开环境值。之后只读终态再确认。未发送Agent POST，无admission、conversation/message/run；Provider0。未通过Live AI测试部署。

## 13 Application Health

PM2online、Build `6IhDHN8Dm1nCewiCEZnV5`、Next16.2.10；localhost homepage/login/media HEAD200，compiled关键route存在，未见启动fatal。platform/dashboard、course entry、admin及两authoring routes返回HTTP200，但HTTP200不证明登录后功能通过；无session的流式shell/redirect不可当作授权业务验收。

**AUTHENTICATED UI VERIFICATION NOT EXECUTED。** 没有明确授权的已有owner/student session；没有service-role冒充、自动选owner、magic link、Auth修改或绕过登录。课堂/教材实际authenticated read、视频课堂交互等保留AUTH SESSION REQUIRED。只验证现有图片media HEAD，不声称外部视频/CDN全链路通过。

## 14 Authoring Availability

教材制作 `/platform/dashboard/admin/apps/korean/textbooks`、Script Studio `/platform/dashboard/admin/apps/korean/teaching-scripts` 的compiled routes、基础HTTP和所需schema/RPC存在：PASS。登录后的界面加载验收 **PARTIAL — AUTH SESSION REQUIRED**。没有创建textbook/lesson/script/node、没有Save/Publish、没有调用create_teaching_content_skeleton。

## 15 RLS / ACL Verification

Agent浏览器表权限拒绝/RLS、usage三条restrictive boundary、005 policies/safe view、006 reconciler ACL/contract和007 owner guard/skeleton ACL均PASS，仅catalog检查。12个Agent RPC service-only、private Agent helper权限、35函数正文/签名/owner/config/definer/ACL核对通过；不放宽RLS兼容旧app。

追加原始catalog数组SHA比较曾有functions/indexes/triggers不一致，因此暂停部署调查。索引/trigger完整record的排列重新计算可精确复现R5B SHA，证明只存在数组顺序差异。函数逐项source contract通过，类型签名仅规范化public.agent_runs限定名与等价类型拼写；**不声称未排序的functions原始SHA相同**。其余columns/constraints/RLS/policies/view/Agent rows原始摘要相同。这是观察格式限制，不是重写migration或忽略安全差异。见[catalog-order-investigation.json](evidence/teaching-agent-stage-1f-r5c/catalog-order-investigation.json)。

## 16 Production Safety Diff

允许且实测的变化：449→457/Foundation schema，精确R3D四项文件、named app PID/start，fresh backup和私有回执。Project/host、runtime/launcher SHA、Tailscale完整canonical SHA、其他PM2 app、OFF/EMPTY均保持。443/4000/8443保持，9443absent；未Funnel/ACL/probe。

本任务Agent/Provider/content/Auth/enrollment/reconciler/cancel调用或写入均0。零计数是本任务行为边界，另以Agent行数0、既有表count一致辅助核验，不声称全站完整逐行审计。截止后的操作仅只读核验、删除本窗口临时连接资料及必要本地回执/文档记录；没有新的production mutation。

## 17 Private Receipts

`/home/yangzhen/operations/uply/teaching-agent/foundation-install/20260916T025809Z`。Authorization、backup及restore、8 migration receipts、final migration、deployment、PM2 stop/start、verification齐全；目录0700、回执0600，原件不入Git。临时pgpass/service/CA已清理；fresh backup、persistent candidate、原/tmp artifact及pre-foundation旧文件保留。无自动receipt/backup删除。

最终window-completion成功签署因超时被拒绝；repo记录实际deadline与迟到只读观察，不能把完整技术回执集合误写成整个窗口COMPLETED。

## 18 Gate Matrix

PASS只限所列范围；G-R5C-37失败与G-R5C-31部分验证保留，不能多数票签GO。

| Gate | Item | Status | Evidence / limitation |
|---|---|---|---|
| G-R5C-1 | Explicit Authorization | PASS | 本任务用户明确授权，仅60分钟 |
| G-R5C-2 | Window Active | PASS | 每个production变更前检查；无截止后production变更 |
| G-R5C-3 | Production Identity Match | PASS | PG17.6/project/host MATCH |
| G-R5C-4 | Input Hashes Locked | PASS | 8迁移+candidate/runner/transport/package/runtime/launcher MATCH |
| G-R5C-5 | Maintenance Credential Valid | PASS | READ ONLY capability SUFFICIENT / VALID |
| G-R5C-6 | Named PM2 App Stopped | PASS | only uply-first-enable；3000不再监听 |
| G-R5C-7 | Fresh Backup Created | PASS | 本窗口新recovery point |
| G-R5C-8 | Fresh Backup Seal Valid | PASS | full/schema/roles/list exit0，seal VALID |
| G-R5C-9 | Fresh Backup Restore Verified | PASS | 26项真实isolated restore PASS |
| G-R5C-10 | Backup Age <=15m At Migration000 | PASS | 181.183s，<=900s |
| G-R5C-11 | Migration000 Confirmed | PASS | CONFIRMED / new readonly ledger450 / objectsPASS |
| G-R5C-12 | Migration001 Confirmed | PASS | CONFIRMED / new readonly ledger451 / objectsPASS |
| G-R5C-13 | Migration002 Confirmed | PASS | CONFIRMED / new readonly ledger452 / objectsPASS |
| G-R5C-14 | Migration003 Confirmed | PASS | CONFIRMED / new readonly ledger453 / objectsPASS |
| G-R5C-15 | Migration004 Confirmed | PASS | CONFIRMED / new readonly ledger454 / objectsPASS |
| G-R5C-16 | Migration005 Confirmed | PASS | CONFIRMED / new readonly ledger455 / objectsPASS |
| G-R5C-17 | Migration006 Confirmed | PASS | CONFIRMED / new readonly ledger456 / objectsPASS |
| G-R5C-18 | Migration007 Confirmed | PASS | CONFIRMED / new readonly ledger457 / objectsPASS |
| G-R5C-19 | Final Ledger457 | PASS | latest202609140007 |
| G-R5C-20 | Old449 Prefix Preserved | PASS | version/name/完整SQL旧prefix unchanged |
| G-R5C-21 | Expected DB Objects | PASS | 35 functions + columns/constraints/indexes/triggers |
| G-R5C-22 | RLS / ACL | PASS | exact policies/view/RLS；35函数权限逐项核对 |
| G-R5C-23 | Persistent Artifact Hash | PASS | approved SHA exact |
| G-R5C-24 | Deployment Exact Build | PASS | 6IhDHN8Dm1nCewiCEZnV5 |
| G-R5C-25 | PM2 Named App Online | PASS | PID 934715 |
| G-R5C-26 | Feature OFF | PASS | 启动后第一项安全检查；终态OFF |
| G-R5C-27 | Allowlists EMPTY | PASS | TENANTS/COURSES/USERS EMPTY |
| G-R5C-28 | Agent Rows Zero | PASS | 五张Agent表0 |
| G-R5C-29 | Provider Requests Zero | PASS | 本任务Provider0；无Agent/LLM测试 |
| G-R5C-30 | Base App Health | PASS | HTTP/login/media基础健康；认证课堂业务验证未执行 |
| G-R5C-31 | Authoring Foundation Available | PARTIAL | compiled routes/schema/RPC PASS；AUTH SESSION REQUIRED |
| G-R5C-32 | Tailscale Unchanged | PASS | 443/4000/8443保持，9443absent |
| G-R5C-33 | Runtime Unchanged | PASS | 精确SHA MATCH |
| G-R5C-34 | Launcher Unchanged | PASS | 精确SHA MATCH |
| G-R5C-35 | No Production Content Writes | PASS | 本任务0；41教学及身份相关表计数一致 |
| G-R5C-36 | No Reconciler Run | PASS | 0；只查catalog |
| G-R5C-37 | Window Not Exceeded | FAIL | 最终只读复核超过60分钟；不延长窗口，HOLD |
| G-R5C-38 | Private Receipt Set Complete | PASS | 授权/backup/8迁移/final/deploy/PM2/verification回执齐；600/700 |
| G-R5C-39 | Sensitive Evidence Boundary | PASS | repo仅安全摘要，私有原件/凭据不入Git |
| G-R5C-40 | Stage1G Not Auto-Enabled | PASS | NOT AUTHORIZED / NOT READY |

## 19 Remaining Stage1G Work

本阶段后续状态 **HOLD**，不是自动进入content preparation。需先独立决定窗口过期后的执行闭环；当前无后续production变更授权。Authenticated Authoring UI仍须合法明确授权session。

后续独立阶段才涉及production content、approved internal/test identity、enrollment/tenant、server Pins、single-lesson scope、definition publication、allowlists/Feature Enable、Provider policy/真实AI及Stage1G。Foundation授权不替代这些授权或政策批准；standby/off-host等真实外部rollout条件也未自动消失。

## 20 Final Recommendation

**CONDITIONAL — Foundation已安装，运行安全终态PASS；WINDOW EXPIRED / EXECUTION INCOMPLETE，因此Foundation Technical Status HOLD。** 保持新app online、Feature OFF、allowlists EMPTY。不继续内容准备、不创建hangul-introduction/Pins、不调用Provider、不进入Stage1G。本阶段到此停止。

证据目录：[R5C evidence](evidence/teaching-agent-stage-1f-r5c/)。文件范围/JSON/Markdown/secret检查见[workspace-scope.json](evidence/teaching-agent-stage-1f-r5c/workspace-scope.json)。
