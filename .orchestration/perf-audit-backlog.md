# 全站性能诊断 backlog（桌面端）

日期：2026-08-17。仅诊断，未改 `src/`。查询次数均为静态代码上界/常规分支；Supabase 一个 `.from()`/`.rpc()`/Auth 调用计为一次远程往返。实际 RLS 内部 SQL 不可从客户端静态计数。

风险 lane：`mechanical`=纯机械/样板；`localized-judgment`=既有契约内局部实现判断；`auth-security-sensitive`=鉴权、权限、租户隔离、重定向或会话逻辑。

## 1. 全局结论

- 请求链：`proxy/updateSession(getClaims)` → scoped layout `requireDashboardAccess` → `getAuthContext(getUser → profiles → tenant_memberships → tenants)` → app/access gate → page loader。tenant 整页刷新固定约 5 个 Auth/DB 往返（middleware 1 + RSC 4），其中 RSC 4 个主要串行。
- `React cache()` 仅在同一次 RSC render 内去重 `auth/dashboard/management-app access`；未发现业务数据使用 `unstable_cache` 或 route `revalidate`。scoped dashboard 与 app 父 layout 均 `force-dynamic`。
- 同一 App Router layout 树内客户端 `<Link>` 会复用共享 layout；不能断言每次同-app软导航都重跑 topbar/layout。整页刷新、跨 app、segment 失效、legacy `/dashboard/**` 中转会完整重做；多数目标 page 自身仍调用 access/auth loader。
- 常规学生/管理侧栏使用 Next `<Link>` 且未设 `prefetch={false}`，production 默认 prefetch 有效。真正明确的缺口是 `window.location.assign/reload`、legacy URL 中转与带副作用的 render（后者反而不应贸然加强 prefetch）。
- Next 16 默认已优化 `lucide-react` package imports；`next.config.ts` 未显式配置 `optimizePackageImports` 不是单独缺陷。应先用 route chunk 证据评估 `@tanstack/react-table`、`@xyflow/react` 等，而不是盲配。
- 构建估算：学生常见 283–310 KiB gzip，管理常见 289–319 KiB；课程 lesson 374.8 KiB，live 354.5 KiB。详见 `perf-baseline.md`。

## 2. 页面/路由覆盖矩阵

共同学生链：`[space]/apps/{app}/layout` → `StudentAppRouteLayout` → `DashboardRouteLayout` → `StudentDashboardLayout` → sidebar/topbar/header → page wrapper → `src/app/dashboard/**/page-content` → client islands。共同管理链：`proxy` → `[space]/dashboard/layout` → `DashboardRouteLayout` → admin layout-content → page/feature service；app workspace 再经过 `apps/[appSlug]/layout`。

### 2.1 学生端

表内业务 RTT 不含共同整页刷新 auth 4 串行、app gate 2 并行、topbar 1–5；`D`=父 layout force-dynamic；普通 Link=客户端导航/default prefetch。

| 路径/页面组 | 组件/loader 链与业务 RTT | 串并行 | 导航/cache 结论 |
|---|---|---|---|
| `/`、`/login`、`/login/redirect` | root redirect；client login；`requireActiveUser` | login token 后按角色 redirect | `/` curl 0 HTTP redirect；登录链见 baseline；login 为 client/hydration 242.8 KiB gzip |
| `/[space]` portal | page → PortalTopbar/Profile/Settings；apps 2 + current course 5 | 约 7，主要串行 | D；canonical Link；发现 PERF-005 |
| `/[space]/apps/{english,math,university}` | `StudentApplicationHome`，本页 0 | 无业务查询 | D；已检查，无本页新增问题 |
| `/[space]/apps/study-abroad` | `StudentApplicationHome`，本页 0 | 无业务查询 | D；canonical Links；已检查无新增问题 |
| Korean home | `DashboardHomePage`，约 13+ | 主要串行并重复 auth/profile/topbar questions | D；PERF-004 |
| announcements | page-content，常规 1；管理预览租户名 +1 | 条件串行 | D；无主要本层瀑布 |
| assignments list | scope 3 → 7 并行 → attempts 1，约 11 | 关键链 5 阶段 | D；PERF-006/007 |
| assignment detail + Korean nested layout | page 3 并行 → answers；layout 重查 assignment | 约 5、3 阶段 | D；跨 layout/page 重复，PERF-008 |
| chapter tests list/detail | list 约 6/两批；detail 约 7 | 分批并行 | runner 大 client；PERF-012 |
| conversation hub/scenario/course/AI | hub/scenario 各 2 并行；course 1；AI quick/practice服务端 0 | 主业务合理 | AI experience 大 client；PERF-012 |
| courses catalog/category/subcategory/course/lesson | 约 8 / 13 / 5 / 12 / 19+1 write | 多级瀑布 | D；lesson 373.9 KiB；PERF-006/009 |
| grades | scope 3 → 4 并行 → 4 并行，约 11 | 5 阶段 | D；优先修 scope |
| records | 两 scope 并发（内部串行）→5→3，约 12+ | 5 阶段 | D；优先修 scope |
| library | scope 3 → resources+favorites 2 | 后段并行 | D；本层已检查无主要问题 |
| progress/practice course/review | review 1 → 4 类并行，约 9 | 分批并行 | Workbench 大 client；PERF-012 |
| toolbox hub/skill/training | hub 3 类并行；skill courses→lessons→5并行→questions，约11 | skill 明显串行 | D；PERF-006 |
| profile/settings | profile 1，头像时 signed URL +1；settings 0 | 条件串行 | settings 已检查无本页问题 |
| help/ticket | 各 2 并行 | 并行 | 已检查，无主要本层串行 |
| study-abroad universities | home/library/targets主查询并行；detail 1→3→1；comparison 1→1 | detail/comparison有依赖 | D；低于全局 auth/scope 优先级 |
| documents/visa | 2 并行 / 4 并行 | 并行 | 已检查，无主要本层串行 |
| live session | session loader → auth → participants/lesson/course 3 并行 | 两阶段 | force-dynamic；354.5 KiB |
| `/[space]/dashboard/**` student | scoped layout 鉴权后 redirect 到 app canonical | 首个 page 不渲染 | 额外 1 跳；legacy `/dashboard/**` 同理 |

枚举覆盖：`[space]/apps/**` 55 个 page（english 1、korean 35、math 1、study-abroad 17、university 1）；`[space]/dashboard/**` 非 admin 36 个 page；另 portal、root/login/legacy。完整逐路由 First Load 表在 baseline。

### 2.2 管理端

共同 authenticated tenant 整页刷新固定 `getClaims + getUser + profile + membership + tenant`；下表为页面/feature 额外 RTT。

| 路径/页面组 | 组件/loader 与业务 RTT | 串并行 | 结论 |
|---|---|---|---|
| `.../admin` | 10 access helpers → 最多 24 count/RPC | 两大波，高 fan-out | PERF-015 |
| `.../admin/apps` | catalog access；每 app 4 并行 count，`4*N` | app 间并行但线性扩张 | PERF-016 |
| `.../apps/[appSlug]` | app access 两权限查询 → 4 并行 metrics | tenant 权限两次串行 | PERF-017 |
| `.../students` | tenant 4 并行 → profiles；platform 7×5000 → 2×5000 | 2 波 | PERF-018/021 |
| assessments / assignment detail | 3(+1) 两波；detail 6 并行→answers | 合理首批并行 | detail 已检查无首批问题 |
| content | categories+courses → lessons → chapters → resources | 4–5 RTT，3–4 波 | PERF-019 |
| textbooks | permission → textbooks → versions → 3并行 → modules → nodes | 最多 9，至少 6 波 | PERF-019 |
| toolbox | permission；items+courses → lessons → textbooks → versions → chapters → modules → nodes | 7+ 波 | PERF-019 |
| grades | tenant 6 并行 → profiles；platform 大表聚合 | 2 波 | PERF-018/021 |
| records/analytics | documents+visas并行或 overview+students+notes并行 | 主查询并行 | 已检查，无新增主要问题 |
| documents/visa | tenant 3并行→profiles / 3并行→profiles；platform RPC | 2 波 | PERF-018 |
| universities | 1 + stage 数 + visa type 数，全并行 | fan-out 随枚举增 | PERF-020 |
| conversation | scenarios → progress → profiles | 3 波 | PERF-018 |
| settings | 除 cached app access，页面 0 | 无 | 已检查，无页面取数问题 |
| accounts/detail | membership → profiles+2 audits；detail membership→2并行 | 2 波 | PERF-018 |
| announcements | announcements → 4 并行依赖 | 2 波 | PERF-018 |
| help/ticket | articles+tickets；ticket+messages→student/membership→assignee | detail 3 波 | PERF-018 |
| library | resources/courses/categories/lessons 4并行 | 并行 | 已检查，无主要串行问题 |
| permissions | tenants/grants/audit/profiles/memberships 5并行 | 并行 | 已检查，无主要串行问题 |
| profile | profiles+staff并行；头像 +1 | 2 波 | 低优先级 |
| tenants/detail/history | 3 波 / 2 波 / 2 波 | 依赖 profiles | PERF-018 |
| token usage | usage+tenants → profiles | 2 波 | PERF-018 |
| schools detail | school+programs 2并行 | 并行 | 已检查，无主要串行问题 |
| my-students | profile 1；scoped route现为 redirect | 单查询 | legacy 迁移问题覆盖于 PERF-003 |
| unknown app section | parent app access → notFound | 无页面取数 | 已检查，无新增问题 |

全部 scoped legacy route（assignments、conversation、courses、digital-textbook、documents、grades、growth-toolbox、home-tree、my-students、question-bank、records、schools、student-assignments、universities、visa）经 `legacy-app-route.ts` 转 app canonical。直接 scoped legacy URL 为 1 跳；UI 中未 scope `/dashboard/admin/**` 先经 catch-all 时最多 2 跳。

## 3. Backlog

### PERF-001 — 请求级重复鉴权与 tenant 串行解析

- 页面/区域：全登录态站点
- file:line：`src/lib/supabase/middleware.ts:14-40`；`src/lib/auth.ts:89-165`
- 现象：整页刷新/跨 layout 导航同时 `getClaims()` 与 `getUser()`；tenant RSC 再串行 profile→membership→tenant。页面级 access helper 普遍重复出现，虽同 render 被 React cache 去重，middleware 与 RSC 不共享。
- 根因：边缘/session 刷新与 RSC 服务端验证各自远程调用；身份和租户上下文分表串行读取。
- 建议方向：先埋点分解 Auth/DB；不降低服务端验证和租户隔离前提下评估已验证 claims；用安全 RPC/单查询合并 profile+membership+tenant。明确验证同-app软导航实际 layout复用。
- 影响：high；风险：`auth-security-sensitive`

### PERF-002 — 全 scoped 树 force-dynamic，跨请求缓存缺口

- 页面/区域：`[space]/apps/**`、`[space]/dashboard/**`
- file:line：`src/app/[space]/dashboard/layout.tsx:9`；各 app `layout.tsx:5`；`src/lib/auth.ts:89`；`src/lib/management-apps.ts:112,263`
- 现象：动态权限外壳覆盖整树；只有 request-scope React cache，无业务 `unstable_cache/revalidate`。published curriculum、help、university catalog 等低频变更公共数据每次回源。
- 根因：个体授权与可缓存标准目录耦合在同一动态树/loader。
- 建议方向：保持个体/租户数据动态；只抽出不含用户/tenant私密数据的 published catalog loader，按 Next 16 当前 docs 选 tagged cache，并在变更 action 精确 revalidate。
- 影响：high；风险：`auth-security-sensitive`

### PERF-003 — Legacy URL 中转造成 1–2 跳和重复鉴权

- 页面/区域：学生/管理共享 page-content 与旧入口
- file:line：`src/app/dashboard/[...rest]/page.tsx:17-35`；`src/app/dashboard/admin/legacy-app-route.ts:12-22`；`src/app/dashboard/documents/page-content.tsx:212-221`；`src/app/dashboard/admin/schools/page-content.tsx:40-46`
- 现象：大量硬编码 `/dashboard/**`/`/dashboard/admin/**` 先 canonicalize；管理旧 route 再转 app section，最多两跳。prod 管理登录实际观察到 `/dashboard → /yuanzhi/dashboard → /yuanzhi/dashboard/admin`。
- 根因：canonical scoped/app path migration 未完成，组件未统一注入 base path。
- 建议方向：用 `scopeDashboardPath/getStudentAppPath` 生成已知 Link/action redirect/revalidate 目标；保留 legacy入口兼容但不让站内 UI 走它。
- 影响：high；风险：`auth-security-sensitive`

### PERF-004 — Korean 首页重复 auth/profile 与约 13+ RTT

- 页面/区域：`/[space]/apps/korean`
- file:line：`src/app/dashboard/DashboardHomePage.tsx:134-237,395-424,484-575`；`src/app/dashboard/StudentTopbar.tsx:37-45`
- 现象：cached `requireActiveUser` 后又 `auth.getUser + profiles`；scope 3串行，再依次 progress/time/lessons/courses/categories/questions；页面与 topbar重复取 `lesson_questions`。
- 根因：页面自行重建身份/目录/提醒上下文，独立 loader 无共享。
- 建议方向：复用 auth context；独立 time/progress并行；目录与活动用 join/RPC；提醒独立 Suspense并与 home共享 request loader。
- 影响：high；风险：`auth-security-sensitive`

### PERF-005 — 租户门户约 11 个固定 RTT

- 页面/区域：`/[space]`
- file:line：`src/app/[space]/page.tsx:130-200,212-342`
- 现象：auth/access 后 apps 与 enrollment 串行2；Korean current course 再 root→subcategory→courses→progress→lessons 5级。
- 根因：逐层 ID 查询与 enrollment 分表解析。
- 建议方向：apps+enrollment关系 select/RPC；current-course tenant安全聚合 RPC；published catalog单独缓存。
- 影响：high；风险：`auth-security-sensitive`

### PERF-006 — 学生课程 scope 与层级查询瀑布

- 页面/区域：courses、assignments、grades、records、library、toolbox
- file:line：`src/lib/student-app-data.ts:42-80`；`src/app/dashboard/courses/[categorySlug]/page-content.tsx:124-360`；`.../[courseSlug]/page-content.tsx:134-363`；`.../[lessonSlug]/page-content.tsx:273-729`
- 现象：scope 固定 categories→courses→lessons 3串行；课程分类/详情/课时约 8–19 个读取，多个同表重复。
- 根因：路径身份、目录、解锁、个体进度都用依赖 ID 的窄查询逐层拼装。
- 建议方向：先用 tenant/app安全 RPC/嵌套 select解析 route identity+目录；获得必要 ID 后 `Promise.all` 个体查询；只缓存公开目录。
- 影响：high；风险：`localized-judgment`（解锁/权限需 auth review）

### PERF-007 — scope loader 跨页面重复且无 memo/cache

- 页面/区域：学生 assignments/grades/records/library 等
- file:line：`src/lib/student-app-data.ts:42-80`；调用点 `assignments/page-content.tsx:109`、`grades/page-content.tsx:142`、`records/page-content.tsx:143-152`
- 现象：近似静态的 app course scope 每次固定 3 RTT，无 React cache/跨请求 cache。
- 根因：通用 helper 直接发请求，未区分公开目录与用户授权。
- 建议方向：先加 request memoization；再只对安全的 published ID 集合做 tagged cache或单 RPC。
- 影响：high；风险：`localized-judgment`

### PERF-008 — Assignment layout/page 重复取同一 assignment

- 页面/区域：Korean assignment detail
- file:line：`src/app/[space]/apps/korean/assignments/[assignmentId]/layout.tsx:11-25`；`src/app/dashboard/assignments/[assignmentId]/page-content.tsx:21-38`
- 现象：layout查 assignment_type，page并行再次查 assignment+questions+submissions。
- 根因：segment metadata/gate 与 page loader未共享。
- 建议方向：以 tenant/app/assignment参数化的 React-cached loader供 layout/page共享，或下移 section metadata。
- 影响：med；风险：`auth-security-sensitive`

### PERF-009 — Server Component render 路径产生进度写入

- 页面/区域：lesson detail
- file:line：`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx:638-729`
- 现象：十余读取后又 progress→chapter tests→ebook→attempts，并在已开始时 `lesson_progress.upsert`；刷新、RSC导航甚至预取可能写 last_viewed。
- 根因：学习行为记账耦合到 render。
- 建议方向：移到明确可见/播放/翻页事件或幂等 action/API；读取路径只读。修复前不要对这些链接显式强化 prefetch。
- 影响：high；风险：`auth-security-sensitive`

### PERF-010 — 电子书按钮强制整页刷新并走 legacy

- 页面/区域：Korean lesson books → tests
- file:line：`KoreanLevelOneLessonBook.tsx:1904`；`KoreanLevelOneLessonTwoBook.tsx:1596`；`KoreanLevelOneLessonSixBook.tsx:973`（同类 3–11）
- 现象：`window.location.assign('/dashboard/assignments/korean')` 完整 document navigation，再 legacy redirect。
- 根因：历史固定 URL 与非 App Router 导航。
- 建议方向：改 scoped canonical `Link/router.push`，在 PERF-009 消除 render write 后再验证 prefetch。
- 影响：med；风险：`localized-judgment`

### PERF-011 — 学生 shell hydration 边界过宽

- 状态：**DONE（2026-08-17）**。`StudentPageHeader` 已成为由既有 permission gate pathname 驱动的纯展示组件，不再是独立 client entry；GuideAgent 在学生门户和 app shell 均保留即时可用的轻量触发器，聊天实现仅首次点击后加载。代表学生路由同步首载统一减少约 27.0 KiB raw / 9.0 KiB gzip（-2.7% 至 -3.2%），异步 GuideAgent chunk 为 16.9 KiB raw / 6.0 KiB gzip。真实 `yuanzhi` 临时普通学生验证了移动侧栏开合、Fullscreen API 进入/退出、无权限课程拦截、标题随导航更新，以及 Guide chunk 点击前未请求/点击后请求并打开对话框；账号及关联数据最终全 0。
- 页面/区域：全学生 app shell
- file:line：`src/app/dashboard/layouts/StudentDashboardLayout.tsx:35-101`；`StudentSystemSidebar.tsx:1-59`；`StudentPageHeader.tsx:1-32`
- 现象：sidebar、fullscreen/PWA、permission gate、header、GuideAgent 等多个 client root 每页挂载；header仅pathname映射也为 client。
- 根因：交互状态边界上移，静态壳和重 agent一起 hydrate。
- 建议方向：profiler量化；静态 nav/title server化，仅抽活动态/抽屉 islands；GuideAgent交互时动态载入。
- 影响：med；风险：`localized-judgment`

### PERF-012 — 学生重 client 模块未按功能/章节拆分

- 页面/区域：lesson、progress、AI conversation、chapter tests
- file:line：`HangulInteractiveBook.tsx:1-39`；`KoreanLevelOneSmartTextbook.tsx:1-45`；`progress/page-content.tsx:26`；`KoreanChapterTestRunner.tsx:1`
- 现象：lesson 374.8 KiB gzip；Hangul静态导入4本巨大 client book；Workbench/AI/test runner默认进首载图。
- 根因：只动态拆了 `react-pageflip`，未拆 book/模式/交互工作台本身。
- 建议方向：按章节/模式 `next/dynamic`，默认关闭/未进入工作台延迟加载，提供稳定 loading boundary。
- 影响：high；风险：`localized-judgment`

### PERF-013 — 管理端巨型 client island 与关闭弹窗首载

- 页面/区域：digital textbook、growth toolbox、library/doc review editors
- file:line：`src/app/dashboard/admin/digital-textbook/DigitalTextbookManager.tsx:1-24`；`GrowthToolboxManager.tsx:1`；`features/growth-toolbox/components/growth-toolbox-action-dialogs.tsx:1`
- 现象：1710行 manager静态导入1533行 manager；默认关闭 dialog/editor 进入 route chunk/hydration；相关 admin 路由 314–318 KiB gzip。
- 根因：大型交互工作区互相静态引用，server/client边界太高。
- 建议方向：下移 client boundary；dialog/editor打开时 dynamic；共享展示模型避免两个巨岛互导。
- 影响：high；风险：`localized-judgment`

### PERF-014 — 包体配置需证据驱动，而非盲加 lucide

- 状态：**DONE（2026-08-17）**。`@xyflow/react` 图形预览已改为打开对话框后动态加载；同口径测量夹具首屏由 355,893 B 降至 303,040 B gzip（-52,853 B / -14.85%）。`@tanstack/react-table` 的三路由 A/B 构建逐字节相同，证据不支持新增 `optimizePackageImports`；未重复配置 `lucide-react`。详见 `logs/perf-batchI-report.md`。
- 页面/区域：全站 webpack client bundle
- file:line：`next.config.ts:3-27`；`AdminWorkspaceSidebar.tsx:6`；`CourseListDialog.tsx:15`
- 现象：root 122.6 KiB gzip，Supabase相关公共 chunk 50.7 KiB；局部还用 `@xyflow/react`、`@tanstack/react-table`。Next config无显式 optimizePackageImports，但 Next16 docs列 `lucide-react` 为默认优化。
- 根因：公共 client依赖与重路由组件图，而非已证实的 lucide barrel缺陷。
- 建议方向：先 bundle analyzer/webpack stats定位；Supabase只留需要的client边界；仅对非默认、确有 barrel成本的包验证 `optimizePackageImports`。
- 影响：med；风险：`mechanical`

### PERF-015 — 管理首页最多 24+ 查询 fan-out

- 页面/区域：`/[space]/dashboard/admin`
- file:line：`src/app/dashboard/admin/page-content.tsx:136-158,192-276`
- 现象：先等10个 access helper，再发最多24个 count/RPC；published/draft分别请求。
- 根因：卡片按指标独立查询，授权与指标分两波。
- 建议方向：tenant安全 summary RPC/view；可独立的授权/计数并发；严格最小字段，禁止跨租户统计泄漏。
- 影响：high；风险：`auth-security-sensitive`

### PERF-016 — 应用目录查询数按 `4*N` 扩张

- 页面/区域：admin apps catalog
- file:line：`src/app/dashboard/admin/apps/ManagementApplicationCatalogPage.tsx:65-126`
- 现象：每个可见 app 4个 count；app间虽并行，总 RTT 随 N 增长。
- 根因：per-card统计 loader。
- 建议方向：单 RPC/group-by一次返回各 app 指标并 tenant filter。
- 影响：med；风险：`auth-security-sensitive`

### PERF-017 — Tenant app 两个权限查询不必要串行

- 页面/区域：所有 tenant app管理 section
- file:line：`src/lib/management-apps.ts:310-333`
- 现象：`tenant_student_apps` 与 `staff_app_assignments` 独立却串行。
- 根因：顺序 await。
- 建议方向：`Promise.all`，保持错误与 deny语义一致。
- 影响：med；风险：`auth-security-sensitive`

### PERF-018 — 管理业务行后再查 profiles 的普遍第二波

- 页面/区域：accounts、announcements、people、grades、documents、conversation、help、tenants、token usage
- file:line：`features/accounts/api/service.ts:57-100`；`features/announcements/api/service.ts:34-77`；`features/grades/api/service.ts:164-285`；`features/tenant-management/api/service.ts:156-180`
- 现象：先取业务/成员 ID，再 `.in(id)` 查 profiles；多页固定两到三波。
- 根因：无关系 select或安全聚合接口。
- 建议方向：逐表验证 RLS/FK 后嵌套 select，或专用 tenant安全 RPC；同时分页/减字段。
- 影响：med；风险：`auth-security-sensitive`

### PERF-019 — Content/textbook/toolbox 管理树 3–7+ 波

- 页面/区域：admin app content/textbooks/toolbox
- file:line：`src/features/courses/api/service.ts:62-121`；`digital-textbook/api/service.ts:107-189`；`growth-toolbox/api/service.ts:54-185`
- 现象：categories/courses→lessons→chapters/resources；textbook/toolbox逐层 versions/modules/nodes，最多9查询、7+波。
- 根因：客户端拼装层级树且提前加载未选择节点。
- 建议方向：嵌套 select/安全 RPC 返回必要树；同层并行；选中节点才延迟取详情。
- 影响：high；风险：`localized-judgment`

### PERF-020 — Universities 按枚举 fan-out

- 页面/区域：admin universities
- file:line：`src/features/universities/api/service.ts:100-121`
- 现象：每个 admission stage/visa type一条查询，虽并行但随枚举增长。
- 根因：按筛选值循环发请求。
- 建议方向：一次 `in(...)`/受控全量后分组，或 RPC。
- 影响：med；风险：`localized-judgment`

### PERF-021 — Platform overview 拉取 7×5000 + 2×5000 行到 Node

- 页面/区域：平台 app overview/people/grades等
- file:line：`src/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage.tsx:29-82`
- 现象：首波7张表最多5000行，次波2张表最多5000，网络/内存/CPU高且截断会使指标失真。
- 根因：服务端应用层聚合代替数据库 group-by。
- 建议方向：数据库端按 tenant/time window聚合 RPC，只返回小结果；明确截断/时间窗语义。
- 影响：high；风险：`auth-security-sensitive`

### PERF-022 — Data sync “重新检查”整页 reload

- 页面/区域：admin data sync dialog
- file:line：`src/app/dashboard/admin/DataSyncStatusDialog.tsx:63`
- 现象：`window.location.reload()` 重做 session与所有页面查询。
- 根因：局部状态检查使用 document reload。
- 建议方向：`router.refresh()`或局部 action/API只刷新同步状态。
- 影响：low；风险：`mechanical`

## 4. 已检查，无新增发现

- English/math/university/study-abroad建设中首页：本页无 Supabase，仍承担共同 app gate/shell。
- Student help、visa、university library/targets、documents：主业务查询已 `Promise.all`；优先处理全局 auth/scope。
- Admin settings：除 cached app access无页面读；library 4查询、permissions 5查询、assignment detail首波6查询、schools detail2查询均已并行。
- 主学生/管理 sidebar：Next `<Link>` 客户端导航且 default production prefetch；不记录为“全站缺 prefetch”。
- `lucide-react`：Next 16内置 optimize package imports；不建议重复配置作为独立优化。

## 5. 验收与 handoff

| 验收项 | 状态 | 证据 |
|---|---|---|
| 两报告完整 | PASS | baseline含dev/prod、登录、153路由JS、proof；本文件含22条backlog与覆盖矩阵。 |
| git status仅两报告 | FAIL（前置状态） | 本任务无 `src/` 修改且仅写两报告；但开始前已有未跟踪 `.orchestration/perf-governance-state.md`，保留用户文件。 |
| 测试账号创建/使用/清理 | PASS | baseline列 UUID、创建行、登录链、audit 422–425与最终全0。 |
| 学生/管理主要分组覆盖 | PASS | 上述矩阵覆盖所有主要 app/legacy分组，并列已检查无发现。 |

建议后续执行顺序：先 `PERF-001/003/009` 的 auth-security-sensitive lane；并行处理 `PERF-006/015/019/021`；再根据 bundle trace处理 `PERF-012/013/014`；最后机械项 `PERF-022`。任何缓存/RPC合并必须以 tenant_id、RLS与角色 deny-path 回归测试为验收条件。
