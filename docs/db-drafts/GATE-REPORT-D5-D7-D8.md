# Architecture Gate 报告：D5 + D7 + D8（数学判题与数学试卷层）

> **性质：作者自审，不是独立审查。** 按用户 2026-10-01 的指示，由写这批草稿的同一个 Claude 会话按 `CODEX_SUPERVISOR.md` 第 4 节的 Gate 输出格式自行审阅。Gate 的设计目的是“独立角色与独立审查上下文”，所以这份报告**不能替代**独立的 Gate（`architect_gate`，Astra xhigh）；它的用途是把风险摆清楚、给独立审查者一个起点。
> 审阅方式：重新通读 D5 的建表、触发器、RLS、授权，并用新的端到端场景去找“下游消费者”的影响（见 §4）。D7、D8 的函数在此前三轮演练、一次自审和一次代码审查中已逐行看过。
> 日期：2026-10-01。验证均在隔离验证库完成，没有碰真实库。

## 1. 结论：ALLOW（有条件）

可以进入“整理为正式迁移”的下一步，**前提是满足 §5 的三个条件**。没有发现必须 REVISE 的设计缺陷；发现的问题都已修掉（见 README“Gate 自审发现并已修正的问题”与代码审查修复），本轮新增核对没有发现新的阻塞项。

## 2. 推荐方案

“方案 E”：平台负责人在**试卷层**直接出数学题，不建独立题库。
- D5：作业层存储（题型约束、判题规格、机器判题结果、仅服务端写入的函数）。
- D7：试卷层（试卷题约束、试卷判题规格、`create_math_paper`、发布校验适配数学、布置 / 补考 / 复制时带上规格）。
- D8：草稿整体替换（只新增一个函数，不改既有函数）。

## 3. 被否决的方案及原因

| 方案 | 否决原因 |
|---|---|
| 数学自建题库与试卷（独立表） | 要重做试卷的发布、版本、冻结机制，工作量大且与现有标准试卷重复 |
| 借用章节测试做容器并放宽现有标准题库的约束 | 改动全是韩语在用的核心表和函数，风险最高 |
| 解耦标准试卷与章节测试 | 改核心表和公共触发器，波及韩语；可在以后多个学科都需要时再评估 |
| 教职人员直接布置（自由出题函数 `create_learning_assignment`） | 该函数只接受本机构课程，且应用代码从不调用它（D6 已作废） |
| 机构教职人员可改作业题判题规格（曾有 `set_math_question_spec`） | 机构能改平台定义的标准答案，权限过大；已移除 |
| 平台跨机构直接纠正规格 | 跨租户写入，破坏隔离 |
| 在 `learning_assignment_questions` 里塞 JSON 判题规格 | 学生可通过现有表的列级读取暴露答案风险，且不利于结构校验与冻结 |

## 4. 影响范围（含本轮新增的端到端核对）

**新增对象**：表 `math_question_specs`、`learning_submission_machine_grades`、`math_paper_question_specs`；函数 `create_math_paper`、`replace_math_paper_draft`、`record_learning_machine_grade`、`private.math_spec_is_valid`、`private.insert_math_paper_questions`、`private.assessment_paper_uses_language_skills`，以及 3 个触发器函数。
**改动既有对象**：2 个题型约束；**替换 5 个函数**（发布校验两个、布置、补考、复制试卷），每处只改指定位置（见 `REVIEW-D5-D7.md`）。

**本轮新增核对（一次回滚的事务里走完整链路）**：

| 下游消费者 | 结果 |
|---|---|
| 教师批改 → 发布成绩（`grade_learning_submission`、`release_learning_submission_grade`） | 通过；提交进入 `grade_released`，得分 5 / 15 一致 |
| 学生视图 `student_learning_submission_answers` | 正常返回 3 行 |
| 学生读取判题规格、机器判题结果、试卷判题规格、标准试卷 | 均为 0 行（RLS 生效） |
| 错题复盘（`capture_learning_submission_review_items`） | **会为答错的数学题生成复盘项**（与其他非自动判分题型一致）。复盘中心没有按题型分支的渲染，按通用方式显示题干与学生答案；“错题重练”只接受自动判分题，数学题会得到“这道题当前不属于可重练错题”的明确提示。**可接受，但属于产品可见的行为，建议评审者知悉** |
| 租户永久删除（`delete_tenant_permanently`） | 先删答案（级联删机器判题）、再删题目（级联删规格），不被新表的 `tenants` 外键阻塞；我在同一事务里实测，租户行删除本身通过。该函数在验证库还会因 `application_access_audit_logs` 的外键失败，**与数学无关**（既有问题，验证库的审计日志在删租户后仍被写入），已记为旁注 |
| 成绩技能画像视图 `student_grade_skill_profiles` | 学生角色无权限读取（既有设计，只由服务端读取）；数学题 `language_skill` 为空串，不进入六项统计 |
| 补考、复制试卷、重复布置 | 补考端到端、复制带规格均已在 D7 测试中验证 |

## 5. 兼容性 / 迁移风险与放行条件

风险：
1. **ALTER TABLE 重写约束**：`learning_assignment_questions`、`assessment_paper_questions` 删除并重建 `question_type` 检查约束，会对全表做一次校验并持有排他锁；表很大时需要选低峰执行，或评审后改用 `NOT VALID` + 分步 `VALIDATE`（事务内锁仍会持有到提交，收益有限）。约束名已与历史迁移 `202608180034` 核对一致。
2. **被替换函数的基线**：D7 替换 5 个共用函数，`tools/original-functions/` 里的“原定义”取自验证库。如果 Codex 未合并的迁移也改过这些函数，直接应用会覆盖对方的改动。
3. **迁移不是幂等的**（`create function` 没有 `or replace`），符合仓库迁移的前向式惯例；重复执行会失败，不会半应用（每个文件在事务内）。
4. **授权**：`private.assessment_paper_uses_language_skills`、`private.math_spec_is_valid` 对 PUBLIC 保留默认执行权限（只返回布尔值 / 无副作用，且 `private` 模式对匿名角色不可见）；`private.insert_math_paper_questions` 已撤销。风险低，评审者可决定是否统一撤销。

**放行条件**：
- (a) 用**目标库**当前的函数定义重新生成并对比 `tools/original-functions/`，有差异先合并差异再继续；
- (b) 迁移编号排在 Codex 线迁移之后，并与其发布流程统一；
- (c) 由独立的 `architect_gate` 复核本报告（尤其 §4 的“错题复盘”行为和 §5 的锁风险），再整理成正式迁移。

## 6. 回滚策略

- 每批都有 `down` 脚本，顺序 D8 → D7 → D5；`tools/rehearse.sh` 自动演练回滚并核对 5 个函数与原定义逐字一致、验证库回到未应用状态（2026-10-01：演练通过）。
- **回滚前提**：已有数学题 / 数学试卷（题型为 `math.*`）时，收紧约束会失败，需先删除这些数据；down 脚本头部已注明。
- 回滚不影响已保存的非数学数据；机器判题结果与判题规格会随表一起删除（是辅助数据，正式得分在 `learning_submission_answers`，不受影响）。

## 7. 必须冻结的 Contract

- 题型键：`math.expression`、`math.numeric`；判题器键：`math.expression-equivalence`、`math.numeric`（版本写入每条机器判题结果）。
- 判题规格 JSON：表达式 `{expected, variables[1..4]{name,min,max}, seed(整数), tolerance?{abs,rel}}`；数值 `{expected(数字), tolerance{abs,rel}}`；结构由 `private.math_spec_is_valid` 校验，TypeScript 侧 `parseExpressionSpec / parseNumericSpec` 同口径。
- RPC 签名：`create_math_paper(text,text,text,uuid,int,numeric,boolean,jsonb)`、`replace_math_paper_draft(uuid,text,text,int,numeric,boolean,jsonb)`、`record_learning_machine_grade(uuid,text,text,text,numeric,text,jsonb,boolean)`（仅 `service_role` 可执行）。
- 数学试卷题的 `skill` 为空串；发布校验对数学应用不要求六项分类；试卷容器必须是数学应用的已发布章节测试。
- 规格冻结规则：作业题有作答后不可改 / 删；试卷发布后不可新增 / 改 / 删。

## 8. 推荐 Worker Profile

迁移整理与基线对比：`worker_astra_high`（数据库迁移、涉及共用函数，按 `AGENTS.md` 路由表属“复杂 + 数据 / 跨模块”）。纯执行 `install-migrations.sh` 与文件整理可用 Sol high。

## 9. 推荐 Verification Profile

`verifier_critical`（RLS + 迁移 + 回滚）。建议验证内容：
1. 在**新环境**（`supabase/bootstrap` 基线 + 全部迁移）重放，而不是只在验证库；
2. 跑 `tools/rehearse.sh` 并复核 D5 测试各行预期；
3. 用至少两个租户、多种角色（平台负责人、机构管理员、老师、学生、匿名）重做 RLS 正反例，特别是学生与跨租户读取判题规格 / 机器判题结果；
4. 在接近生产数据量的库上评估约束重建的锁时间；
5. 并发场景（同时发布 / 同时批改页自动补判）。

## 10. 本报告没有覆盖的

- 没有在真实云端库或接近生产的数据量上运行；
- 并发行为只有设计层面的推理（行锁串行化自动补判）和单元测试，没有压力测试；
- 没有核对 Codex 未合并迁移的实际内容；
- 独立性不足：见开头说明。
