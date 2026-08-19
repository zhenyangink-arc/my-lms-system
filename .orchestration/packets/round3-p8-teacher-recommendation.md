# Packet 8：老师推荐（Round 3 / Packet 8）

## 背景
Packet 7 已交付学生周计划表 `student_weekly_learning_plans`（含 RLS，验证方式：临时 PostgreSQL 数据库真实执行迁移+查询 `pg_policies`/`pg_class`/权限视图）。本 Packet 沿用同样的验证深度要求，新增老师推荐表。

方案原文（只读参考）：
- 表结构建议：`docs/student-home-daily-learning-aggregation-roadmap.md` 第753-782行（17.1）。
- 角色权限：第227-237行（6.3老师可以做什么/不能做什么）。
- 老师发起推荐的场景：第855-870行（19.2）。

## 目标
1. **新增迁移**：建表 `teacher_learning_recommendations`，字段参考路线图第757-775行：
   `id`、`tenant_id`、`student_app_id`、`teacher_id`、`target_scope`、`class_id`、`student_id`、`source_type`、`source_id`、`title`、`reason`、`is_required`、`starts_at`、`due_at`、`status`、`created_at`、`updated_at`。
   - 约束：班级推荐和个人推荐二选一（`class_id`/`student_id` 互斥，用 CHECK 约束）。
   - 来源必须属于对应应用（`source_type`/`source_id` 与 `student_app_id` 的一致性，用 CHECK 或触发器/RLS 中体现，选择你认为最合适的方式并说明理由）。
   - **RLS 硬性要求**：
     - 老师只能创建/查看/撤回自己负责班级或学生的推荐（参考 Packet 7 的角色判定函数模式，例如 `private.current_user_can_view_student_activity` 之类的现有辅助函数，如果有教师侧对应的权限判定函数就复用，没有就参考其写法新建一个风格一致的）。
     - 学生只能读取指向自己的推荐，不能读取其他学生的。
     - 机构之间完全隔离（`tenant_id` 过滤）。
     - 已开始的必做推荐（`is_required = true` 且已到 `starts_at`）不能被物理删除（用 RLS 禁止 DELETE，或允许 DELETE 但加 USING 条件排除已开始的必做项——选一种并在报告中说明依据）。
2. **新增 Server Action**：老师创建推荐（表单只要求：班级或学生、推荐内容、推荐原因、必做或建议、截止时间——路线图第864-870行）、老师撤回未开始的推荐。放在 `src/features/` 下新目录，参考 Packet 7 的目录组织方式（`actions.ts` + `api/service.ts` + `types.ts`）。
3. **深链**：推荐必须能生成真实业务深链，复用 `src/features/student-home-learning/routes.ts`（Packet 1 交付）现有的深链构造器，不要重新拼路由字符串。如果 `routes.ts` 目前没有覆盖 `source_type: "teacher_recommendation"` 对应的场景，可以扩展 `routes.ts`（新增导出函数即可，不要破坏已有导出签名和已通过的测试）。

## 非目标 / 禁止事项
- 本 Packet 不要求把老师推荐接入学生首页的聚合展示（那是后续跨 Packet 整合的工作，如果你评估后觉得顺手可以做一个最小接入，但不是硬性要求，做不完必须在报告中说明，不能因此让已有验收标准 FAIL）。
- 不允许没有 RLS 的表上线。
- 不修改 Round 1/2 任何已交付文件的核心逻辑（`routes.ts` 允许新增导出，不允许删除/修改已有导出的行为）。
- 不修改学生自己的周计划表或 Packet 7 逻辑。

## 验收标准
1. 迁移能真实应用到 PostgreSQL 数据库（参考 Packet 7 的验证方式：临时数据库 + `psql -v ON_ERROR_STOP=1` 真实执行，然后查询 `pg_policies`/`pg_class.relrowsecurity`/权限视图确认）。
2. RLS 已启用，且老师/学生/机构隔离逻辑用真实查询验证过（不是只贴 SQL 没跑过）。
3. 班级/个人二选一的约束真实生效（可以用一条会违反约束的 INSERT 语句实际测试报错）。
4. 已开始的必做推荐不能被物理删除（用真实 DELETE 语句测试，确认被拒绝或被 RLS 过滤）。
5. Server Action 里老师身份来自服务端会话，不接受客户端传入的 teacher_id 覆盖。
6. `npm run typecheck`、`npm run lint`、`npm run build` 通过。
7. Round 1/2/7 已有测试仍然全部通过。
8. `git status --porcelain` 改动范围符合预期。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs tests/student-weekly-learning-plan.test.mjs`
- 迁移的真实数据库验证（参考 Packet 7 方式），包括至少一条会被约束/RLS 拒绝的语句实测。
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。**RLS 和约束必须用真实数据库验证过，不能只静态检查 SQL 语法。**

## 交付报告格式
1. 改动/新增文件列表。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出（包括被拒绝语句的实际报错信息）。
4. RLS 策略和约束的具体内容摘要。
5. 已知假设、遗留问题或范围偏差说明。
