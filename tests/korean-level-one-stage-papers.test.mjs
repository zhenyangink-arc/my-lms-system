import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/202608190014_seed_korean_level_one_stage_exam_drafts.sql",
  import.meta.url
);

async function migrationSource() {
  return readFile(migrationUrl, "utf8");
}

function stageSeed(source) {
  const match = source.match(/\$stage_seed\$\s*([\s\S]*?)\s*\$stage_seed\$::jsonb/);
  assert.ok(match, "stage exam JSON seed must be present");
  return JSON.parse(match[1]);
}

test("four stage exam drafts contain the planned six-skill question mix", async () => {
  const source = await migrationSource();
  const stages = stageSeed(source);
  const expectedCounts = {
    vocabulary: 12,
    grammar: 8,
    listening: 4,
    speaking: 2,
    reading: 8,
    writing: 2,
  };

  assert.equal(stages.length, 4);
  assert.deepEqual(
    stages.map((stage) => stage.code),
    ["EX-K1-ST01-V1", "EX-K1-ST02-V1", "EX-K1-ST03-V1", "EX-K1-ST04-V1"]
  );
  const stageNames = ["第一", "第二", "第三", "第四"];
  for (const stage of stages) {
    assert.ok(stage.duration >= 60 && stage.duration <= 75);
    assert.match(stage.title, new RegExp(`${stageNames[stage.stage - 1]}阶段考试`));
    for (const [skill, count] of Object.entries(expectedCounts)) {
      assert.equal(stage[skill].length, count, `${stage.code} ${skill}`);
    }
    for (const skill of ["vocabulary", "grammar", "listening", "reading"]) {
      for (const [prompt, options, answer, explanation] of stage[skill]) {
        assert.ok(prompt.length > 0);
        assert.ok(options.length >= 2);
        assert.ok(options.includes(answer));
        assert.ok(explanation.length > 0);
      }
    }
    assert.ok(stage.listeningStimulus.split("\n").length >= 6);
    assert.ok(stage.readingStimulus.length > 100);
  }
});

test("stage exam migration preserves draft governance and enforces release-ready structure", async () => {
  const source = await migrationSource();

  assert.match(source, /0, 0, 1, 'draft'/);
  assert.doesNotMatch(source, /set status = 'published'/);
  assert.match(source, /private\.assessment_paper_release_issues\(v_paper_id\)/);
  assert.match(source, /when v_skill = 'speaking' then 'audio_recording'/);
  assert.match(source, /when v_skill = 'writing' then 'long_text'/);
  assert.match(source, /when v_skill = 'listening' then 'temporary'/);
  assert.match(source, /v_sort_order <> 36/);
  for (const requirement of [
    /\('vocabulary', 12, 15::numeric\)/,
    /\('grammar', 8, 20::numeric\)/,
    /\('listening', 4, 15::numeric\)/,
    /\('speaking', 2, 15::numeric\)/,
    /\('reading', 8, 20::numeric\)/,
    /\('writing', 2, 15::numeric\)/,
  ]) {
    assert.match(source, requirement);
  }
  assert.match(source, /paper\.total_points = 100/);
  assert.match(source, /paper\.question_count = 36/);
  assert.match(source, /paper\.duration_minutes between 60 and 75/);
});
