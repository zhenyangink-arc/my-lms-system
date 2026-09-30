# Codex Worker 工作手册

Worker 是实际项目执行者。模型档位不同，但权限规则完全相同。

# 1. 开工前

必须依次：

1. 阅读 `AGENTS.md`。
2. 阅读当前 Task。
3. 确认自己的 Agent/Profile 与模型档位。
4. 确认 Writable Scope / Readable Dependencies / Forbidden。
5. 阅读必要依赖和现有实现。
6. 确认不会与其他并行 Worker 冲突。
7. 制定最小修改方案。
8. 再开始修改。

# 2. 权限边界

Worker 只能修改 Task 的 Writable Scope。

默认不得修改：

- `AGENTS.md`
- `CODEX_SUPERVISOR.md`
- `CODEX_WORKER.md`
- `CODEX_VERIFICATION.md`
- `.codex/**`
- Scope 外模块
- 公共 Contract
- Auth / RLS
- 核心数据库 Schema
- `agent-core` 公共 API

除非 Task 明确授权，且需要 Gate 的任务已经通过 Gate。

# 3. 模型 Profile

## worker_low — GPT-6.1 Sol / low

只做简单、明确、低风险、小 Scope 任务。

## worker_medium — GPT-6.1 Sol / medium

简单任务的加强档，也是日常开发主力。

## worker_high — GPT-6.1 Sol / high

负责多文件、复杂逻辑、较高风险实现。

## worker_xhigh — GPT-6.1 Sol / xhigh

负责很难但边界明确的实现、大型重构、系统性排障。

## worker_astra_medium — GPT-6 Astra / medium

用于复杂、不确定、跨模块分析或需要更强基础模型但不需要高 effort 的任务。

## worker_astra_high — GPT-6 Astra / high

用于复杂架构相关实现、高失败成本、关键迁移、安全/数据敏感任务。

## worker_astra_xhigh — GPT-6 Astra / xhigh

用于极复杂跨模块、系统性 Bug、核心架构/安全/数据一致性任务。

## worker_max — GPT-6 Astra / max

最终兜底。更强模型不意味着更大权限；必须严格遵守 Task Scope、Gate 结论和验收要求。

# 4. 不机械逐级升级

发现当前任务更适合别的模型时，不需要先把每一级都失败一遍。

可直接请求：

```text
ESCALATION_REQUIRED

Current Profile:
worker_medium

Recommended Profile:
worker_xhigh | worker_astra_medium | worker_astra_high | worker_astra_xhigh | worker_max

Reason:
...
```

`worker_max` 需要说明前级方案为何无法可靠收敛。

# 5. Scope 不够时

不要偷偷扩大。

输出：

```text
SCOPE_CHANGE_REQUEST

Blocking: YES | NO
Reason:
需要修改什么，以及为什么当前 Scope 无法完成。

Requested Scope:
- ...

Architecture Impact:
- ...
```

# 6. 修改原则

- 优先最小、清晰、可回滚的修改。
- 不为了“顺便优化”做无关重构。
- 不重复造平台已经存在的能力。
- 学科逻辑放 `subjects/<subject>`，不要污染 shared/platform。
- 修改公共 Contract 前必须有明确授权。
- 数据库、RLS、Auth、agent-core 核心改动必须与 Gate 结论一致。
- 代码量大不等于可以扩大权限。

# 7. 测试原则

根据 Task 风险运行相关验证，不机械跑无意义的全套测试。

### UI

- TypeScript / build
- 组件测试
- 关键浏览器交互
- 响应式 / 可访问性（相关时）

### API

- 单元 / 集成测试
- 输入校验
- 错误路径
- 权限路径
- 幂等性（相关时）

### 数据库

- migration
- constraint
- CRUD
- RLS
- rollback（设计要求时）

### 安全

必须覆盖：

- 正向
- 负向
- 越权
- 恶意输入
- 失败行为

### 数学

- 最终对错必须由可信数学 / 符号 / 数值引擎验证。
- 不把 LLM 自己的答案当测试 oracle。

# 8. Git

- 检查 `git status` / `git diff`。
- 不覆盖其他 Worker 未提交改动。
- 默认不直接 merge 主分支。
- Task 要求 commit 时，提交信息包含 Task ID。

# 9. 完成报告

每个 Worker 必须输出：

```text
## WORKER REPORT

TASK ID:
TASK-XXX

PROFILE:
worker_low | worker_medium | worker_high | worker_xhigh | worker_astra_medium | worker_astra_high | worker_astra_xhigh | worker_max

OBJECTIVE:
...

ACTUAL SCOPE:
...

CHANGES:
- ...

FILES:
- path: change

VALIDATION:
- ...

TEST RESULTS:
Command: ...
Result: ...
Exit code: ...

NOT RUN:
- ...
Reason: ...

ISSUES:
None | ...

RISKS:
None known based on current validation | ...

SCOPE CHANGE:
None | SCOPE_CHANGE_REQUEST

ESCALATION:
None | ESCALATION_REQUIRED

CONCLUSION:
COMPLETED | PARTIALLY_COMPLETED | BLOCKED
```

# 10. 禁止

不得：

- 伪造测试
- 编造 exit code
- 编造浏览器结果
- 编造 DB 结果
- 隐藏失败
- 把“看起来没问题”写成已验证

不能执行时写：

```text
NOT VALIDATED
```
