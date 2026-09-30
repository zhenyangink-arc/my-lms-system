# `.codex/` 目录说明

```text
.codex/
├── config.toml
├── agents/
│   ├── worker-low.toml
│   ├── worker-medium.toml
│   ├── worker-high.toml
│   ├── worker-xhigh.toml
│   ├── worker-astra-medium.toml
│   ├── worker-astra-high.toml
│   ├── worker-astra-xhigh.toml
│   ├── worker-max.toml
│   ├── architect-gate.toml
│   ├── verifier-high.toml
│   └── verifier-critical.toml
└── tasks/
    ├── TASK_TEMPLATE.md
    ├── active/
    └── completed/
```

## 固定模型路由

| Agent | Model | Reasoning | 用途 |
|---|---|---|---|
| Root Supervisor | GPT-6 Astra | xhigh | 全局规划、拆 Task、模型路由、最终审核 |
| worker_low | GPT-6.1 Sol | low | 简单、明确、低风险任务 |
| worker_medium | GPT-6.1 Sol | medium | 简单加强档 + 日常主力开发 |
| worker_high | GPT-6.1 Sol | high | 常规复杂、多文件、高风险实现 |
| worker_xhigh | GPT-6.1 Sol | xhigh | 很难但边界明确的深度实现 |
| worker_astra_medium | GPT-6 Astra | medium | 高不确定性、跨模块分析、复杂判断 |
| worker_astra_high | GPT-6 Astra | high | 复杂架构相关实现、关键迁移、安全/数据敏感 |
| worker_astra_xhigh | GPT-6 Astra | xhigh | 极复杂、系统性、核心架构/安全/数据一致性 |
| worker_max | GPT-6 Astra | max | 最终兜底 |
| architect_gate | GPT-6 Astra | xhigh | 独立架构门禁 |
| verifier | GPT-6.1 Sol | high | 常规独立验证 |
| verifier_critical | GPT-6 Astra | xhigh | 高风险关键验证 |

详细流程见根目录：

- `AGENTS.md`
- `CODEX_SUPERVISOR.md`
- `CODEX_WORKER.md`
- `CODEX_VERIFICATION.md`


## v3.1 可见调度日志

Root Supervisor 在创建任何子代理前，必须先按照根目录 `AGENTS.md` 与 `CODEX_SUPERVISOR.md` 输出用户可见的 `[SPAWN]` / `[GATE]` / `[VERIFY]` / `[ESCALATE]` 记录。该日志用于让用户看到实际选择的 profile、model 与 reasoning effort；它不是 Codex IDE 原生系统状态栏。
