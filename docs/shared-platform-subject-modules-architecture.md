# 共享平台 + 学科模块 架构

> 最后更新：2026-09-30（分支 `feat/subject-slots`，未提交）
> 本文件描述已经落地的做法、仍然遗留的焊点，以及英语、数学上线前待决定的事项。

## 1. 结论

韩语、英语、数学放在**同一个项目**里，采用模块化单体：

- **平台层共用**：身份、租户、权限、应用授权、课程骨架、学习记录、作业考试成绩、文件媒体、`agent-core`、通用 UI。
- **学科层独立**：课程内容、题型、判题、学科渲染、学习工具、学科 AI 技能与提示词。

同一个仓库、同一个数据库、同一套部署；学科通过注册机制接入平台，平台不再写 `=== "korean"`。

不拆成独立项目的原因：用户、租户、学习记录和作业成绩天然跨学科，拆开后要么重复实现，要么以后合并时重写。只有某个学科有独立团队、独立发布节奏或独立合规要求时才考虑拆分。

专用服务可以独立：`~/projects/edumath`（AI 数学仿真生成器）按其计划书以独立服务 + iframe 嵌入主平台，不持有用户、课程和进度。数学学科本身仍在本项目中。

## 2. 已确认的决定（2026-09-30）

1. **学科就是学习类应用**。学科键是数据库已有的 `student_app_id`（代码中是 `StudentAppSlug`，路由是 `/{space}/apps/<slug>`），不新增 `subject` 字段。留学服务是服务类应用，不是学科模块；大学课程应用暂无学科清单。
2. **大学英语放进 `english` 应用，大学数学放进 `math` 应用**；“大学”用课程分类表达，与韩语下的“基础韩语 / TOPIK 备考”同理。
3. **英语、数学管理端先只开放三个分区**：学生与教学分配、课程结构、应用设置。其余分区的服务确认按应用隔离后再逐个开放。
4. **改造在独立工作树进行**：`../my-lms-system-subjects`，分支 `feat/subject-slots`；全部步骤完成后一次提交。

## 3. 已落地的学科插槽（第 1 步）

### 3.1 目录

```
src/features/subjects/
├── contracts.ts   学科清单格式（纯类型）
├── registry.ts    平台读取学科的唯一入口
├── index.ts       对外公开入口
├── korean/        index.ts + manifest.ts
├── english/       index.ts + manifest.ts
└── math/          index.ts + manifest.ts
```

### 3.2 学科清单（contractVersion 1）

清单只放可序列化的纯数据，服务端组件和客户端组件都能读取；链接、图标、会员开关由平台目录维护，学科只声明启用和排序。

| 字段 | 作用 |
|---|---|
| `management.sections` | 学科启用的管理端分区；不在列表中的分区对该学科返回 404 |
| `management.teachingOperations` | 是否显示教学运营导航 |
| `management.courseContentWorkflow` | 是否显示课程制作流程导航 |
| `student.navigation` / `navLabels` | 学生侧边栏分组、排序与显示名 |
| `student.mobilePrimary` | 手机端底部主入口 |
| `student.courseSearch` | 顶栏课程搜索 |
| `student.practiceMemory` | 巩固中心记住上次分区 |
| `student.membershipFooter` | 侧边栏底部显示会员档位 |

注册表 API：`getSubjectManifest(slug)`（非学科返回 `null`）、`isSubjectSlug`、`isSubjectSectionEnabled(slug, section)`（仅当学科清单启用该分区时为 true）。

故意没有放进清单的：教学语言、题型、判题器、课时与课程界面渲染器、AI 技能。等真实需要时按 `contractVersion` 升级。

### 3.3 平台如何读取清单

- 管理端：统一分区检查、工作区卡片（`subjectOnly`）、教学运营导航、课程制作流程导航，以及原先只限韩语的分区页面。
- 学生端：侧边栏、手机端主入口、巩固中心记忆、顶栏课程搜索、侧边栏底部。
- 共享层 `src/lib` 不引用学科代码；需要学科信息时由 `src/app` 层读取清单后作为参数传入（例如 `courseContentSteps(access, workflowEnabled)`）。

## 4. 已完成的拆焊点（第 2 步）

| 批次 | 内容 | 做法 |
|---|---|---|
| 2A 功能开关 | 结课政策与审核、学习计划、平台学情会话入口、学生分配页学习计划待办、课程页标题 | 改为 `isSubjectSectionEnabled` 或读取清单 |
| 2B 只读查询 | 成绩、学习记录、作业列表与详情、工具箱（首页 / 技能 / 词汇）页面；巩固覆盖与章节读取、当前课程、能力画像、结课读取、课程巩固目录服务 | 页面导出接收 `studentAppSlug` 的具名组件，韩语路由传入 `"korean"`；服务由调用方传入应用 |
| 2C 写入操作 | 作业提交、工具箱提交与计时、巩固进度、听辨判定、章节测试后刷新、错题掌握、老师巩固推荐、巩固中心后台 | 应用由服务端从记录推出；只有工具箱计时和老师推荐接收页面传入的学科，且服务端核对权限 |
| 2E 会话练习（平台侧） | 会话练习基础路径、6 个学生页面、去后台编辑的链接 | 与 2B 相同 |

### 4.1 旧入口约定

旧的 `/{space}/dashboard/...` 学生路由会重定向到应用路由，只有教职人员会直接看到。共享页面模块的旧默认导出统一引用 `src/app/dashboard/legacy-redirect.ts` 中的 `LEGACY_DASHBOARD_APP_SLUG`（值为 `"korean"`），“旧入口默认韩语”只定义在这一处；自动生成的路由适配文件未改动。

### 4.2 写入安全原则

- 写入所属的应用必须由服务端确定：从目标记录（作业、练习、练习单元、错题、章节测试、课程）读取。
- 必须由页面告诉服务端学科时（工具箱计时、老师巩固推荐），服务端核对：是学科应用；学生对该应用有有效权限，或该学科开启了对应分区且学生在老师该应用的负责名单中。
- 使用管理员权限读取私有数据前（如听辨答案），先核对学生对该记录所属应用的权限。
- 数据库 RLS 是最终边界，应用层不依赖它，但也不替代它。

新增的平台工具：`src/lib/student-app-access.server.ts`（`getStudentAppSlugById`、`hasActiveStudentAppAccess`）、`src/features/student-home-learning/api/refresh-for-app.ts`（按记录所属应用刷新首页）。

### 4.3 英语应用骨架（第 3 步的代码部分，不含数据库）

- 学生导航：学习（应用首页、英语课程、学习任务）、成长记录（我的成绩、学习记录、资料库）、消息与服务（通知公告、帮助中心）。
- 路由：`src/app/[space]/apps/english/` 下接入课程目录 / 分类 / 课程 / 课时、学习任务与详情、成绩、学习记录、资料库、公告、帮助，全部复用平台页面并明确传入 `"english"`；课程分类层只放行 `english` 分类。
- 课程目录：按应用显示时不再把 `english`、`math`、`university` 分类当作“即将上线”（仅旧版总目录保留该规则）。学科清单新增 `student.catalogOpensAllCategories`：英语为 `true`，目录中的分类都显示学习入口；韩语、数学为 `false`，沿用“只有主线分类可进入、其余显示努力完善中”的旧规则（浏览器验证时发现，2026-10-01 修复）。
- 顶栏面包屑中课程目录的名称取自学科清单的 `navLabels.courses`（英语显示“英语课程”）；没有学科清单的应用沿用原标签。
- 成绩页“结课资格与证书”卡片只在学科开启结课资格时显示，避免英语出现指向不存在页面的链接。
- 暂不接入：巩固中心、专项训练（依赖韩语内容格式）、会话练习（依赖 AI 陪练定位）、结课资格（依赖数据库中韩语化的结课评估）。
- 已知限制：课时页的完整访问只认 `korean_course`，英语学生目前只能进入免费试看课时；英语首页仍是通用的应用首页框架。两者分别取决于第 8 节的会员与首页决定。
- 英语在机构中仍为“即将上线”，学生无法进入；本步骤已在独立验证库中临时开放英语完成浏览器验证（见第 7 节）。

## 5. 依赖与边界规则

```
app → features（平台 / subjects） → shared
```

- `shared`（`src/lib`）不得引用 `subjects`；一个学科不得深链另一个学科的内部文件；学科只通过 `index.ts` 对外。
- 共享代码不再新增 `if (slug === "...")`；需要差异时加入学科清单。
- 由测试强制：`tests/subject-registry.test.mjs`（清单合法性、韩语清单与改造前一致、依赖方向、已改文件不再固定韩语）、`tests/subject-write-boundaries.test.mjs`（写入边界与权限核对顺序）。

### 5.1 与教学 Agent（Codex 线）的隔离

改造期间不修改以下内容：`src/features/teaching-agent`、`agent-core`、`smart-textbook-runtime`、`development-execution`、`src/lib/smart-textbook-*`、`scripts/teaching-agent-*`、`docs/evidence/teaching-agent-*`、`.codex/`、`AGENTS.md`、`CODEX_*.md`，以及被这些代码直接或间接引用的 38 个文件（例如 `src/lib/student-apps.ts`、`student-home-learning/api/refresh.ts`）。每批改动都与这份引用链交叉核对，结果为零交集。

另外，Codex 的候选版本源码锁（`docs/evidence/teaching-agent-stage-1f-r7c-b/b3a-candidate-source-lock.json`）记录了约 1321 个文件的哈希，几乎覆盖整个 `src`；本分支改过的文件中有 92 个在其中（2026-10-01 统计）。这不影响在分支上开发，但**分支合并进主干时，Codex 需要重新生成候选版本锁**，因此合并必须安排在 Codex 线收尾之后，或与 Codex 线协调后进行。这些文件自 2026-09-05 以来没有 Codex 提交，预计合并冲突风险低。

## 6. 仍然遗留的焊点

| 内容 | 位置 | 计划 |
|---|---|---|
| 课程目录、分类、课程页按韩语选择界面（`KoreanDirectCourseCatalog`、`KoreanLearningCenter`） | `src/app/dashboard/courses/**` | 课程和课时界面插槽（原 2D），设计见 [course-lesson-experience-slot-design.md](./course-lesson-experience-slot-design.md) |
| 课时页韩语分支与 28,719 行韩语组件 | `courses/.../[lessonSlug]/` | 同上；课时页是金老师面板宿主，等 Codex 线收尾 |
| `korean_course` 会员开关 | TS 15 个文件 + SQL 4 个函数；平台级 4 处（课时页、课时操作、资料下载、课时进度触发器），其余为韩语专属 | 平台级改为“按应用的完整课程访问”策略（默认沿用 vip2/vip3，收费决定后替换），需数据库改动 |
| 写死韩语应用的数据库函数 | `capture_toolbox_review_item`、`enforce_chapter_test_learning_prerequisites`、`record_ebook_progress`、`save_conversation_practice_scenario` | 依赖分析结论：第 1 个删除无效兜底；第 2、3 个是韩语专属功能，保留；第 4 个随英语会话练习增加应用参数 |
| 章节测试表 | `korean_title` 必填、slug 全局唯一；标准试卷必须挂章节测试 | 依赖分析结论：英语**不改表结构**（slug 加学科前缀，`korean_title` 填空字符串）；数学另定。见 [db-subject-unweld-dependency-analysis.md](./db-subject-unweld-dependency-analysis.md) |
| 韩语题库列名 `_ko` | `exam_bank_*`、`homework_bank_*` | 不改；视为韩语模块的创作表，英语、数学各建自己的创作表 |
| 会话练习 AI 提示词、回答语言模式、场景内容格式（`korean` 字段） | `supabase/functions/qwen-conversation-chat`、AI 体验页面、场景数据 | 第 3 步与英语会话内容一起设计 |
| 作答表单短答题提示写死“填写韩语答案”；投放题型只有 5 种、客观判分为字符串相等 | `AssignmentSubmissionForm.tsx`、`learning_assignment_questions` | 题型与判题器插槽，设计见 [question-type-grader-slot-design.md](./question-type-grader-slot-design.md) |
| 英语课时完整访问 | 课时页 `korean_course` 准入（黄区） | 会员决定 + 会员开关按应用改造 |
| ~~资料库分类名“韩语学习”，英语学生也会看到~~ | `src/app/dashboard/library/**` | 已解决（2026-10-01）：资料本来就按应用内课程筛选，只是 `language` 分类显示名写死；学科清单新增 `student.libraryLanguageCategoryLabel`，英语显示“英语学习”，韩语与管理端保持原名。留学申请、签证材料等分类在英语资料库中仍显示（只影响筛选按钮），待资料库分类按应用配置时一并处理 |
| 门户首页、韩语首页 | `src/app/[space]/page.tsx`、`DashboardHomePage.tsx` | 按第 8 节第 1 项的决定改造（门户跨学科总览 + 平台首页框架），排在本机库同步之后 |
| 韩语专属页面与内容 | 深化学习页、韩语章节测试、韩语教材路径判断、创建教学内容骨架等 | 第 5 步整体迁入 `subjects/korean` |
| ~~死代码~~ | 旧后台“学生分配”整条链、`admin/growth-toolbox/page-content.tsx` | 已删除（18 个文件，旧入口重定向路由保留） |

## 7. 验证状态

- 自动化：相关测试 179 个通过；类型检查（`next typegen` 后 `tsc --noEmit`）与改动文件 lint 通过。只运行与改动相关的测试文件，不运行 `test:navigation` 全集（其中有测试会改写证据文件）。
- 浏览器验证（2026-10-01，**已完成**）：在独立的一次性验证库 `~/projects/lms-verify-db`（新环境基线 + 最小测试数据，端口 56320–56329，不影响共享本机库与云端库）上，用工作目录的开发服务器逐页打开并读取页面实际显示内容（这些路由有加载骨架，调用 `notFound()` 时 HTTP 仍是 200，所以不以状态码为准）。
  - 管理端（机构负责人）：英语工作区只显示课程结构、学生与教学分配、应用设置 3 个模块，这 3 个分区可打开；成绩分析、学习记录、作业与考试、教材制作、练习工具、会话与课堂、结课资格、学习计划、教学脚本、学情分析均显示 404。数学工作区同为 3 个模块。韩语工作区 11 个模块，课程结构、成绩分析、学习记录、结课资格、学习计划可打开。大学课程（10 个模块）、留学服务（9 个模块）与改动前的规则等价。练习中心要求平台负责人身份，机构负责人访问韩语、英语都会被重定向，属原有行为。
  - 学生端（二级会员，报名韩语与英语）：门户显示两个可进入的应用；英语侧栏与清单一致、不含巩固中心和 AI 交流；英语课程目录 → 分类 → 课程 → 课时逐层可进入，试看课时可学习，非试看课时为“只读浏览”（符合收费决定前的约定）；英语成绩页没有结课资格卡片，韩语成绩页有；英语学习任务、学习记录、资料库、公告、帮助正常，英语巩固中心 404；数学（未报名、机构未开放）404，与改动前一致。韩语侧栏、课程目录、面包屑、课时学习与改动前一致。
  - 验证中发现并修复 2 个问题：英语课程目录的分类没有学习入口（沿用了旧版“努力完善中”卡片）、英语课程页面包屑显示“韩语课程”。修复后类型检查、改动文件 lint 与 6 个相关测试文件（55 个测试）通过，浏览器复查通过。另记录 1 个遗留项：资料库分类名“韩语学习”（见第 6 节）。
- 分支回归（2026-10-01）：排除会写文件、启动子进程或访问网络/数据库的测试后，其余 128 个测试文件共约 1700 个测试，只有 8 个失败（`smart-textbook-runtime-4a10`、`smart-textbook-runtime-4a11-session`、`teaching-agent-release-metadata`、`teaching-agent-release-migrations`，均为 Codex 线测试）。在改动前的版本 `d43564f` 上失败数与失败原因完全相同（测试环境缺少请求上下文、发布清单哈希比对），与本分支无关。
- 备份：`~/projects/my-lms-system-subject-slots-backup/2026-09-30/`（补丁 + 新增文件包 + 恢复说明 + SHA256），已验证可逐字节恢复。

## 8. 英语、数学上线前待决定的事项

1. ~~门户与首页如何汇总多个学科~~ **已决定（2026-09-30）：分两层。**
   - **门户 = 跨学科“今日总览”**：所有已开通学习应用的任务合并后按紧急程度排序并标注学科；最近截止、最新反馈同样跨学科；每个应用卡片显示一行“继续学习”（当前课程与进度）。能力画像移到各学科首页（各学科能力维度不同）。只开通一个学科的学生，门户与现在基本一致。
   - **应用首页 = 同一套平台首页框架 + 学科定制**：平台提供今日任务、继续学习、巩固复习、学习记录、能力画像等区块，学科选择启用哪些区块并可加入专属区块；韩语首页改为“框架 + 韩语定制”，英语、数学直接使用框架。
   - 不采用“只展示一个主学科”或“按最近学习自动切换”，因为会隐藏其他学科的截止任务。
   - 实施进度：
     - 第 1 小步已完成（2026-10-01）：门户“今天最重要 / 今日剩余必做 / 最近截止 / 最近反馈”汇总所有**已开放且已报名**的学科应用（`loadPortalHomeLearningSummaryForApps`），多学科时截止与反馈标注学科名，只有一个学科时显示与改造前一致；任一学科读取失败则整体显示加载失败，避免误报“没有任务”。任务链接按任务所属应用生成（`routes.ts` 各函数新增可选应用参数，未传时仍为韩语）；学科未开放巩固中心时不生成巩固、专项训练、错题复习任务（`isStudentNavItemEnabled`）。机构中未开放的应用学生无法进入，不再汇总其任务。已在独立验证库用“韩语 + 英语”和“仅韩语”两个学生做浏览器验证。
     - 第 2 小步已完成（2026-10-01）：
       - 平台首页框架 `src/app/dashboard/StudentSubjectHome.tsx`：学科清单新增 `student.homeBlocks`（`today-tasks` 今日任务、`continue-learning` 继续学习、`ability-portrait` 能力画像），框架按清单顺序渲染，未启用的区块不读取数据，每个区块单独处理失败。英语首页改用框架（原来只显示“英语学习建设中”）；数学在课程内容接入前仍显示建设中（`homeBlocks: []`）。
       - 门户：每个学科应用卡片显示当前课时与进度；移除只属于韩语的“学习状况”条和能力画像，个人资料占满整行。
       - 能力画像组件移到 `src/features/student-ability-portrait/components/`，数据来源名称改为参数，颜色改用学生端主题变量（夜间主题正常）；韩语首页在“快速开始学习”下方新增能力画像插槽。
       - 已在独立验证库用“韩语 + 英语”和“仅韩语”两个学生做浏览器验证（门户、英语首页、韩语首页）。
     - 第 3 小步已完成（2026-10-01）：平台区块取数统一为 `loadStudentHomeBlocks`（`src/features/student-subject-home/api/load-home-blocks.ts`），平台首页框架与韩语首页共用；韩语首页保留自己的版面作为“韩语定制”（不读取框架的继续学习区块，因为它有自己的继续学习卡片），浏览器对照内容不变。没有把韩语首页按框架区块重排：外观必须不变，重排风险高而没有可见收益，韩语页面整体迁入 `subjects/korean` 时（第 5 步）再考虑。门户公告链接改为第一个提供公告栏目的已开放学科应用；门户顶栏“学习助手”入口仍指向韩语应用（第 8 节第 4 项未决定）。
2. **会员与收费**：新学科沿用 vip2/vip3 档位，还是按应用单独设置档位（`student_app_enrollments.access_tier`）？
3. **英语 AI 陪练定位**：只做口语陪练，还是包含写作批改？回答语言模式（全英文 / 中英辅助）如何设定？是否需要英语版教师形象？
4. **金老师（教学 Agent）是否扩展到英语、数学**：还是只服务韩语，英语、数学各自新建？
5. **EduMath 的对接边界**：数学模块按计划书以 iframe + postMessage + Launch Token 嵌入；LMS 服务端能否复用 `@edumath/math-core` 做数学判题？ 对接设计见 [edumath-integration-design.md](./edumath-integration-design.md)。
6. **大学课程应用**：保留给以后的专业课，还是先隐藏？

## 9. 下一步

| 顺序 | 内容 | 前置条件 |
|---|---|---|
| 1 | 共享本机库同步（浏览器验证已在独立验证库完成） | Codex 线收尾 |
| 2 | 数据库改动批次（第 6 节中的数据库项） | 同上，并按 Architecture Gate 处理 |
| 3 | 第 3 步其余部分：门户与首页框架、课时完整访问、巩固与专项训练、会话练习与 AI 陪练、英语内容 | 第 8 节第 2、3 项决定（第 1 项已决定）；代码骨架已完成（4.3） |
| 4 | 课程与课时界面插槽 | 英语需要自己的课程界面时 |
| 5 | 第 4 步：数学（EduMath 接入、数学题型、服务端判题） | 第 8 节第 5 项决定 |
| 6 | 第 5 步：韩语迁入 `subjects/korean` | 以上完成后分批进行 |
