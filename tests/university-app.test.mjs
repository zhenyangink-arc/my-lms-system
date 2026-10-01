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

test("大学课程内容结构：二级分类显示为“专业”，其他学科沿用“课程分类”", () => {
  assert.equal(getSubjectManifest("university").student.catalogSubcategoryLabel, "专业");
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
