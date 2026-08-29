目标：把章节巩固详情页里的学习行为（内容块完成、自我检测结果、听力播放/正确率、字母互动完成）
真正写入数据库表 `student_chapter_practice_progress`，支持刷新不丢失、换设备后进度一致、断线时
本地缓存兜底。这是第三轮第二个任务。

背景文档：docs/korean-practice-center-integration-roadmap.md 第4.3、4.4、9.1、9.2、9.3、15.2节
（先读文档，不要复述给我，直接按其中定义实现）。

已完成的前置依赖（直接复用，不要重新设计）：
- 数据表 `student_chapter_practice_progress`：
  `supabase/migrations/202608190016_student_practice_progress_and_review_items.sql`
  （字段：status/progress_percent/mastery_percent/completed_block_ids/last_block_id/
  correct_count/attempt_count/started_at/last_practiced_at/completed_at，唯一约束
  `tenant_id + student_id + practice_unit_id`）。
- 章节巩固详情页现有交互：
  `src/features/chapter-practice/components/chapter-practice-detail.tsx`、
  `chapter-practice-self-check.tsx`、`listening-block-content.tsx`、
  `src/features/chapter-practice/student/`（目前完成状态只在页面 state/会话内，未持久化，本任务
  要把这些行为接到数据库）。
- `chapter_practice_units.completion_rule`（第一轮已建，管理端可配置，见
  `src/features/chapter-practice/api/management-service.ts`）：本任务读取该规则来判断
  巩固内容完成率、巩固练习正确率是否达标；文档9.2提到的"本章关键错题已完成复习"这一项，因为
  统一错题中心（`student_review_items`）尚未接入学生端（是下一个任务），本任务先按"该项数据源
  暂未接入，跳过此判定条件，不阻塞掌握状态计算"处理，并在报告中说明，留给下一个任务补上。

已冻结的决策：
- 学生完成内容块、提交自我检测、播放/作答听力题时，通过 Server Action 把结果 upsert 到
  `student_chapter_practice_progress`（按 `tenant_id + student_id + practice_unit_id` 唯一键），
  更新 `completed_block_ids`、`correct_count`、`attempt_count`、`progress_percent`、
  `last_practiced_at`、`last_block_id`。
- 掌握状态判断按文档9.2的规则（巩固内容完成率100%、巩固练习正确率达标线取
  `completion_rule` 里配置的值，没配置时用文档给出的示例80%、章节测试达到平台规定分数——
  章节测试分数复用现有 `chapter_tests` 相关的通过判断，不要重新发明）计算 `mastery_percent` 和
  `status`（未开始/巩固中/待加强/已掌握，需要区分于目录页已有的未开放/内容准备中，那两个状态
  不由这张表决定）。
- 目录页和详情页要统一读这张表的口径，不能一个页面用旧的本地状态、另一个页面用数据库状态
  （去看第一、二轮已经写的目录和详情页代码，把它们原来临时使用的判断方式切换为读取这张表，
  不要留两套并行口径）。
- 断线/离线兜底：页面本地仍可以缓存最近一次状态用于断网时展示和体验流畅，但数据库是最终来源；
  网络恢复后要能把本地缓存合并进数据库，且不能用较旧的本地缓存覆盖数据库里更新的记录（比较
  `last_practiced_at`，服务器较新则以服务器为准）。
- 迁移期兼容：如果页面里原来有基于浏览器 `localStorage` 保存的"本章掌握"旧数据，首次为某个
  `practice_unit_id` 在数据库中还没有记录时，可以尝试读取并导入这份本地旧数据作为初始值；一旦
  数据库已有记录，本地旧数据不能再覆盖它。
- 遵守项目文案规范（AGENTS.md）；不引入装饰性英文标签；状态同时用文字和图标。

不要做的事（non-goals）：
- 不实现统一错题中心的写入和读取（下一个任务），本任务只是在掌握规则里留出对应判定的接口/
  占位说明，不需要真的接错题数据。
- 不修改课程巩固目录页对"未开放/内容准备中"状态的判断逻辑（那部分不属于这张表，第一轮已完成，
  不要动）。
- 不修改数据库表结构（如确实需要小的字段补充，先在报告中说明理由，不要静默改表）。
- 不实现老师/机构查看进度的界面（下一轮任务之后的任务）。

验收标准：
- 用真实测试学生账号，在详情页完成内容块、提交自我检测、进行听力作答，验证
  `student_chapter_practice_progress` 表中对应记录被正确创建/更新（用真实数据库查询验证，不能
  只做代码审查）。
- 刷新页面后进度不丢失（用真实浏览器操作验证）。
- 模拟"换设备"（比如清空本地缓存/用不同浏览器上下文，同一账号登录）后进度与数据库记录一致。
- 验证较旧的本地缓存不会覆盖数据库里更新时间更新的记录（构造一个真实的时间戳冲突场景验证）。
- 类型检查/构建/相关自动化测试通过。

请按结构化报告格式回复：变更文件列表、每条验收标准 PASS/FAIL/BLOCKED、实际执行的验证命令与
输出、任何假设或风险、遗留给统一错题中心任务的事项。
