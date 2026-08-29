# Packet: Round5/Packet14e — 核实14d是否影响真实资格评估（发现疑似回归）

## 背景
Round5/Packet14d新增了`202608190000_bootstrap_assessment_seed_sources.sql`，为了让
`202608190007`及后续迁移通过"题库已发布"检查，创建了16章"隔离已发布快照"
（`chapter_tests`记录，slug形如`korean-level-one-01-assessment-seed-source-v1`），
并用临时视图映射历史slug，200002完成后恢复真实物理表。

在全新`db reset --local`之后，我（协调者）直接运行了Packet7遗留的验收脚本
`scripts/verify-course-completion-evaluator.mjs`，结果失败：一个原本应该"全部达标"
的测试学生被评估为`not_eligible`，`evidence_snapshot.textbook.completedChapterCount`
为`0`，其中每章的`href`/`testSlug`都指向了`korean-level-one-01-assessment-seed-source-v1`
这类新的隔离快照slug，而不是真实教材章节的原始标识。

## 目标（先诊断，如确认是真回归再修）
1. 判断这是否是`private.completion_...`资格评估逻辑（Packet7在
   `202608200004_single_student_completion_evaluator.sql`中实现）本身有问题——
   例如它错误地把`chapter_tests`表里刚创建的隔离快照记录当成了这个测试学生的
   教材进度数据源，而实际教材完成度应该来自`digital_textbook_*`相关的学生进度表，
   与`chapter_tests`快照无关。
2. 或者判断这只是`verify-course-completion-evaluator.mjs`脚本自身的测试夹具在这次
   全新reset后没有正确建立"该学生已完成16章教材"的前置数据（例如该脚本原本依赖
   某些之前手工操作留下的进度数据，而全新空库没有），与Packet14d无关。
3. 如果确认是资格评估逻辑本身错误地读取了`chapter_tests`隔离快照作为教材完成度来源
   （即Packet14d的改动通过某种共享表/视图路径污染了Packet7本应只读真实学生进度的
   查询），必须修复评估逻辑，确保教材完成度判定继续只依据真实学生学习进度表，
   不受这批隔离快照影响。
4. 如果确认只是验证脚本夹具问题，修复验证脚本本身的测试数据搭建方式，不要动
   资格评估核心逻辑。

## 非目标
- 不修改007/008/014/023/200002等历史文件。
- 不改变Packet14d隔离快照方案本身的设计（除非诊断证明它确实污染了评估逻辑）。

## 验收标准
1. 明确的根因结论：污染了评估逻辑 vs 验证脚本夹具问题，附具体证据（SQL查询、
   代码引用）。
2. 修复后，重新运行`node --experimental-strip-types scripts/verify-course-completion-evaluator.mjs`
   通过（退出码0），"全部达标"测试学生正确评估为`eligible`。
3. 用一个真实的、教材尚未完成的学生场景验证：教材完成度判定不会被隔离快照污染成
   "已完成"（即误报为完成也是一种风险，需要反向验证）。
4. 既有测试、typecheck、lint通过；`git status`范围可控。

## 交付形式（报告）
- 根因结论与证据。
- 改动文件（如有）。
- 每条验收标准 PASS/FAIL/BLOCKED，附真实证据。
- 验证命令、退出码。
