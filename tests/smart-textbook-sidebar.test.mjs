import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL(
  "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/KoreanLevelOneSmartTextbook.tsx",
  import.meta.url,
);
const loaderUrl = new URL("../src/lib/smart-digital-textbook.ts", import.meta.url);
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
  assert.match(source, /const \[missionPage, setMissionPage\] = useState<0 \| 1>\(0\)/);
  assert.match(source, /const usesDesktopImagePager = hasIntegratedImageHeader && node\.activities\.length > 0/);
  assert.match(source, /missionPage === 1 \? "lg:hidden"/);
  assert.match(source, /missionPage === 0 \? "lg:hidden"/);
  assert.match(source, /aria-label=\{locale === "ko-KR" \? "학습 목표 페이지" : "学习目标分页"\}/);
  assert.match(source, /className="mb-6 hidden items-center justify-between gap-4 rounded-2xl/);
  assert.match(source, /aria-current=\{missionPage === 0 \? "page" : undefined\}/);
  assert.match(source, /aria-current=\{missionPage === 1 \? "page" : undefined\}/);
  assert.doesNotMatch(source, /className="mt-6 hidden items-center justify-between border-t/);
  assert.match(source, /"本目标"\} \{missionPage \+ 1\} \/ 2/);
  assert.match(source, /locale === "ko-KR" \? "장면 진단" : "情景诊断"/);
  assert.match(source, /title=\{activity\.prompt\[locale\]\}[\s\S]*description=\{activity\.instruction\[locale\]\}/);
  assert.match(source, /hintLabel=\{locale === "ko-KR" \? "문제 풀이 안내 보기" : "查看答题说明"\}/);
  assert.doesNotMatch(source, /<p className="mt-1 text-sm text-\[var\(--foreground-secondary\)\]">\{activity\.instruction\[locale\]\}<\/p>/);
  assert.match(source, /font-medium text-\[var\(--foreground\)\]">\{option\}/);
  assert.match(source, /font-mono text-xs text-\[var\(--foreground-muted\)\]/);
  assert.doesNotMatch(source, /font-medium text-slate-800">\{option\}/);
});

test("核心词汇等带图模块复用情景与表达双页导航", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /const usesDesktopImagePager = hasIntegratedImageHeader && node\.activities\.length > 0/);
  assert.match(source, /\{usesDesktopImagePager && \(/);
  assert.match(source, /usesDesktopImagePager && missionPage === 1 \? "lg:hidden"/);
  assert.match(source, /usesDesktopImagePager && missionPage === 0 \? "lg:hidden"/);
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
  assert.match(source, /speakKoreanSequence\(sceneDialogueLines/);
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
  assert.doesNotMatch(source, /bg-\[var\(--primary\)\].*30.*연속 말하기/s);
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

  assert.match(source, /\? "sm:aspect-\[2\/1\]" : "sm:aspect-\[5\/2\]"/);
  assert.match(source, /className="h-full w-full object-cover object-center"/);
});

test("任务情景图按原始二比一画幅铺满并保留完整高度", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /asset\.metadata\.presentation === "task-scene"/);
  assert.match(source, /"sm:aspect-\[2\/1\]"/);
  assert.match(source, /className="h-full w-full object-cover object-center"/);
  assert.doesNotMatch(source, /opacity-45 blur-xl/);
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
  assert.match(source, /vocabulary\.length === 0 && String\(lead\[locale\]/);
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
