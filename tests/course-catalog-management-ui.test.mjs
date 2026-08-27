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
    new URL("src/features/digital-textbook/components/digital-textbook-listing.tsx", root),
    "utf8",
  );

  assert.match(workspace, /title: "课程结构"/);
  assert.match(workspace, /title: "教材制作"/);
  assert.match(courseListing, /进入教材制作/);
  assert.match(textbookListing, /返回课程结构/);
});

test("教材制作列表合并内容统计和三级发布状态", async () => {
  const columns = await readFile(
    new URL("src/features/digital-textbook/components/digital-textbook-table/columns.tsx", root),
    "utf8",
  );
  const table = await readFile(
    new URL("src/features/digital-textbook/components/digital-textbook-table/index.tsx", root),
    "utf8",
  );

  assert.match(columns, /sortableHeader\("教材位置"\)/);
  assert.match(columns, /sortableHeader\("内容概况"\)/);
  assert.match(columns, /sortableHeader\("发布状态"\)/);
  assert.match(columns, />教材<\/dt>/);
  assert.match(columns, />版本<\/dt>/);
  assert.match(columns, />本章<\/dt>/);
  assert.doesNotMatch(columns, /header: sortableHeader\("教材状态"\)/);
  assert.doesNotMatch(columns, /header: sortableHeader\("章节状态"\)/);
  assert.match(table, /min-w-\[1060px\]/);
});
