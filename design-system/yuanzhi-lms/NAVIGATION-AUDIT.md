# Yuanzhi LMS Navigation Audit

> 本文件是桌面端导航与页面治理账本。它记录用户能够到达的入口、权限条件、深层页面、兼容路由和待决策问题。
> 它不替代 `MASTER.md` 或页面规范；全局设计规则仍以 `MASTER.md` 为准，具体页面规则仍放在 `pages/*.md`。

## 0. Document status

| Field | Value |
|---|---|
| Status | Active — inventory established, classification in progress |
| Version | 1.0 |
| Last reviewed | 2026-08-17 |
| Platform | Desktop Web only |
| Canonical route scope | Tenant portal, student app routes, management dashboard routes |
| Out of scope | Mobile bottom navigation, mobile sheets, gesture flows, API routes |

### Purpose

本文件用于回答四个问题：

1. 用户从哪里进入页面？
2. 该入口对哪些角色和权限可见？
3. 该页面是正式导航、二级导航、深层页面、兼容入口，还是应被删除的遗留项？
4. 逐页 UI 审核应该审核哪个页面模板，而不是机械地重复审核相同实现？

### Source of truth

- 学生应用定义：`src/lib/student-apps.ts`
- 学生端桌面导航：`src/app/dashboard/StudentSystemSidebar.tsx`
- 巩固中心二级导航：`src/app/dashboard/practice/PracticeHubNavigation.tsx`
- 管理端全局导航：`src/app/dashboard/admin/admin-navigation.ts`
- 管理端应用模块：`src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx`
- 管理端面包屑：`src/app/dashboard/ManagementBreadcrumbs.tsx`
- 路径作用域：`src/lib/dashboard-path.ts`
- 学生旧路径处理：`src/app/dashboard/legacy-redirect.ts`

路由文件存在不等于该路由是正式导航。正式入口必须能从以上运行时导航、页面内已批准入口或系统流程到达。

## 1. Status legend

| Status | Meaning | Review rule |
|---|---|---|
| `Canonical` | 当前正式、用户可见的导航入口 | 必须逐页或按模板完整审核 |
| `Conditional` | 受角色、租户开关、应用授权或能力权限控制 | 使用对应角色和权限状态审核 |
| `Secondary` | 页面内部的二级导航或应用模块入口 | 与父页面共同审核导航关系 |
| `Deep` | 由列表、卡片、通知或流程进入的详情页 | 按详情/学习/表单 archetype 审核 |
| `Flow` | 登录回调、下载、提交结果等流程页 | 审核状态与恢复路径，不作为主导航 |
| `Alias / Preview` | 兼容旧链接或员工前台预览 | 不建立独立视觉方向；验证跳转或视觉一致性 |
| `Pending` | 路由存在，但正式产品位置尚未确认 | 在确认前不得作为新导航扩展 |
| `Retired` | 已确认废弃 | 删除实现、引用和文档，不保留空壳入口 |

## 2. Runtime hierarchy

```text
Public entry
└── Tenant portal / application center
    ├── Student application
    │   ├── Primary sidebar
    │   ├── In-page secondary navigation
    │   └── Deep learning / detail / workflow page
    └── Management center
        ├── Global management sidebar
        ├── Application center
        ├── Application module
        └── Collection / detail / form / workflow page
```

页面审核必须沿此层级检查进入路径、当前位置、返回路径和状态保留，不得只检查孤立截图。

## 3. Inventory summary

当前 `src/app` 下共有 156 个 `page.tsx` 路由文件。它们不是 156 个独立设计：

| Scope | Route files | Governance interpretation |
|---|---:|---|
| Korean student app | 34 | 一级页面与多种课程、练习、测评深层页面 |
| Study-abroad student app | 16 | 一级服务页面与大学/课程详情流程 |
| English / Math / University student apps | 3 | 三个建设中应用首页，共用一种模板 |
| Management namespace | 56 | 全局管理、应用模块、集合、详情和表单 |
| Tenant dashboard namespace | 92 | 包含上述 56 个管理页及 36 个兼容/员工预览页面 |
| Remaining root/system pages | 11 | 登录、注册、权限、禁用、开发预览等 |

动态参数不同但组件与任务相同的路由，按一个页面模板审核，再做内容边界抽查。

## 4. Public and tenant portal

| Entry | Route | Status | Audience | Notes |
|---|---|---|---|---|
| Root | `/` | `Alias / Preview` | Public | 重定向至登录页 |
| Login | `/login` | `Canonical` | Public | 登录、错误和恢复状态均需审核 |
| Register | `/register` | `Canonical` | Public | 注册、校验和成功/失败反馈 |
| Login redirect | `/login/redirect` | `Flow` | Authenticated flow | 不作为导航入口 |
| Access denied | `/access-denied` | `Flow` | Unauthorized user | 必须提供明确恢复路径 |
| Account disabled | `/account-disabled` | `Flow` | Disabled account | 必须解释原因和联系路径 |
| Tenant portal | `/[space]` | `Canonical` | Tenant user | 应用中心、继续学习、账户菜单 |
| Profile dialog | Tenant portal account menu | `Secondary` | Tenant user | 当前是弹窗，不是独立路由 |
| Settings dialog | Tenant portal account menu | `Secondary` | Tenant user | 当前是弹窗，不是独立路由 |
| Development profile preview | `/dev-preview/profile` | `Pending` | Development only | 不进入正式 UI 审核队列 |

### Portal application catalog

| Application | Slug | Runtime status | Navigation rule |
|---|---|---|---|
| 韩语学习 | `korean` | Active | 租户开启、学生有效授权后显示 |
| 英语学习 | `english` | Coming soon | 建设中模板，不展开完整导航 |
| 数学学习 | `math` | Coming soon | 建设中模板，不展开完整导航 |
| 大学课程 | `university` | Coming soon | 建设中模板，不展开完整导航 |
| 留学服务 | `study-abroad` | Active | 租户开启、学生有效授权后显示 |

## 5. Student navigation

### 5.1 Shared topbar actions

| Action | Destination / behavior | Status | Notes |
|---|---|---|---|
| 返回应用中心 | `/[space]` | `Canonical` | 所有深层页面必须可达 |
| AI 学习助手 | Chat overlay | `Secondary` | 不应改变当前路由或丢失页面状态 |
| 通知提醒 | Reminder dialog / lesson deep link | `Secondary` | 未读状态和跳转后返回路径需审核 |
| 外观设置 | Popover | `Secondary` | 仅改变 Student OS 外观，不改变业务语义 |
| 退出登录 | Logout action | `Flow` | 与普通导航在视觉和空间上分离 |

### 5.2 Korean primary sidebar

Canonical base: `/[space]/apps/korean`

| Group | Label | Relative route | Status | Conditions |
|---|---|---|---|---|
| 学习 | 成长首页 | `/` | `Canonical` | — |
| 学习 | 韩语课程 | `/courses` | `Canonical` | 需要学生区访问权限 |
| 学习 | 巩固中心 | `/practice` | `Canonical` | 入口会恢复上次打开的巩固分区 |
| 学习 | 学习任务 | `/assignments` | `Conditional` | `learning_assignments` |
| 学习 | 会话练习 | `/conversation-practice` | `Conditional` | `conversation_course` |
| 成长记录 | 我的成绩 | `/grades` | `Canonical` | 需要学生区访问权限 |
| 成长记录 | 学习记录 | `/records` | `Canonical` | 需要学生区访问权限 |
| 成长记录 | 资料库 | `/library` | `Canonical` | 需要学生区访问权限 |
| 消息与服务 | 通知公告 | `/announcements` | `Conditional` | 学生可见；其他角色受公告权限控制 |
| 消息与服务 | 帮助中心 | `/help` | `Canonical` | — |
| 账户 | 个人资料 | `/profile` | `Canonical` | **NAV-002 Resolved 2026-08-17**：已建 `src/app/[space]/apps/korean/profile/page.tsx` 转发至现有 `dashboard/profile/page-content`，与 Portal 资料弹窗为两种不同触达路径，予以保留 |

VIP2 学生的“会话练习”会替换为 `/conversation-practice/ai-experience`，标签为“AI交流体验”。平台课程巡检员在其只读前台中看到“课程前台巡检”。

### 5.3 Korean secondary navigation

| Parent | Label | Route | Status |
|---|---|---|---|
| 巩固中心 | 课程巩固 | `/practice/course` | `Secondary` |
| 巩固中心 | 专项训练 | `/practice/skills` | `Secondary` |
| 巩固中心 | 错题复习 | `/practice/review` | `Secondary` |

### 5.4 Korean deep pages

| Page family | Route pattern | Status | Review unit |
|---|---|---|---|
| 课程分类 | `/courses/[categorySlug]` | `Deep` | Collection/catalog |
| 课程子分类 | `/courses/[categorySlug]/[subcategorySlug]` | `Deep` | Collection/catalog |
| 课程详情 | `/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | `Deep` | Learning detail |
| 课时学习 | `/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | `Deep` | Long-form/interactive lesson |
| 学习任务详情 | `/assignments/[assignmentId]` | `Deep` | Assessment detail |
| 韩语测试目录 | `/assignments/korean` | `Deep` | Assessment collection |
| 韩语测试运行器 | `/assignments/korean/[testSlug]` | `Deep` | Assessment runner |
| 会话场景详情 | `/conversation-practice/[scenarioId]` | `Deep` | Practice detail |
| AI 体验首页 | `/conversation-practice/ai-experience` | `Conditional` | AI practice overview |
| AI 快速体验 | `/conversation-practice/ai-experience/quick` | `Deep` | AI short flow |
| AI 正式练习 | `/conversation-practice/ai-experience/practice` | `Deep` | AI long flow |
| 会话课程 | `/conversation-practice/course` | `Deep` | Course/practice collection |
| 课程巩固目录 | `/practice/course` | `Secondary` | Practice collection |
| 课程巩固章节 | `/practice/course/[courseKey]/[chapterSlug]` | `Deep` | Practice runner |
| 专项训练目录 | `/practice/skills` | `Secondary` | Practice collection |
| 专项训练 | `/practice/skills/[skill]` | `Deep` | Practice runner |
| 词汇专项训练 | `/practice/skills/vocabulary` | `Deep` | Specialized runner |
| 训练章节 | `/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]` | `Deep` | Practice runner |
| 帮助工单详情 | `/help/tickets/[ticketId]` | `Deep` | Support conversation |
| 学习进度 | `/progress` | `Pending` | 未出现在正式侧栏，见 `NAV-004` |
| 旧工具箱目录 | `/toolbox` | `Pending` | 与巩固中心关系待确认，见 `NAV-004` |
| 旧工具箱技能 | `/toolbox/[skill]` | `Pending` | 与专项训练关系待确认，见 `NAV-004` |
| 旧词汇工具 | `/toolbox/vocabulary` | `Pending` | 与专项训练关系待确认，见 `NAV-004` |

### 5.5 Study-abroad primary sidebar

Canonical base: `/[space]/apps/study-abroad`

| Group | Label | Relative route | Status |
|---|---|---|---|
| 留学服务 | 服务首页 | `/` | `Canonical` |
| 留学服务 | 留学课程 | `/courses` | `Canonical` |
| 留学服务 | 目标大学 | `/universities` | `Canonical` |
| 留学服务 | 申请材料 | `/documents` | `Canonical` |
| 留学服务 | 签证准备 | `/visa` | `Canonical` |
| 消息与服务 | 通知公告 | `/announcements` | `Conditional` |
| 消息与服务 | 帮助中心 | `/help` | `Canonical` |
| 账户 | 个人资料 | `/profile` | `Canonical` |

### 5.6 Study-abroad deep pages

| Page family | Route pattern | Status | Review unit |
|---|---|---|---|
| 课程层级 | `/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` and parents | `Deep` | Reuse learning catalog/detail/lesson archetypes |
| 大学对比 | `/universities/comparison` | `Deep` | Comparison workspace |
| 大学资料库 | `/universities/library` | `Deep` | Collection |
| 大学详情 | `/universities/library/[universityId]` | `Deep` | Detail |
| 目标大学 | `/universities/targets` | `Deep` | Collection/form |
| 帮助工单详情 | `/help/tickets/[ticketId]` | `Deep` | Support conversation |

### 5.7 Coming-soon student apps

Canonical bases:

- `/[space]/apps/english`
- `/[space]/apps/math`
- `/[space]/apps/university`

每个应用当前只有“应用首页”。三者共用一种建设中 archetype，完整审核一次，再抽查标题、状态和返回路径。

### 5.8 Student compatibility and preview routes

| Pattern | Status | Rule |
|---|---|---|
| `/[space]/dashboard/*` for students | `Alias / Preview` | 自动迁移至 Korean 或 Study-abroad 应用路径 |
| `/dashboard/*` | `Alias / Preview` | 旧无租户路径按当前权限重定向 |
| `/[space]/dashboard/*` for staff | `Alias / Preview` | 可承担员工前台预览，不得建立第三套视觉系统 |
| `/[space]/live/[sessionId]` | `Deep` | 直播课堂流程，不是侧栏入口 |

## 6. Management navigation

Canonical base: `/[space]/dashboard/admin` or `/platform/dashboard/admin`

### 6.1 Global sidebar

| Group | Label | Relative route | Status | Roles / conditions |
|---|---|---|---|---|
| 工作台 | 管理首页 | `/` | `Conditional` | teacher, admin, ceo, tenant_super_admin, platform_super_admin |
| 工作台 | 应用中心 | `/apps` | `Conditional` | 上述角色及 tenant_operator |
| 工作台 | 课程前台巡检 | `/../courses` | `Conditional` | platform_course_inspector only |
| 内容中心 | 资料库管理 | `/library` | `Conditional` | admin, ceo, tenant_super_admin, platform_super_admin + capability |
| 消息与支持 | 通知公告管理 | `/announcements` | `Conditional` | admin, ceo, tenant_super_admin, platform_super_admin + capability |
| 消息与支持 | 帮助中心管理 | `/help` | `Conditional` | teacher, ceo, tenant_super_admin, platform_super_admin + capability |
| 平台与组织 | 模型用量 | `/token-usage` | `Conditional` | ceo, tenant_super_admin, platform_super_admin |
| 平台与组织 | Agent 运营中心 | `/agents` | `Conditional` | platform_super_admin only |
| 平台与组织 | 账号管理 | `/accounts` | `Conditional` | ceo, tenant_super_admin, platform_super_admin |
| 平台与组织 | 租户管理 | `/tenants` | `Conditional` | platform_super_admin, tenant_operator + capability |
| 平台与组织 | 权限中心 | `/permissions` | `Conditional` | platform_super_admin only |
| 侧栏底部 | 个人资料 | `/profile` | `Canonical` | 所有管理端角色 |

### 6.2 Role summary

| Role | Expected global entries before capability filtering |
|---|---|
| Teacher | 管理首页、应用中心、帮助中心管理 |
| Admin | 管理首页、应用中心、通知公告管理、资料库管理 |
| CEO | 管理首页、应用中心、公告、帮助、资料库、模型用量、账号管理 |
| Tenant super admin | 与 CEO 相同 |
| Tenant operator | 应用中心、租户管理 |
| Platform super admin | 管理首页、应用中心、公告、帮助、资料库、Agent 运营中心、模型用量、账号、租户、权限 |
| Platform course inspector | 课程前台巡检 |
| Student | 无管理端入口 |

### 6.3 Application center

应用中心包含 Korean、English、Math、University 和 Study-abroad。实际可见范围由平台角色、租户应用开关、员工应用分配和能力字段共同决定。

#### Learning application modules

Canonical pattern: `/admin/apps/[appSlug]/[section]`

| Module | Section | Status | Capability |
|---|---|---|---|
| 学生与教学分配 | `students` | `Secondary` | `manageStudents` |
| 课程与内容 | `content` | `Secondary` | `manageContent` |
| 作业与考试 | `assessments` | `Secondary` | `manageAssessments` |
| 互动教材 | `textbooks` | `Secondary` | `manageContent` |
| 成绩分析 | `grades` | `Secondary` | `viewAnalytics` |
| 学习记录 | `records` | `Secondary` | `viewAnalytics` |
| 练习工具 | `toolbox` | `Secondary` | `manageContent` |
| 会话与课堂 | `conversation` | `Secondary` | `manageAssessments` |
| 应用设置 | `settings` | `Secondary` | `manageTenantAvailability` |

Korean、English、Math 和 University 共用此模块结构。完整审核 Korean 模板，其余应用只做权限、数据隔离、标题和内容抽查。

#### Study-abroad service modules

| Module | Section | Status | Capability |
|---|---|---|---|
| 服务学生 | `students` | `Secondary` | `manageStudents` |
| 留学课程 | `content` | `Secondary` | `manageContent` |
| 目标大学 | `universities` | `Secondary` | `manageContent` |
| 申请材料 | `documents` | `Secondary` | `manageAssessments` |
| 签证管理 | `visa` | `Secondary` | `manageAssessments` |
| 服务记录 | `records` | `Secondary` | `viewAnalytics` |
| 服务分析 | `analytics` | `Secondary` | `viewAnalytics` |
| 应用设置 | `settings` | `Secondary` | `manageTenantAvailability` |

### 6.4 Management deep pages

| Parent | Route pattern | Status | Review unit |
|---|---|---|---|
| 账号管理 | `/accounts/[profileId]` | `Deep` | Detail/form |
| 租户管理 | `/tenants/[tenantId]` | `Deep` | Detail/form |
| 租户管理 | `/tenants/history` | `Deep` | Audit collection |
| 帮助中心 | `/help/tickets/[ticketId]` | `Deep` | Support conversation |
| 作业与考试 | `/assignments/[assignmentId]` | `Deep` | Detail/grading |
| 作业与考试 | `/assignments/chapter-tests` | `Deep` | Assessment workspace |
| 作业与考试 | `/assignments/homework` | `Deep` | Assessment workspace |
| 作业与考试 | `/assignments/exam` | `Deep` | Assessment workspace |
| 会话管理 | `/conversation-practice/[scenarioId]` | `Deep` | Detail/form |
| 资料审核 | `/documents/[studentId]` | `Deep` | Student case detail |
| 成绩管理 | `/grades/[itemId]` | `Alias / Preview` | **Resolved 2026-08-17**：已确认为纯 `redirect()` 存根，跳转至 `/dashboard/admin/grades`（成绩现直接读取作业/考试/章节测试结果，不再有独立成绩项目详情），无需代码改动 |
| 学校管理 | `/schools/overview` | `Deep` | Overview |
| 学校管理 | `/schools/[category]` | `Deep` | Collection |
| 学校管理 | `/schools/[category]/[schoolId]` | `Deep` | Detail/form |
| 签证管理 | `/visa/[studentId]` | `Deep` | Student case detail |
| 应用内作业 | `/apps/[appSlug]/assignments/[assignmentId]` | `Flow` | 当前用于跳转到正式应用作业模块 |

### 6.5 Live management routes not present in the global sidebar

以下直接路由曾经不在当前全局侧栏中分类。**NAV-005 Resolved 2026-08-17**：逐一读取实现后确认，全部 15 个路由都已统一调用共享 helper `redirectLegacyManagementRoute()`（`src/app/dashboard/admin/legacy-app-route.ts`），分类为 `Alias / Preview`（兼容重定向），无需代码改动：

| Route | Classification | Redirect target |
|---|---|---|
| `/admin/my-students` | `Alias / Preview` | 应用中心（原跨应用页面，无法映射单一模块） |
| `/admin/student-assignments` | `Alias / Preview` | 应用中心 |
| `/admin/assignments` | `Alias / Preview` | 应用中心 |
| `/admin/grades` | `Alias / Preview` | 应用中心 |
| `/admin/records` | `Alias / Preview` | 应用中心 |
| `/admin/conversation-practice` | `Alias / Preview` | Korean 应用 → `conversation` 模块 |
| `/admin/courses` | `Alias / Preview` | 应用中心 |
| `/admin/digital-textbook` | `Alias / Preview` | Korean 应用 → `textbooks` 模块 |
| `/admin/home-tree` | `Alias / Preview` | Korean 应用 → `content` 模块 |
| `/admin/question-bank` | `Alias / Preview` | Korean 应用 → `assessments` 模块 |
| `/admin/growth-toolbox` | `Alias / Preview` | Korean 应用 → `toolbox` 模块 |
| `/admin/schools` | `Alias / Preview` | Study-abroad 应用 → `universities` 模块 |
| `/admin/universities` | `Alias / Preview` | Study-abroad 应用 → `universities` 模块 |
| `/admin/documents` | `Alias / Preview` | Study-abroad 应用 → `documents` 模块 |
| `/admin/visa` | `Alias / Preview` | Study-abroad 应用 → `visa` 模块 |

候选结论只有四种：应用模块底层实现、正式深层入口、兼容重定向、`Retired`。不得因为路由仍能打开就自动认定为正式导航。

## 7. Known navigation issues

| ID | Priority | Issue | Evidence | Recommended decision |
|---|---|---|---|---|
| `NAV-001` | P0 | ~~旧 `DashboardSidebar.tsx` 无运行时引用，仍保存另一套导航~~ **Resolved 2026-08-17** | 全仓只找到组件定义，没有使用点（`LogoutButton.tsx` 仅注释提及，非引用） | 已删除 `src/app/dashboard/DashboardSidebar.tsx` |
| `NAV-002` | P0 | ~~学生侧栏“个人资料”被作用域化为应用内 `/profile`，但对应应用路由不存在~~ **Resolved 2026-08-17** | `scopeDashboardPath` 将 `/dashboard/profile` 映射为 `/[space]/apps/korean/profile`（study-abroad 同理），该路由文件确认不存在，真实 404，非文档误判 | 已建 `src/app/[space]/apps/korean/profile/page.tsx` 与 `src/app/[space]/apps/study-abroad/profile/page.tsx`，复用现有 `dashboard/profile/page-content` 实现（与 `/[space]/dashboard/profile/page.tsx` 完全同构）。Portal 弹窗保留为独立触达路径，不合并 |
| `NAV-003` | P0 | ~~Student sidebar 声明“后台管理”，但 Student App layout 会把非学生重定向到管理端~~ **Resolved 2026-08-17** | `DashboardRouteLayout.tsx`：`userRole !== "student"` 一律进入 `ManagementDashboardLayout`；`StudentDashboardLayout` 只服务 `student` 与 `platform_course_inspector`。因此 `StudentSystemSidebar` 内 `isAdmin`/`isTeacher` 永不为真，该分组零可达性 | 已从 `StudentSystemSidebar.tsx` 删除“后台管理”分组（`adminOnly`/`teacherVisible` 过滤逻辑保留，属通用基础设施，非本次删除对象） |
| `NAV-004` | P1 | ~~`/progress` 与 `/toolbox*` 存在但不在正式学生导航~~ **Resolved 2026-08-17** | 已读取实现：四个路由（`/progress`、`/toolbox`、`/toolbox/[skill]`、`/toolbox/vocabulary`）均已是纯 `redirect()` 存根，分别指向 `practice/course`、`practice/skills`、`practice/skills/${skill}`、`practice/skills/vocabulary` | 分类为 `Alias / Preview`（兼容重定向），实现已正确，无需改动，仅需文档重分类 |
| `NAV-005` | P0 | ~~多个管理端直接路由仍存活但不在正式侧栏~~ **Resolved 2026-08-17** | 逐一读取 15 个路由实现，全部已是 `redirectLegacyManagementRoute()` 兼容重定向 | 分类为 `Alias / Preview`，映射表见 §6.5，无需代码改动 |
| `NAV-006` | P1 | 进入管理应用模块后缺少持久的同级模块导航 | 当前主要依赖返回应用首页和面包屑 | 延后至 Batch 1（Shell 审核）一并决定是否增加桌面应用级侧栏/标签导航 |
| `NAV-007` | P2 | ~~`NAVIGATION_PRIORITY` 仍包含大量不在 `ADMIN_NAVIGATION` 的旧路径~~ **Resolved 2026-08-17** | 确认 14 个 key 对应 NAV-005 中已重分类为 `Alias/Preview` 的旧路径，在排序逻辑中零匹配（纯死条目，无功能影响） | 经 Codex luna-worker 任务包清理，`AdminWorkspaceSidebar.tsx` 中 `NAVIGATION_PRIORITY` 仅保留与 `ADMIN_NAVIGATION` 匹配的 10 个 key；`tsc --noEmit` 通过，diff 仅此文件、仅 14 行删除 |
| `NAV-008` | P2 | Student 和 Management 仍保留移动导航实现 | 当前项目范围仅为桌面端 | 本轮不审核、不扩展；未经用户要求不得顺手重构 |

## 8. Page-governance review queue

| Order | Batch | Scope | Status | Exit condition |
|---:|---|---|---|---|
| 0 | Navigation foundation | Resolve `NAV-001`–`NAV-005` | Approved 2026-08-17 | 没有死链接、重复正式入口或未分类一级入口 — NAV-001~005、007 已实施并验收；NAV-006 延后至 Batch 1（有明确理由，非 Pending）；NAV-008 本轮不处理（范围外，用户指令跳过） |
| 1 | Shared shells | Tenant portal, Student shell, Management shell | Approved 2026-08-17 | 导航位置、焦点、返回路径和内容宽度稳定 — 三个 Shell 已审核并修复（skip link、focus-visible、aria-current），`pages/tenant-portal.md`、`pages/management-shell.md` 已建；学生端 22 个子页面的重复 H1 已修复为 H2（`error.tsx` 作为独立错误边界正确排除），全仓扫描确认仅 shell H1 与该排除项保留 `<h1>` |
| 2 | Korean primary | 10 个正式一级页面 | Approved 2026-08-17 | 首页、集合、记录、支持页面遵守对应 archetype — 成长首页在 Batch 1 已处理；其余 8 页（课程/巩固中心/学习任务/会话练习/成绩/记录/资料库/公告/帮助）已审核并建立 `pages/student-korean-*.md`；4 个子组件（`KoreanCourseCatalogBrowser.tsx`、`AssignmentBoard.tsx`、`LibraryBrowser.tsx`、`HelpArticleBrowser.tsx`）的原生控件/硬编码色/嵌套 main/仅 placeholder 标签问题已全部修复并验证（无残留原生 hex/rgba，无嵌套 main） |
| 3 | Korean deep | Course, lesson, assessment, practice, AI conversation | Approved 2026-08-17 | 用模板审核完成，动态内容完成边界抽查 — 课程详情+25个课时模板、测评运行器（既有规范）、会话/AI体验、巩固章节+专项训练runner、帮助工单详情均已审核修复并独立核查通过（8 个新增 pages/*.md） |
| 4 | Study-abroad student | 7 个一级入口及大学/申请深层流程 | Approved 2026-08-17 | 服务流程、详情和返回路径完整 — 一级页面（服务首页/目标大学/申请材料/签证准备）与深层流程（大学对比/资料库/详情/目标 + 申请材料/签证子组件）均已审核修复并独立核查通过（`pages/student-study-abroad-primary.md`、`pages/student-study-abroad-deep.md`） |
| 5 | Coming-soon apps | English, Math, University | Approved 2026-08-17 | 共用模板一致、状态和返回路径正确 — 三者复用 `StudentApplicationHome.tsx`，该文件已在 Batch 4 完整修复；直接复核确认焦点/令牌/无障碍/返回路径均到位，无需新代码改动（`pages/coming-soon-app.md`） |
| 6 | Management global | Home, apps, support, organization | Approved 2026-08-17 | 按角色验证入口、空态和权限态 — 9 个全局侧栏入口审核完成，7 个已合规无需改动，2 个修复原生色/表格语义/文案；发现子组件层遗留问题记入 §7 待下批处理（`pages/management-global.md`） |
| 7 | Learning app management | 9 个学习应用模块 | Approved 2026-08-17 | Korean 完整审核，其余应用隔离抽查 — 6 个共享模块组件（Workspace/Catalog/People/Assessment/Settings/Section）全部审核修复，Korean/English/Math/University 共用同一实现（`appSlug` 参数化），一次审核覆盖四应用（`pages/management-learning-app-modules.md`） |
| 8 | Study-abroad management | 8 个服务模块 | Approved 2026-08-17 | 个案、材料、签证和分析流程完整 — 4 个专属组件（大学/材料/签证 listing + insight page）审核完成，共享 shell 已在 Batch 7 覆盖（`pages/management-study-abroad-modules.md`） |
| 9 | Management deep | Collections, details, forms, dialogs | Approved 2026-08-17 | 页面骨架和共享组件收敛 — 5 个子任务包（9a-9e）完成：累积欠账清理、学生/租户案例详情、学校集合/详情、作业/会话详情、作业与考试工作台、最终跨组件清理（错误处理/无障碍/破坏性操作确认），共 5 个新 pages/*.md |
| 10 | System states | Loading, empty, error, denied, disabled | Approved 2026-08-17 | 所有关键流程有明确恢复动作 — 21 个边界文件（根/dashboard error+loading、16 个路由 loading skeleton、not-found）审核完成：错误边界确认可用 retry+安全返回路径，not-found 提供有效跳转，loading 骨架统一遵守 `prefers-reduced-motion` 与语义令牌（`pages/system-states.md`） |
| 11 | Desktop verification | 1024/1280/1440/1920 and 100–200% zoom | **Approved 2026-08-17** | 无不可达操作、遮挡或非预期页面横向滚动。静态代码扫描（`pages/desktop-verification-static.md`）+ 真实交互验证均已完成：用户批准安装 Playwright，驱动真实登录（复用 `scripts/test-dashboard-session-refresh.cjs` 的临时账号认证模式）Chromium 对 11 个代表性页面（学生 6 + 管理端 5，覆盖全部 archetype）做横向溢出与 Tab 键焦点检测。首轮发现检测脚本假阳性（`overflow-x:hidden` 正确裁剪、Next.js dev tools 按钮被误判），修正后发现并修复一处真实无障碍 bug（`StudentStudyTrendPanel.tsx` 周期切换按钮的 `focus-visible` 环被内联 `box-shadow` 覆盖）。进一步发现 CSS `document.documentElement.style.zoom` 在本环境下测量失真（真实文字元素报告不可能的 `clientWidth:0`），改用视口按缩放系数真实收窄（如 1024px/150%→683px）的可靠方法重新验证，最终结果：132 项溢出检测 + 44 项焦点检测全部通过，0 违规，含最窄 512px 有效视口。验证脚本与完整报告：`.orchestration/verification/batch11-interactive.mjs` / `batch11-interactive-report.md`。`npm run check`、`git diff --check`、`npm run build` 均已通过。 |

## 9. Per-page audit record

每次开始一个页面时，在对应 `pages/*.md` 中记录以下内容：

```md
# [Page name]

- Route / pattern:
- Navigation parent:
- Audience and role:
- Status: Canonical / Conditional / Secondary / Deep / Flow
- Archetype:
- Primary job:
- Primary action:
- Entry paths:
- Back / exit path:
- State preservation:
- Loading / empty / error / permission states:
- Keyboard and focus risks:
- Desktop width and zoom risks:
- Shared components used:
- Raw styles or local design-system risks:
- Acceptance criteria:
- Review status: Not started / In review / Changes required / Approved
```

### Audit rule

- 同一实现由多个动态路由复用时，建立一个页面规范并列出 route pattern。
- 同一 archetype 但实现不同的页面必须分别检查，不得因为名称相似直接判定一致。
- `Pending` 页面在产品位置确认前可以诊断，但不得扩展新 UI。
- `Alias / Preview` 页面只验证跳转、权限和视觉一致性，不创建独立设计方向。
- 每批审核结束后更新本文件的状态和对应 `pages/*.md`，不得只在聊天记录里保留结论。

## 10. Immediate decisions required

逐页 UI 审核开始前，建议按顺序确认：

1. 学生个人资料最终采用 Portal 弹窗深链，还是正式独立账户页面？
2. 是否删除无引用的旧 `DashboardSidebar.tsx`？
3. 是否删除 Student sidebar 中当前不可达的“后台管理”分组？
4. `/progress`、`/toolbox*` 分别归入哪个正式一级导航，还是改为重定向/Retired？
5. 管理端旧直接路由与应用模块如何一一映射？
6. 管理应用内部是否需要持久的桌面二级导航？

在以上决策完成前，不建议开始批量页面美化。
