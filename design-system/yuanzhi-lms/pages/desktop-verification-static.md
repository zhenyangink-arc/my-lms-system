# Desktop verification static hazard scan — Batch 11, part 1

## Status and scope

This packet performed a static, grep-assisted review of `src/app`, `src/features`, and `src/components` for desktop width, horizontal-scroll containment, large `min-width`, legacy `--app-*` usage, and raw color fallbacks in the shared CSS files named by the packet. It did not render or interact with the application.

Thresholds used for the exhaustive inventories below:

- fixed arbitrary widths: literal `w-[Npx]` with `N > 1024`, excluding `max-w-*` and `min-w-*`, plus literal inline pixel widths;
- large minimum widths: literal `min-w-[Npx]` or CSS `min-width: Npx` with `N > 1024`;
- table containment: all raw `<table>` elements and all shared `<Table>` uses were surveyed, including narrower tables whose column density or local layout could still make them wide.

## Findings

### 1. Hardcoded widths above 1024px

No literal inline `style={{ width: "Npx" }}` instances above the threshold were found. The following `w-[1180px]` instances were found. Each is an internal two-page flipbook canvas: the surrounding implementation computes a runtime scale and clips it inside a responsive outer region, but the literal canvas still conflicts with the MASTER §9 no-fixed-canvas direction and cannot be conclusively approved without rendering. All are **reported-only** because changing the flipbook geometry requires layout and library-behavior judgment.

- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/BatchimReadingBook.tsx:680,681` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/HangulBookOpening.tsx:1138,1165` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneGuideBook.tsx:172,199` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonBook.tsx:1961,1988` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonEightBook.tsx:613,614` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonElevenBook.tsx:392` — two fixed-width elements on this line (canvas and book); reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFifteenBook.tsx:198` — two fixed-width elements on this line (canvas and book); reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFiveBook.tsx:1031,1056` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFourBook.tsx:1075,1100` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonFourteenBook.tsx:1267,1294` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonNineBook.tsx:578,579` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonSevenBook.tsx:410,411` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonSixBook.tsx:997,1022` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonSixteenBook.tsx:195` — two fixed-width elements on this line (canvas and book); reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonTenBook.tsx:611,612` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonThirteenBook.tsx:1267,1294` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonThreeBook.tsx:1221,1246` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonTwelveBook.tsx:258` — two fixed-width elements on this line (canvas and book); reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneLessonTwoBook.tsx:1661,1688` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/PronunciationRulesBook.tsx:593,594` — scaled flipbook canvas and book element; reported-only.
- `src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/VowelsConsonantsBook.tsx:381,406` — scaled flipbook canvas and book element; reported-only.

### 2. Wide tables or horizontal content without contained scrolling

- `src/app/dashboard/admin/assignments/ChapterTestWorkspace.tsx:382-385` — the wrapper used `overflow-x-auto` but disabled it at `md` and above with `md:overflow-visible` around a `min-w-[980px]` table. At 1024px or zoomed desktop widths, this could escape to page-level horizontal overflow. **Fixed** by removing `md:overflow-visible`, retaining contained horizontal scrolling at every width.

All other surveyed wide tables were already contained by an explicit `overflow-x-auto`/`overflow-auto` ancestor or by the shared `Table` wrapper at `src/components/ui/table.tsx:11`. No other uncontained wide-table finding was identified statically.

### 3. Large fixed minimum widths

The following values exceed 1024px. They are intentional table minimum widths and are **reported-only (contained)**: each is inside either the shared `Table` scroll wrapper or an explicit local horizontal/auto scroll container. They do not, by themselves, force page-level overflow, but interactive zoom verification remains necessary.

- `src/features/visa-management/components/visa-management-student-view-page.tsx:192` — `1040px`; reported-only (contained).
- `src/features/visa-management/components/visa-management-student-view-page.tsx:267` — `1480px`; reported-only (contained).
- `src/features/permission-center/components/active-permission-grants-table.tsx:187` — `1080px`; reported-only (shared wrapper).
- `src/features/visa-management/components/platform-visa-overview.tsx:81` — `1380px`; reported-only (shared wrapper).
- `src/features/permission-center/components/permission-audit-table.tsx:171` — `1080px`; reported-only (shared wrapper).
- `src/features/visa-management/components/visa-cases-table/index.tsx:137` — `1540px`; reported-only (shared wrapper).
- `src/features/visa-management/components/visa-tasks-table/index.tsx:128` — `1640px`; reported-only (shared wrapper).
- `src/features/model-usage/components/model-usage-table/index.tsx:193` — `1280px`; reported-only (shared wrapper).
- `src/features/grades/components/grade-results-table/index.tsx:115` — `1180px`; reported-only (shared wrapper).
- `src/features/document-reviews/components/platform-document-review-overview.tsx:77` — `1180px`; reported-only (shared wrapper).
- `src/features/grades/components/grade-review-requests-table/index.tsx:113` — `1180px`; reported-only (shared wrapper).
- `src/features/document-reviews/components/document-review-applications-table/index.tsx:117` — `1240px`; reported-only (shared wrapper).
- `src/features/grades/components/platform-grade-overview.tsx:62` — `1120px`; reported-only (shared wrapper).
- `src/features/document-reviews/components/document-review-student-view.tsx:183` — `1080px`; reported-only (contained).
- `src/features/announcements/components/announcements-table/index.tsx:125` — `1240px`; reported-only (shared wrapper).
- `src/features/universities/components/universities-table/index.tsx:173` — `1440px`; reported-only (shared wrapper).
- `src/features/help-center/components/platform-help-overview.tsx:46` — `1320px`; reported-only (shared wrapper).
- `src/features/accounts/components/accounts-table/index.tsx:59` — `1080px`; reported-only (shared wrapper).
- `src/features/universities/components/requirements-maintenance/application-requirements-table.tsx:86` — `1180px`; reported-only (shared wrapper via `RequirementDataTable`).
- `src/features/universities/components/requirements-maintenance/visa-requirements-table.tsx:85` — `1360px`; reported-only (shared wrapper via `RequirementDataTable`).
- `src/features/help-center/components/help-tickets-table/index.tsx:114` — `1180px`; reported-only (shared wrapper).
- `src/features/digital-textbook/components/digital-textbook-table/index.tsx:129` — `1320px`; reported-only (shared wrapper).
- `src/features/tenant-management/components/tenant-overview-table.tsx:194` — `1080px`; reported-only (shared wrapper).
- `src/features/learning-records/components/student-learning-records-table/index.tsx:127` — `1320px`; reported-only (shared wrapper).
- `src/features/learning-records/components/platform-learning-record-overview.tsx:53` — `1180px`; reported-only (shared wrapper).
- `src/features/tenant-management/components/tenant-membership-audit-table.tsx:31` — `1120px`; reported-only (shared wrapper).
- `src/features/courses/components/course-catalog-tree/index.tsx:145` — `1040px`; reported-only (shared wrapper).
- `src/features/library/components/library-resources-table/index.tsx:141` — `1320px`; reported-only (shared wrapper).
- `src/features/growth-toolbox/components/toolbox-items-table/index.tsx:128` — `1200px`; reported-only (shared wrapper).
- `src/features/growth-toolbox/components/grammar-table/index.tsx:153` — `1360px`; reported-only (shared wrapper).
- `src/features/growth-toolbox/components/vocabulary-table/index.tsx:121` — `1080px`; reported-only (shared wrapper).
- `src/app/dashboard/admin/documents/DocumentReviewWorkspace.tsx:481` — `1220px`; reported-only (contained).
- `src/app/dashboard/admin/announcements/AnnouncementManagementWorkspace.tsx:290` — `1460px`; reported-only (contained).
- `src/app/dashboard/admin/announcements/AnnouncementManagementWorkspace.tsx:300` — `1050px`; reported-only (contained).
- `src/app/dashboard/admin/announcements/AnnouncementManagementWorkspace.tsx:301` — `1200px`; reported-only (contained).
- `src/app/dashboard/admin/visa/PlatformVisaOverview.tsx:177` — `1320px`; reported-only (contained).
- `src/app/dashboard/admin/documents/PlatformDocumentReviewOverview.tsx:128` — `1180px`; reported-only (contained).
- `src/app/dashboard/admin/grades/PlatformGradeOverview.tsx:134` — `1280px`; reported-only (contained).
- `src/app/dashboard/admin/visa/VisaManagementWorkspace.tsx:232` — `1420px`; reported-only (contained).
- `src/app/dashboard/admin/token-usage/TokenUsageTable.tsx:101` — `1040px`; reported-only (contained).
- `src/app/dashboard/admin/help/HelpCenterManagementWorkspace.tsx:165` — `1250px`; reported-only (contained).
- `src/app/dashboard/admin/help/HelpCenterManagementWorkspace.tsx:226` — `1300px`; reported-only (contained).
- `src/app/dashboard/admin/help/HelpCenterManagementWorkspace.tsx:239` — `1050px`; reported-only (contained).
- `src/app/dashboard/admin/records/PlatformLearningRecordOverview.tsx:101` — `1280px`; reported-only (contained).
- `src/app/dashboard/admin/library/LibraryCourseResourceTable.tsx:666` — `1040px`; reported-only (contained).
- `src/app/dashboard/admin/question-bank/LanguageQuestionBankWorkspace.tsx:100` — `1180px`; reported-only (contained).
- `src/app/dashboard/admin/question-bank/page-content.tsx:696` — `1350px`; reported-only (contained).
- `src/app/dashboard/admin/question-bank/LanguageChapterBankActions.tsx:105` — `1050px`; reported-only (contained).
- `src/app/dashboard/admin/question-bank/ChapterQuestionBankActions.tsx:177` — `1050px`; reported-only (contained).
- `src/app/dashboard/admin/assignments/ChapterHomeworkPlanEditor.tsx:338` — `1320px`; reported-only (contained).

No CSS `min-width: Npx` declaration above 1024px was found in the scoped trees.

### 4. Legacy `--app-*` custom properties

- `src/app/globals.css` — no literal `--app-*` usage found; clean.
- `src/app/dashboard/management-apple.css` — no literal `--app-*` usage found; clean.

No fix was required for item 4.

### 5. Raw hex/rgba fallbacks in shared CSS

- `src/app/globals.css:18` — `var(--foreground-muted, #646467)` and `var(--card, #ffffff)` bypassed semantic-token ownership. **Fixed** by removing both raw fallbacks.
- `src/app/globals.css:2365` — `var(--student-settings-popover-surface, #ffffff)` bypassed semantic-token ownership. **Fixed** by removing the raw fallback.
- `src/app/globals.css:2382` — `var(--student-settings-popover-surface, #ffffff)` bypassed semantic-token ownership. **Fixed** by removing the raw fallback.
- `src/app/dashboard/management-apple.css:1786` — `var(--card, #ffffff)` bypassed semantic-token ownership. **Fixed** by removing the raw fallback.
- `src/app/design-tokens.css` — no raw hex/rgba value used as a `var()` fallback; clean. Raw primitive/theme definitions in this token layer were not classified as bypasses.

The referenced `--foreground-muted`, `--card`, and `--student-settings-popover-surface` properties are defined in `src/app/design-tokens.css` for the relevant theme scopes.

## Files changed by this packet

- `src/app/dashboard/admin/assignments/ChapterTestWorkspace.tsx` — retained horizontal containment for the wide chapter-test table at desktop breakpoints.
- `src/app/globals.css` — removed three raw color fallback sites (four raw values total) from semantic-token consumption.
- `src/app/dashboard/management-apple.css` — removed one raw color fallback from semantic-token consumption.
- `design-system/yuanzhi-lms/pages/desktop-verification-static.md` — added this required static findings/status record.

The worktree contained hundreds of unrelated pre-existing changes. This packet did not revert, normalize, or otherwise modify those changes.

## Outstanding interactive verification and caveats

**Interactive browser zoom/width verification was NOT performed and remains outstanding.** This static-only packet did not verify rendering, keyboard operation, focus visibility, or zoom behavior at 1024/1280/1440/1920px × 100/125/150/200%. Those checks still require browser-based testing.

Static inspection can establish that scroll containment classes and token references exist, but it cannot prove computed layout, portal behavior, transformed flipbook hit targets, sticky-element behavior, focus reachability, or the absence of double-scroll under real browser zoom. In particular, the 1180px flipbook canvases require interactive confirmation before approval.
