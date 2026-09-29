# UPLY Teaching Agent — Stage 1F-R4G Pilot Operations Acceptance Closure

## 1 Executive Summary

**Overall: GO — Operational Acceptance Closure。Primary Operator Package: ACCEPTED BY PRIMARY OPERATOR（杨震）；Manual Monitoring: ACCEPTED FOR PILOT；Private Receipt Storage: READY。**

**OPERATIONAL ACCEPTANCE != PRODUCTION EXECUTION AUTHORIZATION。Operational Production Execution: BLOCKED；Stage 1G: NOT READY。**

用户已明确接受运维程序，本阶段按事实记录，没有再次请求其接受，也没有推定生产授权。R4F CLI/SQL/006精确hash全部匹配；受限目录、安全原子写入与清理实测通过；接受原件已存private operations，repo仅脱敏metadata。生产开始/结束只读检查与R4F相同，reconciler、DB写入、Agent、Provider请求及scheduler安装均0。

## 2 Explicit User Acceptance

Primary Operator：**杨震**。Acceptance recorded at：**2026-09-15T07:52:37.180731Z**；Asia/Seoul：2026-09-15 16:52:37.180731 +09:00。时间取实际创建接受记录时UTC，不是编造批准窗口，也不是首次用户声明的消息时间。

接受依据：本阶段用户明确确认Primary职责、每5分钟人工monitoring、manual drain、incident、UNKNOWN处理、private receipt及no-auto-retry规则。公开接受摘要见 [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；私有原件只保存于operations目录，没有将其内容复制入Git。

## 3 Acceptance Scope

| 范围 | 状态 |
|---|---|
| Primary职责 / manual monitoring / manual drain / incident程序 | ACCEPTED BY 杨震 |
| UNKNOWN / no-auto-retry / immutable original receipt | ACCEPTED |
| Private receipt 0700/0600保存、禁止Git、无自动删除 | ACCEPTED；storage实测READY |
| 单获批tenant、默认50/max100、无global sweep/自动下一批 | ACCEPTED；实际production tenant未批准 |
| Independent Backup / Standby | TBD — NOT ASSIGNED / BLOCKED |
| Data / Policy Approver / Provider Policy | TBD — APPROVAL REQUIRED / BLOCKED |
| Production tenant/user、maintenance credential、window | TBD — 未批准 |
| Production migration/deploy/reconciler/cancel/restore | 本次不授权、不执行 |
| Feature ON、allowlist、真实学生开放、broader rollout | 本次不授权、不执行 |

只更新roles、runbook、本报告及R4G evidence；外部仅授权的private operations目录和文件。没有修改源码、CLI/SQL、migration、baseline、release artifact、runtime/PM2/Tailscale或R4D/E/F历史报告。没有git add/commit/reset/clean/checkout。

## 4 Production Preflight

已完整阅读R4F/R4E/R4D、roles/runbook、CLI/SQL/README/006。复用已审阅的 [R4C inventory.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4c/inventory.py) 的只读函数；未调用其历史evidence写入入口。数据库仅catalog/ledger、显式REPEATABLE READ READ ONLY及timeout，TLS verify-full；临时600凭据受限挂载后清理，不读取学生业务行、不输出凭据。

| 项目 | 开始实测 |
|---|---|
| UTC | 2026-09-15T07:50:53.916309+00:00 |
| PostgreSQL / ledger / latest | 17.6 / 449 / 202609130003 |
| 完整有序version/name ledger SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| 202609140000–007 / 五张Agent表 / 全public agent_*表 | NOT APPLIED / 0 / 0 |
| Feature / 三allowlists | OFF / EMPTY |
| PM2 | online，PID1176676，restart_time0，kill_timeout15000ms，与R4F相同 |
| Runtime / launcher / Serve | 精确hash与R4F相同；9443 absent |

[production-preflight.json](evidence/teaching-agent-stage-1f-r4g/production-preflight.json) 保存逐项比较；所有检查PASS。迁移未应用依据完整ordered ledger hash与R4F相同，而非仅依据表名缺失。没有把Agent表不存在误报为执行active查询得到0。

## 5 Operator Bundle Lock

| 文件 | 本次SHA256 | 结果 |
|---|---|---|
| scripts/teaching-agent-r3a/reconcile-command.py | `12842a373fd85fdc19cebafef40505387c970711376718c5f164b1ef71d21437` | MATCH / LOCKED |
| scripts/teaching-agent-r3a/operator-reconcile.sql | `b774e2cf72e12dba59d9ba06a4d14cec684b9555c47787dfdff33da1554bf36d` | MATCH / LOCKED |
| supabase/migrations/202609140006_agent_run_reconciliation.sql | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | MATCH / LOCKED |

`reconcilerVersion=deadline-terminal-v1`；`receiptVersion=reconciler-receipt-v1`；batch default50/max100；persisted deadline+6s。开始/结束均重新核SHA；任一变化STOP，不接受新版本。见 [operator-bundle.json](evidence/teaching-agent-stage-1f-r4g/operator-bundle.json)。R4G未重跑R4F数据库/Provider合成测试，也未改动它们。

## 6 Primary Operator Acceptance

Primary Operational Acceptance：**ACCEPTED BY 杨震**；Primary Operator Package：**ACCEPTED BY PRIMARY OPERATOR**。同步至 [roles](teaching-agent-pilot-operations-roles.md) 与 [runbook](teaching-agent-pilot-operations-runbook.md)。Release/Pilot/Incident/Monitoring/Teaching Content Owner仍杨震；R4D backup/restore operator授权只属于既有备份与隔离恢复范围。

受限维护凭据持有人、单tenant人员授权及实际窗口仍未批准。CLI operator标签不认证批准权，基础设施DB权限也不自动授予全tenant操作权。普通platform-admin业务JWT不能替代maintenance RPC授权。

## 7 Manual Monitoring Acceptance

**Accepted Pilot Monitoring Cadence: Every 5 minutes while Pilot window is active。Scheduler: NONE — MANUAL PILOT SUPERVISION。** 只是人工检查频率，不是网络/response SLA或自动调度周期。

额外触发：Pilot开始前、每个重要Run后、incident发生时、drain开始与结束、Pilot窗口结束、release切换之前；保留每Run pre/post。正式15项：Feature、allowlist、PM2 online、restart count、批准tenant全部active、overdue/expired、cancel_requested、terminal分布、eligible、last receipt、Provider失败/timeout、Tool失败、Output Gate/evidence、permission/tenant异常、Teaching Domain Writes。

Student MVP Teaching Domain Writes预期0；任何不可观测项 **UNKNOWN → HOLD**，不猜0。Runbook§5列现有查询与观测缺口：没有完整在线零写计数器、自动last-receipt索引或全覆盖pre-admission告警；接受人工检查不制造这些能力。未安装cron/systemd timer/PM2 schedule/Supabase cron/GitHub schedule；NONE限本Agent/本任务，不断言整机无其他scheduler。

## 8 UNKNOWN / No-Retry Policy

**ACCEPTED：UNKNOWN → STOP → NO RETRY → NEW READ-ONLY CONNECTION → READ-ONLY VERIFY → OPERATOR REVIEW。**

仅CONFIRMED可认定提交；正常成功还须SUCCESS/true及回执保存正常。psql完整返回、exit0、严格RPC结果与COMMIT后ACK共同确认；SELECT、exit0或ACK单独不足。dispatch后timeout、断连、SQL拒绝、killed process、坏输出/缺receipt默认UNKNOWN。NOT_COMMITTED只用于明确未dispatch/无提交机会的本地验证、缺operator、非法limit或执行前receipt path问题。

原UNKNOWN receipt不可修改；另存follow-up数据库状态，failed/cancelled也可能由其他worker/reconciler提交，**永远不能倒签原invocation为CONFIRMED**。新连接仍须批准target/身份/tenant范围；不自动查询、重试或续批。下一次显式操作前由Primary Operator重新核receipt、all active、eligible及production state。

## 9 Drain Acceptance

**ALL ACTIVE = 0 Rule: ACCEPTED。** Future manual drain：STOP NEW ADMISSION并核全部实例 → 查批准tenant全部active → appropriate且获批的persistent cancel → bounded worker wait → persisted deadline+6s后获批tenant单批reconciler → require CONFIRMED receipt → 再查全部active=0 → 确認无意外Provider/Tool/Teaching执行 → drain complete。

**eligible=0 != drain complete**；未来active、UNKNOWN receipt或观测缺口均不能签Drain PASS。不开自动下一批/global sweep，不延长模型预算。Feature启动时加载，仅改配置文件不证明停新请求。本阶段未调用cancel/reconciler，也未更改生产实例。

## 10 Incident Acceptance

Immediate STOP规则 **ACCEPTED BY 杨震**：cross-tenant evidence、permission violation、wrong lesson/selection、verified_selection违规、Teaching越权写、Output Gate bypass、必要evidence/persistence前answer.final、Provider不停止、UNKNOWN reconcile、Run不能terminalize、active不能收敛、production schema/runtime scope drift及意外Feature/allowlist状态。

任一发生立即 **HOLD / STOP NEW ADMISSION**，不等下一个5分钟sweep。按runbook§8保存受限证据、新只读核验、明确授权下取消/收敛、复查active0并分类处置。Agent问题不等于数据库恢复；不DROP Agent表，不自动重启/恢复/迁移。

## 11 Private Receipt Storage

**Private Receipt Storage: READY；Atomic Receipt Storage: PASS。**

| 项目 | 实测 |
|---|---|
| Receipt path | `/home/yangzhen/operations/uply/teaching-agent/receipts/` |
| 创建目录 | operations、uply、teaching-agent、receipts、acceptance，共5个，原本均不存在 |
| Owner / group | yangzhen / yangzhen，UID/GID1001 |
| Directory mode | 全部新目录0700，operator可写，无group/world写 |
| 路径检查 | 各级lstat，无symlink、无ACL扩展、同设备、ext4本地rw mount |
| OS祖先 | `/`、`/home` root:root0755；`/home/yangzhen` yangzhen:yangzhen0750；未chmod既有父目录 |
| Atomic probe | synthetic-only，同目录temporary0600→flush→fsync→atomic rename→目录fsync→readback一致 |
| 最终file mode / cleanup | 0600；probe与其temporary已删除，无fake production receipt |
| Private acceptance | CREATED，acceptance目录0700、原件0600，不是DB receipt |

沙箱内初次只读视图将OS根目录owner映射为nobody且mount为ro；因外部目录超出工作区写权限，通过工具filesystem授权在宿主视图重新核验root祖先、rw mount后才创建。未把沙箱映射误认为目录可直接写或强行修改父目录。用户对创建目录的实质授权来自R4G请求。

Private acceptance原件：`/home/yangzhen/operations/uply/teaching-agent/acceptance/r4g-pilot-operations-acceptance-20260915T075237180731Z.json`；SHA256 `c74fd98f175d5a85179e052f1ae5773458ce3fdba777a44b4f7e8c5a77bee914`。repo只记录路径/hash/mode/时间等metadata，原件内容未复制入Git，未记录production tenant/run UUID、DB URI、学生数据或secret。证据：[receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)。

此测试验证当前文件系统写入路径，不冒充数据库COMMIT验证或掉电恢复测试。未来实际receipt仍须使用唯一private路径并核权限。

## 12 Receipt Retention Status

**TBD — FINAL RETENTION PERIOD NOT YET DECIDED。NO AUTOMATIC DELETION已接受。** 用户明确决定之前保留未来Pilot receipts；不安装自动删除，不编造7/30/90天批准，不当作法律保留期。最终期限、复核人和交接安排仍TBD；R4D备份保留规则不套用receipt。

## 13 Operator Execution Environment

Host Native psql：**NOT AVAILABLE**；`command -v psql` exit1，无可执行路径，未安装。现有候选镜像 `public.ecr.aws/supabase/postgres:17.6.1.159` 使用 `--pull=never --network=none` 仅执行`psql --version`，返回 **psql (PostgreSQL) 17.6 / exit0**，没有DB连接或发布端口。

Approved Candidate Client：**PostgreSQL 17.6 Docker client — TECHNICALLY AVAILABLE**；image ID `sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f`。这只证明现有客户端可用；主机CLI需要PATH中的psql，未来受控client适配、维护service/CA/passfile、production权限/tenant/window仍须另行落实。没有创建production维护凭据或CLI wrapper，没有写PRODUCTION EXECUTION APPROVED。见 [client-environment.json](evidence/teaching-agent-stage-1f-r4g/client-environment.json)。

Future命令仅在runbook§2作为placeholder文本保存，显式operator杨震，service/tenant/release/build/private-path均占位；本阶段未运行该命令。

## 14 Standby Status

**Backup / Standby Person: TBD — NOT ASSIGNED；Independent Standby: BLOCKED；Single-operator risk: ACKNOWLEDGED。** 杨震作为Primary或Backup Creation/Restore Operator不构成独立备班；没有根据第二个OS账号推定人员、权限或接受记录。Data / Policy Approver仍TBD；Provider Policy仍BLOCKED / APPROVAL REQUIRED。

## 15 Backup Freshness

R4D verified snapshot：`2026-09-15T06:31:24.914920Z`。本次计算时间 `2026-09-15T07:59:38.888706+00:00`；age **5293.974秒（88.233分钟）**，已超过900秒。

**Go-live Backup Freshness: STALE FOR <=15m CHANGE-WINDOW RPO；R4D Backup Technical Readiness: READY。** 只读取既有snapshot证据计算年龄，没有新backup/restore或重新seal。真正production change window前须新fresh recovery point，或取得明确RPO exception；broader rollout前off-host仍需落实。见 [backup-freshness.json](evidence/teaching-agent-stage-1f-r4g/backup-freshness.json)。

## 16 Production End-State

结束只读采样 `2026-09-15T07:56:18.299282+00:00`，全部比较PASS；此后仅完成文档/evidence与workspace验证。见 [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)。

| 项目 | 结束状态 |
|---|---|
| PG / ledger / latest | 17.6 / 449 / 202609130003；完整ledger SHA与R4F/preflight一致 |
| Agent migrations / tables | 000–007 NOT APPLIED；五表0/all public agent_*0 |
| PM2 | UNCHANGED；PID/restarts/uptime/status/kill_timeout一致 |
| Runtime SHA | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8`，UNCHANGED |
| Launcher SHA | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039`，UNCHANGED |
| Tailscale canonical SHA | `b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256`，UNCHANGED |
| Bindings | 443→127.0.0.1:3001、4000→4000、8443→3000；9443 absent；Funnel=false |
| Feature / allowlists | OFF / EMPTY；无写入 |
| Task production DB writes / reconciler / cancel / Agent / Provider | 0 / 0 / 0 / 0 / 0 |
| Migration / deploy / restore / scheduler installs | 0 / 0 / 0 / 0 |
| 授权private filesystem写入 | NONZERO；目录与接受文件已创建，合成probe已清理 |

“0”仅限本任务动作，不宣称其他用户同期没有业务写入。只读状态证据覆盖列明catalog/ledger/配置；runtime文件OFF/EMPTY及相同进程摘要不等于核验不可见的完整进程env或热加载。客户端TLS成功不代表pooler后端全部内部链路已验证。

## 17 Gate Matrix

PASS只评价R4G接受闭环及已执行检查。“状态明确”Gate通过不表示standby或政策本身就绪；生产执行仍BLOCKED。

| Gate | Name | Status | Evidence / scope |
|---|---|---|---|
| G-R4G-1 | User Operational Acceptance Recorded | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；明确用户接受与真实记录时间 |
| G-R4G-2 | Primary Operator Accepted | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；杨震已接受Primary职责 |
| G-R4G-3 | Manual 5-Minute Monitoring Accepted | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；每5分钟人工值守；不是SLA或scheduler |
| G-R4G-4 | UNKNOWN Stop/No-Retry Accepted | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；UNKNOWN STOP/NO RETRY |
| G-R4G-5 | Follow-up Read Rule Accepted | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；新只读连接；原UNKNOWN永不倒签 |
| G-R4G-6 | Drain Active=0 Rule Accepted | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；ALL ACTIVE=0；eligible=0不足 |
| G-R4G-7 | Incident STOP Rules Accepted | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；立即STOP，不等下一sweep |
| G-R4G-8 | Operator Bundle Hash Locked | PASS | [operator-bundle.json](evidence/teaching-agent-stage-1f-r4g/operator-bundle.json)；三个文件SHA全部一致 |
| G-R4G-9 | R4F CLI Hash Match | PASS | [operator-bundle.json](evidence/teaching-agent-stage-1f-r4g/operator-bundle.json)；CLI匹配R4F |
| G-R4G-10 | Operator SQL Hash Match | PASS | [operator-bundle.json](evidence/teaching-agent-stage-1f-r4g/operator-bundle.json)；SQL匹配R4F |
| G-R4G-11 | Migration006 Hash Match | PASS | [operator-bundle.json](evidence/teaching-agent-stage-1f-r4g/operator-bundle.json)；冻结006匹配R4F |
| G-R4G-12 | Private Operations Directory Safe | PASS | [receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)；lstat/owner/group/ACL/mount检查通过 |
| G-R4G-13 | Receipt Directory 0700 | PASS | [receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)；目录0700且operator可写 |
| G-R4G-14 | Atomic Receipt Storage Probe | PASS | [receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)；同目录temp→fsync→rename→readback→清理 |
| G-R4G-15 | Receipt File Mode 0600 | PASS | [receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)；探针及private acceptance文件0600 |
| G-R4G-16 | Private Acceptance Record Created | PASS | [receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)；私有原件已创建，未复制入Git |
| G-R4G-17 | No Scheduler Installed | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；本任务安装0；不宣称全服务器无其他调度 |
| G-R4G-18 | Receipt Retention Status Explicit | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；最终期限TBD；无自动删除；不是期限获批 |
| G-R4G-19 | Independent Standby Status Explicit | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；明确TBD/BLOCKED；不是独立备班READY |
| G-R4G-20 | Provider Policy Status Preserved | PASS | [acceptance-summary.json](evidence/teaching-agent-stage-1f-r4g/acceptance-summary.json)；仍TBD / BLOCKED / APPROVAL REQUIRED |
| G-R4G-21 | Future Client Environment Known | PASS | [client-environment.json](evidence/teaching-agent-stage-1f-r4g/client-environment.json)；host无psql；Docker17.6可用，不等于执行批准 |
| G-R4G-22 | Production Reconciler Runs Zero | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；本任务0，未调用CLI |
| G-R4G-23 | Production DB Writes Zero | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；固定READ ONLY catalog；本任务写0 |
| G-R4G-24 | Production Ledger Unchanged | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；449/latest130003/完整ledger hash一致 |
| G-R4G-25 | PM2 Unchanged | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；PID/restarts/uptime等一致 |
| G-R4G-26 | Runtime Unchanged | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；runtime/launcher hash、OFF/EMPTY一致 |
| G-R4G-27 | Tailscale Unchanged | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；完整Serve canonical hash一致，9443不存在 |
| G-R4G-28 | Feature OFF | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；配置OFF；无启用操作 |
| G-R4G-29 | Allowlists EMPTY | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；三个名单EMPTY；无写入 |
| G-R4G-30 | Provider Requests Zero | PASS | [production-end-state.json](evidence/teaching-agent-stage-1f-r4g/production-end-state.json)；本任务0，无Agent/Provider路径 |
| G-R4G-31 | Backup Freshness Recheck Rule Preserved | PASS | [backup-freshness.json](evidence/teaching-agent-stage-1f-r4g/backup-freshness.json)；已STALE；技术READY不替代窗口新鲜度 |

JSON与最终文件范围/敏感边界验证见 [gates.json](evidence/teaching-agent-stage-1f-r4g/gates.json)、[workspace-scope.json](evidence/teaching-agent-stage-1f-r4g/workspace-scope.json)。

## 18 Remaining Stage1G Blockers

- Provider Policy与Data / Policy Approver；运维接受不替代数据政策批准。
- 真实production内容、合法internal/test user、StudentPolicy及server Pins；本轮未创建或验证这些资源。
- 恰好一课的eligible scope及Pilot窗口冻结；不能仅依赖操作员选择。
- Independent Backup / Standby尚未指定。
- Exact production tenant/user授权、maintenance credential/受控client适配、实际执行窗口与交接复核人。
- Production migration/deploy/definition publication/allowlist/First Enable等明确执行授权。
- 实际go-live fresh recovery point≤15分钟或明确RPO例外；broader rollout前off-host backup。
- R4B compression path limitation：Streaming/Origin/Disconnect历史PASS，Compression/Buffering仍PARTIAL；未重测、不扩大结论。
- Receipt最终retention period及其余未关闭的production Gate；观测UNKNOWN必须HOLD，不通过补Agent功能绕过。

## 19 Final Recommendation

**R4G GO：Operational Acceptance Closure PASS；Primary Operator Package ACCEPTED；Receipt Storage READY。** 保留全部生产边界：Operational Production Execution BLOCKED；Stage 1G NOT READY。本阶段到此停止，未执行production reconciler、Agent、Provider、migration、deploy、Feature Enable、allowlist或scheduler。
