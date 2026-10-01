# 数学题库与试卷：D4 方案选项

> 状态：只读核对 + 选项分析，未改任何代码与数据库（2026-10-01，分支 `feat/subject-slots`）。
> 依据：验证库 `~/projects/lms-verify-db` 中的表、约束、触发器与函数定义，以及 `src` 中的调用点。
> 关联：[题型与判题器插槽设计](./question-type-grader-slot-design.md)、[数据库依赖分析](./db-subject-unweld-dependency-analysis.md)、[数据库草稿 D5](./db-drafts/README.md)。

## 1. 应用实际的出题路径

```
chapter_tests（“题组容器”，必须挂课时，插入时自动生成六项作业计划）
  └─ chapter_test_questions（标准题库）
        └─ assessment_papers（标准试卷，source_test_id 必填）
              └─ assessment_paper_questions（+ assessment_paper_question_keys）
                    └─ create_learning_assignment_from_paper_with_unlock（paper-actions.ts 调用）
                          └─ learning_assignments / learning_assignment_questions（学生作答的就是它）
```

`create_learning_assignment`（自由出题）在 `src` 中没有任何调用，不属于这条路径（D6 因此作废）。

## 2. 数学题在这条路径上的障碍

| 环节 | 现状 | 对数学的影响 |
|---|---|---|
| 标准题库 `chapter_test_questions` | `save_standard_question` 只允许**四选一**（正好 4 个选项）；`difficulty` 只有 foundation / medium；必须选“电子书目录来源”（STEP 01–08）；表约束只放行 4 种题型 | 表达式题、数值题**放不进去**；数学选择题可以放，但要填电子书目录来源这类韩语教材字段 |
| 题组容器 `chapter_tests` | `lesson_id` 必填；插入触发器 `ensure_homework_plan_for_new_course_test` 生成六项作业计划；题库变更触发 `sync_chapter_homework_questions`（按六项技能同步作业题） | 用它做数学容器会带出与数学无关的作业计划与同步逻辑，行为需逐个核对 |
| 标准试卷 `assessment_papers` | `source_test_id` 必填；`sync_student_app_ownership` 从它推导应用；发布校验里有 `EX-K1-FIN-*` 韩语期末规则（只对该编号生效）；题号 `question_code` 约束为 `^[VGLSRW][0-9]{2}$` | 数学试卷的应用归属依赖章节测试；题号规则不适用数学（可留空） |
| 试卷题 `assessment_paper_questions` | 题型约束 5 种；`auto_graded` 由触发器按题型 / 技能计算；答案在 `assessment_paper_question_keys` | 要新增数学题型并带判题规格 |
| 作业题 `learning_assignment_questions` | D5 已放开题型约束；`language_skill` 约束六项或空串 | 数学题 `language_skill` 用空串即可 |
| 另一套题库 `exam_bank_*` / `homework_bank_*` | 列名带 `_ko`，技能限听说读写，题型 6 种；验证库中 0 行，`src` 中无引用 | 韩语专用，不用于数学 |

## 3. 方案

### 方案 A：数学自建题库与试卷（独立表）

数学模块新增自己的题库与试卷表（例如 `math_bank_questions`、`math_papers`、`math_paper_questions`），应用归属直接写 `student_app_id`，不依赖章节测试。布置作业时由新的数学专用函数把试卷题复制成 `learning_assignment_questions`（并复制判题规格），之后沿用现有的提交 → 判分 → 批改 → 发布流程。

- 优点：不碰韩语的任何表与触发器；数学可自由设计字段（难度、知识点、章节、题组等）。
- 缺点：试卷“发布、版本、冻结”这套机制要在数学侧重做一遍，和现有标准试卷有重复；工作量最大。

### 方案 B：数学借用章节测试做容器，并放宽现有标准题库

放宽 `chapter_test_questions` 与 `assessment_paper_questions` 的题型约束、`save_standard_question` 的“只允许四选一”，并调整作业计划同步等触发器。

- 优点：试卷机制完全复用。
- 缺点：改的全是韩语在用的核心表和函数，每处都要证明韩语行为不变；题库里混入电子书目录来源等不适用字段；风险最高。**不建议。**

### 方案 C：解耦标准试卷与章节测试

让 `assessment_papers.source_test_id` 可空，另设“学科容器”或直接 `student_app_id` 显式写入，同时改应用归属触发器和相关外键。

- 优点：试卷机制复用，长期最干净。
- 缺点：改核心表和公共触发器，波及韩语；需要完整的迁移与回滚演练和 Codex 协调。

### 方案 D：数学先走“直接布置”，不建题库（推荐作为第一阶段）

新增数学专用函数（例如 `create_math_assignment`）：教职人员选择数学课程，直接录入题目与判题规格，函数写入 `learning_assignments`、`learning_assignment_questions` 与 `math_question_specs`（D5），之后沿用现有流程。需要题库、试卷版本化时，再升级为方案 A。

- 优点：改动最小，只依赖 D5；不碰韩语；能最快跑通“出题 → 学生作答 → 机器判题 → 教师确认”整条链路。
- 缺点：题目不能跨作业复用；没有试卷版本与冻结；老师每次重新录入。

## 4. 建议

1. **第一阶段：方案 D。**先把判题链路跑通，题库设计等真实的数学内容出现后再定。
2. **第二阶段（需要复用时）：方案 A**，在 D 的基础上加数学自己的题库表，布置函数改为从试卷复制。
3. **不做方案 B**；方案 C 仅在以后确认多个学科都需要统一试卷机制时再评估。

## 5. 方案 D 需要你先决定的事

1. **谁出数学题**：平台负责人 / 平台题库管理员，还是机构教职人员？这决定权限判断：按应用的“管理内容”能力，还是标准题库管理员（`can_manage_standard_question_bank`）。
2. **数学作业挂在哪**：课程都是平台级，作业的 `course_id` 要指向平台课程；需要核对作业与平台课程的关联方式（`create_learning_assignment_from_paper_with_unlock` 如何处理 `p_course_id`，是我下一步要读的）。
3. **作业的应用归属**：作业靠课程推导应用；不带课程的数学作业需要显式写入应用，需确认触发器允许。
4. **是否第一阶段就要选择题**：数学选择题可以直接用现有的 `single_choice` 流程（作业题层已支持），不依赖 D5。
