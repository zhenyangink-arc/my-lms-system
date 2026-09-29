# UPLY Teaching Agent — Stage 1F-R4E Pilot Operations & Reconciler Acceptance

## 1 Executive Summary

**Overall: NO-GO（运维接受放行）；Primary Operator Package: PARTIAL；Operational Readiness: BLOCKED；Stage 1G: NOT READY。**

主要执行人杨震已指定。人工 monitoring、drain、incident、receipt 与 operator checklist 已整理为 [Pilot operations runbook](teaching-agent-pilot-operations-runbook.md)，但未签署 Operational Acceptance。独立 Backup / Standby 仍 TBD — NOT ASSIGNED；Data / Policy Approver 仍 TBD — APPROVAL REQUIRED。

当前 DB 收敛实现仍为 `deadline-terminal-v1`：一个显式 tenant，默认50、最大100，持久 deadline 后6秒、行锁内重查 version/fence/取消事实，仅写基础设施终态和事件，不重答、不调用 Provider/Tool、不写 Teaching Domain。新增隔离数据库复核33项通过；现有 Runtime/Transport 回归 exit0。

**新发现的运维阻断：现有 CLI 没有明确 COMMIT acknowledgement/COMMIT UNKNOWN 合同。** 正常结果由 psql exit0 加 COMMIT 前生成的 JSON 推断 `status=committed`；超时、连接丢失等统一为 `failed/RECONCILE_FAILED`，异常 JSON 还可能使客户端无 receipt 退出。因此 R4E I/J 不变量验收 FAIL，不能据历史 R3A GO 或本轮 DB 测试通过把整套运维包标 READY FOR USER ACCEPTANCE。未修改任何原实现来换取 PASS。

生产开始/结束检查一致：ledger449、latest202609130003、八份 Agent 增量 NOT APPLIED、Agent tables0、Feature OFF、三名单EMPTY，PM2/runtime/Tailscale未变。本任务生产 DB writes、Agent/Provider/reconciler/cancel、scheduler安装均0。

## 2 Scope

本阶段仅接受准备：源码/既有运维材料审计、生产 catalog/配置只读检查、无生产连接的合成测试、脱敏 evidence 和文档。未执行生产DDL/DML/migration/deploy/restore、Agent、persistent cancel、reconciler、Feature/名单写入、Auth变更、PM2或Tailscale变更。

必读输入已完整审阅：

- [R4D backup/recovery](teaching-agent-stage-1f-r4d-backup-recovery-verification.md)、[R4C preflight](teaching-agent-stage-1f-r4c-backup-recovery-preflight.md)、[R4B transport](teaching-agent-stage-1f-r4b-tailscale-transport-verification.md)。
- [R3A reconciliation](teaching-agent-stage-1f-r3a-run-reconciliation.md)、[R3 operations gate](teaching-agent-stage-1f-r3-production-operations-gate.md)、[operations roles](teaching-agent-pilot-operations-roles.md)。
- `scripts/teaching-agent-r3a/` 全部12个文件，R3三份 operator SQL、当前 cancel/deadline/transport/coordinator/persistence 与迁移000/001/002/006、相关 fixture/测试。

历史报告是阶段证据，不是本轮生产授权。R3强杀FAIL已由R3A DB合同闭环，R3A历史receipt测试只覆盖正常提交与拒绝，不能证明本轮明确要求的全部unknown outcome语义。R4B整体仍PARTIAL（gzip未协商）；R4D证明数据库逻辑恢复，不是完整Supabase平台恢复。

生产检查复用已审阅的 [R4C inventory.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r4c/inventory.py) 的 `database/operations/workspace` 函数，另存R4E，不调用其历史证据写入入口。固定READ ONLY事务、TLS verify-full、catalog/ledger查询，不取学生业务行。私有凭据仅临时受限挂载并清除；不输出值。

本轮新增三个文档/证据位置：本报告、runbook、`docs/evidence/teaching-agent-stage-1f-r4e/`；仅最小同步当前roles文件。临时测试程序位于 `/tmp`，摘要和hash入evidence；未新增产品API、scheduler或运维自动化服务。保留所有原dirty文件，最终文件hash比较见§16。

## 3 Current Production State

| 项目 | 开始 / 结束 |
|---|---|
| UTC采样 | 2026-09-15T06:53:35.895639Z / 2026-09-15T07:08:42.416675Z |
| PostgreSQL | 17.6 / 17.6 |
| Ledger / latest | 449 / 202609130003，前后一致 |
| Full ordered version/name SHA256 | `d864066c601dd9b7e60144773f34eb456f035cbae9dec114a716048fa5151981` |
| Agent tables / public agent_* tables | 0 / 0，前后一致 |
| 202609140000–007 | NOT APPLIED；源文件八份SHA均与当前baseline manifest一致 |
| Feature | TEACHING_AGENT_STUDENT_TRANSPORT_ENABLED=OFF |
| Allowlists | TEACHING_AGENT_ALLOWED_TENANTS/COURSES/USERS=EMPTY |
| PM2 | uply-first-enable，online，PID1176676，restart_time0，instances1，kill_timeout15000ms，前后一致 |
| Runtime SHA256 | `7a4b31b099fb968dd1105f8fbc67b946ae3fa79c30873998f8864ef1578878c8`，一致 |
| Launcher SHA256 | `30c81ade417866170cb3c3b3dd1cf9477cb033c9c3c0be363674c0f92eed0039`，一致 |
| Tailscale | 443→127.0.0.1:3001；4000→4000；8443→3000；9443不存在；Funnel=false，一致 |
| Serve canonical SHA256 | `b33a37027b06f50f17d82a983f9c89ff342ca1fc94d58d0908c4e6bbeb83d256` |
| Task Provider / Agent / production reconciler | 0 / 0 / 0 |

证据：[database-start.json](evidence/teaching-agent-stage-1f-r4e/database-start.json)、[database-end.json](evidence/teaching-agent-stage-1f-r4e/database-end.json)、[operations-start.json](evidence/teaching-agent-stage-1f-r4e/operations-start.json)、[operations-end.json](evidence/teaching-agent-stage-1f-r4e/operations-end.json)、[production-safety.json](evidence/teaching-agent-stage-1f-r4e/production-safety.json)。身份digest与R4C/R4D一致；客户端TLS1.3验证成功，backend pg_stat_ssl是另一观测点，不宣称所有内部链路已验证。

Runtime文件OFF/EMPTY和同一进程/启动器摘要已核，不声称读取了不可见的完整进程env或验证热加载。生产状态检查只覆盖所列catalog/ledger/配置，不声称同时冻结了全站其他业务。

R4D snapshot起点06:31:24.914920Z；本次结束采样时age **2237.502秒，约37分17秒**，已超过实际go-live的≤15分钟要求。R4D技术READY仍成立，但实际变更前必须重新核freshness并建立新恢复点或取得明确RPO例外；本轮未再创建backup。

## 4 Reconciler Architecture

| 当前模块 | 职责 / 调用关系 |
|---|---|
| [reconcile-command.py:5](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/reconcile-command.py:5) | argparse验证service/tenant/limit/execute → psql subprocess一次 → receipt；无retry |
| [operator-reconcile.sql:3](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-reconcile.sql:3) | BEGIN → statement15s/lock2s → batch RPC SELECT → COMMIT |
| [find_reconcilable_agent_runs_v1:8](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql:8) | tenant+active+deadline索引扫描；默认50/max100 |
| [reconcile_agent_run_batch_v1:58](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql:58) | 单次有界loop，逐候选调用单Run RPC；聚合取消/失败计数；一事务 |
| [reconcile_agent_run_v1:21](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql:21) | tenant/run行锁 → terminal/fence/version/deadline重查 →原子终态与两条事件 |
| [operator-monitor.sql:4](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-monitor.sql:4) | 全tenant active/expired/eligible；since仅用于reconciled事件 |

当前正式migration006 SHA：`6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a`；CLI SHA：`de6524fe53813e64ded6c9d4844233cd0fea462170fb0261ab7d19778a5eef10`。本轮审计的R3A运维脚本均与R3A manifest匹配；交叉覆盖的Runtime输入也与R3A一致，见安全evidence中的逐项比较。

Reconciler只更新agent_runs、插入agent_run_events，没有import/runtime dispatch、Provider、Tool、Teaching Domain调用。没有应用级公开maintenance route；Supabase存在受ACL限制的RPC接口，不能将“无新增Next route”写成“没有RPC”。无自动scheduler，只有显式维护调用才会收敛orphan。

**DB algorithm: PASS；Reconciler Architecture（含本轮必需receipt I/J）: FAIL。** 失败位于外部提交结果/receipt接口，不是发现SQL可以跨tenant或重新生成答案。

## 5 Authority & Safety Invariants

| 不变量 | 判定 | 当前证据 / 精确限制 |
|---|---|---|
| A Database/CAS最终authority | PASS | 006行锁/CAS；000/001/002 transition wrapper同锁；隔离并发一赢家 |
| B local AbortController只是优化 | PASS | [active-run-abort-registry.ts:4](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/active-run-abort-registry.ts:4)；跨进程检查持久cancel |
| C persistent cancel是持久事实 | PASS | [140002:30](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140002_agent_run_cancel_request.sql:30)：owner+tenant+student guard，coalesce写cancel_requested_at，不消费version/fence |
| D 不生成新模型答案 | PASS | 006固定failed/cancelled，无agent_messages写入 |
| E 不重新调用Provider | PASS | SQL/CLI无该调用，未恢复Runtime；隔离fixture与live请求区分 |
| F 不调用Teaching Domain write | PASS | 仅两个基础设施表；本轮合成Teaching表hash保持 |
| G 不能跨tenant处理run | PASS（显式参数隔离） | 查/写均tenant过滤；错误tenant单run not_found；不等于限制credential holder只能选某tenant |
| H HTTP断开不能自行伪造DB终态 | PASS（DB事实） | disconnect→localabort+owner-bound取消；必须terminal CAS或reconciler。HTTP错误帧不是数据库收敛凭证 |
| I receipt对应明确成功commit | FAIL（R4E合同不满足） | 当前CLI exit0+SELECT JSON推断committed，无单独提交确认/关联；未复现生产错误commit |
| J unknown commit不得当已知结果 | FAIL（显式unknown缺失） | timeout/lost connection统一failed，无COMMIT UNKNOWN；无receipt退出也无记录 |

持久 cancel链：[production.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/production.ts) 认证绑定owner → [student-handlers.ts:130](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/student-handlers.ts:130) Origin/body/身份 → [run-store.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/run-store.ts) RPC → DB owner guard/行锁。accepted之后才触发 registry.abort；断连路径先localabort，再best-effort持久cancel。持久写失败或worker死亡不会自动代表terminal。

Runtime checkpoint执行checkCancellation；停止后usage/failure/terminal各有有界收尾。普通完成在 evidence/output 通过后await completed持久化才发 answer.final：[student-run-coordinator.ts:124](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-run-coordinator.ts:124)。001 wrapper在同事务验证Tool/evidence/output并写source_refs；DB失败不放行正常最终答案。Transport catch可能发送失败通知，但它不能替代owner GET/DB终态确认。

## 6 Tenant Scope & Batch Limit

SQL scan/batch输入 `p_tenant uuid, p_limit integer default 50`；tenant/limit NULL或limit不在1–100抛INVALID_REQUEST。CLI要求 `--tenant` UUID、`--service`、`--execute`，limit同界限。单Run还要求runId、expectedVersion≥1、fence；错误tenant返回not_found。没有global无限sweep、自动下一批或无tenant默认目标。

一次处理一个**明确批准**tenant；tenant参数只是过滤，不是人员授权。三个security definer/search_path空的RPC撤销PUBLIC/anon/authenticated grants，仅显式授service_role；owner/admin DB权限另属于基础设施特权。普通tenant-admin/platform-admin业务JWT不可执行。

CLI没有operator identity、批准号、每人tenant范围验证；当前只读生产连接可用不等于已经确定reconciler credential holder和approved tenant。未来需确认connection target、DB身份、权限、service配置与实际执行环境。本轮读取到主机PATH **无psql**，仅已有Docker PG17客户端可用于隔离/只读；R3A测试中的guarded wrapper依赖已销毁的staging，不能直接当生产可用入口。[access-interface.json](evidence/teaching-agent-stage-1f-r4e/access-interface.json)。没有安装客户端或写连接配置。

## 7 Deadline Semantics

精确规则源于 [create-student-ai-teacher-runtime.ts:35](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/create-student-ai-teacher-runtime.ts:35)、[admission:144](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140000_agent_core_foundation.sql:144)、[reconciler:38](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql:38)：

```text
runtime deadlineAt = server metadata.receivedAt + 45000ms
admission: DB now < p_deadline <= DB now + 45s
           budget.deadlineAt = p_deadline; lease_expires_at = deadline_at
scanner cutoff = clock_timestamp() - interval '6 seconds'
eligible = requested tenant AND status ∈ {created,running,waiting_tool}
           AND deadline_at <= cutoff
single-run: acquire row lock; terminal → already_terminal;
            expected version/fence mismatch → fence_conflict;
            deadline_at > stamp - 6s → not_eligible
eligible AND cancel_requested_at IS NOT NULL AND cancel_requested_at < deadline_at
  → cancelled / RUN_CANCELLED
otherwise eligible → failed / DEADLINE_EXCEEDED
```

strict `<`表示deadline恰时或之后cancel不走cancelled分支。无heartbeat/续租/按PID猜死亡；future lease不能延长hard deadline。6s来自三段2s stop-only cleanup，不是允许新模型调用的grace，也不是“51秒必定完成所有网络停止”的SLA。5分钟sweep只是人工提案，发现超期不必等下一轮。

## 8 Drain Runbook

[Runbook §6](teaching-agent-pilot-operations-runbook.md) 已列完整9步：停止新admission并核所有实例 → 批准tenant全部active → 正式持久cancel → 等有界worker退出 → deadline+6s后获批tenant reconcile → commit receipt → 重查all active=0 → 无新Provider/Tool/Teaching执行证据 → 必要时明确下一批。

**Active=0 Completion Rule: PASS（规则）；Drain Procedure: PARTIAL（执行前置未闭合）。** R3 active query无since限制，R3A monitor的active也无since；R3旧monitor按created_at过滤，不能拿其active=0作全tenant drain证明。本轮合成测试确认空eligible而future active=1是可能状态。

Feature为启动时加载；future OFF必须由所有serving实例实际加载/新POST拒绝，不能只编辑runtime文件。保留owner GET/cancel；具体生产实例替换/PM2操作仍需批准。当前无本轮生产执行；commit不明时停止drain、只读核DB，不能继续标PASS或盲目重试。

## 9 Monitoring Sweep

**Proposed Pilot Monitoring Cadence: every 5 minutes；Cadence proposal READY FOR OPERATOR ACCEPTANCE；Pilot Monitoring: PARTIAL。** 与operations roles§1一致。每Run pre/post、窗口结束/发布前另查；超期或安全异常立即处理。无人值守不继续Pilot，未安装任何调度。

Runbook§5已给14类最小检查及人工receipt模板：Feature、allowlist、PM2online/restarts、all active、running overdue/全部expiredActive、cancel_requested、terminal分布、eligible、last receipt、Provider失败/timeout、Tool失败、OutputGate/evidence、tenant/permission、Teachingwrites。

当前R3A monitor无cancel_requested计数、无last receipt存储、无完整Provider/Tool/evidence全窗口聚合；runbook提供受限只读cancel/running-overdue投影草案及逐Run事件对账来源，**未部署监控能力**。模型调用missing usage不能算0，deadline可能不是Provider阶段错误；没有完整pre-admission、跨tenant或Teaching写入在线计数器。观测不明记UNKNOWN并HOLD，不编造错误率SLA或零写证明。

Scheduler installed=NO；cron/systemd timer/PM2 monitoring job/Supabase cron/GitHub scheduled job installs=0。Production Scheduler=NONE指本Teaching Agent维护调度/本轮新增，不断言全服务器所有其他任务不存在。

## 10 Incident Procedure

[Runbook §7–8](teaching-agent-pilot-operations-runbook.md) 已分别列Immediate STOP与Incident Checklist。包括：跨tenant、权限/教学写边界、错误lesson/selection与verified_selection、OutputGate绕过、持久化前answer.final、Provider不停止、未知commit、超期不能终态、active不能收敛、production/schema/runtime/scope漂移。

记录时间 → 停admission → 安全配置摘要 → 全active → 正式cancel → 有界等待 → 获批tenant reconcile → 确认commit → active0 → 分类与恢复决策 → 封存/交接。Receipt缺口使整体 **Incident Runbook: PARTIAL**，不能签已具备执行条件。

分类为Agent-only、Application failure、Database corruption、Infrastructure failure。默认Agent问题不restore数据库；app rollback保留additive migrations/Agent数据；真实数据损坏须另批损失窗口/RPO/隔离验证/production restore。R4D备份创建与隔离恢复授权不能替代生产恢复批准。禁止DROP Agent tables回滚。

## 11 Receipt Contract

**Receipt Contract: PARTIAL；G-R4E-10 FAIL；Unknown Commit Handling: FAIL。** 新文档合同字段齐备，现有执行实现不齐备，两者不能合并为READY。

| 当前事实 | 证据 / 问题 |
|---|---|
| SQL JSON在COMMIT之前输出 | operator-reconcile.sql:7–8；预提交结果本身不证明持久化 |
| 正常receipt | CLI:16–21，exit0、contractVersion、results list与长度校验之后status=committed；无独立ack/transaction关联 |
| 错误receipt | CLI:11、22–23，timeout/OSError/SQL/JSON错误统一failed/RECONCILE_FAILED，reconcileError=1 |
| 无receipt异常 | `data=[]`时 `.get` 抛AttributeError不在except列表；合成单测复现，非生产故障 |
| 已有字段 | contractVersion、tenantScope原UUID、batchLimit、examined、取消/失败数量、fenceConflicts、status/reconcileError |
| 缺失字段 | operator、UTC、duration、receiptVersion、明确commitState、release/build/hash、全tenant eligible及skipped、可靠提交关联 |

本轮 [receipt-audit.json](evidence/teaching-agent-stage-1f-r4e/receipt-audit.json) 对真实CLI模块注入模拟subprocess结果，10种情形复现上述分支，真实subprocess/DB连接0。覆盖正常empty/默认/max、非法0/101、lost connection、timeout、SQL拒绝、坏JSON、非objectJSON。**这是提交结果处理合同测试，未在生产或真实网络重现“实际回滚却报告commit”**；健康psql正常执行仍受ON_ERROR_STOP和完整SQL文件结束约束。问题是本轮要求的显式确认/UNKNOWN及receipt完备性缺失，不夸大为数据库事务损坏。

现有脚本对非零退出不报成功、没有retry、stderr不原样泄露，这些优点保留。README已要求歧义时先查状态，但CLI无法把歧义与确定失败分开。历史R3A normal success/denial PASS不篡改，本轮按新合同独立FAIL。

未来operator envelope完整字段定义见runbook§9：receiptVersion、operation、operator、executedAtUtc、tenant scope、inputBatchLimit、eligible/processed/terminalized/skipped/conflict、commitState、duration、result/errorCode、release/build、reconcilerVersion/hash及commitEvidence/followUpRead。processed=本批results，terminalized=取消+deadline失败，eligible是另次全tenant资格采样，不能混算。

**仅 COMMIT CONFIRMED 为成功。** timeout/connection lost/unknown transaction/client crash或缺receipt → COMMIT UNKNOWN → STOP → 新只读会话核status/version/events/all active。exit0/exit1不单独推定commit/rollback；若另一worker或reconciler可能赢得CAS，单看最终terminal也不能倒签本次invocation成功。未实施自动decision engine、补写receipt库或修改旧脚本。

## 12 Receipt Storage / Retention

Private Receipt Storage: **PROPOSED**，`/home/yangzhen/operations/uply/teaching-agent/receipts/`；未创建外部目录。设计directory700、receipt600、umask077；实际访问人、复核人、交接与权限验证待确认。raw tenant/run scope可在批准私有原件保留，repo仅safe alias/hash，不留学生姓名/email、问题/回答、JWT/Cookie、DB凭据或真实生产receipt。

**Private Receipt Retention: TBD — operator decision required。** 建议覆盖完整Stage1G Pilot及incident review窗口，不指定未经批准的法律/业务周期。R4D的备份保留≥7天且Pilot稳定结束是另一对象的已批准规则，不能套成receipt批准。

## 13 Operator Checklist

Runbook§4已形成杨震的Before/During/After分组：release/backup/migrations/Feature/allowlist/lesson/Pins/policy/tenant-user/PM2/Tailscale/监控终端与incident材料；窗口中sweep/receipt/active/错误/selection/evidence/零授权外写；结束停admission/allactive0/noeligible/封存/配置批准值/incident与备份保留。

Checklist具备不等于已接受或已执行；没有勾选未来操作。pre/post Pilot reconcile、deployment drain、incident reconcile、5分钟sweep、基础设施权限/tenant范围及receipt保留/复核需真实接受记录。**Primary Operator Coverage已有指定人员；Package PARTIAL；没有杨震 ACCEPTED。**

## 14 Non-production Verification

| 验证 | 本轮结果 / 范围 |
|---|---|
| 现有Runtime与Transport套件 | exit0；两文件、内存persistence/synthetic provider；DB opt-in关闭；不是live Provider或production HTTP测试 |
| 当前SQL隔离PG合同 | **33 assertions PASS**；真实迁移000/001/002/006装入owned network-none合成fixture；无生产连接/凭证 |
| Tenant/权限 | 错tenant not_found；version/fence冲突；anon/authenticated三个RPC拒绝；nulltenant拒绝 |
| Deadline/cancel | early cancel cancelled、late cancel failed、future不收敛、6秒grace、lease不能延长hard deadline；owner取消持久且version/fence不变；wrong owner隐藏 |
| 原子性/竞争 | 明确事务内注入1/0，row/events回滚；两个真实DBsession以行锁barrier竞争，只有一组终态事件；重复terminal不变 |
| Batch | 默认50、剩余55；最大100、剩余1；0/101/null拒绝；emptyeligible但futureactive仍1 |
| 完成与教学副作用 | 当前真实Runtime通过合成Provider/Domain fixture完成；再次reconcile保持completed；Teaching fixture表前后hash一致 |
| Receipt异常 | 10情形审核已复现；合同Gate FAIL，不以“测试执行成功”冒充产品满足要求 |
| Cleanup | fixture finally完成，结束label检查剩余容器0；没有端口发布、production挂载或scheduler |

证据：[database-tests.json](evidence/teaching-agent-stage-1f-r4e/database-tests.json)、[runtime-tests.json](evidence/teaching-agent-stage-1f-r4e/runtime-tests.json)、[receipt-audit.json](evidence/teaching-agent-stage-1f-r4e/receipt-audit.json)、[test-attempts.json](evidence/teaching-agent-stage-1f-r4e/test-attempts.json)、[code-hashes.json](evidence/teaching-agent-stage-1f-r4e/code-hashes.json)。临时测试程序路径/hash见 [temporary-test-source-hashes.json](evidence/teaching-agent-stage-1f-r4e/temporary-test-source-hashes.json)。

Runtime测试使用Node默认reporter，安全汇总最初按TAP提取计数未得到数字；记录实际exit0，不声称具体总tests数量。SQL验证fixture `withStudentRuntimeDatabase({transport:true})` 内部用PG17.6.1.141、network none、read-only rootfs、tmpfs、无bind/nohostports，结束销毁。生产只读客户端另用PG17.6.1.159，不混称同一环境。现有fixture模拟PostgREST/学生数据权限，不是本轮Full Supabase真实JWT/RLS重测。

首次新DB测试在最后batch数量断言失败：顺序Docker fixture准备超过原future行40秒deadline，使其合法变eligible。修正仅在未来资格/cancel断言之后将该合成sentinel的deadline延至1小时，隔离批次计数测试；产品45秒预算、SQL6秒规则未改。第二次完整33项PASS；失败清理及原因保留。当前没有重新运行强杀Next/Full Supabase；R3A既有37项DB、27项RPC JWT拒绝、强杀两例仅作为历史辅助证据。

合成Agent数据准备/迁移/真实Runtime fixture写入为NONZERO；Teaching领域在观测窗口零变更；本任务production写入0。没有把隔离基础设施写入隐瞒为“所有数据库写入0”。

## 15 Standby Status

Release、Pilot、Incident、Monitoring、Teaching Content及Backup Creation/Restore Operator均为杨震（后者授权限R4D已批准事项）。**Backup / Standby Person: TBD — NOT ASSIGNED；Independent Standby: BLOCKED；Single-operator risk remains。**

当前服务器另有账号不是人员身份/权限/值守证据；不据此指定备班。Data / Policy Approver仍TBD。主操作员的infra/technical/backup权限不替代独立备班、数据政策或生产执行批准。

## 16 Production Safety

开始/结束固定catalog与运维字段全部一致，详见 [production-safety.json](evidence/teaching-agent-stage-1f-r4e/production-safety.json)。本轮production DDL/DML/Agent Run/persistent cancel/reconciler/Provider请求/部署/Feature与名单写入/PM2或runtime或Tailscale修改/scheduler installs **全部0**；Agent迁移NOT APPLIED。

只读audit连接强制READ ONLY；合成DB与生产凭据隔离，迁移只装owned fixture，R3A production reconcile命令未运行。未创建private receipt外部目录、未再备份/restore生产、未装cron/systemd/Supabase/GitHub调度。

当前审计代码hash与八份迁移匹配；最终工作区检查仅允许roles、本报告、runbook和R4E证据。原dirty业务文件/历史报告/迁移/config全部保留，未gitadd/commit。`git diff --check`、新未跟踪文档的no-index空白检查、JSON解析、敏感值/模式扫描与前后文件SHA比较见 [workspace-scope.json](evidence/teaching-agent-stage-1f-r4e/workspace-scope.json)。

“0”指本任务动作，不声称其他用户同期没有业务写入。Feature/runtime证明范围见§3；生产Agent表不存在，所以未假装运行active查询并得到0，也未把production reconciliation写成PASS。

## 17 Gate Matrix

不以多数PASS抵扣critical FAIL；文档模板准备与实际运行能力分开。

| Gate | Name | Status | Evidence / 限制 |
|---|---|---|---|
| G-R4E-1 | Current Production State Confirmed | PASS | 本轮start/end固定catalog与ops |
| G-R4E-2 | Reconciler Source Identified | PASS | 当前006/CLI/SQL/RPC，hash匹配 |
| G-R4E-3 | Persistent Cancel Authority Confirmed | PASS | 002/owner链，合成DBcancel检查 |
| G-R4E-4 | Database/CAS Authority Confirmed | PASS | 行锁/CAS/事务回滚/双session |
| G-R4E-5 | Tenant Scope Confirmed | PASS | 强制tenant参数隔离；human授权外置且仍待批准 |
| G-R4E-6 | Batch Bound Confirmed | PASS | 默认50、最大100，真实batch检查 |
| G-R4E-7 | Deadline Rule Confirmed | PASS | receivedAt+45s；DB deadline+6s |
| G-R4E-8 | No Provider Re-execution | PASS | reconciliation路径无Provider/Runtime执行 |
| G-R4E-9 | No Teaching Domain Writes | PASS | 仅Agent基础设施写；fixture教学hash不变 |
| G-R4E-10 | Commit Receipt Contract | FAIL | 显式commit确认/关联及完整字段缺失 |
| G-R4E-11 | Unknown Commit Handling | FAIL | 无COMMIT UNKNOWN；client crash可无receipt |
| G-R4E-12 | Drain Active=0 Rule | PASS | runbook及emptyeligible/futureactive对照 |
| G-R4E-13 | Manual Monitoring Checklist | PASS | runbook14类信号/UNKNOWN规则；实际monitoring仍PARTIAL |
| G-R4E-14 | Incident Stop Conditions | PASS | 明确安全与漂移STOP，无编造SLA |
| G-R4E-15 | Operator Checklist | PASS | Before/During/After，未签接受 |
| G-R4E-16 | Incident Checklist | PASS | 独立incident步骤及恢复边界 |
| G-R4E-17 | Receipt Storage Plan | PASS | PROPOSED、700/600、未创建；执行准备另待核 |
| G-R4E-18 | Receipt Retention Decision | BLOCKED | TBD — operator decision required |
| G-R4E-19 | Non-production Tests | PARTIAL | DB33项/Runtime回归通过；receipt负向暴露未满足合同 |
| G-R4E-20 | Production Reconciler Execution Status | BLOCKED | NOT AVAILABLE / NOT EXECUTED；表0，正常阶段边界 |
| G-R4E-21 | Scheduler Installation Status | PASS | NO安装；人工提案不假装ACTIVE |
| G-R4E-22 | Primary Operator Package | BLOCKED | 内容PARTIAL；技术I/J未通过，不能READY FOR USER ACCEPTANCE |
| G-R4E-23 | Independent Standby | BLOCKED | TBD — NOT ASSIGNED |
| G-R4E-24 | PM2 Unchanged | PASS | PID/restarts/uptime/status等相同 |
| G-R4E-25 | Runtime Unchanged | PASS | 文件hash/launcher/OFF/EMPTY相同 |
| G-R4E-26 | Tailscale Unchanged | PASS | Serve canonical hash及binding相同 |
| G-R4E-27 | Production Ledger Unchanged | PASS | 完整有序ledger SHA与count/latest相同 |
| G-R4E-28 | Production DB Writes Zero | PASS | 仅READ ONLY catalog/ledger，本轮写0 |
| G-R4E-29 | Provider Requests Zero | PASS | fixture-only，无live调用 |
| G-R4E-30 | Reconciler Production Runs Zero | PASS | 无生产维护执行 |

## 18 Remaining Blockers

- Receipt I/J技术合同：明确commit证据、UNKNOWN分支、无receipt/crash处理、完整envelope；当前只记录，没有修实现。
- Reconciler实际操作环境、psql/受限连接、明确credential holder、tenant scope/窗口批准及访问验证，未因只读成功而关闭。
- Primary operational acceptance：pre/post Pilot reconcile、deployment drain、incident reconcile、每5分钟人工sweep尚未签署；部分监控信号需手工对账，不能宣布完整在线观测。
- Private receipt目录/权限落实、保留期限、复核人、交接，以及独立standby待确定。
- Provider Policy批准、真实production内容/内部用户/StudentPolicy/Pins、single-lesson范围及冻结，均未由R4E处理。
- Production migration/deploy/definition publication/allowlist/First Enable及窗口授权仍独立缺失；工程PASS不授权执行。
- Actual go-live backup freshness：本轮end已超过15分钟，未来需新恢复点或明确RPO例外；broader rollout前off-host仍需落实。
- R4B Compression / Buffering PARTIAL及完整生产课堂链的其他未闭合Gate，不能由本轮DB/运维文档替代。

## 19 Final Recommendation

接受本轮作为**审计与人工runbook准备材料**：DB收敛、tenant范围、batch、deadline、cancel/CAS合同有当前源码和隔离测试支持；原型receipt仍缺R4E所要求的明确提交/UNKNOWN处理，不能签署完整运维就绪。

**Overall NO-GO；Primary Operator Package PARTIAL；Operational Readiness BLOCKED；Stage 1G NOT READY。** 不代杨震签Operational Acceptance，不指定独立备班或Data/Policy Approver，不继续加Agent功能绕过Gate。停止在R4E，未部署、未迁移生产、未启用Feature、未运行production reconciler、未安装scheduler。
