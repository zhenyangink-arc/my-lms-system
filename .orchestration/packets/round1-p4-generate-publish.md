目标：在已有的"巩固中心管理"覆盖矩阵（上一任务新增，见
`src/features/chapter-practice/`）基础上，增加巩固包的生成、编辑、预览、发布操作，让平台负责人
可以从矩阵里为某一章节生成巩固包草稿、编辑内容块、预览、发布新版本。

背景文档：docs/korean-practice-center-integration-roadmap.md 第7.2、7.3、12.2、12.3节
（先读文档，不要复述给我，直接按其中定义实现）。

已完成的前置依赖（直接复用，不要重新设计）：
- `chapter_practice_units` / `chapter_practice_blocks` 表结构见
  `supabase/migrations/202608190015_chapter_practice_content.sql`（已发布版本不可覆盖，只能创建
  新版本，这个约束已经在数据库触发器里强制执行了）。
- 覆盖矩阵只读查询和权限校验见 `src/features/chapter-practice/api/service.ts`、
  `coverage.ts`、路由 `src/app/[space]/dashboard/admin/apps/[appSlug]/practice-center/page.tsx`，
  权限统一走 `requirePlatformOwner()`。

已冻结的决策：
- 生成动作：平台负责人对某章节点击生成，系统从已有权威数据（教材词汇/语法/课文、六项专项练习、
  听力材料、作业、章节测试等，自己去项目里找这些数据的表和查询方式）生成一版
  `chapter_practice_units`（status=draft）及其 `chapter_practice_blocks`
  （block_type 覆盖 overview/vocabulary/grammar/comparison/listening/speaking/reading/writing/
  review/self_check，具体每种取什么来源数据由你判断，缺数据的块可以跳过或标记数据缺失，不要
  编造内容）。生成后必须是 draft，不允许自动发布。
- 编辑能力：调整内容块顺序（sort_order）、启用/停用（is_required 或 status，自行选择字段但要
  和已有 schema 对应）、修改标题和 instructions、调整完成规则（completion_rule）、查看数据缺失
  提示。不需要做富文本编辑器，简单表单级别编辑即可。
- 预览：至少能看到桌面宽度和手机宽度两种预览效果（可以是同一个渲染组件配合视口切换，不需要
  做成独立的学生端渲染器复制品，但外观和信息层级要接近学生端将来使用的效果）。
- 发布：发布前必须执行文档12.2列出的检查项，任何一项不满足要阻止发布并给出明确原因。发布后
  该版本 status 变为 published，`published_at` 写入；已发布内容不可再编辑（数据库触发器已经
  强制这一点），需要修改只能创建新版本（version + 1，旧版本保留）。
- 版本流转遵循文档12.3：draft → pending_review → published → （来源变化后）needs_update →
  创建新版本。
- 权限：全部操作仅平台负责人可执行，复用 `requirePlatformOwner()`，不要发明新权限判断。
- 遵守项目文案规范（AGENTS.md）：不引入装饰性英文标签；状态同时用文字和图标表达。

不要做的事（non-goals）：
- 不实现教材发布自动触发生成/标记需更新（那是下一个任务，教材发布流程本任务不要碰）。
- 不修改学生端任何文件（学生端已经在读 `chapter_practice_units`，本任务发布的内容会自然被学生端
  看到，但你不需要改学生端代码）。
- 不修改数据库表结构；如确实需要新增字段才能实现编辑能力，先在报告里说明原因和最小化的
  ALTER 迁移，不要静默扩表。
- 不做 AI 自动生成音频、口语评分等（文档第17节已排除）。

验收标准：
- 对至少一个真实已发布章节执行"生成 → 编辑 → 预览 → 发布"完整流程，用真实数据库操作验证
  （不能只是静态代码审查），并在报告中给出验证步骤和查询结果。
- 发布前检查能够正确拦截不满足条件的巩固包（构造一个故意缺失必需内容块或来源失效的用例，验证
  发布被拒绝并说明原因）。
- 已发布版本不可被覆盖：尝试直接修改已发布版本应失败（复用数据库触发器行为，用真实操作验证，
  而不是只看触发器代码）。创建新版本的路径必须可用。
- 类型检查/构建/相关自动化测试通过。

请按结构化报告格式回复：变更文件列表、每条验收标准 PASS/FAIL/BLOCKED、实际执行的验证命令与
输出、任何假设或风险。
