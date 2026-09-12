# UPLY 智能教材当前状态审计

> 审计日期：2026-09-08
> 审计范围：学生端智能教材、平台管理后台、API / Server Action、Supabase 数据模型与迁移、当前配置库中的真实发布数据
> 审计原则：以本次审计时工作区代码和只读数据库查询为事实来源；未修改业务代码、API、数据库或学生端效果。

## 0. 结论摘要

当前智能教材不是一个通用页面编排引擎，而是“固定 React 学习播放器 + 固定八模块骨架 + 数据库内容”的混合实现：

- 学生入口最终由 `page-content.tsx → loadSmartDigitalTextbook() → SmartTextbookShell` 组成。初次页面数据不是浏览器 `fetch`，而是 Next.js Server Component 直接查询 Supabase 后把完整 `SmartTextbookData` 作为 props 传给客户端 Shell。
- 16 个正文章复用同一个 `SmartTextbookShell`。左侧教学区、右侧学习区、顶部和底部 Step 导航都集中写在约 7,500 行的 `KoreanLevelOneSmartTextbook.tsx` 中。
- 八个 Step 对应八个 `digital_textbook_modules.module_code`：`orientation`、`vocabulary`、`grammar`、`patterns`、`dialogue`、`listen_speak`、`read_write`、`review`。UI 映射数据库返回的 module 数组，但允许的 module code、页数、页名、插槽和部分完成权重仍写死在 `SMART_TEXTBOOK_SHARED_SKELETON`。
- 左侧教学区不是章节视频播放器本身，而是教学 Agent 的课堂舞台。它既可播放 `teacherVideo`，也保留角色图片、台词、语音、黑板幻灯片、位置和动作控制的 legacy 模式。
- 右侧不是单一“题目区”，而是固定的学习内容渲染器与活动渲染器组合。数据库 JSON 提供词汇、语法、对话、听说读写内容和活动配置；React 根据 module code、activity type、activity key 和约定 JSON key 选择固定布局。
- 教材管理后台目前只编辑词汇和语法 JSON，不是完整章节/Step/布局编辑器。教学脚本后台可编辑 Agent 节点、台词、角色/视频、黑板、学生任务、提问与流转。
- 权限现状不完全等同于“仅 `platform_owner`”：教学脚本服务和写操作确实强制 `requirePlatformOwner()`；教材页面外层仅要求 `manageContent`，教材编辑再依赖共享 RPC `current_user_can_manage_standard_question_bank`，发布才明确要求 `platform_owner`。因此教材编辑授权模型仍与通用题库权限耦合。
- 生产库第一章当前发布脚本为 v23，8 个脚本节点均带 `virtualCharacter`，0 个节点带 `teacherVideo`。因此旧金老师时期的角色位置、姿势、语音和黑板编排并非全部死代码；它仍是当前第一章发布运行路径的一部分，但当前前端实际显示的是图片帧角色，不是浏览器 3D 引擎。

## 1. 审计方法与事实边界

本报告使用了以下证据：

1. 当前路由、组件、Server Action、Route Handler 和 Supabase 查询代码。
2. `supabase/migrations/` 中的表、约束、RPC 和历史演进。
3. 对当前 `.env.local` 指向的 Supabase 进行只读查询，核对教材 `korean-level-one-smart` 第一章发布记录。
4. 对当前路由的 import 关系进行反查，以区分现行入口与未被引用的旧页面。

限制：

- 报告没有写数据库，也没有执行学生提交、发布或媒体上传操作。
- 共享权限 RPC `current_user_can_manage_standard_question_bank` 的全部角色授权来源跨越通用权限系统；本报告能确认调用点和页面行为，不能仅凭名称断言所有线上账号的最终返回值。相关处标为“依赖 RPC”。
- “生产库实况”是 2026-09-08 的快照，后续发布会改变版本号和内容。

## 2. 当前智能教材总体架构

```mermaid
flowchart LR
  A[课程 lesson 页面\npage.tsx / page-content.tsx] --> B[loadSmartDigitalTextbook\nServer Component 内直接调用]
  B --> C[(Supabase\ndigital_textbook_*\nlearning_agent_*)]
  B --> D[R2 签名图片/音频 URL]
  B --> E[SmartTextbookData]
  E --> F[SmartTextbookShell\n固定左右区 + Step 导航]
  F --> G[左侧教学区\nAgent / 黑板 / 角色或教师视频]
  F --> H[右侧学习区\nContentRenderer + Activity]
  F --> I[底部 module/Step 导航]
  H --> J[Server Actions\n作答、页进度、跟读进度]
  G --> K[/api/learning-agent/respond\nevents / speech / teacher-video]
  H --> L[/api/digital-textbook/audio\ntranscript / recordings]
  J --> C
  K --> C
  L --> C

  M[教材制作后台] --> N[教材 Server Actions]
  N --> C
  O[教学脚本后台] --> P[脚本 Server Actions / RPC]
  P --> C
```

核心运行文件：

| 层 | 当前文件 / 符号 | 责任 |
| --- | --- | --- |
| 学生 URL 入口 | `src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx` | 将空间路由转给共享课程页面，并传入 `courseBasePath` |
| 路由判定和服务端加载 | `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx` | 鉴权、课程解锁、识别 `basic-pronunciation`，解析 `?chapter=korean-level-one-XX`，调用 loader |
| 数据加载 | `src/lib/smart-digital-textbook.ts → loadSmartDigitalTextbook()` | 查询教材、版本、章、module、node、activity、媒体、进度和教学 Agent 开场配置 |
| Shell 导出 | `.../SmartTextbookShell.tsx` | 仅重新导出实际实现 |
| 实际播放器 | `.../KoreanLevelOneSmartTextbook.tsx → SmartTextbookShell` | 完整 UI、交互状态、Agent 协调、Step 导航 |
| 固定骨架 | `src/lib/smart-textbook-skeleton.ts` | 八个模块的页面、页面名、数据插槽、活动插槽和布局常量 |

## 3. 学生端真实架构

### 3.1 页面入口与章节选择

真正运行的入口不是 16 个 `KoreanLevelOneLesson*Book.tsx`，而是动态课程路由：

`src/app/[space]/apps/korean/courses/.../[lessonSlug]/page.tsx`
→ `src/app/dashboard/courses/.../[lessonSlug]/page-content.tsx`
→ `loadSmartDigitalTextbook()`
→ `SmartTextbookShell`。

`page-content.tsx` 只有在以下课程身份同时匹配时才进入智能教材分支：

- 父分类 `korean`
- 子分类 `korean-basic`
- 课程 `korean-beginner`
- curated lesson slug `basic-pronunciation`

章节号来自查询参数 `chapter` 的数值后缀；例如 `korean-level-one-01` 解析为第一章。loader 固定使用教材 slug `korean-level-one-smart`。

`KoreanLevelOneReader.tsx`、`KoreanLevelOneBookTemplate.tsx` 和 16 个 `KoreanLevelOneLesson*Book.tsx` 当前没有被上述现行入口 import。它们是旧实现/候选旧内容，不能当成当前学生运行代码。`KoreanLevelOneCourseOverview.tsx` 例外：chapter 0 时仍由当前 Shell 使用。

### 3.2 页面总体骨架

`SmartTextbookShell` 在 `KoreanLevelOneSmartTextbook.tsx` 中实现：

- 全屏根容器和学习头部：约 `6207`、`6262` 行。
- 主体左右布局：约 `6373` 行；使用 Flex，在普通大屏是横向，视频模式在窄屏切换为纵向。
- 左侧 `<aside>`：约 `6375` 行。
- 右侧学习区：约 `7027` 行。
- 右侧内部标题/分页头：约 `7040` 行。
- 内容滚动区：约 `7208` 行。
- 底部 Step footer：约 `7423` 行。

布局比例和断点写死于 `src/lib/smart-textbook-skeleton.ts → SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT`：

| 常量 | 当前值 | 效果 |
| --- | ---: | --- |
| `teachingArea.defaultWidthPercent` | 30 | 大屏左侧教学区固定 30%，右侧 `flex-1` 使用剩余空间 |
| `teachingArea.collapsedWidthPx` | 64 | 教学区收起宽度 |
| `splitMinimumViewportWidthPx` | 1280 | 低于该宽度不使用并排分屏 |
| `focusedContentMaxWidthPx` | 920 | 聚焦学习内容最大宽度 |
| `blackboard.aspectRatio` | `16 / 9` | 黑板画面比例 |
| `learningHeader.heightPx` | 56 | 右侧学习头高度 |
| `learningHeader.contentInsetPx` | 48 | 内容内缩 |

窄屏时不是简单 30/70：教师视频区可占 100% 宽且最大约 `48dvh`；非视频/非聚焦条件下左侧可隐藏。教学 Agent 讲解时还能根据 `shouldUseSmartTextbookTeachingFocusMode()` 隐藏右侧，等到 `focus_activity` 再恢复。

结论：每章复用相同 Shell；整体区域和响应式规则写死，章节内容数据化。

### 3.3 左侧教学区

左侧由 `SmartTextbookShell` 直接编排，而不是独立可配置 Region。主要组成：

- `TeacherVideoPlayer`：`src/components/learning-agent/TeacherVideoPlayer.tsx`，播放 `teacherVideo` 对应对象存储视频。
- legacy 教师角色舞台：`src/lib/teacher-kim-character.ts` 提供角色姿势映射，经 `/api/learning-agent/characters/[pose]` 读取图片帧。
- `TeachingBlackboardSlide`：`src/components/learning-agent/TeachingBlackboardSlide.tsx`，显示 `configuration.display.slides[].elements`。
- Agent 台词、回答选项、操作提示和继续按钮：由 Shell 根据 `/api/learning-agent/respond` 返回值渲染。
- 语音：`/api/learning-agent/speech/[assetId]` 返回预生成台词音频；没有成品时 runtime 还有相应状态处理。

数据来源：

| 内容 | 来源 |
| --- | --- |
| 初始开场 `bufferLine`、首张黑板、首个角色 | `loadSmartDigitalTextbook()` 查询发布的 `learning_agent_script_versions` 第一条 `learning_agent_script_nodes.configuration` |
| 后续台词和节点流转 | `/api/learning-agent/respond` 查询当前发布脚本、session、node 和教材活动 |
| 教师视频 | 脚本节点 `configuration.teacherVideo`，由 `/api/learning-agent/teacher-video` 读取/代理 |
| legacy 角色 | `configuration.virtualCharacter`、`configuration.scriptPerformances[]`；图片映射写死在前端库 |
| 黑板幻灯片 | `configuration.display` JSON；元素渲染类型和舞台布局写死在 React |
| 台词语音 | `learning_agent_script_audio_assets`，Route Handler 按发布状态/预览权限提供 |

前端仍写死：舞台 DOM 层级、左侧宽度、角色图片实现、允许的姿势/布局表现、黑板元素 renderer、讲解时的显隐策略、默认按钮和回退文案。后台不能改变教学区与右区的根级结构。

### 3.4 右侧交互学习区

右侧包含三个内部层级：

1. 固定学习头：module 标题、说明提示、完成状态和页签。
2. 可滚动内容区：`ContentRenderer` 输出知识内容和模块专用练习面板。
3. 底部固定 Step 导航：在所有 module 间切换。

主要组件均在 `KoreanLevelOneSmartTextbook.tsx`：

| 组件 | 角色 | 服务器访问 |
| --- | --- | --- |
| `ContentRenderer` | 按 `node.content` 的约定 key 渲染词汇、语法、句型、对话等 | 自身不直接查询数据库；通过回调报告学习事件 |
| `Activity` | 八种基础活动的统一入口 | 调用提交/页检查 Server Action；部分子组件调用媒体 API |
| `PatternConversationPractice` | `pattern-choice` 引导选择 | Server Action |
| `PatternCompositionPractice` | `pattern-order` / `pattern-compose` | Server Action |
| `ListenSpeakLearningPanel` | 听前、听辨、跟读、独立口语的四页流程 | 音频/录音 API、跟读进度 Action |
| `DialogueRoleplayPractice` | 固定 `dialogue-roleplay` 活动 | MediaRecorder、SpeechRecognition、录音 API、完成 Action |
| `ReadWriteLearningPanel` | 阅读理解和写作 | Server Action |
| `ReviewResultPanel` | 综合测试/自查结果 | 使用已加载活动和完成态 |
| `RecordingControl` | 浏览器录音与上传 | `/api/digital-textbook/recordings/[activityId]` |

当前 activity type 共八种，类型定义在 `src/lib/smart-digital-textbook.ts → SmartActivityType`，校验在 `smart-textbook-submission.ts → gradeSmartTextbookActivity()`：

`single_choice`、`multiple_choice`、`fill_blank`、`ordering`、`listening`、`speaking`、`writing`、`self_check`。

通用程度是两层混合：

- `Activity` 对八种原子类型具有通用分支，题干、选项、答案、公开配置均可数据驱动。
- 复合教学流程仍绑定 module code、activity key 和 JSON 形状。例如 `pattern-choice`、`pattern-order`、`pattern-compose`、`dialogue-roleplay` 是硬编码 key；听说、读写和复盘面板按固定 module code 找特定类型。
- `ContentRenderer` 直接识别 `lead`、`coach`、`targets`、`dialogueGroups`、`vocabulary`、`rules`、`grammarCards`、`substitutionGroups`、`dialogueScenes`、`reading`、`writingFrame`、`repeatTracks` 等字段。数据库可以填值，但不能声明一个新字段应由什么组件显示。

因此右侧已经存在内部布局逻辑，但不是后台可编排的子区域系统。

### 3.5 Step 的真实实现

当前 UI 中 Step 等同于 module，而不是 `digital_textbook_nodes` 或教学脚本节点。

- 定义：`digital_textbook_modules` 的 8 个记录。
- 可用 code：数据库 check constraint 和 `SMART_TEXTBOOK_SHARED_SKELETON` 双重固定八类。
- 数量：footer 使用 `textbook.modules.length` 和动态 grid 列数，不是 React 中直接写 `8`；但正常数据模型只允许上述八类且 `sort_order` 为 1–8，所以产品层面仍是固定八步。
- 标题：通常来自 `digital_textbook_modules.title`。第一章 footer/知识地图会被前端 `chapterOneKnowledgeMap` 覆盖为更具体标题。
- 页签标题：来自 `SMART_TEXTBOOK_SHARED_SKELETON[moduleCode].pageLabels`，不是数据库。
- 切换：`SmartTextbookShell → selectModule()` 设置 `activeIndex`，同时重置 `missionPage`、`patternPage` 和教学状态。
- 当前状态：React state 中保存 `activeIndex` 和模块内页状态。
- 刷新恢复：写入 `sessionStorage`，key 为 `smart-textbook-view:${textbook.id}`，保存 `activeIndex`、`missionPage`、`patternPage`。同一浏览器标签页刷新可恢复；关闭会话后不能保证恢复。
- 风险：key 只包含 textbook id，不包含 chapter/version id；不同章节共用同一教材 key，可能继承不合适的 module/page 索引。
- 学习完成状态：另从数据库 `digital_textbook_node_progress`、attempt、activity page progress 和 guided repeat progress 恢复；它与纯 UI 的当前 Step 位置不是同一个概念。

## 4. 平台管理后台真实架构

### 4.1 教材制作

| 项目 | 现状 |
| --- | --- |
| 路径 | `/[space]/dashboard/admin/apps/[appSlug]/textbooks` |
| 路由文件 | `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/page.tsx` |
| 页面组件 | `DigitalTextbookAdminPage` → `DigitalTextbookListing` → `DigitalTextbookTable` / `DigitalTextbookContentDialog` |
| 读取服务 | `src/features/digital-textbook/api/service.ts → getDigitalTextbookManagementData()` |
| 可编辑范围 | 教材状态；章节发布；词汇 node 的 `content.vocabulary[]`；语法 node 的 `content.grammar[]`；语法音频 object key |
| 保存方式 | `src/app/dashboard/admin/digital-textbook/actions.ts` 中的 Server Actions |
| 保存位置 | `digital_textbooks.status`、`digital_textbook_nodes.content` JSON、R2 语法音频；发布通过 RPC |

词汇字段：`ko`、`zh`、`pos`、`collocation`、`transcription`。

语法字段：`title`、`meaning`、`cases[{batchim,conjugation}]`、`rows[{form,combination,audio}]`、`examples[{ko,zh,audio}]`、`caution`。

主要 Action：

- `setTextbookStatusAction()`
- `publishTextbookChapterAction()` → `publish_digital_textbook_chapter` RPC，并同步章节练习派生数据
- `add/update/removeVocabularyWordAction()`
- `add/update/removeGrammarItemAction()`
- `createGrammarAudioUploadUrlAction()`、`confirmGrammarAudioUploadAction()`、`getGrammarAudioSignedUrlAction()`

此后台**不能**编辑章节标题/情境/目标、module 标题、module 数量/顺序、Step 页签、普通 node 内容、活动、答案、图片、听力主音频、右侧布局或左侧布局。

读取服务虽然同时查询并返回 `growth_toolbox_vocabulary`、`growth_toolbox_grammar` 和 `totalVocabulary`，当前 `DigitalTextbookListing` 只消费 `courses`、`canManage`、`canPublishChapters`、`hasError`。这些工具箱数据对该页面是已读取但未显示的 payload。

### 4.2 教学脚本

| 项目 | 现状 |
| --- | --- |
| 路径 | `/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts` |
| 预览 | `/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview` |
| 路由文件 | `.../teaching-scripts/page.tsx`、`.../preview/page.tsx` |
| 页面组件 | `TeachingScriptStudio`、`TeachingScriptNodeForm`、`TeachingBlackboardEditor`、`VirtualCharacterStageEditor`、`TeacherVideoPicker` |
| 读取服务 | `src/features/learning-agent-script-studio/service.ts → getTeachingScriptStudioData()` |
| 保存 Action | `src/app/dashboard/admin/teaching-scripts/actions.ts` 及 `teacher-video-actions.ts`、`source-review-actions.ts`、`release-check-actions.ts` |
| 保存位置 | `learning_agent_lessons`、`learning_agent_script_versions`、`learning_agent_script_nodes`、interaction secret、audio asset、模板/审查/发布表 |

脚本节点后台当前可编辑：节点类型/标题/顺序、教师中韩台词、教师视频五类 turn、黑板 slides/elements 和摆放、角色类型/姿势/位置/缩放、朗读语言/速度、课堂镜头/学习布局、自动继续、学生操作目标、视觉提示、宠物动作目标、自建单选题或教材活动引用、正确/错误反馈、提示/例句、next/remediation/terminal 流转、继续按钮文字。

版本操作包括建 draft、添加/移动/删除节点、删除版本、发布；保存节点的当前关键 RPC 是 `save_teaching_script_node_atomic`，发布检查/快照使用 `teaching_script_publish_snapshot`、`publish_teaching_script_checked`，历史迁移中还存在旧版 `create_learning_agent_script_draft`、`publish_learning_agent_script_version`。

预览复用学生 `SmartTextbookShell`，设置 `trackingDisabled: true`，并通过 `/api/learning-agent/preview-respond` 使用指定 draft version。`TeachingScriptStudio` 当前只允许第一章进入教材预览，其他章显示不支持。

### 4.3 其他相邻后台，不是学生教材主数据源

| 页面 | 关系 | 是否直接驱动学生教材 |
| --- | --- | --- |
| `/.../content` | 课程/章节结构，并链接到教材页面 | 课程入口有关系；不编辑 `digital_textbook_nodes` 内容 |
| `/.../toolbox` | 成长工具箱词汇/语法库 | 否；是独立副本/自定义库 |
| `/.../practice-center` | 章节练习发布块 | 否；是发布时同步的派生练习体系 |
| `src/app/[space]/dashboard/admin/digital-textbook/page.tsx` | 旧的非 app-scoped 页面 | 不属于当前 app 管理入口 |

`growth_toolbox_vocabulary` / `growth_toolbox_grammar` 中 `source='textbook'` 也只是教材导入副本；代码文案明确为副本，不会成为学生教材实时 source of truth。章节练习同样有自己的 snapshot/发布/进度表。

### 4.4 当前权限控制

| 层级 | 实现 | 当前效果 |
| --- | --- | --- |
| 管理应用 section 外层 | `ManagementApplicationSectionPage.tsx → requireManagementApplicationSection()` | `textbooks`、`teaching-scripts` 均只要求 app capability `manageContent` |
| 教材读取 | `getDigitalTextbookManagementData()` | tenant 用户需 `requireTenantAppCapability(...,"manageContent")`；平台侧允许 owner/admin |
| 教材编辑 | `digital-textbook/actions.ts → canManageTextbooks()` | 依赖 `current_user_can_manage_standard_question_bank` RPC；不是代码中显式仅 owner |
| 教材章节发布 | `publishTextbookChapterAction()` | 显式 `requirePlatformOwner()` |
| 教学脚本读取 | `getTeachingScriptStudioData()` | 首行 `requirePlatformOwner()` |
| 教学脚本写入/发布/媒体 | 所有相关 Action | `requirePlatformOwner()` |
| 教学脚本预览 | preview page | `requirePlatformOwner()` |

结论：教学脚本的实质权限符合仅 `platform_owner`；教材管理页的外层可见性/读取和编辑权限并未统一成仅 owner，且编辑能力依赖题库共享 RPC。机构成员是否最终能编辑，取决于该 RPC，不能从教材模块代码独立确认；但它们至少可能通过 `manageContent` 到达路由和读取服务。这是现状审计结论，本阶段未修改。

## 5. 当前数据库与数据模型

项目没有发现 Prisma/Drizzle 等 ORM schema。运行代码使用 `@supabase/supabase-js` query builder，配合手写 TypeScript 类型；未发现一份覆盖这些表的生成式 `Database` 类型。

### 5.1 教材主模型

| 表 | 核心字段 | 用途 |
| --- | --- | --- |
| `digital_textbooks` | `lesson_id`、`student_app_id`、`slug`、`level_code`、`title jsonb`、`status`、`agent_profile_id` | 教材根记录 |
| `digital_textbook_versions` | `textbook_id`、`version_number`、`status`、`release_notes`、`published_at` | 教材版本 |
| `digital_textbook_chapters` | `version_id`、`chapter_test_id`、`slug`、`chapter_number`、`title/scenario/goal jsonb`、`status` | 章节 |
| `digital_textbook_modules` | `chapter_id`、`module_code`、`sort_order`、`accent_role`、`title/description jsonb` | UI Step |
| `digital_textbook_nodes` | `module_id`、`node_code`、`node_type`、`sort_order`、`estimated_minutes`、`title jsonb`、`content jsonb` | 每 Step 的正文内容容器 |
| `digital_textbook_activities` | `node_id`、`activity_key`、`activity_type`、`prompt/instruction jsonb`、`options jsonb`、`public_config jsonb`、`max_attempts` | 互动题/任务公开配置 |
| `digital_textbook_activity_secrets` | `activity_id`、`answer_key jsonb`、`explanation jsonb`、`transcript_ko`、`audio_object_key`、`audio_status` | 答案、反馈和听力私密资源 |
| `digital_textbook_media_assets` | `node_id`、`activity_id`、`asset_key`、`media_type`、`purpose`、`object_key`、`production_status`、`alt_text/metadata jsonb` | R2 图片/音频清单；表约束只允许 image/audio |
| `digital_textbook_listening_tracks` | `activity_id`、`track/page index`、`audio_object_key`、`audio_status`、`transcript_ko` | 多轨/分页听力音频与稿件 |

主表起点为 `202607310013_smart_digital_textbook_chapter_one.sql`；媒体表见 `202608180005_chapter_one_golden_smart_textbook.sql`；听力轨见 `202608240006_split_chapter_one_listening_into_two_tracks.sql`。后续各章 migration 直接插入/更新大量 JSON 内容。

### 5.2 学习进度与证据

- `digital_textbook_preferences`：语言/辅助模式等偏好。
- `digital_textbook_attempts`：activity 作答、正确性、分数、attempt number、完成要求。
- `digital_textbook_node_progress`：node 完成百分比、mastery、attempt count。
- `digital_textbook_activity_page_progress`：多页活动每页完成。
- `digital_textbook_guided_repeat_progress`：跟读各句进度。
- `digital_textbook_speaking_evidence`：口语录音证据。
- 录音对象本体保存在对象存储，记录/证明信息进数据库。

### 5.3 教学脚本模型

| 表 | 用途 |
| --- | --- |
| `learning_agent_profiles` / `learning_agent_profile_secrets` | 教学 Agent 公开/私密配置 |
| `learning_agent_lessons` | 将一个教材 module 绑定到 Agent lesson |
| `learning_agent_script_versions` | draft/published/archived 脚本版本 |
| `learning_agent_script_nodes` | 节点台词、类型、标题、configuration JSON、教材活动引用、流转 |
| `learning_agent_node_interaction_secrets` | 脚本自建单选的正确项和反馈 |
| `learning_agent_script_audio_assets` | 节点台词分段音频和 voice manifest |
| `learning_agent_sessions` / `learning_agent_messages` | 学生教学会话与消息 |
| `learning_agent_node_attempts` / `learning_agent_task_events` | 教学节点作答和操作事件 |
| character/blackboard style template 表 | 后台角色/黑板模板 |
| `teaching_script_source_reviews` | 脚本来源审查 |

最初 migration 中出现过 `digital_textbook_teaching_lessons/steps/sessions/messages`，随后迁移重命名为 `learning_agent_*`。`respond/route.ts` 仍保留读取旧 `learning_agent_steps` 的兼容 fallback；当前 Script Studio 的主结构是 version + script nodes。

### 5.4 七个问题的直接答案

| 问题 | 当前答案 |
| --- | --- |
| 章节数据存在哪里？ | 主体在 `digital_textbook_chapters`；课程入口/解锁还依赖 `courses`、`lessons`、课程章节关系；chapter 0 的大段概览内容另写死在 React |
| Step 数据存在哪里？ | 实例和标题在 `digital_textbook_modules`；允许的八类、内部页、页名和插槽在 `smart-textbook-skeleton.ts` |
| 教学区数据存在哪里？ | Agent 脚本表，主要是 `learning_agent_script_nodes.teacher_script` 与 `configuration`；音频在 `learning_agent_script_audio_assets`，对象在 R2；角色资源映射仍在前端代码 |
| 交互区数据存在哪里？ | 正文在 `digital_textbook_nodes.content` JSON；活动公开部分在 `digital_textbook_activities`；答案/反馈/听力私密配置在 secrets/tracks；布局和字段解释在 React |
| 视频配置存在哪里？ | 教师视频引用在 `learning_agent_script_nodes.configuration.teacherVideo`；文件在对象存储；教材 `digital_textbook_media_assets` 本身不允许 video。黑板 video 也可通过脚本黑板元素/对象存储使用 |
| 题目/互动配置存在哪里？ | 教材题在 activities + activity_secrets；脚本自建题在 script node configuration + node_interaction_secrets；脚本也可 `reference_activity_id` 引用教材题 |
| 教学脚本存在哪里？ | `learning_agent_lessons → learning_agent_script_versions → learning_agent_script_nodes`，另有 secret、audio、session/event 表 |

## 6. API、Server Action、Service、类型和 RPC

### 6.1 学生端 Route Handlers

| Route | 作用 | 主要数据 |
| --- | --- | --- |
| `GET /api/digital-textbook/audio/[activityId]` | 校验活动可见性，按 page/track 返回听力音频 | activity secret / listening tracks + R2 |
| `GET /api/digital-textbook/transcript/[activityId]` | 返回授权后的听力稿 | listening tracks / activity secret |
| `GET/POST/DELETE /api/digital-textbook/recordings/[activityId]` | 录音读取、上传、删除 | speaking evidence + R2 |
| `POST /api/learning-agent/respond` | 现行教学 Agent 推进、提问和反馈 | published script、session、message、教材活动 |
| `POST /api/learning-agent/preview-respond` | 后台 draft 脚本预览 | 指定 script version，不记学习进度 |
| `POST /api/learning-agent/events` | 学生教材操作/媒体事件 | task events、脚本状态 |
| `POST /api/learning-agent/preview-event` | 预览事件 | 预览状态 |
| `GET /api/learning-agent/speech/[assetId]` | 脚本语音 | script audio asset + R2 |
| `GET /api/learning-agent/teacher-video` | 教师视频 | configuration object key + R2 |
| `GET /api/learning-agent/blackboard-media` | 黑板图片/视频 | R2 |
| `GET /api/learning-agent/characters/[pose]` | 金老师姿势图片 | `teacher-kim-character.ts` 资源映射 |
| `GET /api/learning-agent/companions/[companion]` | 陪伴角色资源 | 前端/服务器资源映射 |

### 6.2 学生端 Server Actions

文件：`src/app/dashboard/courses/.../[lessonSlug]/smart-textbook-actions.ts`。

- `submitSmartTextbookActivityAction()` → `submitSmartTextbookActivityForContext()` → `gradeSmartTextbookActivity()` → `record_smart_textbook_attempt` / `record_smart_textbook_speaking_attempt`。
- `checkSmartTextbookActivityPageAction()`：按 secret 校验分页任务，写 `digital_textbook_activity_page_progress`。
- `saveGuidedRepeatProgressAction()`：写 `digital_textbook_guided_repeat_progress`。
- `completeDialogueRoleplayAction()`：验证录音证据并记录完成。
- `saveSmartTextbookPreferenceAction()`：保存学习偏好。

`smart-textbook-submission.ts` 把答案校验留在服务器：公开 props 不包含 `answer_key`。objective type 走正确性/分数判断；speaking/writing/self_check 等 open activity 还判断最低字数、录音证据、确认项等完成要求。RPC schema 不匹配时有 objective activity 的直接表写入兼容 fallback。

### 6.3 管理端 Service / Action / RPC

教材读取：`src/features/digital-textbook/api/service.ts`。教材编辑：`src/app/dashboard/admin/digital-textbook/actions.ts`。教学脚本读取：`src/features/learning-agent-script-studio/service.ts`。教学脚本写入：`src/app/dashboard/admin/teaching-scripts/actions.ts`。

智能教材直接相关 RPC：

- `record_smart_textbook_attempt`
- `record_smart_textbook_speaking_attempt`
- `publish_digital_textbook_chapter`
- `create_learning_agent_script_draft`
- `publish_learning_agent_script_version`（历史/兼容）
- `save_teaching_script_node_atomic`
- `teaching_script_publish_snapshot`
- `publish_teaching_script_checked`
- 脚本来源审查相关 RPC

迁移中未发现智能教材专用数据库 View。权限还调用共享 RPC `current_user_can_manage_standard_question_bank`。

主要 TypeScript 类型：

- `src/lib/smart-digital-textbook.ts`：`SmartTextbookData`、`SmartTextbookModule`、`SmartTextbookNode`、`SmartTextbookActivity`、`SmartTextbookMediaAsset`、`SmartActivityType`。
- `src/features/digital-textbook/api/types.ts`：教材管理端词汇/语法/课程树类型。
- `src/features/learning-agent-script-studio/types.ts`：脚本版本、节点、视频、学习目标和模板类型。
- `src/lib/teaching-video.ts`：`TeachingVideoConfiguration` 和 `teacherVideoForTurn()`。

## 7. 一个真实章节的完整数据链路

以下记录来自 2026-09-08 对当前配置数据库的只读查询：

- textbook：`korean-level-one-smart`，id `7100ab2b-72b0-478e-8847-4df9b4485109`，published。
- version：v1，id `939ad4f7-3238-425e-91e9-d456c130ca68`，published。
- chapter 1：id `cda24fb8-c93b-4a19-9577-4418350ff708`，slug `hello`，标题 `你好？/안녕하세요?`，published。
- orientation module：id `42665398-c41e-4db8-9f0e-9626e126cba8`。
- node：`mission-map`，id `9fe730cd-a102-496e-adc5-9973b697af68`。
- activity：`orientation-check`，id `aafa6ccc-4d4a-4dba-9315-2f30381e8a13`。

### 7.1 章节

`digital_textbooks(slug)`
→ `digital_textbook_versions(status='published')`
→ `digital_textbook_chapters(chapter_number=1,status='published')`
→ `loadSmartDigitalTextbook()`
→ `page-content.tsx`
→ `<SmartTextbookShell textbook={textbook} />`
→ 学生看到第一章标题、情境和目标。

### 7.2 Step

`digital_textbook_modules(chapter_id, sort_order)`
→ loader 按 `sort_order` 查询并转换为 `SmartTextbookModule[]`
→ Shell 用 `textbook.modules.map(...)` 生成 footer
→ `activeIndex` 决定 active module
→ 学生看到 8 个 Step。

第一章 orientation 数据库标题是“课前导航”，但 footer/知识地图通过 `chapterOneKnowledgeMap.orientation.title` 显示“初次见面交流目标”；这是前端覆盖，不是数据库字段。

### 7.3 左侧教学区

`learning_agent_lessons(module_id=4266...)`
→ lesson id `0a1ebf2d-d987-4476-8f23-2269799e45df`
→ published script v23 id `feb30ba7-0a5e-4e9f-83e6-8970f715ddd5`
→ `learning_agent_script_nodes` 第一节点 `step-8-bbfc46`
→ loader 读取第一节点 `bufferLine/display/virtualCharacter`
→ 后续 `/api/learning-agent/respond`
→ Shell legacy 教师舞台/黑板/台词
→ 学生看到金老师问候和“本章学习路线”黑板。

实况：v23 有 8 个节点；8 个节点都有 `virtualCharacter`；0 个节点有 `teacherVideo`。首节点有 `greeting` / `explaining` 两段 performance 和角色坐标/缩放/语速。

### 7.4 右侧教学内容

`digital_textbook_nodes.content`（`mission-map` 中的 `lead/coach/targets/dialogueGroups/...`）
→ loader 保留 JSON 为 `SmartTextbookNode.content`
→ `ContentRenderer` 解包约定字段
→ orientation 固定页面布局
→ 学生看到场景说明、学习目标和人物对话。

### 7.5 视频

当前第一章 orientation 的真实发布链路**没有成品教师视频**：

`learning_agent_script_nodes.configuration.teacherVideo` 缺失
→ `normalizeTeachingVideo()` 选择 `legacy`
→ Shell 不走 `TeacherVideoPlayer`
→ 走角色图片 + 脚本语音 + 黑板。

如果后台为节点配置视频，链路为：

`TeachingScriptNodeForm/TeacherVideoPicker`
→ `saveTeachingScriptNodeAction()` 写 `configuration.teacherVideo`
→ 发布 script version
→ `/api/learning-agent/respond` 返回对应 turn 的 video
→ `TeacherVideoPlayer`
→ `/api/learning-agent/teacher-video`
→ R2 视频。

### 7.6 一个真实互动题目

公开题：

- prompt：`王明和智敏初次见面时先说了什么？`
- options：`안녕하세요?`、`얼마예요?`、`어디에 있어요?`、`감기에 걸렸어요.`
- `public_config`：`shuffle=false`、`showScore=false`
- secret answer：`{kind:"index", value:0}`

完整链路：

`digital_textbook_activities` 保存 prompt/options/public_config
→ `digital_textbook_activity_secrets` 保存 answer_key/explanation
→ loader 只把公开字段送到浏览器
→ `ContentRenderer/Activity` 渲染单选
→ 学生选择后调用 `submitSmartTextbookActivityAction()`
→ `smart-textbook-submission.ts` 在服务器读取 secret 并 `gradeSmartTextbookActivity()`
→ `record_smart_textbook_attempt` 写 attempt/progress
→ Action 返回 correct、localized explanation、node completion
→ React 显示反馈并刷新完成态。

脚本还可用 `reference_activity_id` 指向该题；第一章 orientation 的理解检查节点即采用教材活动引用，因此题目本体没有在脚本表重复保存。

## 8. 后台 → 学生端字段映射

| 后台字段 / 编辑项 | 保存位置 | 保存 API / Action | 前端读取位置 | 学生端显示位置 | 真正使用 |
| --- | --- | --- | --- | --- | --- |
| 教材状态 | `digital_textbooks.status` | `setTextbookStatusAction` | `loadSmartDigitalTextbook` 过滤 published | 决定教材能否加载 | 是 |
| 章节发布 | chapter/version/status + publish RPC | `publishTextbookChapterAction` | loader 过滤 published | 决定章内容版本 | 是 |
| 词汇 `ko/zh/pos/collocation/transcription` | node `content.vocabulary[]` | vocab Actions | `ContentRenderer` | 右侧词汇卡/词汇场景 | 是 |
| 语法 title/meaning/cases/rows/examples/caution | node `content.grammar[]` | grammar Actions | `ContentRenderer` 的 grammar 解析 | 右侧语法页 | 部分使用；具体展示还依赖 renderer 约定 |
| 语法音频 object key | grammar rows/examples 的 `audio` | audio upload Actions | ContentRenderer/audio helpers | 语法示例播放 | 是 |
| 脚本节点标题 | `script_nodes.title` | `saveTeachingScriptNodeAction` | respond/runtime | 教学节点/后台；学生主要见台词而非持久标题 | 间接 |
| 教师台词 | `teacher_script` | 同上 | loader 开场 + respond | 左侧教师对白/语音 | 是 |
| 教师视频 turn | `configuration.teacherVideo` | 同上 | respond + `teacherVideoForTurn` | 左侧 `TeacherVideoPlayer` | 有配置时使用；第一章当前未配置 |
| 黑板 slides/elements | `configuration.display` | 同上 | loader/respond | 左侧黑板 | 是 |
| 角色种类/位置 | `configuration.virtualCharacter` | 同上 | loader/respond | 左侧 legacy 教师舞台 | 是 |
| 姿势/坐标/缩放/镜头/语速 | `configuration.scriptPerformances[]` | 同上 | script runtime/Shell | legacy 教师动作和排布 | 是 |
| 学生操作目标 | `configuration.studentTask` | 同上 | respond/events | 引导学生操作右侧指定对象 | 是 |
| 视觉提示 | `configuration.visualCue` | 同上 | Shell learning target logic | 右侧目标脉冲提示 | 是 |
| 脚本自建单选 | config interaction + node secret | 同上 | respond | 左侧/教学流程提问 | 是 |
| 教材活动引用 | `reference_activity_id` | 同上 | respond | 引导右侧既有活动 | 是 |
| 正误反馈 | node secret / configuration | 同上 | respond | 教师反馈 | 是 |
| next/remediation/terminal | script node columns/config | 同上 | respond/runtime | 教学流程跳转/结束 | 是 |
| Step module 标题 | `digital_textbook_modules.title` | 当前教材后台无编辑入口 | loader | footer/header | 是，但第一章部分被前端覆盖 |
| Step 页签名称 | 不在后台 | 无 | `SMART_TEXTBOOK_SHARED_SKELETON` | 右侧页签 | 是，纯前端 |
| 章节 scenario/goal | `digital_textbook_chapters` JSON | 当前教材后台无编辑入口 | loader | header/章节前言 | 是 |
| 题目 prompt/options/public config | `digital_textbook_activities` | 当前教材后台无编辑入口 | loader | `Activity` | 是 |
| 答案/解释 | `activity_secrets` | 当前教材后台无编辑入口 | submit Action | 仅提交后反馈；答案不下发 | 是 |
| 普通图片 | `media_assets` + R2 | 当前教材后台无通用编辑入口 | loader 签名 | `ContentRenderer` 场景/素材 | 是 |
| 听力音频/稿件 | secrets/tracks + R2 | 当前教材后台无编辑入口 | audio/transcript API | 听力页 | 是 |
| 工具箱词汇/语法 | `growth_toolbox_*` | toolbox Actions | toolbox service | 工具箱/练习，不是教材 Shell | 否（对学生教材） |

## 9. 不一致、无效、重复和遗留数据

### A. 后台有，但学生端教材没有直接使用

- 教材管理 service 返回的 `vocabularyLibrary`、`grammarLibrary`、`totalVocabulary` 当前 listing 没有消费。
- `growth_toolbox_*` 是导入副本/自定义资料，不由学生教材 loader 读取。
- 脚本节点 `title` 主要服务后台和诊断；学生主要消费台词/任务，不把它稳定当作右侧教材标题。
- draft/archived 脚本版本不进入普通学生加载，仅进入 owner 预览/历史。
- character/blackboard 模板是后台复用资产；学生只使用已复制到节点 configuration 的结果。

### B. 学生端有，但后台无法控制

- 根级左右布局、30/70 比例、1280 断点、窄屏显隐、footer 位置。
- 八类 module 骨架、module 内页数、页名、content/activity slot 约定。
- 第一章 `chapterOneKnowledgeMap` 的 Step 标题/摘要/图标覆盖。
- chapter 0 大段课程概览和 `chapterZeroOutline`。
- 非第一章 orientation 的“开始本章之前”等固定前言排版与默认文案。
- activity renderer、各复合面板、图标、色彩、反馈 UI、默认中文/韩文文案。
- activity key 与专用组件的绑定。
- 角色图片资源映射和舞台 DOM。

### C. 前端写死的骨架和配置

- `SMART_TEXTBOOK_SHARED_SKELETON`。
- `SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT`。
- `SmartTextbookShell` 的 header/aside/main/footer。
- `ContentRenderer` 对 content JSON key 的解释。
- `Activity` 和 module-specific panel 的 dispatch。
- `chapterOneKnowledgeMap`、`chapterZeroOutline`、UI locale 字典和 fallback 文案。

### D. 重复保存/派生数据

- 教材词汇/语法与 `growth_toolbox_*` 的 textbook 副本。
- 教材 activities 与章节练习发布块是两个体系；publish 会同步派生练习，但学生智能教材仍读原 activities。
- `digital_textbook_activity_secrets` 的旧单轨听力字段与 `digital_textbook_listening_tracks` 的多轨字段并存；API 需兼容两套。
- module title 与第一章前端 knowledge map title 同时存在，显示时发生覆盖。
- 教学脚本可自建单选，也可引用教材 activity，形成两种题目模型；引用方式可避免重复，后台仍允许并存。

### E. 已废弃或兼容性残留

- `KoreanLevelOneReader.tsx`、`KoreanLevelOneBookTemplate.tsx`、16 个 `KoreanLevelOneLesson*Book.tsx` 未进入现行路由。
- `src/app/dashboard/admin/digital-textbook/DigitalTextbookManager.tsx` 未被当前 app-scoped textbook route 使用；当前使用 features 下的新 listing/dialog。
- `src/lib/smart-digital-textbook.ts → loadKoreanLevelOneChapterOne()` 是标记 deprecated 的 wrapper，现行页面调用通用 loader。
- 旧 `digital_textbook_teaching_*` 表名已迁移为 `learning_agent_*`；respond 中仍有 `learning_agent_steps` fallback。
- 作答记录有 RPC schema 不一致时的 direct-table compatibility fallback。

## 10. 固定骨架影响分析

### 10.1 固定位置

| 区域 | 固定代码 |
| --- | --- |
| 整体 Layout | `KoreanLevelOneSmartTextbook.tsx → SmartTextbookShell` 根容器/body/header/footer |
| Teaching Area | 同文件 `<aside>` 及 Agent/video/blackboard stage |
| Interaction Area | 同文件右侧 `main`、`ContentRenderer`、`Activity` 和专用 panel |
| Step Navigation | 同文件 footer 的 `textbook.modules.map()` |
| 比例/断点 | `smart-textbook-skeleton.ts → SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT` |
| module 内页/插槽 | `SMART_TEXTBOOK_SHARED_SKELETON` |

### 10.2 已经数据驱动

- 教材/版本/章节是否发布。
- 章节标题、情境、目标。
- module 实例、顺序、一般标题/说明/accent。
- node 标题、预计时间和 content JSON。
- 活动公开配置、答案、反馈、进度。
- 图片/音频 object key 和生产状态。
- 教学脚本版本、节点、台词、黑板内容、学生任务、流转、角色配置、可选教师视频。

### 10.3 完全不能由后台配置

- 任意增删 Region 或改变根级排列。
- 将某 Step 改为不同页面数量/页面名称。
- 创建新 module code 或 activity type 后自动获得 renderer。
- 将任意 content 字段拖放到任意区域。
- 章节级选择不同模板、左右比例或导航样式。
- 为现有题/普通图片/听力配置提供完整 GUI。

### 10.4 未来若将骨架后台化，会受影响的代码

这里只列影响面，不提出实现方案：

1. `SmartTextbookData` 和 loader：需能返回布局/region/page/block 描述，同时保持当前 published/version/progress 语义。
2. `SmartTextbookShell`：header/aside/main/footer、宽度和聚焦模式不能再直接由固定 JSX/常量决定。
3. `ContentRenderer` 与 module-specific panels：当前按 module code 和 JSON key dispatch，需有兼容层，否则 16 章现有数据会失效。
4. `Activity`：原子活动可继续复用，但复合面板与固定 activity key 的连接会受影响。
5. `smart-textbook-learning-targets.ts` 和脚本后台：视觉提示/学生任务当前指向固定 page/region/target registry；布局变化会改变目标稳定性。
6. Agent runtime：`focus_activity`、教学区隐藏/恢复、黑板和教师视频舞台依赖当前左右结构。
7. sessionStorage：目前保存 module/page 索引；动态页面需要兼容旧索引和已有会话。
8. 发布检查、预览和截图/测试：均假设固定 Shell 和第一章预览能力。
9. 管理端：现有教材页面只理解 vocabulary/grammar node JSON，无法承载布局字段。
10. 数据库/RPC：当前没有 layout/region/block manifest 表；本阶段没有新增或迁移。

## 11. 现有组件复用评估

| 能力/组件 | 当前实现 | 通用性 | 是否绑章节/约定 | props / 输入摘要 | 直接访问服务器 | 未来抽成通用 Block 难度 |
| --- | --- | --- | --- | --- | --- | --- |
| Video | `TeacherVideoPlayer` | 中高 | 绑定教学 Agent turn 和 API | video descriptor、播放状态/回调 | 通过 video API | 中；需脱离 Agent turn 语义 |
| Blackboard rich display | `TeachingBlackboardSlide` | 中 | 绑定脚本 display schema | slide、layout/locale | 否 | 中 |
| Rich Text | 无通用教材富文本组件；仅 `renderRichTutorText` | 低 | 绑定教师台词标记 | 文本 | 否 | 高，需要先定义内容格式 |
| Image | `ContentRenderer` + Next Image | 中 | 绑定 node media purpose/asset key | `SmartTextbookMediaAsset` | URL 已由 loader 签名 | 低至中 |
| Audio | 多个内联 audio/helper | 中 | 分散在词汇/语法/听力/Agent | signed URL 或 activity endpoint | 是 | 中，需要统一播放契约 |
| Multiple Choice | `Activity` | 高（原子层） | type 通用，展示受 config 影响 | `activity`、locale、completion callback | Server Action | 低 |
| Fill Blank | `Activity` | 高（原子层） | answer schema 固定 | 同上 | Server Action | 低 |
| Ordering | `Activity` + pattern 专用面板 | 中 | 通用 type + `pattern-order` 特例 | activity/content/config | Server Action | 中 |
| Listening | `Activity` / `ListenSpeakLearningPanel` | 中 | 绑定 tracks/page/repeat JSON | activity、audio assets、page state | audio/transcript API | 中高 |
| Pronunciation / shadowing | `ListenSpeakLearningPanel`、`RecordingControl` | 中 | 绑定 `repeatTracks` 和 guided progress | node、activities、locale、progress callbacks | recording API/Action | 中高 |
| Dialogue | `ContentRenderer` 对话场景 | 中 | 绑定 `dialogueGroups/dialogueScenes` | node content/media | 音频可能访问 API | 中 |
| Role Play | `DialogueRoleplayPractice` | 低至中 | 绑定 activity key `dialogue-roleplay` 和浏览器识别 | activity、locale、tracking、callback | recording API/Action | 高 |
| Writing | `ReadWriteLearningPanel` / `Activity` | 中 | 绑定 writing frame/config | content/activity | Server Action | 中 |
| Self Check | `Activity` / `ReviewResultPanel` | 中 | 绑定 review module/result layout | activity、完成态 | Server Action | 中 |
| AI Interaction | Shell + learning-agent routes | 低（作为 Block） | 深度绑定 session、script node、左右舞台和 learning targets | textbook/module/session/agent state | 多个 Agent API | 高 |

判断：最容易复用的是 `Activity` 的单选、多选、填空等原子判题能力和简单媒体展示；最难的是 Agent 舞台、听说复合流程和角色扮演，因为它们同时依赖浏览器媒体能力、进度证据、固定 page、固定 target key 与服务端会话。

## 12. 遗留 3D 金老师相关逻辑

### 12.1 当前仍在运行的遗留设计

教学脚本后台仍明确提供“原有形象与朗读”与“教师视频课堂”两种模式。legacy configuration 包含：

- `virtualCharacter.kind/position`
- `scriptPerformances[].pose`
- 角色 `characterX/Y/scale`
- split/narrow 坐标和缩放
- `dialogueX/Y`
- `voiceEnabled`、`voiceLanguage`、`voiceRate`
- `classroomShot`、`learningLayout`
- `autoContinueToNext`
- 黑板 slides、elements 和 placement

第一章发布 v23 的实况证明这些字段仍在运行：首节点的 pose 为 `greeting` / `explaining`，角色 kind 为 `uply-teacher`，并保存多套响应式坐标。

### 12.2 不是当前运行时的部分

当前学生 Shell 未发现 Three.js、FBX、WebGL 或浏览器 3D 模型 renderer。角色由 `teacher-kim-character.ts` 和 `/api/learning-agent/characters/[pose]` 提供图片帧。仓库中仍有 FBX/Blender 预览与角色帧生成脚本，但它们不是现行学生请求链路。

因此准确表述是：**旧 3D 金老师时期形成的角色动作/镜头/空间编排数据模型仍保留并运行，但现行 Web 学生端将角色表现落成 2D 图片舞台；不能把全部字段视为未使用，也不能称当前页面仍在实时渲染 3D。**

未发现一个独立、结构化的 `pause` 数据库列；停顿更可能通过台词分段、音频时长和自动继续状态表达。仅凭当前代码不能确认旧系统是否曾有单独 pause 字段，标记为**未确认**。

## 13. 后续重构必须保护的现有功能

1. 课程鉴权、章节解锁、平台审计/预览不记进度。
2. 只向学生加载 published 教材和 published 脚本；draft 只供 owner 预览。
3. 16 章现有八 module 顺序、模块内分页、第一章特殊知识地图和 chapter 0 概览。
4. 服务器端判题和 answer secret 不下发浏览器。
5. attempt 上限、objective/open activity 完成语义、node completion 和 mastery。
6. 听力多轨、音频 ready 状态、transcript 权限。
7. 浏览器录音、口语证据、角色扮演完成证据和重录/删除。
8. guided repeat 和 activity page 细粒度进度。
9. Agent session、脚本节点推进、教材活动引用、remediation、task event 和视觉提示。
10. legacy 角色课堂和新的教师视频模式同时可用。
11. 黑板 slides、媒体、位置、响应式角色舞台。
12. 同标签页刷新恢复当前 module/page，以及数据库长期恢复完成态。
13. R2 私有对象经服务端签名/Route Handler 提供，不能暴露 object key 或 service role。
14. `CardTitleWithHint` 的标题补充说明和现有可访问交互。
15. 管理端发布检查、来源审查、版本化、原子保存与并发更新时间校验。

## 14. 自我验证结果

完成报告后执行了以下只读/文档级反查：

- 用 `rg --files` 覆盖 `smart-textbook`、`digital-textbook`、`teaching-script`、`learning-agent`、`KoreanLevelOne`、`TeacherVideo`、`teacher-kim`、`chapter-practice`、`growth-toolbox` 相关文件。
- 从现行 `[space]/apps/korean/.../page.tsx` 反向追踪 import，确认 16 个 `Lesson*Book` 不在现行路径，避免把旧页面当作运行代码。
- 从 app-scoped 后台路由反向追踪到当前 features listing/dialog，确认旧 `DigitalTextbookManager` 不在当前入口。
- 对第一章 chapter/module/node/activity/script version 进行了只读数据库核验，并核对真实 answer secret 与发布脚本模式。
- 对学生初始加载、作答、音频、录音、Agent respond、脚本预览和发布分别核对调用方向。
- 检查相关 migration 的主表、媒体表、听力表、进度表、脚本表与 RPC；未发现智能教材专用 View 或 ORM schema。

## 15. 最终真实架构判断

当前系统的 source of truth 不是单一层：

- **内容事实**主要在 Supabase 的教材/脚本 JSON 与关系表。
- **页面结构事实**主要在 `KoreanLevelOneSmartTextbook.tsx` 和 `smart-textbook-skeleton.ts`。
- **媒体事实**由数据库 object key/状态与 R2 对象共同构成。
- **学习状态事实**分散在 textbook progress/attempt/evidence 与 learning-agent session/event 两套状态机。
- **管理能力**分裂为“有限教材内容编辑”和“详细教学脚本编排”，目前没有统一的章/Step/Region/Block 配置模型。

所以“每章复用固定骨架、骨架内具体内容从后端获取”基本成立，但必须补充三个例外：第一章和 chapter 0 有显著前端硬编码内容；module 内部页面和 JSON 解释仍由前端固定；左侧教学区还依赖独立的教学 Agent 脚本数据和运行时状态，并非只读教材 node JSON。

## 16. 关键证据文件索引

以下是现行链路中应优先阅读的文件；它们不是“设计建议”，而是本报告结论的代码证据：

| 主题 | 文件 | 关键符号 |
| --- | --- | --- |
| 学生空间路由 | `src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx` | `KoreanLessonPage` |
| 课程判定/初始加载 | `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx` | `loadSmartDigitalTextbook` 调用、`SmartTextbookShell` |
| Shell 实现 | 同目录 `KoreanLevelOneSmartTextbook.tsx` | `SmartTextbookShell`、`ContentRenderer`、`Activity`、专用练习面板 |
| Shell 转发 | 同目录 `SmartTextbookShell.tsx` | re-export |
| 教材服务端 loader | `src/lib/smart-digital-textbook.ts` | `loadSmartDigitalTextbook`、`SmartTextbookData` |
| 固定学习骨架 | `src/lib/smart-textbook-skeleton.ts` | `SMART_TEXTBOOK_SHARED_SKELETON`、`SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT` |
| 学习目标桥接 | `src/lib/smart-textbook-learning-targets.ts` | 固定 page/region/target 注册与解析 |
| 作答入口 | 同 lesson 目录 `smart-textbook-actions.ts` | 五个学生 Server Action |
| 服务端判题 | 同 lesson 目录 `smart-textbook-submission.ts` | `gradeSmartTextbookActivity`、`submitSmartTextbookActivityForContext` |
| 完成策略 | 同 lesson 目录 `smart-textbook-completion.ts` | node/activity 完成判定辅助逻辑 |
| Agent 主 Route | `src/app/api/learning-agent/respond/route.ts` | `POST` |
| Agent runtime | `src/lib/learning-agent-script-runtime.ts` | 发布脚本节点解释和流转 |
| Agent 状态 | `src/lib/learning-agent-buffer-state.ts`、`src/lib/learning-agent-preview-state.ts` | buffer/预览状态 |
| 课堂导演 | `src/lib/learning-agent-classroom-director.ts` | 教学阶段、focus 与学生动作协调 |
| 教师视频 | `src/lib/teaching-video.ts`、`src/components/learning-agent/TeacherVideoPlayer.tsx` | `TeachingVideoConfiguration`、`teacherVideoForTurn` |
| legacy 教师资源 | `src/lib/teacher-kim-character.ts` | pose 到角色图片资源映射 |
| 教材后台路由 | `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/page.tsx` | `ManagementAppTextbooksRoute` |
| 教材后台读取 | `src/features/digital-textbook/api/service.ts` | `getDigitalTextbookManagementData` |
| 教材后台 UI | `src/features/digital-textbook/components/digital-textbook-listing.tsx`、`digital-textbook-action-dialogs.tsx` | listing/content dialog |
| 教材后台写入 | `src/app/dashboard/admin/digital-textbook/actions.ts` | 状态、发布、词汇、语法、音频 Actions |
| 脚本后台路由 | `src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/page.tsx` | `ManagementAppTeachingScriptsRoute` |
| 脚本后台读取 | `src/features/learning-agent-script-studio/service.ts` | `getTeachingScriptStudioData` |
| 脚本后台 UI | `TeachingScriptStudio.tsx`、`TeachingScriptNodeForm.tsx`、`TeachingBlackboardEditor.tsx`、`VirtualCharacterStageEditor.tsx` | 脚本编辑和预览入口 |
| 脚本后台写入 | `src/app/dashboard/admin/teaching-scripts/actions.ts` | draft/node/template/publish Actions |
| 权限 | `src/app/dashboard/admin/apps/ManagementApplicationSectionPage.tsx`、`src/lib/admin.ts` | `requireManagementApplicationSection`、`requirePlatformOwner` |
| 教材初始 schema | `supabase/migrations/202607310013_smart_digital_textbook_chapter_one.sql` | 主表、进度表、module 约束 |
| chapter 0 | `supabase/migrations/202608180001_korean_level_one_course_overview.sql` | 允许 `chapter_number >= 0` |
| 媒体 | `supabase/migrations/202608180005_chapter_one_golden_smart_textbook.sql` | `digital_textbook_media_assets` |
| 安全判题 | `supabase/migrations/202608180006_chapter_one_submission_security.sql` 及后续覆盖 migration | `record_smart_textbook_attempt` |
| 录音证据 | `supabase/migrations/202608180023_speaking_recording_evidence.sql` | evidence 表、speaking RPC |
| 多轨听力 | `supabase/migrations/202608240006_split_chapter_one_listening_into_two_tracks.sql` | `digital_textbook_listening_tracks` |
| Agent 初版/重命名 | `202608260001_teaching_agent_phase_one.sql`、`202608260002_multi_subject_learning_agent_runtime.sql` | teaching 表创建及 `learning_agent_*` 重命名 |
| Script Studio schema | `supabase/migrations/202608260006_learning_agent_script_studio.sql` | version/script node/attempt/publish log |
| 当前原子保存/视频 | `supabase/migrations/202609070001_teaching_script_atomic_video.sql` | 原子节点保存与教师视频配置 |
| 来源审查 | `supabase/migrations/202609080003_teaching_script_source_reviews.sql` | source review |
