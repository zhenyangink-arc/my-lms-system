# Codex 新任务完整交接文档

更新时间：2026-08-15（Asia/Seoul）
项目：`/home/yangzhen/projects/my-lms-system`
当前分支：`main`
远端 Supabase：`my-lms-system`，project ref `jubdbsjsalpecfvseskz`，Seoul

## 1. 新任务先做什么

新任务接手后，严格按以下顺序开始，不要先改代码：

1. 完整阅读项目根目录 `AGENTS.md`。
2. 阅读本文档，并执行 `git status --short --branch`。
3. 不得运行 `git reset --hard`、`git checkout --`、`git clean`，不得删除或覆盖当前大规模未提交改动。
4. 先验证新沙箱是否已加载网络权限：

   ```bash
   curl -I --max-time 15 http://100.125.173.55:3000/login
   ```

5. 预期得到 `HTTP/1.1 200 OK`。如果仍是 `failed to open socket: Operation not permitted`，先处理任务权限，不要把它误判成 Next.js 故障。
6. 再验证数据库迁移状态：

   ```bash
   SUPABASE_TELEMETRY_DISABLED=1 npx supabase migration list
   SUPABASE_TELEMETRY_DISABLED=1 npx supabase db push --linked --include-all --dry-run
   ```

7. 确认数据库没有待推迁移后，再进行登录态浏览器冒烟测试。
8. 每完成一个小步骤立即验证，不要把管理端后续工作一次性堆积到最后测试。

## 2. 当前核心目标

项目正在从“一个学生 dashboard 混放韩语、英语、数学、大学课程和留学服务”重构成：

- `/{space}` 是租户入口；例如 `/yuanzhi` 中的 `yuanzhi` 是租户 slug，不是产品名。
- 租户入口列出互相隔离的学生应用。
- 韩语、英语、数学、大学课程、留学服务从源头拆成独立应用域。
- 当前学生端主要完成韩语应用与留学服务应用的迁移。
- 当前阶段正在继续管理端，管理端也必须按应用域拆分内容、学生、作业考试和数据权限。
- 这是开发环境，但多租户、RLS、角色权限必须一次到位，不能用“暂时只有测试租户”作为绕过理由。

## 3. 用户已经确认的产品与架构原则

以下要求不可擅自反向修改：

### 3.1 租户与路由

- `/{space}` 的第一段始终代表租户或平台空间。
- 学生租户门户：`/{space}`，例如 `/yuanzhi`。
- 韩语应用：`/{space}/apps/korean`。
- 英语应用：`/{space}/apps/english`。
- 数学应用：`/{space}/apps/math`。
- 大学课程应用：`/{space}/apps/university`。
- 留学服务应用：`/{space}/apps/study-abroad`。
- 旧 `/{space}/dashboard/...` 学生路由只作为兼容入口，应重定向到对应新应用。
- 不要为了“地址简单”继续保留旧架构作为主路径。
- 个人资料和完整设置不再属于学习 dashboard，应放在租户门户 `/{space}` 的账号菜单/弹窗中。

### 3.2 学生应用状态

当前应用注册表定义如下：

| slug | 名称 | 类型 | 默认状态 |
| --- | --- | --- | --- |
| `korean` | 韩语学习 | learning | active |
| `english` | 英语学习 | learning | coming_soon |
| `math` | 数学学习 | learning | coming_soon |
| `university` | 大学课程 | learning | coming_soon |
| `study-abroad` | 留学服务 | service | active |

应用显示还必须同时受以下三层约束：

1. 全局 `student_apps` 注册。
2. 租户 `tenant_student_apps` 是否启用/隐藏。
3. 学生 `student_app_enrollments` 是否处于有效授权时间范围内。

### 3.3 安全与数据隔离

- 所有学生学习事实、作业、电子书进度、练习、成绩必须带租户边界。
- 应用域数据必须用稳定的 `student_app_id` 隔离，不能只在前端根据分类 slug 猜测。
- 学生只能读取和操作自己的数据。
- 教师只能读取被分配学生、被分配应用域和被授权能力范围内的数据。
- 租户管理角色不能越过本租户。
- 平台角色与租户角色要分开判断。
- 高权限数据库操作必须在服务端再次验证租户、角色和应用能力，不能只依赖按钮隐藏。
- 不得关闭 RLS 来解决权限报错。

### 3.4 工作方式

- 用户要求“一步步来，做完一步验证一步”。
- 当前工作树包含大量用户认可的修改，必须保存并继续，不得重置。
- 旧学生端布局快照必须保留；旧五主题运行系统已在 2026-08-17 经用户明确确认后删除，不得根据本文旧版本恢复。
- 若修改 Next.js 代码，先阅读 `node_modules/next/dist/docs/` 中对应 Next.js 16.2.10 指南；本项目不是旧版 Next.js 约定。

## 4. 当前 Git 工作树状态

文档生成前状态：

- 分支：`main...origin/main`。
- 最新提交：`fdbeb62 full-task: completed full task`。
- 当前修改尚未提交、尚未暂存。
- `git diff --stat`：约 94 个已跟踪文件变化，约 `8741 insertions / 2307 deletions`，另有多个未跟踪的新路由、组件和迁移。
- 不要假设这些修改都属于一次可随意回滚的实验；它们包含本轮学生端、电子书、成绩、记录、工具箱、主题和应用域架构成果。

两个旧迁移文件当前显示为删除：

- `supabase/migrations/20260721000198_account_permission_helpers_baseline.sql`
- `supabase/migrations/20260721000199_is_owner_account_baseline.sql`

对应较早版本号文件存在于当前工作树：

- `supabase/migrations/202607200010_account_permission_helpers_baseline.sql`
- `supabase/migrations/202607200011_is_owner_account_baseline.sql`

远端迁移列表已经包含 `202607200010` 和 `202607200011`。不要未经核对就恢复两个被删除文件，否则可能重新制造迁移版本冲突。

## 5. 已实现的学生应用域架构

### 5.1 关键代码

- `src/lib/student-apps.ts`
  - 应用 slug、稳定 UUID、标题、状态和路径生成器。
- `src/lib/student-app-data.ts`
  - 按 `student_app_id` 获取课程范围。
  - 仍保留迁移部署前的 schema fallback；远端现已部署新 schema，后续不要依赖 fallback 掩盖真实错误。
- `src/app/[space]/page.tsx`
  - 租户学生门户。
  - 按租户启用状态和学生 enrollment 过滤应用。
  - 个人资料和设置已移到门户账号菜单。
- `src/app/[space]/PortalTopbar.tsx`
- `src/app/[space]/PortalAccountMenu.tsx`
- `src/app/[space]/PortalSettingsPanel.tsx`
- `src/app/[space]/apps/`
  - 新的独立学生应用路由树。
- `src/app/dashboard/StudentAppRouteLayout.tsx`
- `src/app/dashboard/StudentApplicationHome.tsx`
- `src/app/dashboard/StudentSystemSidebar.tsx`
- `src/app/dashboard/StudentSystemTopbar.tsx`
- `src/app/dashboard/legacy-redirect.ts`
  - 旧 dashboard 路由到新应用路由的兼容映射。

### 5.2 新路由范围

韩语应用已经包含：

- 首页
- 课程与电子书
- 作业与考试
- 成绩
- 学习记录
- 成长工具箱
- 会话练习
- 深化学习
- 资料库
- 公告与帮助

留学服务应用已经包含：

- 目标大学
- 大学资料库与对比
- 申请材料
- 签证准备
- 公告与帮助

英语、数学、大学课程目前主要是独立应用入口与 coming-soon 壳层，不能误写成已经完成全部业务。

## 6. 已实现的管理端应用域架构

### 6.1 管理端入口

- 租户管理端：`/{space}/dashboard/admin/apps`
- 平台管理端：`/platform/dashboard/admin/apps`
- 单应用工作区：`/{space}/dashboard/admin/apps/{appSlug}`
- 分区：`/{space}/dashboard/admin/apps/{appSlug}/{section}`

### 6.2 关键代码

- `src/lib/management-apps.ts`
  - 统一解析平台/租户角色、租户应用状态、员工应用授权和能力标志。
- `src/lib/management-app-path.ts`
- `src/app/dashboard/admin/apps/`
  - `ManagementApplicationCatalogPage.tsx`
  - `ManagementApplicationWorkspacePage.tsx`
  - `ManagementApplicationSectionPage.tsx`
  - `ManagementApplicationPeoplePage.tsx`
  - `ManagementApplicationAssessmentPage.tsx`
  - `ManagementApplicationSettingsPage.tsx`
  - `actions.ts`
- `src/app/[space]/dashboard/admin/apps/`
  - 实际 App Router 入口和服务端布局守卫。
- `src/app/dashboard/admin/admin-navigation.ts`
  - 已补管理端“应用管理”入口。

### 6.3 管理端能力模型

应用授权角色：

- `administrator`
- `operator`
- `teacher`
- `viewer`

能力字段：

- `can_manage_students`
- `can_manage_content`
- `can_manage_assessments`
- `can_view_analytics`

平台账号与租户账号使用不同能力推导。关键写操作在服务端 action 中再次调用 `requireManagementAppAccess`，不要退化成纯前端判断。

### 6.4 管理端导航兼容原则

- “应用中心”是应用域的聚合入口，不能替代老师和管理员已经获授权的日常直达入口。
- 容易被误用的 `legacyApplicationEntry` 字段已经删除；导航配置中不再保存“旧入口”状态。
- 导航最终是否显示仍由角色、租户范围和具体能力标志共同决定，不能为了恢复入口而绕过权限判断。
- teacher 在权限允许时应保留作业考试管理、会话练习管理、我的学生、成绩管理、学习记录管理等常用入口。
- 侧边栏与管理首页共用 `getVisibleAdminNavigation()`；修改时必须同时验证两处，避免一处有入口、一处缺模块。
- `tests/admin-navigation.test.mjs` 固定全部后台身份的导航契约：平台负责人、平台副负责人、平台管理员、平台课程巡检员、机构负责人、机构 CEO、机构管理员和老师；同时校验学生没有管理导航。提交前运行 `npm run check`。
- 数据库中的 `platform_deputy` 归一化为 `tenant_operator`，`platform_admin` 使用 `admin` 角色并结合平台全局身份推导能力；修改导航时必须同时覆盖这两个映射。
- `npm run build` 和 `npm run build:cloudflare` 都会先自动执行导航契约测试，避免缺少关键入口的版本被构建发布。

### 6.5 管理端仍需验证

管理端代码和数据库迁移已经完成第一阶段，但登录态浏览器测试尚未完成。必须覆盖：

- 平台 owner/admin/deputy 的应用目录差异。
- 租户超级管理员/CEO、admin、teacher 的应用目录差异。
- 未分配 `staff_app_assignments` 的普通员工不能进入应用工作区。
- teacher 只能管理授权应用下的学生和评估范围。
- 不同租户之间不可互相读取或写入 enrollment、教师分配和内容。
- 隐藏/禁用租户应用后，学生门户和管理端普通员工入口同步消失。

## 7. 数据库迁移状态

### 7.1 远端已登记到 202608150008

用户在普通终端执行的 `npx supabase migration list` 已确认本地和远端以下迁移一致：

- `202608140001_chapter_test_requires_ebook_completion.sql`
- `202608140002_reset_corrupt_ebook_reading_time.sql`
- `202608150001_ebook_completion_uses_active_time.sql`
- `202608150002_idempotent_ebook_reading_segments.sql`
- `202608150003_student_grade_skill_profiles.sql`
- `202608150004_toolbox_practice_ability.sql`
- `202608150005_student_application_domains.sql`
- `202608150006_tenant_scoped_ebook_progress.sql`
- `202608150007_korean_chapter_test_app_guard.sql`
- `202608150008_admin_application_access.sql`

### 7.2 每个迁移的作用

#### `202608140001`

- 数据库层强制章节测试必须满足电子书前置条件。
- 限制异常阅读时间增量。

#### `202608140002`

- 重置历史损坏的电子书阅读时长。

#### `202608150001`

- 章节完成改为有效活跃学习时间逻辑。
- 不再依赖翻到最后一页完成章节。

#### `202608150002`

- 阅读时间按 `client_event_id` 幂等写入。
- 防止刷新、重试或重复请求重复累计。

#### `202608150003`

- 创建 `student_grade_skill_profiles` 安全视图。
- 只汇总老师作业和正式考试最近一次已批改提交。
- 章节测试和 quiz 不进入成绩中心六维能力画像。
- 当前视图按 `grade_category + skill` 汇总，不是按课程分别生成；若以后恢复“每门课程一个雷达图”的需求，必须修改视图分组和 UI，不能只在前端假分组。

#### `202608150004`

- 独立的成长工具箱练习数据模型。
- 练习、题目、答案密钥、session、attempt、evaluation 均与课程成绩数据源分离。
- 数据库安全函数负责核验答案，客户端不能自行声明得分。
- 创建最近 30 天六维练习能力画像。

#### `202608150005`

- 创建 `student_apps`、`tenant_student_apps`、`student_app_enrollments`。
- 给课程分类、课程、作业、章节测试、电子书进度、学习时长和工具箱事实补 `student_app_id`。
- 为新租户自动 seed 应用目录。
- 为现有韩语学习事实回填韩语应用域。
- 增加 RLS、索引和同步触发器。

#### `202608150006`

- 电子书进度继续按 tenant 约束。
- 教师读取学生电子书进度必须满足教师分配关系。

#### `202608150007`

- 韩语章节测试增加应用域守卫。
- 防止学生通过直接 URL 越过韩语应用 enrollment。

#### `202608150008`

- 创建管理端 `staff_app_assignments`。
- 扩展教师-学生分配，使其携带 `student_app_id`。
- 建立租户级、平台级 RLS 和管理端安全 RPC/写入能力。

### 7.3 历史修复和 CLI 警告

- `202608080002` 至 `202608080007` 曾因远端对象已经存在、迁移历史缺记录而失败。
- 已执行 `supabase migration repair --status applied` 修复历史，之后推送成功。
- 推送时出现过 Supabase CLI `pg-delta` 缓存证书文件缺失警告：`pgdelta-target-ca.crt ENOENT`。
- 该警告发生在迁移应用完成后的 catalog cache 阶段；后续 `migration list` 已确认远端记录完整。
- 不要因该警告重复执行迁移或手动删除表。

## 8. 电子书阅读、章节完成和测试解锁

### 8.1 当前规则

- 韩语字母入门共四章：
  - `hangul-recognition`
  - `vowels-and-consonants`
  - `batchim-and-reading`
  - `pronunciation-rules-and-reading`
- 每章学习目标当前按有效阅读时间判断，目标值由 `EBOOK_CHAPTER_TARGET_SECONDS` 统一定义。
- 用户明确要求：只按有效时间，不按翻了多少页。
- 仅翻到最后一页停留不能自动伪造完成；必须累计有效活跃时间。
- 1 分钟没有鼠标/键盘等活动会弹出警告并暂停计时。
- 页面隐藏、离开、刷新时会先 flush 已累计片段。
- 阅读片段按事件 UUID 幂等保存到数据库。
- `window.crypto.randomUUID()` 已有兼容 fallback，避免旧浏览器报错。
- 已处理退出电子书时 Hook 数量变化导致的 `Rendered more hooks than during previous render`。

### 8.2 页面表现

- “本章阅读”只显示数据库累计总阅读时间，不显示阅读进度条。
- “本章学习目标”显示剩余时间/已达标，并用同一时间值驱动进度条。
- 不显示“已达标 +05:07”之类超额时间。
- 刷新后应以数据库时间为基线，加上尚未确认的本地片段，而不是从 10 分钟或 0 重新开始。
- 最后一页“进入本章测试”在学习目标未达标时必须带锁且不能跳转。
- 达标后按钮跳转到该租户韩语应用的作业与考试页面，而不是旧无租户 `/dashboard/assignments`。
- 书签会在左侧学习目录显示，可点击目录标记取消。
- 本章笔记与书签目前保存在浏览器 localStorage，不是数据库跨设备同步；不要在交接时误称已入库。
- 学习工具中的朗读速度显示为“慢速 / 标准 / 快速”，内部速率分别为 `0.8 / 1 / 1.2`，不显示 `0.8x / 1.0x / 1.2x`。

### 8.3 解锁顺序

- 第一章电子书有效时间达标后才能进行第一章测试。
- 第一章测试通过后，可以进入第二章电子书。
- 第二章测试仍需第二章电子书有效时间达标后才能解锁。
- 后续章节都遵循同一逻辑：上一章测试通过解锁下一章学习，当前章学习达标解锁当前章测试。
- 作业与考试页未解锁卡片可提供“去学习该电子书”的链接，但不能把测试本身提前解锁。
- 数据库触发器和应用层守卫都必须保留，不能只靠 UI 锁图标。

关键文件：

- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/HangulInteractiveBook.tsx`
- `src/app/api/ebook-progress/route.ts`
- `src/lib/korean-ebook-progress.ts`
- `src/lib/korean-learning-unlocks.ts`
- `src/app/dashboard/assignments/AssignmentBoard.tsx`
- `src/app/dashboard/assignments/korean/`

## 9. 成绩页面

当前用户最终确认的顶层结构：

- 章节测试成绩不在“我的成绩”中心展示。
- 老师作业与正式考试完全分开。
- 两类分别生成一个六边形能力画像。
- 六个维度固定为：听力、口语、阅读、写作、语法、词汇。
- 只使用有明确能力标记的逐题成绩；没有能力标记的成绩仍出现在明细，但不强行分配进雷达维度。

关键实现：

- `src/components/analytics/SixDimensionRadar.tsx`
- `src/app/dashboard/grades/GradeBoard.tsx`
- `src/app/dashboard/grades/page-content.tsx`
- `supabase/migrations/202608150003_student_grade_skill_profiles.sql`

注意：更早讨论过“每门课程分别一个雷达图 + 综合图”，但当前已实现且数据库已部署的是“老师作业一个 + 正式考试一个”。新任务不能把更早讨论稿误当成当前已实现结构；如用户重新要求按课程拆分，需要先确认与两大类别如何组合。

## 10. 成长工具箱

### 10.1 当前练习类型

- 听力
- 口语
- 阅读
- 写作
- 语法
- 词汇

已新增阅读和写作入口，并复用统一练习 runner。

### 10.2 六维能力数据必须与成绩独立

- 工具箱雷达图只使用 `toolbox_practice_*` 练习数据。
- 成绩页只使用老师作业/正式考试数据。
- 两边只复用 `SixDimensionRadar` 的视觉组件，绝不能复用事实数据。
- 工具箱能力参考最近 30 天有效练习。
- 当前 UI 表示至少达到有效作答门槛后才形成能力值。
- 单纯停留时间不能直接增加能力分。

关键文件：

- `src/app/dashboard/toolbox/page-content.tsx`
- `src/app/dashboard/toolbox/[skill]/page-content.tsx`
- `src/app/dashboard/toolbox/[skill]/ToolboxPracticeRunner.tsx`
- `src/app/dashboard/toolbox/actions.ts`
- `supabase/migrations/202608150004_toolbox_practice_ability.sql`

成长工具箱页头专属标题和新应用域路径已补。用户明确说保存的旧版侧边栏暂时不需要同步成长工具箱，不要主动改旧快照。

## 11. 学习记录页

当前实现位于：

- `src/app/dashboard/records/LearningRecordBoard.tsx`
- `src/app/dashboard/records/page-content.tsx`

已实现方向：

- 全年 GitHub 风格学习热力图，但为项目内自定义实现，没有新增 `react-github-calendar` 依赖。
- 今日时长、本周时长、连续学习、完成事件等总览。
- 连续天数和热力图来自数据库学习记录，不是静态卡片。
- 最近 30 天分析、学习投入、主要学习活动和建议。
- 课程学习记录按今天、昨天、上周等时间分组，可折叠。
- 记录卡片在宽屏使用四列排布，避免单列过长。
- 课程层级需要清楚显示“韩语字母入门 · 第 2 章”以及其下“元音和辅音”，不要把章节和标题挤在同一行造成层级不清。
- 已去掉用户认为没有价值的“课程有效学习”解释卡片和“继续学习 2026/08/15...”式冗余记录。

## 12. 学生端视觉系统与主题

### 12.1 已移除的旧主题运行系统

2026-08-17 用户明确要求删除阳光青提、极光紫、蜜桃珊瑚、曜石黑、云瓷白五套旧主题。现行代码不再使用 `ThemeSwitcher.tsx`、`BackgroundBrightnessControl.tsx`、`data-app-theme` 或 `app-dashboard-theme`。原云瓷白数值仅作为无主题名称的中性全局基线保留。

不要恢复旧主题切换器。Student OS 的 `auto / morning / afternoon / night` 是现行学生系统内部的分时背景模式，不属于上述旧主题。

旧学生端布局快照保存在：

- `src/app/dashboard/legacy-v1/README.md`
- `src/app/dashboard/legacy-v1/StudentDashboardLayout.tsx.snapshot`
- `src/app/dashboard/legacy-v1/StudentTopbar.tsx.snapshot`

### 12.2 当前“学习应用窗口”视觉系统

- 当前学生学习区域采用软件窗口式布局。
- 左侧系统导航、顶部系统栏、内容卡片和悬浮助手组成统一应用窗口。
- 不再使用底部“总览 / 课程 / 作业 / 成绩 / 记录”导航。
- F11 全屏时应用窗口应占满网页可用空间。
- 整体背景、窗口玻璃、一级卡片、二级卡片、三级卡片分层。
- 设置按钮打开不透明的本地设置弹窗，不跳转完整设置页。
- 透明度设置包括：
  - 学习应用窗口
  - 一级卡片
  - 二级卡片
  - 三级卡片
  - 按钮背景
  - 下拉菜单
- 最大透明度设置为 95%。
- 设置弹窗本身保持实底，不受下拉菜单透明度控制。
- 问问学习助手应可拖动并有关闭按钮。

### 12.3 网页背景时间主题

`StudentSystemTopbar.tsx` 当前支持：

- 自动
- 上午
- 下午
- 晚上

自动时间规则：

- 05:00–11:59：上午
- 12:00–17:59：下午
- 其他时间：晚上

设计决策：

- 上午使用最初认可的蓝色背景。
- 下午使用暖色背景。
- 晚上直接使用暗夜黑。
- 卡片和文字颜色要跟随背景保证可读性。
- 以后优先通过网页大背景换色，卡片玻璃层级保持统一可调。
- 不要重新添加此前已撤掉的夸张色晕。

视觉修改继续使用已安装的 `ui-ux-pro-max`，结合 Apple HIG 的层级、留白、材质和可读性思想；不要复制 Apple 商标、专有素材或像素级照搬系统界面。

## 13. 主页和导航的已确认细节

- 租户门户是进入各独立应用的总入口。
- “返回网站首页”必须先回 `/{space}`，例如 `/yuanzhi`。
- 成长首页曾有“韩文字母练习表 / 来自：第 1 课...”卡片，用户要求删除。
- 欢迎区“元智教育”后缀已经要求去掉，只保留问候和日期。
- “连续学习”卡片必须连接数据库真实记录，不能写死。
- 个人资料和完整设置只放租户门户，不再放到仪表盘独立页面作为主要入口。
- 保存的旧版侧边栏无需同步最新成长工具箱，这是用户明确允许暂缓的事项。

## 14. 当前验证基线

本文档生成时已执行并通过：

```bash
npm run typecheck
npm run lint
git diff --check
npm run build
```

结果：

- TypeScript：通过，0 错误。
- ESLint：通过，0 错误。
- Git whitespace 检查：通过。
- Next.js 16.2.10 Webpack 生产构建：通过。
- 构建路由表已包含新的 `/{space}/apps/*` 和 `/{space}/dashboard/admin/apps/*` 路由。

本文档生成前用户普通终端验证：

```bash
curl -I http://100.125.173.55:3000/login
```

返回 `HTTP/1.1 200 OK`，说明服务器和 3000 端口本身正常。

但旧 Codex 任务沙箱执行同一命令仍得到：

```text
curl: (7) failed to open socket: Operation not permitted
```

这证明旧任务仍使用创建时的固定网络限制，不是应用故障。

## 15. 新任务环境配置

用户级 `/home/yangzhen/.codex/config.toml` 已保存为：

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"

[sandbox_workspace_write]
network_access = true
```

项目已标记 trusted。新任务第一件事必须重新执行私网 curl，确认新运行环境确实读取了配置。

浏览器方面：

- 用户在插件页看到了 `Chrome — Control Chrome with ChatGPT`，已建议选择 Chrome。
- 当前旧任务没有加载 `@Chrome` 或 `@Browser` 可调用工具，只能打开 URL，不能点击、输入或检查 DOM。
- 新任务应先确认插件是否真的安装并暴露 `@Chrome`。
- 登录必须由用户在测试浏览器配置文件中手动完成，不要请求或保存密码。

## 16. 必须执行的浏览器测试矩阵

网络权限和 Chrome 工具可用后，逐项测试并记录结果：

### 16.1 公共与登录

- `/login` 能正常打开。
- 未登录访问学生/管理端受保护路由时正确跳转登录。
- 登录后 tenant slug 不丢失。

### 16.2 学生门户

- `/yuanzhi` 只显示租户已启用且学生已 enrollment 的应用。
- 韩语和留学服务可进入。
- 英语、数学、大学课程按 coming-soon 处理。
- 个人资料/设置在门户弹窗工作。

### 16.3 韩语应用

- `/yuanzhi/apps/korean`
- `/yuanzhi/apps/korean/courses`
- `/yuanzhi/apps/korean/assignments`
- `/yuanzhi/apps/korean/grades`
- `/yuanzhi/apps/korean/records`
- `/yuanzhi/apps/korean/toolbox`
- 章节电子书刷新前后阅读时间不跳变。
- 60 秒无活动暂停计时并弹窗。
- 未达标测试按钮带锁。
- 达标后跳作业与考试页。
- 章节解锁顺序正确。

### 16.4 旧路由兼容

- `/yuanzhi/dashboard`
- `/yuanzhi/dashboard/courses`
- `/yuanzhi/dashboard/assignments`
- `/yuanzhi/dashboard/grades`
- `/yuanzhi/dashboard/records`

应重定向到正确应用域，并保留必要的查询参数。重点检查代码中仍可能存在的硬编码 `/dashboard/...` 链接。

### 16.5 管理端

- `/yuanzhi/dashboard/admin/apps`
- `/yuanzhi/dashboard/admin/apps/korean`
- `/yuanzhi/dashboard/admin/apps/korean/people`
- `/yuanzhi/dashboard/admin/apps/korean/assessments`
- `/yuanzhi/dashboard/admin/apps/korean/settings`
- `/platform/dashboard/admin/apps`

分别用平台管理员、租户管理员、教师账号验证能力差异；不要只用一个超级管理员账号得出权限正确的结论。

### 16.6 租户隔离

- 使用另一个测试租户账号直接访问 `/yuanzhi/...`。
- 尝试用 URL 中的资源 ID 读取另一个租户的 enrollment、作业、电子书进度、练习和管理数据。
- 期望 404、空数据或权限拒绝，不能返回对方数据。

## 17. 已知风险与待办

以下不是已确认的代码错误，但必须优先检查：

1. 当前大规模修改尚未提交，任何机械化重写都可能覆盖用户成果。
2. 最新应用域架构尚未完成真实登录态端到端测试。
3. 管理端角色矩阵和跨租户直接 URL 访问尚未做浏览器验证。
4. 旧路由兼容层可能仍有漏掉的硬编码 `/dashboard` 链接。
5. `student-app-data.ts` 的 schema fallback 在远端已部署后可能掩盖真正查询错误；不要把所有错误都静默回退。
6. 成绩数据库视图当前按作业/考试类别汇总，不按课程；如果用户再次要求课程雷达图，需要明确新规则再改数据库。
7. 书签与笔记仍是 localStorage，本轮只有阅读时间进入数据库。
8. Chrome 插件是否实际安装并可被新任务调用尚未验证。
9. Supabase CLI 仍提示可升级到 v2.114.0；当前项目依赖为 v2.109.1。不要仅为了消除提示在架构验证中途升级 CLI。

## 18. 不要做的事情

- 不要恢复旧五主题；不要删除旧布局快照。
- 不要把所有课程重新塞回韩语 dashboard。
- 不要把 `yuanzhi` 当作固定品牌路径硬编码；它是租户 slug。
- 不要关闭 RLS。
- 不要通过客户端传入 tenant ID 后直接信任。
- 不要把章节测试成绩重新放回成绩中心。
- 不要把工具箱能力数据与课程成绩混用。
- 不要把阅读时间改回按页数完成。
- 不要因 Supabase catalog cache 警告重复推送已经应用的迁移。
- 不要在未经用户确认时提交、推送或清理当前工作树。

## 19. 建议的新任务首条指令

复制下面内容到新任务：

```text
读取并严格遵守：
/home/yangzhen/projects/my-lms-system/docs/CODEX_HANDOFF_2026-08-15.md

不要重置或清理现有工作树。先执行：
1. git status --short --branch
2. curl -I --max-time 15 http://100.125.173.55:3000/login
3. npx supabase migration list
4. npx supabase db push --linked --include-all --dry-run

先报告验证结果；确认网络、迁移和现有基线正常后，再按交接文档的浏览器测试矩阵测试学生端和管理端。发现问题时一次只修一个范围，修完立即复测，并始终检查租户、RLS 和角色权限。
```
