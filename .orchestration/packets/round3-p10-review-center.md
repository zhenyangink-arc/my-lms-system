目标：建立统一错题中心，把学生在各类学习活动中的错题自动归集到
`student_review_items`，并把旧的章节小测收藏数据映射进来。这是第三轮第三个任务。

背景文档：docs/korean-practice-center-integration-roadmap.md 第4.7、9.2、10、15.3节
（先读文档，不要复述给我，直接按其中定义实现）。

已完成的前置依赖（直接复用，不要重新设计）：
- 数据表 `student_review_items`：
  `supabase/migrations/202608190016_student_practice_progress_and_review_items.sql`
  （`source_type` check constraint 已列出11类允许值：chapter_quiz/teacher_homework/
  formal_chapter_exam/stage_exam/midterm_exam/final_exam/specialized_practice/
  practice_self_check/makeup_exam/student_bookmark/teacher_speaking_writing_feedback）。
- 巩固详情页的自我检测和听力作答（上一任务已写入 `student_chapter_practice_progress`，见
  `src/features/chapter-practice/student/progress-service.ts` 等）：答错的题目应作为
  `practice_self_check` 来源写入统一复习项目。
- 旧的章节小测收藏表 `chapter_test_question_reviews`（自己去项目里确认实际字段和数据量）。
- 专项训练（练习工具/六项练习）相关的学生作答记录表（自己在项目里搜索"专项训练"、
  "growth_toolbox" 相关的学生作答/尝试记录表）。
- 老师作业、正式章节考试、阶段考试、期中/期末考试、补考相关的学生作答/批改记录表（自己在项目
  里搜索这些功能现有的数据表和批改结果字段，包括口语写作评分和老师评语字段）。

已冻结的决策：
- 对每种能明确找到数据来源的类型（章节小测、巩固自测、专项训练、老师作业、正式章节考试、
  阶段考试、期中考试、期末考试、补考、口语写作老师建议），实现"学生答错或收到老师改进建议时
  自动写入 `student_review_items`"的逻辑；写入时机可以是学生提交作答/老师完成批改的现有流程
  处追加逻辑（参考第一轮 P5 的做法：只追加，不改变原有流程的返回结构和失败路径，某类来源接入
  失败不能影响原有提交/批改流程本身完成）。
- 如果某个来源类型经过实际排查后确实找不到对应的学生作答数据表或找不到合理的接入点（比如某个
  考试类型目前系统里还没有实现），在报告中明确说明"该来源当前系统未具备可对接的数据，本任务
  未接入"，不要为了凑数编造虚假数据或伪造表结构。这种情况不算验收失败，但必须逐项在报告里说明
  哪些接入了、哪些没有及原因。
- 每条 `student_review_items` 记录必须包含：来源类型、来源任务/试卷版本、原题快照、学生原答案、
  正确答案或评分建议、所属课程和章节、所属能力、错误次数、最近错误时间。口语和写作类型不用
  简单对错，要保存评分标准、老师评语和改进任务（见文档第10节最后一句）。
- 旧收藏迁移（文档15.3）：把 `chapter_test_question_reviews` 里的历史数据映射为
  `source_type = 'student_bookmark'` 的 `student_review_items` 记录（一次性迁移脚本或函数，写清楚
  执行方式），不删除、不修改原表，历史收藏时间和题目关系不能丢失。
- 学生可以在错题复习后标记"重新掌握"（更新 `mastered_at` 和 `status`），需要有明确的操作入口
  （可以是新增的学生端错题复习页面/组件，若已有类似入口可以扩展，不要求做成复杂的独立大页面，
  但必须真实可用）。
- 权限：学生只能读写自己的复习项目，复用 P8 已建立的 RLS，不要绕过。
- 遵守项目文案规范（AGENTS.md）。

不要做的事（non-goals）：
- 不修改 `student_review_items`/`student_chapter_practice_progress` 表结构（如确有必要的最小
  字段补充，先在报告中说明原因）。
- 不做管理端/老师端查看错题的界面（下一个任务）。
- 不重新设计各科目原有的作答、批改、评分流程，只在其"提交/批改完成"节点追加写入逻辑。
- 不删除或修改 `chapter_test_question_reviews` 原表数据。

验收标准：
- 用真实数据验证至少三种来源类型（要求必须包含：巩固自测 practice_self_check、章节小测
  chapter_quiz 或其旧收藏迁移 student_bookmark、以及至少一种老师批改类来源如作业或正式考试）
  能正确写入 `student_review_items`，用真实数据库查询验证（不能只做代码审查）。
- 验证旧收藏数据迁移后能在 `student_review_items` 中查到，且原表数据未被改动。
- 验证学生标记"重新掌握"后记录状态正确更新，用真实交互验证。
- 验证某类来源写入失败（人为构造失败场景）不会影响原有提交/批改流程本身成功完成。
- 类型检查/构建/相关自动化测试通过。

请按结构化报告格式回复：变更文件列表、每条验收标准 PASS/FAIL/BLOCKED、逐来源类型的接入情况
说明（接入/未接入及原因）、实际执行的验证命令与输出、任何假设或风险、遗留给"老师查看进度和
薄弱项"任务的事项。
