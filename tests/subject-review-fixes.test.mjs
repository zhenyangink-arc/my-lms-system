import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("今日任务按学科开放的学生端栏目生成，不产生指向不存在页面的任务", async () => {
  const service = await source("src/features/student-home-learning/api/service.ts");
  assert.match(service, /const assignmentsEnabled = isStudentNavItemEnabled\(appSlug, "assignments"\) \?\? true;/);
  assert.match(service, /const coursesEnabled = isStudentNavItemEnabled\(appSlug, "courses"\) \?\? true;/);
  assert.match(service, /assignmentsEnabled \? loadAssignmentExamTasks\(/);
  assert.match(service, /coursesEnabled \? loadCourseContinuationTasks\(commonInput\) : \[\]/);
  assert.match(service, /if \(isStudentNavItemEnabled\(appSlug, "assignments"\) === false\) return null;/);
  const portal = await source("src/app/[space]/page.tsx");
  assert.match(portal, /const courseApp = summaryApps\.find\(\s*\(app\) => isStudentNavItemEnabled\(app\.slug, "courses"\)/);
  assert.match(portal, /getCourseLearningPath\(space, null, courseApp\.slug\)/);
});

test("作业批改详情遵守学科清单的分区门禁", async () => {
  const route = await source(
    "src/app/[space]/dashboard/admin/apps/[appSlug]/assignments/[assignmentId]/page.tsx",
  );
  assert.match(
    route,
    /subject &&\s*!subject\.management\.sections\.includes\("assessments"\) &&\s*!subject\.management\.sections\.includes\("grades"\)/,
  );
});

test("巩固包编辑页只编辑属于当前应用的章节", async () => {
  const route = await source(
    "src/app/[space]/dashboard/admin/apps/[appSlug]/practice-center/[courseChapterId]/page.tsx",
  );
  assert.match(route, /if \(!unit \|\| unit\.studentAppId !== context\.access\.appId\) notFound\(\);/);
});

test("课程刷新覆盖所有提供课程目录路由的学生应用", async () => {
  const revalidate = await source("src/lib/revalidate-dashboard.ts");
  const listed = [...revalidate.matchAll(/COURSE_ROUTE_APP_SLUGS = \[([^\]]+)\]/g)][0][1]
    .split(",")
    .map((value) => value.trim().replace(/"/g, ""))
    .sort();
  const apps = await readdir(new URL("../src/app/[space]/apps/", import.meta.url), {
    withFileTypes: true,
  });
  const withCourses = [];
  for (const app of apps.filter((entry) => entry.isDirectory())) {
    const children = await readdir(
      new URL(`../src/app/[space]/apps/${app.name}/`, import.meta.url),
    );
    if (children.includes("courses")) withCourses.push(app.name);
  }
  assert.deepEqual(listed, withCourses.sort());
});

test("学生应用入口与写入操作共用同一套应用权限判断", async () => {
  const layout = await source("src/app/dashboard/StudentAppRouteLayout.tsx");
  assert.match(layout, /await hasActiveStudentAppAccess\(\{/);
  assert.doesNotMatch(layout, /from\("tenant_student_apps"\)|from\("student_app_enrollments"\)/);
});

test("韩语与英语作业详情布局共用同一实现", async () => {
  for (const app of ["korean", "english"]) {
    const layout = await source(`src/app/[space]/apps/${app}/assignments/[assignmentId]/layout.tsx`);
    assert.match(layout, new RegExp(`<StudentAssignmentDetailLayout[^>]*appSlug="${app}"`));
    assert.doesNotMatch(layout, /getAssignmentDetail/);
  }
});

test("学情与设置导航只列出学科清单开放的分区", async () => {
  const nav = await source("src/app/dashboard/admin/apps/LearningInsightsNavigation.tsx");
  assert.match(nav, /const subject = getSubjectManifest\(access\.app\.slug\);/);
  assert.match(nav, /subject\.management\.sections\.includes\(item\.key\)/);
  assert.match(nav, /\{visibleItems\.map\(item =>/);
});

test("管理端面包屑为所有管理分区提供中文名称", async () => {
  const breadcrumbs = await source("src/app/dashboard/ManagementBreadcrumbs.tsx");
  const { MANAGEMENT_SECTION_KEYS } = await import("../src/features/subjects/contracts.ts");
  for (const key of MANAGEMENT_SECTION_KEYS) {
    assert.match(breadcrumbs, new RegExp(`(^|\\s)("${key}"|${key}):`, "m"), key);
  }
});
