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
  const splitTemplateCoordinatesMigration = await readFile(
    new URL("supabase/migrations/202609020001_add_split_character_style_template_coordinates.sql", root),
    "utf8",
  );
  const narrowTemplateCoordinatesMigration = await readFile(
    new URL("supabase/migrations/202609020002_add_narrow_character_style_template_coordinates.sql", root),
    "utf8",
  );
  const narrowScaleMigration = await readFile(
    new URL("supabase/migrations/202609020003_add_narrow_character_scale.sql", root),
    "utf8",
  );
  assert.match(service, /requirePlatformOwner\(\)/);
  assert.match(service, /learning_agent_script_versions/);
  assert.match(service, /learning_agent_script_nodes/);
  assert.match(service, /learning_agent_script_audio_assets/);
  assert.match(service, /publishedSpeechAssetsByLessonAndKey/);
  assert.match(service, /left\.order - right\.order/);
  assert.doesNotMatch(service, /left\.chapterNumber - right\.chapterNumber \|\| left\.code\.localeCompare/);
  assert.match(studio, /课程结构/);
  assert.doesNotMatch(studio, /自定义教学流程/);
  assert.match(studio, /新增小节/);
  assert.match(studio, /\{selectedModule\.textbookTitle\["zh-CN"\]\} · 第\{selectedModule\.chapterNumber\}章 · \{moduleLabels\[selectedModule\.code\] \?\? selectedModule\.title\["zh-CN"\]\} · 第\{selectedVersion\.nodes\.findIndex/);
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
  assert.match(studio, /xl:grid-cols-\[18rem_minmax\(0,1fr\)\]/);
  assert.match(studio, /xl:grid-cols-\[minmax\(0,1fr\)\]/);
  assert.doesNotMatch(studio, /xl:grid-cols-\[3\.5rem_minmax\(0,1fr\)\]/);
  assert.match(studio, /!showStructureNav &&/);
  assert.match(studio, /aria-label="显示课程结构"/);
  assert.match(studio, /showStructureNav/);
  assert.doesNotMatch(studio, /showStepList/);
  assert.match(studio, /expandedModuleId/);
  assert.match(studio, /collapsedChapterNumbers/);
  assert.match(studio, /teaching-script-navigation:v1/);
  assert.match(studio, /window\.localStorage\.getItem\(navigationMemoryKey\)/);
  assert.match(studio, /window\.localStorage\.setItem\(navigationMemoryKey/);
  assert.match(studio, /const \[expandedModuleId, setExpandedModuleId\] = useState\(""\)/);
  assert.match(studio, /new Set\(data\.modules\.map\(\(item\) => item\.chapterNumber\)\)/);
  assert.match(studio, /toggleChapter\(chapterNumber\)/);
  assert.match(studio, /aria-expanded=\{chapterExpanded\}/);
  assert.match(studio, /teaching-chapter-\$\{chapterNumber\}-steps/);
  assert.doesNotMatch(studio, /\{modules\.length\} 个学习步骤/);
  assert.match(studio, /bg-\[var\(--muted\)\]\/60/);
  assert.match(studio, /setExpandedModuleId\(\(current\) => current === nextModuleId \? "" : nextModuleId\)/);
  assert.match(studio, /aria-expanded=\{expanded\}/);
  assert.match(studio, /aria-controls=\{selected \? `teaching-step-\$\{lessonModule\.id\}-nodes` : undefined\}/);
  assert.match(studio, /expanded \? "rotate-180"/);
  assert.match(studio, /发布学习步骤/);
  assert.match(studio, /form=\{selectedNodeFormId\}/);
  assert.match(studio, /nodeSavePending \? "正在保存…" : "保存当前小节"/);
  assert.match(studio, /editable && selectedNode && selectedNodeFormId/);
  assert.match(studio, /summary className="inline-flex min-h-11[^"]*border border-\[var\(--border\)\] bg-\[var\(--muted\)\]/);
  assert.ok(studio.indexOf('form={selectedNodeFormId}') < studio.indexOf("发布学习步骤"));
  assert.match(studio, /id="subsection-editor-title">\{selectedModule\.textbookTitle\["zh-CN"\]\} · 第\{selectedModule\.chapterNumber\}章 · \{moduleLabels\[selectedModule\.code\] \?\? selectedModule\.title\["zh-CN"\]\} · 第\{selectedVersion\.nodes\.findIndex/);
  assert.doesNotMatch(studio, /小节 · \{selectedNode\.title\["zh-CN"\]\}/);
  assert.match(studio, /sticky top-0 z-30/);
  assert.match(studio, /xl:sticky xl:top-0/);
  assert.doesNotMatch(studio, /xl:sticky xl:top-20/);
  assert.match(studio, /仅第 1 章可预览完整流程/);
  assert.doesNotMatch(studio, /title="目前只有第 1 章接了真实学生页面/);
  assert.match(studio, /当前学习步骤检查概览/);
  assert.match(studio, /正式语音就绪/);
  assert.match(studio, /AlertDialogTitle/);
  assert.doesNotMatch(studio, /确定删除“版本 .*window\.confirm/);
  assert.match(actions, /createTeachingScriptDraftAction/);
  assert.match(actions, /saveTeachingScriptNodeAction/);
  assert.match(actions, /moveTeachingScriptNodeAction/);
  assert.match(actions, /publishTeachingScriptAction/);
  // Two overlapping saves for the same node must not let the one that lands
  // last silently overwrite the other's changes — the update is a
  // compare-and-swap against the row's own updated_at, not a blind write.
  assert.match(actions, /nodeUpdatedAt: z\.string\(\)\.min\(1,/);
  assert.match(actions, /String\(current\.updated_at\) !== input\.nodeUpdatedAt/);
  assert.match(actions, /\.eq\("id", input\.nodeId\)\s*\n\s*\.eq\("updated_at", input\.nodeUpdatedAt\)/);
  assert.match(actions, /if \(!updated \|\| updated\.length === 0\)/);
  assert.match(editor, /<input type="hidden" name="node_updated_at" value=\{node\.updatedAt\} \/>/);
  assert.match(editor, /老师台词/);
  assert.doesNotMatch(editor, /max-w-\[75rem\]/);
  assert.match(editor, /小节基本设置/);
  assert.match(editor, /开场过渡/);
  assert.match(editor, /正式讲解/);
  assert.match(editor, /朗读与人物设置/);
  assert.match(editor, /reviewSurfaceClass/);
  assert.match(editor, /status-success-surface/);
  assert.match(editor, /已连接下一句/);
  assert.match(editor, /补充讲解/);
  assert.match(editor, /已填写 \{supplementalExplanationCount\}\/2/);
  assert.match(editor, /HINT_SPEECH_SEGMENT_INDEX = 197/);
  assert.match(editor, /EXAMPLE_SPEECH_SEGMENT_INDEX = 198/);
  assert.match(editor, /name="hint_zh" value=\{hintZh\}/);
  assert.match(editor, /name="example_zh" value=\{exampleZh\}/);
  assert.doesNotMatch(editor, /text-xs text-\[var\(--muted-foreground\)\]">正式讲解/);
  assert.match(editor, /xl:grid-cols-2 xl:divide-x xl:divide-y-0/);
  assert.match(editor, /mt-3 grid items-start gap-3 xl:grid-cols-2/);
  assert.match(editor, /grid items-start gap-4 bg-\[var\(--muted\)\]\/25 p-4 xl:grid-cols-2/);
  assert.match(editor, /rounded-xl border border-\[var\(--border\)\] bg-\[var\(--card\)\] p-4 shadow-sm/);
  assert.match(editor, /增加台词/);
  assert.match(editor, /scriptLines\.map/);
  assert.doesNotMatch(editor, /TypewriterPreview/);
  assert.doesNotMatch(editor, /setPreviewScriptIndex/);
  assert.doesNotMatch(editor, /livePreviewUrl/);
  assert.doesNotMatch(editor, /真实学生端预览/);
  assert.doesNotMatch(editor, /setLivePreviewNonce/);
  assert.doesNotMatch(editor, /<iframe/);
  assert.doesNotMatch(studio, /livePreviewUrl=/);
  assert.match(editor, /顶部“预览完整流程”/);
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
  assert.doesNotMatch(editor, /item\.locale === "ko-KR" && item\.segmentIndex === 199/);
  assert.doesNotMatch(editor, /韩文标题与台词/);
  assert.match(editor, /type="hidden" name="title_ko" value=\{node\.title\["ko-KR"\]\}/);
  assert.match(editor, /type="hidden" name="buffer_line_ko" value=\{configuredText\(node, "bufferLine", "ko-KR"\)\}/);
  assert.match(editor, /type="hidden" name="script_ko" value=\{node\.script\["ko-KR"\]\}/);
  assert.match(editor, /ariaLabelledBy="buffer-line-label"/);
  assert.match(editor, /min-h-24 resize-y/);
  assert.ok(editor.indexOf('id="buffer-line-zh"') < editor.indexOf('id={`script-line-${index}`}'));
  assert.match(scriptRuntime, /configuredText\(nextNode\.configuration, "bufferLine", locale\)/);
  assert.match(editor, /画面与人物/);
  assert.match(editor, /教学舞台/);
  assert.match(editor, /黑板画面/);
  assert.ok(editor.indexOf('id="virtual-character-group-title"') < editor.indexOf('id="display-content-group-title"'));
  assert.match(editor, /<details className=\{`\$\{formGroupClass\} group`\} aria-labelledby="learning-area-group-title">/);
  assert.match(editor, /未设置，仅播放教学内容/);
  assert.match(editor, /formSectionClass/);
  assert.match(editor, /formGroupClass/);
  assert.match(editor, /aria-labelledby="display-content-group-title"/);
  assert.match(editor, /aria-labelledby="virtual-character-group-title"/);
  assert.match(editor, /name="script_placement" value=\{scriptPlacementPayload\(scriptPerformances\[index\]\)\}/);
  assert.match(editor, /function scriptPlacementPayload\(performance: ScriptPerformance \| undefined\)/);
  for (const field of ["characterX", "characterY", "characterScale", "dialogueX", "dialogueY", "splitCharacterX", "splitCharacterY", "splitCharacterScale", "splitDialogueX", "splitDialogueY", "narrowCharacterX", "narrowCharacterY", "narrowCharacterScale"]) {
    assert.match(editor, new RegExp(`${field}: performance\\?\\.${field} \\?\\?`));
  }
  assert.match(actions, /const scriptPlacements = formData\.getAll\("script_placement"\)\.map\(String\)/);
  assert.match(actions, /function parsedScriptPlacement/);
  assert.match(actions, /normalizeTeachingVirtualCharacterPlacement\(placementSource, virtualCharacterPosition\)/);
  assert.match(actions, /normalizeSplitTeachingVirtualCharacterPlacement\(placementSource, virtualCharacterPosition\)/);
  assert.match(actions, /normalizeNarrowTeachingVirtualCharacterPlacement\(placementSource\)/);
  assert.match(editor, /VirtualCharacterStageEditor/);
  assert.match(characterStage, /拖动黑板、金老师和对话框调整位置/);
  assert.match(characterStage, /人物动作/);
  assert.match(characterStage, /当前预览台词/);
  assert.match(characterStage, /金老师 · \{narrowMode \? "全屏学习" : splitMode \? "3:7 双区" : "全屏教学"\}/);
  assert.match(characterStage, /全屏教学/);
  assert.match(characterStage, /3:7 双区/);
  assert.match(characterStage, /全屏学习/);
  assert.match(characterStage, /setStageMode\("immersive"\)/);
  assert.match(characterStage, /setStageMode\("split"\)/);
  assert.match(characterStage, /setStageMode\("narrow"\)/);
  // 全屏教学 button must not also light up while narrow mode is active — it
  // reads !splitMode alone (true in both immersive and narrow), so without
  // excluding narrowMode too, switching to 全屏学习 highlighted 全屏教学 as well.
  assert.match(characterStage, /aria-pressed=\{!splitMode && !narrowMode\}/);
  assert.match(characterStage, /\$\{!splitMode && !narrowMode \? "bg-\[var\(--primary\)\] text-\[var\(--primary-foreground\)\]"/);
  assert.match(characterStage, /characterXKey = narrowMode \? "narrowCharacterX" : splitMode \? "splitCharacterX" : "characterX"/);
  assert.match(characterStage, /onPerformanceChange\(safeIndex, \{ \[characterXKey\]: x, \[characterYKey\]: y \}\)/);
  // 学习区真实内容预览（iframe embed of the live preview, always cropped so
  // it never draws a second 教学区 next to this editor's own, and scaled to
  // fill the container by width edge to edge so it stays in the same
  // coordinate space 金老师's X/Y placement percentages use). Split (3:7)
  // only — narrow (全屏学习)'s container is far wider than this content's
  // native 70%-wide column, so filling it by width zooms in enough that
  // 金老师's own fixed size looks mismatched against it; narrow shows a
  // plain placeholder box instead.
  assert.match(studio, /const previewUrl = previewLessonSupported && selectedVersion/);
  assert.match(studio, /previewUrl=\{previewUrl\}/);
  assert.match(editor, /previewUrl,\n\s*onDirtyChange,/);
  assert.match(editor, /previewUrl\?: string;/);
  assert.match(editor, /onDirty=\{markDirty\}\n\s*previewUrl=\{previewUrl\}\n\s*\/>/);
  assert.match(characterStage, /function ScaledLearningAreaPreview\(\{ previewUrl \}: \{ previewUrl\?: string \}\)/);
  assert.match(characterStage, /真实学习区预览目前只支持第 1 章/);
  assert.match(characterStage, /const scale = containerWidth > 0 \? containerWidth \/ LEARNING_AREA_PREVIEW_CROPPED_WIDTH_PX : 0/);
  assert.match(characterStage, /left: `\$\{-LEARNING_AREA_PREVIEW_TEACHING_WIDTH_PX \* scale\}px`/);
  assert.equal((characterStage.match(/<ScaledLearningAreaPreview previewUrl=\{previewUrl\} \/>/g) ?? []).length, 1);
  assert.match(characterStage, /\{narrowMode \? \(\n\s*<div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden bg-\[var\(--card\)\]/);
  assert.match(characterStage, /border border-dashed border-\[var\(--border\)\] bg-\[var\(--surface-soft\)\]/);
  assert.match(characterStage, /pointer-events-none absolute top-0 border-0/);
  assert.match(characterStage, /TeachingBlackboardSlideView/);
  assert.match(characterStage, /activeBlackboardSlide/);
  assert.match(characterStage, /performance\.dialogueX/);
  assert.match(characterStage, /handleDialoguePointerDown/);
  assert.match(characterStage, /放大全屏/);
  assert.match(characterStage, /全屏舞台工具/);
  assert.match(characterStage, /plainScriptLine\(scriptLines\[safeIndex\]/);
  assert.match(characterStage, /translateX\(-50%\) scale\(\$\{characterScale\}\)/);
  assert.match(characterStage, /transformOrigin: "bottom center"/);
  assert.match(characterStage, /SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.teachingArea\.defaultWidthPercent/);
  assert.match(characterStage, /教学区 \$\{splitTeachingAreaWidthPercent\}%、学习区 \$\{splitLearningAreaWidthPercent\}%/);
  assert.match(characterStage, /离教学区底部/);
  assert.match(characterStage, /teachingVirtualCharacterPreviewGeometry/);
  assert.match(characterStage, /previewGeometry\.aspectRatio/);
  assert.match(characterStage, /data-teaching-context/);
  assert.ok(characterStage.indexOf("data-teaching-context") < characterStage.indexOf('aria-label="黑板。'));
  assert.match(characterStage, /left: `\$\{splitMode \? splitTeachingAreaCenterPercent : boundedBlackboardPlacement\.x\}%`/);
  assert.match(characterStage, /previewGeometry\.blackboardWidthPercent/);
  assert.match(characterStage, /constrainTeachingBlackboardPlacementToViewport/);
  assert.match(characterStage, /teachingBlackboardPlacementBounds/);
  assert.match(characterStage, /window\.innerWidth/);
  assert.match(characterStage, /handleBlackboardPointerDown/);
  assert.match(characterStage, /handleBlackboardKeyDown/);
  assert.match(characterStage, /恢复黑板默认位置/);
  assert.match(characterStage, /黑板和金老师|拖动黑板/);
  assert.doesNotMatch(characterStage, /inset-x-0 bottom-0 h-\[8%\]/);
  assert.match(characterStage, /isFullscreen \? "p-0" : "px-4 py-4"/);
  assert.match(characterStage, /md:grid-cols-2 xl:grid-cols-4/);
  assert.match(characterStage, /TEACHING_VIRTUAL_CHARACTER_STAGE\.dialogueBubble\.minimumWidthPx/);
  assert.match(characterStage, /width: dialogueBubbleWidth/);
  assert.match(characterStage, /预览台词 \{safeIndex \+ 1\}/);
  assert.doesNotMatch(characterStage, /absolute left-3 top-3/);
  assert.match(editor, /onSlidesChange=\{setBlackboardSlides\}/);
  assert.match(actions, /characterX: z\.coerce\.number\(\)\.min\(10\)\.max\(90\)/);
  assert.match(actions, /characterY: z\.coerce\.number\(\)\.min\(0\)\.max\(TEACHING_VIRTUAL_CHARACTER_STAGE\.maximumBottomPercent\)/);
  assert.match(actions, /splitCharacterX: z\.coerce\.number\(\)\.min\(10\)\.max\(90\)/);
  assert.match(actions, /splitCharacterScale: z\.coerce\.number\(\)\.min\(0\.5\)\.max\(1\.25\)/);
  assert.match(actions, /splitDialogueX: z\.coerce\.number\(\)\.min\(5\)\.max\(95\)/);
  assert.match(actions, /split_character_x: Number\(firstPerformance\.splitCharacterX/);
  assert.match(actions, /split_dialogue_y: Number\(firstPerformance\.splitDialogueY/);
  assert.match(service, /split_character_x,split_character_y,split_character_scale,split_dialogue_x,split_dialogue_y,narrow_character_x,narrow_character_y,narrow_character_scale/);
  assert.match(editor, /splitCharacterX: template\.splitCharacterX/);
  assert.match(editor, /splitDialogueY: template\.splitDialogueY/);
  for (const column of ["split_character_x", "split_character_y", "split_character_scale", "split_dialogue_x", "split_dialogue_y"]) {
    assert.match(splitTemplateCoordinatesMigration, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(actions, /narrowCharacterX: z\.coerce\.number\(\)\.min\(10\)\.max\(90\)/);
  assert.match(actions, /narrowCharacterY: z\.coerce\.number\(\)\.min\(0\)\.max\(TEACHING_VIRTUAL_CHARACTER_STAGE\.maximumBottomPercent\)/);
  assert.match(actions, /narrowCharacterScale: z\.coerce\.number\(\)\.min\(0\.5\)\.max\(1\.25\)/);
  assert.match(actions, /narrow_character_x: Number\(firstPerformance\.narrowCharacterX/);
  assert.match(actions, /narrow_character_y: Number\(firstPerformance\.narrowCharacterY/);
  assert.match(actions, /narrow_character_scale: Number\(firstPerformance\.narrowCharacterScale/);
  assert.match(editor, /narrowCharacterX: template\.narrowCharacterX/);
  assert.match(editor, /narrowCharacterY: template\.narrowCharacterY/);
  assert.match(editor, /narrowCharacterScale: template\.narrowCharacterScale/);
  for (const column of ["narrow_character_x", "narrow_character_y"]) {
    assert.match(narrowTemplateCoordinatesMigration, new RegExp(`add column if not exists ${column}`));
  }
  assert.match(narrowScaleMigration, /add column if not exists narrow_character_scale/);
  assert.match(actions, /blackboardX: z\.coerce\.number\(\)/);
  assert.match(actions, /blackboardY: z\.coerce\.number\(\)/);
  assert.match(actions, /blackboardScale: z\.coerce\.number\(\)/);
  assert.match(actions, /placement: blackboardPlacement/);
  assert.match(characterStage, /name="blackboard_x" value=\{String\(blackboardPlacement\.x\)\}/);
  assert.match(characterStage, /name="blackboard_y" value=\{String\(blackboardPlacement\.y\)\}/);
  assert.match(characterStage, /name="blackboard_scale" value=\{String\(blackboardPlacement\.scale\)\}/);
  assert.match(characterStage, /min=\{Math\.min\(TEACHING_VIRTUAL_CHARACTER_STAGE\.blackboard\.minimumScale, blackboardBounds\.maximumScale\) \* 100\}/);
  assert.match(characterStage, /max=\{blackboardBounds\.maximumScale \* 100\}/);
  assert.match(actions, /mode: "slides",\s+placement: blackboardPlacement,\s+slides: \[\]/);
  assert.match(scriptRuntime, /normalizeTeachingVirtualCharacterPlacement/);
  assert.match(scriptRuntime, /normalizeSplitTeachingVirtualCharacterPlacement/);
  assert.match(scriptRuntime, /normalizeNarrowTeachingVirtualCharacterPlacement/);
  assert.match(editor, /aria-labelledby="learning-area-group-title"/);
  assert.match(editor, /formFieldLabelClass/);
  assert.match(editor, /小节基本设置/);
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
  assert.match(editor, /停止输入后会自动保存/);
  assert.match(editor, /form\.requestSubmit\(\)/);
  assert.match(editor, /submittedVersionRef\.current === dirtyVersionRef\.current/);
  assert.match(editor, /submittedModeRef\.current !== "auto"/);
  assert.match(editor, /aria-describedby=\{state\.fieldErrors\?\.titleZh/);
  assert.doesNotMatch(editor, /2xl:grid-cols-\[minmax\(0,4fr\)_minmax\(0,6fr\)\]/);
  assert.doesNotMatch(editor, /展示方式/);
  assert.doesNotMatch(editor, /展示说明/);
  assert.match(editor, /画面与人物/);
  assert.match(editor, /学生互动/);
  assert.match(editor, /后续流程/);
  assert.doesNotMatch(editor, /学生端预览/);
  assert.match(editor, /CardTitleWithHint/);
  assert.match(editor, /展开高级设置/);
  assert.match(editor, /description=\{step\.description\}/);
  assert.match(editor, /hintLabel=\{`查看\$\{step\.label\}说明`\}/);
  assert.match(editor, /absolute right-2\.5 top-1\/2/);
  assert.match(editor, /md:grid-cols-\[7rem_minmax\(0,1fr\)\]/);
  assert.match(editor, /min-w-\[9\.5rem\] flex-1/);
  assert.match(editor, /rounded-lg bg-\[var\(--muted\)\]\/30 p-3/);
  assert.match(editor, /rounded-lg bg-\[var\(--accent\)\]\/30 p-3/);
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
  assert.match(characterStage, /黑板画面、人物动作和站位/);
  assert.match(actions, /dialogueX: z\.coerce\.number\(\)\.min\(5\)\.max\(95\)/);
  assert.match(actions, /dialogueY: z\.coerce\.number\(\)\.min\(5\)\.max\(90\)/);
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
  assert.doesNotMatch(editor, />保存当前小节</);
  assert.doesNotMatch(editor, /sticky bottom-0/);
  assert.match(editor, /id=\{formId\}/);
  assert.match(editor, /onPendingChange\(pending\)/);
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
  assert.doesNotMatch(studio, /chapterNumber=\{selectedModule\.chapterNumber\}/);
  assert.match(service, /buildOrientationLearningTargets/);
  assert.match(service, /staticTargets: learningTargetRegistry\.get\("orientation"\) \?\? \[\]/);
  assert.doesNotMatch(service, /module_code\) === "orientation" && Number\(chapter\.chapter_number\) === 1/);
  assert.match(editor, /setVisualCueTargetKey/);
  assert.match(editor, /setVisualCuePageKey/);
  assert.match(editor, /setVisualCueRegionKey/);
  assert.match(editor, /moduleCode === "orientation"\s*\n\s*\? buildOrientationLearningTargets\(\{ activities \}\)/);
  assert.doesNotMatch(editor, /chapterNumber === 1/);
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
  assert.match(editor, /title="宠物操作"/);
  assert.match(editor, /hintLabel="查看宠物操作说明"/);
  assert.doesNotMatch(editor, /宠物代点|当前代点目标|可代点/);
  assert.doesNotMatch(actions, /宠物代点/);
  assert.match(actions, /宠物操作不能指向答题类目标/);
  assert.ok(editor.indexOf('title="宠物操作"') < editor.indexOf('title="学生操作"'));
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
  const [route, shell, skeleton, cleanupMigration, textbookLoader, taskEventsRoute, runtime, previewPage] = await Promise.all([
    readFile(new URL("src/app/api/learning-agent/respond/route.ts", root), "utf8"),
    readFile(new URL("src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx", root), "utf8"),
    readFile(new URL("src/lib/smart-textbook-skeleton.ts", root), "utf8"),
    readFile(new URL("supabase/migrations/202608280005_remove_learning_agent_display_body.sql", root), "utf8"),
    readFile(new URL("src/lib/smart-digital-textbook.ts", root), "utf8"),
    readFile(new URL("src/app/api/learning-agent/events/route.ts", root), "utf8"),
    readFile(new URL("src/lib/learning-agent-script-runtime.ts", root), "utf8"),
    readFile(new URL("src/app/[space]/dashboard/admin/apps/[appSlug]/teaching-scripts/preview/page.tsx", root), "utf8"),
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
  assert.match(shell, /resumableStage\?\.teachingDisplay \?\? activeModule\.openingTeachingDisplay/);
  assert.match(shell, /resumableStage\?\.teachingCharacter[\s\S]{0,100}\?\? activeModule\.openingTeachingCharacter/);
  assert.match(shell, /isPreviewMode\s+\? previewOpeningTeachingDisplay/);
  assert.match(shell, /isPreviewMode\s+\? previewOpeningTeachingCharacter/);
  assert.ok(shell.indexOf("setTutorDisplay((preloadedDisplay") < shell.indexOf("setTutorStarted(true)"));
  assert.match(previewPage, /teachingBlackboardDisplayForSegment/);
  assert.match(previewPage, /virtualCharacterForScriptSegment/);
  assert.match(previewPage, /previewOpeningTeachingDisplay=\{previewOpeningTeachingDisplay\}/);
  assert.match(previewPage, /previewOpeningTeachingCharacter=\{previewOpeningTeachingCharacter\}/);
  assert.match(shell, /requestImmersiveFullscreen/);
  assert.match(shell, /requestFullscreen\(\{ navigationUI: "hide" \}\)/);
  assert.match(shell, /fullscreenRequestFailed/);
  assert.match(shell, /进入全屏/);
  assert.match(shell, /document\.exitFullscreen\(\)\.catch/);
  assert.match(shell, /immersiveChromeVisible/);
  assert.match(shell, /setTimeout\(\(\) => setImmersiveChromeVisible\(false\), 1800\)/);
  assert.match(shell, /onPointerEnter=\{keepImmersiveChromeVisible\}/);
  assert.match(shell, /-translate-y-full/);
  assert.match(shell, /translate-y-full/);
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
  assert.match(textbookLoader, /openingTeachingDisplay: TeachingBlackboardDisplay \| null/);
  assert.match(textbookLoader, /openingTeachingCharacter: ScriptVirtualCharacter \| null/);
  assert.match(textbookLoader, /teachingBlackboardDisplayForSegment\(node\.configuration\?\.display \?\? null, 0\)/);
  assert.match(textbookLoader, /virtualCharacterForScriptSegment\(node\.configuration, 0\)/);
  assert.match(textbookLoader, /\.eq\("sort_order", 1\)/);
  assert.match(textbookLoader, /openingTeachingDisplay: openingTeachingDisplayByModuleId\.get/);
  assert.match(textbookLoader, /openingTeachingCharacter: openingTeachingCharacterByModuleId\.get/);
  assert.match(textbookLoader, /teachingDisplay: teachingBlackboardDisplayForSegment\(currentConfiguration\.display \?\? null, segmentIndex\)/);
  assert.match(textbookLoader, /teachingCharacter: virtualCharacterForScriptSegment\(currentConfiguration, segmentIndex\)/);
  assert.match(textbookLoader, /openingBufferLineByModuleId\.get\(String\(module\.id\)\) \?\? null\)/);
  assert.match(textbookLoader, /node\.configuration\?\.bufferLine \?\? null/);
  assert.match(textbookLoader, /openingBufferSpeechAssetId/);
  assert.match(textbookLoader, /activeSessionBufferSpeechAssetIdsByNodeId/);
  assert.match(textbookLoader, /id,lesson_id,script_version_id,current_node_id,teaching_state,updated_at/);
  assert.match(textbookLoader, /publishedScriptVersionByLessonId/);
  assert.match(textbookLoader, /migratedSessionNodeByVersionAndKey/);
  assert.match(textbookLoader, /!sessionVersionId && publishedVersionId/);
  assert.match(textbookLoader, /segmentIndex: canResumeSegment \? Math\.max/);
  assert.match(route, /if \(input\.restart && existingSession\)/);
  assert.match(route, /\.update\(\{ status: "abandoned" \}\)/);
  assert.match(route, /scriptedSessionCompleted/);
  assert.match(taskEventsRoute, /\.update\(\{ status: "completed" \}\)/);
  assert.match(shell, /tutorDisplay/);
  assert.match(shell, /data-learning-agent-blackboard/);
  assert.match(shell, /normalizeTeachingBlackboardPlacement\(tutorDisplay\?\.placement\)/);
  assert.match(shell, /constrainTeachingBlackboardPlacementToViewport/);
  assert.match(shell, /subscribeToTeachingViewport/);
  assert.match(shell, /immersiveBlackboardPositioned/);
  assert.match(shell, /translateX\(-50%\) scale\(\$\{teachingAreaBlackboardPlacement\.scale\}\)/);
  assert.match(shell, /tutorStarted \? "overflow-y-auto" : "overflow-hidden"/);
  assert.match(shell, /aspectRatio: SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.blackboard\.aspectRatio/);
  assert.doesNotMatch(shell, /minimumHeightPx/);
  assert.match(shell, /TeachingBlackboardSlideView slide=\{tutorDisplay\.activeSlide\} className="absolute inset-0/);
  assert.match(shell, /w-\[62%\]/);
  assert.match(shell, /radial-gradient\(circle_at_center/);
  assert.match(shell, /sticky top-0 z-20/);
  assert.match(skeleton, /aspectRatio: "16 \/ 9"/);
  assert.doesNotMatch(shell, /tutorDisplay\?\.body|tutorDisplay\.body/);
  assert.match(cleanupMigration, /\(configuration -> 'display'\) - 'body'/);
  assert.doesNotMatch(shell, /当前教学展示/);
  assert.match(shell, /tutorStarted[\s\S]*teachingAreaCollapsed \? "hidden" : "hidden overflow-hidden xl:block"/);
  assert.match(shell, /top: TEACHING_VIRTUAL_CHARACTER_STAGE\.viewportTopPx/);
  assert.match(shell, /bottom: TEACHING_VIRTUAL_CHARACTER_STAGE\.viewportBottomPx/);
  assert.match(shell, /width: teachingAreaExpanded[\s\S]*\? "100%"[\s\S]*teachingAreaCollapsed[\s\S]*SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.teachingArea\.collapsedWidthPx[\s\S]*SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.teachingArea\.defaultWidthPercent/);
  assert.match(shell, /createPortal\(children, target\)/);
  assert.match(shell, /TeachingStagePortal active=\{tutorStarted\} target=\{textbookRef\.current\}/);
  assert.match(shell, /data-teaching-stage-layout=\{teachingAreaExpanded \? "immersive" : "split"\}/);
  assert.match(shell, /normalizeSplitTeachingVirtualCharacterPlacement/);
  assert.match(shell, /teachingStageCharacterPlacement = teachingAreaExpanded/);
  assert.match(shell, /: splitTeachingAreaCharacterPlacement/);
  assert.match(shell, /teachingAreaExpanded \? "" : teachingAreaCollapsed \? "hidden" : "hidden overflow-hidden xl:block"/);
  assert.match(shell, /TEACHING_VIRTUAL_CHARACTER_STAGE\.dialogueBubble\.preferredWidthCqw/);
  assert.match(shell, /height: tutorStarted \? `\$\{TEACHING_VIRTUAL_CHARACTER_STAGE\.characterHeightPercent\}%`/);
  assert.match(shell, /bottom-\[180px\] top-\[64px\]/);
  assert.match(shell, /tutorStarted \? "h-full"/);
  assert.match(shell, /X-Learning-Agent-Buffer-Line/);
  assert.match(shell, /bufferLineForRequest\(bufferLineOverride, tutorNextBufferLine, locale\)/);
  assert.match(shell, /setTutorNextBufferLine\(activeOpeningBufferLine\)/);
  assert.match(shell, /setTutorNextBufferLine\(encodedBufferLine === null \? null : decodeURIComponent\(encodedBufferLine\)\)/);
  assert.match(shell, /teachingStageCharacterPlacement\.x/);
  assert.match(shell, /teachingStageCharacterPlacement\.y/);
  assert.match(shell, /teachingStageCharacterPlacement\.scale/);
  assert.match(shell, /h-\[clamp\(24rem,48vh,32rem\)\]/);
  assert.match(shell, /teachingStageCharacterPlacement\.dialogueX/);
  assert.match(shell, /teachingStageCharacterPlacement\.dialogueY/);
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
  assert.match(shell, /const learningAreaHidden = shouldHideSmartTextbookLearningArea\(\{/);
  assert.match(shell, /SMART_TEXTBOOK_SHARED_LEARNING_LAYOUT\.teachingArea\.defaultWidthPercent/);
  assert.match(shell, /data-learning-area-hidden/);
  assert.match(shell, /learningAreaHidden \? "hidden" : "flex"/);
  assert.match(shell, /teachingAreaExpanded \? "flex flex-col" : "hidden xl:flex xl:flex-col"/);
  assert.match(shell, /teachingAreaExpanded \? "text-sm leading-6" : "text-\[11px\] leading-5"/);
  assert.match(shell, /setLearningAreaManuallyHidden\(true\)/);
  assert.match(shell, /setLearningAreaManuallyHidden\(false\)/);
  assert.match(shell, /隐藏学习区/);
  assert.match(shell, /显示学习区/);
  assert.doesNotMatch(shell, /互动学习区|상호작용 학습 영역/);
  assert.match(shell, /after:left-\[var\(--learning-header-inset\)\] after:right-\[var\(--learning-header-inset\)\]/);
  assert.match(shell, /data-teaching-context/);
  assert.ok(shell.indexOf("data-teaching-context") < shell.lastIndexOf("data-smart-textbook-teaching-area"));
  assert.match(shell, /learningHeaderTargets\.map/);
  assert.match(shell, /getSmartTextbookSkeletonPageLabels/);
  assert.match(shell, /learningHeaderCompletionPercent/);
  assert.doesNotMatch(shell, /targetPageCurrent|targetCompletionPercent/);
  assert.ok(shell.indexOf("data-learning-agent-blackboard") < shell.indexOf("kim-teacher-breathe"));
  assert.ok(shell.indexOf("kim-teacher-breathe") < shell.indexOf('id="korean-textbook-content"'));
  assert.match(shell, /await bufferSpeechDone;\s+if \(requestAbortController\.signal\.aborted\) return;\s+\/\/ Re-arm "loading"[\s\S]*?setTutorStatus\("idle"\);/);
});

test("金老师正式语音与台词哈希、时间轴及二维口型保持同步", async () => {
  const [migration, inheritanceMigration, speechRoute, shell, styles, provisioner, frameBuilder, scriptRuntime2] = await Promise.all([
    readFile(new URL("supabase/migrations/202608280006_add_learning_agent_script_audio_assets.sql", root), "utf8"),
    readFile(new URL("supabase/migrations/202608310001_inherit_learning_agent_script_audio.sql", root), "utf8"),
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
  assert.match(inheritanceMigration, /create or replace function public\.create_learning_agent_script_draft/);
  assert.match(inheritanceMigration, /source_node\.node_key = target_node\.node_key/);
  assert.match(inheritanceMigration, /draft_node\.node_key = source_node\.node_key/);
  assert.match(inheritanceMigration, /source_node\.teacher_script = target_node\.teacher_script/);
  assert.match(inheritanceMigration, /source_node\.configuration->'bufferLine'/);
  assert.match(inheritanceMigration, /source_asset\.object_key/);
  assert.match(inheritanceMigration, /on conflict \(script_node_id, locale, segment_index\) do nothing/);
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
  assert.match(provisioner, /HINT_SEGMENT_INDEX = 197/);
  assert.match(provisioner, /EXAMPLE_SEGMENT_INDEX = 198/);
  assert.match(provisioner, /kind: "supplemental"/);
  assert.match(scriptRuntime2, /speechSegmentIndex === 197/);
  assert.match(scriptRuntime2, /speechSegmentIndex === 198/);
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

test("黑板内容可以直接在画面框里双击编辑、选中后一键删除", async () => {
  const slideView = await readFile(
    new URL("src/components/learning-agent/TeachingBlackboardSlide.tsx", root),
    "utf8",
  );
  const blackboardEditor = await readFile(
    new URL("src/features/learning-agent-script-studio/TeachingBlackboardEditor.tsx", root),
    "utf8",
  );
  // 内容框本身可以直接双击进入编辑、选中后一键删除，不用再去右侧属性栏找——
  // 属性栏在窄屏（低于 xl 断点）时会被挤到画布下方，容易被当成“没有删除功能”。
  assert.match(slideView, /editingElementId\?: string \| null/);
  assert.match(slideView, /onElementDoubleClick\?: \(element: TeachingBlackboardElement\) => void/);
  assert.match(slideView, /onElementDelete\?: \(element: TeachingBlackboardElement\) => void/);
  assert.match(slideView, /onElementContentChange\?: \(element: TeachingBlackboardElement, content: string\) => void/);
  assert.match(slideView, /const isEditing = editingElementId === element\.id/);
  assert.match(slideView, /<textarea/);
  assert.match(slideView, /onChange=\{\(event: ReactChangeEvent<HTMLTextAreaElement>\) => \{ autosizeTextarea\(event\.currentTarget\); onElementContentChange\?\.\(element, event\.target\.value\); \}\}/);
  assert.match(slideView, /aria-label="删除这个黑板内容"/);
  assert.match(blackboardEditor, /const \[editingElementId, setEditingElementId\] = useState<string \| null>\(null\)/);
  assert.match(blackboardEditor, /function updateElementById\(elementId: string, patch: Partial<TeachingBlackboardElement>\)/);
  assert.match(blackboardEditor, /function removeElementById\(elementId: string\)/);
  assert.match(blackboardEditor, /function beginEditingElement\(element: TeachingBlackboardElement\)/);
  assert.match(blackboardEditor, /\(event\.key === "Delete" \|\| event\.key === "Backspace"\) && selectedElementId === element\.id/);
  assert.match(blackboardEditor, /onElementDoubleClick=\{beginEditingElement\}/);
  assert.match(blackboardEditor, /onElementDelete=\{\(element\) => removeElementById\(element\.id\)\}/);
  assert.match(blackboardEditor, /双击内容可直接改文字，选中后可直接删除/);
});

test("黑板画面可以放置图片和视频——素材是管理员自己放进 R2 的，这里只填对象键并校验", async () => {
  const r2 = await readFile(new URL("src/lib/r2.ts", root), "utf8");
  const blackboard = await readFile(new URL("src/lib/teaching-blackboard.ts", root), "utf8");
  const slideView = await readFile(new URL("src/components/learning-agent/TeachingBlackboardSlide.tsx", root), "utf8");
  const blackboardEditor = await readFile(new URL("src/features/learning-agent-script-studio/TeachingBlackboardEditor.tsx", root), "utf8");
  const actions = await readFile(new URL("src/app/dashboard/admin/teaching-scripts/actions.ts", root), "utf8");
  const mediaRoute = await readFile(new URL("src/app/api/learning-agent/blackboard-media/route.ts", root), "utf8");

  // 类型定义与对象键前缀约定（不再有上传大小上限——文件已经在 R2 里了，
  // 这里不负责限制大小，只负责校验它存在）。
  assert.match(blackboard, /export const TEACHING_BLACKBOARD_ELEMENT_TYPES = \["text", "bullets", "expression", "image", "video"\] as const/);
  assert.match(blackboard, /export const BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX = "blackboard\/"/);
  assert.doesNotMatch(blackboard, /MAX_TEACHING_BLACKBOARD_IMAGE_BYTES/);
  assert.doesNotMatch(blackboard, /MAX_TEACHING_BLACKBOARD_VIDEO_BYTES/);

  // r2.ts 新增一个不需要预知大小的存在性检查（跟 assertR2ObjectUpload 的
  // 区别：那个是校验"刚上传完的文件"，这个是校验"别处放进去的文件"）。
  assert.match(r2, /export async function checkR2ObjectExists\(objectKey: string\)/);
  assert.match(r2, /if \(response\.status === 404\) return \{ exists: false as const \};/);

  // 没有上传 action 了，只有一个校验 action：按 kind 检查对象键前缀，再问
  // R2 这个对象是否真的存在。
  assert.doesNotMatch(actions, /createBlackboardMediaUploadUrlAction/);
  assert.doesNotMatch(actions, /confirmBlackboardMediaUploadAction/);
  assert.match(actions, /import \{ checkR2ObjectExists, listR2Objects \} from "@\/lib\/r2"/);
  assert.match(actions, /export async function verifyBlackboardMediaObjectAction\(input: \{ objectKey: string; kind: "image" \| "video" \}\)/);
  assert.match(actions, /await requirePlatformOwner\(\);/);
  assert.match(actions, /const expectedPrefix = `\$\{BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX\}\$\{input\.kind\}\/`/);
  assert.match(actions, /if \(!objectKey\.startsWith\(expectedPrefix\)\)/);
  assert.match(actions, /const result = await checkR2ObjectExists\(objectKey\)/);
  assert.match(actions, /if \(!result\.exists\) return \{ ok: false, message: "R2 里没有找到这个对象，请检查路径是否正确。" \}/);

  // 学生端/管理端播放走同一个鉴权路由，图片走 302 重定向到签名地址，
  // 视频走代理转发（支持 Range，签名地址不直接暴露给浏览器）——
  // 跟现有的教师头像路由、教材音频路由是同一套安全模型。这部分不受这次
  // "不在这里上传"的改动影响，路由本身不知道对象是怎么放进 R2 的。
  assert.match(mediaRoute, /canUseStudentFeature\(role, normalizeMembershipTier\(profile\?\.membership_tier\), "korean_course"\)/);
  assert.match(mediaRoute, /if \(dest === "document"\)/);
  assert.match(mediaRoute, /const isImage = objectKey\.startsWith\(`\$\{BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX\}image\/`\)/);
  assert.match(mediaRoute, /const isVideo = objectKey\.startsWith\(`\$\{BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX\}video\/`\)/);
  assert.match(mediaRoute, /status: 302/);
  assert.match(mediaRoute, /const range = request\.headers\.get\("range"\)/);

  // 画面里渲染图片/视频，图片走 <img> + eslint-disable（私有动态素材，不是
  // next/image 能优化的静态资源），视频原生 controls，且视频的点击不能被
  // 拖拽逻辑吃掉。
  assert.match(slideView, /function blackboardMediaSrc\(objectKey: string\)/);
  assert.match(slideView, /eslint-disable-next-line @next\/next\/no-img-element/);
  assert.match(slideView, /<video src=\{blackboardMediaSrc\(element\.content\)\} controls onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);

  // 编辑器里没有文件选择器了；"+图片"/"+视频" 跟文字/要点一样直接加一个
  // 空内容的元素，选中后在侧栏填对象键、点"校验对象是否存在"。
  assert.doesNotMatch(blackboardEditor, /type="file"/);
  assert.doesNotMatch(blackboardEditor, /openMediaFilePicker/);
  assert.match(blackboardEditor, /if \(type === "image" \|\| type === "video"\) return \{ \.\.\.common, type, content: "", width: 60, height: 50, fontSize: 22 \};/);
  assert.match(blackboardEditor, /onClick=\{\(\) => addElement\("image"\)\}/);
  assert.match(blackboardEditor, /onClick=\{\(\) => addElement\("video"\)\}/);
  assert.match(blackboardEditor, /function verifyMediaObject\(element: TeachingBlackboardElement\)/);
  assert.match(blackboardEditor, /verifyBlackboardMediaObjectAction\(\{ objectKey, kind \}\)/);
  assert.match(blackboardEditor, /placeholder=\{`\$\{BLACKBOARD_MEDIA_OBJECT_KEY_PREFIX\}\$\{selectedElement\.type\}\/示例文件\.\$\{selectedElement\.type === "image" \? "png" : "mp4"\}`\}/);
  assert.match(blackboardEditor, /<ImageIcon size=\{14\} aria-hidden="true" \/>图片/);
  assert.match(blackboardEditor, /<VideoIcon size=\{14\} aria-hidden="true" \/>视频/);

  // 版式模板只描述文字类内容框的排版；图片/视频不参与"存为版式"，套用版式
  // 时也不能顶掉已经填好的图片/视频（按数组下标对齐会把媒体元素误判成
  // 模板槽位，把对象键覆盖掉）。
  assert.match(blackboardEditor, /const textLikeElements = selectedSlide\?\.elements\.filter\(\(element\) => element\.type !== "image" && element\.type !== "video"\) \?\? \[\]/);
  assert.match(blackboardEditor, /const mediaElements = slide\.elements\.filter\(\(element\) => element\.type === "image" \|\| element\.type === "video"\)/);
  assert.match(blackboardEditor, /elements: \[\.\.\.mapped, \.\.\.preservedTail, \.\.\.mediaElements\]/);
});

test("R2 里已有的图片/视频可以直接浏览挑选，不用凭记忆手打对象键", async () => {
  const r2 = await readFile(new URL("src/lib/r2.ts", root), "utf8");
  const actions = await readFile(new URL("src/app/dashboard/admin/teaching-scripts/actions.ts", root), "utf8");
  const blackboardEditor = await readFile(new URL("src/features/learning-agent-script-studio/TeachingBlackboardEditor.tsx", root), "utf8");

  // 用 S3 兼容的 ListObjectsV2 列出某个前缀下的对象；响应是 XML（这条链路
  // 跑在服务端，没有现成的 DOM 解析器），用正则抓 Contents/Key/Size/
  // LastModified 就够了，不为这一个调用点引入 XML 库。单页最多 1000 个，
  // 黑板素材的量级用不上翻页。
  assert.match(r2, /export async function listR2Objects\(prefix: string, maxKeys = 1000\)/);
  assert.match(r2, /url\.searchParams\.set\("list-type", "2"\)/);
  assert.match(r2, /function parseListObjectsXml\(xml: string\)/);
  assert.match(r2, /<Contents>\(\[\\s\\S\]\*\?\)<\\\/Contents>/);

  // 列表 action：按最近修改时间倒序，方便找到刚放进去的文件。
  assert.match(actions, /export async function listBlackboardMediaObjectsAction\(input: \{ kind: "image" \| "video" \}\)/);
  assert.match(actions, /const \{ objects, isTruncated \} = await listR2Objects\(prefix\)/);
  assert.match(actions, /right\.lastModified\.localeCompare\(left\.lastModified\)/);

  // 编辑器里的浏览面板：搜索框（按文件名过滤已加载的列表）、刷新、关闭，
  // 图片给缩略图、视频给通用图标，点了就把 content 设成那个对象键并关闭
  // 面板；面板只在当前选中的元素上显示（elementId 匹配）。
  assert.match(blackboardEditor, /function loadMediaBrowser\(elementId: string, kind: "image" \| "video"\)/);
  assert.match(blackboardEditor, /function selectMediaObject\(element: TeachingBlackboardElement, objectKey: string\)/);
  assert.match(blackboardEditor, /updateElementById\(element\.id, \{ content: objectKey \}\);/);
  assert.match(blackboardEditor, /function MediaBrowserPanel\(\{/);
  assert.match(blackboardEditor, /browser\.objects\.filter\(\(item\) => item\.key\.toLowerCase\(\)\.includes\(query\)\)/);
  assert.match(blackboardEditor, /mediaBrowser && mediaBrowser\.elementId === selectedElement\.id/);
  assert.match(blackboardEditor, /onClick=\{\(\) => loadMediaBrowser\(selectedElement\.id, selectedElement\.type as "image" \| "video"\)\}/);
  assert.match(blackboardEditor, /浏览 R2 里已有的\{selectedElement\.type === "image" \? "图片" : "视频"\}/);
});

test("图片/视频元素的双击编辑、无障碍标签、截断提示、kind 校验都不会踩坑", async () => {
  const actions = await readFile(new URL("src/app/dashboard/admin/teaching-scripts/actions.ts", root), "utf8");
  const slideView = await readFile(new URL("src/components/learning-agent/TeachingBlackboardSlide.tsx", root), "utf8");
  const blackboardEditor = await readFile(new URL("src/features/learning-agent-script-studio/TeachingBlackboardEditor.tsx", root), "utf8");

  // 双击（或选中后按 Enter）图片/视频元素不能进入通用文字编辑模式——content
  // 存的是 R2 对象键，不是给人看的文字，编辑要走侧栏的浏览/校验，不是画面
  // 里冒出一个显示原始对象键的 textarea。
  assert.match(blackboardEditor, /if \(element\.type === "image" \|\| element\.type === "video"\) return;\s*\n\s*setEditingElementId\(element\.id\);/);

  // 无障碍标签要说"图片"/"视频"，不能落到通用的"文字"分支去读一串对象键。
  assert.match(slideView, /element\.type === "image" \|\| element\.type === "video"/);
  assert.match(slideView, /\$\{element\.type === "image" \? "图片" : "视频"\}：\$\{element\.content \|\| "尚未设置对象键"\}/);

  // 列表超过 1000 个时不能悄悄只显示一部分还看起来像全部——用户要能看出来
  // 列表不完整。
  assert.match(blackboardEditor, /truncated\?: boolean;/);
  assert.match(blackboardEditor, /objects: result\.objects \?\? \[\], truncated: result\.truncated/);
  assert.match(blackboardEditor, /文件超过 1000 个，只显示了一部分，用搜索缩小范围。/);

  // 校验 action 也要校验 kind 本身（跟列表 action 一致）——这是一个 server
  // action，光靠 TypeScript 的参数类型不能保证运行时收到的就是合法值。
  assert.match(actions, /export async function verifyBlackboardMediaObjectAction\(input: \{ objectKey: string; kind: "image" \| "video" \}\) \{\s*\n\s*await requirePlatformOwner\(\);\s*\n\s*if \(input\.kind !== "image" && input\.kind !== "video"\) return \{ ok: false, message: "无效的素材类型。" \};/);
});
