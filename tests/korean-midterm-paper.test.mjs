import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202608190023_seed_korean_level_one_midterm_v1_draft.sql",
  import.meta.url
);
const catalogPath = new URL(
  "../src/app/dashboard/admin/apps/PlatformAssessmentPaperCatalog.tsx",
  import.meta.url
);
const loaderPath = new URL(
  "../src/app/dashboard/admin/apps/ManagementApplicationAssessmentPage.tsx",
  import.meta.url
);
const contractPath = new URL(
  "../docs/exams/korean-level-one-midterm-v1-content-contract.md",
  import.meta.url
);

function taggedJson(source, tag, occurrence = 0) {
  const expression = new RegExp(`\\$${tag}\\$\\n([\\s\\S]*?)\\n\\$${tag}\\$::jsonb`, "g");
  const matches = [...source.matchAll(expression)];
  assert.ok(matches[occurrence], `missing ${tag} JSON block ${occurrence}`);
  return JSON.parse(matches[occurrence][1]);
}

function taggedText(source, variableName) {
  const expression = new RegExp(
    `${variableName} text := \\$text\\\$([\\s\\S]*?)\\\$text\\\$;`
  );
  const match = source.match(expression);
  assert.ok(match, `missing ${variableName} text snapshot`);
  return match[1];
}

function contractText(source, heading) {
  const start = source.indexOf(heading);
  assert.notEqual(start, -1, `missing contract heading ${heading}`);
  const match = source.slice(start).match(/```text\n([\s\S]*?)\n```/);
  assert.ok(match, `missing contract text below ${heading}`);
  return match[1];
}

function normalizedContractValue(value) {
  return value
    .replaceAll("`", "")
    .replaceAll("**", "")
    .replace(/[“”‘’'"。．.!！?？,，;；:：()（）\[\]{}\s]/g, "")
    .toLowerCase();
}

function contractQuestionRows(source) {
  return source
    .split("\n")
    .filter((line) => /^\| [VGLRW]\d{2} \|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

test("midterm migration freezes the 35-question contract", async () => {
  const source = await readFile(migrationPath, "utf8");
  const seed = taggedJson(source, "seed");
  const expected = {
    vocabulary: { count: 10, points: 15 },
    grammar: { count: 10, points: 20 },
    listening: { count: 5, points: 15 },
    speaking: { count: 1, points: 15 },
    reading: { count: 8, points: 20 },
    writing: { count: 1, points: 15 },
  };

  assert.equal(seed.length, 35);
  assert.equal(new Set(seed.map((item) => item[0])).size, 35);
  assert.deepEqual(seed.map((item) => item[0]), [
    ...Array.from({ length: 10 }, (_, index) => `V${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 10 }, (_, index) => `G${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 5 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`),
    "S01",
    ...Array.from({ length: 8 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`),
    "W01",
  ]);

  for (const [skill, contract] of Object.entries(expected)) {
    const questions = seed.filter((item) => item[1] === skill);
    assert.equal(questions.length, contract.count, `${skill} question count`);
    assert.equal(
      questions.reduce((sum, item) => sum + item[2], 0),
      contract.points,
      `${skill} points`
    );
  }
  assert.equal(seed.reduce((sum, item) => sum + item[2], 0), 100);

  for (const item of seed) {
    assert.ok(item[3], `${item[0]} prompt`);
    assert.ok(item[5], `${item[0]} explanation`);
    assert.ok(item[6].length > 0, `${item[0]} source chapters`);
    assert.ok(item[7], `${item[0]} source knowledge`);
    if (!["speaking", "writing"].includes(item[1])) {
      assert.ok(item[4], `${item[0]} authoritative answer`);
    }
  }

  assert.match(source, /'EX-K1-MID-V1', 'exam'/);
  assert.match(source, /100, 35, 1, 'draft'/);
  assert.match(source, /when v_item ->> 1 = 'listening' then 'temporary'/);
  assert.match(source, /resubmission_policy_configured, total_points/);
});

test("speaking and writing rubric snapshots total 15 points", async () => {
  const source = await readFile(migrationPath, "utf8");
  const speaking = taggedJson(source, "rubric", 0);
  const writing = taggedJson(source, "rubric", 1);
  assert.equal(
    speaking.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
    15
  );
  assert.equal(
    writing.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
    15
  );
});

test("all objective metadata and material snapshots agree with the frozen contract", async () => {
  const [migration, contract] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(contractPath, "utf8"),
  ]);
  const seed = taggedJson(migration, "seed");
  const seedByCode = new Map(seed.map((item) => [item[0], item]));
  const rows = contractQuestionRows(contract);

  assert.equal(rows.length, 33);
  for (const cells of rows) {
    const code = cells[0];
    const item = seedByCode.get(code);
    assert.ok(item, `missing ${code} in migration seed`);
    assert.equal(item[2], Number(cells[1]), `${code} points`);

    const answerMatch = cells
      .find((cell) => /答案(?:组合)?：/.test(cell))
      ?.match(/答案(?:组合)?：(.+)$/);
    assert.ok(answerMatch, `${code} contract answer`);
    assert.equal(
      normalizedContractValue(item[4]),
      normalizedContractValue(answerMatch[1]),
      `${code} answer`
    );

    const sourceCell = cells.find((cell) => cell.includes("K1-"));
    assert.ok(sourceCell, `${code} source`);
    assert.deepEqual(
      item[6],
      [...sourceCell.matchAll(/K1-\d{2}/g)].map((match) => match[0]),
      `${code} source chapters`
    );
    const knowledge = sourceCell.split("／").slice(1).join("／");
    assert.equal(
      normalizedContractValue(item[7]),
      normalizedContractValue(knowledge),
      `${code} source knowledge`
    );
    assert.ok(
      cells.some(
        (cell) =>
          normalizedContractValue(cell) === normalizedContractValue(item[5])
      ),
      `${code} explanation`
    );
  }

  assert.equal(
    taggedText(migration, "v_listening_a"),
    contractText(contract, "### 7.1 听力材料 A")
  );
  assert.equal(
    taggedText(migration, "v_listening_b"),
    contractText(contract, "### 7.2 听力材料 B")
  );
  assert.equal(
    taggedText(migration, "v_reading_a"),
    contractText(contract, "### 9.1 阅读材料 A")
  );
  assert.equal(
    taggedText(migration, "v_reading_b"),
    contractText(contract, "### 9.2 阅读材料 B")
  );
});

test("admin catalog renders each quality issue instead of a generic failure", async () => {
  const [catalog, loader] = await Promise.all([
    readFile(catalogPath, "utf8"),
    readFile(loaderPath, "utf8"),
  ]);
  assert.match(catalog, /qualityIssues: string\[\]/);
  assert.match(catalog, /paper\.qualityIssues\.map\(\(issue\)/);
  assert.match(catalog, /未通过的质检项/);
  assert.doesNotMatch(catalog, />待完善</);
  assert.match(loader, /qualityResult\.error[\s\S]*\? null/);
  assert.match(loader, /质检结果读取失败，请刷新后重试/);
});

test("midterm quality gate reports a deliberately changed question score by code", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(
    source,
    /for v_question in[\s\S]*question\.points <> case question\.skill/
  );
  assert.match(source, /期中题 %s 分值应为 %s 分，当前为 %s 分/);
  assert.match(source, /v_question\.question_code/);
  assert.match(source, /order by question\.sort_order/);
  assert.match(source, /group by lower\(btrim\(question\.prompt\)\)/);
});
