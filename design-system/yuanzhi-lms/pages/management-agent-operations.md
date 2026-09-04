# Agent 运营中心

- Route: `/platform/dashboard/admin/agents`
- Audience: Management — platform owner only
- Archetype: Operations overview + collection + audit/history
- Primary job: 查看学生与导航 Agent 的真实交互，维护本地导航规则，并追踪模型、性能和配置变更。
- Primary action: 发现未命中或失败的请求，并通过结构化导航规则改进学生体验。
- Information hierarchy: Page header → section tabs → decision metrics → filters → conversations/rules/configuration/audit workspace.
- Layout and density: Neutral Operations Workspace，标准/紧凑桌面密度；沿用 `ManagementPage`，表格在自身容器内横向滚动。
- Special components: 指标条、带失败事件的会话列表与详情、URL 分页、规则编辑与版本恢复 Dialog、连接到既有教学引擎配置的模型设置、不可变审计记录。
- Allowed deviations: 会话详情可在列表行内展开；导航规则使用结构化表单，不提供任意代码编辑器。
- Accessibility risks: 对话长文本溢出、仅凭颜色表达运行状态、Dialog 焦点丢失、表格在高缩放下溢出、图标按钮缺少名称。
- Acceptance criteria: 每页恰好一个 H1；仅平台负责人且无机构上下文时可访问；机构管理员及成员在导航、页面、API、数据库四层均不可访问；对话正文可换行；搜索和分页状态写入 URL；查看学生会话写入审计；模型失败形成可查看事件和失败率；所有规则与回答配置操作和审计在同一数据库事务完成；审计、失败事件和规则版本只允许追加；规则可恢复到历史版本；否定或取消表达不触发导航；导航目标同时受前端与数据库白名单约束。
