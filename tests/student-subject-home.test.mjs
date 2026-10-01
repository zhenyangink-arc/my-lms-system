import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getLessonDisplayTitle,
  getTaskTiming,
} from "../src/features/student-home-learning/presentation.ts";
import {
  getSubjectManifest,
  isStudentHomeBlockEnabled,
} from "../src/features/subjects/registry.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("学科首页区块由清单声明，没有学科清单的应用不启用", () => {
  assert.deepEqual(getSubjectManifest("english").student.homeBlocks, [
    "today-tasks",
    "continue-learning",
    "ability-portrait",
  ]);
  assert.deepEqual(getSubjectManifest("math").student.homeBlocks, []);
  assert.equal(isStudentHomeBlockEnabled("korean", "ability-portrait"), true);
  assert.equal(isStudentHomeBlockEnabled("math", "today-tasks"), false);
  assert.equal(isStudentHomeBlockEnabled("study-abroad", "today-tasks"), false);
  assert.equal(isStudentHomeBlockEnabled("university", "today-tasks"), true);
  assert.equal(isStudentHomeBlockEnabled("university", "ability-portrait"), false);
});

test("英语首页使用平台首页框架，数学课程接入前仍显示建设中", async () => {
  const [english, math] = await Promise.all([
    source("src/app/[space]/apps/english/page.tsx"),
    source("src/app/[space]/apps/math/page.tsx"),
  ]);
  assert.match(english, /<StudentSubjectHome space=\{space\} appSlug="english" \/>/);
  assert.match(math, /StudentApplicationHome/);
});

test("首页框架按清单顺序渲染区块，未启用的区块不读取数据", async () => {
  const [home, loader] = await Promise.all([
    source("src/app/dashboard/StudentSubjectHome.tsx"),
    source("src/features/student-subject-home/api/load-home-blocks.ts"),
  ]);
  assert.match(home, /getSubjectManifest\(appSlug\)\?\.student\.homeBlocks/);
  assert.match(home, /blocks\.map\(\(block\) =>/);
  assert.match(home, /loadStudentHomeBlocks\(\{[\s\S]*?blocks,/);
  assert.match(loader, /if \(!enabled\) return \{ value: fallback, failed: false \}/);
  assert.match(loader, /loadBlock<HomeLearningTask\[\]>\(blocks\.includes\("today-tasks"\)/);
  assert.match(loader, /loadBlock<StudentCurrentCourse \| null>\(blocks\.includes\("continue-learning"\)/);
  assert.match(loader, /loadBlock<AbilityPortraitData \| null>\(blocks\.includes\("ability-portrait"\)/);
  // 链接与数据都按当前学科取，不固定任何学科。
  assert.match(home, /getCourseLearningPath\(space, null, appSlug\)/);
  assert.doesNotMatch(home, /korean|韩语/);
  // 局部失败不触发开发错误层。
  assert.doesNotMatch(home, /console\.error/);
});

test("能力画像的数据来源由调用方传入，并跟随学生端主题", async () => {
  const portrait = await source(
    "src/features/student-ability-portrait/components/AbilityPortrait.tsx",
  );
  assert.match(portrait, /数据来源：<span[^>]*>\{sourceLabel\}<\/span>/);
  assert.doesNotMatch(portrait, /韩语学习/);
  assert.match(portrait, /className="app-card relative h-full/);
  assert.doesNotMatch(portrait, /bg-white|text-slate-|ring-slate-/);
});

test("任务时间与课时标题格式", () => {
  const base = { dueAt: null, progressPercent: null, startsAt: null, status: "available" };
  assert.equal(getTaskTiming({ ...base, progressPercent: 42.4 }), "已完成 42%");
  assert.equal(getTaskTiming(base), "现在可以开始");
  assert.equal(getTaskTiming({ ...base, status: "in_progress" }), "可以继续完成");
  assert.match(getTaskTiming({ ...base, dueAt: "2026-10-01T10:00:00.000Z" }), /10\/1 19:00 截止/);
  assert.equal(getLessonDisplayTitle("第 3 课：自我介绍"), "自我介绍");
  assert.equal(getLessonDisplayTitle("Unit 1"), "Unit 1");
});

test("门户公告链接指向第一个提供公告栏目的已开放学科应用", async () => {
  const portal = await source("src/app/[space]/page.tsx");
  assert.match(portal, /summaryApps\.find\(\s*\(app\) => isStudentNavItemEnabled\(app\.slug, "announcements"\)/);
  assert.match(portal, /getStudentAppPath\(space, announcementApp\.slug, "\/announcements"\)/);
});

test("资料库“语言学习”分类名随学科显示，韩语沿用原名称", async () => {
  assert.equal(getSubjectManifest("english").student.libraryLanguageCategoryLabel, "英语学习");
  assert.equal(getSubjectManifest("korean").student.libraryLanguageCategoryLabel, undefined);
  const [page, browser, config] = await Promise.all([
    source("src/app/dashboard/library/page-content.tsx"),
    source("src/app/dashboard/library/LibraryBrowser.tsx"),
    source("src/app/dashboard/library/config.ts"),
  ]);
  assert.match(config, /language:"韩语学习"/);
  assert.match(page, /\{ \.\.\.LIBRARY_CATEGORY_LABELS, language: languageCategoryLabel \}/);
  assert.match(browser, /categoryLabels = LIBRARY_CATEGORY_LABELS/);
  assert.doesNotMatch(browser, /LIBRARY_CATEGORY_LABELS\[/);
});
