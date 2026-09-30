# 安装 / 合并说明 — v3.1

这是根据你现有项目结构直接升级的版本。

## 覆盖位置

将以下内容放到仓库根目录：

```text
AGENTS.md
CODEX_SUPERVISOR.md
CODEX_WORKER.md
CODEX_VERIFICATION.md
.codex/
```

## v3.1 关键变化

1. Root Supervisor：`GPT-6 Astra / xhigh`。
2. 简单任务：`Sol low / medium`。
3. 常规开发：`Sol medium / high`。
4. 复杂但边界明确的实现：`Sol xhigh`。
5. 高不确定性 / 架构 / 安全 / 数据 / 跨模块：新增 `Astra medium / high / xhigh` Worker。
6. 所有前级方案仍无法可靠解决：`Astra max`。
7. 不再使用 Luna Worker。
8. 保留 Chrome DevTools MCP。
9. 保留 `max_concurrent_threads_per_session = 4`。
10. Supervisor 不再被限制为“只能读 Worker Report”；允许审查 diff、关键代码、Contract 与验证证据，但不抢 Worker 的普通实现，也不机械重复全部验证。
11. 保留独立 Architecture Gate 与 Verification 角色。
12. 新增强制的 `SPAWN / GATE / VERIFY / ESCALATE` 可见调度日志。
13. Supervisor 每次真正创建子代理前，必须先打印实际 `Profile + Model + Effort + Reason`。
14. 并行创建多个 Worker 时必须逐条打印，禁止静默 spawn。
15. 调度日志显示的是**实际选择**，不是推荐值；无法确认时必须写 `UNKNOWN`。


## 原始文件

你本次上传的原始配置已备份在：

```text
_original/
```

## 建议使用顺序

先覆盖：

```text
.codex/config.toml
.codex/agents/
AGENTS.md
CODEX_SUPERVISOR.md
CODEX_WORKER.md
CODEX_VERIFICATION.md
```

然后根据项目实际情况开始使用 `.codex/tasks/TASK_TEMPLATE.md`。
