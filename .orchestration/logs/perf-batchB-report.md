PERF-009 已完成，未修改 RLS、租户、backlog、PERF-010，也未 commit/push。

### 改动文件

- [page-content.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx:644)：删除 render 路径中的章节测试/电子书聚合及 `lesson_progress.upsert`，现在只读进度。
- [actions.ts](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/actions.ts:23)：新增幂等 `recordLessonActivityAction`；重新验证登录用户、租户、学生角色、课程权限和解锁状态，并复用 `user_id,lesson_id` 冲突键。
- [LessonActivityBoundary.tsx](/home/yangzhen/projects/my-lms-system/src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/LessonActivityBoundary.tsx:8)：仅在首次 pointer、键盘或滚轮交互时调用 Action；挂载、渲染和预取不调用。
- [lesson-progress-render-purity.test.mjs](/home/yangzhen/projects/my-lms-system/tests/lesson-progress-render-purity.test.mjs:10)：锁定 render 只读、无 mount-time Action、认证用户写入及冲突键契约。

### 验收结果

| # | 结果 | 证据 |
|---|---|---|
| 1 | PASS | `npm run typecheck && npm run lint && npm run test:navigation` exit 0；35/35 tests passed，lint 无本次警告。 |
| 2 | PASS | `npm run build` exit 0；webpack 编译成功、TypeScript 完成、18/18 静态页生成成功。 |
| 3 | PASS | `page-content.tsx` 已无 `lesson_progress.upsert`。真实 GET + hydration 前后，行数、状态、进度及全部时间戳逐字段相同。 |
| 4 | PASS | 真实 wheel 交互命中 `recordLessonActivityAction`；`last_viewed_at` 从 `2026-01-02T03:04:05Z` 更新为 `2026-08-17T09:30:28.404Z`。重复刷新仍不写，第二次交互继续更新同一行。 |
| 5 | PASS | 临时学生 `c4248fba-fa33-409d-85a8-e353960614e7` 挂靠既有 `yuanzhi`；auth/profile/membership/enrollment 创建计数均为 1。`auth.admin.deleteUser` 后 auth not found，8 张相关表计数全部为 0；额外全局残留扫描为 `authUsers=0, profiles=0`。 |
| 6 | PASS | 本任务新增差集仅上述四个相关文件。完整工作树仍显示开始前已经存在的 Batch A 与 orchestration 改动；它们未被本任务触碰。 |

### 写入时机对比

- 修复前：GET、刷新、RSC 导航或预取执行 Server Component 时可能 upsert。
- 修复后：这些路径只执行 SELECT；学生产生 pointer、键盘或滚轮学习交互后才 POST Server Action。
- 重复触发始终使用 `onConflict: "user_id,lesson_id"`，实测行数保持 1。
- `user_id` 来自认证会话，`course_id` 来自数据库 lesson，租户来自当前认证上下文；客户端只能提交 lesson ID。
- 原状态及进度计算保持不变。实测无电子书阅读行时，原公式的 `ebookPercent=0` 仍被保留，因此 seeded 37% 在真实交互后变为 0%，与迁移前逻辑一致。

没有因风险而遗留的 PERF-009 部分。页面挂载时既有的 live-class 查询 Action 仍会运行，但实测不会修改 `lesson_progress`，且不属于本条目。