# Management schools and deep details

本页规范继承 `design-system/yuanzhi-lms/MASTER.md`。未在下列条目中明确允许的偏离，均不得覆盖 Master 的 Management、组件、状态、键盘与可访问性契约。

## Schools overview

- Route: `/dashboard/admin/schools/overview`
- Audience: Management
- Archetype: Operations overview
- Primary job: 快速识别各学校分类的数量、发布情况和资料缺口，并进入需要处理的分类或学校。
- Primary action: 打开待完善学校的详情；分类摘要作为次级导航入口。
- Information hierarchy: Standard page header → 返回学校管理 → 各分类可操作摘要 → 待完善资料队列 → 完整/空/错误状态。
- Layout and density: Management standard density；摘要在宽屏使用五列，在较窄桌面逐步回流；队列使用稳定实底卡片，不使用营销 Hero。
- Special components: `DashboardPageHeader`、分类摘要 `dl`、`SchoolCrest`、待完善队列、共享 route loading/error boundary。
- Allowed deviations: 分类摘要可作为可点击卡片，因为每项同时承担状态摘要和确定的分类导航；最多首屏展示 18 条待完善资料。
- Accessibility risks: 摘要数字缺少名称、状态只靠颜色、卡片链接焦点不可见、无学校时误报“资料均完整”。
- Acceptance criteria: 恰好一个 H1；摘要数字有可读名称；图标均为装饰性并从可访问性树隐藏；键盘焦点清晰；读取失败、无任何学校、无待完善资料三种状态文案互不混淆。

## Schools collection

- Route: `/dashboard/admin/schools/[category]`
- Audience: Management
- Archetype: Collection
- Primary job: 搜索、比较并管理指定分类的学校资料。
- Primary action: 新增当前分类学校；搜索和逐行详情/展示切换为次级操作。
- Information hierarchy: Standard page header → 返回/相关工具入口 → 可见标签的搜索工具栏与新增操作 → 数据表 → 分页。
- Layout and density: Management compact/standard density；表格占用管理端可用宽度；仅表格容器允许横向滚动，最小表格宽度保证列可读。
- Special components: `DashboardPageHeader`、`Dialog`、持久 Label 的新增表单、语义 `table`、`SchoolCrest`、服务端分页。
- Allowed deviations: 当前固定按排序值及学校名称排序，因此表头不提供伪排序控件，也不声明 `aria-sort`；每页 20 条。
- Accessibility risks: Placeholder 代替搜索 Label、视觉网格冒充表格、发布与完整度只靠颜色、行操作缺少焦点、筛选后分页丢失关键词。
- Acceptance criteria: 恰好一个 H1；搜索字段有可见 Label；表格具有 caption、列头与行头；状态包含可见文本；分页保留搜索条件；所有链接、按钮、字段和复选框具有清晰 focus-visible；错误、无初始数据和无搜索结果明确区分。

## School detail and program form

- Route: `/dashboard/admin/schools/[category]/[schoolId]`
- Audience: Management
- Archetype: Detail / inspector + Form editor
- Primary job: 理解学校身份与地区上下文，维护学校基础资料和专业资料。
- Primary action: 保存当前编辑区域；永久删除专业为分离的 destructive action。
- Information hierarchy: Standard page header/学校身份 → 返回路径 → 学校概况与章节导航 → 学校资料表单 → 专业编辑区 → 删除确认。
- Layout and density: Management standard density；字段按两列分组并在窄屏回流；专业使用原生 `details` 渐进披露，避免同时展开全部长表单。
- Special components: `DashboardPageHeader`、`DashboardTitleWithHint`、`SchoolCrest`、原生 form controls、`AlertDialog` 删除确认、共享 route loading/error boundary。
- Allowed deviations: 专业编辑可使用 `details/summary`，前提是 summary 可键盘操作且有可见焦点；章节锚点可作为页面内次级导航。
- Accessibility risks: 页面标题与身份标题重复、复选框组缺少语义、summary 无焦点、删除直接提交、长表单离开时丢失未保存内容。
- Acceptance criteria: 恰好一个 H1 且后续章节为 H2；所有字段有持久 Label；展示设置有分组语义；所有图标为装饰性；专业读取错误不伪装为空；永久删除必须经过有标题、说明和取消路径的确认对话框。

## Assignment detail and grading

- Route: `/dashboard/admin/assignments/[assignmentId]`
- Audience: Management
- Archetype: Detail / grading
- Primary job: 查看作业身份、范围、题目和提交记录，并安全完成评分与反馈。
- Primary action: 对待批改提交保存评分；发布/关闭等状态操作为上下文操作。
- Information hierarchy: Standard page header → 返回路径 → 作业身份与进度摘要 → 分配范围/截止时间 → 题目与参考答案 → 学生提交与评分表单。
- Layout and density: Management standard density；摘要区优先呈现任务身份与三个决策指标；批改区在宽屏使用答案/评分双栏，在较窄视口回流。
- Special components: `DashboardPageHeader`、`AssignmentStatusActions`、`AssignmentDeadlineForm`、`SubmissionGradingForm`、`LocalDateTime`、共享 route loading/error boundary。
- Allowed deviations: 任务摘要可使用克制的语义令牌渐变以分隔身份区，但必须保持稳定实底可读性，不得成为营销 Hero。
- Accessibility risks: 缺少 H1、指标图标被朗读、原始 danger 色不支持主题、题目或提交读取失败被误认为空、子表单错误与提交反馈不完整。
- Acceptance criteria: 恰好一个 H1；任务名称为 H2，学生为 H3；指标图标隐藏且数字使用 tabular figures；状态同时含文本；原始 Hex/rgba 禁止；题目空、提交空、关联数据错误互相区分；嵌套批改控件满足其自身表单契约。

## Conversation scenario detail and form

- Route: `/dashboard/admin/conversation-practice/[scenarioId]`
- Audience: Management
- Archetype: Detail / Form editor
- Primary job: 编辑会话场景内容与发布状态，并检查学生练习结果。
- Primary action: 保存场景内容；发布状态操作和学生端预览为上下文操作。
- Information hierarchy: Standard page header → 返回路径 → 场景身份/状态/预览 → 内容表单 → 学生练习数据与反思。
- Layout and density: Management standard density；宽屏使用编辑器主栏和练习数据侧栏，窄屏按身份、编辑、数据顺序回流。
- Special components: `DashboardPageHeader`、`ConversationScenarioForm`、`ConversationScenarioStatusActions`、`LocalDateTime`、共享 route loading/error boundary。
- Allowed deviations: 练习状态可使用图标和语义色辅助扫描，但必须同时显示“已完成/练习中”文本。
- Accessibility risks: 缺少 H1、练习状态仅靠图标/颜色、预览链接焦点不清晰、进度查询失败被显示为空、复杂编辑子表单的动态字段名称和错误关联。
- Acceptance criteria: 恰好一个 H1；场景名称及练习数据使用连续 H2；练习状态含可见文本；装饰图标隐藏；预览和返回链接有清晰 focus-visible；进度错误、无练习记录和正常数据明确区分；嵌套表单满足 Label、错误、保存反馈和键盘契约。

## Shared verification

- Loading: 使用 `/dashboard/loading.tsx` 的 Management route loading 状态，不在页面内容中伪造静态 loading UI。
- Fatal error: 主对象读取失败抛给 `/dashboard/error.tsx`；部分关联数据失败在当前页面显示 `role="alert"` 和恢复指引。
- Permission: 页面入口的 `requireAdmin`、`requireAssignmentManager`、`requireTenantAppCapability` 或 `requireConversationPracticeContentManager` 必须在渲染业务数据前完成权限判定。
- Not found: 合法分类下不存在的学校、作业或场景使用 `notFound()`，不得与数据库读取错误共用同一状态。
- Focus and motion: 所有本页直接渲染的交互控件具有可见 focus-visible；共享 Dialog/AlertDialog 负责焦点圈定与返回；页面不新增非必要动画。
- Destructive actions: 永久删除必须确认；可逆的展示/停用切换可直接提交，但必须显示明确动作文本和结果状态。
