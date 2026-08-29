# Packet: Round5/Packet12c — 续接补完Packet12b报告（环境alias导致上次中断）

## 背景
Round5/Packet12b的执行进程在验证阶段被中断，日志末尾显示错误：
`Error: claude native binary not installed.`——这是本机shell环境里一个损坏的
`grep`函数别名（会尝试调用一个不存在的claude原生二进制）导致的，不是代码或
Postgres/Next问题。用户shell里定义了`grep`函数会拦截裸调用；请在你自己新起的
脚本或验证命令里避免依赖裸`grep`（如需要用grep语义，用`command grep`或改用
`node`/`rg`如果存在/其他方式），避免重蹈这个环境陷阱。

根据`git status`，以下改动已经存在，看起来Packet12b的核心修复已完成：
- `supabase/migrations/202608200007_completion_retake_connections.sql`（已修改，
  含补考卷题目快照修复：新增`private.assignment_delivery_paper_id`函数，
  patch了`submit_learning_assignment`按`delivery_paper_id`过滤题目）。
- `scripts/verify-completion-retake-browser.mjs`（新增）
- `scripts/verify-completion-retake-connections.mjs`（新增）
- `scripts/verify-student-course-completion-ui.mjs`（新增）
- `tests/completion-retake-connections.test.mjs`（已修改）
- 另有一个可能是残留构建产物的 `.next-retake/` 目录，请判断是否应清理
  （如果是本次验证用的临时Next构建目录且未加入`.gitignore`，清理掉；
  如果确有必要保留请说明原因）。

## 目标
1. 核实上述改动是否完整、正确应用（迁移是否已在本地数据库真实执行成功、
   修复逻辑是否自洽）。
2. 完整补跑Round5/Packet12b原定的全部验收标准验证，产出最终报告（该报告此前
   因环境alias中断丢失，请重新完整产出，不要假设读者看过之前的部分日志）。
3. 清理`.next-retake/`等本次验证产生的临时构建产物（如确认是临时产物）。

## 原Packet12b验收标准（照旧执行）
1. 补考卷切换后，学生看到的题目/答案/材料与新选定母卷一致（题目ID层面比对，
   不能只看题目数量）。
2. 真实浏览器完整走通：投递（换卷）→学生作答→批改→发布→资格刷新，全部为真实操作，
   附截图或记录。
3. 至少5类深链（教材、作业、章节巩固、专项训练、错题复习）在真实登录浏览器中
   逐一验证为200且到达可操作页面。
4. 既有测试、typecheck、lint通过；`git status`范围可控；测试数据清理。

## 交付形式（报告）
- 对已有实现的核实结论。
- 每条验收标准 PASS/FAIL/BLOCKED，附真实证据。
- 验证命令、退出码。
- 已知风险。
