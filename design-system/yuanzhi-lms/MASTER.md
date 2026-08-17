# Yuanzhi LMS Design Constitution

> 本文件是元知 LMS 的全局设计契约，不是页面设计稿，也不是某次 UI 搜索结果的存档。
> 它规定稳定的系统边界、设计令牌、端侧体验、组件行为和页面覆盖权限。

## 0. Document status

| Field | Value |
|---|---|
| Status | Active — migration in progress |
| Version | 2.1 |
| Last reviewed | 2026-08-17 |
| Product | Yuanzhi LMS |
| Platform | Desktop Web only |
| Supported widths | 1024px, 1280px, 1440px, 1920px |
| Out of scope | Mobile-specific navigation and page composition |

### Normative language

- **MUST / MUST NOT**：不可被页面规则或设计工具建议覆盖。
- **SHOULD / SHOULD NOT**：默认执行；页面文件可在说明理由后覆盖。
- **MAY**：允许选择，不构成统一要求。

### Authority order

发生冲突时按以下优先级处理：

1. 用户本次明确要求。
2. 功能正确性、安全性与无障碍要求。
3. 本文件中的 MUST / MUST NOT。
4. 本文件中的 Student / Management experience profile。
5. `design-system/yuanzhi-lms/pages/*.md` 中经过说明的页面规则。
6. 已验证且与产品、平台和任务匹配的设计研究结果。
7. 开发者或 AI 的临时判断。

`ui-ux-pro-max`、其他 Skill、外部设计系统和 AI 生成结果都是**参考证据**，不是项目权威。营销页、Hero、Testimonials、儿童字体、Claymorphism 等不符合已登录桌面工作台任务的结果 MUST 被拒绝，不得写入本文件或直接实现。

## 1. Purpose and scope

本系统由一套共同基础和两种工作体验组成：

```text
Shared foundation
├── Neutral portal：登录、注册、租户入口和非工作区页面
├── Student experience：学习推进型工作台
└── Management experience：数据操作型工作台
```

三者共享品牌基础、语义令牌、组件状态、图标语言、键盘行为和无障碍要求，但不强制共享同一种页面密度、内容结构或材质表达。

### Desktop contract

- MUST 以桌面浏览器为当前设计和审查目标，不为移动端增加底部导航、移动端专属页面或手势流程。
- MUST 在 1024px–1920px 的窗口宽度内保持可用，并验证 100%、125%、150%、200% 浏览器缩放。
- MUST 支持窗口宽度变化；不得把单一固定画布当作唯一正确状态。
- MUST 让主要功能可通过键盘完成；核心导航在深层页面仍需可达。
- SHOULD 利用大屏减少不必要的嵌套和模态，同时保持舒适的信息密度。

## 2. Implementation status

本表区分“已经生效”和“设计目标”。AI 不得把 Target 当成已经实现。

| Decision | Status | Runtime source / next action |
|---|---|---|
| 旧五主题及其切换器已移除 | Implemented | 不得恢复 `data-app-theme` 或 `app-dashboard-theme` |
| Student OS 是唯一学生端系统 | Implemented | `src/app/dashboard/layouts/StudentDashboardLayout.tsx` |
| morning / afternoon / night 是 Student OS 内部外观模式 | Implemented | `src/app/globals.css`、`StudentSystemTopbar.tsx` |
| Management Apple 是当前管理端系统 | Implemented | `src/app/dashboard/management-apple.css` |
| shadcn 语义令牌成为唯一正式语义主干 | Implemented | `src/app/design-tokens.css`；运行时源码统一消费正式命名 |
| `--app-*` 旧兼容命名空间已移除 | Implemented and guarded | 契约测试禁止旧变量重新进入运行时源码 |
| Primitive / Semantic / Component 三层边界 | Implemented at foundation | 正式组件令牌只引用语义或原始令牌；页面级原始值继续迁移 |
| 关键主操作与状态文字达到 4.5:1 | Implemented and guarded | 学生主操作、课程动作和账户状态配对由契约测试验证 |
| 学生时间模式不再改变业务状态语义 | Implemented | morning / afternoon 仅控制环境背景；night 使用同语义的对比度配对 |
| 学习正文、答题、表格和表单使用稳定实底 | Implemented at foundation | 通用内容卡改为实底；轻量首页摘要仍可使用玻璃 |
| 管理端统一使用一个标准页面骨架 | Partially implemented | 以 `ManagementPage` 或其正式后继组件为准 |
| 页面级规范存放于 `pages/*.md` | Implemented for priority archetypes | 已建立学生首页、测评、管理集合与详情/表单规范，继续按页面补充 |

### Current runtime sources

- 三层正式令牌：`src/app/design-tokens.css`
- Tailwind 映射与全局基础样式：`src/app/globals.css`
- 学生端变量、材质与外观模式：`src/app/globals.css`
- 管理端变量和组件外观：`src/app/dashboard/management-apple.css`
- 共享基础组件：`src/components/ui/`
- 学生端 Shell：`src/app/dashboard/layouts/StudentDashboardLayout.tsx`
- 管理端 Shell：`src/app/dashboard/layouts/ManagementDashboardLayout.tsx`
- 导航与逐页审核账本：`design-system/yuanzhi-lms/NAVIGATION-AUDIT.md`

当文档与运行代码不一致时，必须先判断该条是 Implemented 还是 Target。不得静默选择一方；实施任务应让代码向已批准的 Target 迁移。

## 3. Design-system architecture

### Three-layer token model

```text
Primitive tokens
raw color, spacing, type, radius, shadow, duration
        ↓
Semantic tokens
background, foreground, card, primary, muted, danger, border
        ↓
Component tokens
button, input, table, sidebar, dialog, student shell
```

- Primitive 只表达原始值，极少变化。
- Semantic 表达用途，由 Neutral / Student / Management profile 映射。
- Component 只能引用 Semantic 或 Primitive，不得在组件内部复制主题色。
- 页面只消费语义或组件令牌，MUST NOT 建立完整的页面级颜色系统。

### Canonical semantic tokens

项目的目标语义主干采用 shadcn/Tailwind 已使用的命名：

| Role | Canonical tokens |
|---|---|
| Canvas | `--background` / `--foreground` |
| Surface | `--card` / `--card-foreground` |
| Floating surface | `--popover` / `--popover-foreground` |
| Primary action | `--primary` / `--primary-foreground` |
| Supporting action | `--secondary` / `--secondary-foreground` |
| Subdued content | `--muted` / `--muted-foreground` |
| Hover / selected surface | `--accent` / `--accent-foreground` |
| Destructive | `--destructive` / matching foreground |
| Structure | `--border`, `--input`, `--ring` |
| Navigation | `--sidebar-*` |
| Data visualization | `--chart-1` … `--chart-5` |

重要：shadcn 的 `--accent` 表示交互高亮表面；最高优先级操作必须使用 `--primary`。

### Runtime token policy

- 运行时源码 MUST 使用正式语义令牌或已批准的组件令牌。
- 已移除的 `--app-*` 兼容命名空间 MUST NOT 恢复；迁移代码应直接映射到正式用途，而不是再建立别名层。
- 原始 Hex、OKLCH、RGBA 和 `color-mix()` 的主题值 SHOULD 集中在令牌层；业务页面不得自行建立配色。
- 精确数值以令牌实现文件为运行事实来源。本文件记录用途、范围和约束，不复制整份 CSS 色值表。

## 4. Shared foundations

### Typography

- MUST 使用当前系统字体栈、Geist、PingFang SC 和系统回退；不得为了“流行”引入儿童字体或不必要的网络字体组合。
- MUST 通过字号、字重、间距和对比度建立层级，不得在整个页面重复使用 `font-black`。
- 正文通常为 14–16px，辅助信息不得低于 12px；10–11px 仅限空间受控的非关键元数据。
- 正文行高 SHOULD 为 1.5–1.7；长文本行长 SHOULD 控制在约 60–75 个拉丁字符的视觉宽度。
- 表格数字、金额、时长和统计值 SHOULD 使用 tabular figures。

### Spacing and density

- MUST 使用 4px 基础节奏，常用层级为 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64。
- Student 默认 Standard / Comfortable density。
- Management 默认 Standard / Compact density；表格可提供经过设计的密度选择。
- 页面不得通过大量近似但不一致的任意间距制造层级。

### Radius and elevation

- MUST 使用从一个基础 radius 派生的比例化等级，不再执行“全项目只能两个圆角”的旧规则。
- Control 使用较小等级，普通 Surface 使用中等等级，Dialog / Floating shell MAY 使用较大等级。
- 同一层级的同类组件 MUST 使用相同等级；业务页面不得用任意值建立自己的圆角语言。
- 内容层优先使用边框和背景分层；阴影只表达真实层级，不作为默认装饰。

### Color semantics

- Primary 只表示最高优先级操作或选中状态。
- Success、Warning、Destructive 的含义 MUST 在 Neutral、Student、Management 和全部外观模式中保持稳定。
- 颜色 MUST NOT 是状态的唯一表达；同时使用文字、图标、形状或明确标签。
- 每个前景/背景组合均需单独验证对比度，不能因为令牌名称正确就假设通过。

### Icons

- MUST 使用项目现有的 Lucide SVG 图标体系；同一视觉层级保持一致的尺寸、描边和填充策略。
- MUST NOT 使用 Emoji 作为导航、操作或状态图标。
- 装饰图标需从无障碍树隐藏；无可见文字的图标按钮必须有可访问名称和相关状态。

### Motion

- 动效 MUST 表达原因与结果，不得成为页面装饰。
- 常规反馈 SHOULD 低动效、可中断，并优先使用 opacity / transform。
- MUST 遵守 `prefers-reduced-motion`；关闭动效后内容和操作仍然完整。
- 不得为已登录工作台默认增加营销式 Scroll Reveal、视差或长序列入场动画。

### Material

- 玻璃和 blur 是功能层材料，不是全局装饰。
- 导航、顶栏、工具栏、Popover、Dialog MAY 使用玻璃材料。
- 长文本、课程正文、答题内容、表单、数据表和高密度业务区域 MUST 使用稳定、可读的不透明或高不透明表面。
- 任何透明度个性化都 MUST 有安全下限，并不得降低关键内容与控件的对比度。

## 5. Student experience profile

### Direction

**Calm Learning Workspace**：安静、清晰、有温度，以“继续学习和完成任务”为首要目标，而不是展示营销信息。

### Information hierarchy

学生首页 SHOULD 按以下任务优先级组织，但页面文件可根据真实内容调整栏目：

1. 下一步学习或继续学习。
2. 即将到期、待完成或需要处理的任务。
3. 当前课程与练习入口。
4. 学习进度、近期记录和反馈。
5. 次要资源、公告与帮助。

- 每个任务区域 SHOULD 只有一个视觉主操作。
- 课程、学习计划和异构内容 SHOULD 使用卡片或列表。
- 成绩、历史记录和规则化数据 SHOULD 使用表格或结构化列表。
- 不得在已登录首页使用营销式 Hero、Testimonials、Feature grid 或重复 CTA。

### Student shell and material

- Student OS 是唯一学生端 Shell；不得恢复已删除的五主题系统。
- Shell MAY 保留桌面应用窗口感、环境背景、半透明侧栏与顶栏。
- 轻量首页摘要 MAY 使用经过对比度验证的半透明材料。
- 学习内容、长阅读、考试、答题、表格和表单 MUST 与环境背景充分分离。
- 用户可调透明度不得改变信息层级、可读性或组件状态识别。

### Background modes

`auto / morning / afternoon / night` 是一个 Student OS 内的外观模式，不是多个设计系统。

允许覆盖：

- Canvas 和环境背景。
- 非语义性的氛围色与光感。
- Shell / chrome 的玻璃材质。
- Night 模式为保证可读性所需的 surface / foreground 配对。

禁止覆盖：

- Success、Warning、Destructive 的业务含义。
- 组件几何、页面布局、密度和导航结构。
- 主要操作与次要操作之间的层级关系。
- 同一业务状态的图标、文字和交互行为。

目标状态下，Primary 交互色 SHOULD 跨 morning / afternoon 保持稳定；Night 可为对比度使用配对色，但不得把主操作改造成另一种业务语义。

### Student page archetypes

| Archetype | Primary job | Default composition |
|---|---|---|
| Learning overview | 明确下一步并继续学习 | Continue → Tasks → Courses → Progress |
| Course catalog | 发现和筛选课程 | Search/filter → category → course results |
| Lesson workspace | 阅读、观看、练习 | Context navigation → content → learning actions |
| Assessment focus | 完成作业或考试 | Focus header → question/task → progress/actions |
| Progress and records | 回顾结果和趋势 | Summary → structured records → insight |

Assessment Focus MAY 隐藏普通侧栏并使用专注型导航，但它是页面 archetype，不得创建独立的全局主题。

## 6. Management experience profile

### Direction

**Neutral Operations Workspace**：中性、清晰、高效，以扫描、筛选、比较、编辑、批量操作和审计为首要目标。

### Standard composition

管理端一级页面 SHOULD 使用统一顺序：

1. Page title、简短说明、页面级操作。
2. Search、filters、view settings。
3. 必要的摘要或 KPI；没有决策价值时不展示。
4. 主数据表、表单或工作区。
5. 分页、次要说明或审计信息。

- MUST 统一到 `ManagementPage` 或之后明确指定的唯一正式后继组件。
- 同一页面不得叠加多个 H1、重复路由标题或并存多个 page container。
- 管理端不得使用大面积营销 Hero、装饰性背景卡和学生端氛围素材。
- 主要业务内容 SHOULD 充分利用桌面宽度；长表格不得嵌套在狭窄卡片中。

### Management shell and material

- Management Apple 是当前正式管理端 Shell。
- 侧栏、顶栏和浮层 MAY 使用克制的玻璃材质。
- 表格、表单、详情、审计和业务卡片 MUST 使用稳定实底。
- 默认视觉为中性浅色与蓝色主交互；状态色仅承担业务语义。
- Dark mode MAY 保留，但所有 surface / foreground / border / focus / state 组合必须独立验证。

### Data-table contract

适用时，标准数据表 SHOULD 提供：

- 清晰标题或上下文说明。
- Search、filter、view settings 和主要操作所在的 toolbar。
- 可理解且可键盘操作的排序。
- 一致的表头与行密度。
- Pagination 或适当的虚拟化/分段加载。
- Selection、batch actions、row actions 和展开信息（仅在任务需要时）。
- Loading、empty、error 和 retry 状态。
- 本地化的日期、数字、金额与单位。

表格 MUST NOT 依赖颜色或 hover 才能理解；排序需暴露 `aria-sort`，仅 hover 出现的操作也必须可被键盘和辅助技术访问。

### Management page archetypes

| Archetype | Primary job | Default composition |
|---|---|---|
| Operations overview | 发现异常与待办 | Header → actionable summary → queues/data |
| Collection | 搜索、筛选、比较、批量操作 | Header → toolbar → data table → pagination |
| Detail / inspector | 查看对象并执行上下文操作 | Identity/context → sections → actions/history |
| Form editor | 新建或编辑结构化数据 | Header → grouped fields → validation → actions |
| Audit / history | 检索和追溯行为 | Filters → immutable records → detail/export |

## 7. Component contracts

本文件只规定组件契约，不复制完整 CSS。精确样式由共享组件和令牌实现。

### Buttons

- Variants：Primary、Secondary、Outline/Ghost、Destructive、Link。
- Sizes：Compact、Standard；图标按钮使用同一高度体系。
- MUST 实现 default、hover、active、focus-visible、loading、disabled 和 error-related 状态。
- 异步提交期间必须防止重复提交并给出可感知反馈。
- 一个页面任务区域只保留一个 Primary；其他操作降级或进入 overflow menu。

### Forms

- 每个字段 MUST 有持久可见的 Label，不得只用 Placeholder。
- 错误 MUST 位于字段附近并说明原因和恢复方式。
- Read-only 与 Disabled 在视觉和语义上必须不同。
- 多错误提交 SHOULD 提供可聚焦的错误摘要并链接到字段。
- 长表单 SHOULD 分组并渐进披露；存在未保存内容时关闭需确认。

### Cards and surfaces

- Card 只用于表达一个有明确边界的内容单元，不是所有内容的默认包装。
- 禁止无意义的“卡片套卡片套卡片”；嵌套必须对应真实信息层级。
- Hover 不得引起周围布局抖动；轻微位移只可用于明确可点击且不会破坏稳定性的卡片。
- 表格不得为了视觉装饰被放入多层圆角和多层阴影容器。

### Dialogs, sheets and popovers

- MUST 有明确标题、关闭路径和正确的焦点管理。
- 破坏性操作必须确认；可恢复操作优先提供 Undo。
- 不得用 Modal 承载主导航或过长的核心业务流程。
- 浮层不得遮挡当前键盘焦点；关闭后焦点返回合理位置。

### Charts

- 图表必须回答明确问题；趋势用折线、比较用条形，类别过多时不使用饼图。
- MUST 提供文本摘要或数据表替代，不能仅靠颜色传递信息。
- 图例、坐标、单位、Tooltip 和空/错/加载状态必须完整。

## 8. Page specification contract

实现或重构具体页面前，先读取本文件，再检查：

```text
design-system/yuanzhi-lms/pages/[page-name].md
```

页面文件 SHOULD 包含：

```markdown
# Page name
- Route:
- Audience: Student | Management
- Archetype:
- Primary job:
- Primary action:
- Information hierarchy:
- Layout and density:
- Special components:
- Allowed deviations:
- Accessibility risks:
- Acceptance criteria:
```

### Allowed page overrides

页面文件 MAY 调整：

- 内容顺序和信息优先级。
- 栅格、栏目和最大内容宽度。
- Standard / Comfortable / Compact 密度选择。
- Card、list、table、split view、inspector 的组合。
- 页面专属组件和经说明的材质使用。

### Forbidden page overrides

页面文件 MUST NOT 推翻：

- 语义颜色含义和对比度要求。
- 共享组件状态与键盘行为。
- 字体和图标体系。
- Focus、reduced motion、错误恢复和表单标签要求。
- Student / Management 的产品边界。
- 旧主题不得恢复的决定。

如果页面确实需要推翻 MUST 规则，必须先修改并审批本文件，不能只在页面文件中覆盖。

## 9. Accessibility and desktop verification

所有 UI 交付前 MUST 验证：

- 正常文字对比度至少 4.5:1；大文字和非文字关键边界至少 3:1。
- Tab 顺序与视觉顺序一致；所有功能可通过键盘到达和执行。
- Focus indicator 清晰且不会被 sticky header、popover 或 overlay 遮挡。
- 图标按钮有可访问名称；展开、选中、按下、排序等状态正确暴露。
- Heading 层级连续，每页只有一个语义主标题。
- 状态不只依赖颜色；图表有文本摘要或表格替代。
- 表单有 Label、字段级错误、提交反馈和恢复路径。
- Drag 行为有按钮或键盘替代；关键操作不依赖 hover。
- `prefers-reduced-motion` 下内容和操作完整。
- 1024 / 1280 / 1440 / 1920px 以及 100% / 125% / 150% / 200% 缩放下，无关键遮挡、不可达操作或非预期双滚动。

## 10. Anti-patterns

- 在已登录工作台使用营销 Hero、Testimonials、Feature grid 或重复 CTA。
- 让 Student 和 Management 共享同一页面密度与内容结构，仅换颜色。
- 新增全局主题、旧主题切换器或页面级完整调色板。
- 在业务页面硬编码主题 Hex、任意阴影、任意圆角或网络字体。
- 通过全局选择器批量重写 `.rounded-*`、`.font-*` 等工具类来掩盖页面差异。
- 使用 `font-black`、大圆角、玻璃和阴影作为“高级感”的默认手段。
- 内容层玻璃导致文字、表格或表单对比度随背景变化。
- 同一管理页面出现多个 page header、多个 H1 或多个互相竞争的主要操作。
- 表格嵌套表格，或把宽数据表塞入狭窄卡片。
- Emoji 充当结构图标；仅 hover 可见且无法通过键盘访问的操作。
- 把 Skill 搜索结果直接持久化，而未验证产品类型、平台、领域和首个匹配结果。

## 11. Workflow and governance

### Required workflow for UI work

1. 明确用户、页面任务、Student/Management audience 和 archetype。
2. 读取本文件与对应 `pages/*.md`。
3. 检查真实运行组件和令牌，不假设 Target 已实现。
4. 优先复用共享组件和正式语义令牌。
5. 只有存在未决设计问题时才查询 `ui-ux-pro-max`。
6. 验证搜索结果的领域、产品、平台和首个匹配；偏题时缩窄重试一次。
7. 重试仍偏题时，记录“无已验证匹配”，使用本文件和明确标注的一般原则。
8. 按本文件的桌面与无障碍清单验收。

### Documentation ownership

- 全局品牌、令牌、端侧边界或组件行为变化：修改本文件。
- 单个页面的信息架构或经批准的偏离：修改对应 `pages/*.md`。
- 正式导航、路由分类和逐页审核进度：修改 `NAVIGATION-AUDIT.md`。
- 仅修复实现使其符合现有规则：通常不修改设计文档。
- 废弃规则应删除或移入迁移记录，不在长期规范中保留大段历史说明。

### Migration order

后续设计系统治理 MUST 按以下顺序进行，避免逐页打补丁：

1. 统一正式语义令牌并移除 `--app-*` 兼容命名空间。（已完成）
2. 统一 Button、Input、Card、Dialog、Table 等基础组件。
3. 收窄 Student 外观模式和材质的覆盖范围。
4. 收拢 Management CSS 与标准页面骨架。
5. 建立页面规范并按 archetype 分批迁移页面。
6. 继续删除不再被使用的全局覆盖和历史样式。

### Definition of done

- 页面任务和主操作清晰。
- 使用正确的 audience profile 和 archetype。
- 未新增平行主题、令牌体系或页面骨架。
- 组件状态、空/错/加载状态和键盘路径完整。
- 内容在要求的桌面宽度和缩放范围内可用。
- 文档中的 Implemented / Target 状态与实际代码一致。

## 12. Informative references

以下资料仅作为研究依据，不覆盖本文件：

- Apple Human Interface Guidelines — Layout / Designing for macOS / Materials
- shadcn/ui — Theming and semantic token convention
- Design Tokens Community Group — Technical Reports
- Carbon Design System — Data table usage and accessibility
- `.agents/skills/design-system/` — three-layer token architecture
- `.agents/skills/ui-ux-pro-max/` — searchable recommendations and verification workflow
