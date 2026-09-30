<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Agent Rules

本文件只保存**长期、全局、必须遵守**的规则。Supervisor / Worker / Verification 的详细流程分别放在根目录角色手册中，避免 `AGENTS.md` 过度膨胀。

## 1. 项目架构

本项目采用 **共享平台 + 学科模块（Modular Monolith）**。

### 平台层（共享）

平台层负责真正跨学科复用的能力，例如：

- Auth / 用户 / 租户 / 角色 / 权限
- 课程骨架
- 学习记录、attempt、完成状态、学习时长
- 作业、考试、成绩流程
- 文件与媒体基础设施
- `agent-core` 运行时、预算、审计、Tool / Skill 注册机制
- 通用 UI 与设计系统

### 学科层（隔离）

学科特有能力放在：

```text
src/features/subjects/korean/**
src/features/subjects/math/**
src/features/subjects/english/**
```

包括：

- 学科内容
- 学科题型
- 学科判题 / 评分规则
- 学科专属渲染
- 学科输入方式与学习工具
- 学科 AI Skill / Tool / Prompt

### 依赖方向

```text
app -> features (platform / subjects) -> shared
```

强制规则：

- `shared` 不得反向依赖 `subjects`。
- 一个学科不得深链引用另一个学科内部文件。
- 共享层不得大量出现 `if (subject === "...")`。
- 学科不得建立第二套 Auth / RLS / 租户权限体系。
- 平台只通过公开接口 / 注册机制调用学科能力。
- 学科专属数据可以独立表；共享表优先通过 `subject` 维度区分。

## 2. Codex 角色入口

### Supervisor

当前 root Codex 承担 Supervisor 时，必须先阅读：

- `CODEX_SUPERVISOR.md`

Supervisor 负责：全局理解、影响分析、Task 拆分、模型路由、Scope / Contract 控制、并行调度、架构门禁、最终审核。

### Implementation Worker

被分配实现任务的子代理必须阅读：

- `CODEX_WORKER.md`
- 当前 Task 文件

Worker 只允许在 Task 声明的 Writable Scope 内修改。

### Verification Worker

被分配独立验证任务的子代理必须阅读：

- `CODEX_VERIFICATION.md`
- 当前 Task 文件
- 对应 Worker Report

Verification 默认**只验证，不顺手修实现代码**。

## 3. Worker / Verifier 调度可见性（强制）

Supervisor 每次**创建、重新创建、升级、替换或切换** Worker / Verifier / Gate 前，必须先在当前对话输出一条用户可见的调度记录，然后才能调用子代理。

禁止静默创建子代理。

### 标准可见格式

普通 Worker：

```text
[SPAWN] <task_name> -> <profile> | <model> <effort> | <reason>
```

示例：

```text
[SPAWN] pooler_formal_contract_scope -> worker_high | GPT-6.1 Sol high | 多文件契约检查，需要较强推理
```

使用默认 subagent 时：

```text
[SPAWN] <task_name> -> default | GPT-6.1 Sol medium | 使用项目默认 Worker
```

模型 / 强度升级：

```text
[ESCALATE] <task_name> -> <old_profile:model/effort> => <new_profile:model/effort> | <reason>
```

示例：

```text
[ESCALATE] pooler_fix -> worker_xhigh:GPT-6.1 Sol/xhigh => worker_astra_high:GPT-6 Astra/high | Sol xhigh 未可靠收敛
```

独立验证：

```text
[VERIFY] <task_name> -> <verifier_profile> | <model> <effort>
```

Architecture Gate：

```text
[GATE] <task_name> -> architect_gate | GPT-6 Astra xhigh | <reason>
```

### 强制规则

1. 必须**先打印，再创建**子代理。
2. 一条实际子代理对应一条可见调度记录；并行 3 个 Worker 就打印 3 条。
3. 必须显示实际选择的 `Profile + Model + Effort`，不得只显示推荐值。
4. 不得只写“启动 Worker”而省略模型或推理强度。
5. 如果无法确认最终 Model / Effort，必须写 `UNKNOWN`，不得猜测。
6. Worker 被升级、替换、重新执行时必须再次打印。
7. 子代理内部运行名（如 `/root/xxx`）不是 Profile，也不是模型等级，不能拿它代替调度记录。
8. 用户可见调度记录必须与实际选择的 `.codex` agent profile 一致。
9. 这是一条**对话输出协议**；它不要求、也不能伪装成 Codex IDE 自带系统状态栏信息。

## 4. 固定模型路由原则

本项目采用以下长期策略：

```text
Root Supervisor:
GPT-6 Astra / xhigh

简单任务:
GPT-6.1 Sol / low 或 medium

常规开发:
GPT-6.1 Sol / medium 或 high

复杂但边界明确的实现:
GPT-6.1 Sol / xhigh

复杂 + 高不确定性 / 架构 / 安全 / 数据 / 跨模块:
GPT-6 Astra / medium、high 或 xhigh

前述方案仍无法可靠解决:
GPT-6 Astra / max
```

模型更强不代表权限更大。所有 Worker 仍必须遵守 Task Scope、Contract、Gate 与验证要求。

## 5. Scope 规则

- Worker 不得自行扩大 Writable Scope。
- 必须修改 Scope 外内容才能继续时，停止扩张并提交 `SCOPE_CHANGE_REQUEST` / `ESCALATION_REQUIRED`。
- 未经明确授权，Worker 不得修改：
  - `AGENTS.md`
  - `CODEX_*.md`
  - `.codex/**`
  - 根级构建 / TypeScript / ESLint 核心配置
  - 公共 Contract
  - Auth / RLS
  - 核心数据库 Schema
  - `agent-core` 公共 API
- 机械性关联修改只有在 Task 明确允许时才能跨文件同步执行。

## 6. 数据库 / Auth / RLS / 架构门禁

以下改动默认属于高风险：

- 数据库 Schema / migration / rollback
- RLS / 多租户隔离
- Auth / OAuth / JWT / Launch Token
- 公共 API / 公共 Type / Contract
- `agent-core` runtime 或注册协议
- 跨两个以上模块的大重构
- 安全边界、Sandbox、CSP、postMessage 协议

这些任务必须按 `CODEX_SUPERVISOR.md` 的 **Architecture Gate** 流程处理。

## 7. 数学与 AI 特殊规则

- LLM 不作为最终数学正确性来源。
- 数学题最终“对 / 错”必须由可信计算、数值或符号校验引擎判定；LLM 负责解释、诊断和表达。
- 不直接执行未受控的 AI 生成 JavaScript / HTML / Python 作为可信业务逻辑。
- 优先使用受控 Structured Schema，再交给可信 Renderer / Runtime。

## 8. 学习界面文案与信息层级

- 默认不要生成纯装饰性的英文眉题、栏目标签或技术类型标签，例如 `KOREAN LEVEL ONE · 1A + 1B`、`LEARNING JOURNEY`、`COURSE OUTCOMES`、`READY TO START`、`INTERACTION · SINGLE CHOICE`。
- 智能教材的数据源不得保存 `eyebrow`、`typeLabel`、`interactionLabel` 等装饰性标签字段；渲染器也不得根据活动类型自动拼接英文类型标签。
- 不要为了视觉氛围自行添加全大写英文说明；界面文案使用当前界面的自然语言，外语教学内容除外。
- 学习卡片默认只直接显示简洁标题；补充说明通过标题右侧简洁圆形叹号图标提供。
- 圆圈是叹号图标自身组成部分，不再增加按钮背景圆、外框或装饰底色；提示必须支持 hover、键盘 focus、触屏点击及可访问名称。
- “标题 + 补充说明”必须复用 `@/components/ui/card-title-with-hint`，不得在业务页重复实现。
- 导航和概览只保留定位所需的信息，详细内容放正文或提示。

## 9. 并行原则

只有满足以下条件才并行：

- Task 彼此独立。
- 不写同一文件。
- 不写同一 migration / Schema。
- 不竞争同一可变资源。
- 公共 Contract 已冻结。

否则串行。

## 10. 验证与证据

任何“完成”结论都必须有直接证据。不得伪造：

- 测试结果
- Exit code
- Browser 验证
- 数据库结果
- Worker / Verifier Report

无法验证时明确写：

```text
NOT VALIDATED
```

## 11. Supervisor 审核权限

Supervisor **不是只看 Worker 自述的报告阅读器**。

Supervisor 可以：

- 阅读 Worker Report 与 Verification Report
- 查看 `git diff` / 修改文件列表
- 抽样阅读关键修改
- 检查公共 Contract / 模块边界 / Schema / RLS 影响
- 要求补证据或重新验证

Supervisor 默认不：

- 代替 Worker 完成普通实现
- 为了“确认一下”重复跑所有 Worker 已完成的测试
- 代替独立 Verifier 做整套验收

## 12. Git / Merge

- Worker 可以修改并提交自己的工作，但默认不得直接 merge 主分支。
- 并行任务优先使用独立 worktree；环境不支持时必须保证 Writable Scope 不重叠。
- 最终合并由 Supervisor 流程控制。

## 13. 任务模板

所有正式 Task 使用：

```text
.codex/tasks/TASK_TEMPLATE.md
```

活动 Task 放：

```text
.codex/tasks/active/
```

完成后归档到：

```text
.codex/tasks/completed/
```
