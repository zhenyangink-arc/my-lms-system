import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("章节一键发布只向平台负责人开放并在服务端重新鉴权", async () => {
  const [service, action, cellAction] = await Promise.all([
    source("src/features/digital-textbook/api/service.ts"),
    source("src/app/dashboard/admin/digital-textbook/actions.ts"),
    source(
      "src/features/digital-textbook/components/digital-textbook-table/cell-action.tsx",
    ),
  ]);

  assert.match(
    service,
    /global_role === "platform_owner" && !auth\.tenant/,
  );
  assert.match(action, /publishTextbookChapterAction/);
  assert.match(action, /requirePlatformOwner\(\)/);
  assert.match(action, /\.rpc\(\s*"publish_digital_textbook_chapter"/);
  assert.match(cellAction, /canPublishChapter &&/);
  assert.match(cellAction, /发布章节/);
  assert.match(cellAction, /确认发布/);
});

test("章节发布 RPC 原子发布章节、测试和正式题目并拒绝其他角色", async () => {
  const [migration, permissionMigration] = await Promise.all([
    source(
      "supabase/migrations/202608180032_platform_owner_publish_textbook_chapter.sql",
    ),
    source(
      "supabase/migrations/202608180033_lock_down_textbook_chapter_publish_rpc.sql",
    ),
  ]);

  assert.match(migration, /security definer/i);
  assert.match(migration, /not private\.is_platform_owner\(\)/);
  assert.match(migration, /update public\.digital_textbook_chapters[\s\S]*status = 'published'/i);
  assert.match(migration, /update public\.chapter_tests[\s\S]*status = 'published'/i);
  assert.match(
    migration,
    /update public\.chapter_test_questions[\s\S]*status = 'published'/i,
  );
  assert.match(
    permissionMigration,
    /revoke all[\s\S]*from public, anon, service_role/i,
  );
  assert.match(
    permissionMigration,
    /grant execute[\s\S]*to authenticated/i,
  );
});

test("教材管理数据保留同一版本的全部章节", async () => {
  const service = await source("src/features/digital-textbook/api/service.ts");

  assert.match(service, /chaptersByVersionId = new Map<string, ChapterRow\[]>/);
  assert.match(
    service,
    /for \(const chapter of chaptersByVersionId\.get\(version\.id\) \?\? \[\]\)/,
  );
  assert.doesNotMatch(service, /const chapterByVersionId = new Map/);
});

test("章节发布成功后降级同步巩固状态并刷新管理端和学生端目录", async () => {
  const action = await source("src/app/dashboard/admin/digital-textbook/actions.ts");

  assert.match(
    action,
    /await synchronizeChapterPracticeAfterTextbookPublish\(normalizedChapterId\)/,
  );
  assert.match(
    action,
    /catch \(practiceError\)[\s\S]*console\.error\([\s\S]*Chapter practice synchronization/,
  );
  assert.match(
    action,
    /\/\[space\]\/dashboard\/admin\/apps\/\[appSlug\]\/practice-center/,
  );
  assert.match(action, /\/\[space\]\/apps\/korean\/practice\/course/);
  assert.match(
    action,
    /synchronizeChapterPracticeAfterTextbookPublish[\s\S]*return \{[\s\S]*ok: true/,
  );
});
