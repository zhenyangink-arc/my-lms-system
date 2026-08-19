import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { HOME_LEARNING_SOURCE_TYPES } from "../src/features/student-home-learning/api/types.ts";
import {
  getAssignmentDetailPath,
  getChapterPracticePath,
  getChapterTestDetailPath,
  getCourseLearningPath,
  getExamDetailPath,
  getGradeFeedbackPath,
  getReviewPath,
  getReviewSourcePath,
  getSpecializedPracticePath,
  getTeacherRecommendationPath,
} from "../src/features/student-home-learning/routes.ts";
import {
  getStudentAppBasePath,
  getStudentPortalPath,
} from "../src/lib/student-apps.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(projectRoot, "src", "app");
const space = "真实 学校";

async function collectPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectPageFiles(entryPath);
    return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
  }));
  return nested.flat();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pagePattern(pageFile) {
  const relativeDirectory = path.relative(appRoot, path.dirname(pageFile));
  const segments = relativeDirectory === "" ? [] : relativeDirectory.split(path.sep);
  let pattern = "^";
  const routeSegments = [];

  for (const segment of segments) {
    if ((segment.startsWith("(") && segment.endsWith(")")) || segment.startsWith("@")) {
      continue;
    }
    routeSegments.push(segment);
    if (segment.startsWith("[[...") && segment.endsWith("]]")) {
      pattern += "(?:/.*)?";
    } else if (segment.startsWith("[...") && segment.endsWith("]")) {
      pattern += "/.+";
    } else if (segment.startsWith("[") && segment.endsWith("]")) {
      pattern += "/[^/]+";
    } else {
      pattern += `/${escapeRegex(segment)}`;
    }
  }

  pattern += "/?$";
  return {
    pageFile,
    route: `/${routeSegments.join("/")}` || "/",
    regex: new RegExp(pattern),
  };
}

function valuesForMask(names, mask) {
  return Object.fromEntries(names.map((name, index) => [
    name,
    mask & (1 << index) ? `${name}-值` : null,
  ]));
}

const checks = [];
function add(sourceType, label, href) {
  checks.push({ sourceType, label, href });
}

for (const id of [null, "作业/一"]) {
  add("assignment", `作业 ${id ? "完整参数" : "缺少参数安全回退"}`, getAssignmentDetailPath(space, id));
  add("exam", `考试 ${id ? "完整参数" : "缺少参数安全回退"}`, getExamDetailPath(space, id));
}

const courseNames = ["categorySlug", "subcategorySlug", "courseSlug", "lessonSlug"];
for (let mask = 0; mask < 2 ** courseNames.length; mask += 1) {
  add("course", `课程参数组合 ${mask.toString(2).padStart(4, "0")}`, getCourseLearningPath(space, valuesForMask(courseNames, mask)));
}

const chapterNames = ["courseKey", "chapterSlug"];
for (let mask = 0; mask < 2 ** chapterNames.length; mask += 1) {
  add("chapter_practice", `章节巩固参数组合 ${mask.toString(2).padStart(2, "0")}`, getChapterPracticePath(space, valuesForMask(chapterNames, mask)));
}

const specializedNames = ["skill", "courseSlug", "lessonSlug", "chapterSlug"];
for (let mask = 0; mask < 2 ** specializedNames.length; mask += 1) {
  add("specialized_practice", `专项训练参数组合 ${mask.toString(2).padStart(4, "0")}`, getSpecializedPracticePath(space, valuesForMask(specializedNames, mask)));
}

add("review", "错题复习聚合页", getReviewPath(space));

for (let mask = 0; mask < 2 ** courseNames.length; mask += 1) {
  add("teacher_recommendation", `老师推荐课程参数组合 ${mask.toString(2).padStart(4, "0")}`, getTeacherRecommendationPath(space, {
    sourceType: "course",
    ...valuesForMask(courseNames, mask),
  }));
}
for (let mask = 0; mask < 2 ** chapterNames.length; mask += 1) {
  add("teacher_recommendation", `老师推荐章节巩固参数组合 ${mask.toString(2).padStart(2, "0")}`, getTeacherRecommendationPath(space, {
    sourceType: "chapter_practice",
    ...valuesForMask(chapterNames, mask),
  }));
}
for (let mask = 0; mask < 2 ** specializedNames.length; mask += 1) {
  add("teacher_recommendation", `老师推荐专项训练参数组合 ${mask.toString(2).padStart(4, "0")}`, getTeacherRecommendationPath(space, {
    sourceType: "specialized_practice",
    ...valuesForMask(specializedNames, mask),
  }));
}
add("teacher_recommendation", "老师推荐错题复习", getTeacherRecommendationPath(space, { sourceType: "review" }));

// 周计划当前嵌入韩国语首页，不生产独立详情路由；代表性任务安全回退到真实应用首页。
add("student_plan", "学生周计划应用首页回退", getStudentAppBasePath(space, "korean"));

const supplementalChecks = [
  { label: "门户首页", href: getStudentPortalPath(space) },
  { label: "门户到韩国语首页", href: getStudentAppBasePath(space, "korean") },
  { label: "章节测验完整参数", href: getChapterTestDetailPath(space, "chapter/one") },
  { label: "章节测验缺参回退", href: getChapterTestDetailPath(space) },
  { label: "成绩反馈完整参数", href: getGradeFeedbackPath(space, "assignment/one") },
  { label: "成绩反馈缺参回退", href: getGradeFeedbackPath(space) },
  { label: "错题来源缺参回退", href: getReviewSourcePath(space) },
  { label: "错题来源作业", href: getReviewSourcePath(space, { sourceType: "assignment", assignmentId: "assignment/one" }) },
  { label: "错题来源考试", href: getReviewSourcePath(space, { sourceType: "exam", examId: "exam/one" }) },
  { label: "错题来源章节巩固", href: getReviewSourcePath(space, { sourceType: "chapter_practice", courseKey: "course/one", chapterSlug: "chapter/one" }) },
  { label: "错题来源专项训练", href: getReviewSourcePath(space, { sourceType: "specialized_practice", skill: "听力", courseSlug: "course/one", lessonSlug: "lesson/one", chapterSlug: "chapter/one" }) },
];

const pageFiles = await collectPageFiles(appRoot);
const patterns = pageFiles.map(pagePattern);
const failures = [];
const matchedPages = new Map();

for (const check of [...checks, ...supplementalChecks]) {
  const pathname = new URL(check.href, "https://local.invalid").pathname;
  const match = patterns.find((candidate) => candidate.regex.test(pathname));
  if (!match) {
    failures.push(`${check.label}: ${check.href}`);
    continue;
  }
  matchedPages.set(check.href, match.route);
}

const coveredSourceTypes = new Set(checks.map((check) => check.sourceType));
assert.deepEqual(
  [...coveredSourceTypes].sort(),
  [...HOME_LEARNING_SOURCE_TYPES].sort(),
  "深链矩阵必须覆盖每一种 HomeLearningTask sourceType",
);

if (failures.length > 0) {
  console.error(`FAIL: ${failures.length} 条深链没有匹配真实 page.tsx`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: 扫描 ${pageFiles.length} 个真实 page.tsx`);
  console.log(`PASS: ${checks.length} 个 HomeLearningTask 来源/参数组合全部匹配叶级页面`);
  console.log(`PASS: 覆盖 sourceType = ${HOME_LEARNING_SOURCE_TYPES.join(", ")}`);
  console.log(`PASS: ${supplementalChecks.length} 条门户、反馈与来源回跳链路全部匹配叶级页面`);
  console.log("代表性最终路由：");
  for (const href of [
    getStudentAppBasePath(space, "korean"),
    getAssignmentDetailPath(space, "assignment-id"),
    getCourseLearningPath(space, valuesForMask(courseNames, 15)),
    getChapterPracticePath(space, valuesForMask(chapterNames, 3)),
    getSpecializedPracticePath(space, valuesForMask(specializedNames, 15)),
    getReviewPath(space),
  ]) {
    const pathname = new URL(href, "https://local.invalid").pathname;
    const route = patterns.find((candidate) => candidate.regex.test(pathname))?.route;
    console.log(`- ${href} -> ${route}`);
  }
}
