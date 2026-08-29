目标：为"统一学习进度"和"统一错题中心"新增两张数据表：`student_chapter_practice_progress`
（学生巩固进度）与 `student_review_items`（统一复习项目）。仅建表，不接前端、不接业务逻辑。

背景文档：docs/korean-practice-center-integration-roadmap.md 第9、10、11.3、11.4节
（先读文档，不要复述给我，直接按其中定义实现）。

已完成的前置依赖（第一、二轮成果，直接复用，不要重新设计）：
- `chapter_practice_units` / `chapter_practice_blocks` 表：
  `supabase/migrations/202608190015_chapter_practice_content.sql`。
- 现有课程树 `courses/lessons/course_chapters`，现有章节测试 `chapter_tests` 及其收藏表
  `chapter_test_question_reviews`（自己去项目里找这张表的实际字段，本任务不改它，只需了解结构
  以便新表字段类型兼容）。

已冻结的决策：
- `student_chapter_practice_progress` 字段覆盖文档11.3列出的内容，唯一约束为
  `tenant_id + student_id + practice_unit_id`。
- `student_review_items` 字段覆盖文档11.4列出的内容，`source_type` 需要能表达文档第10节列出的
  全部来源（章节小测/老师作业/正式章节考试/阶段考试/期中/期末/专项训练/巩固自测/补考/学生主动
  收藏/口语写作老师建议），用 check constraint 或注释列出允许值。
- 两表都要有合理 RLS：学生只能读写自己的记录；老师能读取自己负责学生的记录（去找项目里现有的
  "老师-学生"关系判断方式，比如班级、师生绑定表，复用同样的判断逻辑，不要发明新的师生关系
  模型）；机构负责人能看本机构范围；平台负责人能看全部；机构之间数据隔离。参考本项目已有的
  同类型学生数据表（比如学生进度、学生作答记录相关表）的 RLS 写法。
- 迁移文件命名、目录位置、SQL 风格与本项目现有迁移保持一致。

不要做的事（non-goals）：
- 不要修改 `chapter_practice_units`/`chapter_practice_blocks`/`chapter_tests`/
  `chapter_test_question_reviews` 等已有表结构。
- 不要写任何数据迁移脚本（把旧收藏数据映射进新表是后续任务，本任务只建表）。
- 不要修改任何前端代码、API route、Server Action。
- 不要执行 db push/deploy 到远程环境；本地验证方式参考第一轮 schema 任务的做法（本地事务执行
  后 rollback，或用项目里已有的本地 supabase 校验命令）。

验收标准：
- 新迁移文件语法正确，可通过项目现成的迁移校验命令跑通（自己找命令，报告中写明用的是哪条）。
- 两表字段覆盖文档 11.3、11.4 列出的字段，不能少字段、不能偏离唯一约束。
- RLS 策略与现有同类表模式一致，报告中指出参考了哪张表的 RLS/师生关系判断写法。
- 用真实的本地事务执行验证 DDL/RLS 语法正确（不能只做静态审查），执行后回滚，不留痕迹。

请按结构化报告格式回复：变更文件列表、每条验收标准 PASS/FAIL/BLOCKED、实际执行的验证命令与
输出、任何假设或风险。
