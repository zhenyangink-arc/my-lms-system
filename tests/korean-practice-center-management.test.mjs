import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { isPlatformOwnerRole } from "../src/lib/platform-owner-role.ts";
import { buildChapterPracticeCoverage } from "../src/features/chapter-practice/api/coverage.ts";
import { inspectChapterPracticePublication } from "../src/features/chapter-practice/api/model.ts";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function coverageSource(practiceUnits = []) {
  return {
    courses: [
      {
        id: "course-1",
        slug: "korean-one",
        title: "韩国语 1 级",
        is_published: true,
        sort_order: 1,
      },
    ],
    lessons: [
      {
        id: "lesson-1",
        course_id: "course-1",
        slug: "lesson-one",
        title: "第 1 课",
        is_published: true,
        sort_order: 1,
      },
    ],
    chapters: [
      {
        id: "chapter-1",
        lesson_id: "lesson-1",
        chapter_test_id: "test-1",
        slug: "hello",
        title: "你好？",
        is_published: true,
        sort_order: 1,
      },
    ],
    chapterTests: [{ id: "test-1", status: "published" }],
    textbooks: [
      {
        id: "textbook-1",
        lesson_id: "lesson-1",
        status: "published",
      },
    ],
    textbookVersions: [
      {
        id: "version-1",
        textbook_id: "textbook-1",
        version_number: 1,
        status: "published",
      },
    ],
    textbookChapters: [
      {
        id: "textbook-chapter-1",
        version_id: "version-1",
        chapter_test_id: "test-1",
        status: "published",
        updated_at: "2026-08-19T01:00:00.000Z",
      },
    ],
    textbookModules: [
      {
        id: "vocabulary-module",
        chapter_id: "textbook-chapter-1",
        module_code: "vocabulary",
      },
      {
        id: "grammar-module",
        chapter_id: "textbook-chapter-1",
        module_code: "grammar",
      },
    ],
    textbookNodes: [
      {
        module_id: "vocabulary-module",
        content: { vocabulary: [{ ko: "안녕하세요" }, { zh: "谢谢" }] },
      },
      {
        module_id: "grammar-module",
        content: { grammar: [{ title: "-입니다" }] },
      },
    ],
    exercises: [
      "listening",
      "speaking",
      "reading",
      "writing",
      "vocabulary",
      "grammar",
    ].map((skill) => ({
      chapter_test_id: "test-1",
      skill,
      status: "published",
    })),
    homeworkPlans: [{ test_id: "test-1", status: "published" }],
    practiceUnits,
  };
}

test("空巩固内容表会让真实课程树中的每章稳定显示未生成", () => {
  const result = buildChapterPracticeCoverage(coverageSource());

  assert.equal(result.courseCount, 1);
  assert.equal(result.lessonCount, 1);
  assert.equal(result.chapterCount, 1);
  assert.equal(result.generatedCount, 0);
  assert.equal(result.needsUpdateCount, 0);
  assert.deepEqual(result.rows[0].practice, {
    unitId: null,
    isGenerated: false,
    version: null,
    status: "not_generated",
    lastSyncedAt: null,
    needsUpdate: false,
  });
  assert.equal(result.rows[0].textbook.vocabularyCount, 2);
  assert.equal(result.rows[0].textbook.grammarCount, 1);
  assert.equal(Object.values(result.rows[0].skills).every(Boolean), true);
});

test("巩固矩阵选择最新版本并直接展示 needs_update 状态", () => {
  const result = buildChapterPracticeCoverage(
    coverageSource([
      {
        id: "unit-1",
        course_chapter_id: "chapter-1",
        version: 1,
        status: "published",
        updated_at: "2026-08-18T01:00:00.000Z",
      },
      {
        id: "unit-2",
        course_chapter_id: "chapter-1",
        version: 2,
        status: "needs_update",
        updated_at: "2026-08-19T01:00:00.000Z",
      },
    ]),
  );

  assert.equal(result.rows[0].practice.version, 2);
  assert.equal(result.rows[0].practice.status, "needs_update");
  assert.equal(result.rows[0].practice.needsUpdate, true);
});

test("矩阵行严格按课程、课时、章节的真实树顺序排列", () => {
  const input = coverageSource();
  input.courses.unshift({
    id: "course-0",
    slug: "hangul",
    title: "韩文字母",
    is_published: true,
    sort_order: 0,
  });
  input.lessons.unshift({
    id: "lesson-0",
    course_id: "course-0",
    slug: "letters",
    title: "字母课",
    is_published: true,
    sort_order: 0,
  });
  input.chapters.push({
    id: "chapter-0",
    lesson_id: "lesson-0",
    chapter_test_id: null,
    slug: "letters",
    title: "认识字母",
    is_published: true,
    sort_order: 99,
  });

  const result = buildChapterPracticeCoverage(input);

  assert.deepEqual(
    result.rows.map((row) => row.id),
    ["chapter-0", "chapter-1"],
  );
});

test("巩固中心路由与查询均复用平台负责人权限校验", () => {
  const route = source(
    "src/app/[space]/dashboard/admin/apps/[appSlug]/practice-center/page.tsx",
  );
  const service = source("src/features/chapter-practice/api/service.ts");
  const workspace = source(
    "src/app/dashboard/admin/apps/ManagementApplicationWorkspacePage.tsx",
  );

  assert.match(route, /requirePlatformOwner\(\)/);
  assert.match(service, /requirePlatformOwner\(\)/);
  assert.match(route, /context\.access\.scope !== "platform"/);
  assert.match(route, /appSlug !== "korean"/);
  assert.match(workspace, /platformOwnerOnly: true/);
  assert.equal(isPlatformOwnerRole("platform_super_admin"), true);
  for (const role of [
    "platform_course_inspector",
    "tenant_operator",
    "tenant_super_admin",
    "ceo",
    "admin",
    "teacher",
    "student",
  ]) {
    assert.equal(isPlatformOwnerRole(role), false, `${role} 不应通过访问校验`);
  }
});

test("巩固中心提供生成、编辑、预览和发布入口且状态同时使用图标和文字", () => {
  const listing = source(
    "src/features/chapter-practice/components/chapter-practice-coverage-listing.tsx",
  );
  const editor = source(
    "src/features/chapter-practice/components/chapter-practice-editor.tsx",
  );
  const actions = source("src/features/chapter-practice/actions.ts");

  assert.match(listing, /CheckCircle2/);
  assert.match(listing, /CircleAlert/);
  assert.match(listing, /未生成/);
  assert.match(listing, /ChapterPracticeGenerateButton/);
  assert.match(editor, /桌面/);
  assert.match(editor, /手机/);
  assert.match(editor, /CardTitleWithHint/);
  assert.match(actions, /generateChapterPracticeDraft/);
  assert.match(actions, /publishChapterPracticeUnit/);
});

function validInspectionInput() {
  const types = [
    "overview",
    "vocabulary",
    "grammar",
    "listening",
    "review",
    "self_check",
  ];
  return {
    hierarchyPublished: true,
    unitTitle: "认识韩文巩固",
    completionRule: {
      mode: "required_blocks",
      minimumRequiredBlocks: 5,
      requireSelfCheck: true,
      minimumAccuracyPercent: 80,
    },
    blocks: types.map((blockType, index) => ({
      id: `block-${index}`,
      blockType,
      title: blockType,
      instructions: "完成本块内容。",
      sortOrder: (index + 1) * 10,
      isRequired: blockType !== "listening",
      enabled: true,
      sourceValid: true,
      objectiveJudgementValid: true,
      referenceValid: true,
      audioStatus: blockType === "listening" ? "ready" : null,
    })),
  };
}

test("发布前检查覆盖文档 12.2 的八类条件", () => {
  const inspection = inspectChapterPracticePublication(validInspectionInput());

  assert.equal(inspection.passed, true);
  assert.deepEqual(
    inspection.checks.map((item) => item.code),
    [
      "published_hierarchy",
      "complete_copy",
      "required_blocks",
      "objective_judgement",
      "valid_sources",
      "completion_rule",
      "audio_status",
      "ordering_and_references",
    ],
  );
});

test("发布前检查会同时拦截必需块缺失、来源失效与听力音频缺失", () => {
  const input = validInspectionInput();
  input.blocks = input.blocks
    .filter((block) => block.blockType !== "grammar")
    .map((block) =>
      block.blockType === "listening"
        ? { ...block, sourceValid: false, referenceValid: false, audioStatus: "missing" }
        : block,
    );
  const inspection = inspectChapterPracticePublication(input);

  assert.equal(inspection.passed, false);
  const reasons = inspection.checks.flatMap((item) => item.reasons).join("\n");
  assert.match(reasons, /核心语法复习/);
  assert.match(reasons, /内容来源已失效/);
  assert.match(reasons, /音频状态为缺失/);
});
