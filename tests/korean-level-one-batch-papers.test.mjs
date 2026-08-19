import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("chapters two through sixteen create fifteen six-skill exam drafts", async () => {
  const migration = await source(
    "supabase/migrations/202608190008_seed_korean_chapters_two_to_sixteen_paper_drafts.sql"
  );

  assert.match(migration, /\^korean-level-one-\(0\[2-9\]\|1\[0-6\]\)\$/);
  assert.match(migration, /count\(distinct question\.language_skill\)/);
  assert.match(migration, /'vocabulary', 15::numeric/);
  assert.match(migration, /'grammar', 20::numeric/);
  assert.match(migration, /'listening', 15::numeric/);
  assert.match(migration, /'speaking', 15::numeric/);
  assert.match(migration, /'reading', 20::numeric/);
  assert.match(migration, /'writing', 15::numeric/);
  assert.match(migration, /then 'audio_recording'/);
  assert.match(migration, /then 'long_text'/);
  assert.match(migration, /then 'temporary'/);
  assert.match(migration, /then null else v_question\.correct_answer/);
  assert.match(migration, /0, 0, 1, 'draft'/);
  assert.match(migration, /paper\.total_points = 100/);
  assert.match(migration, /\) <> 15 then/);
  assert.match(migration, /不得覆盖历史试卷，请创建新版本/);
  assert.doesNotMatch(migration, /'HW-K1-' \|\| v_chapter_code/);
});

test("release quality gate reports every roadmap failure category", async () => {
  const migration = await source(
    "supabase/migrations/202608190009_batch_release_assessment_papers.sql"
  );

  for (const reason of [
    "未设置考试时长",
    "未设置及格分",
    "未设置重复提交规则",
    "存在重复题干",
    "正式章节考试总分必须等于100分",
    "单词、语法、听力、口语、阅读、写作六项不齐全",
    "客观题存在正确答案、选项或解析不完整",
    "口语和写作必须配置为人工批改",
    "听力题缺少听力文本或有效音频状态",
    "存在题干、解析、分值或能力分类未完成的题目",
  ]) {
    assert.match(migration, new RegExp(reason));
  }
  assert.match(migration, /'issues', to_jsonb\(v_issues\)/);
  assert.match(migration, /array_to_string\(v_issues, '；'\)/);
});

test("batch release is owner-only, atomic, draft-only, and status-only", async () => {
  const [migration, action, catalog] = await Promise.all([
    source(
      "supabase/migrations/202608190009_batch_release_assessment_papers.sql"
    ),
    source("src/app/dashboard/admin/assignments/paper-actions.ts"),
    source("src/app/dashboard/admin/apps/PlatformAssessmentPaperCatalog.tsx"),
  ]);

  assert.match(migration, /current_user_can_release_assessment_papers\(\)/);
  assert.match(migration, /cardinality\(p_paper_ids\) not between 1 and 100/);
  assert.match(migration, /for update of paper/);
  assert.match(migration, /if v_paper\.status <> 'draft'/);
  assert.match(migration, /private\.assessment_paper_release_issues\(v_paper\.id\)/);
  assert.match(migration, /set status = 'published', published_at = now\(\)/);
  assert.doesNotMatch(migration, /update public\.assessment_paper_questions/);
  assert.doesNotMatch(migration, /update public\.assessment_paper_question_keys/);
  assert.match(migration, /v_paper\.status <> 'draft' and p_status = 'draft'/);
  assert.match(migration, /v_source\.version \+ 1, 'draft'/);
  assert.match(migration, /skill,\s*audio_status[\s\S]*skill,\s*audio_status/);
  assert.match(
    migration,
    /before insert or update or delete on public\.assessment_paper_questions/
  );
  assert.match(
    migration,
    /before insert or update or delete on public\.assessment_paper_question_keys/
  );
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.match(action, /publishAssessmentPaperBatchAction/);
  assert.match(action, /if \(!canReleasePapers\)/);
  assert.match(action, /paperIds\.some\(\(paperId\) => !isUuid\(paperId\)\)/);
  assert.match(action, /friendlyDatabaseError\(\s*error\?\.message/);
  assert.match(catalog, /canRelease && readyDraftIds\.length > 0/);
  assert.match(catalog, /paper\.status === "draft" && paper\.qualityReady/);
  assert.match(catalog, /发布全部合格草稿/);
  assert.match(catalog, /disabled=\{batchPending\}/);
  assert.match(catalog, /aria-busy=\{batchPending\}/);
  assert.match(catalog, /role=\{batchState\.status === "error" \? "alert" : "status"\}/);
});

test("tenant readers cannot see drafts or mutate platform master papers", async () => {
  const [governance, page] = await Promise.all([
    source(
      "supabase/migrations/202608190006_platform_assessment_release_governance.sql"
    ),
    source(
      "src/app/dashboard/admin/apps/ManagementApplicationAssessmentPage.tsx"
    ),
  ]);

  assert.match(
    governance,
    /authorized staff read assessment papers[\s\S]*status = 'published'/
  );
  assert.match(
    governance,
    /old\.status <> 'draft'[\s\S]*已发布或已停止提供的试卷内容不可直接修改/
  );
  assert.match(
    governance,
    /assessment_paper_questions_lock_released[\s\S]*prevent_released_paper_question_mutation/
  );
  assert.match(
    governance,
    /assessment_paper_keys_lock_released[\s\S]*prevent_released_paper_key_mutation/
  );
  assert.match(page, /access\.scope === "tenant"/);
  assert.match(page, /paperQuery = paperQuery\.eq\("status", "published"\)/);
  assert.match(page, /access\.globalRole === "platform_owner"/);
});
