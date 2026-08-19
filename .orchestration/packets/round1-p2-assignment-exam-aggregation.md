# Packet 2：作业与考试聚合（Round 1 / Packet 2）

## 背景
Packet 1 已在 `src/features/student-home-learning/` 下建立了 `api/types.ts`（`HomeLearningTask` 类型）、`routes.ts`（深链构造器）、`status.ts`（状态映射函数骨架）、`priority.ts`（任务标识与优先级骨架）。你需要复用这些文件，不要重新定义已有类型/枚举/deeplink 构造器。

方案原文（只读参考，不要整段照抄进代码注释）：
- 数据来源与需要读取的字段：`docs/student-home-daily-learning-aggregation-roadmap.md` 第257-289行（7.1 作业与考试）。
- 状态映射规则：同文件第427-440行（9.1 作业和考试）。
- 优先级规则：同文件第465-489行（10.1/10.2）。

## 目标
新建 `src/features/student-home-learning/api/assignment-exam-source.ts`（或你认为更合适的文件名，但必须放在 `src/features/student-home-learning/api/` 目录下），实现一个函数，输入租户/学生/应用范围参数，输出 `HomeLearningTask[]`（`sourceType` 为 `"assignment"` 或 `"exam"`）。

## 关键要求

1. **先定位现有业务逻辑，不要重新发明判定规则。** 仓库里已有作业/考试的学生端查询与状态判定代码（例如 `src/lib/learning-assignments.ts`、`src/features/student-assignments/` 目录，以及 `supabase/migrations/202607170001_learning_assignments_and_exams.sql`、`202608190011_assignment_submission_state_machine.sql`）。请自行搜索并复用其中的查询条件（已发布、学生目标范围、允许迟交等字段），不要凭空猜测字段名。
2. **只读聚合，不写库、不改判定。** 只做 SELECT 查询和内存映射，不修改任何现有作业/考试/提交/批改代码。
3. **状态映射覆盖：** 锁定(locked)、可开始(available)、进行中(in_progress，存在草稿)、待批改(pending_grading)、完成(completed)、逾期(overdue)。允许迟交时逾期也要能标记"仍可提交"（可以体现在 `HomeLearningTask.status` 仍为 `overdue`，并通过 `reason` 字段说明仍可提交，不要新增字段）。
4. **不泄露未发布成绩、不展示未发布作业/考试。** 这是本 Packet 的红线，务必用真实查询条件过滤，而不是应用层事后判断。
5. **区分作业与正式考试**（含补考）映射到 `sourceType: "assignment"` 或 `"exam"`；具体区分逻辑参考现有代码里作业/考试的类型字段。
6. **必须使用 Packet 1 的 `routes.ts` 深链构造器生成 `href`**，不要自己拼路由字符串。
7. **必须使用 Packet 1 的 `status.ts` / `priority.ts` 里已有的类型和函数签名**，如果发现签名不够用可以扩展，但不要推倒重写。

## 非目标 / 禁止事项
- 不新增页面、不新增路由、不新增数据库表或迁移。
- 不修改现有作业/考试/提交/批改/成绩发布相关的任何现有文件。
- 不引入装饰性英文标签字段（eyebrow/typeLabel等）。

## 验收标准
1. 新函数只查询"已发布"且在学生目标范围内的作业/考试（可引用具体查询条件来源文件+行号证明）。
2. 状态映射结果与来源页面逻辑一致（用具体例子在报告中说明：例如某作业有草稿应映射为 in_progress）。
3. 未发布成绩不出现在返回结果的任何字段中。
4. 所有 `href` 来自 Packet 1 的 `routes.ts`。
5. 无新增路由、无数据库写入、无修改现有业务文件（`git status` 只应显示新增文件）。
6. 编写一个不依赖真实数据库连接的单元测试文件（放在 `tests/` 目录，使用项目现有的 `node --experimental-strip-types --test` 测试方式，参考 `tests/*.test.mjs` 现有写法），用构造的 fixture 数据验证状态映射函数对以下场景给出正确结果：未到开始时间、已开放无草稿、有草稿、已提交待批改、已完成、已逾期禁止提交、已逾期允许迟交。
7. `npm run typecheck` 通过。
8. `npm run lint` 对新文件无报错。
9. 新增的单元测试实际运行通过（真实执行退出码，不是描述）。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `node --experimental-strip-types --test tests/<你新增的测试文件>.test.mjs`
- `git status --porcelain`（确认只有新增文件，没有意外修改现有文件）

如果失败，自行修复后重新验证，直到全部通过。不要放宽断言、不要跳过用例。

## 交付报告格式
1. 改动/新增文件列表（含引用的现有业务逻辑源文件+行号）。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出（包括测试用例数量和通过数量）。
4. 已知假设、遗留问题或范围偏差说明。
