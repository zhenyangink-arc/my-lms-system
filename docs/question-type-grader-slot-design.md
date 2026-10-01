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
- 复用 `@edumath/math-core` 的表达式层，已决定并实现第一版，见 6.2。

### 6.1 `@edumath/math-core` 评估（只读审阅 EduMath 提交 `16d2e12`，2026-09-30）

**已具备、适合用于判题的能力：**

- **安全的表达式层**：长度 ≤ 200、语法树深度 ≤ 20、节点 ≤ 100；math.js 只用于解析（`mathjs/number`），解析结果经白名单转成封闭的中间表示，任何不认识的节点都拒绝；自研闭包编译器求值，**不使用 `eval`、`Function` 或 math.js 的求值**；求值作用域只读取自身数据属性。附有恶意输入、模糊测试与静态安全测试。
- 支持学生常见写法（如隐式乘法 `2x`）；白名单函数包括三角 / 双曲、`sqrt`、`cbrt`、`abs`、`exp`、`log`（含底数）、取整、`sign`、`min` / `max`、`pow`，常量 `pi`、`e`。
- `toTex()` 生成可交给 KaTeX 渲染的 LaTeX，可用于展示学生答案与标准答案。
- 数值工具：取样、求根、极值、函数特征、二次函数分析，可支持“求顶点 / 零点”类题目。

**判题还缺少的部分：**

- **没有“等价判定”函数**。需要在其编译求值之上实现：在变量取值域内用固定随机种子取多个点，避开无定义点，按绝对 / 相对容差比较，并统一处理 `NaN` 与无穷。
- **只有实数数值求值，没有符号代数**：无法判断“最简分数 / 因式分解 / 展开形式”这类形式要求（其中间表示未对外导出，形式检查需另行实现或由上游导出）；不支持方程、不等式、集合 / 区间、矩阵、复数与单位。
- 包为私有、版本 `0.0.0`、精确依赖 `mathjs 15.2.0`，尚无对外的稳定性约定。

**建议：**

1. **复用 `math-core` 作为数学判题的安全表达式层**（解析、校验、编译、`toTex`），不在本项目另写一套解析器。与仿真使用同一份白名单规范（EduMath 计划书附录 C），学生在仿真与作业中的输入规则一致，也避免维护两套安全边界。
2. **等价判定建议贡献到 `math-core` 上游**（纯数学能力，两边共用），本项目的数学判题器在其上实现题型规则、得分与判定依据；若上游暂不接受，则在 `src/features/subjects/math/grading/` 内实现。
3. 判题器版本号中记录所用 `math-core` 版本，保证判定可复核；依赖需锁定版本（引入方式与嵌入 SDK 一起决定）。
4. 作业与考试的判题放在 Node 后台进程中，不受 Cloudflare Worker 包体积影响；练习即时反馈若在 Worker 中判题，需先测量 `mathjs/number` 带来的包体积。
5. 第一批数学题型限定为**表达式作答**与**数值作答**；方程、集合、形式要求、分步题留待后续。

### 6.2 已实现的第一版（2026-10-01，提交 `52d6eb4`）

复用方式已决定：**固定版本拷贝 math-core 的表达式层**（`src/features/subjects/math/vendor/math-core/`，附来源与文件指纹），并新增 `mathjs` 15.2.0 依赖。判题器在 `src/features/subjects/math/grading/equivalence.ts`，纯函数，不碰数据库：

| 判题器键 | 版本 | 作用 |
|---|---|---|
| `math.expression-equivalence` | 1.0.0 | 变量取值范围内用固定种子取点（默认 16、上限 64），按绝对 / 相对容差比较 |
| `math.numeric` | 1.0.0 | 作答当无变量表达式求值（`1/3`、`0.333`），按容差比较 |

- 返回 `correct` / `incorrect` / `error`（无法判定：`invalid_answer`、`invalid_spec`、`insufficient_valid_points`），`evidence` 含种子、容差、各取点两边的值和首个不符点。`error` 不是答错，调用方提示学生或转人工。
- 一边有定义、一边无定义判错；两边都无定义的点跳过；有效点少于下限（默认 8）则无法判定。
- 尚未做：形式要求（最简、因式分解）、区间 / 集合 / 方程答案、分步题、`partial` 部分得分——都需要上游未导出的中间表示或新规格，留待后续。
- 尚未接入作业流程：题型登记、`question_type` 约束扩展、`learning_submission_machine_grades` 与判题任务表属于数据库批次，随 D1–D4 评审。
- 测试：`tests/math-grading.test.mjs`（10 项，含恶意与超长输入）。
- 包体积（6 节建议 4 的测量，esbuild 单独打包判题器并压缩）：约 169 KB，gzip 后约 50 KB。对 Cloudflare Worker 的体积上限影响很小，练习即时反馈可以在 Worker 内判题；这是单独打包的估算，不含 Next 构建的实际结果。

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

1. 数学判题器是否复用 `@edumath/math-core`：**建议复用其表达式层，等价判定优先贡献到上游**（见 6.1），待与 EduMath 侧确认。
2. 数学公式的输入与显示方式（公式编辑器、LaTeX 渲染库的选择，以及在 Cloudflare Workers 下的兼容性）。
3. 第二阶段“机判自动完成”是否需要，以及默认是否开启。
4. 英语写作是否引入 AI 建议（与 AI 陪练定位一起决定）。
