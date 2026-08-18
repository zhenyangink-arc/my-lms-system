#!/usr/bin/env node

import assert from "node:assert/strict";

import { createClient } from "@supabase/supabase-js";

import {
  gradeSmartTextbookActivity,
  submitSmartTextbookActivityForContext,
} from "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts";

const LOCAL_API_PORT = "54321";
const LOCAL_DB_CONTAINER = process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
const tenantId = "10000000-0000-4000-8000-000000000001";
const koreanAppId = "10000000-0000-4000-8000-000000000001";
const url = process.env.LOCAL_SUPABASE_URL;
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;

assert.ok(url, "LOCAL_SUPABASE_URL is required");
assert.ok(anonKey, "LOCAL_SUPABASE_ANON_KEY is required");
assert.ok(serviceRoleKey, "LOCAL_SUPABASE_SERVICE_ROLE_KEY is required");
const parsedUrl = new URL(url);
assert.ok(
  (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost") &&
    parsedUrl.port === LOCAL_API_PORT &&
    parsedUrl.protocol === "http:",
  `Refusing non-local Supabase target: ${parsedUrl.origin}`,
);
console.log(`LOCAL TARGET VERIFIED: ${parsedUrl.origin} (Docker Supabase API; DB container ${LOCAL_DB_CONTAINER})`);

const SOURCE_HASH = "b6718120ff84677b96ff98624cc29c74adf73b7cd093323d0b203eb89fd04646";
const GOLDEN_QUESTIONS = [
  { key: "golden-13-01", prompt: "在乘车场景中，“기사”是什么意思？", options: ["司机", "旅客", "工作人员", "朋友"] },
  { key: "golden-13-02", prompt: "“먹다”怎样变成表示意图的本课形式？", options: ["먹으려고 해요", "먹려고 해요", "먹어 주세요", "먹으로 가요"] },
  { key: "golden-13-03", prompt: "哪一句正确表示“从机场到首尔站”？", options: ["공항에서 서울역까지", "공항에 서울역까지", "공항부터 서울역으로", "공항을 서울역에서"] },
  { key: "golden-13-04", prompt: "“세우다”怎样变成礼貌停车请求？", options: ["세워 주세요", "세우 주세요", "세우려고 해요", "세워로 가요"] },
  { key: "golden-13-05", prompt: "哪一句正确表示“坐地铁去”？", options: ["지하철로 가요.", "지하철으로 가요.", "지하철을로 가요.", "지하철에서 가요."] },
  { key: "golden-13-06", prompt: "哪一句最适合请司机开往首尔站正门？", options: ["정문으로 가 주세요.", "정문에서 타려고 해요.", "정문까지 기사예요.", "정문을로 가세요."] },
  { key: "golden-13-07", prompt: "主场景中，从机场到首尔站大约需要多久？", options: ["一小时左右", "十分钟左右", "两小时左右", "三十分钟左右"] },
  { key: "golden-13-08", prompt: "私有听力中，宥娜最后请司机在哪里停车？", options: ["首尔站1号出口前", "首尔站正门", "机场出租车乘车点", "市厅站"] },
  { key: "golden-13-09", prompt: "阅读备忘录中，秀珍从学校到首尔站乘什么？", options: ["出租车", "公交车", "地铁", "火车"] },
  { key: "golden-13-10", prompt: "阅读备忘录中，秀珍十点准备乘什么？", options: ["开往釜山的火车", "机场公交", "1号线地铁", "出租车"] },
  { key: "golden-13-11", prompt: "双角色路线交流的自然信息链是哪一项？", options: ["说明意图与起终点→交通与方向→两项请求→对方确认→理解并礼貌结束", "只报终点→单人持续说明→省略回应", "先结束→再问目的地→不说明交通方式", "只说交通工具→不提出请求或确认"] },
  { key: "golden-13-12", prompt: "课末正式录音必须满足哪一项？", options: ["45—60秒、8—10轮、双角色并覆盖九类信息", "只朗读一条路线即可", "必须获得自动发音分数", "可以单人路线说明代替交流"] },
];

const ACTIVITY_FIXTURES = [
  { key: "orientation-check", type: "single_choice", response: 0, correct: true },
  { key: "vocabulary-check", type: "single_choice", response: { selection: 1, confirmed: true }, correct: true },
  { key: "grammar-fill", type: "fill_blank", response: ["먹으려고 해요", "타려고 해요", "에서", "까지", "세워 주세요", "으로", "로", "으로"], correct: true },
  { key: "pattern-order", type: "ordering", response: [2, 4, 5, 1, 0, 3], correct: true },
  { key: "dialogue-fact-check", type: "single_choice", response: 0, correct: true },
  { key: "dialogue-response", type: "single_choice", response: 0, correct: true },
  { key: "listening-route", type: "listening", response: 0, correct: true },
  { key: "speaking-route", type: "speaking", response: { recorded: true, durationSeconds: 52, turns: 9, criteria: Array(9).fill(true) }, correct: null },
  { key: "reading-travel-note", type: "single_choice", response: [0, 0, 0, 0], correct: true },
  { key: "write-travel-note", type: "writing", response: { text: "내일 서울역에 가려고 해요. 학교에서 서울역까지 택시로 가요. 아홉 시에 학교 앞에서 택시를 타요. 택시에서 말하기: 서울역 1번 출구로 가 주세요. 출구 앞에 세워 주세요. 열 시에 서울역에 도착해요.", informationKinds: Array(7).fill(true), rubricConfirmed: true }, correct: null },
  { key: "review-multiple", type: "multiple_choice", response: [0, 1, 2], correct: true },
  { key: "self-check", type: "self_check", response: { checks: Array(5).fill("can"), returnNodes: ["none"], note: "" }, correct: null },
];

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const userClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const managerClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function mustData(promise, label) {
  const { data, error } = await promise;
  assert.ifError(error && new Error(`${label}: ${error.message}`));
  return data;
}

function assertInvalid(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(answerKey, response, activityType, config, options);
  assert.equal(result.ok, false, `${label}: malformed response must be rejected`);
  assert.match(result.error, /作答结构无效/);
}

assertInvalid("strict choice index", { kind: "index", value: 0 }, "0", "single_choice", {}, ["A", "B"]);
assertInvalid("strict text-array members", { kind: "text_array", value: ["에서", "까지"] }, ["에서", false], "fill_blank", {}, []);
assertInvalid("complete ordering permutation", { kind: "order", value: [1, 0] }, [1, 1], "ordering", {}, ["A", "B"]);
assertInvalid("strict multi-choice members", { kind: "indices", value: [0, 1] }, ["0", 1], "multiple_choice", {}, ["A", "B"]);
assertInvalid("strict grouped choices", { kind: "index_array", value: [0, 0] }, ["0", 0], "single_choice", { items: [{ options: ["A"] }, { options: ["B"] }] }, []);
assertInvalid("strict speaking duration", { kind: "open" }, { recorded: true, durationSeconds: "52", turns: 9, criteria: Array(9).fill(true) }, "speaking", { minimumSeconds: 45, maximumSeconds: 60, minimumTurns: 8, requiredCriteria: 9, enforceCompletionRequirements: true }, []);
assertInvalid("writing checklist required", { kind: "open" }, { text: "학교에 가요." }, "writing", { requireCompletionChecklist: true }, []);
assertInvalid("strict self-check arrays", { kind: "open" }, { checks: ["can", false], returnNodes: ["none"] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
assert.equal(gradeSmartTextbookActivity({ kind: "text_array", value: ["먹으려고 해요", "세워 주세요"] }, ["  먹으려고   해요 ", " 세워 주세요 "], "fill_blank", {}, []).correct, true);
assert.equal(gradeSmartTextbookActivity({ kind: "text_array", value: ["먹으려고 해요", "세워 주세요"] }, ["먹으려 고 해요", "세워주세요"], "fill_blank", {}, []).correct, false);
assert.equal(gradeSmartTextbookActivity({ kind: "mystery", value: 0 }, 0, "single_choice", {}, ["A"]).ok, false);
console.log("PASS: strict structures, fail-closed answer types and whitespace-only normalization are preserved");

const originalState = {};
const cleanupFailures = [];
let testFailure = null;
let userId = null;
let unknownAnswerFixtureInstalled = false;

async function cleanup(label, operation) {
  try {
    const result = await operation();
    if (result?.error) throw result.error;
  } catch (error) {
    cleanupFailures.push(new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`));
  }
}

try {
  const textbook = await mustData(admin.from("digital_textbooks").select("id,status").eq("slug", "korean-level-one-smart").single(), "load textbook");
  const version = await mustData(admin.from("digital_textbook_versions").select("id,status").eq("textbook_id", textbook.id).order("version_number", { ascending: false }).limit(1).single(), "load version");
  const chapter = await mustData(admin.from("digital_textbook_chapters").select("id,status,production_status,native_review_status,audio_status,image_status,source_revision").eq("version_id", version.id).eq("chapter_number", 13).single(), "load chapter thirteen");
  const priorTests = await mustData(admin.from("chapter_tests").select("id,slug,status").in("slug", Array.from({ length: 12 }, (_, index) => `korean-level-one-${String(index + 1).padStart(2, "0")}`)).order("slug"), "load prior tests");
  const testRow = await mustData(admin.from("chapter_tests").select("id,status,passing_score,duration_minutes").eq("slug", "korean-level-one-13").single(), "load chapter thirteen test");
  const questions = await mustData(admin.from("chapter_test_questions").select("question_key,prompt,options,correct_option,status").eq("test_id", testRow.id).order("sort_order"), "load questions");

  assert.equal(chapter.status, "draft");
  assert.equal(chapter.production_status, "editorial_review");
  assert.equal(chapter.native_review_status, "pending");
  assert.equal(chapter.audio_status, "pending");
  assert.equal(chapter.image_status, "pending");
  assert.match(chapter.source_revision, new RegExp(SOURCE_HASH));
  assert.equal(testRow.status, "draft");
  assert.equal(testRow.duration_minutes, 12);
  assert.equal(testRow.passing_score, 60);
  assert.equal(priorTests.length, 12);
  assert.equal(questions.length, 12);
  for (const [index, expected] of GOLDEN_QUESTIONS.entries()) {
    assert.equal(questions[index].question_key, expected.key);
    assert.equal(questions[index].prompt, expected.prompt);
    assert.deepEqual(questions[index].options, expected.options);
    assert.equal(questions[index].correct_option, 0);
    assert.equal(questions[index].status, "draft");
  }
  console.log("PASS: chapter thirteen and its 12-question vector remain draft/pending and use master-recorded 12 minutes / passing_score=60");

  const modules = await mustData(admin.from("digital_textbook_modules").select("id,module_code,sort_order").eq("chapter_id", chapter.id).order("sort_order"), "load modules");
  assert.deepEqual(modules.map((item) => item.module_code), ["orientation", "vocabulary", "grammar", "patterns", "dialogue", "listen_speak", "read_write", "review"]);
  const nodes = await mustData(admin.from("digital_textbook_nodes").select("id,module_id,node_code,estimated_minutes,content").in("module_id", modules.map((item) => item.id)), "load nodes");
  assert.equal(nodes.length, 8);
  assert.deepEqual(modules.map((module) => nodes.find((node) => node.module_id === module.id).estimated_minutes), [5, 10, 18, 12, 13, 14, 13, 8]);
  assert.equal(nodes.reduce((total, node) => total + node.estimated_minutes, 0), 93);
  assert.equal(objectValue(nodes.find((item) => item.node_code === "transport-words").content).vocabulary.length, 22);
  assert.equal(objectValue(nodes.find((item) => item.node_code === "route-grammar-tools").content).grammarCards.length, 4);
  assert.deepEqual(objectValue(nodes.find((item) => item.node_code === "taxi-and-directions").content).dialogueScenes.map((scene) => scene.lines.length), [8, 6]);
  for (const node of nodes) {
    const serialized = JSON.stringify(node.content);
    for (const forbidden of ["eyebrow", "typeLabel", "interactionLabel"]) {
      assert.equal(serialized.includes(forbidden), false, `node leaked decorative field ${forbidden}`);
    }
  }

  const activities = await mustData(admin.from("digital_textbook_activities").select("id,node_id,activity_key,activity_type,max_attempts,counts_toward_completion,public_config").in("node_id", nodes.map((item) => item.id)), "load activities");
  assert.equal(activities.length, 12);
  const activitiesByKey = new Map(activities.map((item) => [item.activity_key, item]));
  for (const fixture of ACTIVITY_FIXTURES) {
    const activity = activitiesByKey.get(fixture.key);
    assert.ok(activity, `missing ${fixture.key}`);
    assert.equal(activity.activity_type, fixture.type);
    assert.equal(activity.max_attempts, 3);
    assert.equal(activity.counts_toward_completion, true);
  }
  for (const key of ["orientation-check", "vocabulary-check", "grammar-fill", "pattern-order", "dialogue-fact-check", "dialogue-response", "listening-route", "reading-travel-note", "review-multiple"]) {
    assert.equal(objectValue(activitiesByKey.get(key).public_config).shuffle, true, `${key} must request shuffling`);
  }
  const grammarConfig = objectValue(activitiesByKey.get("grammar-fill").public_config);
  assert.deepEqual(grammarConfig.items.map((item) => item.id), Array.from({ length: 8 }, (_, index) => `item-${String(index + 1).padStart(2, "0")}`));
  assert.ok(grammarConfig.items.every((item) => item.placeholder === "답을 입력하세요"));
  const speakingConfig = objectValue(activitiesByKey.get("speaking-route").public_config);
  assert.deepEqual([speakingConfig.minimumSeconds, speakingConfig.maximumSeconds, speakingConfig.minimumTurns, speakingConfig.maximumTurns, speakingConfig.rolesRequired, speakingConfig.requiredCriteria, speakingConfig.pronunciationScore], [45, 60, 8, 10, 2, 9, false]);
  const writingConfig = objectValue(activitiesByKey.get("write-travel-note").public_config);
  assert.deepEqual([writingConfig.minSentences, writingConfig.maxSentences, writingConfig.minimumInformationKinds, writingConfig.requireCompletionChecklist], [6, 8, 7, true]);

  const allPublicConfig = JSON.stringify(activities.map((activity) => activity.public_config));
  for (const forbidden of ["normalScript", "slowScript", "pauseMarks", "audioObjectKey", "correctIndex", "correctIndices", "correctOrder", "answers"]) {
    assert.equal(allPublicConfig.includes(forbidden), false, `public activity config leaked ${forbidden}`);
  }
  const secrets = await mustData(admin.from("digital_textbook_activity_secrets").select("activity_id,answer_key,explanation,transcript_ko,audio_object_key,audio_status").in("activity_id", activities.map((item) => item.id)), "load secrets");
  assert.equal(secrets.length, 12);
  assert.ok(secrets.every((item) => objectValue(item.explanation).feedback.length === 3));
  const listeningActivity = activitiesByKey.get("listening-route");
  const listeningSecret = secrets.find((item) => item.activity_id === listeningActivity.id);
  assert.ok(listeningSecret.transcript_ko);
  assert.equal(listeningSecret.audio_status, "pending");
  assert.equal(listeningSecret.audio_object_key, "korean-level-one/chapter-13/listening/chapter-13-listening-route-normal.mp3");
  assert.ok(objectValue(objectValue(listeningSecret.explanation).privateListening).slowScript);
  assert.ok(objectValue(objectValue(listeningSecret.explanation).privateListening).pauseMarks);

  const media = await mustData(admin.from("digital_textbook_media_assets").select("node_id,activity_id,asset_key,media_type,object_key,production_status").in("node_id", nodes.map((item) => item.id)), "load media");
  assert.equal(media.filter((item) => item.media_type === "image").length, 12);
  assert.equal(media.filter((item) => item.media_type === "audio").length, 74);
  assert.ok(media.every((item) => item.production_status === "pending"));
  assert.ok(media.every((item) => item.object_key.startsWith("korean-level-one/chapter-13/")));
  const normalAudio = media.find((item) => item.asset_key === "chapter-13-listening-route-normal");
  const slowAudio = media.find((item) => item.asset_key === "chapter-13-listening-route-slow");
  assert.ok(normalAudio && slowAudio);
  assert.notEqual(normalAudio.object_key, slowAudio.object_key);
  assert.equal(normalAudio.activity_id, listeningActivity.id);
  assert.equal(slowAudio.activity_id, listeningActivity.id);
  console.log("PASS: 8 nodes, 12 contracts, private answers, 12 pending images and 74 pending audio bindings match chapter thirteen");

  Object.assign(originalState, {
    textbookId: textbook.id, textbookStatus: textbook.status,
    versionId: version.id, versionStatus: version.status,
    chapterId: chapter.id, chapterStatus: chapter.status,
    priorTests: priorTests.map((item) => ({ id: item.id, status: item.status })),
    testId: testRow.id, testStatus: testRow.status,
    listeningId: listeningActivity.id, listeningStatus: listeningSecret.audio_status,
  });

  await mustData(admin.from("digital_textbooks").update({ status: "published" }).eq("id", textbook.id).select(), "publish textbook fixture");
  await mustData(admin.from("digital_textbook_versions").update({ status: "published" }).eq("id", version.id).select(), "publish version fixture");
  await mustData(admin.from("digital_textbook_chapters").update({ status: "published" }).eq("id", chapter.id).select(), "publish chapter fixture");
  await mustData(admin.from("chapter_tests").update({ status: "published" }).in("id", [...priorTests.map((item) => item.id), testRow.id]).select(), "publish test fixtures");
  await mustData(admin.from("chapter_test_questions").update({ status: "published" }).eq("test_id", testRow.id).select(), "publish questions");

  const email = `chapter-thirteen-security-${Date.now()}@accounts.puffy.invalid`;
  const password = "LocalSecurity123!";
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "第13章本地安全测试" } });
  assert.ifError(createUserError);
  userId = createdUser.user.id;
  await mustData(admin.from("tenant_memberships").insert({ tenant_id: tenantId, user_id: userId, role: "student", status: "active", membership_tier: "vip2", is_default: true, joined_at: new Date().toISOString() }).select(), "create membership");
  assert.ifError((await managerClient.auth.signInWithPassword({ email: "local-admin@accounts.puffy.invalid", password: "PuffyLocal123!" })).error);
  assert.ifError((await managerClient.rpc("set_student_application_enrollment", { p_student_id: userId, p_app_id: koreanAppId, p_status: "active" })).error);
  await managerClient.auth.signOut();
  assert.ifError((await userClient.auth.signInWithPassword({ email, password })).error);
  for (const prior of priorTests) {
    await mustData(admin.from("chapter_test_attempts").insert({ tenant_id: tenantId, student_id: userId, test_id: prior.id, test_slug: prior.slug, test_version: 1, score: 100, correct_count: 12, total_questions: 12, passed: true, answers: {}, dimension_scores: {} }).select(), `seed ${prior.slug} prerequisite`);
  }

  const context = { supabase: userClient, admin, userId, tenantId, canSubmit: true, preview: false };
  const { data: visibleSecrets, error: visibleSecretsError } = await userClient.from("digital_textbook_activity_secrets").select("activity_id,answer_key").in("activity_id", activities.map((item) => item.id));
  assert.ok(visibleSecretsError || (visibleSecrets ?? []).length === 0);
  const { data: visibleMedia, error: visibleMediaError } = await userClient.from("digital_textbook_media_assets").select("object_key").in("node_id", nodes.map((item) => item.id));
  assert.ok(visibleMediaError || (visibleMedia ?? []).length === 0);
  console.log("PASS: authenticated browser cannot read chapter-thirteen answer secrets or private object keys");

  const firstActivity = activitiesByKey.get("orientation-check");
  const malformedResult = await submitSmartTextbookActivityForContext({ activityId: firstActivity.id, locale: "zh-CN", response: "0" }, context);
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.attemptNumber, 0);
  assert.match(malformedResult.explanation, /作答结构无效/);
  assert.equal((await mustData(admin.from("digital_textbook_attempts").select("id").eq("student_id", userId).eq("activity_id", firstActivity.id), "malformed attempts")).length, 0);
  const wrongResult = await submitSmartTextbookActivityForContext({ activityId: firstActivity.id, locale: "zh-CN", response: 1 }, context);
  assert.equal(wrongResult.ok, true);
  assert.equal(wrongResult.correct, false);
  assert.equal(wrongResult.attemptNumber, 1);
  console.log("PASS: malformed structure consumes no attempt while a well-formed wrong answer consumes one");

  const pendingListeningResult = await submitSmartTextbookActivityForContext({ activityId: listeningActivity.id, locale: "zh-CN", response: 0 }, context);
  assert.equal(pendingListeningResult.ok, false);
  assert.match(pendingListeningResult.explanation, /待录制与核验/);
  assert.equal((await mustData(admin.from("digital_textbook_attempts").select("id").eq("student_id", userId).eq("activity_id", listeningActivity.id), "pending listening attempts")).length, 0);

  assert.ok((await userClient.from("digital_textbook_attempts").insert({ tenant_id: tenantId, student_id: userId, activity_id: firstActivity.id, version_id: version.id, attempt_number: 99, response: 0, is_correct: true, score: 100 })).error);
  assert.ok((await userClient.from("digital_textbook_node_progress").insert({ tenant_id: tenantId, student_id: userId, node_id: firstActivity.node_id, version_id: version.id, status: "completed", completion_percent: 100, mastery_score: 100, attempt_count: 1 })).error);
  assert.ok((await userClient.rpc("record_smart_textbook_attempt", { p_tenant_id: tenantId, p_student_id: userId, p_activity_id: firstActivity.id, p_version_id: version.id, p_response: 0, p_is_correct: true, p_score: 100, p_meets_completion_requirements: null })).error);
  const speakingActivity = activitiesByKey.get("speaking-route");
  const forgedOpen = await admin.rpc("record_smart_textbook_attempt", { p_tenant_id: tenantId, p_student_id: userId, p_activity_id: speakingActivity.id, p_version_id: version.id, p_response: ACTIVITY_FIXTURES.find((item) => item.key === "speaking-route").response, p_is_correct: true, p_score: 100, p_meets_completion_requirements: true });
  assert.ok(forgedOpen.error);
  assert.match(forgedOpen.error.message, /OPEN_ACTIVITY_CANNOT_BE_SCORED/);
  console.log("PASS: browser writes/RPC are denied and service role cannot forge open-activity correctness or score");

  const unknownActivity = activitiesByKey.get("dialogue-fact-check");
  const unknownSecret = secrets.find((item) => item.activity_id === unknownActivity.id);
  Object.assign(originalState, { unknownActivityId: unknownActivity.id, unknownAnswer: unknownSecret.answer_key });
  await mustData(admin.from("digital_textbook_activity_secrets").update({ answer_key: { kind: "unknown_answer_type", value: 0 } }).eq("activity_id", unknownActivity.id).select(), "install unknown answer");
  unknownAnswerFixtureInstalled = true;
  const unknownResult = await submitSmartTextbookActivityForContext({ activityId: unknownActivity.id, locale: "zh-CN", response: 0 }, context);
  assert.equal(unknownResult.ok, false);
  assert.match(unknownResult.explanation, /无法识别答案类型/);
  assert.equal((await mustData(admin.from("digital_textbook_attempts").select("id").eq("student_id", userId).eq("activity_id", unknownActivity.id), "unknown attempts")).length, 0);
  await mustData(admin.from("digital_textbook_activity_secrets").update({ answer_key: unknownSecret.answer_key }).eq("activity_id", unknownActivity.id).select(), "restore answer");
  unknownAnswerFixtureInstalled = false;
  console.log("PASS: unknown answer kind fails closed without consuming an attempt");

  await mustData(admin.from("digital_textbook_activity_secrets").update({ audio_status: "ready" }).eq("activity_id", listeningActivity.id).select(), "mark local listening ready");
  const objectiveFixtures = ACTIVITY_FIXTURES.filter((item) => item.correct !== null);
  const openFixtures = ACTIVITY_FIXTURES.filter((item) => item.correct === null);
  const completionByNode = new Set();
  for (const fixture of objectiveFixtures) {
    const activity = activitiesByKey.get(fixture.key);
    const result = await submitSmartTextbookActivityForContext({ activityId: activity.id, locale: "zh-CN", response: fixture.response }, context);
    assert.equal(result.ok, true, `${fixture.key}: ${result.explanation}`);
    assert.equal(result.correct, true);
    if (result.nodeCompleted) completionByNode.add(result.nodeId);
  }
  assert.equal(completionByNode.size, 5);

  const writingActivity = activitiesByKey.get("write-travel-note");
  const weakWriting = await submitSmartTextbookActivityForContext({ activityId: writingActivity.id, locale: "zh-CN", response: { text: "가나다라 마바사. 아자차카 타파하. 가나다라 마바사. 아자차카 타파하. 가나다라 마바사. 아자차카 타파하.", informationKinds: Array(7).fill(true), rubricConfirmed: true } }, context);
  assert.equal(weakWriting.ok, true);
  assert.equal(weakWriting.correct, null);
  assert.equal(weakWriting.score, null);
  assert.equal(weakWriting.nodeCompleted, false);
  const weakAttempt = await mustData(admin.from("digital_textbook_attempts").select("is_correct,score,meets_completion_requirements").eq("student_id", userId).eq("activity_id", writingActivity.id).single(), "load weak writing");
  assert.equal(weakAttempt.is_correct, null);
  assert.equal(weakAttempt.score, null);
  assert.equal(weakAttempt.meets_completion_requirements, false);
  assert.equal(await mustData(admin.from("course_ebook_progress").select("id").eq("student_id", userId).eq("test_slug", "korean-level-one-13").maybeSingle(), "check locked chapter"), null);

  for (const fixture of openFixtures) {
    const activity = activitiesByKey.get(fixture.key);
    const result = await submitSmartTextbookActivityForContext({ activityId: activity.id, locale: "zh-CN", response: fixture.response }, context);
    assert.equal(result.ok, true, `${fixture.key}: ${result.explanation}`);
    assert.equal(result.correct, null);
    assert.equal(result.score, null);
    assert.equal(result.nodeCompleted, true);
    completionByNode.add(result.nodeId);
  }
  assert.equal(completionByNode.size, 8);
  const openAttempts = await mustData(admin.from("digital_textbook_attempts").select("is_correct,score,meets_completion_requirements").eq("student_id", userId).in("activity_id", openFixtures.map((item) => activitiesByKey.get(item.key).id)), "load open attempts");
  assert.ok(openAttempts.every((item) => item.is_correct === null && item.score === null));
  assert.equal((await mustData(admin.from("digital_textbook_node_progress").select("node_id").eq("student_id", userId).eq("version_id", version.id).in("node_id", nodes.map((item) => item.id)).eq("status", "completed").eq("completion_percent", 100), "load completed nodes")).length, 8);
  console.log("PASS: speaking, writing and self-check complete nodes while every open attempt remains correct:null, score:null");

  const unlockEvidence = await mustData(admin.from("course_ebook_progress").select("progress_percent,completion_source,reading_seconds").eq("student_id", userId).eq("test_slug", "korean-level-one-13").single(), "load unlock evidence");
  assert.equal(unlockEvidence.progress_percent, 100);
  assert.equal(unlockEvidence.completion_source, "smart_textbook");
  assert.equal(unlockEvidence.reading_seconds, 0);
  const answers = Object.fromEntries(GOLDEN_QUESTIONS.map((item) => [item.key, 0]));
  const { data: testResult, error: testError } = await userClient.rpc("submit_course_test", { p_test_slug: "korean-level-one-13", p_answers: answers });
  assert.ifError(testError && new Error(testError.message));
  assert.equal(objectValue(testResult).passed, true);
  assert.equal(objectValue(testResult).totalQuestions, 12);
  console.log("PASS: exactly 8 completed nodes write smart_textbook evidence and unlock the chapter-thirteen test after prior prerequisites");
} catch (error) {
  testFailure = error;
} finally {
  if (unknownAnswerFixtureInstalled && originalState.unknownActivityId) {
    await cleanup("restore unknown answer", () => admin.from("digital_textbook_activity_secrets").update({ answer_key: originalState.unknownAnswer }).eq("activity_id", originalState.unknownActivityId).select());
  }
  if (originalState.listeningId) {
    await cleanup("restore listening", () => admin.from("digital_textbook_activity_secrets").update({ audio_status: originalState.listeningStatus }).eq("activity_id", originalState.listeningId).select());
  }
  if (originalState.testId) {
    await cleanup("restore questions", () => admin.from("chapter_test_questions").update({ status: "draft" }).eq("test_id", originalState.testId).select());
    await cleanup("restore test", () => admin.from("chapter_tests").update({ status: originalState.testStatus }).eq("id", originalState.testId).select());
  }
  for (const prior of originalState.priorTests ?? []) {
    await cleanup(`restore prior test ${prior.id}`, () => admin.from("chapter_tests").update({ status: prior.status }).eq("id", prior.id).select());
  }
  if (originalState.chapterId) await cleanup("restore chapter", () => admin.from("digital_textbook_chapters").update({ status: originalState.chapterStatus }).eq("id", originalState.chapterId).select());
  if (originalState.versionId) await cleanup("restore version", () => admin.from("digital_textbook_versions").update({ status: originalState.versionStatus }).eq("id", originalState.versionId).select());
  if (originalState.textbookId) await cleanup("restore textbook", () => admin.from("digital_textbooks").update({ status: originalState.textbookStatus }).eq("id", originalState.textbookId).select());
  if (userId) await cleanup("delete local user", () => admin.auth.admin.deleteUser(userId));
  await cleanup("sign out student", () => userClient.auth.signOut());
  await cleanup("sign out manager", () => managerClient.auth.signOut());
}

if (cleanupFailures.length > 0) {
  throw new AggregateError(testFailure ? [testFailure, ...cleanupFailures] : cleanupFailures, "chapter-thirteen security verification and/or cleanup failed");
}
if (testFailure) throw testFailure;
console.log("PASS: cleanup restored every chapter-thirteen local fixture with no suppressed errors");
