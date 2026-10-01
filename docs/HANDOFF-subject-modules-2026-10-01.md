# 交接总结：学科模块 + 数学（2026-10-01）

> 分支 `feat/subject-slots`（工作树 `../my-lms-system-subjects`），比 `main` 多 75 个提交、248 个文件（+15493 / −1808）。**全部只在本地，没有推送，没有合并，没有改过任何真实库。**
> 本文只是入口；细节在各文档里。待你们决定的事见 [decisions-pending-2026-10-01.md](./decisions-pending-2026-10-01.md)。

## 1. 先看哪里

| 想知道 | 看 |
|---|---|
| 还卡着什么、谁来定 | `docs/decisions-pending-2026-10-01.md`（团队版页面也已发布过一份） |
| 数据库草稿能不能上线 | `docs/db-drafts/README.md`、`REVIEW-D5-D7.md`、`GATE-REPORT-D5-D7-D8.md`（作者自审，**非独立**） |
| 独立 Gate 怎么提 | `docs/codex-task-drafts/MATH-DB-GATE-VERIFY-01.md`（草稿，未放进 `.codex/`） |
| 合并会怎样 | `docs/merge-precheck-2026-10-01.md` |
| 数学出题 / 批改 / 学生端做了什么、每步怎么验证的 | `docs/math-admin-authoring-design.md`（§10–§18 是验证记录） |
| 判题器与题型的设计 | `docs/question-type-grader-slot-design.md`（§6.2） |
| 为什么选“试卷层出题” | `docs/math-question-bank-options.md` |
| 纠正判题规格 | `docs/math-spec-correction-design.md`（设计稿） |

## 2. 做了什么（本次数学线，按功能）

| 功能 | 代码位置 | 数据库依赖 |
|---|---|---|
| 判题器：表达式等价（固定种子取点）+ 数值容差；复用并固定了 EduMath `math-core` 表达式层 | `src/features/subjects/math/grading/`、`math/vendor/math-core/`（含 `SOURCE.md`、文件指纹） | 无 |
| 题型层：`math.expression`、`math.numeric` 的作答与规格解析 | `math/question-types.ts` | 无 |
| 平台负责人出题：学科管理端插槽、编辑器、试判、KaTeX 预览、保存 / 发布、草稿编辑 | `src/features/subjects/admin-slot*.ts(x)`、`math/admin/`、`math/admin-slot.tsx` | D5、D7、D8 |
| 机构布置标准试卷（所有应用）：布置面板 | `src/app/dashboard/admin/apps/AppPaperAssignPanel.tsx` | 无（沿用原函数） |
| 数学学生端：作业路由、导航、题型标签、专用输入（含公式预览） | `src/app/[space]/apps/math/assignments/`、`math/student/`、`src/features/subjects/question-inputs.ts` | 无 |
| 机器判题建议 + 教师批改预填 + 重新判题 | `math/grading/machine-grading*.ts`、`rejudge-actions.ts`、批改页改动 | D5 |
| 修了两个影响所有非韩语应用的问题 | 作业链接指向旧 `/dashboard` 路径会被重定向到韩语（404）；短答提示“填写韩语答案” | 无 |

此前几天的学科插槽、英语应用骨架、门户 / 首页框架等工作见项目记忆与 `docs/shared-platform-subject-modules-architecture.md`。

## 3. 验证情况

- **测试**：只点名运行的 70 个安全测试文件，418 项全部通过（排除了 103 个 Codex 线与带副作用的测试；运行前后 Codex 账本行数与图片修改时间不变，两个仓库 `git status` 干净）。另有 `tsc`、`eslint`（改动范围内）无报错。
- **数据库草稿**（隔离验证库）：D5 43 行结果、D7 37 项、D8 27 项；韩语回归探针在执行前 / 后 / 回滚后一致；被替换的 5 个函数回滚后逐字一致；一键演练 `docs/db-drafts/tools/rehearse.sh`（2026-10-01 通过）。
- **浏览器**（隔离验证库 + 开发服务 3100 端口）：出题、试判、保存、发布、编辑草稿、机构布置（作业 / 考试 / 指定学生）、学生作答与预览、机器判题建议、批改预填、重新判题、窄屏 390px、韩语页面对照。
- **代码审查**：对整个分支做过一次审查，9 条发现里 8 条已修复并验证，1 条核对后不是缺陷。

## 4. 没有验证的

- 真实云端库 / 接近生产的数据量 / 并发压力；
- 没拿 `main` 做逐像素对比；验证库没有韩语标准试卷，“有韩语试卷时机构视图出现布置面板”只有源码级测试；
- 那 103 个被排除的测试在本分支上是否通过（多数属 Codex 线，与本改动无直接关系，但这是判断，不是跑出来的）；
- 无权限账号直接调用重判动作被拒（只有源码级断言与权限函数）。

## 5. 环境与状态

- **验证库** `~/projects/lms-verify-db`（Supabase，API 56321，库 56322，容器 `supabase_db_lms-verify`）：当前**未应用** D5 / D7 / D8，测试数据已清理；`fixtures-math-course.sql` 可重新生成数学课程。账号见其 README。
- **开发服务**：从工作树 `npx next dev --webpack -p 3100`，`.env.local` 指向验证库；用完要停（按端口杀，不要用 `pkill -f` 匹配命令行，它会杀掉自己的 shell）。**不要碰 3000 端口（Codex）。**
- **依赖**：新增 `mathjs` 15.2.0、`katex` 0.18.9（固定版本）。

## 6. 安全提醒（给下一个接手的人）

1. **永远不要给 `node --test` 传通配符或整个 `tests/` 目录**。会跑 Codex 的 r7c / 4a 测试，往 `/tmp/r7c-isolated-db-ledger.jsonl` 追加记录。2026-10-01 我误触发过一次，多了第 24–32 行（`observedAtUtc` 07:25:14Z–07:25:35Z）和被重写的 `/tmp/runtime-4a8-roleplay.png`，**未清理，待你们决定**。只点名文件；已知安全的清单见 `docs/decisions-pending-2026-10-01.md` 之外的做法：先排除 `teaching-agent-*`、`smart-textbook-*`、`*-browser*`、`*-durable*`、`*-db.test*`，并检查含写文件 / 子进程 / docker 的文件。
2. 数据库草稿**不在** `supabase/migrations`，合并代码不会自动改库；代码里已加“迁移未应用时出题界面说明原因”的保护。
3. Gate 报告是作者自审；上线前需要独立 Gate。
4. 布置面板的时间已改为**跟随发布者电脑的时区**（用户 2026-10-01 决定）；共用的布置动作未改，其他入口（若以后恢复旧页面）仍按韩国时间解析不带时区的值。

## 7. 下一步（按顺序）

1. 独立 Gate（任务单草稿已备好）→ 通过后用 `tools/install-migrations.sh` 整理迁移，编号排在 Codex 迁移之后；
2. （已决定）布置时间跟随电脑时区；
3. Codex 收尾后合并，处理指纹锁（117 个重叠文件）；
4. 合并后在本机库同步迁移，做一次浏览器验证并对照韩语页面。
