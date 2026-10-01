# D5 + D7 评审汇总（数学判题与数学试卷层）

> 状态：评审材料，未执行到任何真实库，未进入 `supabase/migrations`（2026-10-01，分支 `feat/subject-slots`）。
> 细节与演练结果见 [README.md](./README.md)；方案选择见 [../math-question-bank-options.md](../math-question-bank-options.md)；判题器见 [../question-type-grader-slot-design.md](../question-type-grader-slot-design.md) §6.2。
> 评审流程：AGENTS.md 第 6 节 Architecture Gate（数据库 Schema、RLS、公共函数、跨模块）。

## 1. 要解决的问题

数学题要走现有的“试卷 → 机构布置作业 → 学生提交 → 判分 → 批改 → 发布成绩”流程，并由可信的服务端判题器给出建议得分。现有流程不能承载：

- 题型只有 5 种，没有“表达式作答”“数值作答”；
- 试卷发布与布置要求每道题的能力分类属于听说读写词汇语法，作业类型试卷还要求六项齐全；
- 没有存放判题规格与机器判题结果的地方。

决定（用户，2026-10-01）：数学题由**平台负责人**出，在试卷层直接出题，不建独立题库（方案 E）。

## 2. 改动清单

### D5（`D5-math-grading-storage.*.sql`）

| 类别 | 对象 | 说明 |
|---|---|---|
| 约束 | `learning_assignment_questions.question_type` | 新增 `math.expression`、`math.numeric` |
| 新表 | `math_question_specs` | 作业题的判题规格；仅有该应用“管理内容”能力的教职人员可读，学生不可读；结构校验 `private.math_spec_is_valid()` |
| 新表 | `learning_submission_machine_grades` | 机器判题结果，只增不改（重判新增修订号）；仅有“管理测评”能力的教职人员可读，学生不可读 |
| 触发器 | `math_question_specs` 的类型 / 冻结触发器 | 判题器与题型必须匹配；已有学生作答后不能改或删规格；题目被删除时（外键级联）放行。**不提供写入函数**：规格只由 D7 试卷层复制而来 |
| 新函数 | `record_learning_machine_grade()` | **仅 service_role**；校验题型、判题器、得分不超满分、提交处于待批改阶段 |

### D7（`D7-math-paper-layer.*.sql`，依赖 D5）

| 类别 | 对象 | 说明 |
|---|---|---|
| 约束 | `assessment_paper_questions.question_type` | 同上 |
| 新表 | `math_paper_question_specs` | 试卷题的判题规格；仅 `current_user_can_manage_assessment_papers()` 可读；试卷非草稿后不可新增 / 修改 / 删除（试卷或题目被删除时的级联放行） |
| 新函数 | `create_math_paper()` | 仅平台负责人 / 标准题库管理员；创建**草稿**；容器必须是数学应用中已发布的章节测试；发布仍走 `change_assessment_paper_status` |
| 新函数 | `private.assessment_paper_uses_language_skills()` | 数学应用的试卷返回 false |
| **替换既有函数（5 个）** | 见下表 | 每处只改指定位置 |

| 被替换的函数 | 改动位置 |
|---|---|
| `private.assessment_paper_release_issues_with_temporary_notice` | 两处加 `and uses_language_skills` 条件（能力分类检查、作业类型“六项齐全”检查）；一处新增“数学题缺少判题规格”问题 |
| `private.validate_assessment_paper_release` | 作业类型分支加同样条件；新增“数学题缺少判题规格”则拒绝 |
| `public.create_learning_assignment_from_paper` | 新增一条 INSERT：复制判题规格到 `math_question_specs` |
| `public.configure_learning_assignment_retake` | 同上（补考试卷） |
| `public.duplicate_assessment_paper` | 新增一条 INSERT：复制判题规格 |

未改：`create_learning_assignment_from_paper_with_unlock` 的三个重载（经上面的函数调用）、提交状态机、`submit_learning_assignment`、`grade_learning_submission`。

## 3. 风险评估

| 风险 | 等级 | 说明与控制 |
|---|---|---|
| 替换韩语也在用的发布校验与布置函数 | **高** | 新条件只对数学应用的试卷为 true 才放行；韩语路径条件不变。控制：韩语回归探针前 / 后 / 回滚后三份输出逐行一致；函数定义差异只在指定位置 |
| 学生读到标准答案 | 中 | 判题规格表与机器判题表都对学生不可读（RLS + 撤销表级授权）；学生仍通过现有路径只在成绩发布后看到作业题与解析。成绩发布后是否向学生展示判定依据未定 |
| 浏览器角色写入判题结果伪造得分 | 中 | `record_learning_machine_grade` 仅 service_role 可执行；机器判题结果仅为**建议**，正式得分仍由教师批改函数写入，状态机不变 |
| 判题规格被篡改影响已作答题 | 低 | 作业题有作答后触发器冻结规格；试卷发布后禁止新增 / 改 / 删规格；浏览器角色对两张规格表都没有写权限，机构教职人员也无法改规格 |
| 回滚 | 低 | 两批都有 down 脚本；已有数学题 / 试卷时需先删除才能收紧约束（脚本头部注明） |
| 与 Codex 迁移冲突 | 中 | 迁移编号需排在 Codex 线之后；D7 替换的函数若被 Codex 迁移同时修改会冲突，正式迁移前要重新取定义对比 |

## 4. 证据（验证库 `~/projects/lms-verify-db`，一次性，未保留执行状态）

- D5：42 项检查全部符合预期（题型约束、权限正反例、10 种畸形规格被拒、浏览器角色直接写规格被拒、重判留痕、状态限制、规格冻结、级联删除不被拦截）；up / down 可重复执行。
- D7 数学：37 项全部 PASS，覆盖创建、发布、复制、机构布置、学生提交、机器判题、教师批改、**补考端到端**，以及缺规格不能发布 / 布置、已发布试卷不能新增规格、草稿试卷级联删除、权限与 9 类畸形输入的负向用例。
- D7 韩语回归：执行前、执行后、回滚后输出一致；5 个被替换函数回滚后与原定义逐字一致，授权不变。
- 判题器本身：`tests/math-grading.test.mjs`、`tests/math-question-types.test.mjs`，15 项通过。

**Gate 自审已发现并修正 5 个问题**（见 README“Gate 自审发现并已修正的问题”）：移除权限过大的规格写入函数、规格冻结改为触发器、修正触发器拦截级联删除、数学题缺规格不能发布、补考端到端补测。

**没有证据的部分（NOT VALIDATED）**：
- 真实云端库的数据与权限（只在验证库演练）；
- 并发场景（重判、同时发布）；
- 数学管理端页面与浏览器流程（尚未实现）；学生作答表单对数学题型的显示（见前端影响）。

## 5. 需要评审者决定

1. 是否同意替换 5 个共用函数的方式（“数学应用不沿用六项分类”的条件判断），还是改为更通用的“学科能力分类”机制（工作量更大）。
2. 成绩发布后是否向学生展示机器判定依据（当前不展示）。
3. 正式迁移的编号与顺序（排在 Codex 线之后），以及 D7 替换的函数在 Codex 迁移里是否也有改动。

## 6. 上线前置与后续

- 先有数学课程、课时和容器章节测试，才能创建数学试卷。
- 学生作答表单与题型标签要补数学题型（现状：未知题型退化为文本输入，占位提示写死“填写韩语答案”，标签为空）。
- `create_math_paper` 只是数据库函数；需要平台负责人用的管理页面与草稿题目编辑入口（黄区）。
- 服务端判题调用 `record_learning_machine_grade` 的进程 / 动作、判题任务表属于后续批次。
- D3（英语场景练习）、D6（已作废）不在本次评审范围。

## 附：D8（草稿整体替换，可选）

`D8-replace-math-paper-draft.*.sql` 只新增一个函数、不改既有函数，风险低，随 D5、D7 一并评审即可，也可以晚于它们单独放行。为共用题目校验，D7 内部抽出了 `private.insert_math_paper_questions()`（评审 D7 时按重构后的版本看）。
