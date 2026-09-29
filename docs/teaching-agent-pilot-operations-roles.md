# UPLY Teaching Agent — Pilot Operations Roles & Wave1 Checklist

状态：**R4G Primary Operational Acceptance：ACCEPTED BY 杨震；Primary Operator Package：ACCEPTED BY PRIMARY OPERATOR。** R4F Receipt 技术合同 PASS；私有 receipt storage 实测 READY。独立 Backup / Standby、Data / Policy Approver、最终 receipt 保留期限、生产 tenant/维护凭据/窗口及生产执行授权仍未完成。Production execution BLOCKED；Stage 1G NOT READY。Scheduler NONE — MANUAL PILOT SUPERVISION；本阶段未执行生产 reconciler。

## 0. 当前责任人

| 角色 | 当前负责人 | 状态 |
|---|---|---|
| Release Operator | 杨震 | ASSIGNED |
| Pilot Operator | 杨震 | ASSIGNED |
| Incident Operator | 杨震 | ASSIGNED |
| Monitoring Owner | 杨震 | ASSIGNED |
| Teaching Content Owner | 杨震 | ASSIGNED |
| Backup Creation / Restore Operator | 杨震 | ASSIGNED — 仅本次 R4D 新备份创建与隔离恢复验证 |
| Backup / Standby Person | TBD | NOT ASSIGNED |
| Data / Policy Approver | TBD | APPROVAL REQUIRED |





### 当前说明

- 杨震负责当前项目的发布操作、Pilot 操作、异常处理、运行监控和教学内容准备。
- Backup Creation / Restore Operator 已由用户明确指定为杨震；仅授权 R4D 备份创建与隔离恢复验证，不授权 production restore。
- Backup / Standby Person 尚未指定，在正式进入 Stage 1G 前必须指定；不因杨震负责备份执行而自动将其指定为独立备班。
- Data / Policy Approver 尚未指定，DeepSeek Provider 数据政策在正式批准前保持 BLOCKED。
- 当前人员配置状态：PARTIAL。
- 本表不构成 Production Migration、Deploy、Feature Enable 或 Provider Policy 的批准。
- 当前接受记录见 [R4G 报告](teaching-agent-stage-1f-r4g-pilot-operations-acceptance-closure.md) 与 [运维 runbook](teaching-agent-pilot-operations-runbook.md)。R4E/R4F/R4D 历史报告不回写。人员配置整体仍 PARTIAL，不因 Primary Operator 接受而补齐独立备班或政策批准。

### R4G Explicit Operational Acceptance

Acceptance recorded at：**2026-09-15T07:52:37.180731Z**（Asia/Seoul：2026-09-15 16:52:37.180731 +09:00）。依据本阶段用户杨震的明确接受；这是记录时间，不是生产窗口。

| 接受项 | 当前状态 |
|---|---|
| Primary Operator / Monitoring Owner | 杨震 |
| Primary Operational Acceptance | ACCEPTED BY 杨震 |
| Primary Operator Package | ACCEPTED BY PRIMARY OPERATOR |
| Pilot Monitoring Cadence | ACCEPTED — MANUAL EVERY 5 MINUTES；仅 Pilot 活跃窗口 |
| Unknown Commit Handling | ACCEPTED — STOP → NO RETRY → NEW READ-ONLY CONNECTION → READ-ONLY VERIFY → OPERATOR REVIEW |
| Follow-up rule | ACCEPTED；原 UNKNOWN receipt 不可修改，后续 terminal 不倒签 CONFIRMED |
| Manual drain / incident handling | ACCEPTED；最终 ALL ACTIVE = 0，eligible=0 不等于完成；安全异常立即 STOP |
| Private Receipt Storage | ACCEPTED / READY；目录0700、文件0600，原子存储及清理 PASS，禁止进入Git |
| Private Receipt Retention | TBD — FINAL RETENTION PERIOD NOT YET DECIDED；NO AUTOMATIC DELETION，决定前保留 |
| Receipt 复核人 / 交接安排 | TBD；本次未指定独立复核人 |
| Scheduler | NONE — MANUAL PILOT SUPERVISION |
| Backup / Standby Person | TBD — NOT ASSIGNED |
| Independent Standby / single-operator risk | BLOCKED / ACKNOWLEDGED |
| Data / Policy Approver | TBD — APPROVAL REQUIRED |
| Provider Policy | BLOCKED / APPROVAL REQUIRED |
| Production tenant / maintenance credential / execution window | TBD — 未批准 |
| Operational Production Execution | BLOCKED |

本次仅接受 Primary Operator 职责、人工 monitoring、manual drain、incident、UNKNOWN/no-auto-retry 和 receipt 保存规则；**OPERATIONAL ACCEPTANCE != PRODUCTION EXECUTION AUTHORIZATION**。不授权 migration、deploy、production reconciler/cancel、Provider Policy、真实学生开放、broader rollout、Feature ON 或 allowlist 写入。

私有位置：`/home/yangzhen/operations/uply/teaching-agent/receipts/`。Private acceptance 原件只在该 operations root 下的 `acceptance/`，不是数据库 invocation receipt；repo 仅保存脱敏 metadata，见 [storage evidence](evidence/teaching-agent-stage-1f-r4g/receipt-storage.json)。不安装 cron/systemd timer/PM2 scheduled monitoring/Supabase cron/GitHub scheduled workflow，不自动删除 receipt。


## 1. Reconciler 运行模型比较

| 模式 | 优点 | 盲点 | Wave1 决定 |
|---|---|---|---|
| A Deployment drain 手动执行 | 发布/停机前有明确人员及 Gate | 覆盖不了非发布期间的 orphan | 必须保留 |
| B 定期 operator sweep | 小范围 Pilot 可人工核对 receipt 与错误 | 依赖有人值守，不能声称自动保证 | ACCEPTED — 每5分钟人工执行，与逐 Run 检查结合 |
| C scheduler 每 N 分钟 | 稳定自动执行，可减轻值守 | 新 credential/部署/失败告警/owner 边界尚未建立 | 本阶段不安装；不作为已存在能力 |
| D monitoring-triggered | 快速针对异常 | 当前未有完整自动告警/触发链 | 人工收到信号后执行，不宣称已自动化 |

建议 Wave1：**一个获批内部用户、同时最多一个 Run、有人值守的明确时间窗口**。每 Run pre/post check + 发布/停止前显式 drain + 窗口内每 **5 分钟人工 safety sweep**，结束时再扫一次。运行预算为 45s，收敛 eligibility 为持久 deadline+6s；51s 是相对 admission 的近似上界计算，应以每个持久 deadline 为准。

**Accepted Pilot Monitoring Cadence：Every 5 minutes while Pilot window is active。** 杨震已接受此人工值守频率；不是网络/response SLA，也不是自动调度周期。额外触发点：Pilot开始前、每个重要Run后、incident发生时、drain开始与结束、Pilot窗口结束、release切换之前。若只靠周期扫描，发现延迟可能达到 eligibility 后约5分钟及执行时间；Run超期/安全异常立即处置，不等下一次sweep。人员离岗/备班不可用即暂停Pilot，不做全天候承诺。正式15项检查见runbook§5；无法观测写UNKNOWN并HOLD，不能猜0。

## 2. 不改变 R3A 合同的操作步骤

唯一合同 `deadline-terminal-v1`；未来 active 不改、terminal 不改、仅 deadline+6s eligible。deadline 前已有 cancel → cancelled；其余 → failed/DEADLINE_EXCEEDED；不重试模型、不恢复 Agent、不写教学域。

1. Pilot Operator 运行受限 tenant active/monitor 只读查询；每次 Run 前确认前次 terminal、没有未处置 orphan。
2. 正常运行由 Runtime 收尾；异常时 Incident Operator 根据**数据库 deadline**判断 eligibility，不以 PID/“看起来卡住”提前强制终态。
3. 具备另行授权 infrastructure credential 的 Incident/Release Operator，使用现有一次性 [reconcile-command.py](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/reconcile-command.py)（明确 service/tenant，limit=50，最大100）。命令、权限与 drain 顺序见 [README.md](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/README.md)。这里不提供生产 credential 或默认生产目标。
4. 仅 `commitState=CONFIRMED / result=SUCCESS / success=true` 可认定 invocation 成功。UNKNOWN → STOP → NO RETRY → NEW READ-ONLY CONNECTION → READ-ONLY VERIFY → OPERATOR REVIEW；原receipt不改写，后续terminal不能倒签。NOT_COMMITTED仅限明确未dispatch/无提交机会；dispatch后的timeout/断连/SQL拒绝/killed process/坏输出默认UNKNOWN。
5. 每次一个获批tenant，默认50/max100，不global sweep、不自动下一批、不自动retry。下一次操作前Primary Operator重新核receipt、全部active、eligible与production state，再明确执行。最终 **ALL ACTIVE = 0**；future active意味着drain未完成，eligible=0不等于完成。
6. 发布/回滚/停用时，Release Operator 先确保所有 worker 停新 admission，owner GET/cancel 仍可用，逐 Run 等候/取消/收敛，直到 active=0、无新增 Provider/Tool/教学操作才签署 Drain PASS。启动时读取的 OFF 不会因为只编辑 env 而热更新；遵循已审查的 R3A worker/drain 流程。本阶段不实际重启。

角色为普通平台管理员的业务 JWT 不具有此 RPC 执行权；持 infrastructure credential 也不能自动获得所有 tenant 的操作授权。

## 3. 人员职责表（已确认姓名列明，备班、联系方式与窗口待填写）

| 角色 | 负责事项 | 可签署/不可替代 | 姓名、备班、联系方式、窗口 |
|---|---|---|---|
| Release Operator | 候选/迁移/配置核对，scope 冻结复核，获批 Tailscale probe/清理，停新 admission、drain、回滚 | Release 技术 Gate；不能代签数据政策/教学内容 | 杨震；备班、联系方式、窗口待填写 |
| Pilot Operator | 与获批用户现场跑 Wave1，逐 Run/5分钟 sweep，Selection timing、异常登记 | 每次检查记录；不越权用他人 Cookie | 杨震；备班、联系方式、窗口待填写 |
| Incident Operator | orphan/reconcile/error 处置，停止请求通知，受限 DB 运维、事故交接 | terminal/receipt 复核；不能自行扩大用户或 scope | 杨震；备班、联系方式、窗口待填写 |
| Data/Policy Approver | Provider 字段、跨境、合同、告知、保留/训练、撤回批准 | 数据政策批准；不能用测试替代 | 待填写 |
| Teaching Content Owner | 目标/内容/权利审阅，正式 authoring/publish 审核，scope 冻结 | 教学内容与变更决定；不绕 publish 校验 | 杨震；备班、联系方式、窗口待填写 |
| Engineering Owner（协作） | 确认从零 authoring 与目标课堂 UI 缺口、未来任务验收 | 工程路径；本阶段没有实施授权 | 待填写 |

一人兼任仍需明确每项职责/备班和审批边界；本次Primary Operational Acceptance已记录，实际窗口、独立备班、政策签字与内容验收仍是显式blocker。接受人工流程不能代替这些生产前置。

## 4. Wave1 每 Run 检查

查询入口 [operator-run-lookup.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/operator-run-lookup.sql)、[operator-active-runs.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/operator-active-runs.sql)、[operator-monitor.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3/operator-monitor.sql)、[operator-monitor.sql](/home/yangzhen/projects/my-lms-system/scripts/teaching-agent-r3a/operator-monitor.sql)。仅获批 tenant/run；运维日志不复制 Prompt/原句/raw ToolResult/JWT。

| 时点/信号 | 记录与判断 | 异常行动 |
|---|---|---|
| Before run | 目标 lesson/revision/Pin 来源、三名单范围、前次 terminal、active/eligible=0 | scope/revision 不符或已有 orphan 则停止新请求 |
| run status | runId（受限日志）、状态/version、started/ended、deadline | failed/cancelled 记录原因，不自动重跑 |
| tool completed | 必需 Lesson Tool 的 completed、安全审计结果 | 无权威工具结果不能作为成功解释 |
| evidence pass / output pass | 两项验证均通过 | 任一失败即停并交 Incident Operator |
| source present | evidence/source 引用存在，与当前 revision 一致 | 缺失或 stale 则不验收 |
| usage | 按 model.started 的 modelCallId 对账 reported / unknown / 缺失 | model.started 无 usage = **UNKNOWN**，绝不填0 tokens或猜cost |
| duration / terminal reason | 实际 elapsed 和固定安全原因；不能将浏览器离开当 terminal | 超期按 DB deadline+6s eligibility 处置 |
| orphan | active、expiredActive、eligible 分开记录；结束后 active=0 | 受限 reconciler → receipt → 再查全部 active |
| no teaching write | 记录已有只读工具边界/获准审计证据，核查是否触发教学写路径 | 任何意外写入即停止并报告，不就地修改学生数据 |
| model/tool late activity | terminal 后若仍发现新增执行计数/审计事件则异常 | 停 Pilot、保留安全证据 |
| post run | owner GET 与 durable terminal 一致，失败原因、usage 状态、值守人/时间 | 未确认闭环前不开始下一 Run |

教学写入为本 Agent 路径的零写断言，不把整站其他正常活动混为其副作用；不为了监控读取/导出学生全表。未来如现有日志无法证明某项，记 Unknown 并保留 Gate，不虚构已具备观察能力。

## 5. Selection Projection 与 missing usage 手工观察

Selection latency 当前未持久化。Wave1 开始时及内容/版本变化后，人工记录冷/暖页面各 5 个样本：导航开始→目标 action 可用总耗时、Pin 数、错误/超时、lesson/revision 的安全引用。它是页面体验计时，不等于精确 server projector 耗时；只有获得独立 server 计时证据才另填该列。projector 12s 预算、无 Pin/超时需调查；不存在生产 p95 SLA，不拿历史合成约1.86–1.95s当真实基准。

Missing usage 可能由强杀或 Provider 无 usage 引起：逐 model.started 对账；事件无对应 usage 时单独 Missing/UNKNOWN，累计缺失调用数；不把 known token 合计称全部成本。新一轮前由 Pilot Operator 确认，重复缺失/不可解释的对账问题交 Incident Operator，必要时暂停并通知政策/费用责任方。

## 6. Wave1 启动/停止记录模板

批准窗口与独立备班：待填写，已确认角色见§0；目标 lesson/version：待填写；single eligible scope 证明：未完成；Provider policy approval reference：未取得；Tailscale：R4B Streaming / Origin / Disconnect PASS，Compression / Buffering PARTIAL，不能视为全部通过。

每次记录：timestamp、operator role、受限 run ref、status、tool/evidence/output/source、usage known/unknown/missing、duration/reason、active/eligible、reconcile receipt/error、教学写入观察结论、下一步。离场交接必须有 active=0、无未处理 receipt 错误、明确 OFF/新 admission 停止状态。任何范围漂移、数据边界异常、错误解释、buffering/Origin 失败、无法收敛或政策撤回均停止新请求并按 R3A drain 处理。
