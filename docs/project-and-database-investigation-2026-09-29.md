# 项目与数据库调查报告:学科耦合现状

> 调查日期:2026-09-29
> 目的:弄清楚现在的系统"多学科就绪到什么程度",为加入大学英语、大学数学两个学科做准备。
> 性质:**只读调查**。没有修改任何已有的代码、迁移或数据库。文末"变更声明"如实记录了调查期间发生的文件变动。

---

## 0. 调查范围与方法

**查了什么**

- 仓库源码、`supabase/migrations`(461 个迁移)、`supabase/bootstrap`、`docs/`、`tests/`、`scripts/`。
- 本机正在运行的本项目 Supabase 数据库(容器 `supabase_db_my-lms-system`,PostgreSQL 17.6)。查询全部在只读事务里执行(`default_transaction_read_only=on`),只查表结构、约束、函数定义和聚合计数,没有读取任何个人数据行。

**没查什么 / 局限**

| 项目 | 情况 |
|---|---|
| 生产数据库 | 没有连接,也没有权限。下面所有"数据现状"都来自本地开发库,规模很小 |
| 本地库与仓库的差距 | 本地库已应用 410 个迁移,仓库有 461 个,**少 51 个**(`202609050001` 到 `202609180002`)。其中包括 `agent_core` 相关的表,所以 Agent Core 的库表信息来自迁移文件,而不是真实库 |
| 运行时行为 | 没启动应用,没构建,没在浏览器里打开页面,也没有切换数据库角色去实测 RLS |
| 代码统计 | 用文本搜索得到,只能抓到字面量 `"korean"`、`STUDENT_APP_IDS.korean` 这类写法,通过变量间接传递的耦合可能漏掉 |
| 其他容器和项目 | 本机还有 koflow、dify、edumath 等容器,以及 `~/projects/edumath` 目录。它们不属于本项目,我没有查看内容 |

---

## 1. 结论摘要

1. **数据库已经为多学科做好了准备。**系统里有一个叫"应用(App)"的概念,`korean / english / math / university / study-abroad` 五个应用各有固定 UUID。31 张业务表带有应用归属列(26 张 `student_app_id`,5 张 `app_id`),另有 2 个视图。触发器强制归属一致且创建后不可改,RLS 里有 107 条策略引用了应用域权限。**不需要再新建"学科"字段,这个字段已经叫 `student_app_id`。**
2. **英语和数学现在只是占位。**代码里各有 3 个文件(布局、加载态、"即将上线"首页),数据库里这两个应用下没有任何分类、课程、试卷。租户已经给它们开了入口,状态是 `coming_soon`。
3. **韩语和平台的"焊点"不在数据库结构和 RLS,而在三个地方:**
   - **课程页面代码**:通用的课程路由目录里放着 28,719 行韩语专属组件,其中一个文件就有 7,475 行;通用课时页 `page-content.tsx` 里有硬编码的韩语分支。
   - **服务层**:16 个 `features` / `lib` 文件里有 37 处写死了韩语应用(`STUDENT_APP_IDS.korean` 或 `slug === "korean"`);`src/app` 下还有 38 个文件;教学 Agent 另用自己的常量 `koreanApp`。
   - **少量数据库函数、约束和列名**:4 个函数写死了韩语应用 UUID;权限开关 `korean_course` 在 TypeScript 和 SQL 里各定义了一份;标准题库的列名带 `_ko`(`prompt_ko`、`options_ko`、`content_ko`);作业和题库用 `language_skill`(听说读写词汇语法)的 CHECK 约束。
4. **Agent 层分得最干净。**`agent-core` 只有 25 个文件、860 行,只有一个持久化适配器碰 Supabase;旧的 `learning_agent_profiles` 有 `subject_code`;新的 `agent_conversations` 有 `app_id`。而上层的 `teaching-agent` 是**刻意限定为韩语 MVP** 的。
5. **英语比数学更接近现有能力。**英语和韩语同属语言类,六技能、听说录音、TTS、题型都能沿用;数学则缺渲染库(项目里没有 KaTeX 等)、缺题型、缺判题、缺教材块类型。
6. **对我之前几条建议的更正**见第 9 节。最重要的一条:之前说要"给共享表加 `subject` 字段",实际上已经有了。

---

## 2. 项目规模(实测)

| 项目 | 数量 |
|---|---|
| `src` 下 TS/TSX 文件 | 1319 个,约 202,700 行 |
| 页面 `page.tsx` | 164 个 |
| Route Handler `route.ts` | 38 个 |
| 业务模块 `src/features` | 35 个 |
| 数据库迁移文件 | 461 个,共 77,857 行(2026-07 月 136 个、08 月 259 个、09 月 66 个) |
| 测试 `tests/` | 160 个文件 |
| 脚本 `scripts/` | 105 项 |
| Edge Functions | 3 个有代码(`guide-agent-runtime`、`learning-agent-runtime`、`qwen-conversation-chat`,共 715 行);`teaching-agent` 是空目录 |
| 本地库 public schema | 168 张表 + 8 个视图 |

技术栈:Next.js 16(App Router)、React 19、TypeScript 5、Tailwind 4、Supabase(Auth / Postgres / RLS)、Cloudflare R2、OpenNext + Cloudflare Workers。`package.json` 里**没有**数学渲染库(katex、mathjax、mathlive)、符号计算库(mathjs、nerdamer)、也没有多语言库(next-intl、i18next)。界面文案直接写死在 TSX 里(762 个 TSX 文件中 527 个含中文)。

---

## 3. 已经存在的多学科基础设施

### 3.1 数据库层

**3.1.1 应用目录与租户开关**(迁移 `202608150005_student_application_domains.sql`)

`student_apps` 是应用字典表,`id` 是固定 UUID:

| slug | 类型 | 默认状态 | 本地库中租户的开放状态 |
|---|---|---|---|
| korean | learning | active | active |
| english | learning | coming_soon | coming_soon |
| math | learning | coming_soon | coming_soon |
| university | learning | coming_soon | coming_soon |
| study-abroad | service | active | active |

`tenant_student_apps(tenant_id, app_id, is_enabled, status)` 决定机构是否开放某个应用;新建租户时由触发器 `tenants_seed_student_apps` 自动补齐五行。

**3.1.2 学生和员工的应用级授权**(迁移 `202608150008_admin_application_access.sql`)

- `student_app_enrollments(tenant_id, student_id, app_id)`:学生是否报名某应用,含状态、`access_tier`(normal/vip1-3)、起止时间。
- `staff_app_assignments(tenant_id, staff_id, app_id)`:员工在某应用里的角色和四项能力(管理学生、管理内容、管理测评、查看分析)。
- `application_access_audit_logs`:上述两张表的变更审计。

**3.1.3 应用归属的传播方式**

`course_categories` 和 `courses` 直接带 `student_app_id`(均为 `NOT NULL`)。一级分类的 slug 和应用 slug 对应(`service` 分类对应 `study-abroad`),子孙分类和课程继承。其他内容表分三种方式:

| 方式 | 例子 |
|---|---|
| 直接带 `student_app_id` | `assessment_papers`、`chapter_tests`、`digital_textbooks`、`learning_assignments`、`growth_toolbox_*`、`course_completion_*`、`student_review_items`、`student_weekly_learning_plans`、`teacher_learning_recommendations` 等 26 张 |
| 通过 `course_id` / `lesson_id` 间接继承 | `lessons`、`lesson_progress`、`lesson_questions`、`lesson_resources`、`library_resources`、`live_class_sessions`、`grade_items` |
| 用别的名字表达学科 | `learning_agent_profiles.subject_code`、`agent_conversations.app_id`(text)、`help_tickets.subject`、`announcements.scope` |

**3.1.4 防止数据"悄悄落进韩语"的硬化**(迁移 `202608160001_application_domain_hardening.sql`,2784 行)

- 早期为了兼容,`student_app_id` 在多张表上带过默认值 `…0001`(韩语)。硬化迁移把 12 张表的这个默认值全部删掉,注释写明原因:**"旧默认值会把遗漏 app_id 的英语、数学或大学课程数据静默写入韩语。"**
- 触发器 `private.sync_student_app_ownership()`:子表的归属从父表推导(课程→分类、作业→课程和来源试卷、试卷→章节测试、教材→课时→课程),写入值与父级不一致就报错;`UPDATE` 时归属变化直接拒绝("应用归属创建后不可修改;请在目标应用重新创建内容")。
- 触发器 `private.enforce_explicit_student_app_ownership()`:没有父级可继承的表必须显式传 `student_app_id`。
- 部署时自检:如果仍有课程、分类、试卷、教材缺少归属,迁移直接抛错拒绝部署。
- 工具箱入口的唯一约束从全局 `slug` 改为 `(student_app_id, slug)`,注释说明目的是让英语、数学也能拥有与韩语同名的 `vocabulary`、`grammar` 入口。

**3.1.5 实时权限函数与 RLS**

`private.current_user_can_read_student_app(app_id)` 的判定逻辑:平台身份直接通过;否则要求租户成员有效、租户开放该应用且状态为 `active`,并且(学生有有效的 enrollment,或是 CEO/机构负责人,或是有 active 分配的教师/管理员)。因此**英语、数学在被设为 `active` 之前,任何租户用户在数据库层都读不到它们的内容**。

本地库统计:public 下 263 条策略,其中 107 条引用了应用域权限;**没有任何一条策略写死了 `korean`**。全部 168 张表都开了 RLS,其中 10 张启用了 `FORCE ROW LEVEL SECURITY`。

**3.1.6 通用的学习事件流**

`student_learning_activity_events` 是学科无关的事件表:`category`(限定 `course / task / practice`)、`event_type`、`source_kind`、`source_id`、`dedupe_key`(去重)、`duration_seconds`、`metadata jsonb`,再加 `tenant_id`、`student_id`、`student_app_id`。新学科可以直接往里写。

**3.1.7 内容归属:平台内容与机构内容**

课程、分类、课时都有 `content_scope`(`platform` / `tenant`),并用 CHECK 保证 `platform ⇔ tenant_id 为空`。这意味着课程可以由平台统一提供,也可以由机构自建。

### 3.2 应用层(代码)

| 已有的通用设施 | 位置 | 说明 |
|---|---|---|
| 应用注册表 | `src/lib/student-apps.ts` | `STUDENT_APP_SLUGS`、`STUDENT_APP_IDS`、`STUDENT_APPS`,含 slug、标题、类型、状态、色调 |
| 学生应用入口守卫 | `src/app/dashboard/StudentAppRouteLayout.tsx` | 校验角色是学生、租户已开放应用、学生有有效 enrollment 且在有效期内,否则 `notFound()`。**对任何应用通用** |
| 课程目录组件 | `CourseCatalog`(`src/app/dashboard/courses/page-content.tsx`) | 已经接收 `studentAppSlug` 参数;`korean` 和 `study-abroad` 都在用 |
| 管理端应用路由 | `src/app/[space]/dashboard/admin/apps/[appSlug]/` | 30 个文件(28 个页面),以 `[appSlug]` 动态段承载所有应用的后台 |
| 应用级员工权限 | `src/lib/tenant-app-capabilities.ts` | `hasTenantAppCapability` 镜像数据库函数,按应用检查四项能力 |
| 已参数化的业务模块 | `student-home-learning`(21 文件中 16 个涉及应用参数)、`learning-records`、`grades`、`growth-toolbox`(17 中 13)、`curriculum-plans`、`teacher-learning-recommendation`、`student-weekly-learning-plan` | 这些模块没有写死韩语 |

学生端路由约定是 `[space]/apps/<app>/...`。韩语这一支有 48 个文件,大多是**薄包装**:比如 `korean/courses/page.tsx` 只有 10 行,内容是 `<CourseCatalog studentAppSlug="korean" space={space} />`,真正的实现在 `src/app/dashboard/**/page-content.tsx`(共 72 个),而 `[space]/dashboard` 下的 99 个页面又是由脚本 `scripts/generate-dashboard-route-adapters.cjs` 生成的适配器。

### 3.3 Agent 层

- **`src/features/agent-core`**:25 个文件、860 行。目录为 `contracts / conversation / observability / permissions / persistence / providers(deepseek) / runtime / skills / tools`。引用了外部模块的只有 `persistence/supabase/repositories.ts`,属于合理的适配器位置。运行时里的预算、取消、截止时间、状态机都不涉及学科。
- **权限上下文里带 `appId`**:`contracts/server.ts` 里的授权对象含 `appId`、`scope`、`scopeRef`,`conversation/scope.ts` 会校验它们非空。库表 `agent_conversations` 有 `app_id text` 列,`admit_agent_run_v1` 接收 `p_app` 参数。
- **旧的学习 Agent 已经按学科建模**:迁移 `202608260002_multi_subject_learning_agent_runtime.sql` 建了 `learning_agent_profiles(agent_code, subject_code, access_feature, capabilities …)`,韩语老师是里面的一条记录(`subject_code='korean'`)。
- **记录模型用量**:`ai_token_usage` 表 + `model-usage` 模块,提供商为 qwen 和 deepseek。

---

## 4. 焊点详查

### 4.1 课程页面:最大的一块

`src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/` 是通用课时页所在的目录,共 40 个文件,其中韩语专属组件合计 **28,719 行**:

| 文件 | 行数 |
|---|---|
| `KoreanLevelOneSmartTextbook.tsx` | 7,475 |
| `KoreanLevelOneLessonBook.tsx` | 2,006 |
| `KoreanLevelOneLessonTwoBook.tsx` | 1,687 |
| `HangulBookOpening.tsx` | 1,312 |
| `KoreanLevelOneLessonThirteenBook.tsx` / `…FourteenBook.tsx` | 各 1,303 |
| `HangulInteractiveBook.tsx` | 1,249 |
| 其余(Lesson Three 至 Sixteen、Reader、GuideBook、BatchimReadingBook、PronunciationRulesBook、VowelsConsonantsBook、BookTemplate、CourseOverview、BookReviewQuiz) | 合计约 12,700 |

通用的 `page-content.tsx`(1,324 行)里直接混着韩语判断,例如:

- 第 368 行 `parentCategory.slug === "korean" || parentCategory.slug === "service"`
- 第 376-378 行 `parentCategory.slug === "korean" && subcategory.slug === "korean-basic" && course.slug === "korean-beginner"`
- `isHangulIntroduction`、`isKoreanLevelOne` 两个布尔量决定渲染哪本书
- 第 439、759 行 `textbookSlug: "korean-level-one-smart"`
- 第 522-524 行 `hasFullKoreanCourseAccess`,里面调用 `canUseStudentFeature(role, membershipTier, "korean_course")`
- 引入了 `@/lib/korean-curriculum`、`@/lib/korean-learning-unlocks`、`@/lib/korean-ebook-progress`

也就是说,现在的课时页不是"通用课时页加韩语插件",而是"韩语课时页顺带支持了别的分类"。`[space]/apps/study-abroad/courses/...` 也是复用同一个页面。

### 4.2 服务层:写死韩语应用的位置

`STUDENT_APP_IDS.korean` 或 `slug === "korean"` 出现在 55 个文件里(含定义文件本身):`src/app` 38 个、`src/features` 15 个、`src/lib` 2 个。其中 `features` 和 `lib` 里的:

| 模块 | 文件 | 写死次数 |
|---|---|---|
| chapter-practice | `api/management-service.ts` | 12(第 155、168、302、826、893、940、1018、1056、1092、1329、1483、1522 行) |
| chapter-practice | `listening-actions.ts` | 4(第 77、84、122、209 行) |
| chapter-practice | `student/progress-service.ts` | 2 |
| chapter-practice | `api/service.ts`、`api/student-service.ts`、`progress-actions.ts` | 各 1 |
| student-assignments | `api/service.ts` | 2(第 46、107 行) |
| student-ability-portrait | `api/service.ts` | 2(第 214、229 行) |
| course-completion | `student-service.ts`(第 144 行)、`review-actions.ts`(第 18、30 行) | 3 |
| student-current-course | `api/service.ts` | 1(第 136 行) |
| student-review-center | `actions.ts` | 1(第 51 行) |
| teacher-practice-insights | `actions.ts` | 1(第 41 行) |
| development-execution | `server/lesson-facts-readonly.server.ts` | 1(第 58 行) |
| platform-learning-insights | `PlatformInsightPage.tsx` | 1(第 13 行,`appSlug === "korean"`) |
| lib | `course-practice-catalog.server.ts` | 3(第 31、72、92 行) |
| teaching-agent | `supabase-student-teaching-repository.ts` | 常量 `koreanApp`,共 7 处使用 |

`src/app` 里的 38 个文件主要是 `src/app/dashboard/**/page-content.tsx`(30 个),涉及首页、课程、作业、成绩、进度、记录、工具箱、会话练习等。对比:同样体量的 `student-home-learning`、`learning-records`、`grades`、`growth-toolbox` 已经是参数化的,可以作为改造参照。

另外 `getStudentAppPath(..., "korean", ...)` 这种写死韩语路径的调用出现在 23 个文件里。`page-content.tsx` 里还有 49 处 `"/dashboard/..."` 形式的硬编码链接(在 `[space]` 路由复用这些模块时,这类链接会指向旧路径,这一点在你的记忆笔记 `project_legacy_dashboard_hardcoded_paths` 里也提到过)。

### 4.3 管理端:显式的"只有韩语"闸门

`src/app/[space]/dashboard/admin/apps/[appSlug]/` 下有 8 个页面只对韩语开放:

- 返回 404(`notFound()`)的 6 个:`practice-center/page.tsx`、`practice-center/[courseChapterId]/page.tsx`、`practice-insights/page.tsx`、`conversation/scenarios/page.tsx`、`textbooks/native-activity/page.tsx`、`teaching-scripts/runtime-v1-preview/page.tsx`。
- 重定向回应用首页的 2 个:`completion-review/page.tsx`、`learning-plans/page.tsx`(判断条件里包含 `slug === "korean"`)。
- 另外 `teaching-scripts/preview/page.tsx` 第 78 行写死了教材 slug `"korean-level-one-smart"`。

这种写法是"默认关闭"的,不会误开放。缺点是每新增一个学科,都要逐页决定是否放开。

### 4.4 导航

`StudentSystemSidebar.tsx`(约第 136-150 行)按 slug 硬编码菜单:`study-abroad` 有自己的分组;`english`、`math`、`university` **共用一个只有"应用首页"的分组**;其他一律走韩语的 `learningGroups`。侧边栏里练习记忆功能也用 `studentAppSlug === "korean"` 判断。`guide-agent-targets.ts` 里的导航目标全部指向韩语课程路径。

### 4.5 会员权限:`korean_course` 双份定义

会员档位(normal / vip1-3)对应的功能开关在两处各写了一份:

- TypeScript:`src/lib/student-permissions.ts` 的 `StudentFeature` 联合类型和 `canUseStudentFeature`
- SQL:`public.student_feature_allowed(text)`

`korean_course` 要求 vip2 或 vip3。SQL 函数最后是 `else false`,所以**任何没登记的功能名(比如 `english_course`)对学生一律返回 false**。新学科需要同时改这两处,而且要保持一致。`enforce_student_lesson_progress_permission` 函数、`record_ebook_progress`、`submit_course_test` 也都写死调用 `student_feature_allowed('korean_course')`。

### 4.6 数据库里的韩语耦合

**4.6.1 函数体里写死韩语应用 UUID(4 个)**

- `private.capture_toolbox_review_item`
- `private.enforce_chapter_test_learning_prerequisites`
- `public.record_ebook_progress`
- `public.save_conversation_practice_scenario`

**4.6.2 函数里出现 `korean` / `hangul` 字样的其他函数**

`public.evaluate_student_course_completion`(第 146 行 `test.course_key = 'korean-level-one'`)、`private.ensure_chapter_homework_plan`(按 `course_key = 'hangul-introduction'` 分支)、`public.enforce_student_lesson_progress_permission`(按分类 slug `korean` 判断)、`public.submit_course_test`、`private.restore_chapter_test_catalog_after_seed`,以及大学相关的 `sync_korean_university_to_school`、`enforce_target_university_deadline` 等(这几个属于留学业务,不算学科耦合)。

**4.6.3 表和列名**

- `chapter_tests.korean_title`(`NOT NULL`)、`course_tests.korean_title`。
- `chapter_tests.slug` 有**全局唯一**约束(`course_tests_slug_key`),不是按应用唯一。英语的章节测试 slug 不能与韩语的重复。
- `chapter_tests.course_key` 是自由文本,现有值只有 `korean-level-one`(32 条)和 `hangul-introduction`(4 条)。
- `profiles` 里有 `has_korean`、`topik_level`、`english_level`、`math_level`、`gaokao_*` 等,说明学生画像本来就是面向"准备赴韩留学的中国学生"设计的。
- `course_ebook_progress` 以 `test_slug`(韩语章节测试)为键,"ebook"是韩语电子书的历史概念。

**4.6.4 标准题库的列名带语言**

这是英语要面对的一个具体问题。`exam_bank_*` 和 `homework_bank_*` 两套题库:

| 表 | 带 `_ko` 的列 |
|---|---|
| `exam_bank_questions` / `homework_bank_questions` | `prompt_ko`、`options_ko` |
| `exam_bank_materials` / `homework_bank_materials` | `title_ko`、`content_ko` |
| `*_question_keys`(答案表) | `explanation_ko`、`rubric_ko`、`sample_answer_ko` |
| `*_material_secrets`、`digital_textbook_listening_tracks`、`digital_textbook_activity_secrets` | `transcript_ko` |

校验函数也叫 `private.korean_bank_options_are_valid`、`korean_bank_text_is_valid` 等。相比之下,**下游的投放层是语言中立的**:`chapter_test_questions`、`assessment_paper_questions`、`learning_assignment_questions` 用的是 `prompt`、`options`。所以问题集中在"题库创作层"这一层。

**4.6.5 作业和题库的技能维度是"语言技能"**

约束里的取值域(取自本地库):

| 表 | 约束 |
|---|---|
| `chapter_homework_questions`、`chapter_homework_skill_settings` | `language_skill ∈ {vocabulary, grammar, listening, speaking, reading, writing}` |
| `learning_assignment_questions` | 同上再加空字符串 |
| `exam_bank_questions`、`homework_bank_questions` | `language_skill ∈ {listening, speaking, reading, writing}` |
| `exam_bank_materials`、`homework_bank_materials` | `language_skill ∈ {listening, reading}` |
| `exam_bank_question_skill_type_check` | 听力必须是单选且有 `material_id`,口语必须是 `audio_response` 等 |

题型取值(各表略有不同):`single_choice`、`multiple_choice`、`fill_blank`、`ordering`、`short_text`、`long_text`、`file_link`、`audio_recording`、`audio_response`,工具箱另有 `true_false`、`writing_text`、`speaking_recording`。**没有公式、分步解答、证明、图形题这类数学题型。**这套约束对英语基本适用(六技能一致),对数学不适用。

**4.6.6 韩语内容通过迁移注入**

16 章"golden smart textbook"内容各有一个迁移文件(`202608180005` 到 `202608180022`,合计约 6,274 行),另有 `seed_korean_level_one_*`、`seed_korean_chapters_two_to_sixteen_paper_drafts`、`generate-korean-question-bank-migration.mjs` 等。迁移里 `select set_config('app.platform_content_migration','on',true)` 之后执行大段 DO 块写入教材、章节、活动、媒体。也就是说韩语课程内容的进库方式是"生成迁移文件",而不是后台导入。

### 4.7 智能教材运行时

`src/features/smart-textbook-runtime`(113 个文件)加上 `src/lib/smart-textbook-runtime-v1`(契约,352 行)。

- **契约严格**:`contracts.ts` 全部使用 `z.strictObject`,块类型是封闭的 25 种:
  `video、image、text、rich_text、audio、dialogue、multiple_choice、multiple_select、fill_blank、ordering、listening、shadowing、pronunciation、role_play、writing、self_check、supplemental_visual、vocabulary_practice、grammar_practice、pattern_practice、listen_speak、read_write、review、compat.teacher.v1、compat.learning.v1`。
  其中偏语言学习的有 10 种(dialogue、listening、shadowing、pronunciation、role_play、vocabulary_practice、grammar_practice、pattern_practice、listen_speak、read_write)。**没有公式、函数图像、分步解题类的块。**
- **实际已实现渲染的只有 5 种**:`text`、`video`、`multiple_choice`、`compat.learning.v1`、`compat.teacher.v1`(见 `core/block-registry.ts`)。其余 20 种在注册表里标为 `unsupported`。
- **语言枚举写死**:`localeSchema = z.enum(['zh-CN','ko-KR'])`(`contracts.ts` 第 8 行),`localizedTextSchema` 同样只有这两个键。教师会话、跟读、TTS 都用这个 locale。英语教学需要扩展为 `en-US`,属于契约版本变更。
- **跟读文本字段**:`guided-repeat.server.ts` 里 `text: line.ko, translation: line.zh`,字段名就是 `ko` / `zh`。
- **与韩语耦合的代码量小**:运行时 113 个文件里,提到韩语或"第一章"关键词的只有 14 个,多数是 `locale` 或第一章数据的引用。可见运行时**本体是通用的,耦合主要在契约里的语言枚举和 Legacy 适配层**。
- 录音域 `recording_private`(4 张表)和 `src/lib/recording-*.server.ts`(3 个文件)完全不含韩语关键词,是通用能力,英语口语可以直接复用。

### 4.8 教学 Agent(`src/features/teaching-agent`)

59 个文件,13 个含韩语关键词,而且是**刻意限定**:

- `access-rules.ts` 的注释:"Deliberately limited to the audited Korean Student MVP, not every future profile."
- 技能目录 `skills/explain-pinned-korean-segment`(解释选中的韩语片段),以及 `profiles/student-ai-teacher.ts` 里 `explainSkillRef = { name: 'explain-pinned-korean-segment' }`。
- `student-prompt-assembler.ts`:提示词里写"你是初级韩语教学解释助手"。
- `profiles/kim-persona.ts`:金老师人设,`generic-korean-teacher`。
- `tools/contracts.ts`:`activityAlias: z.literal('hangul-introduction-vowel-recognition')`,一个字面量别名。
- `supabase-student-teaching-repository.ts`:`const koreanApp = '10000000-0000-4000-8000-000000000001'`。
- **另一个技能 `summarize-current-lesson-execution`(总结当前课堂执行情况)的目录里没有任何韩语文本**,从命名和内容看是通用的。它依赖的是课堂执行事实,是否能直接用于数学和英语,取决于那些事实的采集是否也通用,这一点我没有进一步核实。

### 4.9 测试与脚本

- `tests/` 里名字含 korean 的有 8 个。
- `scripts/` 里与韩语章节相关的约 40 项:`convert-korean-chapter-*.cjs` 共 16 个、`verify-chapter-*-security.mjs` 共 16 个,以及 `package.json` 里对应的 32 条 `test:chapter-*-security` / `content:chapter-*:check` 命令。
- 好消息:这些是"按章节"而不是"按学科"的验证,新学科可以照搬模式,不会被现有测试卡住。

---

## 5. 数据库盘点

### 5.1 环境与规模(本地库)

| 项目 | 数值 |
|---|---|
| PostgreSQL | 17.6 |
| 已应用迁移 | 410(最后一个 `202609040006`);仓库为 461 个 |
| public 基表 | 168 张;视图 8 个 |
| RLS | 168 张全部开启,10 张 FORCE |
| public 策略 / 函数 / 触发器 | 263 / 406 / 229 |
| private 函数 | 116 |
| 带 `tenant_id` 的表 | 101 张;不带的 67 张(主要是平台级内容:教材、题库、Agent 脚本、学校) |
| 数据量 | 1 个租户、1 条成员关系、2 个用户、16 个课时 |

仓库迁移中还出现了 `recording_private`(4 张表)、`runtime_publish_private`(10 张表)、`agent_core_private` 三个私有 schema;本地库尚未应用相关迁移。

按表名前缀粗分(本地库 168 张):student_* 18、learning_agent_* 16、作业/试卷 15、digital_textbook_* 15、course_* 12、题库 9、工具箱 9、chapter_* 9、留学 7、帮助/公告 7、租户 7、guide_agent_* 6、审计日志 5、直播 4、成绩 4、课时 4、资料库 4、会话练习 3、其他 14。

### 5.2 学科归属覆盖情况

**已有归属(31 张基表 + 2 个视图)**

`assessment_papers`、`chapter_practice_units`、`chapter_tests`、`conversation_practice_scenarios`、`course_categories`、`course_completion_certificates`、`course_completion_policies`、`course_completion_refresh_tasks`、`course_ebook_progress`、`courses`、`digital_textbooks`、`growth_toolbox_exercises / grammar / items / vocabulary`、`learning_assignments`、`learning_record_notes`、`learning_time_log`、`student_course_completion_evaluations`、`student_learning_activity_events`、`student_learning_task_preferences`、`student_review_items`、`student_weekly_learning_plans`、`teacher_learning_recommendations`、`tenant_student_assignments`、`toolbox_practice_sessions`;以及 `app_id` 列的 `application_access_audit_logs`、`institution_learning_followups`、`staff_app_assignments`、`student_app_enrollments`、`tenant_student_apps`;视图 `student_grade_skill_profiles`、`student_toolbox_skill_profiles`。

**没有归属列、靠上级继承**:见 3.1.3。

**没有任何学科维度的(需要留意)**

| 表 | 情况 |
|---|---|
| `exam_bank_*`、`homework_bank_*`(题库) | 只有 `language_skill` 和 `chapter_test_id`,靠 `chapter_test_id` 间接归属 |
| `guide_agent_navigation_rules` 等引导 Agent 表 | 规则里的目标路径写死为韩语 |
| `schools`、`school_programs`、`korean_universities`、`korean_university_programs` | 留学业务,本来就与学科无关 |

### 5.3 学习记录模型

| 表 | 记什么 | 学科归属 |
|---|---|---|
| `lesson_progress` | 课时状态(not_started / in_progress / completed)、百分比 | 通过 `course_id` |
| `student_learning_activity_events` | 通用事件流 | `student_app_id` |
| `learning_time_log` | 学习时长,键为 `test_slug` | `student_app_id` |
| `course_ebook_progress` | 电子书进度,键为 `test_slug` | `student_app_id` |
| `student_review_items` | 错题,含 `skill`、题目和作答快照、错误次数、掌握时间 | `student_app_id` |
| `learning_record_notes` | 教师学习记录备注 | `student_app_id` |
| `digital_textbook_attempts` 等 | 智能教材作答、节点进度、跟读、录音证据 | 通过教材 |
| `grade_items` | 成绩项 | 通过 `course_id` |
| `course_completion_*` | 结课策略、评估、证书 | `student_app_id` |

其中事件流和错题表是学科无关的;`test_slug`、`ebook` 这类键名带有韩语章节测试的历史痕迹,但字段类型是通用文本。

### 5.4 基线与迁移管理

`supabase/bootstrap/` 是新环境的基线方案:

- `app-schema-baseline.sql`(48,233 行,仅 schema,无业务数据)、`baseline-manifest.json`、`migration-ledger-baseline.json`、`orphan-migration-decisions.json`。
- 基线切点为 `202609130003 / runtime_authoring_nonretryable_error`;此后的增量迁移从 `202609140000_agent_core_foundation` 开始。
- README 用大写写明:**永远不要把基线应用到现有生产库**。基线里的对象数:函数 393、策略 287、索引 308、外键 521。
- 根目录 `README.md` 仍写着"仓库当前没有数据库 migration",与事实不符(已过期)。

### 5.5 值得记下的数据库观察

1. 应用归属的设计质量较高:创建后不可改、父子一致、缺失即拒绝,还删除了会"悄悄落入韩语"的默认值。这是最有价值的资产。
2. 4 个函数写死韩语 UUID,是唯一会让数据库层"偏向韩语"的地方,数量少,修复面很小。
3. 章节测试的 `slug` 全局唯一、`korean_title` 非空,会直接影响英语章节测试建库。
4. 题库层的 `_ko` 列名是最需要决策的:改列名要动 16 张以上表和若干函数,新增并行的中性列则要处理双写。
5. 迁移数量增长很快(2026-07 至 09 三个月 461 个),其中包含大量内容种子和修复迁移。

---

## 6. 新增一个学科时要碰的地方

"英语"和"数学"两列是按现状给出的判断,不是设计方案。

| 层 | 位置 | 现状 | 英语 | 数学 |
|---|---|---|---|---|
| 应用注册 | `student_apps`、`tenant_student_apps` | 行已存在,状态 `coming_soon` | 改状态为 active 即可 | 同左 |
| 学生授权 | `student_app_enrollments` | 需按学生创建 | 运营操作 | 同左 |
| 课程目录 | `course_categories` / `courses` | 需建一级分类(slug 与应用 slug 对应)和课程,`content_scope='platform'` | 可复用 | 可复用 |
| 学生路由 | `[space]/apps/<app>/…` | 英语、数学各 3 个占位文件;韩语 48 个 | 需要补齐 | 需要补齐 |
| 课程目录页 | `CourseCatalog` | 已参数化 | 可直接用 | 可直接用 |
| 课时页 | `…/[lessonSlug]/page-content.tsx` | 含韩语分支 | 需拆分 | 需拆分,且需要数学渲染 |
| 侧边栏 | `StudentSystemSidebar.tsx` | 英语数学只有"应用首页" | 需新增分组 | 同左 |
| 会员开关 | `student-permissions.ts` + `student_feature_allowed` | 只有 `korean_course` | 两处同步加 | 两处同步加 |
| 服务层 | chapter-practice、assignments、review-center 等 16 个文件 | 写死韩语 | 需参数化 | 需参数化 |
| 数据库函数 | 4 个写死 UUID、`evaluate_student_course_completion` 等 | 偏韩语 | 需改 | 需改 |
| 章节测试 | `chapter_tests` | `korean_title` 非空、slug 全局唯一 | 需处理 | 需处理 |
| 题库 | `exam_bank_*` / `homework_bank_*` | `_ko` 列、`language_skill` 约束 | 需决策(`_ko` 命名) | 需新建或大改(无公式题型) |
| 作业与试卷 | `learning_assignment_questions` 等 | 通用列,但 `language_skill` 与题型有约束 | 基本可用 | 需扩展题型和技能维度 |
| 录音与口语 | `recording_private` | 通用 | 可复用 | 不需要 |
| 智能教材契约 | `smart-textbook-runtime-v1` | locale 仅 zh-CN / ko-KR;20 种块未实现渲染 | 需加 `en-US` | 需新增块类型(契约升级) |
| 渲染依赖 | `package.json` | 无数学库 | 不需要 | 需要引入公式渲染;是否兼容 Cloudflare Workers 待验证 |
| 判分 | 服务端 | 选择题与录音证据 | 客观题可用,写作需评分量规 | 需要符号或数值等价判定 |
| 管理端 | `admin/apps/[appSlug]/…` | 8 个页面只对韩语开放 | 逐页决定 | 逐页决定 |
| AI | `learning_agent_profiles`、`teaching-agent` | 后者限定韩语 | 需新增技能与画像 | 需新增技能与画像 |
| 引导 Agent | `guide-agent-targets.ts` | 目标路径全是韩语 | 需补充 | 需补充 |
| 测试和脚本 | `scripts/`、`tests/` | 按章节的验证模式 | 可仿照 | 可仿照 |

---

## 7. 基于以上事实的路线建议

这一节是建议,不是已做的事。

1. **先定"英语、数学放在哪个应用下"。**系统里已经有 `english`、`math`、`university` 三个应用。"大学英语、大学数学"可以放进 `english` 和 `math`(按学科),也可以放进 `university`(按学段)。这个决定影响课程分类、权限、菜单,应最先确定。
2. **先"去焊点",不改行为。**目标是让韩语现有功能完全不变,只是把写死的 `STUDENT_APP_IDS.korean` 换成传参,把 4 个 SQL 函数里的 UUID 换成从内容推导,把 `korean_course` 换成"按应用取功能键"。改造样板可以参照 `student-home-learning` 和 `growth-toolbox`。这一步的范围可以精确圈定:16 个 `features/lib` 文件、38 个 `src/app` 文件、4 个 SQL 函数。
3. **把课时页里的韩语部分挪走。**保留通用的课时页骨架,把 `isHangulIntroduction`、`isKoreanLevelOne` 的分支和 28,719 行韩语组件收拢到一个韩语专属目录,通过注册方式接入。
4. **建议英语先行,数学后做。**理由:英语与韩语同属语言类,六技能、录音、TTS、题型和现有约束大体一致,主要工作是处理 `_ko` 列名和扩展 locale;数学几乎要新建渲染、题型、判题和教材块。先用英语验证"去焊点"是否有效,再上数学,风险更低。
5. **数学要单独立项评估。**至少包含:公式渲染库选型与 Workers 兼容性、题型与判题引擎(遵循"数值和判分由可信引擎计算,LLM 只讲解"的原则)、智能教材契约升级、题库的数学版设计。
6. **题库列名问题单独决策。**`_ko` 列名的处理方式(重命名、并行新增中性列、或英语先用独立表)会牵动多张表和函数,需要评估后再动手。

---

## 8. 待你决定的问题

1. 大学英语、大学数学归到 `english` / `math` 应用,还是 `university` 应用?
2. 学生是否要跨学科学习(同一个学生同时报名多个应用)?如果是,学生首页目前只汇总韩语,需要改成按应用切换或跨应用聚合。
3. 会员档位对新学科如何计费或开放?现在 `korean_course` 需要 vip2 及以上。
4. 英语题库是否复用现有的 `exam_bank_*` / `homework_bank_*`(接受 `_ko` 命名),还是先做迁移改造?
5. 教学 Agent 的"金老师"是否只服务韩语?英语、数学需要新的教师形象和技能吗?
6. 韩语代码是本轮就搬到专属目录,还是先保持原位、只做去焊点?
7. 本机上的 `~/projects/edumath` 是否与本次计划有关?(我没有查看。)

---

## 9. 对我此前建议的更正

前面几轮对话里,我给过一些建议和判断,其中几条与这次实测不符,在此更正:

| 之前的说法 | 实际情况 |
|---|---|
| "共享表加一个 `subject` 字段" | 已经存在,叫 `student_app_id`,共 31 张基表带有应用归属列,并有触发器保证一致性 |
| "`src/lib/korean-*.ts` 是主要耦合" | 这些文件很小(合计约 400 行)。真正的重量在课程页目录(28,719 行)、服务层的 `STUDENT_APP_IDS.korean`、4 个 SQL 函数、题库的 `_ko` 列名 |
| "先做一轮'平台契约'" | 平台契约大部分已经有了(应用注册表、入口守卫、归属触发器、Agent 的 `appId`)。缺的是**内容页、题库、评测**这几层的契约,而不是身份和权限 |
| "需要决定:课程页面走通用路由还是各学科自己的路由" | 项目已有约定:学生端走 `[space]/apps/<app>/…`,管理端走 `admin/apps/[appSlug]/…` |
| 第一份报告里说迁移中约 131 张表 | 本地库实际是 168 张基表 + 8 个视图;迁移文本里有 196 条建表语句(含私有 schema) |
| "`teaching-agent` 第二个技能可能是通用的(未核实)" | 核实后:`summarize-current-lesson-execution` 目录中没有韩语文本;但它依赖的课堂事实是否通用未验证 |

---

## 附录 A:写死韩语的文件清单(55 个)

**`src/app/api`(2)**
`assignments/[assignmentId]/draft/route.ts`、`lesson-resources/[resourceId]/download/route.ts`

**`src/app/dashboard`(30)**
`admin/apps/ManagementApplicationPeoplePage.tsx`、`admin/assignments/ChapterTestWorkspace.tsx`、`admin/assignments/HomeworkChapterWorkspace.tsx`、`admin/growth-toolbox/page-content.tsx`、`admin/question-bank/page-content.tsx`、`admin/student-assignments/actions.ts`、`assignments/actions.ts`、`assignments/[assignmentId]/page-content.tsx`、`assignments/korean/actions.ts`、`assignments/korean/page-content.tsx`、`assignments/korean/[testSlug]/page-content.tsx`、`assignments/page-content.tsx`、`conversation-practice/course/page-content.tsx`、`conversation-practice/page-content.tsx`、`conversation-practice/[scenarioId]/page-content.tsx`、`courses/[categorySlug]/page-content.tsx`、`courses/…/[lessonSlug]/actions.ts`、`courses/…/[lessonSlug]/page-content.tsx`、`courses/…/[lessonSlug]/smart-textbook-actions.ts`、`courses/…/[courseSlug]/page-content.tsx`、`courses/…/[subcategorySlug]/page-content.tsx`、`courses/page-content.tsx`、`DashboardHomePage.tsx`、`grades/page-content.tsx`、`progress/page-content.tsx`、`records/page-content.tsx`、`toolbox/actions.ts`、`toolbox/page-content.tsx`、`toolbox/[skill]/page-content.tsx`、`toolbox/vocabulary/page-content.tsx`

**`src/app/[space]`(6)**
`apps/korean/assignments/[assignmentId]/layout.tsx`、`apps/korean/practice/course/page.tsx`、`apps/korean/practice/review/page.tsx`、`dashboard/admin/apps/[appSlug]/completion-review/page.tsx`、`dashboard/admin/apps/[appSlug]/learning-plans/page.tsx`、`page.tsx`

**`src/features`(15)**
`chapter-practice/`(`api/management-service.ts`、`api/service.ts`、`api/student-service.ts`、`listening-actions.ts`、`progress-actions.ts`、`student/progress-service.ts`)、`course-completion/`(`review-actions.ts`、`student-service.ts`)、`development-execution/server/lesson-facts-readonly.server.ts`、`platform-learning-insights/PlatformInsightPage.tsx`、`student-ability-portrait/api/service.ts`、`student-assignments/api/service.ts`、`student-current-course/api/service.ts`、`student-review-center/actions.ts`、`teacher-practice-insights/actions.ts`

**`src/lib`(2)**
`course-practice-catalog.server.ts`、`student-apps.ts`(定义文件本身)

另外 `src/features/teaching-agent/server/repositories/supabase-student-teaching-repository.ts` 使用了自己的常量 `koreanApp`,不在上面的搜索命中里。

## 附录 B:数据库里带应用归属的对象

见 5.2。

## 附录 C:主要调查方式

- 文件统计:`find`、`wc`、`grep`。
- 表结构:对迁移文本做解析,并以本地库的 `information_schema`、`pg_constraint`、`pg_policies`、`pg_proc` 为准。
- 函数定义:`pg_get_functiondef`(只读)。
- 所有数据库查询都通过 `docker exec … psql`,并设置 `default_transaction_read_only=on`,只做 `SELECT`。

## 变更声明

调查期间的实际文件变动如下,没有隐瞒:

1. **新增**:本文件 `docs/project-and-database-investigation-2026-09-29.md`。此前按你要求保存的 `docs/shared-platform-subject-modules-architecture.md` 是上一轮新增的。
2. **被覆盖的未跟踪文件**:第一次做项目报告时,我运行了 `npm run test:navigation`。该命令包含的测试 `tests/teaching-agent-r7cb-b3-budget.test.mjs` 会把结果写入 `docs/evidence/teaching-agent-stage-1f-r7c-b/b3-isolated-budget-results.json`。这个文件此前就存在(创建于 2026-09-17,未被 git 跟踪),被这次测试覆盖,最后修改时间为 2026-09-29 12:41。它的内容由测试固定生成,不含时间戳,内容大概率一致,但由于文件未被跟踪,我无法比对旧内容。如果你有该文件的备份,可以对照一下。
3. **不是我产生的变动**:调查过程中发现 `docs/evidence/teaching-agent-stage-1f-r7d-c/r7d-c3b-session-source-acquisition-fresh-validation-failure.json`(权限 600,约 288KB)在 2026-09-29 13:30 被创建。当时我只在运行只读查询,所以应该是你机器上另一个进程(比如 Codex)在写入。也就是说仓库此刻可能有别的任务在同时运行。
4. 我临时使用的中间文件都放在会话的 scratchpad 目录里,其中一个 200MB 的测试输出文件已经删除。
