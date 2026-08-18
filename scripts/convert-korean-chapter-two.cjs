#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const defaultSource = path.resolve(
  projectRoot,
  "../uply-vault/UPLY BOOK/韩国语1级/第02课 이거는 뭐예요.md",
);
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/202608180007_chapter_two_golden_smart_textbook.sql",
);
const sourcePath =
  process.argv.find((value) => value.endsWith(".md")) ?? defaultSource;
const checkOnly = process.argv.includes("--check");

function fail(message) {
  process.stderr.write(`chapter-two conversion failed: ${message}\n`);
  process.exit(1);
}

function section(markdown, startHeading, nextHeading) {
  const start = markdown.indexOf(startHeading);
  if (start < 0) fail(`missing section ${startHeading}`);
  const end = nextHeading
    ? markdown.indexOf(nextHeading, start + startHeading.length)
    : -1;
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function parseTable(block, headerStartsWith) {
  const lines = block.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) =>
    line.startsWith(headerStartsWith),
  );
  if (headerIndex < 0) fail(`missing table header ${headerStartsWith}`);
  const headers = lines[headerIndex]
    .split("|")
    .slice(1, -1)
    .map((value) => value.trim());
  const rows = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!line.startsWith("|")) break;
    const values = line
      .split("|")
      .slice(1, -1)
      .map((value) => value.trim().replaceAll("`", ""));
    if (values.length !== headers.length) fail(`malformed table row: ${line}`);
    rows.push(
      Object.fromEntries(headers.map((header, index) => [header, values[index]])),
    );
  }
  return rows;
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const sourceSha256 = crypto
  .createHash("sha256")
  .update(markdown)
  .digest("hex");
const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatterMatch) fail("missing YAML frontmatter");
const frontmatter = Object.fromEntries(
  frontmatterMatch[1]
    .split(/\r?\n/)
    .filter((line) => line.includes(":"))
    .map((line) => {
      const separator = line.indexOf(":");
      return [
        line.slice(0, separator).trim(),
        line.slice(separator + 1).trim(),
      ];
    }),
);

const vocabulary = parseTable(
  section(markdown, "## 4. 核心词汇母表", "## 5."),
  "| 韩语 | 中文",
);
const functionalVocabulary = ["뭐", "주세요", "하고", "아니요"];
const grammarBlock = section(markdown, "## 5. 语法内容母表", "## 6.");
const grammarCards = [
  ...grammarBlock.matchAll(/^### 5\.\d+ `([^`]+)`/gm),
].map((match) => match[1]);
const mainDialogue = parseTable(
  section(markdown, "### 6.1 主场景", "### 6.2"),
  "| 轮次 | 角色",
);
const alternateDialogue = parseTable(
  section(markdown, "### 6.2 第二场景", "### 6.3"),
  "| 轮次 | 角色",
);
const moduleCodes = [
  ...section(markdown, "### 3.0 学习地图", "### 3.1").matchAll(
    /\| \d+ \| `([^`]+)` \| `([^`]+)`/g,
  ),
].map((match) => ({ moduleCode: match[1], nodeCode: match[2] }));
const activityBlock = section(markdown, "## 9. 交互活动合同", "## 10.");
const activityHeadings = [
  ...activityBlock.matchAll(/^### 9\.\d+ `([^`]+)`$/gm),
].map((match) => match[1]);
const declaredKeys = [
  ...activityBlock.matchAll(/- `activity_key`：`([^`]+)`/g),
].map((match) => match[1]);
const activityTypes = [
  ...activityBlock.matchAll(/- `activity_type`：`([^`]+)`/g),
].map((match) => match[1]);
const feedbackCounts = activityHeadings.map((key, index) => {
  const heading = `### 9.${index + 1} \`${key}\``;
  const nextHeading =
    index + 1 < activityHeadings.length
      ? `### 9.${index + 2} \`${activityHeadings[index + 1]}\``
      : "## 10.";
  return [
    ...section(markdown, heading, nextHeading).matchAll(/- `feedback_[123]`：/g),
  ].length;
});
const images = parseTable(
  section(markdown, "### 11.1 教学图片清单", "### 11.2"),
  "| ID | 计划相对路径",
);

const converted = {
  source: sourcePath,
  sourceSha256,
  chapter: {
    title: frontmatter.title,
    number: Number(frontmatter.chapter_number),
    slug: frontmatter.chapter_slug,
    testSlug: frontmatter.chapter_test_slug,
    textbookSlug: frontmatter.textbook_slug,
    productionStatus: frontmatter.production_status,
    nativeReviewStatus: frontmatter.native_review_status,
    audioStatus: frontmatter.audio_status,
  },
  moduleCodes,
  vocabulary,
  functionalVocabulary,
  displayVocabularyCount: vocabulary.length + functionalVocabulary.length,
  grammarCards,
  dialogues: { main: mainDialogue, alternate: alternateDialogue },
  activities: activityHeadings.map((key, index) => ({
    key,
    declaredKey: declaredKeys[index],
    type: activityTypes[index],
    feedbackLayers: feedbackCounts[index],
  })),
  images,
};

const assertions = [
  [converted.chapter.number === 2, "chapter_number must be 2"],
  [converted.chapter.slug === "what-is-this", "chapter_slug must stay what-is-this"],
  [converted.chapter.testSlug === "korean-level-one-02", "chapter test slug mismatch"],
  [converted.chapter.productionStatus === "editorial_review", "production status must remain editorial_review"],
  [converted.chapter.nativeReviewStatus === "pending", "native review must remain pending"],
  [converted.chapter.audioStatus === "pending", "audio status must remain pending"],
  [moduleCodes.length === 8, `expected 8 modules, got ${moduleCodes.length}`],
  [new Set(moduleCodes.map((item) => item.moduleCode)).size === 8, "module codes must be unique"],
  [new Set(moduleCodes.map((item) => item.nodeCode)).size === 8, "node codes must be unique"],
  [vocabulary.length === 18, `expected 18 core master-table words, got ${vocabulary.length}`],
  [converted.displayVocabularyCount === 22, `expected 22 displayed source-derived vocabulary/function items, got ${converted.displayVocabularyCount}`],
  [grammarCards.length === 4, `expected 4 grammar cards, got ${grammarCards.length}`],
  [mainDialogue.length >= 6 && mainDialogue.length <= 10, `main dialogue needs 6-10 turns, got ${mainDialogue.length}`],
  [alternateDialogue.length >= 6 && alternateDialogue.length <= 10, `alternate dialogue needs 6-10 turns, got ${alternateDialogue.length}`],
  [activityHeadings.length === 12, `expected 12 activities, got ${activityHeadings.length}`],
  [new Set(activityHeadings).size === activityHeadings.length, "activity keys must be unique"],
  [activityHeadings.every((key, index) => key === declaredKeys[index]), "activity headings and declared keys differ"],
  [feedbackCounts.every((count) => count === 3), "every activity must have three feedback layers"],
  [images.length === 12, `expected 12 image bindings, got ${images.length}`],
  [images.every((image) => image["状态"] === "待制作"), "all image entities must remain 待制作"],
];
for (const [valid, message] of assertions) if (!valid) fail(message);

for (const key of ["normal_script", "slow_script", "pause_marks", "audio_object_key"]) {
  const publicLines = activityBlock
    .split(/\r?\n/)
    .filter((line) => line.includes("`public_config`"));
  if (publicLines.some((line) => line.includes(key))) {
    fail(`private field ${key} leaked into a public_config declaration`);
  }
}

if (checkOnly) {
  const migration = fs.readFileSync(migrationPath, "utf8");
  if (!migration.includes(`source_sha256: ${sourceSha256}`)) {
    fail("migration source hash does not match the current master markdown");
  }
  for (const activity of converted.activities) {
    if (!migration.includes(`\"${activity.key}\"`)) {
      fail(`migration is missing activity ${activity.key}`);
    }
  }
  for (const word of [...converted.vocabulary.map((item) => item["韩语"]), ...functionalVocabulary]) {
    if (!migration.includes(`\"ko\":\"${word}\"`)) {
      fail(`migration is missing displayed vocabulary/function item ${word}`);
    }
  }
  for (const id of [
    "chapter-02-listening-missing-item-normal",
    "chapter-02-listening-missing-item-slow",
  ]) {
    if (!migration.includes(id)) fail(`migration is missing audio binding ${id}`);
  }
  process.stdout.write(
    `PASS chapter-two conversion: ${moduleCodes.length} modules, ` +
      `${vocabulary.length} core + ${functionalVocabulary.length} source-derived function items, ` +
      `${grammarCards.length} grammar cards, ${mainDialogue.length}+${alternateDialogue.length} dialogue turns, ` +
      `${activityHeadings.length} activities, ${images.length} pending images, sha256 ${sourceSha256}\n`,
  );
} else {
  process.stdout.write(`${JSON.stringify(converted, null, 2)}\n`);
}
