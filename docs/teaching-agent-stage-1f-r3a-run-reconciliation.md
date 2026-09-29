# UPLY Teaching Agent — Stage 1F-R3A Run Reconciliation

## 1. Executive Summary

**Overall: GO，仅针对 R3A 的 Run reconciliation / operator drain closure。Production Pilot 仍 BLOCKED；Stage 1G NOT READY。**

R3 的故障判断成立：persistent cancel 只记录取消事实，deadline 只禁止继续合法执行；worker 被强杀后，两者都不会自行更新数据库终态。新增 `deadline-terminal-v1` 基础设施合同，在行锁内检查 tenant、状态、deadline、取消时间和 CAS version/fence，只把符合条件的孤儿 Run 收敛为 failed/cancelled，不重试或恢复 Agent。

实际 `next start` + 30 秒 Provider fixture + SIGTERM 后约 15 秒 SIGKILL，重新复现两次。两次均在约 47 秒时仍 running；调用 reconciler 后，有取消的一次变为 cancelled，无取消的一次变为 failed / DEADLINE_EXCEEDED；active=0，无新增 Provider/Tool/教学操作。真实数据库双会话竞争、138 项既有 JWT 检查及 27 项新增 RPC 拒绝检查通过。

原 `G-R3-21 Drain Procedure` 在**本报告的新评估中 PASS**。历史 R3 报告、manifest、证据保持原样。新候选声明 **SUPERSEDES R3 CANDIDATE / R3 candidate SUPERSEDED BY R3A CANDIDATE**。本轮不部署、不执行生产迁移、不修改生产 PM2/Tailscale/环境变量，不进入 Stage 1G。

## 2. Inputs & Baseline

已在本任务连续上下文完整阅读 Current State Audit、Architecture v1、0A、0B、1A、1B、1C、1D、1E、1F、R1、R1B、R2、R2A；本轮重新读取 R3、R3A 请求及实际 SQL/Runtime。源码/数据库合同优先于设计文档。重要输入：[teaching-agent-stage-1c-runtime.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1c-runtime.md)、[teaching-agent-stage-1d-transport.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1d-transport.md)、[teaching-agent-stage-1f-r3-production-operations-gate.md](/home/yangzhen/projects/my-lms-system/docs/teaching-agent-stage-1f-r3-production-operations-gate.md)。

本轮开始保存 2951 个既有文件 SHA256，保留已有 dirty workspace。生产通过强制 read-only、TLS 校验连接读取 schema-only snapshot 和 ledger；开始/结束 catalog 完全一致：449 条、Agent tables=0。baseline cutover 仍为 `202609130003`；baseline SQL SHA256 `e5de2f48fa40da53ebcae5353aa4907b1738e15998a304a37b3d0fc555c7bac5`。

重新扫描 migration，原最高版本确为 `202609140005`，新增未占用版本 `202609140006`。独立 Full Supabase project `uply-agent-r2-a93acb7ddd5a`，loopback API 33283、DB 33045、Next 43137；临时 marker、project、目录、端口和 Docker label 都经过 guard。只创建合成数据，不复制真实学生/课程正文。所有 Provider 调用均 fixture，live=0。

## 3. Files Changed

唯一修改的既有文件是 [baseline-manifest.json](/home/yangzhen/projects/my-lms-system/supabase/bootstrap/baseline-manifest.json)：追加第七份增量及其 hash。baseline SQL、449 ledger、前六份迁移、产品 TypeScript/React、Prompt/Tools/Skills、既有报告与 R3 证据均未改动。

| 新增 | 用途 |
|---|---|
| [202609140006_agent_run_reconciliation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql) | partial index、扫描/单 Run/批次三项 service-only RPC |
| [operator-reconcile.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-reconcile.sql) / [reconcile-command.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/reconcile-command.py) | 一次性、明确 tenant、提交后安全 receipt |
| [operator-monitor.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-monitor.sql) | active/expired/eligible/reconciled 计数 |
| [database-checks.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/database-checks.py) | 真 DB 双会话竞争、幂等、CAS、batch、EXPLAIN |
| [strong-kill.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/strong-kill.mjs) | 两种实际强杀复现与 HTTP/UI controller 恢复 |
| [rpc-permissions.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/rpc-permissions.mjs) / [operator-checks.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-checks.py) | 真 JWT 拒绝、实际运维 SQL/CLI receipts |
| [rehearse-migrations.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/rehearse-migrations.py) | 全七步双路径与新迁移故障注入 |
| [refresh-pins.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/refresh-pins.mjs) | 正式合成课堂 setup 后重新生成授权 pins |
| [release-manifest.mjs](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/release-manifest.mjs) / [candidate-smoke.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/candidate-smoke.py) | 新候选 manifest、原始制品 OFF smoke/client scan |
| [README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md) | 维护合同、drain、失败停止与隔离测试顺序 |
| 本报告及 `docs/evidence/teaching-agent-stage-1f-r3a/` | 本轮证据；无 raw private logs |

## 4. R3 Drain Failure Reproduction

R3 中 `cancel_requested_at` 已存在，但旧 Next 被 15 秒强杀后，47 秒仍 running。根因是 [student-run-coordinator.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/runtime/student-run-coordinator.ts) 的失败/cancel terminal CAS 由原进程执行；原进程死亡，没有数据库作业接替提交。[run-store.ts](/home/yangzhen/projects/my-lms-system/src/features/teaching-agent/server/transport/run-store.ts) 的 status 只读取，cancel 只记录请求，不暗中执行恢复。

本轮用真实 production-mode Next 重现**有取消、无取消两例**，没有改短 Runtime 的 45 秒预算。强杀后先保存 running 证据，再显式调用 reconciler，不以 fixture UPDATE 冒充强杀收敛。[strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json)。

## 5. Run State / Fence Model

| 字段 / primitive | 真实合同 |
|---|---|
| status | created → running ↔ waiting_tool → completed / failed / cancelled；终态不再转移 |
| deadline_at | admission 验证大于 DB 当前时间且最多 45 秒；从请求总预算传入 |
| lease_expires_at | admission 设为同一 deadline；没有 heartbeat、续租、独立 worker ownership 表 |
| state_version | 初始 1；每次 transition +1，append/usage 要求匹配 |
| fencing_token | admission 生成 UUID；CAS 检查 token + version + expected status |
| cancel_requested_at | 独立持久 metadata；cancel 不消费 version/fence；非 stop transition 会拒绝 |
| created_at | 仅审计时间，不用于猜测死亡资格 |
| ended_at / terminal_reason | 终态事务写入 |
| public_event_seq | HTTP replay 的 disjoint sequence block；不同于 durable events.seq |

[202609140000_agent_core_foundation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140000_agent_core_foundation.sql) 的 admission/base transition、[202609140001_agent_runtime_completion_evidence.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140001_agent_runtime_completion_evidence.sql) 的 completion evidence wrapper、[202609140002_agent_run_cancel_request.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140002_agent_run_cancel_request.sql) 的 cancel wrapper/status RPC 已逐项审计。正常 completed、final assistant message、terminal event、source_refs 都在嵌套调用的**同一事务**中；没有“先提交答案，再单独 completed”的产品路径。

## 6. Reconciliation Eligibility

`deadline-terminal-v1` 的资格判定在 DB 行锁取得后重新执行：

1. 明确 tenant + runId 命中；否则 not_found，无其他 tenant 信息。
2. 已 terminal → already_terminal，先于旧 fence/version 判断，保持原终态。
3. non-terminal 且 expected version/fence 不匹配 → fence_conflict，无写入。
4. DB clock 至少超过固定 deadline **6 秒** → eligible；否则 not_eligible。
5. eligible 且 `cancel_requested_at < deadline_at` → cancelled / RUN_CANCELLED；其他 → failed / DEADLINE_EXCEEDED。

6 秒允许当前主路径的 usage/failure audit/terminal CAS 三段各 2 秒 stop-only 收尾；它不是续租、生产 SLA，亦不声称网络 I/O 一定在该窗口内消失。当前 production 没有配置额外 secondary TraceSink；最终仍靠事务锁判定赢家。尚在收尾的执行器若先提交终态，reconciler no-op；若丢失 CAS，不能重新完成。

首版保守地等待 deadline+6s，即使 cancel 已存在也不凭 PID/年龄猜测提前失去执行权。lease 元数据供诊断；它不能延长 hard deadline。未来 deadline、刚过 deadline 的 grace window、伪造 version/fence 均有负向测试。[reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json)。

## 7. Database Reconciliation Contract

| RPC | 输入 / 输出 |
|---|---|
| find_reconcilable_agent_runs_v1 | tenant、limit 1–100（默认50）；仅 runId/status/deadline/lease/cancel/version/fence |
| reconcile_agent_run_v1 | tenant、runId、expectedVersion、fence；不接受 target status/reason/正文 |
| reconcile_agent_run_batch_v1 | tenant、limit；至多100个候选；返回安全结果和本批计数 |

单 Run 通过 `SELECT ... FOR UPDATE` 获取与 completion/append/usage 相同的锁；在锁内重新检查，再以相同 version/fence 更新状态、version+1、ended_at、固定 reason，并原子追加 `run.reconciled` 和 `run.failed` / `run.cancelled`。事件序号在该锁内按 max(seq)+1/+2 分配，不占用 HTTP public_event_seq。

单 Run 结果是 reconciled / already_terminal / not_eligible / not_found / fence_conflict；只有 reconciled 返回固定 safe reason。批次也是单事务；任一异常使本批全部回滚。命令设置 statement_timeout 15s、lock_timeout 2s；函数批次亦设置 lock_timeout 2s。命令只有在 psql 成功退出、COMMIT 成功后才输出 committed receipt。错误/timeout/未知提交结果输出安全失败 receipt，禁止把 SELECT 已输出等同于成功。

SQL 自身不调用 Provider、Tool、Runtime，不读 Prompt，不写消息或 usage。[202609140006_agent_run_reconciliation.sql](/home/yangzhen/projects/my-lms-system/supabase/migrations/202609140006_agent_run_reconciliation.sql)。

## 8. Permissions

三个 public-schema RPC 均 `SECURITY DEFINER SET search_path=''`；撤销 PUBLIC、anon、authenticated、service_role 原默认权限后，仅 grant execute 给 service_role；函数所有者/数据库基础设施管理员仍具有原管理能力。没有修改表 RLS、没有授予 browser 直接写表。

Student、Teacher、Organization Admin、Platform Admin 的普通 authenticated JWT 均不能执行。原 8 种真实 Auth 用户加 anon，对三函数共 **27 项**，得到预期 401/403 + PostgreSQL `42501`；不是把 RPC 不存在当作拒绝。[reconcile-permissions-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-permissions-result.json)。

**无新增 Next public HTTP endpoint、Server Action 或浏览器调用入口。** Supabase 自身存在受 execute ACL 限制的 RPC 路径；“NONE”指没有新增产品 public reconcile endpoint，不隐瞒 service-only PostgREST RPC 的存在。tenant 参数是必须的过滤范围，不是赋予某个人全租户授权的凭证；operator 仍须有独立获批的基础设施连接/tenant 范围。无 global sweep。

## 9. Deadline Orphan Handling

无 cancel、超过 deadline+6s 且 non-terminal → failed，reason=DEADLINE_EXCEEDED。未过 deadline 的 lease/worker 猜测不会触发提前失败。真实无取消强杀 case 的终态由新增批次 RPC 写入，不靠 Runtime 复活。[strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json)。

## 10. Cancelled Orphan Handling

cancel 在 deadline 前持久化且没有终态赢家，在超过收敛窗口后 → cancelled / RUN_CANCELLED。cancel 在 deadline 后才到达 → failed / DEADLINE_EXCEEDED。正常活 worker cancel 保持原实现；首版维护能力不会强行把未来 deadline 的 active Run 提前 terminal。

因此 cancellation invariant 是：persistent cancel + 合法完成权过期 + operator invocation，最终 cancelled；不是“按下 cancel 立即保证终态”。实际强杀有取消 case 已验证。

## 11. Terminal Immutability

completed/failed/cancelled 在 reconciler 中首先返回 already_terminal；不更新状态、version、ended_at、reason、messages 或 events。完成先赢的两会话测试保留原 final answer/source_refs。重复检查验证 row 和 event count 不变。

真实 completion wrapper 提交后故意在同事务执行 `SELECT 1/0`，验证 final assistant message 与 completed 一起回滚：Run 保持 running、assistant message=0。正常 E2E 又验证成功事务的答案/状态都存在。不存在需要 reconciler 猜测恢复的“已提交 final、尚未提交 completed”半状态。[reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json)。

## 12. Reconcile Idempotency

首次成功只增加两条 durable events；随后同一旧 snapshot 多次 reconcile 返回 already_terminal，不追加重复 terminal/reconciled event。重复 batch 无 eligible 返回空 results，不重答。强杀两例均检查再次 batch 为空。

注意空 batch 只意味着本次扫描没有 eligible；未来 deadline active 仍可能存在，operator 必须另查全部 active，不能据此标 drain PASS。

## 13. Concurrency / CAS

**真实两个 PostgreSQL session**，以第一事务持有行锁并短暂停留、第二会话进入同一 RPC，最后提交。两个 reconciler 竞争时，第一提交 reconciled，第二在取得锁后重新读取 terminal → already_terminal；只有一组 terminal events。不是在单个 Node 内存 store 模拟竞争。

数据库 deadline 资格、row lock、version/fence 和 terminal 检查共同裁决，不依赖 Node 调用的时间先后或前端状态。[reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json)。

## 14. Live Worker Race

| 真实双 session 场景 | 结果 |
|---|---|
| 合法 completion 先执行并持锁，reconciler 等待 | completion commit 后第二 session already_terminal，答案保留 |
| deadline+grace 已过，reconciler 先持锁 | failed commit，迟到 completion 被 PERSISTENCE_FAILED 拒绝，assistant message=0 |

竞争测试从**本轮真正完成的 formal E2E Run**复制有效 persisted Tool/evidence/output 元数据，准备新合成 active Run，通过原 `transition_agent_run_v1` wrapper 提交；没有改 completion gate 或直接 UPDATE 成 completed。人工时间/行准备仅用于 fixture，两个竞争事务使用真实 DB 合同。该测试证明 DB 最终提交竞争；正式课堂测试另证明真实 Runtime 能产生这些 evidence。

## 15. Strong Kill Reproduction

使用实际 Next production build 的隔离 fixture 副本。30 秒 Provider 延迟并保持真实请求，发送 SIGTERM，15 秒仍未退出则 SIGKILL，仅按独有 staging cwd 定位进程；未操作生产 PM2。

两个 case 都观察到：旧执行器已死亡，约 47 秒时 DB 仍 running。有取消的一例在强杀前通过原 owner-bound cancel RPC 持久化取消。此处 RPC 的 service caller 是 staging harness；原 user HTTP cancel 路径在正常正式课堂回归中另行验证。

## 16. Strong Kill Closure

以下时间均 UTC，精确记录见 [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json)；不推导 production SLA。

| case | SIGTERM | 强杀完成 | deadline | 调用 reconcile | durable terminal |
|---|---|---|---|---|---|
| cancel persisted | 2026-09-14T13:46:15.722Z | 2026-09-14T13:46:30.849Z | 2026-09-14T13:47:00.179+00:00 | 2026-09-14T13:47:06.280Z | 2026-09-14T13:47:06.297102+00:00：cancelled |
| no cancel | 2026-09-14T13:47:10.536Z | 2026-09-14T13:47:25.659Z | 2026-09-14T13:47:54.96+00:00 | 2026-09-14T13:48:01.060Z | 2026-09-14T13:48:01.074762+00:00：failed |

两例都 active=0，新增 Provider=0、Tool=0、应用数据库 HTTP=0、Teaching writes=0、assistant messages=0。观测从强杀完成到 reconciliation 后另等 2200ms；期间只有基础设施 observer/RPC。随后独立进行 owner GET 与 UI recovery；这些请求的正常 Auth 查询不冒称不存在。reconciler SQL 本身只访问 Agent infrastructure。

## 17. Batch Reconciliation

混合 completed/failed/cancelled、未来 active、过期 running、cancel-requested running、过期 waiting_tool；显式 limit=2 首批只返回2条，后续 bounded batch 处理余下 eligible。被测混合集合仅3个 eligible 改变，未来/终态保持不变；limit 0/101、null tenant 拒绝；错 tenant 的指定 Run 返回 not_found。

新增 partial index `agent_runs_reconcile_deadline(tenant_id, deadline_at, id) WHERE status IN (...)`；扫描在函数开始捕获 DB cutoff 作为查询参数，单 Run 仍在锁内重新采样时钟。6000 条合成未来 active 样本在回滚事务内用于 EXPLAIN：Index Only Scan，tenant+deadline 都在 Index Cond，外层 Limit；该次已清空 expired 所以返回0行。它证明索引访问路径，不冒称实际生产 p95，也不以空结果证明 drain。[reconcile-index-plan.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-index-plan.json)。

## 18. Operator Drain Procedure

[README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md) 与 [reconcile-command.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/reconcile-command.py) 提供新流程：

1. 所有实例停止新 admission；验证新 POST 拒绝。启动时加载的配置必须由真实实例加载，单改文件不算 OFF。
2. tenant-scoped 查询所有 active，走既有授权 owner-bound cancel 路径持久化取消。
3. 等活 worker 正常结束；剩余项等待 persisted deadline+6s，不授予新预算/续租。
4. 显式运行有限 batch；任何 SQL/receipt 异常 STOP，CAS conflict 要查明，不自动重试 Agent。
5. 再查全部 active=0，核无新 Provider/Tool/Teaching 操作；有 future active 或批次未扫完就继续等待/明确下一批，不能 PASS。
6. 只有以上证据满足后才允许另行授权的 rollback/stop。

两种强杀恢复均在 active=0 和 2200ms 无新调用检查后停止 OFF staging Next。R3 历史 known-good rollback 证据保留，本轮不重新操作旧 release、不部署。正常 cancel 70ms 完成；死亡 executor 的路径则由独立 reconciler 闭环。

Next 当前 self-hosting guide 与 `node_modules/next/dist/server/lib/start-server.js:320` 已核：SIGTERM 先 server.close 停新连接，等待 in-flight，再 close server/flush；只有 dev 有 cleanup callback set，没有本项目可直接用来自动 cancel 全部 Agent 的 production hook。没有添加重复 process.on、没有切换 NEXT_MANUAL_SIG_HANDLE、自造 custom server 或修改 PM2 15秒配置。graceful shutdown 是优化，不能替代 SIGKILL/OOM/掉电之后的 durable reconciler。

## 19. Operator Observability

[operator-monitor.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-monitor.sql) 得到 active=0、expiredActive=0、eligible=0；本轮最终 durable reconciledCancelled=3、reconciledDeadlineFailed=9（包含合成合同测试，非真实用户统计）。原 R3 active/lookup 查询继续通过。

| Signal | 定义 |
|---|---|
| expiredActive | non-terminal 且 deadline<=DB now，包括6秒 grace 内 |
| eligible | non-terminal 且 deadline<=DB now-6s |
| reconciledCancelled | since 范围内 run.reconciled reason=RUN_CANCELLED |
| reconciledDeadlineFailed | since 范围内 run.reconciled reason=DEADLINE_EXCEEDED |
| reconcileError | 受限 operator 命令失败 receipts 的计数，涵盖拒绝/timeout/提交结果不明；不把它猜成实际 DB rollback 次数 |

实际命令使用 guarded Docker psql wrapper 连接独有 staging：一次成功 COMMIT receipt、一次 authenticated execute 拒绝 receipt，错误计数1。失败 SQL 事务不能可靠写入自己的 error 记录，因此没有伪造 DB error row；receipt 由未来批准的 operator log 保存/聚合。本轮 evidence 保存两条 receipt。[operator-reconcile-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/operator-reconcile-result.json)。

事件 metadata 只含 reason、previousStatus、deadlineExceeded、cancelRequested、reconcilerVersion。没有 Prompt/原句/raw ToolResult。强杀前已开始但未记录 usage 的模型调用仍是缺失 accounting，不能填0 tokens/cost。本阶段未建立定时调度、告警平台或值守人员。

## 20. UI / Status Recovery

两种强杀收敛后均通过实际已登录 owner `GET /api/teaching-agent/runs/[runId]` 返回正确 terminal。未改 protocolVersion=1。原产品 UI controller 回放已接收的 run.started frame，然后通过真实 owner HTTP GET 恢复为 failed/cancelled；busy=false、answer 不存在、仅一次 GET，没有新解释 POST。

这是 product controller + real HTTP 的恢复验证；完整 UI DOM/keyboard/mobile 仍由现有真实 Chromium opt-in 测试覆盖，不把 controller 测试伪装成两种强杀后的 DOM 截图测试。[strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json)、[tests-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/tests-result.json)。

## 21. Teaching Domain Side Effects

Reconciler 仅扫描/更新 agent_runs，追加 agent_run_events；不访问 Teaching Domain，不写 agent_messages、ai_token_usage。正式课堂/正常 runtime/合同与强杀/运维窗口前后，79 张教学、身份、catalog、progress、assessment 等表 rowcount + sorted row JSON 指纹一致：changedTables=[]、Teaching writes=0。[side-effects-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/side-effects-result.json)、[domain-before.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/domain-before.json)、[domain-after.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/domain-after.json)。

合成 Auth/课程/Run fixture setup 不算零写：它在明确 setup 中发生。数据库竞争 fixture 的 admission/completion 会执行原身份 guard，不能把整套测试的所有读取称为0；零读取指 reconciler 本身，以及已单独观察的 kill→reconcile 窗口。

## 22. Normal Runtime Regression

正式课堂实际 HTTP 45秒测试：receivedAt 到 terminal 45064ms，原 Runtime 自己 failed / DEADLINE_EXCEEDED；之后2226ms新增 Provider/Tool/Teaching reads/writes 全0。正常 cancel HTTP200，70ms 后 durable cancelled；Feature OFF 时新 POST404、owner GET200。已终态的20条 failed/cancelled Run 在强杀测试前调用 reconciler全部 no-op。

因此维护机制不是正常 deadline/cancel 的替代。replay 仍复用同 run/conversation，额外 Provider/rows=0；changed message/segment 的冲突仍拒绝。[browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/browser-result.json)。

## 23. RLS / Agent / Classroom Regression

| 检查 | 结果 |
|---|---|
| 原 R2A Full Supabase Auth/JWT/PostgREST/RLS | 138 PASS |
| 新三 RPC 真实 JWT/anon execute 拒绝 | 27 PASS |
| Formal classroom synthetic route | PASS，实际 Korean textbook shell、pins、Explain UI、Tool/evidence/output |
| Agent completed/replay/cancel/deadline | PASS |
| 真实双 DB session / atomic completion / batch | 37 assertions PASS |
| 广泛62files含4A14、4A7、publication、sidebar、video、presentation/script studio | 1146 tests：1135 PASS、0 FAIL、11 SKIP |
| Core/1A–1E显式opt-in DB/Next/Chromium | 199 PASS、0 FAIL、0 SKIP |
| Blackboard | 8 PASS |

早期 harness failure 已解释并保留简述：先生成 pins 后改 formal catalog 导致旧 revision 比较失败；一次遗漏 Node server-only test loader；失败重跑沿用 ON control 导致 OFF 断言失败。修正测试准备顺序、使用既有 loader、每次重置私有 control，再完整重跑 formal test通过。没有改产品 Policy、选择校验、Runtime 或旧 R3 测试断言。[tests-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/tests-result.json)、[security-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/security-result.json)、[browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/browser-result.json)。

## 24. Migration / Baseline Regression

新增 `202609140006_agent_run_reconciliation.sql`，SHA256 `6014fdee722b967e5264bd827d13f1e45448269f496d8d58c9a1e2ce4528e53a`。前六份 hash 未变；manifest只追加新项；baseline SQL/449 ledger 未改。

最新只读生产 schema snapshot 创建两个 network-disabled owned clones：target upgrade 与 baseline fresh，各按140000→140006七步 preflight→apply→对象验证→ledger。每步核hash/ledger并存 catalog diff，最终449+7=456；before/after15类 schema 都完全等价。

新 migration 的 fault injection 在最后 COMMIT 前 `SELECT 1/0`：前六步已成功，140006 DDL全部回滚、ledger仍455、不登记新版本、后续步骤0。不是只在首份旧迁移测试失败。Full Supabase 最终运行相同新 SQL；bootstrap初版scan时钟表达式在 Auth/setup 前于隔离环境重新安装最终版，最终双路径 rehearsal 和全套实际 RPC 测试均针对归档 SHA。无生产 apply。[migration-rehearsal-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/migration-rehearsal-result.json)。

## 25. Production Build

原始源码完整 `next build --webpack`：PASS，91.27s，Build ID `T45ZN3yOYh5w194F5gq8o`；1376个制品文件。生产公开 Supabase build配置来自只读实际启动配置，没有复制 server secrets。候选在 fixture instrumentation 前冻结。

- Artifact digest：`fef96b47e2a3d8829b6d487e7984c4ae7f990db53e9bb4f5da074606b53f1263`。
- Tar archive SHA256：`058088bf645b65881fb43a712955e3e1f525e3436b77a2f3c60e8c17993fb790`。
- Definition digest：`4b6299be0d5fcb33b9bdc10e8c35ac894905cfbf55540522e8628380e2ff3d8c`，未改。
- 1303项 src/public/config 输入摘要及7份迁移、rollout source版本、reconciler版本、运维脚本hash都在新 manifest。

原始归档单独解包，在 loopback/禁止外连环境启动，OFF POST404；325个 client chunks 没有新 reconcile RPC/合同符号。smoke目录已删除。功能 Full Supabase 测试用另一份78.81s构建的 instrumented副本，不声称它与候选字节相同。新候选仅私有固定归档，无生产部署。[candidate-build-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/candidate-build-result.json)、[candidate-smoke-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/candidate-smoke-result.json)、[release-candidate-manifest.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/release-candidate-manifest.json)。

## 26. Security Review

检查通过：SQL无可拼接查询输入、无任意终态/理由参数；固定search_path、只授予server execute；显式tenant；行锁内重判；CAS失败无写；terminal不可回退；无模型/Tool/教学调用；只写两个基础设施表；消息完整性由事务保护；无公共Next维护route；client bundle不含新维护能力。

报告/evidence/新脚本针对私有 staging key/JWT/password、生产runtime credential values做精确匹配扫描，未命中；不保存 raw logs/headers/cookies。环境变量/配置只显示名称或OFF/EMPTY状态。命令错误只输出RECONCILE_FAILED，不回显server stderr。[privacy-scan.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/privacy-scan.json)。

限制明确：持有 infrastructure DB credential 的 operator 本身是特权主体，tenant参数不能替代凭证发放/人员审批；首版不提供独立每tenant operator role。wrong-tenant runId静态过滤与实测均有效，普通业务角色不能调用。

## 27. Production Safety

开始/结束 catalog 完全一致，ledger449、Agenttables0；Production Writes=0（本任务未发生产写操作，不代表其他外部操作者绝无写入）。Migration NOT APPLIED、Feature OFF、三名单EMPTY、live Provider0、真实用户 Agent requests0。

生产 `uply-first-enable` 仍原 PID1176676、online、fork_mode、kill_timeout15000；配置文件hash不变。未改 `.env`/PM2/Tailscale/真实课程/Provider policy。schema-only read用于隔离克隆，不执行真实 Auth seed 或业务数据复制。[production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/production-safety.json)。

## 28. Staging Cleanup

本轮独有6个 Supabase containers、1个network、2个volumes全部删除；私有stack目录及其keys/Auth fixture/logs已删除，owned resources=0，Next43137停止。新建1D/1E两份测试副本与原始artifact smoke副本均已清理；旧线程的其他临时目录未批量删除。仅保留固定私有R3A release归档与不含credential的审计metadata。[cleanup-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/cleanup-result.json)、[auxiliary-cleanup.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/auxiliary-cleanup.json)。

## 29. Tests

主要可重复入口：[README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md)。新增 DB assertions 使用真实 Full Supabase SQL，会话竞争使用独立连接而非 Promise 内存状态；新增权限用真实 JWT/PostgREST；强杀使用真实 Next production进程及 fixture HTTP/SSE Provider adapter。

本轮验证明细见 [tests-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/tests-result.json)：1135广泛PASS、199显式opt-inPASS、8blackboardPASS；7baseline纯单测PASS+3需单独集成的SKIP、4stagingguardPASS；实际七步双路径集成另PASS；138既有JWT+27新增JWT拒绝+37DB断言PASS。测试套件有重叠，不累计成虚假的独立总数；所有live Provider opt-in保持关闭。

全项目 `tsc --noEmit --incremental false` PASS；新增mjs scoped ESLint PASS；Python AST检查PASS；最终git diff/hash/新增文件范围核查见 [workspace-verification.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/workspace-verification.json)。

## 30. Gate Matrix

| Gate | Name | Status | Evidence |
|---|---|---|---|
| G-R3A-1 | Orphan Failure Reproduced | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-2 | Reconciliation Eligibility Contract | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-3 | Atomic Reconcile RPC | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-4 | Service-only Reconcile Permission | PASS | [reconcile-permissions-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-permissions-result.json) |
| G-R3A-5 | Deadline Orphan → Failed | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-6 | Cancelled Orphan → Cancelled | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-7 | Completed Immutable | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-8 | Failed/Cancelled Immutable | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-9 | Reconcile Idempotent | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-10 | Concurrent Reconciler Race | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-11 | Live Worker vs Reconciler Race | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-12 | Late Completion Rejected | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-13 | Strong Kill Scenario Closure | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-14 | Active Runs Become Zero | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-15 | No New Provider After Kill | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-16 | No New Tool After Kill | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-17 | Teaching Domain Zero Writes | PASS | [side-effects-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/side-effects-result.json) |
| G-R3A-18 | Owner GET Shows Terminal State | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-19 | UI Recovery Regression | PASS | [strong-kill-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/strong-kill-result.json) |
| G-R3A-20 | Operator Active Query | PASS | [operator-reconcile-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/operator-reconcile-result.json) |
| G-R3A-21 | Operator Reconcile Visibility | PASS | [operator-reconcile-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/operator-reconcile-result.json) |
| G-R3A-22 | Batch Bounded | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-23 | Tenant Isolation | PASS | [reconcile-database-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/reconcile-database-result.json) |
| G-R3A-24 | Normal Deadline Regression | PASS | [browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/browser-result.json) |
| G-R3A-25 | Normal Cancel Regression | PASS | [browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/browser-result.json) |
| G-R3A-26 | RLS Regression | PASS | [security-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/security-result.json) |
| G-R3A-27 | Agent E2E Regression | PASS | [browser-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/browser-result.json) |
| G-R3A-28 | Classroom Regression | PASS | [tests-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/tests-result.json) |
| G-R3A-29 | Baseline / Migration Regression | PASS | [migration-rehearsal-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/migration-rehearsal-result.json) |
| G-R3A-30 | Production Build | PASS | [candidate-build-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/candidate-build-result.json) |
| G-R3A-31 | Client / Secret Boundary | PASS | [privacy-scan.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/privacy-scan.json) |
| G-R3A-32 | Production Ledger Unchanged | PASS | [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/production-safety.json) |
| G-R3A-33 | Production Writes Zero | PASS | [production-safety.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/production-safety.json) |
| G-R3A-34 | Staging Cleanup | PASS | [cleanup-result.json](/home/yangzhen/projects/my-lms-system/docs/evidence/teaching-agent-stage-1f-r3a/cleanup-result.json) |

34/34 PASS，critical集合3/4/5/6/7/9/11/12/13/14/15/16/17/23/24/25/26/32/33全部PASS。PASS范围是本报告给出的隔离技术/运维证据，不包含生产部署或自动常驻sweeper。

## 31. Architecture Deviations

| 选择 | 原因 / 限制 |
|---|---|
| cancel后仍等待deadline+6s | 无真实heartbeat/worker ownership可证明提前死亡；采用保守终态资格 |
| 没有新graceful signal handler | Next已有listener drain；添加global listener可能与框架生命周期竞争，SIGKILL仍跳过它；采用独立DB维护+operator步骤 |
| 一次性SQL/CLI，无常驻daemon/cron | 本阶段只交付正确、受限、可显式调用合同；eventually terminal以维护调用最终发生为前提 |
| 不补造usage/final answer | executor死亡无法证明用量或输出完整性；保持缺失事实 |
| reconcileError在operator receipt | 失败事务不能提交自己的error记录；需后续operator日志持久保存策略 |
| 原始build与fixturebuild分离 | 原制品public-config固定，功能测试需要localAuth和Providerfixture；边界明确 |

没有通过重试Provider、绕过Tool证据、改RLS/Prompt/Skills/Persona、扩张真实课程权限来关闭本故障。

## 32. Remaining R3 Blockers

| 独立阻断 | 现状 |
|---|---|
| Real Pilot Candidate /真实课程覆盖 | 仍0；本轮未做真实authoring/publish/unlock，不能据合成课宣称可Pilot |
| Actual Tailscale stream/Origin/compression/disconnect | 仍BLOCKED，未改binding |
| Provider Policy Approval | 仍BLOCKED，未发live请求，不以技术通过代替组织批准 |
| 单lesson范围、名单、值守与selection耗时/缺usage策略 | R3所列运维事项仍需落实 |
| 周期性reconciler运维安排 | 未安装生产scheduler；本轮证明显式operator执行的闭环，未来需确定执行主体/时机 |

R3“15秒强杀留下孤儿Run”技术阻断本轮已关闭。后续仍须保持featureOFF，任何生产动作另行授权。

## 33. R3 Readiness Re-evaluation

**G-R3-21 Drain Procedure：PASS（新评估）；R3整体Production Pilot：NO-GO / BLOCKED；Stage1G：NOT READY。**

历史R3的FAIL不篡改，本报告提供新合同、新migration、新candidate及同场景闭环证据。R3A的GO不自动提升其他Gate，也不自动批准production migration/enable。原R3candidate已被本轮candidate替代；后续release必须使用本轮7份增量和对应输入hash，不能继续引用原6份manifest称为最新。

## 34. Final Recommendation

R3A达到定向目标：独立基础设施在固定deadline之后安全、幂等、可审计地完成孤儿终态；DB锁/CAS保护已完成答案，迟到执行器不可翻转终态；真实15秒强杀两例都收敛，active0、Provider/Tool新增0、Teachingwrites0；正常Runtime/RLS/课堂回归保持通过。

使用新的operator drain与新candidate作为后续审查输入。**停止在R3A；Production Pilot仍由真实课程、实际Tailscale、Providerpolicy等Gate阻断。** 未部署、未迁移生产、未修改PM2/Tailscale、未开启Feature、未进入Stage1G。
