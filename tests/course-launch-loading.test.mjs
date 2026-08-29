import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("学生进入韩语章节前预取数据并显示连续加载反馈", () => {
  const learningCenterSource = readFileSync(
    new URL(
      "../src/app/dashboard/courses/[categorySlug]/KoreanLearningCenter.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const launchLinkSource = readFileSync(
    new URL(
      "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/HangulLessonLaunchLink.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const routeLoadingSource = readFileSync(
    new URL(
      "../src/app/[space]/apps/korean/courses/[categorySlug]/loading.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const loadingViewSource = readFileSync(
    new URL(
      "../src/app/dashboard/DashboardRouteLoading.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const lessonPageSource = readFileSync(
    new URL(
      "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(learningCenterSource, /<HangulLessonLaunchLink/);
  assert.match(launchLinkSource, /prefetch=\{true\}/);
  assert.match(launchLinkSource, /router\.prefetch\(href\)/);
  assert.match(launchLinkSource, /正在读取章节数据/);
  assert.match(launchLinkSource, /role="progressbar"/);
  assert.match(launchLinkSource, /role="dialog"/);
  assert.match(launchLinkSource, /window\.location\.assign\(href\)/);
  assert.match(routeLoadingSource, /StudentCourseRouteLoading/);
  assert.match(loadingViewSource, /正在加载课程数据/);
  assert.match(loadingViewSource, /课程数据加载进度/);

  const loadPosition = lessonPageSource.indexOf(
    "const smartTextbook = await loadSmartDigitalTextbook",
  );
  const renderPosition = lessonPageSource.indexOf("<SmartTextbookShell", loadPosition);
  assert.ok(loadPosition >= 0 && renderPosition > loadPosition);
});
