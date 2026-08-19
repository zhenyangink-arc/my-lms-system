# Packet 7：学生周计划（Round 3 / Packet 7）

## 背景
Round 1/2 已交付统一任务聚合（`src/features/student-home-learning/`）、门户首页摘要（`/{space}/page.tsx`）、韩国语首页任务区（`DashboardHomePage.tsx` 等）、完成后刷新（`api/refresh.ts`）。本 Packet 是第一个引入新数据库表的任务，风险等级更高，务必严格遵守 RLS 和多租户隔离。

方案原文（只读参考）：
- 表结构建议：`docs/student-home-daily-learning-aggregation-roadmap.md` 第784-804行（17.2）。
- 角色权限：第239-256行（6.4学生可以设置个人周学习目标）。
- 时间边界：第822-837行（18节，周边界按 `Asia/Seoul`）。

## 目标
1. **新增迁移**：在 `supabase/migrations/` 下新增迁移文件（文件名遵循仓库现有命名规则，自行查看最新几个迁移文件的命名格式），建表 `student_weekly_learning_plans`：
   - 字段参考路线图第788-798行：`tenant_id`、`student_id`、`student_app_id`、`week_start_date`、`target_days`、`target_minutes`、`preferred_days`、`created_at`、`updated_at`。
   - 唯一约束：`tenant_id + student_id + student_app_id + week_start_date`（第800-804行）。
   - **必须启用 RLS**，策略：学生只能读写自己的计划；教师/机构/平台角色的可见性按仓库现有的角色权限模式设计（参考仓库里其他"学生自管理数据"表的 RLS 写法，例如 `student_review_items`、`student_chapter_practice_progress` 等表的迁移文件，保持风格一致，不要自创一套新模式）。
   - `week_start_date` 必须按 `Asia/Seoul` 时区计算周边界，在报告中说明你的计算方式。
2. **新增 Server Action / Route**：学生设置/查看本周学习目标（学习天数、学习分钟目标）。放在合适的 `src/features/` 或现有学生功能目录下，遵循仓库现有 server action 约定。
3. **完成率计算**：结合 Packet 4/5 已有的学习时长/完成数据（如 `lesson_progress`、`course_ebook_progress` 等），计算"本周目标完成率"。可以先做成一个纯函数 + 一个读取组合函数，不强制要求本 Packet 就把它接入首页 UI（UI 接入可以简单加一个可选展示区块，如果时间/复杂度允许就做，做不完要在报告里明确说明留给后续 Packet）。
4. 保留历史周计划（不做物理删除/覆盖，新的一周是新记录）。

## 非目标 / 禁止事项
- 不修改 Round 1/2 已交付文件的核心逻辑（如需要新增极小的可选展示区块，不能破坏已通过的验收标准和测试）。
- 不允许跨学生读取彼此的周计划。
- 不允许没有 RLS 的表上线。
- 不修改判题、成绩、其他业务表结构。

## 验收标准
1. 迁移文件语法正确、可独立应用（用你能用的方式验证，例如项目里是否有本地 Supabase/Postgres 校验脚本，或至少用 `psql`/其他 SQL 解析工具验证语法；如果没有可用的本地数据库，至少要静态检查 SQL 语法正确，并在报告中说明用了什么验证手段）。
2. 表启用 RLS，且策略只允许学生管理自己的记录（贴出关键策略 SQL 片段或文件行号）。
3. 唯一约束存在，防止同一学生同一应用同一周出现重复计划。
4. 周边界计算使用 `Asia/Seoul` 时区，且有清晰依据（贴出关键代码位置）。
5. Server Action 只能操作调用者自己的学生身份对应的数据（不接受客户端传入任意 student_id 覆盖）。
6. 历史周计划不会被物理删除或覆盖。
7. `npm run typecheck`、`npm run lint`、`npm run build` 通过。
8. Round 1/2 已有测试仍然全部通过。
9. `git status --porcelain` 改动范围符合预期（新增迁移 + 新增 server action/服务文件，不应有对 Round1/2 核心逻辑文件的破坏性重写）。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:navigation`
- `node --experimental-strip-types --test tests/student-home-assignment-exam-source.test.mjs tests/student-home-course-practice-review-source.test.mjs`
- 对新迁移文件做你能做到的最严格语法/结构验证，并在报告中如实说明验证深度（有没有真正连接数据库跑迁移）。
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。**新表必须有 RLS，这是硬性红线，不能因为"暂时先不做"而跳过。**

## 交付报告格式
1. 改动/新增文件列表。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出。
4. RLS 策略的具体内容摘要（这项必须详细说明，不能只说"已添加RLS"）。
5. 已知假设、遗留问题或范围偏差说明（尤其是"完成率是否接入UI"这一项）。
