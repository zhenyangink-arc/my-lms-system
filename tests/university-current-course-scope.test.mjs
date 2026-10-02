import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { restrictToVisibleSubcategories } from "../src/features/student-current-course/scope.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const cats = [{ id: "cs" }, { id: "law" }, { id: "se" }, { id: "general" }];

test("当前课程的二级分类：范围为 null 时原样返回（不限制的应用行为不变）", () => {
  assert.deepEqual(restrictToVisibleSubcategories(cats, null), cats);
  assert.notEqual(restrictToVisibleSubcategories(cats, null), cats); // 返回副本，不改原数组
});

test("当前课程的二级分类：只保留可见范围内的，顺序不变；没有可见分类时为空", () => {
  assert.deepEqual(restrictToVisibleSubcategories(cats, new Set(["general", "cs"])), [{ id: "cs" }, { id: "general" }]);
  assert.deepEqual(restrictToVisibleSubcategories(cats, new Set()), []);
  assert.deepEqual(restrictToVisibleSubcategories(cats, new Set(["other"])), []);
});

test("接线：当前课程读取经学科注册的解析器取可见范围，共享层不写学科判断，只有大学课程注册", () => {
  const service = read("src/features/student-current-course/api/service.ts");
  assert.match(service, /restrictToVisibleSubcategories\(\s*\(subcategoryData \?\? \[\]\) as CategoryRow\[\],\s*await loadVisibleSubcategoryIds\(appSlug\),?\s*\)/);
  assert.doesNotMatch(service, /university/);
  const registry = read("src/features/subjects/course-scope.server.ts");
  assert.match(registry, /university: loadUniversityVisibleSubcategoryIds/);
  assert.equal([...registry.matchAll(/^\s{2}(\w+): load\w+,/gm)].length, 1); // 只有大学课程注册
  assert.match(read("src/features/subjects/university/course-scope.server.ts"), /scope\.restricted \? scope\.categoryIds : null/);
  // 首页继续学习与任务（门户同路径）都经 loadStudentCurrentCourse
  assert.match(read("src/features/student-home-learning/api/course-source.ts"), /loadStudentCurrentCourse\(/);
  assert.match(read("src/features/student-subject-home/api/load-home-blocks.ts"), /loadStudentCurrentCourse\(/);
});
