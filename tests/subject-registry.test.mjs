import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import {
  MANAGEMENT_SECTION_KEYS,
  STUDENT_NAV_KEYS,
  SUBJECT_SLUGS,
  getSubjectManifest,
  isSubjectSectionEnabled,
  isSubjectSlug,
} from "../src/features/subjects/index.ts";
import { STUDENT_APPS } from "../src/lib/student-apps.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const adminApps = "src/app/[space]/dashboard/admin/apps/[appSlug]";

// 改造前只对韩语开放的管理端分区。
const SUBJECT_ONLY_SECTIONS = [
  "learning-plans",
  "teaching-scripts",
  "practice-insights",
  "practice-center",
  "completion-review",
];

function filesUnder(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });
}

test("学科清单只覆盖学习类应用，留学服务和大学课程不是学科模块", () => {
  assert.deepEqual([...SUBJECT_SLUGS].sort(), ["english", "korean", "math"]);
  for (const slug of SUBJECT_SLUGS) {
    assert.equal(STUDENT_APPS.find((app) => app.slug === slug)?.kind, "learning");
    assert.equal(getSubjectManifest(slug)?.slug, slug);
    assert.equal(getSubjectManifest(slug)?.contractVersion, 1);
  }
  for (const slug of ["university", "study-abroad", "toString", "__proto__", ""]) {
    assert.equal(getSubjectManifest(slug), null, slug);
    assert.equal(isSubjectSlug(slug), false, slug);
  }
});

test("清单中的分区和导航键合法且不重复", () => {
  for (const slug of SUBJECT_SLUGS) {
    const manifest = getSubjectManifest(slug);
    const sections = manifest.management.sections;
    assert.equal(new Set(sections).size, sections.length, slug);
    for (const section of sections) assert.ok(MANAGEMENT_SECTION_KEYS.includes(section), `${slug}:${section}`);

    const navKeys = manifest.student.navigation.flatMap((group) => group.items);
    assert.equal(new Set(navKeys).size, navKeys.length, slug);
    for (const key of [...navKeys, ...manifest.student.mobilePrimary, ...Object.keys(manifest.student.navLabels ?? {})]) {
      assert.ok(STUDENT_NAV_KEYS.includes(key), `${slug}:${key}`);
    }
    for (const key of manifest.student.mobilePrimary) assert.ok(navKeys.includes(key), `${slug}:${key}`);
  }
});

test("分区键与管理端 learningSections 完全一致", () => {
  const source = read("src/app/dashboard/admin/apps/ManagementApplicationSectionPage.tsx");
  const block = source.match(/const learningSections[\s\S]*?\n};/)?.[0] ?? "";
  const keys = [...block.matchAll(/^  "?([a-z-]+)"?: \{/gm)].map((match) => match[1]);
  assert.deepEqual([...keys].sort(), [...MANAGEMENT_SECTION_KEYS].sort());
});

test("韩语清单与改造前的管理端和学生端行为一致", () => {
  const korean = getSubjectManifest("korean");
  assert.deepEqual([...korean.management.sections].sort(), [...MANAGEMENT_SECTION_KEYS].sort());
  assert.equal(korean.management.teachingOperations, true);
  assert.equal(korean.management.courseContentWorkflow, true);
  assert.deepEqual(korean.student.navigation, [
    { label: "学习", items: ["home", "courses", "practice", "assignments", "conversation"] },
    { label: "成长记录", items: ["grades", "records", "library"] },
    { label: "消息与服务", items: ["announcements", "help"] },
  ]);
  assert.deepEqual(korean.student.navLabels, { home: "成长首页", courses: "韩语课程" });
  assert.deepEqual(korean.student.mobilePrimary, ["home", "courses", "practice"]);
  assert.equal(korean.student.courseSearch, true);
  assert.equal(korean.student.practiceMemory, true);
  assert.equal(korean.student.membershipFooter, true);
  // 韩语课程目录维持旧规则：只有主线分类可进入。
  assert.equal(korean.student.catalogOpensAllCategories, false);
});

test("英语和数学的管理端先只开放三个已按应用隔离的分区", () => {
  for (const slug of ["english", "math"]) {
    const manifest = getSubjectManifest(slug);
    assert.deepEqual(manifest.management.sections, ["students", "content", "settings"]);
    assert.equal(manifest.management.teachingOperations, false);
    assert.equal(manifest.management.courseContentWorkflow, false);
    assert.equal(manifest.student.courseSearch, false);
    assert.equal(manifest.student.practiceMemory, false);
    assert.equal(manifest.student.membershipFooter, false);
  }
});

test("英语课程目录的分类都提供学习入口，数学尚未接入课程目录", () => {
  assert.equal(getSubjectManifest("english").student.catalogOpensAllCategories, true);
  assert.equal(getSubjectManifest("math").student.catalogOpensAllCategories, false);
});

test("英语学生端只接入已按应用隔离的平台页面，数学仍只有应用首页", () => {
  const english = getSubjectManifest("english");
  assert.deepEqual(english.student.navigation, [
    { label: "学习", items: ["home", "courses", "assignments"] },
    { label: "成长记录", items: ["grades", "records", "library"] },
    { label: "消息与服务", items: ["announcements", "help"] },
  ]);
  assert.deepEqual(english.student.navLabels, { home: "应用首页", courses: "英语课程" });
  const englishKeys = english.student.navigation.flatMap((group) => group.items);
  for (const pending of ["practice", "conversation"]) assert.ok(!englishKeys.includes(pending), pending);

  const math = getSubjectManifest("math");
  assert.deepEqual(math.student.navigation, [{ label: "应用导航", items: ["home"] }]);
  assert.deepEqual(math.student.navLabels, { home: "应用首页" });
});

test("学科清单里的每个学生导航项都有对应的应用路由", () => {
  const routeByKey = {
    home: "page.tsx",
    courses: "courses/page.tsx",
    practice: "practice/page.tsx",
    assignments: "assignments/page.tsx",
    conversation: "conversation-practice/page.tsx",
    grades: "grades/page.tsx",
    records: "records/page.tsx",
    library: "library/page.tsx",
    announcements: "announcements/page.tsx",
    help: "help/page.tsx",
  };
  assert.deepEqual(Object.keys(routeByKey).sort(), [...STUDENT_NAV_KEYS].sort());
  for (const slug of SUBJECT_SLUGS) {
    for (const key of getSubjectManifest(slug).student.navigation.flatMap((group) => group.items)) {
      const route = `src/app/[space]/apps/${slug}/${routeByKey[key]}`;
      assert.ok(statSync(join(root, route)).isFile(), route);
    }
  }
});

test("英语应用路由明确传入 english，课程分类只放行英语分类", () => {
  const english = "src/app/[space]/apps/english";
  for (const route of filesUnder(english).filter((path) => /\.tsx$/.test(path))) {
    const source = read(route);
    assert.doesNotMatch(source, /"korean"|STUDENT_APP_IDS\.korean/, route);
  }
  for (const route of [
    "courses/page.tsx",
    "assignments/page.tsx",
    "assignments/[assignmentId]/page.tsx",
    "grades/page.tsx",
    "records/page.tsx",
    "library/page.tsx",
  ]) {
    assert.match(read(`${english}/${route}`), /studentAppSlug="english"/, route);
  }
  assert.match(read(`${english}/courses/[categorySlug]/layout.tsx`), /if \(categorySlug !== "english"\) notFound\(\);/);
  assert.match(read(`${english}/assignments/[assignmentId]/layout.tsx`), /STUDENT_APP_IDS\.english/);
});

test("按应用显示课程目录时不再把本应用分类当作即将上线", () => {
  const catalog = read("src/app/dashboard/courses/page-content.tsx");
  assert.match(catalog, /studentAppSlug \? \[\] : \["english", "math", "university"\]/);
  const grades = read("src/app/dashboard/grades/page-content.tsx");
  assert.match(grades, /isStudent && isSubjectSectionEnabled\(studentAppSlug, "completion-review"\)/);
});

test("依赖学科能力的分区只对启用它的学科开放", () => {
  for (const section of SUBJECT_ONLY_SECTIONS) {
    assert.equal(isSubjectSectionEnabled("korean", section), true, section);
    for (const slug of ["english", "math", "university", "study-abroad", "toString"]) {
      assert.equal(isSubjectSectionEnabled(slug, section), false, `${slug}:${section}`);
    }
  }
});

test("工作区中 subjectOnly 模块与改造前只限韩语的模块一致", () => {
  const source = read("src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx");
  const learning = source.match(/const learningModules[\s\S]*?\n\];/)?.[0] ?? "";
  const subjectOnly = learning
    .split(/\n  \{\n/)
    .filter((entry) => /subjectOnly: true/.test(entry))
    .map((entry) => entry.match(/key: "([a-z-]+)"/)?.[1]);
  assert.deepEqual([...subjectOnly].sort(), [...SUBJECT_ONLY_SECTIONS].sort());
  assert.doesNotMatch(source, /appSlugs/);
});

test("本次接入的平台文件不再按韩语 slug 判断", () => {
  for (const path of [
    "src/app/dashboard/admin/apps/ManagementApplicationSectionPage.tsx",
    "src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx",
    "src/app/dashboard/admin/apps/TeachingOperationsNavigation.tsx",
    "src/app/dashboard/admin/apps/CourseWorkflowNavigation.tsx",
    "src/lib/course-content-workflow.ts",
    "src/app/dashboard/StudentSystemSidebar.tsx",
    "src/app/dashboard/StudentSystemTopbar.tsx",
    `${adminApps}/practice-center/page.tsx`,
    `${adminApps}/practice-center/[courseChapterId]/page.tsx`,
    `${adminApps}/practice-insights/page.tsx`,
    `${adminApps}/conversation/scenarios/page.tsx`,
    `${adminApps}/completion-review/page.tsx`,
    `${adminApps}/learning-plans/page.tsx`,
    "src/features/course-completion/policy-actions.ts",
    "src/features/course-completion/review-actions.ts",
    "src/features/curriculum-plans/actions.ts",
    "src/features/platform-learning-insights/PlatformInsightPage.tsx",
    "src/app/dashboard/admin/apps/ManagementApplicationPeoplePage.tsx",
    "src/app/dashboard/StudentPageHeader.tsx",
  ]) {
    assert.doesNotMatch(read(path), /[!=]== ?["']korean["']/, path);
  }
});

test("依赖方向：学科之间不深链，共享层不引用学科", () => {
  for (const path of filesUnder("src/features/subjects")) {
    const source = read(path);
    assert.doesNotMatch(source, /from ["']@\/app\//, path);
    const subject = relative("src/features/subjects", path).split("/")[0];
    for (const other of SUBJECT_SLUGS.filter((slug) => slug !== subject)) {
      assert.doesNotMatch(source, new RegExp(`from ["'][^"']*/${other}/(?!index\\.ts["'])`), path);
    }
  }
  for (const path of filesUnder("src/lib").filter((file) => /\.(ts|tsx)$/.test(file))) {
    assert.doesNotMatch(read(path), /from ["'][^"']*features\/subjects/, path);
  }
});

test("2B：只读页面和服务按传入的应用查询，旧入口集中沿用韩语", () => {
  const pages = [
    "src/app/dashboard/grades/page-content.tsx",
    "src/app/dashboard/records/page-content.tsx",
    "src/app/dashboard/assignments/page-content.tsx",
    "src/app/dashboard/assignments/[assignmentId]/page-content.tsx",
    "src/app/dashboard/toolbox/page-content.tsx",
    "src/app/dashboard/toolbox/[skill]/page-content.tsx",
    "src/app/dashboard/toolbox/vocabulary/page-content.tsx",
  ];
  const services = [
    "src/features/chapter-practice/api/service.ts",
    "src/features/chapter-practice/api/student-service.ts",
    "src/features/student-current-course/api/service.ts",
    "src/features/student-ability-portrait/api/service.ts",
    "src/features/course-completion/student-service.ts",
    "src/lib/course-practice-catalog.server.ts",
  ];
  const fixedKoreanApp = /STUDENT_APP_IDS\.korean|,\s*"korean"\s*\)|\/apps\/korean["`]/;
  for (const path of [...pages, ...services]) {
    assert.doesNotMatch(read(path), fixedKoreanApp, path);
  }
  for (const path of pages) {
    assert.match(read(path), /studentAppSlug=\{LEGACY_DASHBOARD_APP_SLUG\}/, path);
  }
  assert.match(read("src/app/dashboard/legacy-redirect.ts"), /export const LEGACY_DASHBOARD_APP_SLUG = "korean" as const;/);
});

test("2E：会话练习学生页按传入的应用拼路径和查询场景", () => {
  const pages = [
    "src/app/dashboard/conversation-practice/page-content.tsx",
    "src/app/dashboard/conversation-practice/course/page-content.tsx",
    "src/app/dashboard/conversation-practice/[scenarioId]/page-content.tsx",
    "src/app/dashboard/conversation-practice/ai-experience/page-content.tsx",
    "src/app/dashboard/conversation-practice/ai-experience/practice/page-content.tsx",
    "src/app/dashboard/conversation-practice/ai-experience/quick/page-content.tsx",
  ];
  for (const path of pages) {
    const source = read(path);
    assert.doesNotMatch(source, /STUDENT_APP_IDS\.korean|,\s*"korean"\s*[,)]/, path);
    assert.match(source, /getConversationPracticeBasePath\(tenant\?\.slug \?\? null, studentAppSlug\)/, path);
    assert.match(source, /studentAppSlug=\{LEGACY_DASHBOARD_APP_SLUG\}/, path);
  }
  const lib = read("src/lib/conversation-practice.ts");
  assert.doesNotMatch(lib, /"korean"/);
  assert.match(lib, /appSlug: StudentAppSlug/);
});
