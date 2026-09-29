# UPLY Teaching Agent — Stage 1F-R4C Backup & Recovery Readiness Preflight

## 1. Executive Summary

**Overall: CONDITIONAL，仅指只读 Preflight 与方案整理；Backup / Recovery: BLOCKED；Stage 1G: NOT READY。**

本轮未创建 production backup、未恢复数据库、未迁移或部署、未重启 PM2、未修改 Tailscale、runtime、Feature 或名单，未发起 Agent / Provider 请求。

发现比 R4 引用记录更新的 **2026-09-13 完整逻辑备份**：5,746,105 bytes，custom/gzip，PostgreSQL 17.6。其归档、两份 seal 清单及历史恢复凭据仍匹配；盘点时年龄 **50.8308 小时（约 2 天 2 小时 50 分钟）**。该备份早于 9 月 13 日后续迁移，不能当成本次 Teaching Agent 的 fresh recovery point。磁盘容量满足保守规划，但 RPO/RTO、恢复窗口、Backup Operator、off-host 及实际回滚访问尚未闭环。

| 判定 | 当前状态 |
|---|---|
| Backup Inventory | PASS，限定为已知路径内的 10 份候选文件 |
| Fresh Pre-change Recovery Point | NOT CREATED |
| Restore Procedure / Plan | PARTIAL：可审阅草案已形成，执行前置待落实 |
| Restore Verification | NOT EXECUTED（本轮；历史隔离恢复单独列明） |
| Backup Operator | NOT ASSIGNED |
| Backup / Recovery Overall | BLOCKED |
| Production Migration | NOT APPLIED；当前 ledger 无八份 202609140000–007 |
| Stage 1G | NOT READY |

## 2. Scope, Inputs & Evidence

完整阅读 [R4](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4-production-authorization-gate.md)、[R4A](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4a-release-metadata-closure.md)、[R4B](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4b-tailscale-transport-verification.md)；阅读 [R3 §19–21、§29–30](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3-production-operations-gate.md:194)、[R3A drain](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3a-run-reconciliation.md:157)、[reconciler README](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md)。R3 的强杀 drain FAIL 已由 R3A 技术闭环补充，不能继续使用旧等待方案；正式运维授权仍独立。

从已知 evidence 路径进入 `/home/yangzhen/backups/uply-first-enable-20260910/`，检查其四个直接子目录中的 dump；另检查前阶段已知 `/tmp` schema archives。未全盘扫描、未访问学生业务行、messages、progress、grades 或教材正文。备份只做 stat、SHA256、`pg_restore --list` 和既有安全元数据核验，未输出 archive payload。Off-host 搜索只覆盖仓库文档/运维脚本中明确的备份机制，不能断言不存在未知外部副本。

新增只读 helper：[inventory.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4c/inventory.py)、[offline-inventory.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4c/offline-inventory.py)。本机无 PATH 可用的 PostgreSQL CLI，复用已安装 `public.ecr.aws/supabase/postgres:17.6.1.159` 客户端容器，`--pull=never`，没有安装软件。目录读权限受当前工具沙箱约束；没有尝试写入 release 或备份目录来验证生产修改权限。

证据目录：[R4C metadata](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/)。新文件只保存路径、摘要、计数、时间、状态和脱敏运维元数据，不保存连接 URI、密码、Cookie、JWT、完整 PM2 环境或业务数据。

## 3. Current Owners & Decisions

| 角色 / 决策 | 状态与边界 |
|---|---|
| Release / Pilot / Incident Operator | 杨震，用户明确确认 |
| Monitoring / Teaching Content Owner | 杨震，用户明确确认 |
| 当前 OS account / 服务器管理人 | yangzhen / 杨震 |
| Backup / Backup Operator | **TBD — NOT ASSIGNED**；不能由 Release Operator 自动兼任 |
| Data / Policy Approver | **TBD — APPROVAL REQUIRED** |
| Backup creation / retention / off-host destination approval | PENDING；本轮无创建授权 |
| Recovery / rollback window | TBD — APPROVAL REQUIRED |
| Rollback operator access | PARTIAL：当前用户可读配置及 PM2；未验证生产替换/恢复操作，也无本次执行批准 |
| RPO | **TBD — owner decision required**：最多能接受丢失多少时间的数据 |
| RTO | **TBD — owner decision required**：最长能接受恢复多久 |

自管服务器、可读数据库或已有工具许可不等于获准恢复生产。历史恢复耗时不设定本次 SLA；RPO/RTO 必须由负责人决定。

## 4. Production Database Identity & Stability

开始只读采样 `2026-09-15T06:02:41.329494Z`，结束复核见 [database-end.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/database-end.json)。使用现有受限 libpq service 信息，与生产 runtime 的 Supabase project 做匹配；报告仅保留 project/host 摘要。

| 项目 | 实测 |
|---|---|
| Project identity SHA256 | `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673` |
| Host identity SHA256 | `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5` |
| Project matches production runtime | true |
| PostgreSQL / database | 17.6 / postgres |
| Approximate database size | 58,125,459 bytes，约 55.43 MiB；不是业务行大小或 dump 大小 |
| Non-system schemas | 13（排除 pg_* 与 information_schema） |
| Non-system tables | 230（relkind r/p）；public 174、auth 23、storage 8 |
| Migration ledger | 449 → 449 |
| Latest migration | 202609130003 / runtime_authoring_nonretryable_error |
| 完整 version/name 有序 ledger SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981`，前后一致 |
| Agent tables | public 五表 0；另查全部 public agent_* tables 0，前后一致 |
| Roles / extensions | 31 个 catalog roles；6 个 extensions |
| 事务保护 | default_transaction_read_only=on；显式 REPEATABLE READ READ ONLY；statement timeout 15s、lock timeout 2s；ROLLBACK 结束 |

连接启用 `sslmode=verify-full` 和 CA 验证，客户端诊断确认 **TLSv1.3 / TLS_AES_256_GCM_SHA384**。同时 `pg_stat_ssl` 的后端会话记录 ssl=false；这是另一个观测点，不能据此把客户端 TLS 写成失败，也不能声称平台内部每一跳都已验证。保留两项原始安全摘要。

本轮最初临时 service 文件因空格分隔格式被 libpq 拒绝，修正后连接成功；后续只读输出解析及 TLS 诊断调整不涉及生产配置。失败调用未触发 DDL/DML。生产查询只涉及 catalog、大小、连接状态和 migration ledger。没有重新读取内容链或运行 StudentPolicy，**Production Candidate=0 仅沿用 R4，非本轮内容调查**。

若未来 ledger 数量/完整摘要、cutover 或 Agent 表状态任一不同：**STOP — PRODUCTION STATE CHANGED**，不得沿用此恢复方案。前后计数相同不证明期间全站没有业务变化。

## 5. Existing Backup Inventory & Classification

完整逐文件 path、size、mtime、owner/mode、SHA、archive header、data section 和 seal 比较见 [backup-inventory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/backup-inventory.json)。以下四项均存在，owner=yangzhen、文件600、直接目录700；Format=CUSTOM、Compression=gzip、Dump Version=1.16-0，源 PostgreSQL / pg_dump 均17.6。

所有相对目录均位于 `/home/yangzhen/backups/uply-first-enable-20260910/`，文件名均为 `database.dump`。

| 目录 | 记录时间 UTC / 文件 mtime UTC | Bytes | TABLE DATA entries | 分类 / 校验 |
|---|---|---:|---:|---|
| 20260910T1353Z.LlXXsY | snapshot 09-10 14:06:47.353 / mtime 14:06:57.588 | 4,911,185 | 215 | B FULL LOGICAL + D STALE；seal 75/75 |
| pre-migration-20260910.Bvr8gH | snapshot 09-10 14:52:46.476 / mtime 14:52:56.012 | 4,911,185 | 215 | B FULL LOGICAL + D STALE；seal 54/54 |
| checkpoint-20260911.hgEVNx | archive created 09-10 18:49:59 / mtime 18:50:08.929 | 4,911,185 | 215 | B FULL LOGICAL + D STALE；FRESHNESS hash匹配；无独立 restore |
| grammar-2026-09-13T02-56-47-448Z.yjN7w6 | snapshot 09-13 03:22:45.723 / mtime 03:22:56.419 | 5,746,105 | 229 | B FULL LOGICAL + D STALE；pre/final seals 63/63、83/83 |

Checkpoint 的 `FRESHNESS.at=2026-09-10T18:50:09.878Z` 是比较完成时间，不是精确 snapshot；未为该项计算精确 snapshot age。目录名含 09-11 不能替代 archive 的实际 UTC 时间。

| 备份 | SHA256 |
|---|---|
| 09-10 first | `81dc7a65084ddbfd8b3c66bee12bd33cebc935eac5a76f45036cc923f6687f54` |
| 09-10 pre-migration | `87a30a271f8c551f014549907912c212ccf09eed2c4c1eeb0cf653c82cf0ecf3` |
| checkpoint | `b2f656f2c87c8a8ae0ba7a29485e60fca942c3973099a2d2c0449f38849b3b5b` |
| 09-13 grammar（最新） | `843a2b7e74708f2992265a963618cf69b9c4acc491ecc328ccbb4362c54a7b8a` |

“FULL LOGICAL”依据 archive 的 TABLE DATA entries、历史无 schema/data exclusion 的 pg_dump 命令及恢复证据；不是因为文件名叫 database.dump。Entries 数量不等于实际行数，也不保证整个 Supabase 平台能恢复。

另外六份 **A — SCHEMA-ONLY**：`/tmp/uply-stage1f-readonly/{schema.dump,r1b-schema.dump,r3-schema.dump,r3a-schema.dump,r4-schema-snapshot.dump}`、`/tmp/uply-r1b-snapshot/schema.dump`。每份2,801,375 bytes，均可 list、TABLE DATA entries=0；后者是 r1b 原件副本，SHA相同。这些是 R1B/R3/R3A/R4 架构演练输入，**不能恢复业务数据，也不因日期新而成为最新 full backup**。六份逐项 SHA/mtime/mode 已记录，未复制到仓库。

## 6. Historical Recovery Evidence & Freshness

两份 09-10 备份的 `FINAL_VERIFICATION.json` 记录真实隔离恢复、22项检查通过；本轮归档及相应封存文件全部匹配。Checkpoint 仅有归档展开 SQL 与旧备份相等的历史记录，明确 `newArchiveRestoredSeparately=false`，不能当成独立恢复实测。

09-13 备份的 `verified-restore-result.json` 记录 **restoreExit=0 / roleResetExit=0**；`FINAL_VERIFICATION.json` 于03:28:17.926Z记录22项PASS：table counts、functions、constraints、indexes、policies、extensions、schema/default ACL、database settings、roles/memberships、event triggers/triggers、sequences、large objects、database locale/owner/ACL、publications/members、views、foreign tables、subscriptions。文件hash仍匹配。这是历史恢复，不是本轮新 restore。

只读审阅历史 `restore-verification-operations.mjs` 可见：独立容器隔离；按 schema → extension owner/version → 剩余 TOC → ACL/database settings 补充；隔离环境为 managed event triggers 临时调整角色，再恢复 NOSUPERUSER。**单条 pg_restore 并非当时全部步骤**，不得略去 Supabase 特殊对象校验来宣布可恢复。

[09-13 early preflight](/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/deployment-backup-preflight.json) 在02:47Z记录的 `freshPreDeploymentRestorePoint=false` 当时准确，且针对两份09-10旧备份；不能用它描述09-13全天都未创建备份。后来的 [deployment-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/deployment-result.json) 明确记录03:22Z的新备份、相同SHA、恢复通过及其后迁移。03:48Z的 [backup-freshness.json](/home/yangzhen/projects/my-lms-system/docs/evidence/textbook-grammar-consistency-20260913/backup-freshness.json) 仅证明当时230表比较结果，不能推及09-15当前业务数据。

最新 full backup age 在 `backup-inventory.json.observedAt=2026-09-15T06:12:36.647423Z` 为 **50.8308 h**。这是时间差，**RPO DECISION REQUIRED**。没有本次 Teaching Agent 新鲜上线前恢复点：**NOT CREATED**；无新业务行指纹比较、无 PITR/WAL 连续恢复能力确认。

## 7. Capacity, Destination & Off-host

[capacity.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/capacity.json)：备份盘 `/dev/nvme0n1p2`，df约937G总量、299G已用、591G可用；精确可用633,665,249,280 bytes，约590.15 GiB；约5,970万可用inode。`/tmp` 是独立tmpfs，不能作为唯一长期恢复点。

规划最低数据库空间：**58,125,459 + 58,125,459临时开销 + 58,125,459安全余量 = 174,376,377 bytes（约166.30 MiB）**。建议为本次DB备份作业预留至少1 GiB，另加 application/dependency/config archives、隔离restore磁盘与保留的旧恢复点。该公式是保守容量预算，非所有数据库的 dump 大小上界；不能以历史5.75MB压缩文件反推新备份一定同样小。

未来目标提案：`/home/yangzhen/backups/uply/<approved-UTC-timestamp>/`；**未创建**。任务目录700、文件600、umask077，禁止Git、docs/evidence、public和公开分享。父 `/home/yangzhen/backups` 当前775，因此新的700子目录及实际访问控制必须由获批操作员确认；本轮没有chmod或写入测试。

**Off-site / Off-host Backup: NOT CONFIRMED。** 未发现已落地 NAS、Drive、另一台服务器或加密异机副本机制的明确证据；没有读取个人云盘配置或上传任何备份。当前副本都在同一服务器，不能覆盖整机/磁盘损毁。目的地、加密方式、密钥保管、保留期、删除流程及离机恢复可访问性待确认。

## 8. Supabase Recovery Scope

| 对象 | 当前证据 / 未来额外要求 |
|---|---|
| 应用 schema 与数据、约束/函数/RLS、sequence | 历史 pg_dump 无 schema-only；恢复曾核验。未来保持 owner/ACL，不能用 --no-owner/--no-acl 后跳过权限对比 |
| Auth | 当前auth有23表，旧TOC包含auth TABLE DATA；高度敏感。数据库行恢复不等于身份提供商/OAuth/SMTP/JWT配置恢复；本轮未读取Auth行 |
| Roles / memberships | pg_dump单库不覆盖全部cluster globals；历史另有 `pg_dumpall --roles-only --no-role-passwords`。当前catalog31 roles与历史记录16的统计范围不能直接等同，未来逐项确认managed/custom角色范围，不恢复生产角色密码或盲目CREATE重复角色 |
| Extensions | 当前6项及版本见DB evidence；恢复镜像必须具备扩展二进制并匹配owner/version，不能仅有扩展DDL |
| Storage / 外部媒体 | 当前storage8表，TOC含metadata；历史明确 mediaObjectsBackedUp=false。对象字节、媒体/CDN及外部桶不在本次database.dump完整性结论内 |
| Managed schemas / triggers / ACL | realtime、graphql、vault及私有schema需匹配平台bootstrap与角色约束；沿历史分步恢复检查，禁止把bare Postgres简单成功当成平台等价 |
| Vault / secrets / config | archive中包含vault数据段；不得打印/展开敏感内容。加密所需外部key、平台secrets、DB/service/Provider凭证与项目设置必须受限另存，恢复能力未确认 |
| Platform recovery / PITR | 未核实当前托管套餐、平台backup列表、PITR授权或跨项目恢复权限；NOT CONFIRMED |

PostgreSQL官方说明单库dump不含cluster全局角色，custom格式可压缩；Supabase官方说明DB备份不包含Storage对象字节、角色密码有额外处理要求。这些用于界定范围，不证明本项目平台功能已启用。[pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html)、[Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)。**一个 database.dump 不能据此宣称恢复整个 Supabase 平台。**

## 9. Application, PM2, Runtime & Tailscale Inventory

[application-inventory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/application-inventory.json) 与 [operations-end.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/operations-end.json)：

| 项目 | 实测 / 限制 |
|---|---|
| Known-good当前路径 | `/home/yangzhen/releases/uply-first-enable-20260910/source`，存在 |
| 当前磁盘 Build ID | `LuAZe2VMY32YjOo1WvtrC`，与R3/R4记录相符 |
| source / artifact | 源码目录、.next required-server-files、node_modules存在；Next16.2.10；未启动、未替换、未对当前旧binary完成完整历史hash证明 |
| R3旧应用回滚 | 同旧源码在staging配置下重建，课堂通过，Agent数据保留；不是生产旧binary原样回滚证明 |
| R3D候选 | `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz`，18,760,388 bytes |
| Candidate Build ID / SHA | `6IhDHN8Dm1nCewiCEZnV5` / `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28`，匹配R4A |
| Frozen inputs | R4记录的1306个source input逐项匹配；八份迁移SHA匹配当前manifest；R4A metadata payload digest自洽；未重build或重冻结 |
| 制品限制 | /tmp候选非长期库，完整依赖二进制封存未确认；不能将candidate=工程制品与Production eligible lesson Candidate=0混为一谈 |
| PM2 | uply-first-enable / online / fork_mode / instances1 / PID1176676 / restart_time0 / kill_timeout15000ms |
| PM2 cwd | `/home/yangzhen/releases/uply-first-enable-20260910/source` |
| Startup launcher | `/home/yangzhen/.config/uply-first-enable-20260910/start.mjs` |
| Launcher SHA256 | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039` |
| Runtime path / mode | `/home/yangzhen/.config/uply-first-enable-20260910/runtime.json` / 600 |
| Runtime SHA256 | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8`，前后相同 |
| Feature / allowlists | OFF；TEACHING_AGENT_ALLOWED_TENANTS/COURSES/USERS均EMPTY |
| 必要变量 | NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY、SUPABASE_SERVICE_ROLE_KEY、DEEPSEEK_API_KEY：SET；不记录值 |
| Tailscale | 443→127.0.0.1:3001；4000→127.0.0.1:4000；8443→127.0.0.1:3000；9443不存在，Funnel未启用 |
| Serve canonical SHA256 | `b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256`，前后一致 |

runtime为launcher启动时注入，**文件OFF不等于对不可见进程内配置的独立实测**。本轮不读取完整进程env、不发Agent HTTP、不修改配置。

`source`及`.next`的OS mode775、owner yangzhen；配置目录700、启动器600。当前沙箱下`os.access(W_OK)=false`，不能把它解释为杨震在服务器上永远无写权限，也不能以OS owner等于已获本次rollback授权。未来须确认执行环境、实际PM2管理和替换权限，禁止本轮以修改操作试探。

09-13 deployment报告的历史build `5Fa4thXL2m4EcFA5-Qx5R` 与当前磁盘Build ID不同；相关candidate目录、previous-source-files及`.next-before-grammar-1789271693244`仍存在，后者Build ID为`l9HmPxSMluZWoirjL544P`。它们是历史关联材料，**不自动替代当前known-good目标**，差异原因本轮未调查。[historical-deployment-links.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/historical-deployment-links.json)。

## 10. Production Backup / Recovery Runbook Draft — NOT EXECUTED

### 10.1 执行前置

未来仅在另行明确授权的R4D中：指定Backup Operator与备班安排；批准备份内容/敏感文件权限/保留期、维护与恢复窗口、RPO/RTO、off-host处理；确认真实执行权限及目的目录容量。重新核ledger449/202609130003/Agent0、OFF/EMPTY、精确候选和迁移SHA。任何变化STOP并REVERIFY，不自动开始backup、迁移、restore或deploy。

备份批次至少包含：A完整logical数据归档；B schema/roles/owner/ACL/extensions元数据；C与dump一致的migration ledger；D runtime/launcher/PM2/Serve受限配置快照；E known-good应用及依赖制品。数据库恢复和应用回滚是不同资产与流程。完整配置可能含密钥，只进受限备份，不进Git或报告。

### 10.2 未来备份命令合同（文本提案，未执行）

使用本轮已验证的PG17客户端、session/direct连接、TLS verify-full、受限CA/service/pgpass；不得将password或URI放在命令参数，不将.env传给数据库容器。PGSERVICEFILE按libpq `key=value`格式；passfile600、目录700。下面变量均须由未来批准窗口确定，不可自动取默认生产目标。

```bash
# FUTURE / SEPARATE R4D AUTHORIZATION REQUIRED — 本阶段未执行
# APPROVED_CONNECTION_DIR: 700；含备份专用service/CA/600 pgpass
# APPROVED_BACKUP_DIR: 新建的受限持久目录；绝非Git/docs/public/tmp
# APPROVED_SNAPSHOT: 下述独立只读session export的snapshot，session须保持打开
: "${APPROVED_CONNECTION_DIR:?}" "${APPROVED_BACKUP_DIR:?}" "${APPROVED_SNAPSHOT:?}"
umask 077
backup_client() {
  docker run --rm --pull=never --read-only --cap-drop=ALL \
    --security-opt=no-new-privileges --network=host \
    --user "$(id -u):$(id -g)" \
    -v "${APPROVED_CONNECTION_DIR}:/connection:ro" \
    -v "${APPROVED_BACKUP_DIR}:/backup:rw" \
    -e PGSERVICEFILE=/connection/pg_service.conf \
    -e PGSERVICE=approved_prechange_backup \
    -e 'PGOPTIONS=-c default_transaction_read_only=on' \
    --entrypoint "$1" public.ecr.aws/supabase/postgres:17.6.1.159 "${@:2}"
}
backup_client pg_dump --no-password --format=custom --compress=gzip \
  --snapshot="$APPROVED_SNAPSHOT" --lock-wait-timeout=15000 \
  --file=/backup/database.dump >"$APPROVED_BACKUP_DIR/dump.stdout.private" \
  2>"$APPROVED_BACKUP_DIR/dump.stderr.private"
# 立即捕获exit code和单调耗时；非0 STOP，不执行后续步骤，不seal为成功。
# 确认dump成功后，单独记录schema副本及无密码roles：
backup_client pg_dump --no-password --schema-only --format=custom \
  --snapshot="$APPROVED_SNAPSHOT" --lock-wait-timeout=15000 \
  --file=/backup/schema.dump
backup_client pg_dumpall --no-password --roles-only --no-role-passwords \
  --file=/backup/roles.sql
# 所有日志均重定向到受限目录；记录exit/duration，检查告警，不打印内容。
```

执行包装器需在每条命令结束立刻保存exit/duration；失败立即停止，不使用pipeline掩盖pg_dump exit。成功后记录文件size/mtime/owner/mode/SHA256，封存原件并核manifest；不是仅依据文件存在。

Snapshot协调：独立session `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT pg_export_snapshot();` 并保持存活。dump、schema和ledger/catalog读取均在导入同snapshot的只读事务内执行；结束后ROLLBACK并关闭session。角色/外部配置不属于同一MVCC数据库快照，必须在获批DDL/config冻结窗口分别记录前后状态，漂移则STOP。不得把多个不同时间查询伪装成一致恢复点。

本轮已执行的inventory helper不包含上述backup路径；不能将它改参数当backup runner。未来完整执行包装器、计时/错误receipt及受限输出仍需R4D审查。标准工具语义依据 [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html)。

### 10.3 Disposable Restore Environment

未来创建唯一project/container标签 `uply-r4d-recovery-<timestamp>`，标记`purpose=isolated-recovery`，数据库名`uply_recovery_<suffix>`，不得使用production项目或默认生产dbname。复用匹配PG17/Supabase扩展的已锁定镜像；**network=none，宿主机不发布端口**；如需内部TCP，指定隔离容器内不同端口55483并预查冲突，不绑定宿主443/4000/8443/9443/3000。优先docker exec + Unix socket。独立临时volume，不挂production data目录、service/pgpass、runtime或.env，不启动Auth邮件/webhook/Provider服务。

执行任何restore前核container标签/name/network/ports/mounts、数据库marker与目标名。发现远程host、生产URI、生产凭证或原项目容器立即STOP。只有获批dump可只读挂载；其包含真实敏感数据，隔离volume与日志同样受限，禁止业务行输出。所有恢复操作只针对此隔离环境。

### 10.4 Restore Procedure & Acceptance

1. 核归档SHA/size/mode，离线`pg_restore --list`退出0；核PG major及可用extensions。list成功只是目录可读，不等于数据页完整。
2. 参照已审阅历史helper准备独立roles、正确locale/owner的空数据库；处理managed bootstrap角色重复，不原样运行生产roles.sql。扩展/事件触发器所需临时提权只在隔离容器内，最后还原并验证角色属性。
3. 采用经审阅的TOC分步：schema → 与snapshot一致的extension版本/owner →剩余archive → ACL/default ACL/database settings补充。每一`pg_restore`使用`--exit-on-error --single-transaction`，每阶段exit0才继续；分阶段整体不是一笔事务，任一步失败本次验证FAIL。禁止忽略错误或靠删policy/函数过关。
4. 校验核心schema及table集合/计数；在受控环境核数据表row counts与一致snapshot清单，不打印学生行。核migration完整version/name摘要与备份snapshot一致，Agent migration前五表仍0；核constraints/functions/indexes/RLS/grants/owner/sequence/role memberships/触发器/extension与managed配置。未来若生产已变化，必须与新快照而非本报告硬编码比较。
5. 核所有恢复步骤exit0、恢复总duration、失败次数、完整性差异；任何权限或数据差异未解释则FAIL。清理临时角色权限，保存安全receipt；销毁隔离恢复环境按未来授权及数据保留约定执行，保留原备份和seal。
6. Restore Verification PASS仅限此dump与隔离环境。没有Storage对象、外部配置或托管平台恢复权限证明时，不能标整个平台恢复PASS，也不能承诺RTO。

`pg_restore --list`检查TOC；`--single-transaction`配合错误停止用于单次恢复调用。参考 [pg_restore 17](https://www.postgresql.org/docs/17/app-pgrestore.html)。本轮只执行list，未执行任何恢复SQL。

### 10.5 Recovery Scenario A — Migration Failure

Migration N事务失败：STOP；不执行N+1、不mark applied、不repair ledger、不启用Feature。保存安全exit receipt，重新只读核实际ledger与已存在对象，确认失败事务边界。若N已commit但verify失败或commit结果不明，保持OFF，保存当前状态并人工判断forward-fix/恢复；禁止盲目重放CREATE或全库restore。八份批准技术顺序为202609140000–007，当前均NOT APPLIED；不对现有库装baseline或重建449历史ledger。

### 10.6 Recovery Scenario B — Application Failure

迁移成功、新artifact部署后课堂异常：在独立事件/rollback授权下停止新admission并使所有serving实例实际OFF，按10.8 drain完成后，将应用恢复为已封存、已确认兼容的known-good release；核launcher/runtime目标、Build ID及课堂/媒体健康。当前启动器固定source路径，**不存在已经验证的通用symlink切换方案**，未来须审阅准确替换步骤与权限，不能凭本报告直接PM2 restart。保留additive migrations、Agent表、消息与audit，禁止DROP/down。回滚不以恢复旧database.dump为默认动作。

### 10.7 Recovery Scenario C — Confirmed Data Corruption

只有实际损坏确认且负责人明确批准才进入database restore incident：停止相关写入 → 保存事故状态和证据 → 确认RPO/损失窗口及恢复点 → 选择已校验backup → 先在上述隔离环境restore/验证 → 批准具体production恢复目标/窗口/执行人 → 另行执行生产恢复。恢复后核Auth/Storage/config一致性、ledger/schema/RLS及业务可用性，再按批准顺序恢复服务；禁止本阶段执行其中的生产变更。不能为普通Agent错误回滚整个库，损失备份之后正常课堂数据。

### 10.8 Recovery Scenario D — Agent-only Pilot Failure / Drain

若未来Agent异常而DB/课堂正常：在事件授权下Feature OFF、allowlists清空/收紧并验证实例已加载；新admission拒绝，保留owner GET/cancel。按获准tenant查询全部active，使用现有owner-bound持久cancel；等待活worker有界收尾。死亡worker在每个persisted deadline+6秒后，由获批基础设施连接执行`deadline-terminal-v1`有界reconcile，limit默认50、上限100；无全租户sweep、无续预算或自动模型重答。

仅接受COMMIT成功后的receipt；错误/timeout/不明提交STOP并核状态。空eligible batch不等于drain完成，须再查**全部active=0**并确认无新Provider/Tool/Teaching操作；必要时显式下一批。完成后才可另行批准app rollback/stop。通常不需要DB restore。每5分钟人工safety sweep、receipt保存位置/保留期/复核人与值守接受记录仍待确认；本轮未运行reconciler或安装scheduler。

## 11. Gate Matrix

PASS仅表示该项只读调查或计划已具备证据，不代表批准执行恢复。

| Gate | 名称 | 状态 | 证据 / 限制 |
|---|---|---|---|
| G-R4C-1 | Production DB Identified | PASS | project匹配、PG17.6、TLS客户端验证、catalog |
| G-R4C-2 | Production State Stable | PASS | ledger449、cutover、Agent0前后相同；未证明业务行冻结 |
| G-R4C-3 | Existing Backup Inventory | PASS | 已知路径10文件，全存在 |
| G-R4C-4 | Backup Format Classified | PASS | 4 full logical，6 schema-only；全部TOC可读 |
| G-R4C-5 | Backup Freshness Known | PASS | 最新09-13 / 50.8308h；不代签RPO |
| G-R4C-6 | Database Size Known | PASS | 58,125,459 bytes |
| G-R4C-7 | Backup Disk Capacity | PASS | 约590.15GiB可用；仅容量估算，未测试写权限 |
| G-R4C-8 | Secure Destination Plan | PASS | 700/600持久目录提案，未创建 |
| G-R4C-9 | Off-host Status Known | PARTIAL | NOT CONFIRMED，无可靠异机副本证据 |
| G-R4C-10 | Supabase Recovery Scope Documented | PASS | DB/Auth/roles/extensions/Storage/secrets边界分明 |
| G-R4C-11 | Backup Command Plan | PARTIAL | PG17/TLS/pgpass/snapshot/receipt合同已写，执行包装器与批准待闭环 |
| G-R4C-12 | Restore Isolation Plan | PASS | 唯一容器/DB/marker、network none、无生产凭证 |
| G-R4C-13 | Restore Verification Plan | PASS | TOC/实际restore/ledger/数据计数/权限完整性目标；未执行 |
| G-R4C-14 | Known-good App Identified | PARTIAL | 当前路径/Build ID已确认，完整binary/dependency封存及rollback访问待核 |
| G-R4C-15 | PM2 Recovery Snapshot | PASS | 安全字段前后一致 |
| G-R4C-16 | Runtime Config Snapshot | PASS | hash/OFF/EMPTY前后一致；非进程内热配置证明 |
| G-R4C-17 | Tailscale Recovery Snapshot | PASS | canonical hash相同，9443不存在 |
| G-R4C-18 | Migration Failure Runbook | PASS | stop、不mark、不盲目restore |
| G-R4C-19 | App Rollback Runbook | PARTIAL | 保留DB的顺序已写，固定launcher实际替换命令/访问待审 |
| G-R4C-20 | Data Corruption Runbook | PASS | 独立incident批准，隔离restore先行 |
| G-R4C-21 | Pilot Failure Runbook | PASS | OFF/drain/reconcile，非默认DBrestore |
| G-R4C-22 | RPO/RTO Decision Status | BLOCKED | 两项TBD，不能代设SLA |
| G-R4C-23 | Backup Operator Status | BLOCKED | NOT ASSIGNED |
| G-R4C-24 | Production Ledger Unchanged | PASS | 前后完整有序version/name摘要相同 |
| G-R4C-25 | Production Writes Zero | PASS | 本任务仅固定只读SQL、未dump/restore/DDL/DML |
| G-R4C-26 | Feature OFF | PASS | runtime文件OFF，三名单EMPTY |
| G-R4C-27 | Live Provider Zero | PASS | 本任务未发起Provider/Agent请求 |

## 12. Safety, Files & Final Assessment

生产安全范围仅指本任务：**Production Writes=0；Production Migration=NOT APPLIED；Production Deploy=0；PM2 restart/reload=0；Tailscale mutation=0；Feature/allowlist writes=0；Agent Runs=0；Live Provider=0。** 没有创建新production backup或任何restore环境。只读客户端容器自动退出；临时受限连接目录自动清理，不写凭证到仓库。

前后数据库metadata、PM2/runtime/launcher/Serve摘要对比见 [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/production-safety.json)；新增文件范围与已有工作区hash保护见 [workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4c/workspace-scope.json)。原dirty业务文件/历史报告/迁移保持，未清理、提交或改动。检查仅覆盖必要helper语法、JSON、diff/secret边界，不启动业务测试或Provider。

只读结果支持“备份创建的工具、现有数据归档经验和磁盘容量具备基础条件”，**不支持当前执行放行**。尚需指定Backup Operator、接受RPO/RTO与窗口、确认受限目的地/权限/保留/off-host策略、锁定完整known-good恢复制品与平台特殊对象方案。Fresh recovery point仍NOT CREATED，Restore Verification仍NOT EXECUTED，Backup / Recovery仍BLOCKED。

后续可另行授权 **Stage 1F-R4D — Fresh Backup Creation & Restore Verification**。本阶段不自动进入R4D，不授权production recovery、migration、deploy或Stage1G。**Stage 1G保持NOT READY。**
