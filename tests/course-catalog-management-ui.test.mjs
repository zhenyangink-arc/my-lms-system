import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("课程目录使用收敛后的层级列与紧凑操作", async () => {
  const columns = await readFile(
    new URL("src/features/courses/components/course-catalog-tree/columns.tsx", root),
    "utf8",
  );
  const table = await readFile(
    new URL("src/features/courses/components/course-catalog-tree/index.tsx", root),
    "utf8",
  );

  assert.match(columns, /sortableHeader\("目录结构"\)/);
  assert.match(columns, /sortableHeader\("结构情况"\)/);
  assert.match(columns, /sortableHeader\("上架与开放"\)/);
  assert.doesNotMatch(columns, /sortableHeader\("所属上级"\)/);
  assert.doesNotMatch(columns, /sortableHeader\("开放方式"\)/);
  assert.match(columns, />\s*查看结构\s*</);
  assert.match(table, /min-w-\[860px\]/);
});

test("课程编辑弹窗只维护基础信息和开放规则", async () => {
  const dialogs = await readFile(
    new URL("src/features/courses/components/course-catalog-action-dialogs.tsx", root),
    "utf8",
  );

  assert.match(dialogs, /sm:max-w-\[1100px\]/);
  assert.match(dialogs, /grid-rows-\[auto_minmax\(0,1fr\)\]/);
  assert.match(dialogs, /role="tablist"/);
  assert.match(dialogs, /基本信息/);
  assert.match(dialogs, /开放规则/);
  assert.match(dialogs, /hidden=\{activeSection !== "basic"\}/);
  assert.doesNotMatch(dialogs, /key: "content", label: "课时内容"/);
  assert.match(dialogs, /具体教学内容请前往教材制作/);
  assert.match(dialogs, /chapter: "新建章节"/);
});

test("课程结构与教材制作具有明确命名和双向入口", async () => {
  const workspace = await readFile(
    new URL("src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx", root),
    "utf8",
  );
  const courseListing = await readFile(
    new URL("src/features/courses/components/course-catalog-listing.tsx", root),
    "utf8",
  );
  const textbookListing = await readFile(
    new URL("src/features/digital-textbook/components/textbook-studio.tsx", root),
    "utf8",
  );

  assert.match(workspace, /title: "课程结构"/);
  assert.match(workspace, /title: "教材制作"/);
  assert.match(courseListing, /进入教材制作/);
  assert.match(textbookListing, /查看本章课程结构/);
  assert.match(textbookListing, /encodeURIComponent\(selected.chapterId\)/);
});

test("教材制作工作区保留三级状态数据并区分内容、发布与设置", async () => {
  const listing = await readFile(
    new URL("src/features/digital-textbook/components/digital-textbook-listing.tsx", root),
    "utf8",
  );
  const studio = await readFile(
    new URL("src/features/digital-textbook/components/textbook-studio.tsx", root),
    "utf8",
  );

  assert.match(listing, /textbookStatus: textbook.status/);
  assert.match(listing, /versionStatus: chapter.versionStatus/);
  assert.match(listing, /chapterStatus: chapter.status/);
  assert.match(listing, /node.items.length \+ \(node.cards\?\.length \?\? 0\)/);
  assert.match(studio, /selected.vocabularyCount/);
  assert.match(studio, /selected.grammarCount/);
  assert.match(studio, /内容制作/);
  assert.match(studio, /检查与发布/);
  assert.match(studio, /教材设置/);
  assert.match(studio, /不更新新教材快照/);
  assert.match(studio, /canPublishChapter=\{canPublish\}/);
  assert.match(studio, /canManage=\{canManage\} canPublishChapter=\{false\} settingsOnly/);
});
