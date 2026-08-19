# Packet 3：课程、章节巩固、专项训练和错题聚合（Round 1 / Packet 3）

## 背景
Packet 1 建立了统一类型/枚举/深链/状态骨架（`src/features/student-home-learning/{api/types.ts,routes.ts,status.ts,priority.ts}`）。
Packet 2 已交付作业与考试的聚合源：`src/features/student-home-learning/api/assignment-exam-source.ts` 和 `assignment-exam-mapper.ts`，可作为文件组织方式的参考范例（数据源查询与映射器分离）。

方案原文（只读参考）：
- 数据来源与推荐条件：`docs/student-home-daily-learning-aggregation-roadmap.md` 第290-331行（7.2继续课程、7.3章节巩固、7.4专项训练、7.5错题复习）。
- 状态映射：同文件第442-463行（9.2课程、9.3章节巩固、9.4错题复习）。
- 去重规则：同文件第501-510行（10.4）。

## 目标
新增以下聚合源文件（放在 `src/features/student-home-learning/api/` 目录，命名参考 Packet 2 的 `*-source.ts` / `*-mapper.ts` 风格）：

1. **继续课程**：找到学生最近有效学习位置（最近课程/课时/教材章节/最后活动位置），生成 `sourceType: "course"` 的任务，`href` 必须指向"最后有效位置"而非课程首页。
2. **章节巩固**：聚合未完成/未达标的章节巩固，`sourceType: "chapter_practice"`。
3. **专项训练**：根据能力数据生成候选（能力低于门槛/近期练习不足/连续失分），`sourceType: "specialized_practice"`。
4. **错题复习**：按章节或能力聚合未掌握错题（不按单题铺开），`sourceType: "review"`。零错题时**不生成**任务。

## 关键要求

1. **先定位现有业务逻辑，不要重新发明规则。** 参考：
   - `lesson_progress`（课程/课时进度，学生字段是 `user_id` 不是 `student_id`，Packet 0 已确认）。
   - `course_ebook_progress`（教材章节进度，通过 `test_slug` 关联，不直接存 `courseId`/`courseChapterId`，需要解析关系）。
   - `src/features/chapter-practice/student/progress-service.ts`（章节巩固进度服务，对应 `student_chapter_practice_progress` 表，注意该表不存 `student_app_id`，需经 `practice_unit_id` 解析应用归属）。
   - `src/app/dashboard/toolbox/[skill]/page-content.tsx` 及 `toolbox_practice_sessions` 相关能力数据（专项训练）。
   - `src/features/student-review-center/service.ts` 和 `types.ts`（错题复习，对应 `student_review_items`）。
   - 自行搜索这些模块里已有的"未完成"、"未掌握"、"能力低于门槛"等判定逻辑并复用，不要凭空定义新阈值；如果现有代码没有明确阈值，在报告中说明你采用的合理默认值及依据。
2. **去重逻辑**：同一章节不能同时产生多个"继续学习"入口；未开放章节不推荐训练；已完成任务不进入结果；错题为零不生成任务。可以在这4个源各自内部去重，也可以额外提供一个 `dedupeHomeLearningTasks(tasks: HomeLearningTask[])` 工具函数放在 `api/` 目录下统一处理跨源重复（例如同一 sourceId 出现两次）。
3. **只读聚合，不写库，不改判定规则。**
4. **必须复用 Packet 1 的 `routes.ts` 深链构造器和 `status.ts`/`priority.ts` 类型**，不要重新定义。
5. **不引入装饰性英文标签字段**（eyebrow/typeLabel等），`reason` 字段必须是有具体依据的自然语言说明（参考路线图第536-543行的示例风格），不要用内部规则编号或英文标签。

## 非目标 / 禁止事项
- 不新增页面、不新增路由、不新增数据库表或迁移。
- 不修改 `progress-service.ts`、`student-review-center/service.ts`、toolbox 相关现有业务文件。
- 不推荐未开放的章节或未发布的巩固内容。

## 验收标准
1. 继续课程的 `href` 指向真实"最后有效位置"，不是课程首页占位。
2. 章节巩固推荐符合路线图第306-312行条件之一（教材完成未巩固/巩固未完成/正确率低于掌握线/老师指定/对应章节错题较多——第一版没有老师推荐数据源可以跳过"老师指定"分支，但要在报告中说明）。
3. 专项训练候选有明确依据（能力数据来源），不是随机生成。
4. 错题复习按章节或能力聚合，不按单题；错题数为零时不产生任务。
5. 未开放章节不出现在任何推荐里。
6. 已完成任务不重复出现在"未完成"聚合结果里。
7. 所有 `href` 来自 Packet 1 的 `routes.ts` 深链构造器。
8. 编写不依赖真实数据库连接的单元测试（放在 `tests/`，沿用 `node --experimental-strip-types --test` 方式，参考 Packet 2 的 `tests/student-home-assignment-exam-source.test.mjs` 写法），用 fixture 数据验证：继续课程定位到正确位置、章节巩固状态映射、专项训练门槛判断、错题为零不产生任务、去重逻辑生效。
9. `npm run typecheck` 通过；`npm run lint` 对新文件无报错。
10. `git status --porcelain` 只显示新增文件，没有意外修改现有文件。

## 验证要求
实现完成后自己运行：
- `npm run typecheck`
- `npm run lint`
- `node --experimental-strip-types --test tests/<你新增的测试文件>.test.mjs`
- `git status --porcelain --untracked-files=all`

如果失败，自行修复后重新验证，直到全部通过。不要放宽断言、不要跳过用例。

## 交付报告格式
1. 改动/新增文件列表（含引用的现有业务逻辑源文件+行号）。
2. 每条验收标准 PASS/FAIL/BLOCKED。
3. 实际运行的验证命令、退出码、关键输出（测试用例数量和通过数量）。
4. 已知假设、遗留问题或范围偏差说明（尤其是专项训练门槛值、章节巩固掌握线等你采用的具体数值和依据）。
