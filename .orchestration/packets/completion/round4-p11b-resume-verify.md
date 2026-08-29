# Packet: Round4/Packet11b — 续接验证学生结课页面（上一次执行被中断）

## 背景
Round4/Packet11（学生结课页面）的执行进程被意外中断，没有产出最终报告。但根据
`git status`，以下文件已经存在，看起来实现已完成：

- `src/app/[space]/apps/korean/grades/completion/page.tsx`
- `src/features/course-completion/StudentCompletionPage.tsx`
- `src/features/course-completion/student-service.ts`
- `src/features/course-completion/PrintCertificateButton.tsx`
- `tests/student-course-completion-page.test.mjs`
- `src/app/dashboard/grades/page-content.tsx`（修改，新增入口链接）
- `src/app/globals.css`（修改，新增打印样式）

## 目标
1. 先通读上述文件，确认实现是否完整、自洽（路由能否正确渲染、数据服务字段是否与
   实际迁移表结构一致、测试断言是否真的匹配代码）。如发现未完成或不一致之处，直接修复。
2. 完整执行原Packet11验收标准对应的验证（详见下方，与首次派发的要求相同），
   产出真实证据。

## 原Packet11验收标准（照旧执行，不降低要求）
1. 学生只能看到自己的资格与证书；用真实账号验证跨学生不可见。
2. 未达标学生看到最重要的下一步，不堆叠所有入口；每个要求同时有文字和图标状态。
3. 已颁发证书信息清晰完整；打印布局与屏幕布局分离（有独立的打印样式/视图）。
4. 375px视口无横向滚动；触控区域≥44px；标题说明复用`card-title-with-hint`；
   无装饰性英文眉题。
5. 用真实浏览器走一遍：未达标学生视图→等待批改学生视图→已颁发证书学生视图→打印预览，
   附截图证据。
6. 既有测试、typecheck、lint通过；`git status`范围可控。

## 非目标
- 不要重写已经正确的部分；只修复发现的问题。
- 不涉及机构端/老师端/证书RPC本身的改动。

## 交付形式（报告）
- 对已有实现的核实结论（完整/需要修复了什么）。
- 每条验收标准 PASS/FAIL/BLOCKED，附真实证据（含浏览器截图）。
- 验证命令、退出码。
- 已知风险。
