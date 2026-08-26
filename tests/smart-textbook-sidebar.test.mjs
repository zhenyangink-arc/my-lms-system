import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx",
  import.meta.url,
);
const loaderUrl = new URL("../src/lib/smart-digital-textbook.ts", import.meta.url);
const actionsUrl = new URL(
  "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts",
  import.meta.url,
);
const recordingRouteUrl = new URL(
  "../src/app/api/digital-textbook/recordings/[activityId]/route.ts",
  import.meta.url,
);
const listenSpeakFlowMigrationUrl = new URL(
  "../supabase/migrations/202608240001_design_chapter_one_listen_speak_flow.sql",
  import.meta.url,
);
const listeningDiagnosticsMigrationUrl = new URL(
  "../supabase/migrations/202608240002_expand_chapter_one_listening_diagnostics.sql",
  import.meta.url,
);
const listeningMasterMigrationUrl = new URL(
  "../supabase/migrations/202608240003_finalize_chapter_one_listening_master.sql",
  import.meta.url,
);
const temporaryListeningAudioMigrationUrl = new URL(
  "../supabase/migrations/202608240004_publish_chapter_one_temporary_listening_audio.sql",
  import.meta.url,
);
const guidedRepeatProgressMigrationUrl = new URL(
  "../supabase/migrations/202608240030_persist_guided_repeat_progress.sql",
  import.meta.url,
);
const dialogueGroupsMigrationUrl = new URL(
  "../supabase/migrations/202608210002_add_chapter_one_orientation_dialogue_groups.sql",
  import.meta.url,
);
const orientationDiagnosticsMigrationUrl = new URL(
  "../supabase/migrations/202608210004_expand_chapter_one_orientation_diagnostics.sql",
  import.meta.url,
);
const vocabularySceneMigrationUrl = new URL(
  "../supabase/migrations/202608220001_publish_chapter_one_vocabulary_scene.sql",
  import.meta.url,
);
const wideVocabularySceneMigrationUrl = new URL(
  "../supabase/migrations/202608220002_publish_chapter_one_vocabulary_scene_wide.sql",
  import.meta.url,
);
const panoramicVocabularySceneMigrationUrl = new URL(
  "../supabase/migrations/202608220003_publish_chapter_one_vocabulary_scene_panorama.sql",
  import.meta.url,
);
const vocabularyHotspotsMigrationUrl = new URL(
  "../supabase/migrations/202608220004_position_chapter_one_vocabulary_hotspots.sql",
  import.meta.url,
);
const correctedVocabularyHotspotsMigrationUrl = new URL(
  "../supabase/migrations/202608220005_correct_chapter_one_vocabulary_hotspots.sql",
  import.meta.url,
);
const losslessVocabularySceneMigrationUrl = new URL(
  "../supabase/migrations/202608220006_publish_chapter_one_vocabulary_scene_lossless.sql",
  import.meta.url,
);
const vocabularyScene2xMigrationUrl = new URL(
  "../supabase/migrations/202608220007_publish_chapter_one_vocabulary_scene_2x.sql",
  import.meta.url,
);
const correctedTaskSceneRatioMigrationUrl = new URL(
  "../supabase/migrations/202608220009_correct_chapter_one_task_scene_aspect_ratio.sql",
  import.meta.url,
);
const removeGrammarFocusGateMigrationUrl = new URL(
  "../supabase/migrations/202608220010_remove_chapter_one_grammar_focus_gate.sql",
  import.meta.url,
);
const expandedGrammarPracticeMigrationUrl = new URL(
  "../supabase/migrations/202608220011_add_chapter_one_grammar_choice_and_judgment.sql",
  import.meta.url,
);
const grammarPunctuationMigrationUrl = new URL(
  "../supabase/migrations/202608220012_keep_grammar_punctuation_in_prompts.sql",
  import.meta.url,
);
const expandedPatternCardsMigrationUrl = new URL(
  "../supabase/migrations/202608220013_expand_chapter_one_pattern_cards.sql",
  import.meta.url,
);
const patternChoiceGroupsMigrationUrl = new URL(
  "../supabase/migrations/202608220014_add_chapter_one_pattern_choice_groups.sql",
  import.meta.url,
);
const redesignedPatternChoicesMigrationUrl = new URL(
  "../supabase/migrations/202608230001_redesign_chapter_one_pattern_choice_content.sql",
  import.meta.url,
);
const conversationalPatternChoicesMigrationUrl = new URL(
  "../supabase/migrations/202608230002_add_conversation_scenes_to_pattern_choices.sql",
  import.meta.url,
);
const guidedPatternConversationMigrationUrl = new URL(
  "../supabase/migrations/202608230003_convert_pattern_choices_to_guided_conversation.sql",
  import.meta.url,
);
const guidedConversationAudioMigrationUrl = new URL(
  "../supabase/migrations/202608230004_add_guided_conversation_audio_manifest.sql",
  import.meta.url,
);
const redesignedDialoguePagesMigrationUrl = new URL(
  "../supabase/migrations/202608230009_apply_chapter_one_dialogue_pages_to_smart_textbook.sql",
  import.meta.url,
);
const dialogueRoleplayMigrationUrl = new URL(
  "../supabase/migrations/202608230010_add_chapter_one_dialogue_roleplay.sql",
  import.meta.url,
);
const requiredDialogueRoleplayMigrationUrl = new URL(
  "../supabase/migrations/202608230011_require_chapter_one_dialogue_roleplay.sql",
  import.meta.url,
);
const recalculatedDialogueProgressMigrationUrl = new URL(
  "../supabase/migrations/202608230012_recalculate_dialogue_progress_after_roleplay_requirement.sql",
  import.meta.url,
);
const patternCompositionMigrationUrl = new URL(
  "../supabase/migrations/202608230005_add_chapter_one_pattern_composition.sql",
  import.meta.url,
);
const twoWayPatternCompositionMigrationUrl = new URL(
  "../supabase/migrations/202608230006_expand_pattern_composition_to_two_way_dialogue.sql",
  import.meta.url,
);
const patternExpressionPathMigrationUrl = new URL(
  "../supabase/migrations/202608230007_present_pattern_order_as_expression_path.sql",
  import.meta.url,
);

test("智能教材所有章节共用稳定、可操作的步骤导航骨架", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /aria-current=\{active \? "step" : undefined\}/);
  assert.match(source, /selectModule\(index\);\s*setMobilePanel\(null\);/);
  assert.match(source, /className="!w-full"/);
  assert.match(source, /break-keep/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /장 학습 경로/);
  assert.match(source, /"课程导航" : "章节导航"/);
  assert.match(source, /textbook\.modules\.map\(\(module, index\) =>/);
  assert.match(source, /const navigationTitle = textbook\.chapter\.number === 1/);
  assert.match(source, /: localize\(module\.title\);/);
  assert.match(source, /locale === "ko-KR" \? "예상" : "预计"/);
  assert.match(source, /nodeIndex === 0 \? \(/);
  assert.match(source, /<span>\{localize\(activeModule\.title\)\}<\/span>/);
  assert.match(source, /titleClassName="flex flex-wrap items-baseline gap-x-3 gap-y-1/);
  assert.match(source, /hintClassName="-ml-1"/);
  assert.match(source, /flex flex-wrap items-center gap-x-3 gap-y-2/);
  assert.doesNotMatch(source, />\{textbook\.levelCode\}</);
  assert.doesNotMatch(source, /<h1[^>]*>[\s\S]*?\{chapterLabel\} · \{localize\(textbook\.chapter\.title\)\}[\s\S]*?<\/h1>/);
  assert.doesNotMatch(source, /현재 학습|正在学习/);
  assert.doesNotMatch(source, /8단계 연동|同步八步/);
  assert.doesNotMatch(source, /当前步骤|현재 단계/);
  assert.doesNotMatch(source, /<span>\{t\.progress\}<\/span><span>\{progressPercent\}%<\/span>/);
  assert.doesNotMatch(source, /renderBottomPathNavigation/);
  assert.match(source, /const \[missionPage, setMissionPage\] = useState<0 \| 1 \| 2 \| 3>\(0\)/);
  assert.match(source, /const textbookViewStateKey = `smart-textbook-view:\$\{textbook\.id\}`/);
  assert.match(source, /window\.sessionStorage\.setItem\(textbookViewStateKey, JSON\.stringify\(\{ activeIndex, missionPage, patternPage \}\)\)/);
  assert.match(source, /const usesDesktopImagePager = nodeIndex === 0 && node\.activities\.length > 0 && Boolean\(sharedModuleSkeleton\)/);
  assert.match(source, /usesDialoguePager && missionPage >= 2/);
  assert.match(source, /const \[nodeProgressById, setNodeProgressById\] = useState<Record<string, number>>/);
  assert.match(source, /const targetCompletionPercent = completedNodeIds\.has\(node\.id\) \? 100/);
  assert.match(source, /aria-label=\{locale === "ko-KR" \? "현재 목표 실제 완료율" : "当前目标实际完成度"\}/);
  assert.match(source, /\{targetCompletionPercent\}%<\/span>/);
  assert.match(source, /h-1\.5 w-20/);
  assert.match(source, /usesPatternPager \? patternPage !== 2 : usesDialoguePager \? missionPage !== 2 : usesReadWritePager/);
  assert.match(source, /aria-label=\{locale === "ko-KR" \? "학습 목표 페이지" : "学习目标分页"\}/);
  assert.match(source, /className="mb-6 mt-6 hidden items-center justify-between gap-4 rounded-2xl/);
  assert.match(source, /usesPatternPager \? patternPage === 0 : missionPage === 0/);
  assert.match(source, /usesPatternPager \? patternPage === 1 : missionPage === 1/);
  assert.doesNotMatch(source, /className="mt-6 hidden items-center justify-between border-t/);
  assert.match(source, /usesPatternPager \? patternPage \+ 1 : missionPage \+ 1/);
  assert.match(source, /locale === "ko-KR" \? "장면 진단" : "情景诊断"/);
  assert.match(source, /title=\{isGrammarPractice \?[\s\S]*: activity\.prompt\[locale\]\}/);
  assert.match(source, /description=\{activity\.instruction\[locale\]\}/);
  assert.match(source, /hintLabel=\{locale === "ko-KR" \? "문제 풀이 안내 보기" : "查看答题说明"\}/);
  assert.doesNotMatch(source, /<p className="mt-1 text-sm text-\[var\(--foreground-secondary\)\]">\{activity\.instruction\[locale\]\}<\/p>/);
  assert.match(source, /font-medium text-\[var\(--foreground\)\]">\{option\}/);
  assert.match(source, /font-mono text-xs text-\[var\(--foreground-muted\)\]/);
  assert.doesNotMatch(source, /font-medium text-slate-800">\{option\}/);
});

test("核心词汇等带图模块复用情景与表达双页导航", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const usesDesktopImagePager = nodeIndex === 0 && node\.activities\.length > 0 && Boolean\(sharedModuleSkeleton\)/);
  assert.match(source, /\{usesDesktopImagePager && \(/);
  assert.match(source, /!usesPatternPager && !usesDialoguePager && missionPage === 1/);
  assert.match(source, /usesPatternPager \? patternPage !== 2 : usesDialoguePager \? missionPage !== 2 : usesReadWritePager/);
  assert.match(source, /locale === "ko-KR" \? "장면과 표현" : "情景与表达"/);
  assert.match(source, /locale === "ko-KR" \? "이 목표" : "本目标"/);
});

test("核心词汇情景诊断直接显示卡片并取消专注模式门槛", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const usesFocusMode = activity\.config\.focusMode === true && !usesFlipCards/);
  assert.match(source, /usesFlipCards && \(!usesFocusMode \|\| practiceFocused\)/);
  assert.doesNotMatch(source, /遮住词汇表再开始练习/);
  assert.doesNotMatch(source, /上面的核心词汇表会被完全遮住/);
  assert.doesNotMatch(source, /核心词汇专注练习/);
});

test("智能教材共享骨架从私有 R2 加载已就绪的情景图片", async () => {
  const [source, loader] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(loaderUrl, "utf8"),
  ]);

  assert.match(loader, /purpose,object_key,production_status/);
  assert.match(loader, /createR2SignedObjectUrl\(String\(asset\.object_key\)\)/);
  assert.match(loader, /url: mediaUrls\.get\(String\(asset\.id\)\) \?\? null/);
  assert.match(source, /asset\.status === "ready" && asset\.url/);
  assert.doesNotMatch(source, /max-w-\[860px\]/);
  assert.match(source, /className="h-full w-full object-cover object-center"/);
  assert.doesNotMatch(source, /className="h-auto max-h-\[520px\] w-full object-cover"/);
  assert.match(source, /sceneImage\.altText\[locale\]/);
  assert.match(source, /aspect-\[4\/3\].*sm:aspect-\[5\/2\]/);
  assert.match(source, /bg-gradient-to-t from-black\/60 via-black\/15 to-transparent/);
  assert.match(source, /\[text-shadow:0_1px_3px_rgb\(0_0_0_\/_0\.9\)\]/);
  assert.match(source, /<figcaption className="absolute inset-x-0 bottom-0/);
  assert.match(source, /absolute right-5 top-4.*moduleHeader\.title/s);
  assert.match(source, /const hasIntegratedImageHeader = nodeIndex === 0 && hasReadyImage/);
  assert.match(source, /!hasIntegratedImageHeader && <div/);
  assert.match(source, /const sceneDialogueLines = activeDialogueGroupLines\s*\.map\(\(line\) => String\(line\.ko/);
  assert.match(source, /speakKoreanSequence\(scenePlaybackLines/);
  assert.match(source, /left-\[28%\] top-\[5%\]/);
  assert.match(source, /right-\[24%\] top-\[18%\]/);
  assert.match(source, /onClick=\{\(\) => speakKorean\(leftSceneDialogue\)\}/);
  assert.match(source, /const \[sceneDialogueStep, setSceneDialogueStep\] = useState\(0\)/);
  assert.match(source, /const \[sceneDialoguePlaying, setSceneDialoguePlaying\] = useState\(false\)/);
  assert.match(source, /onStep: \(index\) => setSceneDialogueStep\(index \+ 1\)/);
  assert.match(source, /const leftSceneDialogue = visibleSceneDialogueLines/);
  assert.match(source, /const rightSceneDialogue = visibleSceneDialogueLines/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*setSceneDialogueStep\(0\);[\s\S]*\}, 5000\)/);
  assert.match(source, /aria-label=\{locale === "ko-KR" \? "장면 대화 재생" : "播放情景对话"\}/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /translate-x-\[1%\] scale-\[1\.03\]/);
  assert.match(source, /motion-reduce:transform-none/);
  assert.match(source, /sceneDialoguePlaying \? "animate-pulse motion-reduce:animate-none"/);
  assert.match(source, /String\(coach\[locale\].*<span className="block">\{String\(coach\[locale\]\)\}<\/span>/s);
  assert.doesNotMatch(source, /border-t border-white\/30 pt-3/);
  assert.match(source, /Number\(asset\.metadata\.width\) \|\| 1600/);
});

test("本课可调用表达由真实对话组驱动并保留共享骨架回退", async () => {
  const [source, migration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(dialogueGroupsMigrationUrl, "utf8"),
  ]);

  assert.match(source, /Array\.isArray\(content\.dialogueGroups\)/);
  assert.match(source, /configuredDialogueGroups\.length > 0/);
  assert.match(source, /lines: targets/);
  assert.match(source, /activeDialogueGroupLines\.map/);
  assert.match(source, /aria-pressed=\{active\}/);
  assert.match(source, /playSceneDialogue/);
  assert.match(source, /const \[guidedDialogueIndex, setGuidedDialogueIndex\] = useState<number \| null>\(null\)/);
  assert.match(source, /const playGuidedDialogueLine = \(index: number\) =>/);
  assert.match(source, /hidden min-h-11 items-center gap-2[\s\S]*sm:flex/);
  assert.match(source, /locale === "ko-KR" \? "한 문장씩 따라 하기" : "逐句跟读"/);
  assert.match(source, /aria-current=\{activeLine \? "true" : undefined\}/);
  assert.match(source, /sm:border-\[var\(--primary\)\] sm:bg-\[var\(--accent\)\] sm:shadow-sm/);
  assert.match(source, /title=\{t\.phrases\}[\s\S]*description=\{locale === "ko-KR" \? "대화 묶음을 고르고/);
  assert.match(source, /hintLabel=\{locale === "ko-KR" \? "대화 재생 방법 보기" : "查看对话播放说明"\}/);
  assert.doesNotMatch(source, /<p className="mt-2 text-sm leading-6 text-\[var\(--foreground-secondary\)\]">\s*\{locale === "ko-KR" \? "대화 묶음을 고르고/);
  assert.match(migration, /"id": "complete-first-meeting"/);
  assert.match(migration, /"title": \{"zh-CN": "完整对话"/);
  assert.equal((migration.match(/"speaker":/g) ?? []).length, 14);
  assert.match(migration, /"ko": "네, 저도 만나서 반가워요\."/);
});

test("实战对话使用四页角色练习并覆盖第一章十二个核心词", async () => {
  const [source, actions, migration, roleplayMigration, requiredRoleplayMigration, recalculatedProgressMigration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(actionsUrl, "utf8"),
    readFile(redesignedDialoguePagesMigrationUrl, "utf8"),
    readFile(dialogueRoleplayMigrationUrl, "utf8"),
    readFile(requiredDialogueRoleplayMigrationUrl, "utf8"),
    readFile(recalculatedDialogueProgressMigrationUrl, "utf8"),
  ]);

  assert.match(source, /const usesDialoguePager = Array\.isArray\(node\.content\.dialogueScenes\)/);
  assert.match(source, /round=\{usesGrammarPager \|\| usesPatternPager \|\| usesDialoguePager \|\| usesListenSpeakPager \|\| usesReadWritePager \|\| usesReviewPager \? undefined/);
  assert.match(source, /if \(!window\.isSecureContext\)/);
  assert.match(source, /当前页面使用 HTTP，浏览器已阻止麦克风/);
  assert.doesNotMatch(source, /正在安全保存到 Cloudflare R2/);
  assert.match(source, /正在保存录音…/);
  assert.match(source, /正在说话…/);
  assert.match(source, /<Mic size=\{17\} className="animate-pulse motion-reduce:animate-none"/);
  assert.match(source, /结束录音/);
  assert.match(source, /const cancelRecording = \(\) =>/);
  assert.match(source, /cancelRecordingRef\.current = true/);
  assert.match(source, /function RoleplayRecordingPlayer/);
  assert.match(source, /dialogue-recording-\$\{recording\.evidenceId\}\.webm/);
  assert.match(source, /确定删除本轮录音吗/);
  assert.doesNotMatch(source, /<audio src=\{recordings\[currentLineIndex\]\.audioUrl\} controls/);
  assert.match(source, /"对话说明"/);
  assert.match(source, /"场景切换"/);
  assert.match(source, /"理解与回应"/);
  assert.match(source, /onClick=\{\(\) => setMissionPage\(2\)\}/);
  assert.match(source, /"角色实战"/);
  assert.match(source, /onClick=\{\(\) => setMissionPage\(3\)\}/);
  assert.match(source, /DialogueRoleplayPractice/);
  assert.match(source, /const \[roleSide, setRoleSide\] = useState<0 \| 1>\(0\)/);
  assert.match(source, /onClick=\{\(\) => resetPractice\(index, 0\)\}/);
  assert.match(source, /speechContentMatch/);
  assert.match(source, /对话内容匹配度 · 不代表发音分数/);
  assert.match(source, /completeDialogueRoleplayAction/);
  assert.match(source, /if \(completionSaved \|\| !scene\.id\) return/);
  assert.match(source, /completionSyncKeysRef\.current\.has\(syncKey\)/);
  assert.match(source, /sceneId: String\(scene\.id\)/);
  assert.match(source, /必需录音已全部保存/);
  assert.match(source, /const \[opponentTextReady, setOpponentTextReady\] = useState\(false\)/);
  assert.match(source, /const \[opponentAudioReady, setOpponentAudioReady\] = useState\(false\)/);
  assert.match(source, /const \[dialogueStarted, setDialogueStarted\] = useState\(false\)/);
  assert.match(source, /const dialogueTurnReady = dialogueStarted && \(precedingOpponentIndex === null \|\| \(opponentTextReady && opponentAudioReady\)\)/);
  assert.match(source, /准备好后开始对话/);
  assert.match(source, /点击后，对方台词将逐字显示并同步朗读/);
  assert.match(source, /onClick=\{\(\) => setDialogueStarted\(true\)\}/);
  assert.match(source, /setDialogueStarted\(false\)/);
  assert.match(source, /if \(!dialogueStarted\) return/);
  assert.match(source, /disabled=\{uploading \|\| !dialogueStarted\}/);
  assert.match(source, /请先开始对话/);
  assert.match(source, /const utterance = new SpeechSynthesisUtterance\(text\)/);
  assert.match(source, /utterance\.lang = "ko-KR"/);
  assert.match(source, /window\.speechSynthesis\.speak\(utterance\)/);
  assert.match(source, /重复播放：\$\{String\(line\.ko/);
  assert.match(source, /重复播放本轮目标句/);
  assert.match(source, /const playDialogueLine = \(lineIndex: number\) =>/);
  assert.match(source, /const learnerRecording = lineIndex % 2 === roleSide \? recordings\[lineIndex\] : undefined/);
  assert.match(source, /const audio = new Audio\(learnerRecording\.audioUrl\)/);
  assert.match(source, /回听我的录音/);
  assert.match(source, /speechWindow\.SpeechRecognition \?\? speechWindow\.webkitSpeechRecognition/);
  assert.match(source, /const recognitionSettled = new Promise<void>/);
  assert.match(source, /await Promise\.race\(\[/);
  assert.match(source, /window\.setTimeout\(resolve, 2_500\)/);
  assert.match(source, /recognition\.onend = \(\) => settleRecognition\(\)/);
  assert.match(source, /<TypewriterText text=\{text\} speed=\{48\}/);
  assert.match(source, /onComplete=\{index === precedingOpponentIndex \? \(\) => setOpponentTextReady\(true\)/);
  assert.match(source, /const dialogueFlow = Array\.isArray\(content\.dialogueFlow\)/);
  assert.match(source, /contentPage === 0/);
  assert.match(source, /\{renderDialogueSceneImage\(\)\}/);
  assert.doesNotMatch(source, /renderDialogueSceneImage\(true\)/);
  assert.match(source, /role="tablist" aria-label=\{locale === "ko-KR" \? "대화 장면 선택" : "选择对话场景"\}/);
  assert.match(source, /currentSceneCoverage\.map/);
  assert.match(source, /activeDialogueGroupLines\.map/);
  assert.match(migration, /"words":\["처음","만나다","인사하다"\]/);
  assert.match(migration, /"words":\["저","이름","소개하다","한국어"\]/);
  assert.match(migration, /"words":\["학생","선생님","친구","사람"\]/);
  assert.match(migration, /"words":\["반갑다"\]/);
  assert.match(migration, /chapter-01-dialogue-main-line-01/);
  assert.match(migration, /chapter-01-dialogue-alt-line-06/);
  assert.match(migration, /production_status = 'pending'/);
  assert.match(roleplayMigration, /'dialogue-roleplay'/);
  assert.match(roleplayMigration, /"storage":"cloudflare_r2"/);
  assert.match(roleplayMigration, /"pronunciationScore":false/);
  assert.match(roleplayMigration, /counts_toward_completion/);
  assert.match(actions, /requiredTurns\.every\(\(turn\) => recordedTurns\.has\(turn\)\)/);
  assert.match(actions, /p_meets_completion_requirements: true/);
  assert.match(actions, /p_is_correct: null/);
  assert.match(actions, /\.eq\("meets_completion_requirements", true\)/);
  assert.match(actions, /if \(existingAttempt\)/);
  assert.match(requiredRoleplayMigration, /counts_toward_completion = true/);
  assert.match(requiredRoleplayMigration, /'completionRequirement', 'all_role_turns_recorded'/);
  assert.match(requiredRoleplayMigration, /'scoreRequired', false/);
  assert.match(recalculatedProgressMigration, /attempt\.is_correct is true/);
  assert.match(recalculatedProgressMigration, /then 'completed'\s+else 'in_progress'/);
});

test("角色实战重录替换同一话轮的旧 R2 录音", async () => {
  const route = await readFile(recordingRouteUrl, "utf8");

  assert.match(route, /\.contains\("metadata", \{ sceneId, roleSide, turnIndex \}\)/);
  assert.match(route, /await deleteR2Object\(previous\.object_key\)/);
  assert.match(route, /\.delete\(\)\s*\.in\("id", removedEvidenceIds\)/);
  assert.match(route, /Keep the database row when object deletion fails/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /Completed practice recordings cannot be deleted/);
  assert.match(route, /await deleteR2Object\(evidence\.object_key\)/);
});

test("第一章情景诊断以三道题区分明确信息和未提及信息", async () => {
  const migration = await readFile(orientationDiagnosticsMigrationUrl, "utf8");

  assert.match(migration, /"key":"orientation-check"/);
  assert.match(migration, /"key":"orientation-jimin-occupation"/);
  assert.match(migration, /"key":"orientation-wangming-occupation"/);
  assert.match(migration, /智敏的身份／职业是什么/);
  assert.match(migration, /王明的身份／职业是什么/);
  assert.match(migration, /"options":\["학생","선생님","회사원","없음"\]/);
  assert.match(migration, /"answer":\{"kind":"index","value":3\}/);
  assert.match(migration, /不要因为智敏是学生就推测王明也是学生/);
});

test("核心词汇情景图覆盖数据库中的十二个现有词", async () => {
  const migration = await readFile(vocabularySceneMigrationUrl, "utf8");

  assert.match(migration, /vocabulary-scene-v1\.webp/);
  assert.match(migration, /production_status = 'ready'/);
  assert.match(migration, /node\.node_code = 'people-and-greetings'/);
  for (const word of [
    "저", "이름", "학생", "선생님", "친구", "사람",
    "만나다", "인사하다", "소개하다", "한국어", "처음", "반갑다",
  ]) {
    assert.match(migration, new RegExp(`'${word}'`));
  }
});

test("旧版核心词汇横图迁移保留且共享骨架统一使用场景画框", async () => {
  const [source, migration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(wideVocabularySceneMigrationUrl, "utf8"),
  ]);

  assert.match(migration, /vocabulary-scene-v2\.webp/);
  assert.match(migration, /'width', 1600/);
  assert.match(migration, /'height', 900/);
  assert.match(migration, /'aspectRatio', '16:9'/);
  assert.match(source, /className="h-full w-full object-cover object-center"/);
  assert.doesNotMatch(source, /max-w-\[860px\]/);
});

test("核心词汇源图保留二比一高分辨率媒体", async () => {
  const migration = await readFile(panoramicVocabularySceneMigrationUrl, "utf8");

  assert.match(migration, /vocabulary-scene-v3\.webp/);
  assert.match(migration, /'width', 1800/);
  assert.match(migration, /'height', 900/);
  assert.match(migration, /'aspectRatio', '2:1'/);
});

test("核心词汇画框与课前导航统一为桌面五比二", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /aspect-\[4\/3\].*sm:aspect-\[5\/2\]/);
  assert.match(source, /className="h-full w-full object-cover object-center"/);
});

test("任务情景图按生成原图五比二等比导出，禁止纵向拉伸", async () => {
  const [source, migration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(correctedTaskSceneRatioMigrationUrl, "utf8"),
  ]);

  assert.match(source, /sm:aspect-\[5\/2\]/);
  assert.match(source, /className="h-full w-full object-cover object-center"/);
  assert.match(migration, /'width', 3600/);
  assert.match(migration, /'height', 1440/);
  assert.match(migration, /'aspectRatio', '5:2'/);
  assert.match(migration, /'proportionalScale', true/);
});

test("语法节点使用理解与练习双页，并逐项切换真实语法卡", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const usesGrammarPager = Array\.isArray\(node\.content\.grammarCards\)/);
  assert.match(source, /"语法理解"/);
  assert.match(source, /function GrammarClassroomBoard/);
  assert.match(source, /语法课堂黑板/);
  assert.match(source, /xl:grid-cols-\[minmax\(340px,\.4fr\)_minmax\(0,\.6fr\)\]/);
  assert.match(source, /usesGrammarPager && missionPage === 1 && <GrammarClassroomBoard/);
  assert.match(source, /"语法练习"/);
  assert.match(source, /activeGrammarCardIndex/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /grammarCards\.map\(\(item, index\)/);
  assert.match(source, /易错点与来源/);
  assert.doesNotMatch(source, /例句音频待制作/);
});

test("句型操练使用句型库、替换操练与组合输出三页共享骨架", async () => {
  const [source, loader, migration, choiceMigration, redesignedChoices, conversationScenes, guidedConversation, guidedAudio, composition, twoWayComposition, expressionPath, submission] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(loaderUrl, "utf8"),
    readFile(expandedPatternCardsMigrationUrl, "utf8"),
    readFile(patternChoiceGroupsMigrationUrl, "utf8"),
    readFile(redesignedPatternChoicesMigrationUrl, "utf8"),
    readFile(conversationalPatternChoicesMigrationUrl, "utf8"),
    readFile(guidedPatternConversationMigrationUrl, "utf8"),
    readFile(guidedConversationAudioMigrationUrl, "utf8"),
    readFile(patternCompositionMigrationUrl, "utf8"),
    readFile(twoWayPatternCompositionMigrationUrl, "utf8"),
    readFile(patternExpressionPathMigrationUrl, "utf8"),
    readFile(new URL("../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts", import.meta.url), "utf8"),
  ]);

  assert.match(source, /const usesPatternPager = activeModule\.code === "patterns" && node\.activities\.some\(\(activity\) => activity\.type === "ordering"\)/);
  assert.match(source, /"句型库"/);
  assert.match(source, /"替换操练"/);
  assert.match(source, /"组合输出"/);
  assert.match(source, /content\.substitutionGroups/);
  assert.match(source, /content\.quickResponse/);
  assert.match(source, /content\.personalOutput/);
  assert.match(source, /patternPage === 2/);
  assert.match(source, /checkPatternChoiceGroup/);
  assert.match(source, /patternChoiceChecks/);
  assert.match(source, /hintLabel=\{locale === "ko-KR" \? "문형 기능 보기" : "查看句型用途"\}/);
  assert.match(source, /activePatternCardIndex/);
  assert.match(source, /visitedPatternCardIndices/);
  assert.match(source, /const selectPatternCard = \(\) =>/);
  assert.match(source, /visitedIndex <= index/);
  assert.match(source, /onClick=\{selectPatternCard\}/);
  assert.match(source, /hasVisited && <CheckCircle2/);
  assert.match(source, /aria-expanded=\{isActive\}/);
  assert.match(source, /grid-cols-\[48px_minmax\(0,1fr\)\]/);
  assert.doesNotMatch(source, /<p className="mt-2 text-sm font-semibold leading-6 text-\[var\(--foreground-secondary\)\]">\{String\(objectValue\(card\.function\)\[locale\]/);
  assert.doesNotMatch(source, /aria-label=\{locale === "ko-KR" \? "예문 듣기" : "播放例句"\}/);
  assert.equal((migration.match(/\"form\":/g) ?? []).length, 4);
  assert.match(migration, /저는 \[이름\]이에요\/예요\./);
  assert.match(migration, /\[이름\] 씨는 \[신분\]이에요\/예요\?/);
  assert.equal((choiceMigration.match(/\"id\":\"(?:name|identity|confirm)-[123]\"/g) ?? []).length, 9);
  assert.match(choiceMigration, /"kind":"index_array","value":\[0,1,0,0,1,0,0,1,0\]/);
  assert.equal((redesignedChoices.match(/\"id\":\"(?:name|identity|confirm)-[123]\"/g) ?? []).length, 9);
  assert.match(redesignedChoices, /"kind":"index_array","value":\[0,1,2,1,2,0,2,0,1\]/);
  assert.match(redesignedChoices, /저는 왕밍이에요\./);
  assert.match(redesignedChoices, /지민 씨는 학생이에요\?/);
  assert.doesNotMatch(redesignedChoices, /"options":\["이에요","예요","은","는"\]/);
  assert.match(source, /localizedQuestion/);
  assert.match(source, /activePatternQuestionIndex/);
  assert.match(source, /选择一句放入对话气泡/);
  assert.match(source, /xl:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(360px,\.85fr\)\]/);
  assert.match(source, /answerSide === "left"/);
  assert.match(conversationScenes, /"zh-CN":"介绍姓名"/);
  assert.match(conversationScenes, /"zh-CN":"介绍身份"/);
  assert.match(conversationScenes, /"zh-CN":"询问对方"/);
  assert.equal((conversationScenes.match(/"answerSide":/g) ?? []).length, 9);
  assert.match(submission, /const groupedItems = asArray\(config\.groups\)\.flatMap/);
  assert.match(source, /function TypewriterText/);
  assert.match(source, /conversationScrollRef/);
  assert.match(source, /container\.scrollTop = container\.scrollHeight/);
  assert.match(source, /onProgress=\{scrollConversationToLatest\}/);
  assert.match(source, /voiceReadingEnabled/);
  assert.match(source, /role="switch" aria-checked=\{voiceReadingEnabled\}/);
  assert.match(source, /activeSpokenLine/);
  assert.match(source, /speakKorean\(activeSpokenLine\)/);
  assert.match(source, /new Audio\(activeAudioUrl\)/);
  assert.match(source, /asset\.purpose === "guided-conversation-line"/);
  assert.match(source, /function PatternConversationPractice/);
  assert.match(source, /checkSmartTextbookActivityPageAction\(\{ activityId: activity\.id, itemIndices: \[currentChoiceIndex\]/);
  assert.match(source, /patternConversationSteps\.length > 0/);
  assert.equal((guidedConversation.match(/"kind":"choice"/g) ?? []).length, 4);
  assert.equal((guidedConversation.match(/"kind":"line"/g) ?? []).length, 4);
  assert.match(guidedConversation, /"kind":"index_array","value":\[0,1,2,3\]/);
  assert.doesNotMatch(guidedConversation, /"groups"/);
  assert.match(guidedAudio, /'guided-conversation-line'/);
  assert.match(guidedAudio, /'korean-level-one\/chapter-01\/patterns\/guided-dialogue\/'/);
  assert.match(guidedAudio, /'storage', 'cloudflare-r2'/);
  assert.match(guidedAudio, /'audioAssetKey'/);
  assert.match(source, /function PatternCompositionPractice/);
  assert.match(source, /activity\.key === "pattern-compose"/);
  assert.match(source, /!\["pattern-choice", "pattern-order", "pattern-compose"\]\.includes\(activity\.key\)/);
  assert.match(source, /patternOutputTask/);
  assert.match(source, /role="tablist" aria-label=\{locale === "ko-KR" \? "조합 출력 과제" : "组合输出任务"\}/);
  assert.match(source, /自我介绍顺序/);
  assert.match(source, /双向对话组合/);
  assert.match(source, /hidden=\{patternOutputTask !== 0\}/);
  assert.match(source, /hidden=\{patternOutputTask !== 1\}/);
  assert.match(loader, /\.select\("activity_id,response,created_at"\)/);
  assert.match(loader, /completedActivityResponses/);
  assert.match(loader, /\.or\("is_correct\.eq\.true,meets_completion_requirements\.eq\.true"\)/);
  assert.match(source, /const savedAnswers = stringArray\(activity\.response\)/);
  assert.match(source, /activity\.completed && savedAnswers\.length === steps\.length/);
  assert.match(source, /complete \? <div className="flex min-h-\[370px\] flex-col items-center justify-center text-center"/);
  assert.match(source, /if \(voiceReadingEnabled\) speakKorean\(assembled\)/);
  assert.ok((source.match(/role="switch" aria-checked=\{voiceReadingEnabled\}/g) ?? []).length >= 2);
  assert.match(source, /语块顺序还不自然/);
  assert.match(composition, /'pattern-compose'/);
  assert.match(composition, /"kind":"text_array"/);
  assert.equal((composition.match(/"id":"(?:greeting-name|identity-answer|ask-back|closing)"/g) ?? []).length, 4);
  assert.equal((twoWayComposition.match(/"id":"(?:greeting-name|ask-name|ask-identity|answer-identity|ask-nationality|closing)"/g) ?? []).length, 6);
  assert.match(twoWayComposition, /不仅回答对方，也要主动询问姓名、身份和国籍／地区/);
  assert.match(twoWayComposition, /delete from public\.digital_textbook_attempts/);
  assert.match(source, /usesExpressionPath/);
  assert.match(source, /自我介绍表达路径/);
  assert.match(source, /removeExpressionPathItem/);
  assert.match(source, /"整段朗读"/);
  assert.match(expressionPath, /"presentation":"expression_path"/);
  assert.equal((expressionPath.match(/"id":"(?:greeting|name|identity|closing)"/g) ?? []).length, 4);
  assert.match(submission, /const conversationItems = asArray\(asObject\(config\.conversation\)\.steps\)/);
});

test("语法图片按数据库例句数组逐句播放并在五秒后隐藏", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const grammarExampleLines = grammarCards\.flatMap/);
  assert.match(source, /const scenePlaybackLines = grammarExampleLines\.length > 0/);
  assert.match(source, /speakKoreanSequence\(scenePlaybackLines/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /\}, 5000\)/);
  assert.match(source, /连续播放语法例句/);
  assert.match(source, /activeScenePlaybackLine/);
});

test("第一章语法练习直接显示六题，不再要求开始专注练习", async () => {
  const migration = await readFile(removeGrammarFocusGateMigrationUrl, "utf8");

  assert.match(migration, /public_config.*- 'focusMode'/s);
  assert.match(migration, /node\.node_code = 'topic-and-copula'/);
  assert.match(migration, /activity\.activity_key = 'grammar-fill'/);
});

test("语法填空按数据库分组生成练习分页，不再展示轮次分隔标题", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const fillBlankPages = configItems\.reduce/);
  assert.match(source, /locale === "ko-KR" \? "문법 연습 페이지" : "语法练习分页"/);
  assert.match(source, /setActiveFillBlankPage\(\(page\) => page \+ 1\)/);
  assert.match(source, /grammarPageOffset \+ activeGrammarPage \+ 1/);
  assert.match(source, /originalIndex/);
  assert.doesNotMatch(source, />\{group\}<\/span>/);
});

test("第一章语法练习连续六页并逐页检查与按需查看答案", async () => {
  const [source, migration, punctuationMigration, actions] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(expandedGrammarPracticeMigrationUrl, "utf8"),
    readFile(grammarPunctuationMigrationUrl, "utf8"),
    readFile(actionsUrl, "utf8"),
  ]);

  assert.doesNotMatch(source, /"语法练习类型"/);
  assert.doesNotMatch(source, /locale === "ko-KR" \? "선택" : "选择"/);
  assert.match(source, /\["choice", "judgment", "fill"\]\.includes/);
  assert.match(source, /practiceKind === "judgment"/);
  assert.match(source, /const groupedChoicePages = configItems\.reduce/);
  assert.match(source, /grammarPageOffset \+ activeGrammarPage \+ 1/);
  assert.match(source, /checkSmartTextbookActivityPageAction/);
  assert.match(source, /"检查答案"/);
  assert.match(source, /"查看答案"/);
  assert.match(source, /activePageCheck\.results\.every\(Boolean\)/);
  assert.match(source, /const activePageCompleted = Boolean/);
  assert.match(source, /const activePageReady = activityCompleted \|\| activePageCompleted/);
  assert.match(source, /activityCompleted \|\| \(isPagedChoicePractice && activePageCompleted\)/);
  assert.match(source, /isPagedChoicePractice && \(isListeningQuiz \|\| isLastGrammarActivity\) && isLastGrammarPracticePage && activityCompleted/);
  assert.match(source, /if \(!activityCompleted\) submit\(\)/);
  assert.match(source, /\(isListeningQuiz \|\| isLastGrammarActivity\) && isLastGrammarPracticePage && result\.results\.every\(Boolean\)/);
  assert.match(source, /locale === "ko-KR" \? "전체 완료" : "全部完成"/);
  assert.match(source, /<CheckCircle2 size=\{18\} aria-label=/);
  assert.match(source, /<XCircle size=\{18\} aria-label=/);
  assert.match(source, /isPagedChoicePractice && !activePageCheck/);
  assert.match(actions, /const pageCheckSchema = z\.object/);
  assert.match(actions, /digital_textbook_activity_secrets/);
  assert.match(actions, /refreshStudentHomeLearningData/);
  assert.doesNotMatch(actions, /refreshStudentHomeLearning\(\{/);
  assert.match(source, /event\.isComposing/);
  assert.match(source, /input, textarea, select, \[contenteditable='true'\]/);
  assert.match(migration, /'grammar-choice'/);
  assert.match(migration, /'grammar-judgment'/);
  assert.match(punctuationMigration, /지민 씨는 학생___\?/);
  assert.match(punctuationMigration, /리나 씨는 의사___\?/);
  assert.match(punctuationMigration, /"value":\["예요","은","이에요","이에요","는","예요"\]/);
  assert.doesNotMatch(punctuationMigration, /"value":\["예요","은","이에요\?"/);
  assert.match(migration, /'\{"kind":"index_array","value":\[0,1,0,1,0,1\]\}'/);
  assert.match(migration, /'\{"kind":"index_array","value":\[0,1,0,1,1,0\]\}'/);
  assert.equal((migration.match(/\"id\":\"choice-/g) ?? []).length, 6);
  assert.equal((migration.match(/\"id\":\"judgment-/g) ?? []).length, 6);
  assert.match(migration, /set sort_order = 3/);
});

test("带情景图的共享模块标题显示在图片右上角", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const hasIntegratedImageHeader = nodeIndex === 0 && hasReadyImage/);
  assert.match(source, /!hasIntegratedImageHeader && <div/);
  assert.match(source, /absolute right-5 top-4 z-10/);
  assert.match(source, /\{moduleHeader\.title\}/);
  assert.match(source, /\{moduleHeader\.stepLabel\}/);
  assert.match(source, /text-shadow:0_1px_3px_rgb\(0_0_0_\/_0\.9\).*sm:right-7 sm:top-6/);
  assert.match(source, /titleClassName="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg font-bold"/);
  assert.doesNotMatch(source, /titleClassName="flex flex-wrap items-baseline justify-end gap-x-2\.5 gap-y-0\.5 text-sm font-bold"/);
});

test("核心词汇图片按真实数组逐项朗读并保留无热点回退位置", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /"bottom-4 left-5 slide-in-from-bottom-2 sm:bottom-5 sm:left-6"/);
  assert.match(source, /const playVocabularySequence = \(\) =>/);
  assert.match(source, /const playableWords = vocabulary\.filter/);
  assert.match(source, /const utterances = \[String\(word\.ko\), String\(word\.collocation/);
  assert.match(source, /\{String\(activeVocabulary\.ko\)\}/);
  assert.match(source, /\{String\(activeVocabulary\.collocation\)\}/);
  assert.match(source, /lang="ko"/);
  assert.match(source, /setVocabularyPlaybackIndex\(null\);[\s\S]*\}, 5000\)/);
  assert.match(source, /aria-label=\{locale === "ko-KR" \? "핵심 어휘와 결합 표현 연속 재생" : "连续播放核心词汇与搭配短句"\}/);
  assert.doesNotMatch(source, /vocabularyPlaying \? "scale-\[1\.025\]" : "scale-100"/);
  assert.match(source, /priority=\{Boolean\(moduleHeader\)\}/);
  assert.match(source, /vocabulary\.length === 0 && !sceneImage && String\(lead\[locale\]/);
  assert.match(source, /utterance\.onerror = \(\) => window\.setTimeout/);
  assert.match(source, /utteranceIndex === 0 \? 900 : 1400/);
});

test("核心词汇主图使用无损 WebP 并取消整图缩放", async () => {
  const [source, migration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(losslessVocabularySceneMigrationUrl, "utf8"),
  ]);

  assert.match(migration, /vocabulary-scene-v4\.webp/);
  assert.match(migration, /'encoding', 'lossless-webp'/);
  assert.match(migration, /'width', 1800/);
  assert.match(migration, /'height', 900/);
  assert.doesNotMatch(source, /scale-\[1\.025\]/);
});

test("核心词汇主图发布三千六百像素的高分屏资源", async () => {
  const migration = await readFile(vocabularyScene2xMigrationUrl, "utf8");

  assert.match(migration, /vocabulary-scene-v5-2x\.webp/);
  assert.match(migration, /'width', 3600/);
  assert.match(migration, /'height', 1800/);
  assert.match(migration, /'density', '2x'/);
  assert.match(migration, /'detailEnhanced', true/);
});

test("问候词热点停留在左下方见面人物而非右下角", async () => {
  const migration = await readFile(correctedVocabularyHotspotsMigrationUrl, "utf8");

  assert.match(migration, /'반갑다',\s+jsonb_build_object\('left', 48, 'top', 82\)/);
  assert.match(migration, /'인사하다',\s+jsonb_build_object\('left', 31, 'top', 82\)/);
  assert.match(migration, /'한국어',\s+jsonb_build_object\('left', 69, 'top', 84\)/);
});

test("核心词汇图片左下角显示学习目标且播放时让位", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /!activeVocabulary && \(/);
  assert.match(source, /认识这些词，用韩语完成初次见面的自我介绍。/);
  assert.match(source, /이 단어들을 익혀 첫 만남의 자기소개 대화를 완성해 보세요\./);
  assert.match(source, /absolute inset-x-0 bottom-0 z-10 max-w-2xl p-5/);
  assert.match(source, /text-2xl font-bold leading-tight tracking-tight sm:text-\[28px\]/);
  assert.match(source, /h-2\/5 bg-gradient-to-t from-black\/60 via-black\/15 to-transparent/);
});

test("核心词汇根据图片媒体热点显示在对应场景附近", async () => {
  const [source, migration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(vocabularyHotspotsMigrationUrl, "utf8"),
  ]);

  assert.match(source, /objectValue\(sceneImage\?\.metadata\.wordHotspots\)/);
  assert.match(source, /vocabularyHotspots\[String\(activeVocabulary\?\.ko/);
  assert.match(source, /hasActiveVocabularyHotspot \? "-translate-x-1\/2 -translate-y-full/);
  assert.match(source, /Math\.min\(Math\.max\(activeVocabularyHotspotLeft, 16\), 84\)/);
  assert.match(migration, /'wordHotspots'/);
  for (const word of ["저", "이름", "학생", "선생님", "친구", "사람", "만나다", "인사하다", "소개하다", "한국어", "처음", "반갑다"]) {
    assert.match(migration, new RegExp(`'${word}'`));
  }
});

test("听说任务使用四页共享流程并预留正式音频位置", async () => {
  const [source, migration, recordingRoute, actions, loader, guidedRepeatMigration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(listenSpeakFlowMigrationUrl, "utf8"),
    readFile(recordingRouteUrl, "utf8"),
    readFile(actionsUrl, "utf8"),
    readFile(loaderUrl, "utf8"),
    readFile(guidedRepeatProgressMigrationUrl, "utf8"),
  ]);
  const recordingControl = source.slice(
    source.indexOf("function RecordingControl"),
    source.indexOf("type BrowserSpeechRecognition"),
  );

  assert.match(source, /const usesListenSpeakPager = activeModule\.code === "listen_speak"/);
  assert.match(source, /听前准备/);
  assert.match(source, /听辨信息/);
  assert.match(source, /跟读复现/);
  assert.match(source, /独立表达/);
  assert.match(source, /if \(activity\.completed && activity\.response && typeof activity\.response === "object"/);
  assert.match(source, /if \(nextDuration >= minimumSeconds && selectedCount >= minimumOutlineItems\) submit\(nextAnswer\)/);
  assert.match(source, /max-w-full whitespace-normal text-lg font-bold leading-10[^\n]+\[overflow-wrap:anywhere\]/);
  assert.match(source, /正在自动提交/);
  assert.match(source, /activityCompleted && <span className="inline-flex shrink-0 items-center gap-1\.5 rounded-full bg-\[var\(--status-success-surface\)\]/);
  assert.match(source, /<fieldset aria-label=\{String\(objectValue\(activeOutlineItem\.label\)\[locale\]/);
  assert.doesNotMatch(source, /<legend[^>]*>\{String\(objectValue\(activeOutlineItem\.label\)\[locale\]/);
  assert.match(source, /activity\.type === "listening"/);
  assert.match(source, /activity\.type === "speaking"/);
  assert.match(source, /当前按钮播放设备示范音；正式音频上传后会在同一位置自动替换。/);
  assert.match(source, /const \[repeatLinePlaybackStarted, setRepeatLinePlaybackStarted\] = useState\(false\)/);
  assert.match(source, /locale === "ko-KR" \? "재생 시작" : "开始播放"/);
  assert.match(source, /setRepeatLinePlaybackStarted\(true\); playRepeatLine\(0\)/);
  assert.match(source, /if \(repeatLinePlaybackStarted\) playRepeatLine\(nextIndex\)/);
  assert.match(source, /if \(repeatLinePlaybackStarted\) playRepeatLine\(index\)/);
  assert.match(source, /playbackLabel=\{locale === "ko-KR" \? "나의 재현" : "我的复现"\}/);
  assert.match(source, /afterPlaybackActions=\{trackCompleted \? <div className="rounded-xl/);
  assert.match(source, /locale === "ko-KR" \? "원음과 비교" : "对照原音"/);
  assert.match(source, /ref=\{repeatReferenceAudioRef\}/);
  assert.match(source, /onEnded=\{\(\) => setRepeatReferencePlaying\(false\)\} hidden/);
  assert.match(recordingControl, /cancelRecordingRef\.current = true/);
  assert.match(recordingControl, /minimumDurationSeconds && durationSeconds < minimumDurationSeconds/);
  assert.match(recordingControl, /短录音未保存/);
  assert.match(recordingControl, /正在说话…/);
  assert.match(recordingControl, /结束录音/);
  assert.match(recordingControl, /RoleplayRecordingPlayer/);
  assert.match(recordingControl, /audioUrl \? locale === "ko-KR" \? "다시 녹음" : "重新录制"/);
  assert.match(recordingControl, /className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-\[var\(--status-success\)\] px-5/);
  assert.doesNotMatch(recordingControl, /min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-\[var\(--status-success\)\]/);
  assert.match(recordingControl, /recording \? <div className="flex flex-wrap items-center gap-2">/);
  assert.doesNotMatch(recordingControl, /recording \? <div className="space-y-3">/);
  assert.match(recordingControl, /afterPlaybackActions \? "mt-4 grid gap-4 lg:grid-cols-2 lg:items-end" : "mt-4 min-w-0"/);
  assert.match(recordingControl, /\{afterPlaybackActions\}<\/div>/);
  assert.match(recordingControl, /正在恢复已保存的录音…/);
  assert.match(recordingControl, /fetch\(`\/api\/digital-textbook\/recordings\/\$\{activityId\}\?\$\{search\.toString\(\)\}`/);
  assert.match(recordingRoute, /export async function GET/);
  assert.match(recordingRoute, /createR2SignedObjectUrl\(evidence\.object_key\)/);
  assert.match(recordingRoute, /const isIndependentOutput = activity\.public_config\?\.presentation === "independent_output"/);
  assert.match(recordingRoute, /const usesR2 = isDialogueRoleplay \|\| isGuidedRepeat \|\| isIndependentOutput/);
  assert.match(recordingRoute, /Recording must be at least \$\{minimumDurationSeconds\} seconds/);
  assert.match(recordingRoute, /storage: "r2"/);
  assert.match(recordingRoute, /\.contains\("metadata", \{ practiceKey, trackIndex, segmentIndex \}\)/);
  assert.match(recordingRoute, /isGuidedRepeatMetadata\(evidence\.metadata\)/);
  assert.match(source, /saveGuidedRepeatProgressAction/);
  assert.match(source, /逐句跟读已完成/);
  assert.match(source, /completedRepeatSegments\.has\(`0:\$\{repeatTrackIndex\}:\$\{index\}`\)/);
  assert.match(actions, /digital_textbook_guided_repeat_progress/);
  assert.match(loader, /guidedRepeatProgress: guidedRepeatProgress\.get/);
  assert.match(guidedRepeatMigration, /primary key \(tenant_id, student_id, activity_id, practice_key, track_index, segment_index\)/);
  assert.match(migration, /"listenSpeakPages"/);
  assert.equal((migration.match(/"audioAssetKey":"chapter-01-listening-repeat-/g) ?? []).length, 6);
  assert.equal((migration.match(/korean-level-one\/chapter-01\/listen-speak\/repeat-\d\d\.mp3/g) ?? []).length, 6);
  assert.match(migration, /production_status/);
});

test("听辨信息使用两页六题并从数据库答案数组逐页检查", async () => {
  const [source, migration] = await Promise.all([
    readFile(sourceUrl, "utf8"),
    readFile(listeningDiagnosticsMigrationUrl, "utf8"),
  ]);

  assert.match(source, /const isListeningQuiz = activity\.type === "listening" && groupedSingleChoice/);
  assert.match(source, /const isPagedChoicePractice = isGrammarPractice \|\| isListeningQuiz/);
  assert.match(source, /isListeningQuiz \? groupedChoicePages\.length : 6/);
  assert.match(source, /objectValue\(item\.question\)\[locale\]/);
  assert.ok(source.indexOf("{hasPendingAudio && (") < source.indexOf("{groupedSingleChoice && !usesFlipCards"));
  assert.equal((migration.match(/"id":"listen-/g) ?? []).length, 6);
  assert.match(migration, /"group":"key-information"/);
  assert.match(migration, /"group":"expression-details"/);
  assert.match(migration, /"kind":"index_array","value":\[0,0,0,0,0,3\]/);
  assert.match(migration, /年龄／나이/);
});

test("听力母稿保持私有并为正常与慢速音频预留 R2 制作配置", async () => {
  const migration = await readFile(listeningMasterMigrationUrl, "utf8");

  assert.match(migration, /transcript_ko = '안녕하세요\? 저는 수진이에요\./);
  assert.match(migration, /요즘 한국어를 배워요\./);
  assert.match(migration, /처음 만나서 반가워요\./);
  assert.match(migration, /chapter-01-listening-v1/);
  assert.match(migration, /chapter-01-listening-identity-normal\.mp3/);
  assert.match(migration, /chapter-01-listening-identity-slow/);
  assert.match(migration, /'scriptVisibility', 'private'/);
  assert.match(migration, /'speakingRate'.*0\.78.*0\.92/s);
  assert.match(migration, /production_status = 'pending'/);
  assert.doesNotMatch(migration, /public_config[\s\S]{0,400}transcript_ko/);
});

test("临时韩语示范音发布为可替换的 R2 音频版本", async () => {
  const migration = await readFile(temporaryListeningAudioMigrationUrl, "utf8");

  assert.match(migration, /audio_status = 'ready'/);
  assert.match(migration, /production_status = 'ready'/);
  assert.match(migration, /"audioEdition":"temporary_tts"/);
  assert.match(migration, /ko-KR-SunHiNeural/);
  assert.match(migration, /'sampleRateHz', 24000/);
  assert.match(migration, /17\.328.*14\.136/s);
  assert.match(migration, /'replaceableByHumanRecording', true/);
});
