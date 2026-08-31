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
  const teacherDefaultMigration = await readFile(
    new URL("supabase/migrations/202608280007_default_teacher_kim_for_all_script_nodes.sql", root),
    "utf8",
  );
  assert.match(teacherDefaultMigration, /update public\.learning_agent_script_nodes/);
  assert.match(teacherDefaultMigration, /'kind', 'uply-teacher'/);
  assert.match(teacherDefaultMigration, /'position', 'right'/);
});

test("教学脚本发布前拒绝断路、循环和空理解检查", async () => {
  const migration = await readFile(
    new URL("supabase/migrations/202608290001_harden_learning_agent_script_flow.sql", root),
    "utf8",
  );
  assert.match(migration, /v_terminal_count <> 1/);
  assert.match(migration, /where action_type = 'complete_lesson'/);
  assert.match(migration, /with recursive flow_walk/);
  assert.match(migration, /v_has_cycle/);
  assert.match(migration, /v_reachable_count <> v_node_count/);
  assert.match(migration, /理解检查必须新建单选题或选择一个教材活动/);
  assert.match(migration, /自定义单选检查缺少有效选项或正确答案/);
  assert.match(migration, /node\.action_type not in \('none', 'focus_activity', 'play_expression'\)/);
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
  const characterStage = await readFile(
    new URL("src/features/learning-agent-script-studio/VirtualCharacterStageEditor.tsx", root),
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
  const companionRoute = await readFile(
    new URL("src/app/api/learning-agent/companions/[companion]/route.ts", root),
    "utf8",
  );
  const scriptRuntime = await readFile(
    new URL("src/lib/learning-agent-script-runtime.ts", root),
    "utf8",
  );
  assert.match(service, /requirePlatformOwner\(\)/);
  assert.match(service, /learning_agent_script_versions/);
  assert.match(service, /learning_agent_script_nodes/);
  assert.match(service, /learning_agent_script_audio_assets/);
  assert.match(service, /publishedSpeechAssetsByLessonAndKey/);
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
  assert.match(studio, /hasUnsavedChanges/);
  assert.match(studio, /beforeunload/);
  assert.match(studio, /confirmDiscardChanges/);
  assert.match(studio, /请先保存当前小节，再执行这个操作/);
  assert.match(studio, /FormSubmitButton/);
  assert.match(studio, /正在校验并发布/);
  assert.match(studio, /xl:grid-cols-\[15rem_19rem_minmax\(0,1fr\)\]/);
  assert.match(studio, /max-h-80 overflow-y-auto/);
  assert.match(studio, /仅第 1 章可预览完整流程/);
  assert.doesNotMatch(studio, /title="目前只有第 1 章接了真实学生页面/);
  assert.match(actions, /createTeachingScriptDraftAction/);
  assert.match(actions, /saveTeachingScriptNodeAction/);
  assert.match(actions, /moveTeachingScriptNodeAction/);
  assert.match(actions, /publishTeachingScriptAction/);
  assert.match(editor, /老师台词/);
  assert.match(editor, /增加台词/);
  assert.match(editor, /scriptLines\.map/);
  assert.doesNotMatch(editor, /TypewriterPreview/);
  assert.doesNotMatch(editor, /setPreviewScriptIndex/);
  assert.match(editor, /livePreviewUrl/);
  assert.match(editor, /真实学生端预览/);
  assert.match(editor, /setLivePreviewNonce/);
  assert.doesNotMatch(editor, />上一句</);
  assert.doesNotMatch(editor, />下一句</);
  assert.match(actions, /getAll\("script_zh"\)/);
  assert.match(scriptRuntime, /teacherScriptSegments/);
  assert.match(scriptRuntime, /scriptSegmentIndex/);
  assert.match(respondRoute, /继续下一句/);
  assert.match(respondRoute, /X-Learning-Agent-Buffer-Line/);
  assert.match(scriptRuntime, /upcomingScriptNodeBufferLine/);
  assert.match(scriptRuntime, /segmentIndex < segmentCount - 1/);
  assert.match(actions, /bufferLineZh: String\(formData\.get\("buffer_line_zh"\) \?\? ""\)/);
  assert.match(actions, /bufferLineKo: String\(formData\.get\("buffer_line_ko"\) \?\? ""\)/);
  assert.match(actions, /"ko-KR": input\.bufferLineKo/);
  assert.match(editor, /过渡台词/);
  assert.match(editor, /buffer_line_zh/);
  assert.match(editor, /buffer_line_ko/);
  assert.match(editor, /item\.locale === "zh-CN" && item\.segmentIndex === 199/);
  assert.match(editor, /item\.locale === "ko-KR" && item\.segmentIndex === 199/);
  assert.match(editor, /ariaLabelledBy="buffer-line-label"/);
  assert.match(editor, /min-h-24 resize-y/);
  assert.ok(editor.indexOf('id="buffer-line-zh"') < editor.indexOf('id={`script-line-${index}`}'));
  assert.match(scriptRuntime, /configuredText\(nextNode\.configuration, "bufferLine", locale\)/);
  assert.match(editor, /教学内容/);
  assert.match(editor, /学生展示内容/);
  assert.match(editor, /formSectionClass/);
  assert.match(editor, /formGroupClass/);
  assert.match(editor, /aria-labelledby="display-content-group-title"/);
  assert.match(editor, /aria-labelledby="virtual-character-group-title"/);
  assert.match(editor, /script_character_x/);
  assert.match(editor, /script_character_y/);
  assert.match(editor, /script_character_scale/);
  assert.match(editor, /VirtualCharacterStageEditor/);
  assert.match(characterStage, /拖动金老师调整位置/);
  assert.match(characterStage, /人物动作/);
  assert.match(characterStage, /TeachingBlackboardSlideView/);
  assert.match(characterStage, /activeBlackboardSlide/);
  assert.match(editor, /onSlidesChange=\{setBlackboardSlides\}/);
  assert.match(actions, /characterX: z\.coerce\.number\(\)\.min\(10\)\.max\(90\)/);
  assert.match(scriptRuntime, /normalizeTeachingVirtualCharacterPlacement/);
  assert.match(editor, /aria-labelledby="learning-area-group-title"/);
  assert.match(editor, /formFieldLabelClass/);
  assert.match(editor, /小节讲解/);
  assert.match(editor, /学生互动/);
  assert.match(editor, /完成后的流程/);
  assert.ok(editor.indexOf('id: "script"') < editor.indexOf('id: "content"'));
  assert.match(editor, /useState<EditorSection>\("script"\)/);
  assert.match(editor, /errorSectionByField/);
  assert.match(editor, /errorSummaryRef/);
  assert.match(editor, /当前小节有 \{formErrorMessages\.length\} 项需要修改/);
  assert.match(editor, /handleEditorTabKeyDown/);
  assert.match(editor, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(editor, /aria-labelledby="teaching-script-tab"/);
  assert.match(editor, /aria-labelledby="teaching-content-tab"/);
  assert.match(editor, /aria-labelledby="teaching-interaction-tab"/);
  assert.match(editor, /aria-labelledby="teaching-flow-tab"/);
  assert.match(editor, /onDirtyChange/);
  assert.match(editor, /有未保存的修改。保存后才会写入草稿/);
  assert.match(editor, /aria-describedby=\{state\.fieldErrors\?\.titleZh/);
  assert.doesNotMatch(editor, /2xl:grid-cols-\[minmax\(0,4fr\)_minmax\(0,6fr\)\]/);
  assert.doesNotMatch(editor, /展示方式/);
  assert.doesNotMatch(editor, /展示说明/);
  assert.match(editor, /互动设置/);
  assert.match(editor, /流程设置/);
  assert.match(editor, /学生端预览/);
  assert.match(editor, /CardTitleWithHint/);
  assert.match(editor, /hintLabel="查看学习区联动说明"/);
  assert.match(editor, /description=\{step\.description\}/);
  assert.match(editor, /hintLabel=\{`查看\$\{step\.label\}说明`\}/);
  assert.match(editor, /absolute right-3 top-1\/2/);
  assert.doesNotMatch(editor, /<p className="app-muted-text mt-1 text-xs leading-5">需要学生看图/);
  assert.match(editor, /display_items_zh/);
  assert.match(editor, /student_task_target_key/);
  assert.match(editor, /要求学生播放并完整听完指定表达/);
  assert.match(characterStage, /金老师/);
  assert.match(editor, /script_pose/);
  assert.match(editor, /朗读这句台词/);
  assert.match(editor, /ScriptSpeechReview/);
  assert.match(editor, /语音与当前台词一致/);
  assert.match(editor, /台词已修改，旧语音已停用，需要重新生成/);
  assert.match(editor, /试听语音/);
  assert.match(editor, />正式语音</);
  assert.match(editor, /textSha256/);
  assert.match(actions, /configuration\.virtualCharacter/);
  assert.match(actions, /configuration\.scriptPerformances/);
  assert.match(actions, /virtualCharacterKind: z\.literal\("uply-teacher"\)/);
  assert.match(actions, /configuration: \{\s+virtualCharacter: \{/);
  assert.match(characterStage, /人物位置和动作会随当前台词切换/);
  assert.match(editor, /name="virtual_character_kind" value="uply-teacher"/);
  assert.doesNotMatch(editor, /不显示虚拟人物/);
  assert.match(respondRoute, /X-Learning-Agent-Character/);
  assert.match(scriptRuntime, /virtualCharacterForScriptSegment/);
  assert.match(characterRoute, /learning-agent\/characters\/uply-teacher\/v4\/greeting-idle\.png/);
  assert.match(characterRoute, /createR2SignedObjectUrl/);
  assert.match(companionRoute, /learning-agent\/companions\/a-han\/v2\/runtime\/poses\/pointing\.webp/);
  assert.match(companionRoute, /learning-agent\/companions\/a-han\/v2\/runtime\/animations\/seated-combing-loop\.webp/);
  assert.match(companionRoute, /learning-agent\/companions\/a-han\/v2\/runtime\/posters\/seated-combing\.webp/);
  assert.match(companionRoute, /createR2SignedObjectUrl/);
  assert.doesNotMatch(editor, /\/images\/virtual-characters/);
  assert.match(editor, /保存当前小节/);
  assert.match(editor, /老师讲解指向/);
  assert.match(editor, /hintLabel="查看老师讲解指向说明"/);
  assert.doesNotMatch(editor, /app-muted-text mt-1\.5 block text-xs leading-5">选择后，学生端会自动切到对应页面/);
  assert.match(editor, /visual_cue_target_key/);
  assert.match(editor, /visualCueTargetKey &&/);
  assert.match(editor, /stepLearningTargetLabels/);
  assert.match(editor, /整个“课前导航”学习内容区/);
  assert.match(editor, /teachingActivityLabel/);
  assert.match(editor, /自动切到对应页面，把这个区域滚动到中间并闪动提示/);
  assert.match(editor, /不安排操作，只听老师讲解/);
  assert.match(editor, /content:current/);
  assert.match(editor, /activity:\$\{activity\.id\}/);
  assert.match(studio, /moduleOrder=\{selectedModule\.order\}/);
  assert.match(studio, /learningTargets=\{selectedModule\.learningTargets\}/);
  assert.match(studio, /moduleCode=\{selectedModule\.code\}/);
  assert.match(studio, /chapterNumber=\{selectedModule\.chapterNumber\}/);
  assert.match(service, /buildOrientationLearningTargets/);
  assert.match(editor, /setVisualCueTargetKey/);
  assert.match(editor, /setVisualCuePageKey/);
  assert.match(editor, /setVisualCueRegionKey/);
  assert.match(editor, /moduleCode === "orientation" && chapterNumber === 1/);
  assert.match(editor, /buildOrientationLearningTargets\(\{ activities \}\)/);
  assert.match(editor, /availableLearningTargets\.length > 0/);
  assert.match(editor, /onInput=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(editor, /selectLearningTargetPage\(event\.target\.value\)/);
  assert.match(editor, /selectLearningTargetRegion\(event\.target\.value\)/);
  assert.match(editor, /disabled=\{!editable \|\| !visualCuePageKey \|\| visualCuePageKey === "legacy"\}/);
  assert.match(editor, /name="visual_cue_target_key" value=\{visualCueTargetKey\}/);
  assert.match(editor, /1\. 选择页面或固定区域/);
  assert.match(editor, /2\. 选择区域/);
  assert.match(editor, /3\. 选择具体对象/);
  assert.match(editor, /当前指向：/);
  assert.match(actions, /\^\[a-zA-Z0-9:_-\]\*\$/);
  assert.match(editor, /name="student_task_kind" defaultValue=\{studentTaskKind\}/);
  assert.match(editor, /name="interaction_kind" value=\{interactionKind\}/);
  assert.match(editor, /student-task-settings/);
  assert.match(editor, /hidden=\{studentTaskKind === "none"\}/);
  assert.match(editor, /学生操作设置/);
  assert.match(editor, /hintLabel="查看学生操作说明"/);
  assert.match(editor, /学生需要操作哪里/);
  assert.match(editor, /3\. 选择按钮或表达/);
  assert.match(editor, /actionableLearningTargets/);
  assert.match(editor, /selectedStudentTaskTarget/);
  assert.match(editor, /name="student_task_follow_visual_cue"/);
  assert.match(editor, /使用老师讲解指向的对象/);
  assert.match(editor, /effectiveStudentTaskTarget/);
  assert.match(editor, /name="student_task_target_key" value=\{effectiveStudentTaskTarget\?\.key \?\? ""\}/);
  assert.match(editor, /当前老师讲解指向不是可操作的按钮或表达/);
  assert.match(actions, /studentTaskFollowVisualCue: z\.boolean\(\)/);
  assert.match(actions, /followVisualCue: input\.studentTaskFollowVisualCue/);
  assert.match(actions, /请选择学生需要完成的按钮或表达/);
  assert.doesNotMatch(editor, /app-muted-text mt-1\.5 block text-xs leading-5">这是学生必须亲自完成的操作/);
  assert.match(editor, /custom-interaction-settings/);
  assert.match(editor, /referenced-interaction-settings/);
  assert.match(editor, /hidden=\{interactionKind !== "single_choice"\}/);
  assert.match(editor, /voiceEnabled !== false/);
  assert.match(editor, /type="hidden" name="script_voice_language"/);
  assert.match(editor, /type="hidden" name="script_voice_rate"/);
  assert.match(editor, /暖黄色轻柔闪动/);
  assert.match(editor, /<fieldset className="mt-4 border/);
  assert.match(editor, /突出提示设置/);
  assert.match(editor, /visual_cue_duration_ms/);
  assert.match(editor, /单次时长/);
  assert.match(editor, /interaction_options/);
  assert.match(editor, /name="interaction_option" value=\{option\.value\}/);
  assert.match(editor, /type="radio" name="interaction_correct_option"/);
  assert.match(editor, /新增选项/);
  assert.match(editor, /moveInteractionOption/);
  assert.match(editor, /removeInteractionOption/);
  assert.match(editor, /新建必答单选检查/);
  assert.match(editor, /使用教材已有活动/);
  assert.match(editor, /type="hidden" name="interaction_required" value="on"/);
  assert.doesNotMatch(editor, /type="checkbox" name="interaction_required"/);
  assert.match(editor, /答错后的补充讲解/);
  assert.doesNotMatch(editor, /答错后去哪里/);
  assert.match(editor, /name="flow_mode" value=\{flowMode\}/);
  assert.match(editor, /按左侧顺序进入下一小节/);
  assert.match(editor, /跳转到指定小节/);
  assert.match(editor, /结束当前学习步骤/);
  assert.doesNotMatch(editor, /name="action_type"/);
  assert.doesNotMatch(editor, /这是必经小节/);
  assert.doesNotMatch(editor, /这是当前学习步骤的最后一节/);
  assert.match(editor, /答对后的老师反馈/);
  assert.match(editor, /fieldErrors\?\.interactionCorrectFeedbackZh/);
  assert.match(editor, /fieldErrors\?\.interactionIncorrectFeedbackZh/);
  assert.match(actions, /formData\.getAll\("interaction_option"\)/);
  assert.match(actions, /interactionRequired: true/);
  assert.match(actions, /flowMode: z\.enum\(\["sequence", "jump", "end"\]\)/);
  assert.match(actions, /effectiveActionType/);
  assert.match(actions, /input\.flowMode === "jump" \? input\.nextNodeKey : null/);
  assert.match(scriptRuntime, /required: true/);
  assert.match(respondRoute, /isTerminalScriptNode/);
  assert.doesNotMatch(respondRoute, /!selectedStudentTask\?\.required \|\| selectedTaskCompleted/);
  assert.match(actions, /learning_agent_node_interaction_secrets/);
});

test("学生教学区逐节点讲解并用真实活动答案完成理解检查", async () => {
  const [route, shell, skeleton, cleanupMigration, textbookLoader, taskEventsRoute, runtime] = await Promise.all([
    readFile(new URL("src/app/api/learning-agent/respond/route.ts", root), "utf8"),
    readFile(new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root), "utf8"),
    readFile(new URL("src/lib/smart-textbook-skeleton.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202608280005_remove_learning_agent_display_body.sql", root), "utf8"),
    readFile(new URL("src/lib/smart-digital-textbook.ts", root), "utf8"),
    readFile(new URL("src/app/api/learning-agent/events/route.ts", root), "utf8"),
    readFile(new URL("src/lib/learning-agent-script-runtime.ts", root), "utf8"),
  ]);
  assert.match(route, /const scriptVersionId = currentPublishedScript\?\.id \?\? existingSession\?\.script_version_id/);
  assert.match(route, /const sessionStatus = scriptNodes\.length > 0/);
  assert.doesNotMatch(route, /status: input\.intent === "ready" && completionPercent === 100 \? "completed" : "active"/);
  const explicitSessionLookup = route.slice(
    route.indexOf("if (input.sessionId)"),
    route.indexOf("} else {", route.indexOf("if (input.sessionId)")),
  );
  assert.doesNotMatch(explicitSessionLookup, /\.eq\("status", "active"\)/);
  assert.match(runtime, /intent !== "hint"/);
  assert.match(runtime, /intent !== "example"/);
  assert.match(route, /learning_agent_script_versions/);
  assert.match(route, /learning_agent_script_nodes/);
  assert.match(runtime, /digital_textbook_activity_secrets/);
  assert.match(route, /learning_agent_node_attempts/);
  assert.match(route, /X-Learning-Agent-Question-Options/);
  assert.match(route, /X-Learning-Agent-Awaiting-Answer/);
  assert.match(route, /X-Learning-Agent-Answer-Correct/);
  assert.match(runtime, /currentScriptNode\.node_type === "question" && Boolean\(currentScriptNode\.reference_activity_id\)/);
  assert.match(shell, /tutorStarted && !tutorTerminal/);
  assert.match(route, /X-Learning-Agent-Display/);
  assert.match(route, /X-Learning-Agent-Task-Completed/);
  assert.match(route, /X-Learning-Agent-Visual-Cue/);
  assert.match(route, /X-Learning-Agent-Interaction/);
  assert.match(runtime, /learning_agent_node_interaction_secrets/);
  assert.match(route, /plainTextStream\(scriptedContent\)/);
  assert.match(shell, /tutorQuestionOptions\.map/);
  assert.match(shell, /tutorReply\("answer", option\)/);
  assert.match(shell, /tutorContinueReady = tutorStarted/);
  assert.match(shell, /&& !tutorAwaitingAnswer/);
  assert.match(shell, /本节讲解已完成/);
  assert.match(shell, /function pauseTutorLesson\(\)/);
  assert.match(shell, /function resumeTutorLesson\(\)/);
  assert.match(shell, /function exitTutorLesson\(\)/);
  assert.match(shell, /tutorRequestAbortRef\.current\?\.abort\(\)/);
  assert.match(shell, /signal: requestAbortController\.signal/);
  assert.match(shell, /暂停学习/);
  assert.match(shell, /继续学习/);
  assert.match(shell, /重新开始/);
  assert.match(shell, /tutorHasPreviousSession/);
  assert.match(shell, /function restartTutorLesson\(\)/);
  assert.match(shell, /if \(confirmed\) startTutorLesson\(true\)/);
  assert.match(shell, /退出学习/);
  assert.match(shell, /mt-3 grid grid-cols-2 gap-1 border-t/);
  assert.match(shell, /onClick=\{exitTutorLesson\} className="inline-flex min-h-7 items-center justify-start gap-1 rounded-lg px-1\.5 text-\[8px\]/);
  assert.doesNotMatch(shell, /title=\{locale === "ko-KR" \? "학습 종료" : "退出学习"\}/);
  assert.match(shell, /已完成的教材进度不会丢失/);
  assert.match(shell, /const showTutorAnswerDialog = tutorStarted\s+&& !tutorPaused/);
  assert.match(shell, /if \(mobilePanel\) setMobilePanel\(null\)/);
  assert.match(shell, /h-\[calc\(100%_-_3\.25rem\)\]/);
  assert.match(shell, /autoFocus onClick=\{\(\) => setMobilePanel\(null\)\}/);
  assert.match(textbookLoader, /activeTeachingSessions/);
  assert.match(textbookLoader, /\.eq\("status", "active"\)/);
  assert.match(textbookLoader, /openingBufferLine: LocalizedText/);
  assert.match(textbookLoader, /openingBufferLineByModuleId\.get\(String\(module\.id\)\) \?\? null\)/);
  assert.match(textbookLoader, /node\.configuration\?\.bufferLine \?\? null/);
  assert.match(textbookLoader, /openingBufferSpeechAssetId/);
  assert.match(textbookLoader, /activeSessionBufferSpeechAssetIdsByNodeId/);
  assert.match(route, /if \(input\.restart && existingSession\)/);
  assert.match(route, /\.update\(\{ status: "abandoned" \}\)/);
  assert.match(route, /scriptedSessionCompleted/);
  assert.match(taskEventsRoute, /\.update\(\{ status: "completed" \}\)/);
  assert.match(shell, /tutorDisplay/);
  assert.match(shell, /data-learning-agent-blackboard/);
  assert.match(shell, /tutorStarted \? "overflow-y-auto" : "overflow-hidden"/);
  assert.match(shell, /aspectRatio: SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.blackboard\.aspectRatio/);
  assert.doesNotMatch(shell, /minimumHeightPx/);
  assert.match(shell, /TeachingBlackboardSlideView slide=\{tutorDisplay\.activeSlide\} className="absolute inset-0/);
  assert.match(shell, /w-\[62%\]/);
  assert.doesNotMatch(shell, /radial-gradient\(circle_at_center/);
  assert.match(shell, /className=\{tutorStarted[\s\S]*\? "relative"/);
  assert.match(shell, /sticky top-0 z-20/);
  assert.match(skeleton, /aspectRatio: "16 \/ 9"/);
  assert.doesNotMatch(shell, /tutorDisplay\?\.body|tutorDisplay\.body/);
  assert.match(cleanupMigration, /\(configuration -> 'display'\) - 'body'/);
  assert.doesNotMatch(shell, /当前教学展示/);
  assert.match(shell, /tutorStarted[\s\S]*"pointer-events-none absolute inset-0 z-40"/);
  assert.match(shell, /bottom-\[180px\] top-\[64px\]/);
  assert.match(shell, /h-\[clamp\(10rem,42\.75cqw,27rem\)\]/);
  assert.match(shell, /X-Learning-Agent-Buffer-Line/);
  assert.match(shell, /bufferLineForRequest\(bufferLineOverride, tutorNextBufferLine, locale\)/);
  assert.match(shell, /setTutorNextBufferLine\(activeOpeningBufferLine\)/);
  assert.match(shell, /setTutorNextBufferLine\(encodedBufferLine === null \? null : decodeURIComponent\(encodedBufferLine\)\)/);
  assert.match(shell, /teachingAreaCharacterPlacement\.x/);
  assert.match(shell, /teachingAreaCharacterPlacement\.y/);
  assert.match(shell, /teachingAreaCharacterPlacement\.scale/);
  assert.match(shell, /h-\[clamp\(24rem,48vh,32rem\)\]/);
  assert.match(shell, /pointer-events-auto absolute left-full z-10 ml-2 w-fit/);
  assert.match(shell, /teachingAreaCharacter\?\.kind !== "uply-teacher" &&/);
  assert.match(shell, /tutorIsSpeakingNow = tutorStatus === "thinking"/);
  assert.match(shell, /let bufferSpeechDone: Promise<void> = Promise\.resolve\(\)/);
  assert.match(shell, /requestAbortController\.signal\.addEventListener\("abort", finish, \{ once: true \}\)/);
  assert.match(shell, /X-Learning-Agent-Buffer-Speech-Asset/);
  assert.match(shell, /initialModule\?\.openingBufferSpeechAssetId/);
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
  assert.match(shell, /teachingAreaExpanded \? "text-sm leading-6" : "text-\[11px\] leading-5"/);
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
  assert.match(shell, /await bufferSpeechDone;\s+if \(requestAbortController\.signal\.aborted\) return;\s+\/\/ Re-arm "loading"[\s\S]*?setTutorStatus\("idle"\);/);
});

test("金老师正式语音与台词哈希、时间轴及二维口型保持同步", async () => {
  const [migration, speechRoute, shell, styles, provisioner, frameBuilder, scriptRuntime2] = await Promise.all([
    readFile(new URL("supabase/migrations/202608280006_add_learning_agent_script_audio_assets.sql", root), "utf8"),
    readFile(new URL("src/app/api/learning-agent/speech/[assetId]/route.ts", root), "utf8"),
    readFile(new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root), "utf8"),
    readFile(new URL("src/app/globals.css", root), "utf8"),
    readFile(new URL("scripts/provision-teacher-kim-speech.mjs", root), "utf8"),
    readFile(new URL("scripts/build-teacher-kim-sprite-frames.py", root), "utf8"),
    readFile(new URL("src/lib/learning-agent-script-runtime.ts", root), "utf8"),
  ]);
  assert.match(migration, /create table public\.learning_agent_script_audio_assets/);
  assert.match(migration, /content_hash text not null/);
  assert.match(migration, /cue_timeline jsonb not null/);
  assert.match(migration, /revoke all on table public\.learning_agent_script_audio_assets from public, anon, authenticated/);
  assert.match(scriptRuntime2, /sha256Text\(exactScriptSegment\)/);
  assert.match(scriptRuntime2, /exactScriptSegment === scriptedContent/);
  assert.match(scriptRuntime2, /speechAssetId/);
  assert.match(speechRoute, /requireActiveUser\(\)/);
  assert.match(speechRoute, /requirePlatformOwner\(\)/);
  assert.match(speechRoute, /createR2SignedObjectUrl/);
  assert.match(speechRoute, /\.eq\("status", "published"\)/);
  assert.match(provisioner, /zh-CN-XiaoxiaoNeural/);
  assert.match(provisioner, /ko-KR-SunHiNeural/);
  assert.match(provisioner, /learning-agent\/speech\/teacher-kim\/v1/);
  assert.match(provisioner, /\.in\("status", \["published", "draft"\]\)/);
  assert.match(provisioner, /contentHash\.slice\(0, 16\)/);
  assert.match(shell, /parseTutorSpeechManifest/);
  assert.match(shell, /activeCue\?\.charEnd/);
  assert.match(shell, /tutorSpeechInProgress/);
  assert.match(shell, /greeting-speaking/);
  assert.match(styles, /kim-teacher-speaking-frame/);
  assert.match(styles, /kim-teacher-blink-frame/);
  assert.match(frameBuilder, /cv2\.inpaint/);
});

test("金老师品牌胸针逐帧复用并从私有 R2 v4 加载", async () => {
  const [characterRoute, brandFrameBuilder] = await Promise.all([
    readFile(new URL("src/app/api/learning-agent/characters/[pose]/route.ts", root), "utf8"),
    readFile(new URL("scripts/build-teacher-kim-brand-frames.mjs", root), "utf8"),
  ]);
  assert.match(characterRoute, /learning-agent\/characters\/uply-teacher\/v4\/greeting-idle\.png/);
  assert.match(characterRoute, /learning-agent\/characters\/uply-teacher\/v4\/encouraging-blink\.png/);
  assert.match(brandFrameBuilder, /#26386f/);
  assert.match(brandFrameBuilder, /#d9b45c/);
  assert.match(brandFrameBuilder, /metadata\.width !== 512/);
  assert.match(brandFrameBuilder, /metadata\.height !== 1024/);
  assert.match(brandFrameBuilder, /metadata\.hasAlpha/);
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
