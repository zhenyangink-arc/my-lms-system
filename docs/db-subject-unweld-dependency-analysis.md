# 数据库拆焊点依赖分析

> 日期：2026-09-30（分支 `feat/subject-slots`）
> 性质：只读分析。查询本机 Supabase（已应用 410 个迁移，全部在只读事务中执行），并审阅仓库中尚未应用到本机的 51 个迁移。没有修改数据库、迁移或代码。
> 关联：[共享平台 + 学科模块架构](./shared-platform-subject-modules-architecture.md) 第 6 节中的数据库遗留项。

## 1. 结论速览

| 对象 | 原以为 | 分析后 | 建议 |
|---|---|---|---|
| 章节测试表 `chapter_tests` | 需要把 `korean_title` 改为可空、slug 改为应用内唯一 | slug 被 9 个函数、1 个外键、1 个唯一约束当作全局标识；`korean_title` 没有“非空字符串”约束 | **英语不需要改表结构**：slug 加学科前缀，`korean_title` 填空字符串。数学另行决定 |
| `capture_toolbox_review_item` | 写死韩语 | 韩语只是兜底默认值，而来源列不允许为空，兜底永远不会触发 | 可删除兜底，风险极低 |
| `enforce_chapter_test_learning_prerequisites` | 写死韩语 | 学生“章节测试”作答流程的触发器，本身就是韩语专属功能 | 保留为韩语规则 |
| `record_ebook_progress` | 写死韩语 | 韩语电子书进度，调用方是韩语课时操作 | 保留为韩语功能 |
| `save_conversation_practice_scenario` | 写死韩语 | 新建会话场景一律归韩语 | 英语会话练习启用时增加应用参数 |
| `korean_course` 会员开关 | 全部要改 | 平台级 4 处：课时页准入、课时操作、课时资料下载（代码）与课时进度写入触发器；其余属于韩语专属功能 | 平台增加“按应用的完整课程访问”策略；韩语功能继续用 `korean_course` |
| 结课评估 `evaluate_student_course_completion` | — | 按 `course_key = 'korean-level-one'` 计算，是韩语课程专属 | 英语结课另行设计 |

## 2. 章节测试表

### 2.1 结构与约束

- 主键 `id`；**`slug` 全局唯一**（`course_tests_slug_key`）；`korean_title text NOT NULL`（无非空字符串检查）；`course_key text NOT NULL`（自由文本）；`lesson_id` 必填（`NOT VALID` 检查）；`student_app_id` 由触发器从课时推导。
- 旧名视图 `course_tests` 依赖该表。

### 2.2 依赖方

| 类型 | 数量 | 说明 |
|---|---|---|
| 引用它的外键 | 13 张表 | 作答、题目、错题复核、标准试卷（`assessment_papers.source_test_id`）、作业计划、两套题库、教材章节、课程章节、工具箱练习；**`course_ebook_progress.test_slug` 引用的是 `slug`** |
| 触发器 | 3 个 | 新建时自动生成作业计划、标题同步、应用归属同步 |
| RLS 策略 | 4 条 | 策略名称把它称为“标准题组”，由标准题库管理员维护 |
| 引用它的函数 | 18 个 | 其中 **9 个按 slug 查找**（作答校验、学习前置、智能教材完成同步、应用归属、结课评估、教材章节发布、电子书进度、成绩复核等） |
| 以 `test_slug` 文本关联的表 | 4 张 | 作答、电子书进度（外键 + `UNIQUE(tenant_id, student_id, test_slug)`）、电子书阅读片段、学习时长 |

### 2.3 分析

1. **slug 必须保持全局唯一。**改成应用内唯一会让电子书进度的外键失效，并让 9 个按 slug 查找的函数在出现同名 slug 时返回多行。改造成本高且没有必要。
2. **英语无需改表结构。**约定英语、数学章节测试的 slug 使用学科前缀（例如 `english-cet4-01`），`korean_title` 填空字符串（现有作业计划函数已按空字符串处理）。
3. **“章节测试”的学生作答流程是韩语专属。**作答触发器会拒绝非韩语测试，要求 `korean_course`，并要求先读完本章电子书或智能教材节点。英语、数学如需测验，走平台的作业 / 考试（`learning_assignments` + `submit_learning_assignment`），不走章节测试作答。
4. **标准试卷仍以章节测试为“题组容器”。**`assessment_papers.source_test_id` 必填。英语可按第 2 条约定创建题组容器；新建时触发器会自动生成“听说读写词汇语法”作业计划，对英语适用，对数学不适用。
5. **数学的处理另行决定**：要么同样用章节测试作题组容器并调整作业计划触发器，要么让标准试卷可以不依赖章节测试。与数学题库、判题器设计一起决定。

## 3. 写死韩语应用的 4 个函数

| 函数 | 挂载 / 调用方 | 实际情况 | 建议 |
|---|---|---|---|
| `private.capture_toolbox_review_item` | `toolbox_practice_attempts` 触发器 | `coalesce(exercise.student_app_id, 韩语)`；`growth_toolbox_exercises.student_app_id` 为 NOT NULL，兜底不会触发 | 删除兜底（可选，低风险） |
| `private.enforce_chapter_test_learning_prerequisites` | `chapter_test_attempts` 触发器 | 韩语章节测试作答的前置规则 | 保留；若以后其他学科也用章节测试作答，再改为学科能力判断 |
| `public.record_ebook_progress` | 韩语课时操作（`[lessonSlug]/actions.ts`，黄区） | 韩语电子书进度 | 保留 |
| `public.save_conversation_practice_scenario` | `conversation-practice/actions.ts` | 新建场景固定归韩语 | 英语会话练习启用时新增 `p_student_app_id`，并用该应用的内容管理权限校验 |

## 4. `korean_course` 会员开关

### 4.1 使用点分类

| 层级 | 位置 | 性质 |
|---|---|---|
| 平台 | 课时页 `hasLessonAccess`（代码，黄区） | 决定学生能否打开非试看课时 |
| 平台 | 课时操作 `[lessonSlug]/actions.ts`（代码，黄区） | 完成课时、核对课时题目答案时的准入 |
| 平台 | 课时资料下载 `api/lesson-resources/[resourceId]/download`（代码） | 决定学生能否下载非试看课时的资料 |
| 平台 | `enforce_student_lesson_progress_permission`（`lesson_progress` 触发器） | 决定学生能否写入课时进度 |

以上 4 处规则一致：分类（或其上级）slug 为 `korean` 时要求 `korean_course`，其他课时只允许免费试看。
| 韩语功能 | `record_ebook_progress`、`submit_course_test`、章节测试前置触发器 | 韩语电子书与章节测试 |
| 韩语功能 | 智能教材加载器与操作、教材音频 / 录音 / 转写与学习 Agent 接口、教学脚本发布检查、金老师准入规则等（代码其余文件） | 韩语智能教材与金老师 |

因此，英语学生当前**只能打开、完成和下载试看课时，也只能写入试看课时的进度**。

### 4.2 建议

- 新增平台策略函数（示意）`private.student_app_full_course_allowed(app_id)` 及其代码侧对应函数，由上述 4 处共同使用，按课程的 `student_app_id` 判断，不再按分类 slug 判断。
- 策略的具体规则取决于收费决定（暂缓）。实现时默认规则与现在的 `korean_course` 相同（vip2 / vip3），以后只改策略、不改结构。
- 韩语专属功能继续使用 `korean_course`，不必改动。

### 4.3 顺带发现（未验证）

`enforce_student_lesson_progress_permission` 用 `profiles.role` 判断是否为教职人员，而平台鉴权代码注释说明租户内真实角色来自 `tenant_memberships`，`profiles.role` 可能是默认的 `student`。机构老师在写入课时进度时是否会被误判，需要单独验证，不属于本次改造范围。

## 5. 与未应用迁移、Codex 线的关系

- 本机库落后仓库 51 个迁移（`202609050001` 到 `202609180002`）。其中**没有任何迁移修改章节测试表结构**，也没有修改上述 4 个函数、`student_feature_allowed` 或结课评估函数。
- 7 个未应用迁移在函数中引用章节测试，涉及智能教材发布、单版本创作、章节发布兼容、教材语法创作、教学运营与原生发布契约，基本属于 Codex 线；`202609140007_teaching_content_skeleton.sql` 用 `korean_course` 约束学习 Agent 画像。
- 结论：数据库改动批次必须排在 Codex 线的迁移之后，迁移编号与顺序需与其发布流程统一，不能在其暂停期间向仓库追加迁移。

## 6. 建议的数据库批次

| 编号 | 内容 | 前置条件 | 风险 |
|---|---|---|---|
| D1 | 删除 `capture_toolbox_review_item` 的韩语兜底 | Codex 迁移之后 | 低 |
| D2 | 平台“按应用的完整课程访问”策略 + 课时进度触发器改造（与课时页同步） | 收费决定；课时页属于黄区，需与 Codex 协调 | 中 |
| D3 | `save_conversation_practice_scenario` 增加应用参数 | 英语 AI 陪练 / 会话练习决定 | 低到中 |
| D4 | 数学题组与标准试卷的关系（容器方案或解耦） | 数学题库与判题器设计 | 中到高 |
| — | 章节测试表结构 | **不需要改**（按 2.3 的约定） | — |

每个批次都应在隔离数据库中验证（可用 `supabase/bootstrap` 基线建立新环境），覆盖 RLS 正反例，并按 AGENTS.md 的 Architecture Gate 流程处理。
