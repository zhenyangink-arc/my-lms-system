目标：为"韩国语巩固中心"新增两张数据表：`chapter_practice_units`（章节巩固包）与
`chapter_practice_blocks`（巩固内容块），作为后续功能的数据基础。仅建表，不接前端、不接业务逻辑。

背景文档：docs/korean-practice-center-integration-roadmap.md 第11.1、11.2节（字段定义在文档里，
你先读文档再动手，不要向我复述文档内容）。

必须遵循的约束（已冻结，不要重新设计）：
- `chapter_practice_units` 关联真实课程结构（course_chapters），而不是旧的 chapter_tests。
- 同一课程章节 + 同一 version 只能有一个 practice_unit（唯一约束）。
- status 使用文档建议的状态机：未生成/草稿/待检查/已发布/需更新/已停用（英文小写 slug 即可，
  自行决定但需在迁移注释或 check constraint 中体现允许值）。
- `chapter_practice_blocks` 通过 practice_unit_id 关联到 unit，block_type 使用文档给出的
  content_payload 数据形态自行判断（jsonb 等），source_type/source_id 用于指向已有的词汇/语法/
  练习/听力等来源表。
- 两表都要有合理的 RLS：草稿只有平台负责人可读写；已发布内容学生可读；机构/老师按已有的
  机构隔离规则读取。请先查看本项目现有课程相关表（courses/lessons/course_chapters）和任意一张
  已有学生可读表的 RLS 写法，复用同样的租户隔离/角色判断模式，不要发明新的权限模型。
- 迁移文件命名、目录位置、SQL 风格必须和本项目现有迁移保持一致（自己去找现有迁移目录）。

不要做的事（non-goals）：
- 不要动 chapter_tests、student_review_items、student_chapter_practice_progress 等其他表（本轮不建）。
- 不要修改任何前端代码、API route、Server Action。
- 不要生成或迁移任何历史数据。
- 不要执行 db push/deploy 到远程环境，除非项目本身的验证命令就是本地验证（如有本地 supabase/pg
  容器用于跑迁移测试，可以用它验证语法，但不要影响生产/远程数据库)。

验收标准：
- 新迁移文件语法正确，可通过项目现成的迁移校验/lint 命令跑通（自己在项目里找,例如
  package.json 里的 db:xxx / supabase 相关脚本；如果项目没有可本地执行的迁移校验命令，
  至少用 `supabase migration list` 或等价的静态检查确认新迁移文件被正确识别，并说明用的是
  哪条命令）。
- 两表字段覆盖文档 11.1、11.2 列出的字段（允许合理调整字段类型，但不能少字段、不能偏离约束）。
- RLS 策略与现有同类表模式一致，需在报告中指出参考了哪张表的 RLS 写法。

请按结构化报告格式回复：变更文件列表、每条验收标准 PASS/FAIL/BLOCKED、实际执行的验证命令与
输出、任何假设或风险。
