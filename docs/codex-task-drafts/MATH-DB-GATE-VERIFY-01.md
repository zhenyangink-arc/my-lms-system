# TASK（草稿，按 `.codex/tasks/TASK_TEMPLATE.md` 填写）

> 这是**草稿**，放在 `docs/codex-task-drafts/` 而不是 `.codex/tasks/active/`：`.codex/**` 是 Codex 的受保护区域，本分支不写入。Supervisor 认可后自行复制到 `.codex/tasks/active/`。
> 来源：作者自审 Gate 报告 `docs/db-drafts/GATE-REPORT-D5-D7-D8.md`（结论：ALLOW 有条件；**非独立**）。本任务的目的就是补上独立性。

## Identity

```text
TASK ID:
MATH-DB-GATE-VERIFY-01

TITLE:
数学判题与试卷层数据库草稿（D5 + D7 + D8）的独立 Architecture Gate 与独立验证

STATUS:
PROPOSED
```

## Routing

```text
IMPLEMENTATION PROFILE:
worker_astra_high   （仅在 Gate 通过后用于整理正式迁移；本任务的 Gate 与验证阶段不写代码）

ARCHITECT GATE:
REQUIRED

VERIFICATION PROFILE:
verifier_critical

MODEL ROUTING REASON:
数据库迁移 + RLS + 替换 5 个韩语也在用的共用函数 + 公共函数签名；命中 AGENTS.md 第 6 节“数据库 Schema / migration / rollback”“RLS / 多租户隔离”“公共 API / 公共 Type / Contract”。按第 4 节路由属“复杂 + 数据 / 跨模块”，Gate 用 Astra xhigh，验证用 verifier_critical。

DISPATCH RECORD REQUIRED:
YES

EXPECTED DISPATCH FORMAT:
[GATE] math_db_gate -> architect_gate | GPT-6 Astra xhigh | 多租户 RLS + 迁移 + 替换 5 个共用函数 + 公共函数签名
[VERIFY] math_db_verify -> verifier_critical | GPT-6 Astra xhigh
```

## Objective

```text
OBJECTIVE:
由独立的 architect_gate 复核 D5、D7、D8 并给出 ALLOW / REVISE / BLOCK；通过后由 verifier_critical 在新环境重放并独立验证 RLS 与回滚。输出可直接用于整理正式迁移的结论。
```

## Context

```text
WHY:
数学应用需要可信的判题与试卷层。现有判题只做字符串相等，发布校验要求每道题属于听说读写词汇语法六项分类，数学无法通过。

CURRENT BEHAVIOR:
D5、D7、D8 仅存在于分支 feat/subject-slots 的 docs/db-drafts/，未进入 supabase/migrations，未在任何真实库执行；在隔离验证库 ~/projects/lms-verify-db 演练过。作者已自审（非独立）。

DESIRED BEHAVIOR:
独立 Gate 结论 + 独立验证报告；若 ALLOW，则可按 docs/db-drafts/tools/install-migrations.sh 整理为正式迁移（编号排在 Codex 迁移之后）。
```

## Scope

```text
WRITABLE SCOPE:
- （Gate 与验证阶段：无。只产出报告。）
- 若 Gate 判 REVISE：docs/db-drafts/**（修改草稿与测试）

READABLE DEPENDENCIES:
- docs/db-drafts/**（含 GATE-REPORT-D5-D7-D8.md、REVIEW-D5-D7.md、tools/）
- docs/math-question-bank-options.md、docs/math-admin-authoring-design.md、docs/question-type-grader-slot-design.md
- supabase/migrations/**、supabase/bootstrap/**（对照被替换函数与约束名）
- src/features/subjects/math/**、tests/math-*.test.mjs（应用侧如何调用这些函数）

FORBIDDEN:
- supabase/migrations/**（Gate 通过前不得写入）
- 任何真实库、Codex 本机库（端口 543xx）、云端库
- AGENTS.md、CODEX_*.md、.codex/**
- src/features/teaching-agent/**、agent-core、smart-textbook*
```

## Contracts

```text
PUBLIC CONTRACTS:
- 题型键 math.expression / math.numeric；判题器键 math.expression-equivalence / math.numeric
- 判题规格 JSON 结构（见 Gate 报告 §7）
- create_math_paper(text,text,text,uuid,int,numeric,boolean,jsonb)
- replace_math_paper_draft(uuid,text,text,int,numeric,boolean,jsonb)
- record_learning_machine_grade(uuid,text,text,text,numeric,text,jsonb,boolean)，仅 service_role

MAY CHANGE PUBLIC CONTRACT:
YES（仅限 Gate 判 REVISE 时，需 Gate 决定编号引用）
```

## Data / Security Impact

```text
DATABASE IMPACT:
MIGRATION

RLS IMPACT:
YES

AUTH IMPACT:
NO

SECURITY IMPACT:
HIGH
```

## Requirements

1. 阅读 `docs/db-drafts/GATE-REPORT-D5-D7-D8.md` 与 `REVIEW-D5-D7.md`，**独立**重读 D5、D7、D8 的 up / down / test 脚本，不以作者报告的结论为前提。
2. 对照 `supabase/migrations/**` 与 `supabase/bootstrap/**`，核对约束名、被替换的 5 个函数在**目标库当前**的定义；特别是 Codex 未合并的迁移是否也改过这些函数。
3. 重做 RLS 正反例：至少两个租户；平台负责人、机构管理员、老师（有 / 无该应用权限）、学生、匿名；对判题规格表、试卷判题规格表、机器判题结果表的读与写。
4. 评估 §5 的约束重建锁风险与 `NOT VALID` 方案；评估 `private` 函数默认 PUBLIC 执行权限是否需要统一撤销。
5. 评估“数学应用的错题复盘行为”（Gate 报告 §4）是否可接受，或是否需要改 `capture_learning_submission_review_items`。
6. 在新环境（`supabase/bootstrap` 基线 + 全部迁移）重放 D5 → D7 → D8，运行 `docs/db-drafts/tools/rehearse.sh`（只能对名字含 verify 的容器），核对回滚。
7. 评估并发（同时发布、同时批改页自动补判、同时重判）与大数据量下的行为。
8. 输出 Gate 结论（9 项，见 `CODEX_SUPERVISOR.md` 第 4 节）与 Verification Report（按 `CODEX_VERIFICATION.md`）。

## Out of Scope

- 应用层界面改动、EduMath 接入、英语 / 韩语内容。
- 把迁移合并进 main、执行到真实库。
- 判题规格“纠正”流程（见 `docs/math-spec-correction-design.md`，单独评审）。

## Acceptance Criteria

1. Gate 给出明确的 ALLOW / REVISE / BLOCK，并逐条回应 Gate 报告 §5 的三个放行条件。
2. 若 ALLOW：给出可执行的迁移整理步骤与编号建议；若 REVISE：列出必须修改的点，指向具体文件与行。
3. Verification Report 含新环境重放结果、RLS 矩阵（角色 × 对象 × 读 / 写 × 预期 / 实际）、回滚核对。
4. 没有任何对真实库或 Codex 本机库的写入；有证据（命令与输出）。

## Required Validation

```text
TYPECHECK:
NOT_REQUIRED

LINT:
NOT_REQUIRED

UNIT:
REQUIRED   （只点名运行 tests/math-*.test.mjs、subject-*.test.mjs、app-paper-assign.test.mjs、question-inputs.test.mjs；**禁止**通配符与整个 tests 目录——会触发 Codex r7c 测试并写入审计账本）

INTEGRATION:
REQUIRED

E2E / BROWSER:
NOT_REQUIRED

MIGRATION / RLS:
REQUIRED
```

具体命令：

```text
- node --experimental-strip-types --test tests/math-*.test.mjs tests/subject-*.test.mjs tests/app-paper-assign.test.mjs tests/question-inputs.test.mjs
- docs/db-drafts/tools/rehearse.sh      （仅隔离验证库）
- 新环境重放：supabase/bootstrap 基线 + 迁移，再逐批应用 D5、D7、D8 并跑各自 .test.sql
```

## Risk Focus

- D7 替换的 5 个共用函数对韩语路径的影响（韩语回归探针 `D7-korean-regression.probe.sql`）
- 机构 / 学生 / 跨租户对判题规格与机器判题结果的读取
- `record_learning_machine_grade` 的 service_role 边界与 `p_only_if_missing` 的并发语义
- 约束重建锁与迁移排序（Codex 线）
- 数学错题复盘行为

## Parallelism

```text
CAN RUN IN PARALLEL:
NO   （Gate 通过后才进入迁移整理；验证依赖 Gate 结论）

CONFLICTING TASKS:
- 所有会新增 supabase/migrations 的 Codex 任务（编号与函数基线冲突）

WORKTREE:
OPTIONAL   （分支 feat/subject-slots 位于 ../my-lms-system-subjects）
```

## Escalation Rule

沿用 `.codex/tasks/TASK_TEMPLATE.md` 的 Escalation Rule；另：发现 D7 替换的函数在目标库与验证库定义不同，立即上报 `ESCALATION_REQUIRED` 并停止，不要在差异上继续。
