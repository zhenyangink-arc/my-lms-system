import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202608200002_seed_korean_level_one_final_v1_draft.sql",
  import.meta.url,
);
const contractPath = new URL(
  "../docs/exams/korean-level-one-final-v1-content-contract.md",
  import.meta.url,
);

function taggedJson(source, tag, occurrence = 0) {
  const expression = new RegExp(`\\$${tag}\\$\\n([\\s\\S]*?)\\n\\$${tag}\\$::jsonb`, "g");
  const matches = [...source.matchAll(expression)];
  assert.ok(matches[occurrence], `missing ${tag} JSON block ${occurrence}`);
  return JSON.parse(matches[occurrence][1]);
}

function taggedText(source, variableName) {
  const expression = new RegExp(
    `${variableName} text := \\$text\\$([\\s\\S]*?)\\$text\\$;`,
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

function objectiveContractRows(source) {
  return source
    .split("\n")
    .filter((line) => /^\| [VGLR]\d{2} \|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

test("final migration freezes the complete 41-question, 100-point contract", async () => {
  const source = await readFile(migrationPath, "utf8");
  const seed = taggedJson(source, "seed");
  const expected = {
    vocabulary: [12, 15],
    grammar: [10, 20],
    listening: [8, 15],
    speaking: [2, 15],
    reading: [8, 20],
    writing: [1, 15],
  };

  assert.equal(seed.length, 41);
  assert.equal(new Set(seed.map((item) => item[0])).size, 41);
  assert.deepEqual(seed.map((item) => item[0]), [
    ...Array.from({ length: 12 }, (_, index) => `V${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 10 }, (_, index) => `G${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 8 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`),
    "S01",
    "S02",
    ...Array.from({ length: 8 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`),
    "W01",
  ]);
  for (const [skill, [count, points]] of Object.entries(expected)) {
    const questions = seed.filter((item) => item[1] === skill);
    assert.equal(questions.length, count, `${skill} question count`);
    assert.equal(questions.reduce((sum, item) => sum + item[2], 0), points, `${skill} points`);
  }
  assert.equal(seed.reduce((sum, item) => sum + item[2], 0), 100);
  assert.match(source, /'EX-K1-FIN-V1', 'exam'/);
  assert.match(source, /90, 60, false, true/);
  assert.match(source, /100, 41, 1, 'draft'/);
});

test("all 38 objective questions have four unique options and one answer", async () => {
  const seed = taggedJson(await readFile(migrationPath, "utf8"), "seed");
  const objective = seed.filter((item) => !["speaking", "writing"].includes(item[1]));
  assert.equal(objective.length, 38);
  for (const item of objective) {
    assert.equal(item[4].length, 4, `${item[0]} option count`);
    assert.equal(new Set(item[4]).size, 4, `${item[0]} unique options`);
    assert.equal(item[4].filter((option) => option === item[5]).length, 1, `${item[0]} answer`);
    assert.ok(item[6], `${item[0]} explanation`);
    assert.ok(item[7].length > 0, `${item[0]} source chapters`);
    assert.ok(item[8], `${item[0]} source knowledge`);
  }
});

test("all objective options, answers, sources and explanations match the frozen contract", async () => {
  const [migration, contract] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(contractPath, "utf8"),
  ]);
  const seedByCode = new Map(taggedJson(migration, "seed").map((item) => [item[0], item]));
  const rows = objectiveContractRows(contract);
  assert.equal(rows.length, 38);
  for (const cells of rows) {
    const code = cells[0];
    const item = seedByCode.get(code);
    assert.ok(item, `missing ${code}`);
    assert.equal(item[2], Number(cells[1]), `${code} points`);

    const contentCell = cells.find((cell) => cell.includes("选项："));
    assert.ok(contentCell, `${code} content cell`);
    const optionSegment = contentCell.match(/选项：(.+?)(?:；答案：|；答案组合：)/)?.[1];
    const answer = contentCell.match(/答案(?:组合)?：(.+)$/)?.[1];
    assert.ok(optionSegment && answer, `${code} options and answer`);
    const options = [...optionSegment.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    assert.deepEqual(item[4], options, `${code} options`);
    assert.equal(normalizedContractValue(item[5]), normalizedContractValue(answer), `${code} answer`);

    const sourceCell = cells.find((cell) => cell.includes("K1-"));
    assert.ok(sourceCell, `${code} source`);
    assert.deepEqual(
      item[7],
      [...sourceCell.matchAll(/K1-\d{2}/g)].map((match) => match[0]),
      `${code} source chapters`,
    );
    assert.equal(
      normalizedContractValue(item[8]),
      normalizedContractValue(sourceCell.split("／").slice(1).join("／")),
      `${code} source knowledge`,
    );
    assert.ok(
      cells.some((cell) => normalizedContractValue(cell) === normalizedContractValue(item[6])),
      `${code} explanation`,
    );
  }
});

test("listening and reading material snapshots exactly match the contract", async () => {
  const [migration, contract] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(contractPath, "utf8"),
  ]);
  for (const [variable, heading] of [
    ["v_listening_a", "### 7.1 听力材料 A"],
    ["v_listening_b", "### 7.2 听力材料 B"],
    ["v_listening_c", "### 7.3 听力材料 C"],
    ["v_reading_a", "### 9.1 阅读材料 A"],
    ["v_reading_b", "### 9.2 阅读材料 B"],
    ["v_reading_c", "### 9.3 阅读材料 C"],
  ]) {
    assert.equal(taggedText(migration, variable), contractText(contract, heading), heading);
  }
});

test("subjective rubric snapshots total 7, 8 and 15 points", async () => {
  const source = await readFile(migrationPath, "utf8");
  const expected = [7, 8, 15];
  expected.forEach((points, index) => {
    const rubric = taggedJson(source, "rubric", index);
    assert.equal(
      rubric.criteria.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
      points,
    );
    assert.equal(rubric.feedbackRequired, true);
  });
});

test("final quality gate covers every frozen release invariant", async () => {
  const source = await readFile(migrationPath, "utf8");
  assert.match(source, /paper_code like 'EX-K1-FIN-%'/);
  assert.match(source, /期末考试必须包含41题/);
  assert.match(source, /期末考试必须覆盖第1—16章/);
  assert.match(source, /期末考试前后册章节覆盖不平衡/);
  assert.match(source, /四个唯一选项、唯一答案或自动判分合同/);
  assert.match(source, /量规满分与题目分值不一致/);
  assert.match(source, /未保持 temporary 状态/);
  assert.match(source, /期末阅读题缺少材料快照/);
  assert.match(source, /cardinality\(private\.assessment_paper_release_issues\(v_paper_id\)\) <> 0/);
});
