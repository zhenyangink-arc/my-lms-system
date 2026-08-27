import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const legacyRouteFiles = [
  "src/app/[space]/dashboard/courses/page.tsx",
  "src/app/[space]/dashboard/courses/layout.tsx",
  "src/app/[space]/dashboard/courses/[categorySlug]/page.tsx",
  "src/app/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/page.tsx",
  "src/app/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/page.tsx",
  "src/app/[space]/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page.tsx",
];

const sharedCoursePages = [
  "src/app/dashboard/courses/page-content.tsx",
  "src/app/dashboard/courses/[categorySlug]/page-content.tsx",
  "src/app/dashboard/courses/[categorySlug]/KoreanLearningCenter.tsx",
  "src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/page-content.tsx",
  "src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/page-content.tsx",
  "src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx",
];

test("学生课程只保留租户应用正式路由", () => {
  for (const routeFile of legacyRouteFiles) {
    assert.equal(existsSync(routeFile), false, `${routeFile} 不应继续提供旧入口`);
  }

  for (const pageFile of sharedCoursePages) {
    const source = readFileSync(pageFile, "utf8");
    assert.doesNotMatch(
      source,
      /(?:href=|redirect\()[^\n]*["`]\/dashboard\/courses/,
      `${pageFile} 不应生成旧学生课程 URL`,
    );
  }
});

test("韩语和留学课程入口都从动态租户生成正式路径", () => {
  for (const appSlug of ["korean", "study-abroad"]) {
    const routeFile = `src/app/[space]/apps/${appSlug}/courses/[categorySlug]/page.tsx`;
    const source = readFileSync(routeFile, "utf8");
    assert.match(source, /getStudentAppCoursesPath\(space,/);
  }
});
