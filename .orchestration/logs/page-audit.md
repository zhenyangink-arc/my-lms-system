## 页面清单
- `/` | `src/app/page.tsx` | 公开根入口，实际重定向到登录页。
- `/login` | `src/app/login/page.tsx` | 根入口、站点页头及鉴权失败入口可达。
- `/login/redirect` | `src/app/login/redirect/page.tsx` | 登录成功后的角色/租户分流入口。
- `/register` | `src/app/register/page.tsx` | 登录页与站点页头的注册入口可达；当前用于说明注册方式。
- `/access-denied` | `src/app/access-denied/page.tsx` | 权限守卫拒绝访问时重定向到此页。
- `/account-disabled` | `src/app/account-disabled/page.tsx` | 活跃用户校验发现账号停用时重定向到此页。
- `/[space]` | `src/app/[space]/page.tsx` | 学生登录分流后进入的租户应用中心；应用卡片继续进入已开通应用。
- `/[space]/apps/korean` | `src/app/[space]/apps/korean/page.tsx` | 租户应用中心“韩语学习”卡片及韩语侧栏首页可达。
- `/[space]/apps/korean/announcements` | `src/app/[space]/apps/korean/announcements/page.tsx` | 韩语应用侧栏“通知公告”可达。
- `/[space]/apps/korean/assignments` | `src/app/[space]/apps/korean/assignments/page.tsx` | 韩语应用侧栏“学习任务”可达。
- `/[space]/apps/korean/assignments/[assignmentId]` | `src/app/[space]/apps/korean/assignments/[assignmentId]/page.tsx` | 学习任务卡片、成绩明细链接可达。
- `/[space]/apps/korean/assignments/korean` | `src/app/[space]/apps/korean/assignments/korean/page.tsx` | 学习任务页“章节测试”入口及引导导航可达。
- `/[space]/apps/korean/assignments/korean/[testSlug]` | `src/app/[space]/apps/korean/assignments/korean/[testSlug]/page.tsx` | 章节测试列表、教材测试入口可达。
- `/[space]/apps/korean/conversation-practice` | `src/app/[space]/apps/korean/conversation-practice/page.tsx` | 韩语应用侧栏“会话练习”可达。
- `/[space]/apps/korean/conversation-practice/[scenarioId]` | `src/app/[space]/apps/korean/conversation-practice/[scenarioId]/page.tsx` | 会话场景卡片可达。
- `/[space]/apps/korean/conversation-practice/course` | `src/app/[space]/apps/korean/conversation-practice/course/page.tsx` | 会话练习页“情境课程”入口可达。
- `/[space]/apps/korean/conversation-practice/ai-experience` | `src/app/[space]/apps/korean/conversation-practice/ai-experience/page.tsx` | VIP2 个性化侧栏和会话练习页 AI 入口可达。
- `/[space]/apps/korean/conversation-practice/ai-experience/practice` | `src/app/[space]/apps/korean/conversation-practice/ai-experience/practice/page.tsx` | AI 体验页正式练习入口可达。
- `/[space]/apps/korean/conversation-practice/ai-experience/quick` | `src/app/[space]/apps/korean/conversation-practice/ai-experience/quick/page.tsx` | AI 体验页快速练习入口可达。
- `/[space]/apps/korean/courses` | `src/app/[space]/apps/korean/courses/page.tsx` | 韩语应用侧栏“韩语课程”和应用中心继续学习入口可达。
- `/[space]/apps/korean/courses/[categorySlug]` | `src/app/[space]/apps/korean/courses/[categorySlug]/page.tsx` | 课程目录分类卡片可达。
- `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]` | `src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/page.tsx` | 分类页阶段/子分类入口可达。
- `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | `src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/page.tsx` | 课程卡片可达。
- `/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | `src/app/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx` | 课程课时、继续学习、前后课导航及教材测试回链可达。
- `/[space]/apps/korean/grades` | `src/app/[space]/apps/korean/grades/page.tsx` | 韩语应用侧栏“我的成绩”可达。
- `/[space]/apps/korean/records` | `src/app/[space]/apps/korean/records/page.tsx` | 韩语应用侧栏“学习记录”可达。
- `/[space]/apps/korean/library` | `src/app/[space]/apps/korean/library/page.tsx` | 韩语应用侧栏“资料库”可达。
- `/[space]/apps/korean/help` | `src/app/[space]/apps/korean/help/page.tsx` | 韩语应用侧栏“帮助中心”可达。
- `/[space]/apps/korean/help/tickets/[ticketId]` | `src/app/[space]/apps/korean/help/tickets/[ticketId]/page.tsx` | 帮助中心本人工单列表可达。
- `/[space]/apps/korean/practice/course` | `src/app/[space]/apps/korean/practice/course/page.tsx` | 韩语侧栏“巩固中心”的课程巩固记忆入口及引导导航可达。
- `/[space]/apps/korean/practice/course/[courseKey]/[chapterSlug]` | `src/app/[space]/apps/korean/practice/course/[courseKey]/[chapterSlug]/page.tsx` | 课程巩固章节目录可达。
- `/[space]/apps/korean/practice/review` | `src/app/[space]/apps/korean/practice/review/page.tsx` | 巩固中心复习区及引导导航可达。
- `/[space]/apps/korean/practice/skills` | `src/app/[space]/apps/korean/practice/skills/page.tsx` | 巩固中心专项练习入口及引导导航可达。
- `/[space]/apps/korean/practice/skills/[skill]` | `src/app/[space]/apps/korean/practice/skills/[skill]/page.tsx` | 专项能力卡片可达。
- `/[space]/apps/korean/practice/skills/vocabulary` | `src/app/[space]/apps/korean/practice/skills/vocabulary/page.tsx` | 词汇专项静态入口可达。
- `/[space]/apps/korean/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]` | `src/app/[space]/apps/korean/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]/page.tsx` | 专项练习页选择章节后生成的训练链接可达。
- `/[space]/apps/study-abroad` | `src/app/[space]/apps/study-abroad/page.tsx` | 租户应用中心“留学服务”卡片及应用侧栏首页可达。
- `/[space]/apps/study-abroad/announcements` | `src/app/[space]/apps/study-abroad/announcements/page.tsx` | 留学服务侧栏“通知公告”可达。
- `/[space]/apps/study-abroad/courses` | `src/app/[space]/apps/study-abroad/courses/page.tsx` | 留学服务侧栏“留学课程”可达。
- `/[space]/apps/study-abroad/courses/[categorySlug]` | `src/app/[space]/apps/study-abroad/courses/[categorySlug]/page.tsx` | 留学课程分类卡片可达。
- `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]` | `src/app/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/page.tsx` | 留学课程子分类入口可达。
- `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | `src/app/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/page.tsx` | 留学课程卡片可达。
- `/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | `src/app/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx` | 留学课程课时入口可达。
- `/[space]/apps/study-abroad/universities` | `src/app/[space]/apps/study-abroad/universities/page.tsx` | 留学服务侧栏“目标大学”可达。
- `/[space]/apps/study-abroad/universities/targets` | `src/app/[space]/apps/study-abroad/universities/targets/page.tsx` | 选校中心“管理全部/添加目标”入口可达。
- `/[space]/apps/study-abroad/universities/library` | `src/app/[space]/apps/study-abroad/universities/library/page.tsx` | 选校中心“大学库”入口可达。
- `/[space]/apps/study-abroad/universities/library/[universityId]` | `src/app/[space]/apps/study-abroad/universities/library/[universityId]/page.tsx` | 大学库学校卡片“进入学校页面”可达。
- `/[space]/apps/study-abroad/universities/comparison` | `src/app/[space]/apps/study-abroad/universities/comparison/page.tsx` | 选校中心及学校库“四校对比”入口可达。
- `/[space]/apps/study-abroad/documents` | `src/app/[space]/apps/study-abroad/documents/page.tsx` | 留学服务侧栏“申请材料”可达。
- `/[space]/apps/study-abroad/visa` | `src/app/[space]/apps/study-abroad/visa/page.tsx` | 留学服务侧栏“签证准备”可达。
- `/[space]/apps/study-abroad/help` | `src/app/[space]/apps/study-abroad/help/page.tsx` | 留学服务侧栏“帮助中心”可达。
- `/[space]/apps/study-abroad/help/tickets/[ticketId]` | `src/app/[space]/apps/study-abroad/help/tickets/[ticketId]/page.tsx` | 帮助中心本人工单列表可达。
- `/[space]/dashboard/admin` | `src/app/[space]/dashboard/admin/page.tsx` | 员工登录分流及管理侧栏“管理首页”可达。
- `/[space]/dashboard/admin/apps` | `src/app/[space]/dashboard/admin/apps/page.tsx` | 管理侧栏“应用中心”可达。
- `/[space]/dashboard/admin/apps/[appSlug]` | `src/app/[space]/dashboard/admin/apps/[appSlug]/page.tsx` | 应用中心应用卡片可达。
- `/[space]/dashboard/admin/apps/[appSlug]/analytics` | `src/app/[space]/dashboard/admin/apps/[appSlug]/analytics/page.tsx` | 应用运营空间按能力生成的“数据洞察”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/assessments` | `src/app/[space]/dashboard/admin/apps/[appSlug]/assessments/page.tsx` | 应用运营空间“测评/试卷”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/content` | `src/app/[space]/dashboard/admin/apps/[appSlug]/content/page.tsx` | 应用运营空间“课程内容”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/conversation` | `src/app/[space]/dashboard/admin/apps/[appSlug]/conversation/page.tsx` | 韩语应用运营空间“会话练习”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/documents` | `src/app/[space]/dashboard/admin/apps/[appSlug]/documents/page.tsx` | 留学应用运营空间“资料审核”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/grades` | `src/app/[space]/dashboard/admin/apps/[appSlug]/grades/page.tsx` | 教学应用运营空间“成绩”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/records` | `src/app/[space]/dashboard/admin/apps/[appSlug]/records/page.tsx` | 教学/留学应用运营空间“记录/洞察”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/settings` | `src/app/[space]/dashboard/admin/apps/[appSlug]/settings/page.tsx` | 应用运营空间“设置”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/students` | `src/app/[space]/dashboard/admin/apps/[appSlug]/students/page.tsx` | 应用运营空间“学生”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/textbooks` | `src/app/[space]/dashboard/admin/apps/[appSlug]/textbooks/page.tsx` | 韩语应用运营空间“智能教材”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/toolbox` | `src/app/[space]/dashboard/admin/apps/[appSlug]/toolbox/page.tsx` | 韩语应用运营空间“成长工具箱”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/universities` | `src/app/[space]/dashboard/admin/apps/[appSlug]/universities/page.tsx` | 留学应用运营空间“大学库”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/visa` | `src/app/[space]/dashboard/admin/apps/[appSlug]/visa/page.tsx` | 留学应用运营空间“签证管理”分区可达。
- `/[space]/dashboard/admin/apps/[appSlug]/assignments/[assignmentId]` | `src/app/[space]/dashboard/admin/apps/[appSlug]/assignments/[assignmentId]/page.tsx` | 应用内作业/考试发布记录的详情链接可达。
- `/[space]/dashboard/admin/announcements` | `src/app/[space]/dashboard/admin/announcements/page.tsx` | 管理侧栏“通知公告管理”可达。
- `/[space]/dashboard/admin/help` | `src/app/[space]/dashboard/admin/help/page.tsx` | 管理侧栏“帮助中心管理”可达。
- `/[space]/dashboard/admin/help/tickets/[ticketId]` | `src/app/[space]/dashboard/admin/help/tickets/[ticketId]/page.tsx` | 帮助工单表“查看并回复”可达。
- `/[space]/dashboard/admin/library` | `src/app/[space]/dashboard/admin/library/page.tsx` | 管理侧栏“资料库管理”可达。
- `/[space]/dashboard/admin/accounts` | `src/app/[space]/dashboard/admin/accounts/page.tsx` | 管理侧栏“账号管理”可达。
- `/[space]/dashboard/admin/accounts/[profileId]` | `src/app/[space]/dashboard/admin/accounts/[profileId]/page.tsx` | 账号表、学习记录详情的“查看账号档案”可达。
- `/[space]/dashboard/admin/tenants` | `src/app/[space]/dashboard/admin/tenants/page.tsx` | 平台管理侧栏“租户管理”可达。
- `/[space]/dashboard/admin/tenants/[tenantId]` | `src/app/[space]/dashboard/admin/tenants/[tenantId]/page.tsx` | 租户表“查看详情”及管理首页机构链接可达。
- `/[space]/dashboard/admin/tenants/history` | `src/app/[space]/dashboard/admin/tenants/history/page.tsx` | 租户管理页“历史/可恢复机构”入口可达。
- `/[space]/dashboard/admin/permissions` | `src/app/[space]/dashboard/admin/permissions/page.tsx` | 平台管理侧栏“权限中心”可达。
- `/[space]/dashboard/admin/profile` | `src/app/[space]/dashboard/admin/profile/page.tsx` | 管理侧栏底部账号入口及管理顶栏可达。
- `/[space]/dashboard/admin/token-usage` | `src/app/[space]/dashboard/admin/token-usage/page.tsx` | 管理侧栏“模型用量”可达。
- `/[space]/dashboard/courses` | `src/app/[space]/dashboard/courses/page.tsx` | 平台课程巡检员管理侧栏“课程前台巡检”可达。
- `/[space]/dashboard/courses/[categorySlug]` | `src/app/[space]/dashboard/courses/[categorySlug]/page.tsx` | 巡检课程目录分类卡片可达。
- `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]` | `src/app/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/page.tsx` | 巡检分类页子分类入口可达。
- `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]` | `src/app/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/page.tsx` | 巡检课程卡片可达。
- `/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]` | `src/app/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx` | 巡检课时入口可达。
- `/[space]/dashboard/live/[sessionId]` | `src/app/[space]/dashboard/live/[sessionId]/page.tsx` | 教师学生列表“发起课堂”和公共课堂入口通过 `router.push` 可达。

## 违规项（按文件分组）
### `src/app/dashboard/admin/AdminWorkspaceSidebar.tsx`
- [规则1] 125: 管理导航品牌副文案使用纯装饰性全大写英文 `PUFFY CONTROL`。

### `src/lib/korean-ebook-sections.ts`
- [规则1] 2-9: 教材章节数据源保存并对外提供 `STEP 01` 至 `STEP 08` 技术型英文标签；这些标签不是韩语教学内容。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneBookTemplate.tsx`
- [规则1] 350: 教材分区页显示纯装饰性英文栏目标签 `LEARNING SECTION`。
- [规则1] 512, 576: 教材模板页眉/页脚显示纯装饰性英文 `LESSON` 编号标签。
- [规则2] 287-328: `KoreanEbookHeading` 接收 `title + description` 后把说明直接渲染在教材卡片正文（321-323），未复用 `@/components/ui/card-title-with-hint`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneGuideBook.tsx`
- [规则1] 351, 393, 435, 477: 课程指南页用 `MODULE 01` 至 `MODULE 04` 作为装饰性英文分区标签。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx`
- [规则1] 1410: 章节概览弹层显示纯装饰性英文栏目标签 `CHAPTER OVERVIEW`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonBook.tsx`
- [规则1] 1716: 教材示例区显示纯装饰性英文类型标签 `ORIGINAL SAMPLE`。
- [规则1] 1877, 1900, 1907: 完课、测试和下一课区域显示 `LESSON 01 · COMPLETE`、`LESSON 1 TEST`、`NEXT · LESSON 02` 等装饰性英文状态/导航标签。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonTwoBook.tsx`
- [规则1] 1550, 1588, 1599: 完课、测试和下一课区域显示 `LESSON 02 · COMPLETE`、`LESSON 2 TEST`、`NEXT · LESSON 03`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonThreeBook.tsx`
- [规则1] 1172, 1195, 1202: 完课、测试和下一课区域显示 `LESSON 03 · COMPLETE`、`LESSON 3 TEST`、`NEXT · LESSON 04`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFourBook.tsx`
- [规则1] 1026, 1049, 1056: 完课、测试和下一课区域显示 `LESSON 04 · COMPLETE`、`LESSON 4 TEST`、`NEXT · LESSON 05`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFiveBook.tsx`
- [规则1] 391-394: 对话样本数据保存并渲染 `DATE`、`DAY`、`PAST`、`SEQUENCE` 等英文类型标签，而非学习界面的自然语言标题。
- [规则1] 982, 1005, 1012: 完课、测试和下一课区域显示 `LESSON 05 · COMPLETE`、`LESSON 5 TEST`、`NEXT · LESSON 06`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonSixBook.tsx`
- [规则1] 393-396: 对话样本数据保存并渲染 `ASK`、`PRICE`、`DESCRIBE`、`BUY` 英文类型标签。
- [规则1] 948, 971, 978: 完课、测试和下一课区域显示 `LESSON 06 · COMPLETE`、`LESSON 6 TEST`、`NEXT · LESSON 07`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonSevenBook.tsx`
- [规则1] 321-324: 对话样本数据保存并渲染 `ASK`、`ANSWER`、`COMPARE`、`REPORT` 英文类型标签。
- [规则1] 397: 同一完课页显示 `LESSON 07 · COMPLETE` 与 `LESSON 7 TEST` 装饰性英文状态/类型标签。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonEightBook.tsx`
- [规则1] 596, 599: 完课与测试区域显示 `LESSON 08 · 1A COMPLETE`、`LESSON 8 TEST`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonNineBook.tsx`
- [规则1] 561, 564: 完课与测试区域显示 `LESSON 09 · COMPLETE`、`LESSON 9 TEST`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonTenBook.tsx`
- [规则1] 593, 596: 完课与测试区域显示 `LESSON 10 · COMPLETE`、`LESSON 10 TEST`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonElevenBook.tsx`
- [规则1] 377, 380: 完课与测试区域显示 `LESSON 11 · COMPLETE`、`LESSON 11 TEST`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonTwelveBook.tsx`
- [规则1] 248: 完课页显示纯装饰性英文状态标签 `LESSON 12 · COMPLETE`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonThirteenBook.tsx`
- [规则1] 1194: 完课页显示纯装饰性英文状态标签 `LESSON 13 · COMPLETE`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFourteenBook.tsx`
- [规则1] 1194: 完课页显示纯装饰性英文状态标签 `LESSON 14 · COMPLETE`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFifteenBook.tsx`
- [规则1] 193: 完课页显示纯装饰性英文状态标签 `LESSON 15 · COMPLETE`。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonSixteenBook.tsx`
- [规则1] 190: 完课页显示纯装饰性英文状态标签 `LESSON 16 · 1B COMPLETE`。

### `src/app/[space]/page.tsx`
- [规则2] 468-469: 应用卡片直接显示应用标题及场景说明 `app.description`，没有用标题右侧提示图标收纳说明。

### `src/app/dashboard/SystemGrowthHomeView.tsx`
- [规则2] 384-385, 507-508: “从第一门课程开始”“还没有课程进度”卡片把操作/场景说明直接放在标题下方，未复用规定组件。
- [规则2] 482-483: 课程地图卡片直接显示课程标题及补充课程信息，未复用规定组件。

### `src/app/dashboard/conversation-practice/page-content.tsx`
- [规则2] 129-132: 会话场景卡片直接显示 `scenario.title + scenario.description`，场景说明没有收进标题右侧提示。

### `src/app/dashboard/courses/KoreanCourseCatalogBrowser.tsx`
- [规则2] 237-243: 课程分区标题下直接展示分区说明，未复用规定组件。
- [规则2] 287-293: 课程卡片直接展示 `course.title + course.description`，未复用规定组件。

### `src/app/dashboard/courses/[categorySlug]/KoreanLearningCenter.tsx`
- [规则2] 487-491: 课时卡片直接展示课时标题及说明文本，未复用规定组件。
- [规则2] 654-657: 子分类卡片直接展示标题及课程数量/定位说明，未复用规定组件。
- [规则2] 1009-1012: 推荐学习卡片直接展示标题及推荐理由/进度说明，未复用规定组件。

### `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx`
- [规则2] 236-261: `WorkspaceSectionTitle` 自行渲染 `title + description`，说明直接出现在学习卡片正文；该组件在 1007-1012 的“视频学习”卡片中使用。

### `src/app/dashboard/toolbox/page-content.tsx`
- [规则2] 286-291: 专项练习模块区把操作说明直接放在标题下方。
- [规则2] 323-327: 能力练习卡片直接展示 `tool.title + tool.description`，未复用规定组件。

### `src/app/dashboard/toolbox/[skill]/page-content.tsx`
- [规则2] 638-641: 专项入口卡片直接展示能力标题及场景说明。
- [规则2] 661-664: 章节选择卡片把操作说明直接放在标题下方。
- [规则2] 721-722: 课时卡片直接展示 `lesson.title + lesson.description`。
- [规则2] 830-835: 当前训练卡片直接展示训练标题及来源/操作说明。

### `src/app/dashboard/assignments/AssignmentBoard.tsx`
- [规则2] 772-779: 课程章节折叠卡直接在课程标题下显示“按章节顺序完成本课程测试 · 点击展开或收起”，自行实现了标题加操作说明，未复用规定组件。

### `src/app/dashboard/grades/GradeBoard.tsx`
- [规则1] 189: 六维成绩卡向共享雷达组件传入 `eyebrow` 装饰标签。

### `src/components/analytics/SixDimensionRadar.tsx`
- [规则1] 130, 144, 204: 学习分析卡以 `eyebrow` 字段接收并渲染装饰性栏目标签。
- [规则2] 205-210: 雷达学习卡直接展示标题与 `description`，未复用规定组件。

### `src/app/dashboard/progress/page-content.tsx`
- [规则1] 77, 159, 431, 439: 课程巩固数据模型保存并渲染 `eyebrow` 装饰字段（“字母启蒙”“基础表达”）。

### `src/app/dashboard/progress/KnowledgeResearchWorkbench.tsx`
- [规则1] 191, 200-254, 279, 291: 知识总结数据源保存并渲染 `eyebrow` 装饰字段。
- [规则2] 200-254, 294-297: 九张知识总结卡均以 `title + description` 直接展示补充说明，未复用规定组件。

### `src/app/dashboard/assignments/korean/ChapterTestSectionCard.tsx`
- [规则1] 10, 17, 32: 章节测试学习卡保留并渲染 `eyebrow` 装饰字段；调用方在 `src/app/dashboard/assignments/korean/page-content.tsx:261,413` 传入“路线”标签。标题说明本身已复用规定组件，不构成规则2违规。

### `src/app/dashboard/records/LearningRecordBoard.tsx`
- [规则2] 276-280: 教师留言卡直接展示留言标题及补充正文，未复用规定组件。
