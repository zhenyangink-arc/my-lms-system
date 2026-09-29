# UPLY Teaching Agent — Pilot Operations Runbook

状态：**R4F Receipt Technical Contract PASS；R4G Primary Operator Package ACCEPTED BY PRIMARY OPERATOR（杨震）；Private Receipt Storage READY；Production execution BLOCKED；Stage 1G NOT READY。**

本文件记录用户杨震在R4G明确作出的operational acceptance。R4E技术阻断已由 [R4F](teaching-agent-stage-1f-r4f-reconciler-receipt-closure.md) 关闭；R4E/R4F/R4D历史报告不回写。当前接受及文件系统实测见 [R4G报告](teaching-agent-stage-1f-r4g-pilot-operations-acceptance-closure.md)。**OPERATIONAL ACCEPTANCE != PRODUCTION EXECUTION AUTHORIZATION**：只接受Primary Operator职责、人工monitoring、manual drain、incident handling、UNKNOWN、receipt保存与no-auto-retry；不授权production migration/deploy/reconciler/cancel、Provider Policy、真实学生开放、broader rollout、Feature ON或allowlists。

## 1. 人员、范围与接受记录

| 项目 | 当前事实 / 接受边界 |
|---|---|
| Release / Pilot / Incident Operator | 杨震，ASSIGNED |
| Monitoring Owner / STOP Decision Owner | 杨震；流程ACCEPTED，实际执行窗口仍待确认 |
| Teaching Content Owner | 杨震 |
| Backup Creation / Restore Operator | 杨震；R4D 备份创建、隔离恢复的授权不等于生产恢复授权 |
| Backup / Standby Person | TBD — NOT ASSIGNED |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |
| Primary Operational Acceptance / Primary Operator Package | ACCEPTED BY 杨震 / ACCEPTED BY PRIMARY OPERATOR |
| Independent Standby | BLOCKED；Single-operator risk ACKNOWLEDGED |
| Acceptance recorded at / 窗口 | 2026-09-15T07:52:37.180731Z（Asia/Seoul 2026-09-15 16:52:37.180731 +09:00）/ 待填写；依据用户明确接受，记录时间不是生产窗口 |
| Infrastructure execution access | 谁持有本次维护连接、允许的 DB 身份与 tenant scope：待明确批准；只读连接可用不等于维护写连接获批 |
| Receipt 复核人 / 交接方式 | TBD；不自动将主操作员指定为独立复核人或备班 |

首轮仅提议一个获批 internal/test user、一个 tenant、一个 course、一个 verified lesson、single-turn；所有实际标识与窗口均待批准。scope 冻结及恰好一课的证明不可由“只点击这一课”替代。本阶段名单保持 EMPTY，Feature OFF。离岗或无可用值守即 HOLD，停止新 admission；不作无人值守或全天候运行承诺。

## 2. 执行前技术与授权边界

当前生产 ledger449、latest202609130003、Agent tables0，八份 202609140000–007 尚未应用。因此 production reconciler **NOT AVAILABLE / NOT EXECUTED**。不得为演练而安装迁移。

未来仅在技术 Gate、运维接受、明确 tenant 范围、时间窗口及生产执行授权均具备后使用以下接口。现在不执行，不提供默认生产目标，不在 shell 参数中放密码/URI/JWT。

| 接口 | 参数 / 权限 / 限制 |
|---|---|
| `scripts/teaching-agent-r3a/reconcile-command.py` | `--service <approved-service> --tenant <approved-tenant-uuid> --operator <explicit-operator> --limit 50 --execute`；Python3 + PATH 中的 psql；R4G重新确认主机无原生psql，现有Docker PG17.6客户端TECHNICALLY AVAILABLE；未来CLI受控执行适配及维护凭据仍待批准 |
| libpq service | 独立批准的维护连接；受限 service/CA/passfile，TLS verify-full；目录700、文件600；不复用当前只读审计连接来写入 |
| DB 执行权 | 三个 reconciliation RPC 显式授予 service_role，PUBLIC/anon/authenticated 不获执行权；数据库 owner/管理员属于高权限边界 |
| 人员授权 | CLI 必填 --operator 显式人员标签，但不验证批准号或每人 tenant 授权；凭证持有人能提供其他 tenant 参数。每次一个获批 tenant 是外部运维约束，不能声称凭证本身只授权一个 tenant |
| 普通平台管理员 | 业务 platform-admin JWT 不等于 service_role，不具有 maintenance RPC 执行权 |
| 批次 | 默认50，合法1–100；无 global sweep、无自动循环、无重试、无续租、无重新生成答案 |

**Accepted Batch / Tenant Rule：one approved tenant per invocation；default50 / max100。** 不自动下一批、不自动retry。每次下一批前，杨震必须重新检查receipt、全部active、eligible及production state，再明确执行；本次未批准任何实际production tenant或维护凭据。

R4G Operator Bundle **LOCKED**；任何字节变化STOP，不自动接受新版本。manifest见 [operator-bundle.json](evidence/teaching-agent-stage-1f-r4g/operator-bundle.json)：

| 输入 | SHA256 |
|---|---|
| Reconcile CLI | `12842a373fd85fdc19cebafef40505387c970711376718c5f164b1ef71d21437` |
| Operator SQL | `b774e2cf72e12dba59d9ba06a4d14cec684b9555c47787dfdff33da1554bf36d` |
| Migration006 | `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a` |

Future production command contract（**模板文本，R4G未执行；所有实际scope、service、release/build、窗口及授权必须另行核准**）：

```text
python3 scripts/teaching-agent-r3a/reconcile-command.py \
  --service <APPROVED_SERVICE> \
  --tenant <APPROVED_TENANT_UUID> \
  --limit 50 \
  --operator "杨震" \
  --release-ref <APPROVED_RELEASE> \
  --build-ref <APPROVED_BUILD> \
  --receipt-file <PRIVATE_RECEIPT_PATH> \
  --execute
```

**R4F CLI合同：** 完整子进程返回、exit0、合法RPC结果JSON和COMMIT后的 `UPLY_RECONCILE_COMMIT_ACK_V1` 结束标记全部成立，才输出 `commitState=CONFIRMED / result=SUCCESS / success=true`。单独SELECT输出、marker或exit0都不足够。启动psql后的timeout/connection loss/killed child/坏输出/可捕获异常统一 `UNKNOWN / HOLD / success=false / retryAllowed=false / followUpReadRequired=true`；启动前本地验证失败才可 `NOT_COMMITTED`。不得通过最终Run已terminal倒签本次invocation成功。

`--operator` 必填，不从OS账号推断批准；未来执行需显式提供已核 `--release-ref`、`--build-ref`，未传时为null而非编造metadata。可选 `--receipt-file <new-private-path>`：已存在受信parent，不创建目录，不有意覆盖已有receipt；同目录temp+fsync+atomic rename、文件0600。正常file/stdout一致；文件失败stdout仍有HOLD，已确认的DB COMMIT不被误降为未知，但整次运维不可算成功。保持NO RETRY，先处置receipt保存问题。

Stdout只有JSON receipt；帮助/安全diagnostics走stderr，不输出原始数据库错误。无法捕获的SIGKILL、掉电、解释器故障或所有输出渠道不可写不可能保证receipt落地；dispatch后的缺receipt必须按UNKNOWN处理。R4G已准备并验证private目录；最终保留期限仍TBD，决定前保留、NO AUTOMATIC DELETION。没有生成production invocation receipt。

以下只读接口模板也仅用于未来获批、有 Agent 表的环境；raw tenant/run UUID 只放私有操作记录。

```text
# FUTURE ONLY — not executed in production by R4E/R4F/R4G
psql -X --dbname=service=<approved-read-service> --set=ON_ERROR_STOP=1 \
  --set=tenant_id=<approved-tenant-uuid> \
  --file=scripts/teaching-agent-r3/operator-active-runs.sql

psql -X --dbname=service=<approved-read-service> --set=ON_ERROR_STOP=1 \
  --set=tenant_id=<approved-tenant-uuid> --set=since=<window-start-UTC> \
  --file=scripts/teaching-agent-r3a/operator-monitor.sql

psql -X --dbname=service=<approved-read-service> --set=ON_ERROR_STOP=1 \
  --set=tenant_id=<approved-tenant-uuid> --set=run_id=<approved-run-uuid> \
  --file=scripts/teaching-agent-r3/operator-run-lookup.sql
```

先验证 DB target、current_user、实际读取权与批准范围，查询出错或角色不匹配都不能填0。既有 SQL 用 `current_user IN ('postgres','supabase_admin','service_role')` 过滤，不是操作员身份验证；无权角色出现空结果不能当 drain 成功。

R3 `operator-monitor.sql` 的 active 有 `created_at >= since` 时间过滤，**不能用于证明全部 active=0**。使用 R3 的 `operator-active-runs.sql` 或 R3A 的 `operator-monitor.sql` 全部 active；后者仅对 reconciled events 使用 since。

## 3. Exact Deadline / Reconciliation Contract

当前正式合同 `deadline-terminal-v1`，定义在 `supabase/migrations/202609140006_agent_run_reconciliation.sql`。

| 条件 | 精确语义 |
|---|---|
| Runtime deadline | 服务端 `receivedAt + 45000ms`，不是从模型开始或 operator 首次看见起算 |
| Admission | `p_deadline > clock_timestamp()` 且 `p_deadline <= clock_timestamp() + interval '45 seconds'`；budget deadline 必须匹配；lease 初始等于 deadline |
| 扫描 | `tenant_id=p_tenant AND status IN ('created','running','waiting_tool') AND deadline_at <= cutoff`；`cutoff=clock_timestamp()-interval '6 seconds'`；按 deadline、id 排序，limit1–100 |
| 单 Run 重查 | 锁定 tenant+run 行后：terminal 先返回 already_terminal；version/fence 不符返回 fence_conflict；`deadline_at > stamp - interval '6 seconds'` 返回 not_eligible |
| eligible 的取消 | `cancel_requested_at IS NOT NULL AND cancel_requested_at < deadline_at` → cancelled / RUN_CANCELLED |
| eligible 其余情况 | 包括取消恰在 deadline 或之后 → failed / DEADLINE_EXCEEDED |
| 原子写入 | agent_runs 终态/version/ended_at/reason，与两条 agent_run_events 在同一事务；不写回答/usage/Teaching 表 |

6秒仅是已有三段各2秒 stop-only cleanup 的容许窗口，不增加模型预算，不保证远端计费停止，也不是生产 SLA。DB 时钟、行锁与 CAS 最终裁决；不能以 PID、HTTP 断开、elapsed guess、lease 延长或本地 AbortController 推定终态。

## 4. Pilot Operator Checklist

以下均为未来窗口 checklist，不是已完成记录。

### Before Window

- [ ] 杨震确认值守窗口、联系方式、STOP 决策和交接；独立 standby 已指定并可联系。
- [ ] Provider policy 正式批准及有效期；technical owner 不替代 Data / Policy Approver。
- [ ] 精确 release/build、source/definition digest、八份 migration SHA 及顺序匹配；任何变化 STOP → REBUILD / REVERIFY。
- [ ] 生产实际 ledger/schema 与该批准阶段一致；不能在迁移后继续套用当前449/Agent0基线。
- [ ] 新鲜 recovery point、seal、恢复验证及 known-good app；实际变更时 snapshot age≤15分钟，或已取得更大 RPO 的明确例外批准。
- [ ] R4D 已验证的备份保留，不把旧备份仍存在当作当前 freshness；broader rollout 前 off-host。
- [ ] Feature / 三份名单精确批准值；仅 file OFF 不证明所有服务实例已加载。
- [ ] 真实 published lesson / script / nodes 内容验收；原 unlock 不变。
- [ ] 当前批准 internal user 的 tenant/enrollment/app/StudentPolicy 合法；真实 server Pins 及 revision/segment/node 拒绝验证。
- [ ] 目标 course 恰好一课 eligible 且冻结，或另行实现并验证 lesson allowlist；名单不扩大。
- [ ] PM2 online/restart/build、runtime 摘要、现有 Tailscale binding 符合批准；R4B 未压缩路径 PASS 不覆盖尚未证实的压缩路径。
- [ ] 受限监控终端打开、incident runbook 可访问；tenant 读权限及 reconciler 写权限分别核验。
- [ ] 核对R4F receipt COMMIT/UNKNOWN测试与精确CLI/SQL hash；确认私有保存路径/权限/保留/复核人已接受。
- [ ] 全部 active=0、eligible=0、无遗留未知提交；明确 pre/post Pilot reconcile 与 deployment/incident drain 流程的接受记录。

### During Window

- [ ] 每次 Run pre/post 检查及每5分钟人工 sweep；超期/边界异常立即处理，不等待下一次 sweep。
- [ ] 同时最多一个 Run；前次终态、evidence/output/source、usage known/unknown/missing 已核后才考虑下一次。
- [ ] 保存受限 sweep/异常/reconcile receipts；运行失败不能算 DB rollback 证明。
- [ ] 观察 active/overdue/cancel_requested、Provider/Tool 错误及超时、selection/evidence 绑定。
- [ ] Teaching Domain unauthorized writes=0；无法观察记 UNKNOWN 并 HOLD，不推测零写。
- [ ] 人员离岗、批准过期/撤回或 scope 漂移，停止新 admission 并进入 drain。

### After Window

- [ ] 按窗口批准停止新 admission，并核对全部 serving instances 的实际行为。
- [ ] 所有 active=0；没有 remaining eligible；没有未解决的 COMMIT UNKNOWN。
- [ ] 无新增 Provider/Tool/Teaching operations 的观察证据；不能仅以 DB terminal 推定远端调用已停止。
- [ ] 私有 receipts 封存，安全摘要与 release/合同 hash 可关联，复核人与交接记录完整。
- [ ] Feature/名单保持窗口批准的结束状态，不由本模板自动改值。
- [ ] Incident summary 完成；备份 retention 保持；关闭窗口，未获批准不扩围。

## 5. Manual Monitoring Sweep

**Accepted Pilot Monitoring Cadence: Every 5 minutes while Pilot window is active。Manual Monitoring: ACCEPTED BY 杨震。** 这是人工值守检查频率，不是网络SLA、response SLA或自动调度周期；实际生产监控执行前置仍BLOCKED。

额外检查触发点：Pilot开始前、每个重要Run后、incident发生时、drain开始、drain结束、Pilot窗口结束、release切换之前；保留每Run pre/post检查。**Scheduler NONE — MANUAL PILOT SUPERVISION**；R4G未安装scheduler、cron、systemd timer、PM2 scheduled monitoring、Supabase cron或GitHub scheduled workflow。NONE仅指本Agent/本任务新增调度，不声称服务器不存在其他任务。

以下15项人工检查规则 **ACCEPTED**；接受规则不声称观测能力已经全部具备。任何不可观测项必须UNKNOWN → HOLD，不猜0。

| # | 每次检查 | 现有来源 / 限制 |
|---|---|---|
| 1 | Feature state | 受限runtime摘要 + 未来获批实例行为核验；不导出完整env |
| 2 | Allowlist scope | 三份名单与独立批准scope核对 |
| 3 | PM2 online | jlist内存解析白名单字段，原始值不入repo |
| 4 | PM2 restart count | jlist安全计数及前后比较 |
| 5 | Approved tenant ALL ACTIVE | R3 active query或R3A monitor；不用since-filtered R3 aggregate证明全部active |
| 6 | Overdue / expired active | R3A expiredActive涵盖全部active；running单独计数，不混称 |
| 7 | cancel_requested | 现有R3A monitor未提供计数；下列受限只读投影 |
| 8 | Terminal distribution | R3窗口内completed/failed/cancelled；标明since |
| 9 | Reconciler eligible | R3A monitor，DB now-6秒，与active分开 |
| 10 | Last reconciler receipt | private目录人工核对；CLI可选保存，但没有自动last-receipt索引 |
| 11 | Provider failure / timeout | terminal reason、run.failure stage、model.started/usage；不把全部deadline失败算Provider超时 |
| 12 | Tool failure | tool.completed状态/run.failure stage；无现成全量聚合面板 |
| 13 | Output Gate / evidence failure | evidence.checked/output.checked、终态原因、sourceCount；人工对账 |
| 14 | Permission / tenant anomaly | owner/Pins/scope与获准安全日志；pre-admission拒绝未必有Run事件，无全覆盖告警 |
| 15 | Teaching Domain Writes | Student AI Teacher MVP预期0；源码边界 + 获准窗口观察，无完整在线零写计数器；不明则UNKNOWN/HOLD |

补充只读投影草案（**未在生产执行**，执行前需批准连接、tenant、schema 与角色）：

```sql
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SET LOCAL statement_timeout='5s';
SELECT count(*) FILTER (WHERE status='running' AND deadline_at<=now()) AS running_overdue,
       count(*) FILTER (WHERE status IN ('created','running','waiting_tool')
                         AND cancel_requested_at IS NOT NULL) AS cancel_requested_active,
       count(*) FILTER (WHERE cancel_requested_at IS NOT NULL) AS cancel_requested_all
FROM public.agent_runs
WHERE tenant_id=:'tenant_id'::uuid
  AND current_user IN ('postgres','supabase_admin','service_role');
COMMIT;
```

上述 count 仅在连接身份已确认且查询完整成功时有意义。缺数据、查询失败、不可观察、缺 usage 均填 UNKNOWN，不能填0、猜成本或编造错误率阈值。超期不能收敛是 STOP；一般观测缺口先 HOLD，不继续请求。

### Pilot Sweep Receipt 模板

这是人工记录格式，不是新增自动 decision engine；数字默认 UNKNOWN。

```json
{
  "receiptVersion": "pilot-sweep-manual-v1",
  "timestampUtc": "TO_BE_RECORDED",
  "operator": "杨震",
  "tenantAlias": "APPROVED_SAFE_ALIAS_PENDING",
  "feature": "UNKNOWN",
  "allowlistScope": "UNKNOWN",
  "pm2State": "UNKNOWN",
  "pm2RestartCount": "UNKNOWN",
  "activeRuns": "UNKNOWN",
  "overdueRuns": "UNKNOWN",
  "runningOverdue": "UNKNOWN",
  "cancelRequested": "UNKNOWN",
  "terminalDistribution": "UNKNOWN",
  "reconcilerEligible": "UNKNOWN",
  "lastReconcilerReceipt": "UNKNOWN",
  "providerFailures": "UNKNOWN",
  "providerTimeouts": "UNKNOWN",
  "toolFailures": "UNKNOWN",
  "outputGateFailures": "UNKNOWN",
  "evidenceFailures": "UNKNOWN",
  "tenantPermissionAnomalies": "UNKNOWN",
  "teachingDomainWrites": "UNKNOWN",
  "observationWindow": "TO_BE_RECORDED",
  "decision": "HOLD",
  "decisionReason": "TEMPLATE_ONLY_NOT_EXECUTED"
}
```

CONTINUE＝证据与批准允许继续；HOLD＝信息/值守/批准待核，不开新请求；DRAIN＝按已授权程序收敛；STOP＝安全不变量或生产状态异常，停止新 admission 并升级。均由人工判断，不由模板自动触发生产操作。

## 6. Manual Drain / Reconciler Procedure

**Procedure contract: ACCEPTED BY PRIMARY OPERATOR / production execution BLOCKED**；杨震已接受manual drain规则，实际tenant/权限/窗口及生产前置仍未关闭。以下仅为未来获批后的步骤：

1. 停止新 admission。未来通常为批准的 Feature OFF / allowlist 收紧，必须验证每个 serving instance 实际加载并拒绝新请求；保留 owner GET/cancel。当前开关启动时加载，只改文件不会热生效。实例替换/listener drain/PM2 操作必须有另行批准的具体步骤，本轮不执行。
2. 在唯一批准 tenant 上查 **全部** active，保存受限 run refs、status、deadline、version；不要遗漏窗口开始前的 Run。
3. 对可取消的 Run 使用正式 owner-bound persistent cancel：`POST /api/teaching-agent/runs/[runId]/cancel`（服务端认证/Origin/owner检查）；特殊基础设施调用原 RPC 也需独立授权，不能借用他人 Cookie。accepted 仅说明取消事实已记录，不说明已终态。
4. 等活 worker 按既有预算有界收尾；本地 abort 是加速，跨进程靠持久 cancel 检查。不能延长预算，不能用无限等待掩盖 orphan。
5. 对剩余死亡/超期 worker，仅在每个 persisted deadline+6秒 eligible 后，以获批维护连接对该 tenant 显式执行一批（默认50，最大100）。不自动跨 tenant，不调用模型、Tool 或 Teaching write。
6. 保存 receipt。只有 **COMMIT CONFIRMED receipt = successful invocation**（正常 `commitState=CONFIRMED`、`result=SUCCESS`、`success=true`）。单独SELECT输出/exit0/legacy status不够。timeout、connection loss、client crash、未知提交或缺receipt一律 **COMMIT UNKNOWN → STOP → NO RETRY → 新read-only connection → READ-ONLY VERIFY → OPERATOR REVIEW**。原invocation永远保留UNKNOWN，复查terminal只另记followUpDatabaseState。保存文件失败即使已知COMMIT也HOLD，不盲目重跑。
7. 再查 tenant 的 **all active=0** 才满足收敛必要条件；空 eligible batch、不含future Run的计数或单批成功均不够。不能以 HTTP 断连/错误帧替代 DB 状态。
8. 确认没有新增 Provider、Tool execution、Teaching operations；观察时段与来源须写明，缺观测不能填0。若远端Provider无法可靠停止，STOP，不以终态掩盖。
9. 若仍有eligible，Primary Operator先复核receipt、全部active、eligible、production state，再逐次明确执行有界下一批；不自动下一批或retry。若尚未eligible，按真实deadline有界等待并重查；冲突/异常先调查。不得无限循环全库。只有 **ALL ACTIVE = 0**、无未知提交、无新增执行及完整证据同时成立才签Drain PASS；**eligible=0不等于drain complete**。之后才可能另行执行获批app rollback/stop。

## 7. Immediate STOP Conditions

**ACCEPTED BY 杨震。** 任一触发立即HOLD / STOP NEW ADMISSION，不等待下一个5分钟sweep。

- cross-tenant evidence、permission violation、未经授权 Teaching Domain write。
- lesson/selection 绑定错误或 `verified_selection` invariant 破坏。
- Output Gate 绕过、evidence/persistence 前发出 answer.final。
- Provider 无法可靠停止，terminal 后仍新增模型/Tool/教学操作。
- COMMIT UNKNOWN、receipt 无法取得或不能对应实际提交。
- 超 deadline+grace 仍不能 terminalize，或 active 无法收敛。
- production state / migration / schema / release / runtime 漂移。
- Feature / allowlists 与批准范围不符；新增 eligible lesson 破坏 single-lesson 冻结。
- Provider policy 未批准、过期、撤回或发送数据超范围。

不编造5%/10%/20%错误率或未批准 SLA。STOP 后保存最小安全 evidence，关闭新 admission 并按已授权 incident 流程处理，不自行“修数据”。

## 8. Incident Operator Checklist

执行人杨震；**Incident checklist ACCEPTED BY PRIMARY OPERATOR**；独立备班仍未指定，具体生产变更仍需授权。

1. 记录 UTC 时间、触发原因、受限 run/tenant refs、release/build。
2. 停止新 admission；核实际所有 serving instances；不只编辑配置文件。
3. 保存 Feature/allowlist/runtime/PM2/Tailscale 安全摘要；不导出env/凭证。
4. 查询批准 tenant 全部 active。
5. 走正式授权 persistent cancel；记录 accepted/already_terminal/not_found，不虚构终态。
6. 等有界收尾，并按每个 persisted deadline 判断。
7. 对 eligible 且获批的范围运行一次 tenant-scoped reconciler；现在该动作不可用。
8. 确认真实 COMMIT；不明确则 COMMIT UNKNOWN、STOP、只读核 DB，禁止盲目自动重跑。
9. 重查 all active=0、无新增 Provider/Tool/Teaching 操作；否则 incident 未收敛。
10. 分类：Agent-only / Application failure / Database corruption / Infrastructure failure，保存事实依据。
11. 按 [R4D](teaching-agent-stage-1f-r4d-backup-recovery-verification.md) 与 [R4C 恢复场景](teaching-agent-stage-1f-r4c-backup-recovery-preflight.md) 决定下一步：Agent-only 通常 OFF/drain；app rollback 保留 additive migrations/Agent数据；真实 DB corruption 才另行批准数据损失窗口、恢复点、隔离恢复及生产restore；infra故障另交获授权管理员。**Agent问题 ≠ database restore。**
12. 封存 receipt、unknown事实、未完成动作，交复核人；不得用 DROP Agent tables 回滚，不自动重启、迁移或恢复生产。

## 9. Reconciler Receipt Contract

**Contract: IMPLEMENTED / R4F PASS（技术）；R4G UNKNOWN / No-Retry Policy ACCEPTED BY 杨震；生产执行授权未取得。** `receiptVersion=reconciler-receipt-v1`，与DB合同 `deadline-terminal-v1` 分开。

**Accepted Policy：UNKNOWN → STOP → NO RETRY → NEW READ-ONLY CONNECTION → READ-ONLY VERIFY → OPERATOR REVIEW。** 仅CONFIRMED可认定已提交；正常运维成功同时要求SUCCESS/true和receipt保存正常。原UNKNOWN receipt永远不可倒签；即使follow-up查到failed/cancelled，也不能证明是哪一个worker/reconciler提交。

**NOT_COMMITTED Policy ACCEPTED：** 仅用于明确没有dispatch/没有提交机会，例如local validation failure、missing operator、invalid limit、执行前receipt path问题。dispatch后的timeout、connection lost、SQL rejection、killed process、malformed output默认UNKNOWN；目前没有新的明确rollback证明协议。

| 实际字段 | 含义 / 当前实现 |
|---|---|
| receiptVersion / invocationId / operation | envelope版本、本地关联UUID、固定reconcile操作；invocationId不是DB事务ID或人员批准凭证 |
| operator / executedAtUtc | 显式必填operator及UTC起点；R4F测试用synthetic-operator，R4G未运行reconciler |
| tenantScope / batchLimit | approved private tenant；默认50/max100；repo仅safe alias/hash或synthetic UUID |
| examined / eligible / processed | 本批selected candidates/results数量；eligibleScope明确是scan时有界候选，不是全tenant数量 |
| terminalized / cancelled / failed | 本批确定提交的reconciled计数；cancelled+failed=terminalized |
| skipped / fenceConflicts | already_terminal/not_eligible/not_found归skipped；fence_conflict单列；二者都不是新收敛 |
| commitState | 仅CONFIRMED / NOT_COMMITTED / UNKNOWN；未知时所有结果计数null |
| result / success / errorCode | 仅正常CONFIRMED为SUCCESS/true；未知为HOLD/false/安全code，无raw stderr |
| durationMs | 单调时钟执行耗时，记录到receipt序列化前；不冒称网络或数据库独立耗时 |
| releaseRef / buildRef | 显式safe labels；未提供为null，未来production应提供已核值 |
| reconcilerVersion / reconcilerHash | deadline-terminal-v1和冻结006 migration SHA |
| operatorSqlHash / operatorCommandHash | 实际operator SQL/CLI字节hash，发生变化重新审阅 |
| followUpReadRequired / retryAllowed | UNKNOWN为true/false；所有路径均不自动retry |
| followUpInstruction / receiptFileWritten | 安全下一步说明与可选文件写入结果；非自动执行能力 |
| legacy aliases | contractVersion/status/reconcileError/reconciledCancelled/reconciledDeadlineFailed保留兼容；不再只看旧status判断成功 |

`terminalized + skipped + fenceConflicts = processed`；全tenant eligible数量及时间另由monitor只读receipt记录，不能用本批eligible替代。当前SQL完全保持原RPC/tenant/batch/transaction语义，只在COMMIT后加结束标记。CLI等整个psql返回、exit0并严格验证JSON、各结果/计数和结束标记后才确认。SQL拒绝保守记UNKNOWN，不用exit3猜服务器rollback。

**Follow-up read contract ACCEPTED（人工流程，未在生产执行）：**

1. 原UNKNOWN receipt原样封存，停止新操作，无自动retry。
2. 获授权operator建立**新的read-only connection**，重新验证真实DB target、DB身份、tenant与release/schema范围。
3. 用本文件§2已有只读接口查tenant全部active，以及获准run的status/version/events/deadline；必要时取R3A monitor的eligible；不读问题/答案正文，不执行reconcile/cancel/UPDATE。
4. 另存follow-up记录：originalInvocationId、checkedAtUtc、operator、tenantAlias、followUpDatabaseState、active/eligible、evidenceRef、operatorDecision。未知字段保持UNKNOWN。
5. 即使当前DB显示terminal，也可能是另一worker/reconciler赢得CAS；**original invocation remains UNKNOWN**。不得覆盖原receipt为CONFIRMED，不把当前数据库状态当成本次调用提交证据。
6. 由operator人工审阅后决定后续授权动作；本CLI不重连查询、不自动再发一个batch、不重新调用Provider。

SIGKILL/掉电/输出彻底不可写无法保证receipt；缺receipt同样STOP/UNKNOWN。`reconcileError=1`只表示失败或歧义调用，不是rollback次数。R4F只关闭提交结果处理技术阻断，不倒改R4E历史FAIL，也不把R4F PASS写成生产运行PASS。

## 10. Private Storage / Retention / Acceptance

Private Receipt Storage：**ACCEPTED / READY**，`/home/yangzhen/operations/uply/teaching-agent/receipts/`。R4G依据明确授权创建；owner/group=yangzhen、目录0700、receipt文件0600、umask077。各级lstat/ownership/ACL/mount检查通过；同目录temporary0600 → flush/fsync → atomic rename → readback → cleanup实测PASS。合成probe已删除，未生成production invocation receipt。现有非任务父目录未chmod。证据见 [receipt-storage.json](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)。

Primary Operator杨震已接受保存方式；独立复核人/交接安排仍TBD。Private acceptance JSON已存同root的 `acceptance/`（目录0700、文件0600），只记录本次接受，不是数据库receipt；原件及任何生产receipt禁止进入Git，repo仅脱敏metadata。

禁止存入repo：姓名/email等学生身份、原问题/模型回答、教材原文、JWT/Cookie、DB credential、完整受限tenant/run关联。私有原件按批准最小范围保存，repo引用alias/hash；hash不等于法律匿名化。执行人杨震是已公开确认的运维责任人，区别于学生数据。

**Private Receipt Retention: TBD — FINAL RETENTION PERIOD NOT YET DECIDED。NO AUTOMATIC DELETION已接受。** 用户明确决定前保留所有未来Pilot receipt；不得由scheduler自动删除，不编造7/30/90天批准，也不宣称法律保留期。最终期限、复核/删除责任与交接待明确；R4D备份保留规则不套用到receipt。

| 接受项 | 当前状态 |
|---|---|
| 每5分钟人工 sweep + 每Run pre/post | ACCEPTED BY 杨震；额外触发点见§5 |
| pre/post Pilot流程、deployment drain、incident reconcile程序 | ACCEPTED BY PRIMARY OPERATOR；具体生产reconcile/cancel执行仍未授权 |
| 单tenant基础设施权限及访问 | PENDING — 明确scope/credential holder/窗口待批准 |
| Primary operator package | ACCEPTED BY PRIMARY OPERATOR |
| private storage / retention / reviewer | ACCEPTED / READY；最终保留期限TBD（NO AUTOMATIC DELETION）；复核人TBD |
| independent standby | BLOCKED — NOT ASSIGNED |
| Provider Policy | BLOCKED / APPROVAL REQUIRED；Data / Policy Approver TBD |
| 生产执行授权 | NOT GRANTED IN R4G；production tenant、maintenance credential、window均TBD |

R4G只记录明确接受、核验原R4F bundle、准备private storage并只读核对生产；未改CLI/SQL/migration或产品代码。Production Agent/reconciler/cancel/DB writes/Provider requests/scheduler installs均0；Feature OFF、allowlists EMPTY。R4D Backup Technical Readiness仍READY，但旧snapshot已超15分钟；未来变更前必须新fresh recovery point或明确RPO exception。本轮不创建backup、不restore。停止于R4G，Stage1G NOT READY。
