# Changelog

## v3.1 — Visible Worker Dispatch Logging

### 可见调度日志

- Supervisor 每次创建 Worker / Verifier / Architecture Gate 前，必须先在对话中输出可见调度记录。
- 新增四类标准记录：`[SPAWN]`、`[GATE]`、`[VERIFY]`、`[ESCALATE]`。
- 并行创建多个子代理时逐条记录；禁止静默 spawn。
- 记录必须包含实际 `Profile + Model + Effort`；若无法确认则显示 `UNKNOWN`，不得猜测。
- 子代理内部运行名（例如 `/root/...`）不再被视为模型 / effort 证据。
- 新增 `[SPAWN_FAILED]` 用于记录创建失败。
- `TASK_TEMPLATE.md` 增加 Dispatch Record 要求。

### v3 模型路由保持不变

- Root Supervisor：GPT-6 Astra / xhigh。
- 简单任务：Sol low / medium。
- 常规开发：Sol medium / high。
- 复杂但边界明确：Sol xhigh。
- 高不确定性 / 架构 / 安全 / 数据 / 跨模块：Astra medium / high / xhigh。
- 最终兜底：Astra max。


## v3 — Astra Supervisor + Tiered Sol/Astra Routing

### Supervisor

- Root Supervisor 从 `GPT-6.1 Sol / xhigh` 改为 `GPT-6 Astra / xhigh`。
- Supervisor 可以审查实际 diff、关键文件、Contract、架构影响与 Verification 证据。
- Supervisor 仍不默认代替 Worker 做普通实现，也不机械重跑全部测试。

### Worker 路由

- `worker_low`: GPT-6.1 Sol / low
- `worker_medium`: GPT-6.1 Sol / medium
- `worker_high`: GPT-6.1 Sol / high
- `worker_xhigh`: GPT-6.1 Sol / xhigh
- 新增 `worker_astra_medium`: GPT-6 Astra / medium
- 新增 `worker_astra_high`: GPT-6 Astra / high
- 新增 `worker_astra_xhigh`: GPT-6 Astra / xhigh
- `worker_max`: GPT-6 Astra / max

### 路由原则

```text
简单任务 -> Sol low / medium
常规开发 -> Sol medium / high
复杂但边界明确 -> Sol xhigh
复杂 + 高不确定性 / 架构 / 安全 / 数据 / 跨模块 -> Astra medium / high / xhigh
仍无法可靠解决 -> Astra max
```

- 不要求机械逐级升级。
- Supervisor 可根据任务性质直接跳到合适档位。

### Verification / Gate

- Architecture Gate 保留为 Astra xhigh 的独立角色。
- 常规 Verification：Sol high。
- Critical Verification：Astra xhigh。

### 其他

- 移除 Luna Worker 路由。
- Chrome DevTools MCP 与 4-thread multi-agent 配置保留。
