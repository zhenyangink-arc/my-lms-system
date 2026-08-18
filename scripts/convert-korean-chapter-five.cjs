#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const defaultSource = path.resolve(
  projectRoot,
  "../uply-vault/UPLY BOOK/韩国语1级/第05课 주말에 친구를 만났어요.md",
);
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/202608180011_chapter_five_golden_smart_textbook.sql",
);
const sourcePath =
  process.argv.find((value) => value.endsWith(".md")) ?? defaultSource;
const checkOnly = process.argv.includes("--check");

function fail(message) {
  process.stderr.write(`chapter-five conversion failed: ${message}\n`);
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
  const headerIndex = lines.findIndex((line) => line.startsWith(headerStartsWith));
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
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  }
  return rows;
}

const markdown = fs.readFileSync(sourcePath, "utf8");
const sourceSha256 = crypto.createHash("sha256").update(markdown).digest("hex");
const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatterMatch) fail("missing YAML frontmatter");
const frontmatter = Object.fromEntries(
  frontmatterMatch[1]
    .split(/\r?\n/)
    .filter((line) => line.includes(":"))
    .map((line) => {
      const separator = line.indexOf(":");
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }),
);

const vocabulary = parseTable(
  section(markdown, "## 4. 核心词汇母表", "## 5."),
  "| 韩语 | 中文",
);
const grammarBlock = section(markdown, "## 5. 语法内容母表", "## 6.");
const grammarCards = [...grammarBlock.matchAll(/^### 5\.\d+ (.+?)｜/gm)].map(
  (match) => match[1].replaceAll("`", "").trim(),
);
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
const activityHeadings = [...activityBlock.matchAll(/^### 9\.\d+ `([^`]+)`$/gm)].map(
  (match) => match[1],
);
const declaredKeys = [...activityBlock.matchAll(/- `activity_key`：`([^`]+)`/g)].map(
  (match) => match[1],
);
const feedbackCounts = activityHeadings.map((key, index) => {
  const heading = `### 9.${index + 1} \`${key}\``;
  const nextHeading =
    index + 1 < activityHeadings.length
      ? `### 9.${index + 2} \`${activityHeadings[index + 1]}\``
      : "## 10.";
  return [...section(markdown, heading, nextHeading).matchAll(/- `feedback_[123]`：/g)].length;
});
const images = parseTable(
  section(markdown, "### 11.1 教学图片清单", "### 11.2"),
  "| ID | 计划相对路径",
);

const assertions = [
  [Number(frontmatter.chapter_number) === 5, "chapter_number must be 5"],
  [frontmatter.chapter_slug === "weekend", "chapter_slug must stay weekend"],
  [frontmatter.chapter_test_slug === "korean-level-one-05", "chapter test slug mismatch"],
  [frontmatter.textbook_slug === "korean-level-one-smart", "textbook slug mismatch"],
  [frontmatter.production_status === "editorial_review", "production status must remain editorial_review"],
  [frontmatter.native_review_status === "pending", "native review must remain pending"],
  [frontmatter.audio_status === "pending", "audio status must remain pending"],
  [moduleCodes.length === 8, `expected 8 modules, got ${moduleCodes.length}`],
  [new Set(moduleCodes.map((item) => item.moduleCode)).size === 8, "module codes must be unique"],
  [new Set(moduleCodes.map((item) => item.nodeCode)).size === 8, "node codes must be unique"],
  [vocabulary.length === 20, `expected 20 vocabulary rows, got ${vocabulary.length}`],
  [grammarCards.length === 4, `expected 4 grammar cards, got ${grammarCards.length}`],
  [mainDialogue.length === 8, `expected 8 main dialogue turns, got ${mainDialogue.length}`],
  [alternateDialogue.length === 6, `expected 6 alternate dialogue turns, got ${alternateDialogue.length}`],
  [activityHeadings.length === 12, `expected 12 activities, got ${activityHeadings.length}`],
  [new Set(activityHeadings).size === 12, "activity keys must be unique"],
  [activityHeadings.every((key, index) => key === declaredKeys[index]), "activity headings and declared keys differ"],
  [feedbackCounts.every((count) => count === 3), "every activity must have three feedback layers"],
  [images.length === 12, `expected 12 image bindings, got ${images.length}`],
  [images.every((image) => image["状态"] === "待制作"), "all images must remain 待制作"],
];
for (const [valid, message] of assertions) if (!valid) fail(message);

const publicConfigLines = activityBlock
  .split(/\r?\n/)
  .filter((line) => line.includes("`public_config`"));
for (const key of [
  "normal_script",
  "slow_script",
  "pause_marks",
  "audio_object_key",
  "correct_index",
  "correct_indices",
]) {
  if (publicConfigLines.some((line) => line.includes(key))) {
    fail(`private field ${key} leaked into a public_config declaration`);
  }
}

const converted = {
  source: sourcePath,
  sourceSha256,
  chapter: frontmatter,
  moduleCodes,
  vocabulary,
  grammarCards,
  dialogues: { main: mainDialogue, alternate: alternateDialogue },
  activities: activityHeadings,
  images,
};

if (!checkOnly) {
  process.stdout.write(`${JSON.stringify(converted, null, 2)}\n`);
  process.exit(0);
}

const migration = fs.readFileSync(migrationPath, "utf8");
if (!migration.includes(`source_sha256: ${sourceSha256}`)) {
  fail("migration source hash does not match the current master markdown");
}
for (const activityKey of activityHeadings) {
  if (!migration.includes(`\"${activityKey}\"`)) fail(`migration is missing activity ${activityKey}`);
}
for (const word of vocabulary.map((item) => item["韩语"])) {
  if (!migration.includes(`\"ko\":\"${word}\"`)) fail(`migration is missing vocabulary item ${word}`);
}
for (const id of [
  "chapter-05-listening-afternoon-normal",
  "chapter-05-listening-afternoon-slow",
]) {
  if (!migration.includes(id)) fail(`migration is missing audio binding ${id}`);
}
process.stdout.write(
  `PASS chapter-five conversion: ${moduleCodes.length} modules, ${vocabulary.length} vocabulary items, ` +
    `${grammarCards.length} grammar cards, ${mainDialogue.length}+${alternateDialogue.length} dialogue turns, ` +
    `${activityHeadings.length} activities, ${images.length} pending images, sha256 ${sourceSha256}\n`,
);

