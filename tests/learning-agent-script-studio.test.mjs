import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("节点式教学脚本具备草稿、发布、作答记录与第一章课前导航种子", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202608260006_learning_agent_script_studio.sql", root),
    "utf8",
  );
  for (const table of [
    "learning_agent_script_versions",
    "learning_agent_script_nodes",
    "learning_agent_node_attempts",
    "learning_agent_publish_logs",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /create_learning_agent_script_draft/);
  assert.match(migration, /publish_learning_agent_script_version/);
  assert.match(migration, /move_learning_agent_script_node/);
  assert.match(migration, /'welcome', 'opening'/);
  assert.match(migration, /'check-understanding', 'question'/);
  assert.match(migration, /activity\.activity_key = 'orientation-check'/);
  assert.match(migration, /'ready-for-practice', 'summary'/);
  assert.match(migration, /'answer'/);
});

test("平台负责人脚本工作台支持定位、编辑、排序和发布", async () => {
  const service = await readFile(
    new URL("src/features/learning-agent-script-studio/service.ts", root),
    "utf8",
  );
  const studio = await readFile(
    new URL("src/features/learning-agent-script-studio/TeachingScriptStudio.tsx", root),
    "utf8",
  );
  const actions = await readFile(
    new URL("src/app/dashboard/admin/teaching-scripts/actions.ts", root),
    "utf8",
  );
  const editor = await readFile(
    new URL("src/features/learning-agent-script-studio/TeachingScriptNodeForm.tsx", root),
    "utf8",
  );
  assert.match(service, /requirePlatformOwner\(\)/);
  assert.match(service, /learning_agent_script_versions/);
  assert.match(service, /learning_agent_script_nodes/);
  assert.match(service, /left\.order - right\.order/);
  assert.doesNotMatch(service, /left\.chapterNumber - right\.chapterNumber \|\| left\.code\.localeCompare/);
  assert.match(studio, /教材位置/);
  assert.match(studio, /教学流程/);
  assert.match(studio, /节点编辑/);
  assert.match(studio, /setEditorOpen\(true\)/);
  assert.match(studio, /aria-modal="true"/);
  assert.match(studio, /max-w-\[1400px\]/);
  assert.match(studio, /编辑已发布版本/);
  assert.match(studio, /继续编辑草稿/);
  assert.match(studio, /useFormStatus/);
  assert.match(studio, /校验并发布/);
  assert.match(actions, /createTeachingScriptDraftAction/);
  assert.match(actions, /saveTeachingScriptNodeAction/);
  assert.match(actions, /moveTeachingScriptNodeAction/);
  assert.match(actions, /publishTeachingScriptAction/);
  assert.match(editor, /上方：当前教学展示/);
  assert.match(editor, /下方：UPLY 韩语老师讲解/);
  assert.match(editor, /display_items_zh/);
  assert.match(editor, /student_task_target_key/);
  assert.match(editor, /完整听完指定表达音频/);
  assert.match(editor, /保存到草稿/);
  assert.match(editor, /老师讲解指向/);
  assert.match(editor, /visual_cue_target_key/);
  assert.match(editor, /暖黄色轻柔闪动/);
  assert.match(editor, /visual_cue_duration_ms/);
  assert.match(editor, /单次时长/);
  assert.match(editor, /学生互动/);
  assert.match(editor, /interaction_options/);
  assert.match(editor, /答对后的老师反馈/);
  assert.match(actions, /learning_agent_node_interaction_secrets/);
});

test("学生教学区逐节点讲解并用真实活动答案完成理解检查", async () => {
  const route = await readFile(
    new URL("src/app/api/learning-agent/respond/route.ts", root),
    "utf8",
  );
  const shell = await readFile(
    new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root),
    "utf8",
  );
  assert.match(route, /const scriptVersionId = currentPublishedScript\?\.id \?\? existingSession\?\.script_version_id/);
  assert.match(route, /const sessionStatus = scriptNodes\.length === 0/);
  assert.doesNotMatch(route, /status: input\.intent === "ready" && completionPercent === 100 \? "completed" : "active"/);
  const explicitSessionLookup = route.slice(
    route.indexOf("if (input.sessionId)"),
    route.indexOf("} else {", route.indexOf("if (input.sessionId)")),
  );
  assert.doesNotMatch(explicitSessionLookup, /\.eq\("status", "active"\)/);
  assert.match(route, /input\.intent !== "hint"/);
  assert.match(route, /input\.intent !== "example"/);
  assert.match(route, /learning_agent_script_versions/);
  assert.match(route, /learning_agent_script_nodes/);
  assert.match(route, /digital_textbook_activity_secrets/);
  assert.match(route, /learning_agent_node_attempts/);
  assert.match(route, /X-Learning-Agent-Question-Options/);
  assert.match(route, /X-Learning-Agent-Awaiting-Answer/);
  assert.match(route, /X-Learning-Agent-Answer-Correct/);
  assert.match(route, /X-Learning-Agent-Display/);
  assert.match(route, /X-Learning-Agent-Task-Completed/);
  assert.match(route, /X-Learning-Agent-Visual-Cue/);
  assert.match(route, /X-Learning-Agent-Interaction/);
  assert.match(route, /learning_agent_node_interaction_secrets/);
  assert.match(route, /plainTextStream\(scriptedContent\)/);
  assert.match(shell, /tutorQuestionOptions\.map/);
  assert.match(shell, /tutorReply\("answer", option\)/);
  assert.match(shell, /请先选择回答/);
  assert.match(shell, /本节讲解已完成/);
  assert.match(shell, /tutorDisplay/);
  assert.match(shell, /当前教学展示/);
  assert.match(shell, /去学习区听音频/);
  assert.match(shell, /recordTutorLearningEvent/);
  assert.match(shell, /data-learning-target="scene:image"/);
  assert.match(shell, /runTutorVisualCue/);
  assert.match(shell, /现在轮到你回答/);
  assert.match(shell, /tutorInteraction/);
  assert.match(shell, /data-learning-agent-answer-overlay/);
  assert.match(shell, /showTutorAnswerDialog/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /setTutorStatus\("idle"\);\s+setTutorAwaitingAnswer\(nextTutorAwaitingAnswer\)/);
});

test("教学节点互动答案保存在私有表并只写入第一章草稿", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202608270003_learning_agent_node_interactions.sql", root),
    "utf8",
  );
  assert.match(migration, /create table if not exists public\.learning_agent_node_interaction_secrets/);
  assert.match(migration, /revoke all on table public\.learning_agent_node_interaction_secrets from public, anon, authenticated/);
  assert.match(migration, /script_version\.status = 'draft'/);
  assert.match(migration, /node\.node_key = 'observe-scene'/);
  assert.match(migration, /'kind', 'single_choice'/);
  assert.match(migration, /correct_option_index/);
});

test("第一章观察情景先完成讲解和示范，再进入学生回答", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202608280001_defer_chapter_one_orientation_answer.sql", root),
    "utf8",
  );
  assert.match(migration, /node\.node_key = 'observe-scene'/);
  assert.match(migration, /configuration = coalesce\(node\.configuration, '\{\}'::jsonb\) - 'interaction'/);
  assert.match(migration, /通常要先用一句礼貌的问候建立交流。/);
  assert.doesNotMatch(migration, /那第一次见面要说什么啊/);
  assert.match(migration, /version\.status = 'published'/);
});

test("第一章课前导航的每个节点都有同步教学展示", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202608260007_chapter_one_orientation_teaching_displays.sql", root),
    "utf8",
  );
  for (const nodeKey of [
    "welcome",
    "observe-scene",
    "explain-order",
    "model-dialogue",
    "check-understanding",
    "lesson-mission",
    "ready-for-practice",
  ]) {
    assert.match(migration, new RegExp(`'${nodeKey}'`));
  }
  assert.match(migration, /jsonb_build_object\('display', displays\.display\)/);
});

test("教学区能以数据库事件确认学生完整听完右侧指定表达", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202608260008_learning_agent_student_task_events.sql", root),
    "utf8",
  );
  const eventRoute = await readFile(
    new URL("src/app/api/learning-agent/events/route.ts", root),
    "utf8",
  );
  assert.match(migration, /create table public\.learning_agent_task_events/);
  assert.match(migration, /dialogue:greeting:0/);
  assert.match(migration, /audio_completed/);
  assert.match(eventRoute, /learning_agent_task_events/);
  assert.match(eventRoute, /current_node_id/);
  assert.match(eventRoute, /该操作不是当前老师布置的学习任务/);
});
