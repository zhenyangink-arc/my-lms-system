import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createChapterPracticeSourceDigest,
  didChapterPracticeSourcesChange,
} from "../src/features/chapter-practice/api/source-change.ts";

const root = new URL("../", import.meta.url);

test("来源摘要忽略对象键顺序并能识别教材内容变化", () => {
  const original = {
    chapter: { title: "第一课", goal: "掌握问候" },
    nodes: [{ content: { vocabulary: [{ ko: "안녕하세요", zh: "你好" }] } }],
  };
  const reordered = {
    nodes: [{ content: { vocabulary: [{ zh: "你好", ko: "안녕하세요" }] } }],
    chapter: { goal: "掌握问候", title: "第一课" },
  };
  const changed = {
    ...original,
    nodes: [{ content: { vocabulary: [{ ko: "감사합니다", zh: "谢谢" }] } }],
  };

  assert.equal(
    createChapterPracticeSourceDigest(original),
    createChapterPracticeSourceDigest(reordered),
  );
  assert.notEqual(
    createChapterPracticeSourceDigest(original),
    createChapterPracticeSourceDigest(changed),
  );
});

test("有摘要的已发布版本只在内容摘要变化时标记需更新", () => {
  const currentContentDigest = createChapterPracticeSourceDigest({ title: "第一课" });

  assert.equal(
    didChapterPracticeSourcesChange({
      previousSnapshot: { contentDigest: currentContentDigest },
      currentContentDigest,
      currentSourceUpdatedAts: ["2026-08-19T10:00:00.000Z"],
    }),
    false,
  );
  assert.equal(
    didChapterPracticeSourcesChange({
      previousSnapshot: { contentDigest: "older-digest" },
      currentContentDigest,
      currentSourceUpdatedAts: [],
    }),
    true,
  );
});

test("历史版本无摘要时按生成时间与内容子项更新时间降级判断", () => {
  assert.equal(
    didChapterPracticeSourcesChange({
      previousSnapshot: { generatedAt: "2026-08-19T09:00:00.000Z" },
      currentContentDigest: "unused",
      currentSourceUpdatedAts: ["2026-08-19T08:00:00.000Z"],
    }),
    false,
  );
  assert.equal(
    didChapterPracticeSourcesChange({
      previousSnapshot: { generatedAt: "2026-08-19T09:00:00.000Z" },
      currentContentDigest: "unused",
      currentSourceUpdatedAts: ["2026-08-19T09:01:00.000Z"],
    }),
    true,
  );
});

test("同步服务复用草稿生成逻辑且对已发布版本只更新 status", async () => {
  const service = await readFile(
    new URL("src/features/chapter-practice/api/management-service.ts", root),
    "utf8",
  );

  assert.match(
    service,
    /if \(units\.length === 0\)[\s\S]*createDraftVersion\(/,
  );
  assert.match(
    service,
    /\.update\(\{ status: "needs_update" \}\)[\s\S]*\.eq\("status", "published"\)/,
  );
  assert.doesNotMatch(
    service.match(/async function markPublishedUnitNeedsUpdate[\s\S]*?return "marked" as const;/)?.[0] ?? "",
    /chapter_practice_blocks|content_payload|title\s*:/,
  );
});
