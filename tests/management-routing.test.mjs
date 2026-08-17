import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

import {
  buildLegacyStudentAppTarget,
  buildLegacyStudentAppTargetFromRequestPath,
} from "../src/app/dashboard/legacy-redirect.ts";
import {
  isReservedTenantSlug,
  RESERVED_TENANT_SLUGS,
} from "../src/lib/tenant-routing.ts";
import {
  STUDENT_APP_IDS,
  STUDENT_APPS,
  getStudentAppPath,
} from "../src/lib/student-apps.ts";
import {
  getDashboardBasePath,
  scopeDashboardPath,
} from "../src/lib/dashboard-path.ts";
import { getManagementAppPath } from "../src/lib/management-app-path.ts";
import {
  getPracticeAppPath,
  getPracticeDashboardPath,
  getPracticeMemoryKey,
  getPracticeSectionFromDashboardPath,
  isPracticeSection,
} from "../src/lib/practice-navigation-memory.ts";

const expectedApplicationSlugs = [
  "korean",
  "english",
  "math",
  "university",
  "study-abroad",
];

const expectedManagementApplicationSections = [
  "analytics",
  "assessments",
  "content",
  "conversation",
  "documents",
  "grades",
  "records",
  "settings",
  "students",
  "textbooks",
  "toolbox",
  "universities",
  "visa",
];

test("鉴权上下文合并成员关系与租户读取且登录直接进入 canonical 路由", () => {
  const authSource = readFileSync(
    new URL("../src/lib/auth.ts", import.meta.url),
    "utf8",
  );
  const loginRedirectSource = readFileSync(
    new URL("../src/app/login/redirect/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    authSource,
    /tenants!tenant_memberships_tenant_id_fkey\(id, slug, name, status, plan_key\)/,
  );
  assert.doesNotMatch(authSource, /\.from\("tenants"\)/);
  assert.match(loginRedirectSource, /getDashboardBasePath\(tenant\?\.slug\)/);
  assert.match(
    loginRedirectSource,
    /scopeDashboardPath\("\/dashboard\/admin", dashboardBasePath\)/,
  );
  assert.doesNotMatch(loginRedirectSource, /redirect\("\/dashboard"\)/);
  assert.equal(
    scopeDashboardPath(
      "/dashboard/admin",
      getDashboardBasePath("yuanzhi"),
    ),
    "/yuanzhi/dashboard/admin",
  );
});

test("PERF-003 指定站内入口不再主动生成 legacy URL", () => {
  const documentsSource = readFileSync(
    new URL("../src/app/dashboard/documents/page-content.tsx", import.meta.url),
    "utf8",
  );
  const schoolsSource = readFileSync(
    new URL(
      "../src/app/dashboard/admin/schools/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(documentsSource, /getStudentAppPath/);
  assert.doesNotMatch(documentsSource, /href=\{?`?\/dashboard/);
  assert.match(schoolsSource, /getManagementAppPath/);
  assert.doesNotMatch(schoolsSource, /href=\{?`?\/dashboard/);
  assert.equal(
    getStudentAppPath("yuanzhi", "study-abroad", "documents"),
    "/yuanzhi/apps/study-abroad/documents",
  );
  assert.equal(
    getManagementAppPath(
      getDashboardBasePath("yuanzhi"),
      "study-abroad",
      "universities",
    ),
    "/yuanzhi/dashboard/admin/apps/study-abroad/universities",
  );
});

test("管理端与学生端共用五个明确分离的应用标识", () => {
  assert.deepEqual(
    STUDENT_APPS.map((app) => app.slug),
    expectedApplicationSlugs,
  );
  assert.equal(new Set(Object.values(STUDENT_APP_IDS)).size, 5);
  assert.deepEqual(
    Object.fromEntries(STUDENT_APPS.map((app) => [app.slug, app.status])),
    {
      korean: "active",
      english: "coming_soon",
      math: "coming_soon",
      university: "coming_soon",
      "study-abroad": "active",
    },
  );
});

test("学生应用顶部栏保留可用的外观设置入口", () => {
  const topbarSource = readFileSync(
    new URL("../src/app/dashboard/StudentSystemTopbar.tsx", import.meta.url),
    "utf8",
  );
  const globalStyles = readFileSync(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(topbarSource, /aria-label="打开外观设置"/);
  assert.match(topbarSource, /id="student-system-glass-popover"/);
  assert.match(topbarSource, /<Popover open=\{appearanceOpen\}/);
  assert.match(topbarSource, /initialFocus=\{firstThemeButtonRef\}/);
  assert.match(topbarSource, /positionerClassName="student-system-floating-layer"/);
  assert.match(globalStyles, /\.student-system-glass-popover\s*\{/);
});

test("成绩中心先选作业或考试并只展示当前分类六边形", () => {
  const gradeBoardSource = readFileSync(
    new URL("../src/app/dashboard/grades/GradeBoard.tsx", import.meta.url),
    "utf8",
  );
  const gradePageSource = readFileSync(
    new URL("../src/app/dashboard/grades/page-content.tsx", import.meta.url),
    "utf8",
  );
  const selectorPosition = gradeBoardSource.indexOf('aria-label="选择成绩类型"');
  const radarPosition = gradeBoardSource.indexOf(
    "<SkillRadar category={category} profile={skillProfiles[category]} />",
  );

  assert.ok(selectorPosition >= 0 && selectorPosition < radarPosition);
  assert.match(gradeBoardSource, /data-grade-category-selector/);
  assert.doesNotMatch(
    gradeBoardSource,
    /linear-gradient\(145deg, var\(--app-card-bg\), var\(--app-hero-end\)\)/,
  );
  assert.equal(gradeBoardSource.match(/<SkillRadar\b/g)?.length, 1);
  assert.doesNotMatch(gradeBoardSource, /const overallAverage/);
  assert.match(gradeBoardSource, /url\.searchParams\.set\("type", category\)/);
  assert.match(gradeBoardSource, /window\.history\[method\]/);
  assert.match(gradeBoardSource, /window\.localStorage\.setItem\(memoryKey, category\)/);
  assert.match(gradeBoardSource, /window\.addEventListener\("popstate"/);
  assert.equal(gradeBoardSource.match(/label: "平均得分率"/g)?.length, 1);
  assert.doesNotMatch(gradeBoardSource, /当前分类平均/);
  assert.match(gradeBoardSource, /evidenceOnly/);
  assert.match(gradeBoardSource, /line-clamp-3[^"]*text-sm[^"]*font-medium/);
  assert.doesNotMatch(gradePageSource, /GradeResultSection/);
  assert.match(gradePageSource, /预览模式/);
  assert.doesNotMatch(gradePageSource, /学生成绩页预览/);
  assert.match(
    gradePageSource,
    /student-grade-category-v1:\$\{user\.id\}:\$\{STUDENT_APP_IDS\.korean\}/,
  );
  assert.doesNotMatch(gradePageSource, /\.from\("chapter_test_attempts"\)/);
  assert.match(
    gradePageSource,
    /章节测试只在对应章节结果页读取；成绩中心不再为不可见数据发起额外查询/,
  );
});

test("韩语课程首页按完整分类展示课程并保持租户应用路由", () => {
  const koreanCoursePage = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/courses/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const catalogSource = readFileSync(
    new URL("../src/app/dashboard/courses/page-content.tsx", import.meta.url),
    "utf8",
  );
  const catalogBrowserSource = readFileSync(
    new URL(
      "../src/app/dashboard/courses/KoreanCourseCatalogBrowser.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const directCatalogStart = catalogSource.indexOf(
    "function KoreanDirectCourseCatalog",
  );
  const directCatalogEnd = catalogSource.indexOf(
    "export async function CourseCatalog",
  );
  const directCatalogSource = catalogSource.slice(
    directCatalogStart,
    directCatalogEnd,
  );

  assert.match(koreanCoursePage, /params: Promise<\{ space: string \}>/);
  assert.match(koreanCoursePage, /studentAppSlug="korean" space=\{space\}/);
  assert.equal(
    getStudentAppPath(
      "yuanzhi",
      "korean",
      "courses/korean/foundation/hangul-one",
    ),
    "/yuanzhi/apps/korean/courses/korean/foundation/hangul-one",
  );
  assert.match(directCatalogSource, /subcategories\.map/);
  assert.match(directCatalogSource, /categoryCourses\.map\(\(course, index\)/);
  assert.match(directCatalogSource, /totalLessons === 0\s*\? "preparing"/);
  assert.match(directCatalogSource, /我的进度/);
  assert.match(directCatalogSource, /totalCompletedLessons/);
  assert.match(directCatalogSource, /<KoreanCourseCatalogBrowser sections=\{courseSections\}/);
  assert.match(catalogBrowserSource, /aria-label="韩语课程分类"/);
  assert.match(catalogBrowserSource, /aria-label="按学习状态筛选课程"/);
  assert.match(catalogBrowserSource, /placeholder="搜索课程名称或简介"/);
  assert.match(catalogBrowserSource, /第 \{course\.sequence\} 课/);
  assert.match(catalogBrowserSource, /line-clamp-2 min-h-14/);
  assert.match(catalogBrowserSource, /progressPercent >= 100/);
  assert.match(catalogBrowserSource, /progressPercent > 0/);
  assert.match(catalogBrowserSource, /内容准备中/);
  assert.match(directCatalogSource, /getStudentAppPath/);
  assert.doesNotMatch(directCatalogSource, /移入收藏夹/);
  assert.doesNotMatch(directCatalogSource, /\/dashboard\/courses/);
});

test("韩语成长首页统一卡片体系并保留完整学习入口", () => {
  const homeSource = readFileSync(
    new URL("../src/app/dashboard/SystemGrowthHomeView.tsx", import.meta.url),
    "utf8",
  );
  const trendSource = readFileSync(
    new URL("../src/app/dashboard/StudentStudyTrendPanel.tsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../src/app/dashboard/DashboardHomePage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(homeSource, /recentActivity\.slice\(1, 4\)/);
  assert.doesNotMatch(homeSource, /recentActivity\.slice\(0, 3\)\.map/);
  assert.doesNotMatch(homeSource, /MonthlyStudyDialog|TriangleAlert/);
  assert.match(homeSource, /<StudentStudyTrendPanel ranges=\{studyRanges\}/);
  assert.match(homeSource, /目标每周学习 5 天，已完成/);
  assert.match(homeSource, /\$\{toolboxHref\}\/speaking/);
  assert.match(homeSource, /\$\{toolboxHref\}\/grammar/);
  assert.match(homeSource, /\$\{toolboxHref\}\/listening/);
  assert.match(homeSource, /const visibleCourses = courseProgressList\.slice\(0, 3\)/);
  assert.match(homeSource, /入口待完善/);
  assert.match(pageSource, /Published courses are missing a complete category route/);
  assert.match(trendSource, /aria-label="选择学习趋势时间范围"/);
  assert.match(trendSource, /role="tooltip"/);
  assert.match(trendSource, /onFocus=\{\(\) => setActiveIndex\(index\)\}/);
  assert.match(trendSource, /onClick=\{\(\) => setActiveIndex/);
});

test("韩语学生导航合并为巩固中心并保留三类独立子路由", () => {
  const sidebarSource = readFileSync(
    new URL("../src/app/dashboard/StudentSystemSidebar.tsx", import.meta.url),
    "utf8",
  );
  const pageHeaderSource = readFileSync(
    new URL("../src/app/dashboard/StudentPageHeader.tsx", import.meta.url),
    "utf8",
  );
  const practiceNavigationSource = readFileSync(
    new URL(
      "../src/app/dashboard/practice/PracticeHubNavigation.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const practiceIntroSource = readFileSync(
    new URL(
      "../src/app/dashboard/practice/PracticeSectionIntro.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const practiceLayoutSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/practice/layout.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const legacyProgressSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/progress/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const legacyToolboxSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/toolbox/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    sidebarSource,
    /label: "巩固中心", href: "\/dashboard\/practice"/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /label: "深化学习", href: "\/dashboard\/progress"/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /label: "专项练习", href: "\/dashboard\/toolbox"/,
  );
  assert.match(
    sidebarSource,
    /\["\/dashboard", "\/dashboard\/courses", "\/dashboard\/practice"\]/,
  );
  assert.match(pageHeaderSource, /title: "巩固中心", icon: Target/);

  for (const section of ["course", "skills", "review"]) {
    assert.match(practiceNavigationSource, new RegExp(`slug: "${section}"`));
    assert.equal(
      existsSync(
        new URL(
          `../src/app/[space]/apps/korean/practice/${section}/page.tsx`,
          import.meta.url,
        ),
      ),
      true,
    );
  }
  for (const title of ["课程巩固", "专项训练", "错题复习"]) {
    assert.match(practiceIntroSource, new RegExp(`title: "${title}"`));
  }
  assert.match(practiceLayoutSource, /<PracticeSectionIntro/);
  assert.match(practiceIntroSource, /pathname === `\$\{basePath\}\/\$\{item\.slug\}`/);
  assert.match(legacyProgressSource, /practice\/course/);
  assert.match(legacyToolboxSource, /practice\/skills/);
});

test("巩固中心按学生和应用记住最后打开的一级位置", () => {
  assert.equal(
    getPracticeSectionFromDashboardPath(
      "/dashboard/practice/skills/vocabulary",
    ),
    "skills",
  );
  assert.equal(
    getPracticeSectionFromDashboardPath("/dashboard/practice/review"),
    "review",
  );
  assert.equal(
    getPracticeSectionFromDashboardPath("/dashboard/practice/unknown"),
    null,
  );
  assert.equal(isPracticeSection("course"), true);
  assert.equal(isPracticeSection("unknown"), false);
  assert.equal(
    getPracticeDashboardPath("skills"),
    "/dashboard/practice/skills",
  );
  assert.equal(
    getPracticeAppPath("/yuanzhi/apps/korean", "review"),
    "/yuanzhi/apps/korean/practice/review",
  );
  assert.notEqual(
    getPracticeMemoryKey("student-a", "/yuanzhi/apps/korean"),
    getPracticeMemoryKey("student-b", "/yuanzhi/apps/korean"),
  );
});

test("六项专项训练按正式课程章节建立独立练习", () => {
  const toolboxSource = readFileSync(
    new URL(
      "../src/app/dashboard/toolbox/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const skillSource = readFileSync(
    new URL(
      "../src/app/dashboard/toolbox/[skill]/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const migrationSource = readFileSync(
    new URL(
      "../supabase/migrations/202608160013_chapter_aligned_skill_practice.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const submissionMigrationSource = readFileSync(
    new URL(
      "../supabase/migrations/202608160014_toolbox_submission_app_scope.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const catalogAlignmentMigrationSource = readFileSync(
    new URL(
      "../supabase/migrations/202608160015_toolbox_course_catalog_alignment.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const dedicatedTrainingPageSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/training/[skill]/[courseSlug]/[lessonSlug]/[chapterSlug]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  for (const skill of [
    "listening",
    "speaking",
    "reading",
    "writing",
    "grammar",
    "vocabulary",
  ]) {
    assert.match(skillSource, new RegExp(`^  ${skill}: \\{`, "m"));
    assert.match(migrationSource, new RegExp(`\\('${skill}'`));
  }

  assert.match(toolboxSource, /\.select\("skill,course_id,course_chapter_id"\)/);
  assert.match(skillSource, /getUnlockedChapterSlugs/);
  assert.match(skillSource, /选择课程、课时与章节/);
  assert.match(
    skillSource,
    /\$\{skillExerciseBasePath\}\/\$\{encodeURIComponent\(course\.slug\)\}\/\$\{encodeURIComponent\(lesson\.slug\)\}\/\$\{encodeURIComponent\(chapter\.slug\)\}/,
  );
  assert.match(skillSource, /selectedUnit && !renderExercisePage/);
  assert.match(skillSource, /redirect\([\s\S]*?skillExerciseBasePath/);
  assert.match(dedicatedTrainingPageSource, /renderExercisePage/);
  assert.match(dedicatedTrainingPageSource, /course: courseSlug/);
  assert.match(dedicatedTrainingPageSource, /lesson: lessonSlug/);
  assert.match(dedicatedTrainingPageSource, /chapter: chapterSlug/);
  assert.doesNotMatch(skillSource, /即将上线/);
  assert.match(
    migrationSource,
    /add column if not exists chapter_test_id uuid[\s\S]*?references public\.chapter_tests\(id\)/,
  );
  assert.match(migrationSource, /cross join skill_catalog as skill/);
  assert.match(migrationSource, /'chapterAligned', true/);
  assert.match(
    catalogAlignmentMigrationSource,
    /add column if not exists course_chapter_id uuid[\s\S]*?references public\.course_chapters\(id\)/,
  );
  assert.match(catalogAlignmentMigrationSource, /insert into public\.course_chapters/);
  assert.match(catalogAlignmentMigrationSource, /仍有已发布韩语课程章节没有六项专项训练/);
  assert.match(catalogAlignmentMigrationSource, /course\.student_app_id is distinct from exercise\.student_app_id/);
  assert.match(
    submissionMigrationSource,
    /private\.current_user_can_read_student_app\(exercise\.student_app_id\)/,
  );
  assert.match(
    submissionMigrationSource,
    /student_id,\s*student_app_id,\s*exercise_id/,
  );
});

test("巩固中心继续按韩语应用隔离读取和写入", () => {
  const koreanLayoutSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/layout.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const vocabularySource = readFileSync(
    new URL(
      "../src/app/dashboard/toolbox/vocabulary/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const toolboxActionsSource = readFileSync(
    new URL(
      "../src/app/dashboard/toolbox/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const coursePracticeSource = readFileSync(
    new URL(
      "../src/app/dashboard/progress/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(koreanLayoutSource, /appSlug="korean"/);
  assert.match(
    vocabularySource,
    /\.eq\("student_app_id", STUDENT_APP_IDS\.korean\)/,
  );
  assert.match(
    toolboxActionsSource,
    /student_app_id: STUDENT_APP_IDS\.korean/,
  );
  assert.match(
    coursePracticeSource,
    /\.select\("test_id,test_slug,score,passed"\)/,
  );
  assert.match(coursePracticeSource, /knowledgeTestIds\.has/);
});

test("精研课程使用独立讲解链接并保留租户内学习入口", () => {
  const workbenchSource = readFileSync(
    new URL(
      "../src/app/dashboard/progress/KnowledgeResearchWorkbench.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const coursePracticeSource = readFileSync(
    new URL(
      "../src/app/dashboard/progress/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const courseRouteSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/practice/course/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.equal(
    existsSync(
      new URL(
        "../src/app/[space]/apps/korean/practice/course/[courseKey]/[chapterSlug]/page.tsx",
        import.meta.url,
      ),
    ),
    true,
  );
  assert.match(
    workbenchSource,
    /精研课程 · \{courseEyebrow\} · \{courseTitle\}/,
  );
  assert.match(
    workbenchSource,
    /const \[isFullscreen, setIsFullscreen\] = useState\(false\)/,
  );
  assert.match(workbenchSource, /aria-label="精研学习方式"/);
  assert.match(coursePracticeSource, /courseTitle=\{selectedCourse\.title\}/);
  assert.match(coursePracticeSource, /chapterTestHref=\{`\$\{assignmentsBaseHref\}/);
  assert.match(
    coursePracticeSource,
    /\$\{chapterBaseHref\}\/\$\{encodeURIComponent\(course\.key\)\}\/\$\{encodeURIComponent\(chapter\.slug\)\}/,
  );
  assert.match(courseRouteSource, /if \(query\.course && query\.chapter\)/);
  assert.match(courseRouteSource, /redirect\(/);
  assert.match(
    coursePracticeSource,
    /getStudentAppPath\([\s\S]*?"courses\/korean\/korean-basic\/korean-beginner\/hangul-introduction"/,
  );
});

test("留学课程的学生路由和旧链接都落到留学服务应用", () => {
  assert.equal(
    existsSync(
      new URL(
        "../src/app/[space]/apps/study-abroad/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx",
        import.meta.url,
      ),
    ),
    true,
  );
  assert.equal(
    buildLegacyStudentAppTarget(
      "/seoul/dashboard",
      ["courses", "service", "application", "target-selection"],
      {},
    ),
    "/seoul/apps/study-abroad/courses/service/application/target-selection",
  );
  assert.equal(
    buildLegacyStudentAppTargetFromRequestPath(
      "/seoul/dashboard",
      "/seoul/dashboard/courses/service/application?tab=course",
    ),
    "/seoul/apps/study-abroad/courses/service/application?tab=course",
  );
  assert.equal(
    buildLegacyStudentAppTarget(
      "/seoul/dashboard",
      ["courses", "korean", "korean-basic"],
      {},
    ),
    "/seoul/apps/korean/courses/korean/korean-basic",
  );
});

test("管理端二级业务按独立路由拆包并具备就近加载边界", () => {
  for (const section of expectedManagementApplicationSections) {
    assert.equal(
      existsSync(
        new URL(
          `../src/app/[space]/dashboard/admin/apps/[appSlug]/${section}/page.tsx`,
          import.meta.url,
        ),
      ),
      true,
      `${section} 应保留独立页面入口，避免重新合并为一个大客户端包`,
    );
  }

  for (const routeLoadingFile of [
    "../src/app/[space]/dashboard/admin/loading.tsx",
    "../src/app/[space]/dashboard/admin/apps/[appSlug]/loading.tsx",
    "../src/app/[space]/apps/loading.tsx",
    "../src/app/[space]/apps/korean/loading.tsx",
    "../src/app/[space]/apps/study-abroad/loading.tsx",
  ]) {
    assert.equal(
      existsSync(new URL(routeLoadingFile, import.meta.url)),
      true,
      `${routeLoadingFile} 应提供动态路由即时反馈`,
    );
  }
});

test("所有 Next 根路由命名空间都不能被租户占用", () => {
  const staticRootDirectories = readdirSync(
    new URL("../src/app/", import.meta.url),
    { withFileTypes: true },
  )
    .filter((entry) => entry.isDirectory() && entry.name !== "[space]")
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(
    [...RESERVED_TENANT_SLUGS].sort(),
    ["platform", ...staticRootDirectories].sort(),
  );
  for (const slug of RESERVED_TENANT_SLUGS) {
    assert.equal(isReservedTenantSlug(slug), true);
    assert.equal(isReservedTenantSlug(`  ${slug.toUpperCase()}  `), true);
  }
  assert.equal(isReservedTenantSlug("seoul-academy"), false);
});
