import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

import { getSubjectManifest, isSubjectSectionEnabled } from "../src/features/subjects/registry.ts";
import { STUDENT_APPS } from "../src/lib/student-apps.ts";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const filesUnder = (dir) =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? filesUnder(path) : [path];
  });

test("大学课程清单：只开放骨架（学生与教学分配、课程结构、应用设置），不含巩固 / 专项训练 / 会话练习 / 结课资格", () => {
  const manifest = getSubjectManifest("university");
  assert.equal(manifest.slug, "university");
  assert.deepEqual(manifest.management.sections, ["students", "content", "settings"]);
  const navKeys = manifest.student.navigation.flatMap((group) => group.items);
  assert.deepEqual(navKeys, ["home", "courses", "assignments", "grades", "records", "library", "announcements", "help"]);
  for (const pending of ["practice", "conversation"]) assert.ok(!navKeys.includes(pending), pending);
  assert.equal(manifest.student.catalogOpensAllCategories, true);
  assert.deepEqual(manifest.student.homeBlocks, ["today-tasks", "continue-learning"]);
  assert.equal(isSubjectSectionEnabled("university", "completion-review"), false);
  assert.equal(isSubjectSectionEnabled("university", "assessments"), false);
});

test("应用仍是“即将上线”的学习类应用：本步骤不对学生开放", () => {
  const app = STUDENT_APPS.find((item) => item.slug === "university");
  assert.equal(app.kind, "learning");
  assert.equal(app.status, "coming_soon");
});

test("大学课程路由：每个都传入 university，不引用其他应用；课程一级分类只放行 university", () => {
  const files = filesUnder("src/app/[space]/apps/university");
  assert.ok(files.length >= 20, `路由文件数 ${files.length}`);
  for (const path of files) {
    const text = read(path);
    assert.doesNotMatch(text, /english|korean|math\b/i, path);
  }
  const layout = read("src/app/[space]/apps/university/courses/[categorySlug]/layout.tsx");
  assert.match(layout, /categorySlug !== "university"/);
  assert.match(read("src/app/[space]/apps/university/page.tsx"), /StudentSubjectHome space=\{space\} appSlug="university"/);
});

test("清单中的每个学生导航项都有对应的应用路由", () => {
  const routeByKey = {
    home: "page.tsx",
    courses: "courses/page.tsx",
    assignments: "assignments/page.tsx",
    grades: "grades/page.tsx",
    records: "records/page.tsx",
    library: "library/page.tsx",
    announcements: "announcements/page.tsx",
    help: "help/page.tsx",
  };
  const files = new Set(filesUnder("src/app/[space]/apps/university").map((path) => relative("src/app/[space]/apps/university", path)));
  for (const item of getSubjectManifest("university").student.navigation.flatMap((group) => group.items)) {
    assert.ok(files.has(routeByKey[item]), item);
  }
});

test("大学课程内容结构：二级分类统称“专业与公共课”，其他学科沿用“课程分类”", () => {
  assert.equal(getSubjectManifest("university").student.catalogSubcategoryLabel, "专业与公共课");
  for (const slug of ["korean", "english", "math"]) {
    assert.equal(getSubjectManifest(slug).student.catalogSubcategoryLabel, undefined, slug);
  }
  const categoryRoute = read("src/app/[space]/apps/university/courses/[categorySlug]/page.tsx");
  assert.match(categoryRoute, /subcategoryLabel=\{getSubjectManifest\("university"\)/);
  // 共用页面：未传标签时保持原文案（韩语等不受影响）
  const shared = read("src/app/dashboard/courses/[categorySlug]/page-content.tsx");
  assert.match(shared, /subcategoryLabel \?\? "课程分类"/);
  assert.match(shared, /申请、签证、面试等不同课程模块/);
});

test("专业可见范围：模式解析、关联专业整理与范围过滤", async () => {
  const mod = await import("../src/features/subjects/university/major-access.ts");
  assert.equal(mod.parseCategoryAccessMode("shared"), "shared");
  assert.equal(mod.parseCategoryAccessMode("x"), null);
  assert.equal(mod.parseCategoryAccessMode(undefined), null);
  const a = "20000000-0000-4000-8000-0000000000d1";
  const b = "20000000-0000-4000-8000-0000000000d2";
  assert.deepEqual(mod.normalizeMajorIds("shared", [a, a, "bad", b, 7]), [a, b]);
  assert.deepEqual(mod.normalizeMajorIds("public", [a]), []);
  assert.deepEqual(mod.normalizeMajorIds("major", [a]), []);
  const cats = [{ id: a }, { id: b }];
  assert.deepEqual(mod.filterVisibleCategories({ restricted: false, categoryIds: new Set() }, cats), cats);
  assert.deepEqual(mod.filterVisibleCategories({ restricted: true, categoryIds: new Set([b]) }, cats), [{ id: b }]);
  assert.deepEqual(mod.filterVisibleCategories({ restricted: true, categoryIds: new Set() }, cats), []);
  assert.equal(mod.isCategoryVisible({ restricted: true, categoryIds: new Set([a]) }, b), false);
  assert.equal(mod.isCategoryVisible({ restricted: false, categoryIds: new Set() }, b), true);
});

test("专业可见范围：学生端目录与专业页按范围过滤，专业路由层拦截，读取失败不放行", () => {
  const catalog = read("src/app/[space]/apps/university/courses/page.tsx");
  assert.match(catalog, /visibleSubcategoryIds=\{scope\.restricted \? scope\.categoryIds : undefined\}/);
  const category = read("src/app/[space]/apps/university/courses/[categorySlug]/page.tsx");
  assert.match(category, /visibleSubcategoryIds=\{scope\.restricted \? scope\.categoryIds : undefined\}/);
  const guard = read("src/app/[space]/apps/university/courses/[categorySlug]/[subcategorySlug]/layout.tsx");
  assert.match(guard, /scope\.restricted/);
  assert.match(guard, /data\.some\(\(row\) => !scope\.categoryIds\.has\(row\.id\)\)\) notFound\(\)/);
  const loader = read("src/features/subjects/university/major-scope.server.ts");
  assert.match(loader, /if \(error\) throw/);
  assert.match(loader, /university_category_scope/);
  // 共用页面：不传范围时不过滤（韩语等不受影响）
  for (const path of ["src/app/dashboard/courses/page-content.tsx", "src/app/dashboard/courses/[categorySlug]/page-content.tsx"]) {
    assert.match(read(path), /!visibleSubcategoryIds \|\| visibleSubcategoryIds\.has\(subcategory\.id\)/, path);
  }
});

test("专业管理：插槽只对大学课程注册，写入只经数据库函数且校验权限", () => {
  const slot = read("src/features/subjects/university/admin-slot.tsx");
  assert.match(slot, /students: MajorEnrollmentPanel/);
  assert.match(slot, /content: CategoryAccessPanel/);
  const actions = read("src/features/subjects/university/admin/actions.ts");
  assert.match(actions, /rpc\("set_student_major_enrollment"/);
  assert.match(actions, /rpc\("set_university_category_access"/);
  assert.match(actions, /capabilities\.manageStudents/);
  assert.match(actions, /access\.scope !== "platform"/);
  assert.doesNotMatch(actions, /\.from\("(student_major_enrollments|university_category_access|university_category_major_links)"\)\s*\.(insert|update|delete|upsert)/);
  for (const route of ["students", "content"]) {
    assert.match(read(`src/app/[space]/dashboard/admin/apps/[appSlug]/${route}/page.tsx`), new RegExp(`renderSubjectSectionExtras\\(appSlug, "${route}"`));
  }
});

test("资料库：大学课程按专业范围收窄课程集合，不传范围时行为不变", () => {
  const route = read("src/app/[space]/apps/university/library/page.tsx");
  assert.match(route, /visibleCategoryIds=\{scope\.restricted \? scope\.categoryIds : undefined\}/);
  const page = read("src/app/dashboard/library/page-content.tsx");
  assert.match(page, /if \(visibleCategoryIds\) \{/);
  assert.match(page, /\.in\("category_id", \[\.\.\.visibleCategoryIds\]\)/);
  assert.match(page, /resourcesQuery\.in\("course_id", courseIds\)/);
});

test("管理端课程结构：大学课程二级分类叫“专业或公共课组”，不设置标签的学科文案不变", () => {
  assert.equal(getSubjectManifest("university").management.subcategoryLabel, "专业或公共课组");
  for (const slug of ["korean", "english", "math"]) {
    assert.equal(getSubjectManifest(slug).management.subcategoryLabel, undefined, slug);
  }
  const route = read("src/app/[space]/dashboard/admin/apps/[appSlug]/content/page.tsx");
  assert.match(route, /subcategoryLabel=\{getSubjectManifest\(appSlug\)\?\.management\.subcategoryLabel\}/);
  // 共用组件：没有标签时回落到原文案
  assert.match(read("src/features/courses/components/course-catalog-create-target.ts"), /options\.subcategoryLabel \?\? "分类"/);
  assert.match(read("src/features/courses/components/course-catalog-action-dialogs.tsx"), /target\.label \?\? "分类"/);
  assert.match(read("src/features/courses/components/course-catalog-node-view.tsx"), /NODE_LABELS\[kind\]/);
  assert.match(read("src/features/courses/components/course-catalog-listing.tsx"), /subcategoryLabel : KIND_LABELS\.category/);
  // 旧的共用管理页不传标签（韩语等不受影响）
  assert.doesNotMatch(read("src/app/dashboard/admin/courses/page-content.tsx"), /subcategoryLabel/);
});
