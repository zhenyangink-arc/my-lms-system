# 题型与判题器插槽设计

> 状态：设计稿，未实施（2026-09-30，分支 `feat/subject-slots`）
> 依据：只读核对本机库（作业、提交、批改相关的表、约束与函数）和作业作答 / 批改界面代码。未修改数据库与代码。
> 关联：[共享平台 + 学科模块架构](./shared-platform-subject-modules-architecture.md)、[EduMath 接入设计](./edumath-integration-design.md)、[数据库依赖分析](./db-subject-unweld-dependency-analysis.md)。

## 1. 要解决的问题

- 数学需要**可信的等价判定**（`2x+2` 与 `2(x+1)` 等价），现有客观题判分只是“规范化后字符串相等”。
- 英语写作需要按评分量规批改，可以借助 AI 给出建议，但不能让 AI 直接给正式成绩。
- 这些都要接进现有的“作业 / 考试 → 提交 → 判分 → 批改 → 发布成绩”流程，**不改变现有状态机和韩语的行为**。

## 2. 现状（只读核对）

| 层 | 现状 |
|---|---|
| 创作层 | 韩语标准题库 `exam_bank_*` / `homework_bank_*`（`_ko` 列名、`language_skill`）；章节测试题 `chapter_test_questions`；工具箱题 `growth_toolbox_questions` |
| 投放层 | `learning_assignment_questions`：`question_type` 仅 5 种（`short_text`、`long_text`、`single_choice`、`file_link`、`audio_recording`），`options jsonb`、`auto_graded`、`language_skill`；答案键 `learning_assignment_question_keys.correct_answer text` |
| 客观判分 | 触发器 `prepare_learning_submission_answer`：`auto_graded` 题按“规范化字符串相等”给分；录音题核销录音证据 |
| 提交状态机 | `submitted_pending_grading` → `objective_graded_pending_manual`（有需人工批改的题）→ `grading_completed` → `grade_released`；另有 `revision_required` |
| 教师批改 | `grade_learning_submission`：**必须为本次提交的每一道题给分**（含客观题，可覆盖），支持单题评语与 `rubric_scores`，完成后进入 `grading_completed` |
| 学生作答界面 | `AssignmentSubmissionForm.tsx` 按题型硬分支；短答题输入提示写死为“填写韩语答案”（平台界面中的韩语焊点） |
| 批改界面 | `SubmissionGradingForm.tsx`：客观题只读汇总，人工题逐题输入分数 |
| 能力维度 | `language_skill` 的约束只允许听说读写词汇语法，成绩中心的六维能力依赖它 |
| 后台任务先例 | PM2 进程 `lms-completion-refresh`（`scripts/process-course-completion-refresh.mjs`）按任务表处理结课资格刷新 |

## 3. 设计原则

1. **创作层按学科，投放与提交层共用。**学科在自己的表里保存题目与判题规格；出题后进入共用的作业 / 试卷 / 提交 / 成绩链路。
2. **正式得分只有三个来源**：数据库精确匹配（现有）、可信服务端判题器（新增）、教师批改（现有）。
3. **AI 只做建议与解释**，其结果标记为“建议”，永远不直接成为正式得分。
4. **不改提交状态机。**新判题方式挂在现有的“待人工批改”阶段。
5. **判题器是确定性的、带版本的纯函数**，结果附带可复核的判定依据。

## 4. 契约

### 4.1 题型登记

题型分两类：

- **平台通用题型**：现有 5 种，由平台界面直接渲染，判分方式不变。
- **学科题型**：带学科前缀，例如 `math.expression`（表达式作答）、`math.numeric`（数值作答，带误差）、`math.steps`（分步作答）、`english.essay`（写作）。

投放表的 `question_type` 约束需要随学科题型逐批扩展（数据库改动，逐项评审），不放开为任意字符串。

学科在服务端登记（示意）：

```ts
// src/features/subjects/<slug>/question-types.server.ts（示意）
export type SubjectQuestionType = {
  key: `${SubjectSlug}.${string}`;
  gradingMode: "exact" | "server" | "manual";
  /** 服务端校验学生作答的形状与长度；不合法直接拒绝提交 */
  parseAnswer: (raw: string) => { ok: true; value: unknown } | { ok: false; message: string };
  /** gradingMode = "server" 时提供：确定性判题 */
  grader?: {
    key: string;       // 例如 "math.expression-equivalence"
    version: string;   // 判题器版本，写入判定依据
    grade: (input: { answer: unknown; spec: unknown; maxPoints: number }) =>
      { verdict: "correct" | "incorrect" | "partial"; points: number; evidence: Record<string, unknown> };
  };
};
```

客户端输入组件单独登记（`src/features/subjects/<slug>/question-inputs.tsx`），平台作答表单遇到学科题型时按题型键加载对应输入组件；平台通用题型仍由平台表单渲染。

### 4.2 判题规格的存放

- 数学、英语的标准答案与判题规格（表达式、变量取值域、容差、评分量规等）结构化程度高，存放在**学科自己的答案表**中（例如 `math_question_keys`），以投放题目 ID 关联。
- 平台的 `learning_assignment_question_keys.correct_answer` 继续服务精确匹配题型，不塞入学科结构。

### 4.3 机器判题结果（平台新表，示意）

`learning_submission_machine_grades`：

| 字段 | 说明 |
|---|---|
| `answer_id` | 对应 `learning_submission_answers`，每题一条（重判覆盖并留痕） |
| `grader_key` / `grader_version` | 判题器与版本 |
| `verdict` | `correct` / `incorrect` / `partial` / `error` |
| `suggested_points` | 建议得分（0 至题目满分） |
| `advisory` | 是否仅为建议（AI 结果恒为 true） |
| `evidence` | 判定依据（规范化表达式、采样点、量规逐项说明等） |
| `graded_at` | 时间 |

- 写入：只允许服务端通过受控 RPC 写入；RPC 校验题型的判题方式、得分范围、提交处于“待人工批改”阶段，浏览器角色不可执行。
- 读取：有该应用“管理测评”能力的员工可读；学生仅在成绩发布后看到判定结论与必要说明。

## 5. 判题流程

### 5.1 作业与考试（第一阶段：机判预填 + 教师确认）

```
学生提交（现有 submit_learning_assignment，不改）
  学科题型在投放时 auto_graded = false
  → 提交进入 objective_graded_pending_manual
数据库触发器登记判题任务（新任务表）
后台判题进程（参照 lms-completion-refresh 的模式）
  1. 用服务端权限读取作答与学科判题规格
  2. 调用学科判题器（超时、输入长度与表达式复杂度上限）
  3. 通过受控 RPC 写入 learning_submission_machine_grades
教师批改界面
  学科题的分数输入框预填建议得分，并展示判定依据
  教师确认或修改后提交（现有 grade_learning_submission，不改）
  → grading_completed → 按现有规则发布成绩
```

判题失败（`verdict = error` 或超时）时不预填，教师照常人工批改；任务可重试。

### 5.2 第二阶段（可选）：机判自动完成

作业设置中可开启“数学客观题自动完成”：当一次提交中所有非精确匹配的题都有非建议性、非错误的机器判定时，由受控 RPC 按现有“无人工题”分支完成状态迁移。该阶段改变成绩产生方式，需要单独评审与负向测试后再开启。

### 5.3 练习（工具箱、巩固中心）

练习需要即时反馈、不需要教师确认：由服务端操作同步调用学科判题器，只返回对错与解释，并按现有练习记录方式保存；不产生正式成绩。

## 6. 数学判题器要求

- 由可信计算完成，LLM 只负责讲题与错因解释。
- 表达式解析采用白名单语法树，禁止 `eval` 或执行任何动态代码；限制长度、嵌套深度、数值范围。
- 等价判定：符号化简对比，或在变量取值域内多点数值采样并按容差比较；可配置单位、有效数字、区间与集合答案。
- 分步题：先判最终答案，步骤判定作为可选的部分得分规则。
- 结果确定且可复核：同一输入与同一判题器版本得到相同结论，依据写入 `evidence`。
- 是否复用 `@edumath/math-core` 的表达式白名单与采样能力，待决定（其定位是仿真引擎，需要确认是否覆盖判题所需的等价判定）。

## 7. 英语写作

- 正式得分沿用现有教师批改与 `rubric_scores`。
- 可选 AI 建议：以 `advisory = true` 写入机器判题结果，展示给教师参考；教师必须逐题确认。
- 把学生作文发送给模型供应商属于数据外发，需要与英语 AI 陪练的定位一起决定，并遵循项目现有的 AI 数据审批要求。

## 8. 能力维度

`language_skill` 只适用于语言类学科。建议：

- 学科清单增加“能力维度”定义（韩语、英语为听说读写词汇语法；数学例如概念、计算、应用、推理）；
- 投放题目增加通用的能力维度字段，由学科清单校验，`language_skill` 保留兼容；
- 成绩中心的能力汇总按学科维度计算。

属于数据库改动，在数学阶段与题型扩展一起进行。

## 9. 顺带发现的焊点

`AssignmentSubmissionForm.tsx` 的短答题输入提示写死“填写韩语答案”，英语学生做作业时也会看到。建议在接入题型插槽时改为由学科提供输入提示（韩语保持原文）。

## 10. 安全与测试

- 学生作答视为不可信输入：服务端 `parseAnswer` 先校验，判题器有超时与复杂度上限。
- 判题 RPC 仅服务端可调用；校验题型判题方式、得分范围、提交状态；浏览器无法写入机器判题结果。
- AI 结果恒为建议，不参与正式得分计算。
- 测试：判题器正反例与边界（等价 / 不等价 / 取值域外 / 超长 / 恶意表达式）、RPC 越权与越界、状态机回归（现有作业与韩语录音题不受影响）、教师批改预填与覆盖。

## 11. 实施顺序与前置条件

| 步骤 | 内容 | 前置条件 |
|---|---|---|
| 1 | 平台题型登记与客户端输入组件分发（不新增题型，先把现有 5 种接入分发机制）；修正“填写韩语答案”提示 | 可较早进行；作答表单需浏览器验证 |
| 2 | 机器判题结果表、判题任务表与受控 RPC | 数据库批次，排在 Codex 线迁移之后 |
| 3 | 后台判题进程；教师批改界面预填与依据展示 | 步骤 2 |
| 4 | 数学题型、答案表与判题器 | `math-core` 复用决定；步骤 2、3 |
| 5 | 英语写作 AI 建议 | 英语 AI 陪练定位决定 |
| 6 | 能力维度按学科 | 数学阶段 |
| 7 | 机判自动完成（可选） | 单独评审 |

## 12. 待决定事项

1. 数学判题器是否复用 `@edumath/math-core`，或在本项目内实现独立的判题引擎。
2. 数学公式的输入与显示方式（公式编辑器、LaTeX 渲染库的选择，以及在 Cloudflare Workers 下的兼容性）。
3. 第二阶段“机判自动完成”是否需要，以及默认是否开启。
4. 英语写作是否引入 AI 建议（与 AI 陪练定位一起决定）。
