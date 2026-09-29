# UPLY Teaching Agent — Production Foundation Install Authorization Package

**AUTHORIZED FOR THIS WINDOW ONLY — WINDOW EXPIRED / EXECUTION INCOMPLETE。** 用户杨震在 Stage 1F-R5C 明确授权本窗口 A–E；下列 R5B 技术锁保持。 R5B工程闭环 **READY**；R5C用户已明确批准并执行本窗口迁移/部署，但最终闭环因超窗为HOLD。[R5B report](teaching-agent-stage-1f-r5b-foundation-engineering-closure.md)取代R5A剩余工程项的当前状态；R5A历史报告保留不回写。

## 1. Current strategy and readiness

| Field | Current value |
|---|---|
| Development Strategy | FORWARD-ONLY |
| Old App Compatibility | NOT REQUIRED BY USER |
| Application Strategy | FORWARD-ONLY READY；FORWARD FIX FIRST |
| Single-Operator Development Exception | ACCEPTED BY 杨震 |
| Independent Standby | DEFERRED UNTIL REAL PILOT / EXTERNAL USER ROLLOUT |
| Production Foundation Technical Package | R5B READY；R5C已安装，执行闭环 HOLD（窗口过期） |
| Runner / Migration Execution Mechanism | READY |
| Migration Rehearsal | PASS；449→457，8 CONFIRMED + post verification PASS |
| Atomic DDL + Ledger / Commit contract | PASS / PASS |
| Persistent Artifact | READY / PERSISTENT |
| New R3D Candidate Post-007 / Deployment Shape | PASS / READY |
| Maintenance Credential Capability / Expiry | SUFFICIENT / VALID at read-only observation；窗口前重核 |
| Maintenance Client | READY；Docker PG17.6，无host native psql |
| Provider Policy | DEFERRED UNTIL LIVE AI / REAL USER TESTING；未获政策批准 |
| Production content / Pins | DEFERRED UNTIL FOUNDATION INSTALLED |
| Production Authorization | AUTHORIZED FOR THIS WINDOW ONLY；2026-09-16T03:58:09.328821+00:00 已到期，无新变更授权 |
| Stage1G | NOT READY / NOT AUTHORIZED |

用户明确确认开发阶段无真实外部用户、无正式学生Pilot，不要求旧app post-migration兼容、zero-downtime或blue-green，接受杨震单人维护风险。仅本开发Foundation范围；不放宽DB backup/restore/migration integrity，不批准真实AI请求或外部学生开放。

## 2. Immutable target and release inputs

| Field | Locked value |
|---|---|
| Proposed release identifier | uply-teaching-agent-development-foundation-r3d-r4f-r5b；未创建production release |
| Target Production Identity SHA | `cad8258f794d075042a59e5df2217f60173e29fbe15a2bf4b3324360d79df673` |
| Host Identity SHA | `33fa58605f9a47d2e80d4304fbd939405198c3be83a78743d878dd1d665041b5` |
| Initial Ledger / Latest | 449 / 202609130003 |
| Observed installed Ledger / Latest | 457 / 202609140007 |
| Full ordered version/name ledger SHA | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| Migration Range / Count | 202609140000–202609140007 / 8，严格顺序 |
| Migration Package | LOCKED |
| Persistent Candidate Path | `/home/yangzhen/artifacts/uply-teaching-agent-foundation-r3d/candidate-build.tar.gz` |
| Candidate SHA256 | `1e32c6f6b402e7eb486e81dcbbad26ff18ce9a80a177a2463173276253573d28` |
| Candidate Build ID | 6IhDHN8Dm1nCewiCEZnV5 |
| Next version | 16.2.10 |
| Frozen Source Digest | `48b8e7b979b0a158635c82e31e9e0f948742e0e5a0f2ca5e5bab553ec458708c` |
| Runner SHA256 | `755c8d823bfe10d82514382a090cff162003f4c8661767ef1d8ba7990446f8b9` |
| Maintenance Transport SHA256 | `ab77d1981dfe27c127c78320a1159059f8d6a3f81d0fa95d916ef5877d2be83f` |
| Fixed Package SHA256 | `f7b625da326413959c356228448f87044423e72959230b37b2b076066723c632` |
| Runtime SHA256 | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8` |
| Launcher SHA256 | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039` |
| Expected final ledger / latest | 457 / 202609140007，仅起点449、原prefix不变且无并发migration时成立 |
| Historical old app | /home/yangzhen/releases/uply-first-enable-20260910/source；Build LuAZe2VMY32YjOo1WvtrC；保留，不作为post007回退兼容Gate |

| Version | Filename（supabase/migrations/） | Current=locked SHA256 | Status |
|---|---|---|---|
| 202609140000 | `202609140000_agent_core_foundation.sql` | `7abc5545f6cb926c37a74a890fc6fcdbad4f89a5c35474a4628af67b7e0afa8b` | MATCH |
| 202609140001 | `202609140001_agent_runtime_completion_evidence.sql` | `a0ece84b6030f029ff68781e3dcffa73e5d7ea2448c33c750ff76c1098f3456b` | MATCH |
| 202609140002 | `202609140002_agent_run_cancel_request.sql` | `a8c0d60432a39f08dd45cea08b7ea0e6565885a8d0a65d15118c1f093dc9fb62` | MATCH |
| 202609140003 | `202609140003_teaching_operations_reissue.sql` | `cb2a1e90011f154185f4b5695e3a14d00dce9a60e37063c1b38d2ca854fac794` | MATCH |
| 202609140004 | `202609140004_completion_policy_management_reissue.sql` | `20358b17f0deed997263660f15bb0e4c2551caffa6b950d09fc9d4c5d609573e` | MATCH |
| 202609140005 | `202609140005_student_teaching_content_isolation.sql` | `ec4454eea39f38bb9f8a7313b203cea444b831bc90cc1e7d30b070400d4c7674` | MATCH |
| 202609140006 | `202609140006_agent_run_reconciliation.sql` | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` | MATCH |
| 202609140007 | `202609140007_teaching_content_skeleton.sql` | `9d5c34d4e9ef0ff2e9de72db9d3ab1e5ac02bd248f222ddd312042a8c94339a4` | MATCH |

切勿安装baseline或重放449历史migration。任何hash/identity/ledger drift：STOP/REPLAN；无skip/force/repair/retry。R4F operator bundle沿R5A锁保留，CLI `12842a373fd85fdc19cebafef40505387c970711376718c5f164b1ef71d21437`、SQL `b774e2cf72e12dba59d9ba06a4d14cec684b9555c47787dfdff33da1554bf36d`、006见上表；本授权范围不执行reconciler。原/tmp artifact和R4D备份仍保留。

## 3. Operator, window and recovery conditions

| Field | Current value |
|---|---|
| Execution / Release / Primary Operator | 杨震 |
| Backup Creation / Restore Operator | 杨震；production restore仍须独立事件授权 |
| Development single-operator exception | ACCEPTED BY 杨震；本开发Foundation维护 |
| Independent standby | DEFERRED UNTIL REAL PILOT / EXTERNAL USER ROLLOUT |
| Maintenance window date / start / timezone | 2026-09-16T02:58:09.328821+00:00 UTC；2026-09-16T11:58:09.328821+09:00 Asia/Seoul |
| Maximum duration / forward-fix incident decision point | 60 minutes；deadline 2026-09-16T03:58:09.328821+00:00；不得延长 |
| Fresh Backup | CREATED / VERIFIED / RETAINED — R5C窗口内 |
| Current R4D backup | TECHNICALLY VERIFIED / STALE FOR <=15m RPO |
| RPO at first migration | <=15m；更大例外需明确签署 |
| Fresh backup creation authorization | GRANTED AND EXECUTED FOR THIS WINDOW |
| Maintenance credential | 当前只读audit SUFFICIENT/VALID；实际窗口重核holder/target/expiry/TLS/privileges |
| Receipt storage | 既有私有operations root；0700目录/0600文件、原UNKNOWN不可改写，安全摘要入repo |
| Receipt final retention / reviewer | 沿既有未决定状态；不自动删除 |

迁移000前必须新fresh recovery point并archive validation，按批准的验证策略引用R4D恢复能力或执行快速隔离restore verification。本R5B未生成fresh backup，不得将旧point技术验证当成当前freshness。

## 4. Atomic explicit authorization record（R5C 用户明确授权）

下列 A–E 已由杨震在本次 R5C 请求中明确批准，仅限上述 60 分钟窗口与精确 release definition；执行仍以 preflight、freshness、逐份 CONFIRMED 和验证为条件。

| Item | Requested future scope | Authorization |
|---|---|---|
| A | Production migrations000→007，逐份DDL+完整SQL ledger同事务、逐份readonly verification | GRANTED FOR THIS WINDOW |
| B | 部署上述persistent frozenR3D精确SHA/Build；依赖与启动形态按R5B验证；不临时rebuild冒充原包 | GRANTED FOR THIS WINDOW |
| C | 仅uply-first-enable必要的开发维护stop/start/restart及明确停机时间；固定source替换，无zero-downtime承诺 | GRANTED FOR THIS WINDOW |
| D | 此窗口fresh production recovery point及archive validation/批准的隔离验证；不含production restore、删除旧backup | GRANTED FOR THIS WINDOW |
| E | Catalog/schema/RLS/ACL/functions、application health、非Agent基础路径及authoring UI验证，OFF/EMPTY/零Provider | GRANTED FOR THIS WINDOW |

未来机器读取的私有授权记录须引用用户明确授权原件，并绑定runner/maintenance transport/package/target/runtime SHA、8版本、window、freshBackupPath/manifest SHA和安全范围；格式见[runner README](../scripts/teaching-agent-r5b/README.md)。本次机器授权记录依据当前用户明确授权，另存私有 operations root；不公开凭据或聊天全文。

## 5. Mandatory safety boundaries and failure rules

Feature在迁移前、部署期间、重启后和验证期始终OFF；三份TENANTS/COURSES/USERS allowlists始终EMPTY。重启后首先核这四项，再做其他验证。Foundation Provider requests0、Agent Runs0、production content/Pins writes0；不发布definition、不做Live AI smoke、不触发production reconciler/cancel。

生产tenant/user/course/lesson名单仍TBD，属于后续content/Pins/First Enable。不修改Auth用户/enrollment/unlock、Provider policy、Tailscale443/4000/8443、9443 binding、Funnel/ACL、其他PM2 app或runtime配置。

Migration N失败或commit UNKNOWN：STOP；不运行N+1、不盲retry、不repair；新READ ONLY connection核ledger/objects，由operator判断。CONFIRMED之外不能签成功，后续状态不倒签原UNKNOWN。

**新app失败采用FORWARD FIX FIRST**：保持OFF/EMPTY，修复新app并另行明确批准新build/candidate；旧app post007兼容不要求。已提交Agent migrations默认保留；不得DROP Agent表/down migration。只有confirmed DB corruption才考虑R4D恢复流程，具体恢复点与production restore需独立授权。

## 6. Signature / execution status

| Field | Current value |
|---|---|
| Migration Authorization | GRANTED AND EXECUTED FOR THIS WINDOW；000–007 CONFIRMED |
| Deploy Authorization | GRANTED AND EXECUTED FOR THIS WINDOW；精确R3D |
| PM2 maintenance authorization | GRANTED AND EXECUTED FOR uply-first-enable ONLY；stop/start |
| Fresh backup authorization | GRANTED AND EXECUTED；fresh recovery point/restore PASS |
| Foundation verification authorization | EXECUTED READ ONLY；最终观察超窗；AUTH UI未执行 |
| Signature / Explicit User Authorization | 用户杨震于本任务明确授权；安全摘要存私有目录 |
| Authorization date / reference | 2026-09-16；Stage 1F-R5C Explicit User Authorization |
| Actual Production Execution | PARTIAL / STOPPED — WINDOW EXPIRED / EXECUTION INCOMPLETE；迁移与部署已执行，最终只读复核超窗 |
| This R5B Production DB Writes / Deploy | 0 / 0 |
| Production migrations | 000–007 APPLIED；457/latest202609140007 |
| PM2 / Runtime / Tailscale | named app获批stop/start后online；Runtime/Tailscale UNCHANGED |
| Feature / Allowlists / Provider | OFF / EMPTY / 0 |

Foundation当前已安装的边界为：000–007 APPLIED、R3D开发基线部署、OFF/EMPTY/Agent0/Provider0；不要求创建production content/Pins，Stage1G仍NOT READY。本窗口外无继续执行授权；Foundation 完成后停止，Stage1G 未授权。

本次授权安全边界：Feature OFF；Allowlists EMPTY；Provider 0；Agent 0；Production Content 0；Stage1G NOT AUTHORIZED。Provider Policy 与 First Enable 均未批准。

## 7. R5C actual execution and expiry

[执行报告](teaching-agent-stage-1f-r5c-development-foundation-install.md)：Overall CONDITIONAL，Foundation INSTALLED / Technical HOLD。窗口2026-09-16T02:58:09.328821+00:00 → 2026-09-16T03:58:09.328821+00:00，60分钟，未延长。Final read-only observation 2026-09-16T04:37:59.556448+00:00。最后production write为窗口内named app start；截止后production mutation0。

Fresh backup `/home/yangzhen/backups/uply/20260916T030822Z`，snapshot `2026-09-16T03:08:22.747139+00:00`，000开始age181.183s。Migration8/8CONFIRMED、ledger457、旧449完整SQL prefix不变、对象/RLS/ACL PASS；R3D精确Build已部署；Feature OFF、Allowlists EMPTY、Agent0、Provider0、Production Content0。

Actual Production Execution: **PARTIAL / STOPPED — WINDOW EXPIRED / EXECUTION INCOMPLETE**。不写COMPLETED，不自动进入Production Content Preparation。Authenticated Authoring UI AUTH SESSION REQUIRED。Stage1G NOT AUTHORIZED / NOT READY。

## 8. R5D current closure — independent read-only acceptance

本节是新的当前状态记录。上文 R5C 历史原样保留：**AUTHORIZED FOR THAT WINDOW；WINDOW EXPIRED / EXECUTION INCOMPLETE；Actual Production Execution PARTIAL / STOPPED**。本节不追认窗口延期，不将 R5C 改为 COMPLETED，不新增任何生产变更授权。

| Current Closure field | Result |
|---|---|
| R5D Authorization | READ-ONLY ACCEPTANCE ONLY；用户 Stage 1F-R5D 明确请求 |
| R5D Post-Window Read-Only Acceptance | PASS |
| Current Foundation Technical Status | READY FOR CONTENT PREPARATION |
| Installed ledger / latest | 457 / 202609140007；old449 prefix 完整不变；8 stored SQL MATCH |
| Running application | R3D 6IhDHN8Dm1nCewiCEZnV5 / Next16.2.10；1394 approved files MATCH |
| Authoring Technical Foundation | PASS |
| Authenticated Authoring UI | AUTH SESSION REQUIRED；未冒用账号 |
| Feature / Allowlists | OFF / EMPTY |
| R5D Provider / Agent / Content writes | 0 / 0 / 0 |
| R5D Production DB Writes / Production Mutations | 0 / 0 |
| Runtime / Launcher / Tailscale | UNCHANGED |
| New recovery point | Not required for read-only acceptance closure；R5C backup retained |
| Stage1G | NOT READY / NOT AUTHORIZED |
| Next stage | Production Content Preparation，仍须单独明确授权；本次未执行 |

观察：2026-09-16T04:58:40.975487+00:00 → 2026-09-16T05:05:08.841843+00:00，387.866s，未超出30分钟只读观察预算。这不是production maintenance window。完整证据见 [R5D acceptance report](teaching-agent-stage-1f-r5d-post-window-foundation-acceptance.md)。Provider Policy / First Enable 均未批准。
