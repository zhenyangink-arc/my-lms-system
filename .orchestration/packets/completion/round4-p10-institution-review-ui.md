# Packet: Round4/Packet10 — 机构结课审核

## 背景
方案文档第15.2、22节。数据/RPC已就绪：`student_course_completion_evaluations`、
`course_completion_certificates`、`issue_course_completion_certificate(uuid)`、
`revoke_course_completion_certificate(uuid, text)`、
`reissue_course_completion_certificate(uuid, text, uuid)`（均已通过RLS验证，
机构只能操作本机构，仅eligible可颁发）。

界面文案规范（CLAUDE.md硬性要求，必须遵守）：不生成纯装饰性英文眉题/栏目标签/技术类型
标签；不使用全大写英文说明；标题补充说明必须复用`@/components/ui/card-title-with-hint`
组件，不要自行实现叹号按钮或Tooltip。

## 目标
在现有韩国语应用机构管理工作区内新增"结课审核"区（不新增一级导航，复用现有导航结构，
需先探索仓库现有机构管理页面的路由和布局模式并遵循）：
1. 待审核学生列表（`eligible`状态）。
2. 未达标学生列表（含缺口摘要）。
3. 已颁发证书列表。
4. 已撤销证书列表。
5. 资格明细抽屉/详情：展示完成项、未达标项（自然语言原因，来自`missing_requirements`）。
6. 颁发操作（调用RPC）、撤销操作（要求填写原因，调用RPC）、重新颁发操作。

## 非目标
- 不做学生端页面（Packet11）。
- 不做平台/老师端页面（Packet11后续/已有）。
- 不修改RPC或RLS本身。
- 不做证书打印布局（Packet11范围）。

## 验收标准
1. 只有机构负责人/有权限角色可见此区域；用真实账号验证机构A看不到机构B的数据。
2. 颁发/撤销/重新颁发操作在真实浏览器/真实数据操作下功能正确，UI反映RPC返回的
   成功/拒绝结果（例如对不符合资格的记录不显示可颁发操作，或调用后正确展示拒绝原因）。
3. 未达标学生的缺口展示为具体自然语言，不是笼统"不可用"。
4. 界面文案符合CLAUDE.md规范：无装饰性英文眉题/类型标签，标题说明复用
   `card-title-with-hint`。
5. 375px视口无横向滚动；触控区域至少44px（如涉及移动端）；关键操作有键盘可达性。
6. 既有测试、typecheck、lint通过；`git status`范围可控。
7. 用`run`技能或等效方式启动开发服务器，在真实浏览器里走一遍：查看待审核→查看资格明细
   →颁发→查看已颁发列表→撤销→查看已撤销列表，附截图或操作记录作为证据。

## 交付形式（报告）
- 新增/修改页面文件列表。
- 每条验收标准 PASS/FAIL/BLOCKED，附证据（含浏览器验证记录）。
- 验证命令、退出码。
- 已知风险、UI取舍说明。
