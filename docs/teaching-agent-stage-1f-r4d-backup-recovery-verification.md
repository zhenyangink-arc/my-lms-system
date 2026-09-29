# UPLY Teaching Agent — Stage 1F-R4D Fresh Backup Creation & Restore Verification

## 1 Executive Summary

**Overall: GO，仅限 R4D 数据库备份与隔离恢复技术验证。Backup Technical Readiness: READY；Backup / Recovery Engineering: READY；Stage 1G: NOT READY。**

本轮新建受限备份 `/home/yangzhen/backups/uply/20260915T063124Z/`，完整逻辑归档5,759,599 bytes。Full dump、schema dump、roles、archive list和全部隔离恢复步骤exit0；26项结构、安全与数据计数检查通过。恢复容器及其独立volume已销毁；新备份保留，历史备份未删除。

生产ledger保持449、latest202609130003、Agent tables0；PM2/runtime/Tailscale保持；Feature OFF、名单EMPTY；Production Database DDL/DML=0、Provider请求0。**Authorized Backup/Recovery Artifacts=CREATED，Backup Filesystem Writes>0**，不能将本轮概括为全部Production Changes=0。

数据库逻辑恢复已验证；**不声称整个 Supabase 平台恢复已验证**。RTO≤60分钟获得本次隔离演练的技术支持，不是生产SLA。未来真实生产变更起点仍须重新检查备份age≤15分钟，超时重新生成恢复点或取得接受更大RPO的明确批准。

## 2 Authorization

用户明确授权：创建新的production logical backup；创建独立Docker recovery环境/volume；把新backup恢复到隔离数据库并验证；清理含真实数据的临时恢复环境；保存受限备份与脱敏证据；更新运维角色文档。未授权production restore、DDL/DML、migration、deploy、PM2重启、Tailscale变更、Feature ON、allowlist写入、Auth/Storage修改或Provider请求。

| 角色 | 本轮事实 |
|---|---|
| Backup Creation / Restore Operator | 杨震 |
| Release / Incident Operator | 杨震 |
| Backup / Standby Person | TBD — NOT ASSIGNED |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |

[operations roles](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-pilot-operations-roles.md) 只补充执行人和备班区分，不自动赋予政策批准权。因备份目录位于工作区写权限外，执行和最终封存通过工具的文件系统授权运行；它们不扩大生产数据库操作范围。

输入沿用完整审阅的 [R4C](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4c-backup-recovery-preflight.md)、[R4B](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4b-tailscale-transport-verification.md)、[R4A](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4a-release-metadata-closure.md)、[R4](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r4-production-authorization-gate.md)，以及09-10/09-13实际backup/restore记录。重新阅读09-13 `restore-verification-operations.mjs`、三份inventory SQL、权限补充与09-10/09-13 verification/seal helper，复用其成功顺序，没有重新尝试已知失败的raw单步恢复。

执行实现：[execute.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4d/execute.py)。私有日志/保留策略封存：[finalize.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4d/finalize.py)。这些不是生产恢复或migration入口；错误即停止、进入owned cleanup。本轮没有恢复错误重试、忽略错误或修改生产来过关。

## 3 Production Preflight

先进行了独立只读检查；执行脚本在创建batch前再次检查，正式执行前采样为`2026-09-15T06:31:24.117151Z`。[preflight.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/preflight.json) 的全部检查通过。

| 项目 | 结果 |
|---|---|
| PostgreSQL / DB | 17.6 / postgres；58,125,459 bytes |
| Source project identity SHA256 | `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673`，匹配production runtime及R4C |
| Source host identity SHA256 | `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5`，不输出URI |
| Ledger | 449；latest202609130003 / runtime_authoring_nonretryable_error |
| 有序version/name ledger SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| Agent表 | public五表0，全部public agent_*表0；202609140000–007均未应用 |
| Feature / allowlists | OFF / 三名单EMPTY |
| PM2 | uply-first-enable，PID1176676，restart_count0，online，fork_mode，instances1，kill_timeout15000ms |
| Runtime SHA256 | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8` |
| Launcher SHA256 | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039` |
| Serve canonical SHA256 | `b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256` |
| Serve bindings | 443→127.0.0.1:3001；4000→127.0.0.1:4000；8443→127.0.0.1:3000；9443 absent |
| Known-good | `/home/yangzhen/releases/uply-first-enable-20260910/source`；Build ID `LuAZe2VMY32YjOo1WvtrC` |
| R3D candidate | `/tmp/uply-r3d-release-candidate/candidate-build.tar.gz`；SHA `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |

工具固定为本地`public.ecr.aws/supabase/postgres:17.6.1.159`、image ID `sha256:86a2e078779e5bdccda1f6f6c5063aa9779a322d1fface5fb408d051909b230f`，全部`--pull=never`，未下载镜像。连接使用已验证CA、service和临时600 passfile，`sslmode=verify-full`；客户端TLSv1.3。Pooler的后端`pg_stat_ssl=false`不替代客户端TLS观测，不声称平台内部每一跳均已验证。

只读审计事务明确READ ONLY；数据导出使用pg_dump自身一致性导出事务和指定snapshot。没有把生产.env复制到容器；backup client只挂临时连接资料，dump stdout由宿主受限文件接收，避免容器umask导致权限放宽。

## 4 Recovery Point Policy

| 已批准政策 | 执行边界 |
|---|---|
| RPO | ≤15分钟，适用于实际获批production change window起点 |
| RTO | ≤60分钟，initial operational target，不是已证明SLA |
| Retention | 至少7天，且Stage1G Pilot稳定结束前不得删除；取两条件中较晚者 |
| 本轮off-host | NOT REQUIRED FOR R4D EXECUTION；不上传 |
| Broader rollout | OFF-HOST COPY REQUIRED |

备份今日验证通过不提供未来数小时/数日后的RPO保证；R4D PASS不等于生产变更批准。[recovery-policy.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/recovery-policy.json)。

## 5 Backup Directory

**Backup Path：`/home/yangzhen/backups/uply/20260915T063124Z/`。** UTC时间戳实时生成；不位于Git/workspace、docs、public或/tmp。parent `uply`、batch、private、metadata目录均700；文件600；owner/group为yangzhen；umask077。创建后和最终seal均核验，不通过即停止。

```text
<batch>/
  database.dump
  schema.dump
  roles.sql
  private/
    dump.stdout.log / dump.stderr.log
    schema.stdout.log / schema.stderr.log
    roles.stdout.log / roles.stderr.log
    restore.stdout.log / restore.stderr.log
    各阶段私有日志、source catalog及TOC
  metadata/
    batch.json
    source-snapshot.json
    migration-ledger.json
    catalog-summary.json
    release-summary.json
    runtime-summary.json / launcher-summary.json
    pm2-summary.json / tailscale-summary.json
    backup-result.json / restore-result.json
    source-end-state.json / cleanup.json / timing.json
    recovery-policy.json / command-receipts.json
    manifest.json / SHA256SUMS
```

dump/schema/roles stdout直接写相应artifact；对应stdout.log仅记录重定向去向，stderr保留真实工具输出。恢复总日志和各阶段日志均在private内。没有将dump、roles、TOC或private日志复制到repo。[backup-directory.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/backup-directory.json)、[private-batch-verification.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/private-batch-verification.json)。

## 6 Snapshot Consistency

独立session执行`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`及`pg_export_snapshot()`，在以下四类采集成功前保持打开：full dump、schema dump、ordered ledger、catalog/计数。Snapshot identifier仅存受限batch metadata及必要私有操作资料，不进入repo evidence。

| 时点 | UTC |
|---|---|
| Snapshot export成功后记录 | 2026-09-15T06:31:24.914920Z |
| 全部snapshot-dependent采集结束，ROLLBACK成功 | 2026-09-15T06:31:47.870964Z |
| Exporter exit | 0 |

每次采集前检查exporter存活；结束时同session返回存活标记，再ROLLBACK关闭。独立SQL读取导入同snapshot、设置search_path=pg_catalog，并使用READ ONLY、statement/lock timeout。没有结束session后继续复用失效snapshot。`exporterAlive=true`是采集期间记录，不表示它现在仍运行。[snapshot-summary.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/snapshot-summary.json)。

Snapshot一致性仅覆盖支持该MVCC视图的DB对象/行；sequence运行值和cluster roles不提供数据库行快照的原子性保证。恢复后的sequence与采集值本次相等，未据此声称暂停全站写入。源/恢复差异会停止验收。

## 7 Full Logical Backup

使用PG17.6 `pg_dump --format=custom --compress=gzip --snapshot=<private-id> --lock-wait-timeout=15000 --no-password`，保留owner/ACL，无schema/table/data过滤，无`--no-owner`或`--no-acl`。

| 项目 | 结果 |
|---|---|
| Start | 2026-09-15T06:31:24.915121Z |
| Exit / monotonic duration | 0 / 12.081秒 |
| Full archive bytes | 5,759,599 |
| SHA256 | `41dfcc96b933b0893df3457d9c9c0c16ba82fdd58cb7d848b4ca7f7719a2aaa4` |
| Format / compression | CUSTOM / gzip |
| Owner / mode | yangzhen / 0600 |

备份期间没有停写生产、修改维护开关或请求课堂操作。一致性依靠导出snapshot，不假设其他用户没有并行业务活动。

## 8 Schema / Roles / Ledger

| Artifact | Bytes | Duration / exit | SHA256 |
|---|---:|---|---|
| schema.dump | 2,801,375 | 6.672秒 / 0 | `e681713b49443919b817127974a3c84ef1132cc9060197e472be9c2011eb54d3` |
| roles.sql | 5,643 | 0.565秒 / 0 | `196db813499e8402eb660ebf274186a151fe6985df4248241876e1e3fd8d3a87` |
| migration-ledger.json | ordered version/name | 0.615秒查询 / 0 | canonical ledger摘要 `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |

Schema使用同snapshot，schema-only/custom/gzip。Ledger449、latest202609130003，完整有序version/name摘要与preflight相同；摘要按紧凑、递归键排序JSON计算，不等于带缩进JSON文件自身SHA。

Roles单独使用`pg_dumpall --roles-only --no-role-passwords`，capturedAt `2026-09-15T06:31:47.871281Z`。**不宣称roles与DB snapshot原子一致**。源catalog31个roles包含pg_*；恢复对比沿历史方法覆盖16个非pg_*角色、22项membership，避免把不同统计口径误判缺失。角色密码不备份；roles.sql受限保存。

三份历史catalog SQL按同snapshot采集；另补逻辑列顺序、类型、NULL/default/identity/generated/collation/列ACL核验，不按dropped-column物理attnum判断等价。只计数业务行，不读取或打印学生姓名、email、messages、grades正文。

## 9 Archive Validation

在接触recovery container前，两个archive均通过独立`network=none`、文件只读挂载的`pg_restore --list`，exit0。完整TOC只保留在private日志。

| 项目 | database.dump | schema.dump |
|---|---:|---:|
| TOC entries | 4329 | 4077 |
| TABLE DATA entries | 229 | 0 |
| Archive version | 1.16-0 | 1.16-0 |
| Format / compression | CUSTOM / gzip | CUSTOM / gzip |
| Source PG / pg_dump | 17.6 / 17.6 | 17.6 / 17.6 |

TABLE DATA entries不等于表计数或业务行数；230张table集合另由source/restore catalog核验。list成功本身不等于完整恢复，后续实际COPY/DDL及完整性比较提供独立证据。[archive-validation.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/archive-validation.json)。

## 10 Backup Seal

**Backup Seal: VALID。** backup命令exit0、两份archive list exit0、备份后源状态仍匹配preflight后才首次seal。最终补齐恢复日志及保留策略后再次seal，未改变三个核心artifact。

manifest列出79个文件的path/SHA256/size/mode/owner/mtime；包含source identity hash、PG版本、snapshot timing、ledger count/latest/hash与R4D report version。SHA256SUMS覆盖这些文件及manifest本身，排除自引用。最终manifest SHA为`b947bf1ac84634ce45ad5c6dd668bbc6b6651c714914ce433e5cec01bf2f2150`；core hashes再次核验一致。

Seal证明该batch文件完整，不代表超时后仍满足未来go-live freshness，也不等于平台全量灾备。[backup-summary.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/backup-summary.json)。

## 11 Restore Isolation

| 隔离项 | 实测 |
|---|---|
| Container | uply-r4d-recovery-20260915t063124z |
| Docker volume | uply-r4d-recovery-20260915t063124z-data |
| Labels | purpose=isolated-recovery；stage=stage1f-r4d |
| Image | 已核对同一PG17.6.1.159 image ID；pull=never |
| Network / host ports | none / 未发布任何宿主端口 |
| DB | uply_r4d_recovery |
| Marker | UPLY_R4D_ISOLATED_RECOVERY（database comment） |
| Connection | container-local Unix socket /tmp；内部port55483；listen_addresses为空 |
| Mounts | 仅本次独立volume→/recovery；无bind mount |
| Production credentials | 未注入；无生产runtime/.env/passfile/CA/service mount |

归档经stdin传入固定container内的pg_restore；没有网络target，也没有把整个备份目录（其中有私有资料）挂到恢复容器。每次restore前检查container ID/name/labels/image/network/ports/mounts，连接marked专用DB；roles/bootstrap步骤只在同owned容器的本地bootstrap postgres数据库执行。没有生产hostname/URI/password参数。[restore-isolation.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/restore-isolation.json)。

## 12 Restore Procedure

沿09-13成功流程完成，一次通过；没有以忽略权限错误或删policy替代恢复：

1. 唯一Docker volume及network-none容器，使用本地PG17.6 `initdb -U supabase_admin`。默认bootstrap grantor与源库匹配；仅省略roles.sql中已由initdb创建的`CREATE ROLE supabase_admin`，保留其ALTER/成员关系/GRANTED BY。
2. 仅隔离环境临时将postgres设SUPERUSER，以恢复managed event trigger owner。建立专用UTF8/ICU DB，locale/provider、owner依源catalog，不使用生产DB target；写入marker。
3. 按当前archive TOC先恢复SCHEMA条目；按source extension schema/version/owner创建非plpgsql扩展；再恢复其余完整archive。两个pg_restore都使用`--exit-on-error --single-transaction`，exit0。
4. postgres立即恢复NOSUPERUSER，随后补充DB settings和源catalog ACL；完整角色属性最终对比PASS。
5. 复用历史explicit-owner ACL补充语义，推广到本轮source中所有非NULL table/schema ACL及DB ACL，按原grantor/grantee/权限/GRANT OPTION重新表达，不创造源库没有的权限，不DROP或修改RLS。最终所有ACL和default ACL摘要一致。
6. 统一search_path=pg_catalog，读取恢复catalog、每表count、列及ledger，完成26项对比。角色/locale/extension处理均限制在隔离环境，不对生产授予SUPERUSER或写入任何SQL对象。

每一阶段receipt记录exit、monotonic duration和私有日志位置。所有步骤exit0，没有`|| true`、error过滤、自动retry或Teaching Agent migration安装。

## 13 Restore Integrity Verification

**Restore Verification: PASS；DATABASE LOGICAL RESTORE VERIFIED。** [restore-verification.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/restore-verification.json) 保存26个布尔检查及source/restored摘要，不保存真实业务行。

| 核验范围 | 数量 / 结果 |
|---|---|
| Schema/owner/ACL | 13，PASS |
| Table集合、owner、RLS/forceRLS、ACL、每表count | 230，PASS |
| Columns（逻辑顺序/类型/default/NULL/identity/generated/collation/ACL） | 2722，PASS |
| Functions | 679，定义hash/identity/owner/ACL一致 |
| Constraints（PK/FK/unique等） | 1698，定义/validated状态一致 |
| Indexes | 729，定义一致 |
| RLS policies | 287，全部字段一致 |
| Default ACL | 24，PASS |
| 非pg_* roles / memberships | 16 / 22，PASS |
| Extensions | 6，name/version/schema/owner一致 |
| Triggers / event triggers | 285 / 7，PASS |
| Sequences | 23，属性和采集值一致 |
| Views / publications / publication members | 11 / 2 / 7，PASS |
| Large objects / foreign tables / subscriptions | 0 / 0 / 0，一致 |
| DB locale/owner/ACL/settings | PASS，隔离DB名按约定替换比较 |
| Restored ledger | 449、latest202609130003、完整ordered SHA与snapshot一致 |
| Agent tables | 0，未安装202609140000–007 |
| Temporary postgres SUPERUSER cleanup | NOSUPERUSER，PASS |

对比只规范化集合顺序、ACL项顺序及隔离数据库名称。Publication内部OID不跨库比较，改用历史additional catalog的owner/语义字段对比；没有豁免任何函数、policy或权限差异。

Data Integrity PASS的定义：完整data section实际COPY还原完成、全部230表count与snapshot采集值一致；对Auth/学生/messages/progress/grades只使用count/metadata。**没有逐业务行内容hash验证，也不把count相同声称为逐字节内容验收。** 原始artifact另有SHA校验。

## 14 Supabase Recovery Boundary

本次证明数据库逻辑schema/data/owner/ACL/角色成员关系及已列对象可以在该隔离环境恢复。以下均**NOT CLAIMED / 未验证完整恢复**：Storage object bytes、OAuth provider config、SMTP、JWT signing config、external secrets、Provider secrets、外部桶/CDN、托管平台控制面配置、PITR entitlement。

roles.sql不含数据库角色密码；vault数据段存在不等于外部加密根密钥或解密能力已经验证。没有启动完整Auth/Storage业务服务、登录真实学生、播放媒体或请求Provider。不能写ENTIRE SUPABASE PLATFORM RESTORE VERIFIED。

## 15 Timing / RTO Assessment

时间来自monotonic clock，原始receipt在受限batch，安全汇总见 [timing.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/timing.json)。

| 阶段 | 实测耗时 |
|---|---:|
| Full pg_dump | 12.081秒 |
| Schema pg_dump | 6.672秒 |
| Roles pg_dumpall | 0.565秒 |
| Backup phase（含snapshot/catalog/ledger/roles） | 23.732秒 |
| Isolated environment setup | 1.032秒 |
| Restore（roles/DB/schema/extensions/data/ACL/settings） | 2.894秒 |
| Verification | 1.030秒 |
| Total automated recovery exercise | 32.244秒 |

演练执行窗口`2026-09-15T06:31:23.632327Z`—`06:31:55.876633Z`。总时长另包含preflight、archive list、seal、cleanup和生产end-state；文档准备/审批交互及后续报告封存不计入该自动化演练耗时。最终私有凭据补齐于06:33:18Z，未再次restore。

**RTO Target ≤60m：SUPPORTED BY ISOLATED EXERCISE。** 不声称Production RTO SLA Proven：真实incident还需要决策、停写、授权、流量处理、应用恢复和平台配置，均未通过本轮32秒演练证明。

## 16 Cleanup

本轮owned container于06:31:54Z删除，随后独立volume删除，两个命令均exit0；按container ID/volume name再次确认不存在。临时recovery DB随volume销毁，宿主端口从未发布；没有残留装载真实备份数据的恢复环境。

新backup batch及四份历史full backup保留；未创建自动删除任务、cron、systemd timer或rotation。临时连接资料自动删除，没有将passfile保存在备份或repo。[cleanup.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/cleanup.json)。

## 17 Production End-State

备份结束后先复查source state；恢复和cleanup后再次复查。全部production identity/ledger/Agent/runtime/PM2/Serve关键值与preflight一致。[source-end-state.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/source-end-state.json)、[production-end-state.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/production-end-state.json)。

**SOURCE STATE STABLE ACROSS BACKUP WINDOW**仅指已核的catalog/ledger与运维状态，不代表全站业务写入冻结。runtime文件OFF/EMPTY与hash被核验，未读取或声称核验不可见的完整进程env。Backup/restore脚本不导入Agent/Provider。

| 操作 / 状态 | 本轮 |
|---|---|
| Production ledger / latest / Agent tables | 449 / 202609130003 / 0，UNCHANGED |
| Production Migration | NOT APPLIED |
| Production DB DDL / DML | 0 / 0 |
| Production restore / deploy | 0 / 0 |
| PM2 / runtime / Tailscale | UNCHANGED；restart/reload/mutation均0 |
| Feature / allowlists | OFF / EMPTY；写入0 |
| Production Agent Runs / Live Provider Requests | 0 / 0（本任务范围） |
| Authorized Backup Filesystem Writes | >0，CREATED |
| Isolated DB writes / recovery resources | 本轮授权恢复产生，已清理 |

## 18 RPO Freshness Rule

**Fresh R4D Recovery Point: CREATED；Go-live RPO Validity: TIME-BOUND — RECHECK REQUIRED。**

Snapshot起点`2026-09-15T06:31:24.914920Z`；自动化演练完成时age30.962秒。15分钟界限为`2026-09-15T06:46:24.914920Z`，仅用于解释时效，绝不构成该时刻之前可自行上线的授权。报告最终交付时age另存 [completion-summary.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/completion-summary.json)，不把演练完成时的31秒当作交付时或未来的年龄。

未来实际production migration/deploy前必须重新计算`change-window start - verified snapshot time`；>15分钟时重新创建新的pre-change recovery point，或取得负责人明确接受更大RPO的批准。继续核snapshot身份/ledger/精确制品；R4D今日PASS不永久满足Go-live RPO。

## 19 Retention / Off-host

本batch最早7天期限为`2026-09-22T06:31:24.914920Z`；即使到期，Stage1G Pilot尚未稳定结束仍不得删除。没有自动删除策略，不因seal已成功或Stage1G延期而自行清理。

**Off-host: NOT CONFIRMED。** 按用户批准，不阻断本次R4D执行与技术restore结果；**broader production rollout前必须具备off-host copy**。本轮未上传Google Drive、OneDrive、Dropbox、NAS或另一台服务器。本地700/600权限不等于跨主机灾备或加密离线备份。

## 20 Gate Matrix

各Gate逐项依赖真实证据，不按多数票放行；PASS范围限R4D。

| Gate | 名称 | 状态 | 证据 / 限制 |
|---|---|---|---|
| G-R4D-1 | Authorization Scope Confirmed | PASS | 用户明确授权，生产恢复仍禁止 |
| G-R4D-2 | Production State Preflight | PASS | preflight全部检查一致 |
| G-R4D-3 | Secure Backup Directory | PASS | 700/600、owner/group、路径核验 |
| G-R4D-4 | Exported Snapshot Valid | PASS | exporter保持存活，最后ROLLBACK exit0 |
| G-R4D-5 | Full Dump Exit Zero | PASS | exit0 / 5,759,599 bytes |
| G-R4D-6 | Schema Dump Exit Zero | PASS | exit0 / 2,801,375 bytes |
| G-R4D-7 | Roles Snapshot Exit Zero | PASS | exit0 / no-role-passwords；非原子MVCC |
| G-R4D-8 | Ledger Snapshot Consistent | PASS | 449及完整SHA匹配 |
| G-R4D-9 | Archive TOC Readable | PASS | 两份list exit0 |
| G-R4D-10 | Backup Seal Valid | PASS | 79文件及manifest/SHA256SUMS复核 |
| G-R4D-11 | Source State Stable | PASS | 备份后及cleanup后复查一致 |
| G-R4D-12 | Fresh Recovery Point Created | PASS | 本次新snapshot/batch；非永久时效 |
| G-R4D-13 | Restore Target Isolated | PASS | marker、ID、labels、network none、无host port |
| G-R4D-14 | No Production Credentials In Restore | PASS | 无bind mount、无生产env/credential |
| G-R4D-15 | Restore Exit Zero | PASS | 每阶段exit0，无错误忽略 |
| G-R4D-16 | Migration Ledger Restored | PASS | 完整ordered SHA一致 |
| G-R4D-17 | Schema Integrity | PASS | schema/table/columns/views/sequence等一致 |
| G-R4D-18 | RLS / Policy Integrity | PASS | 表RLS flags、287 policies一致 |
| G-R4D-19 | Functions / Constraints / Indexes | PASS | 679 / 1698 / 729一致 |
| G-R4D-20 | Roles / ACL / Extensions | PASS | 角色、成员、owner/ACL、extension匹配 |
| G-R4D-21 | Data Integrity Safe Counts | PASS | 230表count一致；非全行hash验收 |
| G-R4D-22 | Supabase Boundary Documented | PASS | 仅DATABASE LOGICAL RESTORE VERIFIED |
| G-R4D-23 | Restore Timing Recorded | PASS | monotonic receipts与timing汇总 |
| G-R4D-24 | RTO Target Assessment | PASS | 隔离演练32.244秒；非生产SLA |
| G-R4D-25 | Recovery Environment Destroyed | PASS | container/volume不存在 |
| G-R4D-26 | Backup Retained | PASS | 新batch保留、历史备份未删 |
| G-R4D-27 | PM2 Unchanged | PASS | PID/restart/count/状态一致 |
| G-R4D-28 | Runtime Unchanged | PASS | 同hash、OFF/EMPTY |
| G-R4D-29 | Tailscale Unchanged | PASS | canonical hash一致、9443 absent |
| G-R4D-30 | Feature OFF / Allowlists EMPTY | PASS | 真实配置摘要，无写入 |
| G-R4D-31 | Production Ledger Unchanged | PASS | 前后449/完整SHA一致 |
| G-R4D-32 | Production DB Writes Zero | PASS | 本任务无生产DDL/DML |
| G-R4D-33 | Live Provider Zero | PASS | 本任务无Agent/Provider请求 |
| G-R4D-34 | Sensitive Evidence Boundary | PASS | repo只含安全metadata，凭证/业务行扫描通过 |
| G-R4D-35 | Go-live RPO Time-bound Rule Recorded | PASS | 15分钟重新核验，超时新backup或明确RPO例外批准 |

最终文件范围、既有dirty文件保护、JSON/脚本语法/Markdown及敏感信息检查见 [workspace-scope.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r4d/workspace-scope.json)。只新增R4D脚本/报告/evidence，并对roles文档作授权范围内最小更新；不改R4C等历史报告、产品源码、迁移、baseline、配置或.env，不commit。

## 21 Remaining Stage1G Blockers

- Provider Policy：Data / Policy Approver仍TBD，合同/数据处理/告知等批准未取得。
- Production content、approved internal/test identity、真实server Pins及单课范围/冻结仍需独立闭环；本轮未创建内容或跑StudentPolicy。
- Backup / Standby Person仍TBD；本次执行人杨震不等于独立备班。
- Monitoring/reconciler值守、tenant范围、receipt保留/复核及执行安排接受记录仍需落实。
- Production migration/deploy/definition/allowlist/First Enable授权仍独立，R4D不提供这些授权。
- 实际go-live的≤15分钟恢复点新鲜度必须重查；broader rollout前off-host仍待完成。
- R4B actual Compression / Buffering仍PARTIAL等其他独立Gate不能由本次数据库恢复PASS替代。

## 22 Final Recommendation

接受 **R4D GO：Backup Technical Readiness READY；Restore Verification PASS；Backup / Recovery Engineering READY**，结论限定为本次新备份的数据库逻辑恢复、完整性比较、受限保留和隔离资源清理。

**Stage 1G仍NOT READY。** 不自动进入R5、Stage1G，不执行production migration、deploy、First Enable或Provider请求。未来生产窗口先重新计算backup age，并满足全部独立授权与Gate。
