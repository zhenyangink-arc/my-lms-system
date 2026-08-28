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
  const teacherIdentityMigration = await readFile(
    new URL("supabase/migrations/202608280002_rename_korean_agent_to_teacher_kim.sql", root),
    "utf8",
  );
  assert.match(teacherIdentityMigration, /韩语金老师/);
  assert.match(teacherIdentityMigration, /专业女性教师/);
  assert.match(teacherIdentityMigration, /김 선생님/);
  const teacherVisibilityMigration = await readFile(
    new URL("supabase/migrations/202608280003_show_teacher_kim_in_chapter_one_teaching_area.sql", root),
    "utf8",
  );
  assert.match(teacherVisibilityMigration, /\{virtualCharacter\}/);
  assert.match(teacherVisibilityMigration, /'uply-teacher'/);
  assert.match(teacherVisibilityMigration, /version\.status in \('published', 'draft'\)/);
  const teacherDisplayNameMigration = await readFile(
    new URL("supabase/migrations/202608280004_update_teacher_kim_display_name.sql", root),
    "utf8",
  );
  assert.match(teacherDisplayNameMigration, /UPLY 韩语-金老师/);
  assert.match(teacherDisplayNameMigration, /learning_agent_profiles/);
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
  const respondRoute = await readFile(
    new URL("src/app/api/learning-agent/respond/route.ts", root),
    "utf8",
  );
  const characterRoute = await readFile(
    new URL("src/app/api/learning-agent/characters/[pose]/route.ts", root),
    "utf8",
  );
  assert.match(service, /requirePlatformOwner\(\)/);
  assert.match(service, /learning_agent_script_versions/);
  assert.match(service, /learning_agent_script_nodes/);
  assert.match(service, /left\.order - right\.order/);
  assert.doesNotMatch(service, /left\.chapterNumber - right\.chapterNumber \|\| left\.code\.localeCompare/);
  assert.match(studio, /章节与学习步骤/);
  assert.match(studio, /自定义教学流程/);
  assert.match(studio, /新增小节/);
  assert.match(studio, /第 \{selectedVersion\.nodes\.findIndex/);
  assert.doesNotMatch(studio, /aria-modal="true"/);
  assert.match(studio, /编辑已发布版本/);
  assert.match(studio, /继续编辑草稿/);
  assert.match(studio, /useFormStatus/);
  assert.match(studio, /校验并发布/);
  assert.match(actions, /createTeachingScriptDraftAction/);
  assert.match(actions, /saveTeachingScriptNodeAction/);
  assert.match(actions, /moveTeachingScriptNodeAction/);
  assert.match(actions, /publishTeachingScriptAction/);
  assert.match(editor, /老师台词/);
  assert.match(editor, /增加台词/);
  assert.match(editor, /scriptLines\.map/);
  assert.match(editor, /TypewriterPreview/);
  assert.match(editor, /onFocus=\{\(\) => setPreviewScriptIndex\(index\)\}/);
  assert.doesNotMatch(editor, />上一句</);
  assert.doesNotMatch(editor, />下一句</);
  assert.match(actions, /getAll\("script_zh"\)/);
  assert.match(respondRoute, /teacherScriptSegments/);
  assert.match(respondRoute, /scriptSegmentIndex/);
  assert.match(respondRoute, /继续下一句/);
  assert.match(editor, /教学内容/);
  assert.ok(editor.indexOf('id: "script"') < editor.indexOf('id: "content"'));
  assert.match(editor, /useState<EditorSection>\("script"\)/);
  assert.doesNotMatch(editor, /展示方式/);
  assert.doesNotMatch(editor, /展示说明/);
  assert.match(editor, /互动设置/);
  assert.match(editor, /流程设置/);
  assert.match(editor, /学生端预览/);
  assert.match(editor, /display_items_zh/);
  assert.match(editor, /student_task_target_key/);
  assert.match(editor, /完整听完指定表达音频/);
  assert.match(editor, /韩语金老师/);
  assert.match(editor, /script_pose/);
  assert.match(editor, /朗读这句台词/);
  assert.match(actions, /configuration\.virtualCharacter/);
  assert.match(actions, /configuration\.scriptPerformances/);
  assert.match(respondRoute, /X-Learning-Agent-Character/);
  assert.match(respondRoute, /virtualCharacterForScriptSegment/);
  assert.match(characterRoute, /learning-agent\/characters\/uply-teacher\/v1\/greeting\.png/);
  assert.match(characterRoute, /createR2SignedObjectUrl/);
  assert.match(editor, /\/api\/learning-agent\/characters\/greeting/);
  assert.doesNotMatch(editor, /\/images\/virtual-characters/);
  assert.match(editor, /保存当前小节/);
  assert.match(editor, /老师讲解指向/);
  assert.match(editor, /visual_cue_target_key/);
  assert.match(editor, /暖黄色轻柔闪动/);
  assert.match(editor, /visual_cue_duration_ms/);
  assert.match(editor, /单次时长/);
  assert.match(editor, /轮到学生回答/);
  assert.match(editor, /interaction_options/);
  assert.match(editor, /答对后的老师反馈/);
  assert.match(actions, /learning_agent_node_interaction_secrets/);
});

test("学生教学区逐节点讲解并用真实活动答案完成理解检查", async () => {
  const [route, shell, skeleton, cleanupMigration] = await Promise.all([
    readFile(new URL("src/app/api/learning-agent/respond/route.ts", root), "utf8"),
    readFile(new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root), "utf8"),
    readFile(new URL("src/lib/smart-textbook-skeleton.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202608280005_remove_learning_agent_display_body.sql", root), "utf8"),
  ]);
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
  assert.match(shell, /data-learning-agent-blackboard/);
  assert.match(shell, /sticky top-0 z-20/);
  assert.match(skeleton, /minimumHeightPx: 300/);
  assert.doesNotMatch(shell, /tutorDisplay\?\.body|tutorDisplay\.body/);
  assert.match(cleanupMigration, /\(configuration -> 'display'\) - 'body'/);
  assert.doesNotMatch(shell, /当前教学展示/);
  assert.match(shell, /teachingAreaCharacter\.position === "left" \? teachingAreaExpanded \? "ml-\[11rem\]" : "ml-\[7\.5rem\]"/);
  assert.match(shell, /去学习区听音频/);
  assert.match(shell, /recordTutorLearningEvent/);
  assert.match(shell, /data-learning-target="scene:image"/);
  assert.match(shell, /runTutorVisualCue/);
  assert.match(shell, /现在轮到你回答/);
  assert.match(shell, /tutorInteraction/);
  assert.match(shell, /data-learning-agent-answer-overlay/);
  assert.match(shell, /showTutorAnswerDialog/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /speakTutorCharacterLine/);
  assert.match(shell, /textbook\.agent\?\.displayName\[locale\]/);
  assert.doesNotMatch(shell, /UPLY 韩语-金老师/);
  assert.match(shell, /X-Learning-Agent-Character/);
  assert.match(shell, /kim-teacher-breathe/);
  assert.match(shell, /data-smart-textbook-teaching-area/);
  assert.match(shell, /shouldUseSmartTextbookTeachingFocusMode/);
  assert.match(shell, /SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.focusMode\.revealForActivityAction/);
  assert.match(shell, /const learningAreaHidden = tutorFocusMode \|\| learningAreaManuallyHidden/);
  assert.match(shell, /SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.teachingArea\.defaultWidthPercent/);
  assert.match(shell, /data-learning-area-hidden/);
  assert.match(shell, /learningAreaHidden \? "xl:hidden"/);
  assert.match(shell, /teachingAreaExpanded \? "text-lg leading-9" : "text-sm leading-7"/);
  assert.match(shell, /setLearningAreaManuallyHidden\(true\)/);
  assert.match(shell, /setLearningAreaManuallyHidden\(false\)/);
  assert.match(shell, /隐藏学习区/);
  assert.match(shell, /显示学习区/);
  assert.doesNotMatch(shell, /互动学习区|상호작용 학습 영역/);
  assert.match(shell, /after:left-\[var\(--learning-header-inset\)\] after:right-\[var\(--learning-header-inset\)\]/);
  assert.match(shell, /learningHeaderTargets\.map/);
  assert.match(shell, /getSmartTextbookSkeletonPageLabels/);
  assert.match(shell, /learningHeaderCompletionPercent/);
  assert.doesNotMatch(shell, /targetPageCurrent|targetCompletionPercent/);
  assert.ok(shell.indexOf("data-learning-agent-blackboard") < shell.indexOf("kim-teacher-breathe"));
  assert.ok(shell.indexOf("kim-teacher-breathe") < shell.indexOf('id="korean-textbook-content"'));
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
