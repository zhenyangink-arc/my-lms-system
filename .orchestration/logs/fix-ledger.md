# 修复账本

审计报告：`.orchestration/logs/page-audit.md`（87 个可访问页面，规则1违规26文件，规则2违规13文件）

规则：
1. 删除纯装饰性英文眉题/栏目/类型标签（不含真实外语教学内容）
2. 学习卡片"标题+补充说明"统一复用 `@/components/ui/card-title-with-hint`，图标外无背景/边框/底色

| 批次 | 负责文件 | 通道 | 状态 |
|---|---|---|---|
| 1 | KoreanLevelOneLessonBook/Two/Three/FourBook.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 2 | KoreanLevelOneLessonFive/Six/SevenBook.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 3 | KoreanLevelOneLessonEight/Nine/Ten/ElevenBook.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 4 | KoreanLevelOneLessonTwelve/Thirteen/Fourteen/Fifteen/SixteenBook.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 5 | AdminWorkspaceSidebar.tsx, KoreanLevelOneGuideBook.tsx, KoreanLevelOneSmartTextbook.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 5b | korean-ebook-sections.ts（需检查全仓库调用方） | terra | 完成（ACCEPTED，tsc 通过；同步调整 LanguageBankCreateForms.tsx、QuestionBankForms.tsx 下拉框） |
| 6 | KoreanLevelOneBookTemplate.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 7 | GradeBoard.tsx, SixDimensionRadar.tsx | terra | 完成（ACCEPTED，tsc 通过；顺带清理 toolbox/page-content.tsx 的 eyebrow 调用） |
| 8 | progress/page-content.tsx, KnowledgeResearchWorkbench.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 9 | ChapterTestSectionCard.tsx, assignments/korean/page-content.tsx | — | 复核后跳过：`eyebrow` 内容为中文"路线01·字母启蒙"，非纯装饰英文标签；标题+说明已复用 DashboardTitleWithHint(→CardTitleWithHint)，不违反两项规则，不予修改 |
| 10 | [space]/page.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 11 | SystemGrowthHomeView.tsx | terra | 完成（ACCEPTED，tsc 通过；同步拆分卡片链接层避免与提示按钮冲突） |
| 12 | conversation-practice/page-content.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 13 | KoreanCourseCatalogBrowser.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 14 | KoreanLearningCenter.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 15 | [lessonSlug]/page-content.tsx (WorkspaceSectionTitle) | terra | 完成（ACCEPTED，tsc 通过） |
| 16 | toolbox/page-content.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 17 | toolbox/[skill]/page-content.tsx | terra | 完成（ACCEPTED，tsc 通过） |
| 18 | AssignmentBoard.tsx | terra | 完成（ACCEPTED，tsc/eslint 通过） |
| 19 | records/LearningRecordBoard.tsx | terra | 复核后跳过：`nextAction` 是教师给学生的核心可读建议正文，非辅助说明，收进提示图标会隐藏关键信息，不予修改（ACCEPTED，tsc 通过） |

## 最终复核（sol-review，只读）
- tsc --noEmit：通过，0 错误
- 规则1：全仓库无残留渲染违规（STEP 0x 仅作数据库兼容值，已转中文自然语言展示）
- 规则2：审计涉及的全部文件均已复用 CardTitleWithHint / DashboardTitleWithHint
- 未发现清单外的意外修改
- 结论：全部修复完成
