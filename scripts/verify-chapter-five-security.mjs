#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import { gradeSmartTextbookActivity } from "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts";
import { createSpeakingEvidence } from "./smart-textbook-security-helpers.mjs";

const LOCAL_API_PORT = "54321";
const LOCAL_DB_CONTAINER =
  process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
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
console.log(
  `LOCAL TARGET VERIFIED: ${parsedUrl.origin} (Docker Supabase API; DB container ${LOCAL_DB_CONTAINER})`,
);

const GOLDEN_QUESTIONS = [
  { key: "golden-05-01", prompt: "“주말”是什么意思？", options: ["周末", "上午", "星期一", "电影"], answer: 0 },
  { key: "golden-05-02", prompt: "“5月3日”的规范韩文读法是哪一项？", options: ["오월 삼일", "오월 사일", "유월 삼일", "오일 삼월"], answer: 0 },
  { key: "golden-05-03", prompt: "“토요일___ 친구를 만났어요.”应填什么？", options: ["에", "에서", "을", "고"], answer: 0 },
  { key: "golden-05-04", prompt: "“만나다”的自然过去形是哪一项？", options: ["만났어요", "만나요", "만나고", "만나다요"], answer: 0 },
  { key: "golden-05-05", prompt: "“보다”的自然过去形是哪一项？", options: ["봤어요", "봐었어요", "보아요", "보고"], answer: 0 },
  { key: "golden-05-06", prompt: "“공부하다”的过去形是哪一项？", options: ["공부했어요", "공부하았어요", "공부해요", "공부하고"], answer: 0 },
  { key: "golden-05-07", prompt: "“밥을 먹___ 영화를 봤어요.”应填什么？", options: ["고", "에", "에서", "았어요"], answer: 0 },
  { key: "golden-05-08", prompt: "主场景中，敏秀和朋友在哪里见面？", options: ["学校门口", "公园", "图书馆", "学生休息区"], answer: 0 },
  { key: "golden-05-09", prompt: "第二场景中，俊浩下午去了哪里？", options: ["公园", "电影院", "图书馆", "学校食堂"], answer: 0 },
  { key: "golden-05-10", prompt: "周末日记中，谁和写作者一起去了公园？", options: ["家人", "朋友", "老师", "同学"], answer: 0 },
  { key: "golden-05-11", prompt: "周末故事的自然信息顺序是哪一项？", options: ["提问→时间人物→地点→动作→感受", "感受→提问→地点→动作→时间人物", "地点→感受→提问→动作→时间人物", "动作→地点→感受→时间人物→提问"], answer: 0 },
  { key: "golden-05-12", prompt: "课末周末经历录音必须满足哪一项？", options: ["40—55秒、6—8句，含时间、人物或地点、三个过去动作、-고和过去感受", "只背诵日期和星期", "必须获得自动发音分数", "只写四句话无需录音"], answer: 0 },
];

const ACTIVITY_FIXTURES = [
  { key: "orientation-check", type: "single_choice", response: 0, correct: true },
  { key: "vocabulary-check", type: "single_choice", response: { selection: 0, confirmed: true }, correct: true },
  { key: "grammar-fill", type: "fill_blank", response: ["오월 삼일", "에", "만났어요", "봤어요", "공부했어요", "고"], correct: true },
  { key: "pattern-order", type: "ordering", response: [2, 4, 1, 3, 0], correct: true },
  { key: "dialogue-fact-check", type: "single_choice", response: 0, correct: true },
  { key: "dialogue-response", type: "single_choice", response: 0, correct: true },
  { key: "listening-afternoon", type: "listening", response: 0, correct: true },
  { key: "speaking-weekend-story", type: "speaking", response: { recorded: true, durationSeconds: 45, turns: 6, criteria: Array(5).fill(true) }, correct: null },
  { key: "reading-weekend-diary", type: "single_choice", response: [0, 0, 0], correct: true },
  { key: "write-weekend-diary", type: "writing", response: { text: "토요일에 동생하고 도서관에 갔어요. 오전에 같이 공부했어요. 점심을 먹고 공원에서 산책했어요. 정말 즐거웠어요.", informationKinds: Array(5).fill(true), rubricConfirmed: true }, correct: null },
  { key: "review-multiple", type: "multiple_choice", response: [0, 1, 2], correct: true },
  { key: "self-check", type: "self_check", response: { checks: Array(5).fill("can"), returnNodes: ["none"], note: "" }, correct: null },
];

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const userClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const managerClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function mustData(promise, label) {
  const { data, error } = await promise;
  assert.ifError(error && new Error(`${label}: ${error.message}`));
  return data;
}

function runLocalDatabaseSql(sql, label) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
    { input: sql, encoding: "utf8" },
  );
  assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout || "local psql failed"}`);
  return result.stdout.trim();
}

function isFile(filePath) {
  return existsSync(filePath) && statSync(filePath).isFile();
}

let actionModulePromise = null;
async function loadProductionActionModule() {
  if (!actionModulePromise) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === "server-only") {
          return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
        }
        if (specifier === "next/headers") {
          return {
            shortCircuit: true,
            url: "data:text/javascript,export%20async%20function%20cookies()%7Breturn%20globalThis.__CHAPTER_FIVE_SECURITY_COOKIE_STORE__%7D",
          };
        }
        if (specifier.startsWith("@/")) {
          const basePath = resolvePath(process.cwd(), "src", specifier.slice(2));
          const filePath = [basePath, `${basePath}.ts`, `${basePath}.tsx`, resolvePath(basePath, "index.ts")].find(isFile);
          assert.ok(filePath, `cannot resolve production alias ${specifier}`);
          return { shortCircuit: true, url: pathToFileURL(filePath).href };
        }
        if (specifier === "next/navigation") return nextResolve(`${specifier}.js`, context);
        if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
          const basePath = fileURLToPath(new URL(specifier, context.parentURL));
          const filePath = [basePath, `${basePath}.ts`, `${basePath}.tsx`, resolvePath(basePath, "index.ts")].find(isFile);
          if (filePath) return { shortCircuit: true, url: pathToFileURL(filePath).href };
        }
        return nextResolve(specifier, context);
      },
    });
    actionModulePromise = import(
      "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts"
    );
  }
  return actionModulePromise;
}

async function createAuthenticatedActionInvoker(email, password) {
  const cookieJar = new Map();
  const authClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return [...cookieJar].map(([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) cookieJar.set(cookie.name, cookie.value);
      },
    },
  });
  assert.ifError((await authClient.auth.signInWithPassword({ email, password })).error);
  const { data: { user }, error } = await authClient.auth.getUser();
  assert.ifError(error);
  assert.ok(user);
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  globalThis.__CHAPTER_FIVE_SECURITY_COOKIE_STORE__ = {
    getAll() {
      return [...cookieJar].map(([name, value]) => ({ name, value }));
    },
    set(name, value) {
      cookieJar.set(name, value);
    },
  };
  const { submitSmartTextbookActivityAction } = await loadProductionActionModule();
  return (input) => submitSmartTextbookActivityAction(input);
}

function assertInvalid(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(answerKey, response, activityType, config, options);
  assert.equal(result.ok, false, `${label}: malformed response must be rejected`);
  assert.match(result.error, /作答结构无效/);
}

assertInvalid("strict choice index", { kind: "index", value: 0 }, "0", "single_choice", {}, ["A", "B"]);
assertInvalid("strict text-array members", { kind: "text_array", value: ["에", "옆에"] }, ["에", false], "fill_blank", {}, []);
assertInvalid("complete ordering permutation", { kind: "order", value: [1, 0] }, [1, 1], "ordering", {}, ["A", "B"]);
assertInvalid("strict multi-choice members", { kind: "indices", value: [0, 1] }, ["0", 1], "multiple_choice", {}, ["A", "B"]);
assertInvalid("strict grouped choices", { kind: "index_array", value: [0, 0] }, ["0", 0], "single_choice", { items: [{ options: ["A"] }, { options: ["B"] }] }, []);
assertInvalid("strict speaking duration", { kind: "open" }, { recorded: true, durationSeconds: "45", turns: 6, criteria: Array(5).fill(true) }, "speaking", { minimumSeconds: 40, maximumSeconds: 55, minimumTurns: 6, requiredCriteria: 5, enforceCompletionRequirements: true }, []);
assertInvalid("writing checklist required", { kind: "open" }, { text: "학교에 있어요." }, "writing", { requireCompletionChecklist: true }, []);
assertInvalid("strict self-check arrays", { kind: "open" }, { checks: ["can", false], returnNodes: ["none"] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
assert.equal(
  gradeSmartTextbookActivity({ kind: "text_array", value: ["에", "옆에"] }, ["  에  ", "  옆에 "], "fill_blank", {}, []).correct,
  true,
);
assert.equal(
  gradeSmartTextbookActivity({ kind: "text_array", value: ["에", "옆에"] }, ["에", "옆 에"], "fill_blank", {}, []).correct,
  false,
);
console.log("PASS: strict structures are enforced and whitespace normalization preserves internal Korean spelling differences");

const originalState = {};
const cleanupFailures = [];
let testFailure = null;
let userId = null;
let profileSelectGrantInstalled = false;
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
  const chapter = await mustData(admin.from("digital_textbook_chapters").select("id,status,production_status,native_review_status,audio_status,image_status,source_revision").eq("version_id", version.id).eq("chapter_number", 5).single(), "load chapter five");
  const priorTests = await mustData(admin.from("chapter_tests").select("id,slug,status").in("slug", ["korean-level-one-01", "korean-level-one-02", "korean-level-one-03", "korean-level-one-04"]).order("slug"), "load prior tests");
  const testRow = await mustData(admin.from("chapter_tests").select("id,status,passing_score,duration_minutes").eq("slug", "korean-level-one-05").single(), "load chapter five test");
  const questions = await mustData(admin.from("chapter_test_questions").select("question_key,prompt,options,correct_option,status").eq("test_id", testRow.id).order("sort_order"), "load questions");

  assert.equal(chapter.status, "draft");
  assert.equal(chapter.production_status, "editorial_review");
  assert.equal(chapter.native_review_status, "pending");
  assert.equal(chapter.audio_status, "pending");
  assert.equal(chapter.image_status, "pending");
  assert.match(chapter.source_revision, /394f3dfd82feb1a08a832885c19ca50402f89b882e4092eaee9845fe6d290b61/);
  assert.equal(testRow.status, "draft");
  assert.equal(testRow.duration_minutes, 12);
  assert.equal(testRow.passing_score, 60);
  assert.equal(questions.length, 12);
  for (const [index, expected] of GOLDEN_QUESTIONS.entries()) {
    assert.equal(questions[index].question_key, expected.key);
    assert.equal(questions[index].prompt, expected.prompt);
    assert.deepEqual(questions[index].options, expected.options);
    assert.equal(questions[index].correct_option, expected.answer);
    assert.equal(questions[index].status, "draft");
  }
  console.log("PASS: chapter five and its hard-coded 12-question vector remain draft/pending and use master-recorded 12 minutes / passing_score=60");

  const modules = await mustData(admin.from("digital_textbook_modules").select("id,module_code,sort_order").eq("chapter_id", chapter.id).order("sort_order"), "load modules");
  assert.deepEqual(modules.map((item) => item.module_code), ["orientation", "vocabulary", "grammar", "patterns", "dialogue", "listen_speak", "read_write", "review"]);
  const nodes = await mustData(admin.from("digital_textbook_nodes").select("id,module_id,node_code,content").in("module_id", modules.map((item) => item.id)), "load nodes");
  assert.equal(nodes.length, 8);
  assert.equal(objectValue(nodes.find((item) => item.node_code === "weekend-words").content).vocabulary.length, 20);
  assert.equal(objectValue(nodes.find((item) => item.node_code === "past-time-tools").content).grammarCards.length, 4);
  assert.deepEqual(objectValue(nodes.find((item) => item.node_code === "monday-weekend-talk").content).dialogueScenes.map((scene) => scene.lines.length), [8, 6]);
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
  const speakingConfig = objectValue(activitiesByKey.get("speaking-weekend-story").public_config);
  assert.equal(speakingConfig.minimumSeconds, 40);
  assert.equal(speakingConfig.maximumSeconds, 55);
  assert.equal(speakingConfig.minimumTurns, 6);
  assert.equal(speakingConfig.maximumTurns, 8);
  assert.equal(speakingConfig.requiredCriteria, 5);
  assert.equal(speakingConfig.pronunciationScore, false);
  const writingConfig = objectValue(activitiesByKey.get("write-weekend-diary").public_config);
  assert.equal(writingConfig.minSentences, 4);
  assert.equal(writingConfig.maxSentences, 5);
  assert.equal(writingConfig.minimumInformationKinds, 5);
  assert.equal(writingConfig.requireCompletionChecklist, true);
  const listeningActivity = activitiesByKey.get("listening-afternoon");
  const publicListening = JSON.stringify(listeningActivity.public_config);
  for (const forbidden of ["normal_script", "slow_script", "pause_marks", "audio_object_key", "correct_index"]) {
    assert.equal(publicListening.includes(forbidden), false, `public listening leaked ${forbidden}`);
  }

  const secrets = await mustData(admin.from("digital_textbook_activity_secrets").select("activity_id,answer_key,explanation,transcript_ko,audio_object_key,audio_status").in("activity_id", activities.map((item) => item.id)), "load secrets");
  assert.equal(secrets.length, 12);
  assert.ok(secrets.every((item) => objectValue(item.explanation).feedback.length === 3));
  const listeningSecret = secrets.find((item) => item.activity_id === listeningActivity.id);
  assert.ok(listeningSecret.transcript_ko);
  assert.equal(listeningSecret.audio_status, "pending");
  assert.equal(listeningSecret.audio_object_key, "korean-level-one/chapter-05/listening/chapter-05-listening-afternoon.mp3");
  assert.ok(objectValue(objectValue(listeningSecret.explanation).privateListening).slowScript);
  assert.ok(objectValue(objectValue(listeningSecret.explanation).privateListening).pauseMarks);

  const media = await mustData(admin.from("digital_textbook_media_assets").select("node_id,activity_id,asset_key,media_type,object_key,production_status").in("node_id", nodes.map((item) => item.id)), "load media");
  assert.equal(media.filter((item) => item.media_type === "image").length, 12);
  assert.equal(media.filter((item) => item.media_type === "audio").length, 70);
  assert.ok(media.every((item) => item.production_status === "pending"));
  assert.ok(media.every((item) => item.object_key.startsWith("korean-level-one/chapter-05/")));
  const normalAudio = media.find((item) => item.asset_key === "chapter-05-listening-afternoon-normal");
  const slowAudio = media.find((item) => item.asset_key === "chapter-05-listening-afternoon-slow");
  assert.ok(normalAudio && slowAudio);
  assert.notEqual(normalAudio.object_key, slowAudio.object_key);
  assert.equal(normalAudio.activity_id, listeningActivity.id);
  assert.equal(slowAudio.activity_id, listeningActivity.id);
  console.log("PASS: 8 nodes, 12 contracts, private answers, 12 pending images and 70 pending audio bindings match chapter five");

  Object.assign(originalState, {
    textbookId: textbook.id,
    textbookStatus: textbook.status,
    versionId: version.id,
    versionStatus: version.status,
    chapterId: chapter.id,
    chapterStatus: chapter.status,
    priorTests: priorTests.map((item) => ({ id: item.id, status: item.status })),
    testId: testRow.id,
    testStatus: testRow.status,
    listeningId: listeningActivity.id,
    listeningStatus: listeningSecret.audio_status,
  });

  await mustData(admin.from("digital_textbooks").update({ status: "published" }).eq("id", textbook.id).select(), "publish textbook fixture");
  await mustData(admin.from("digital_textbook_versions").update({ status: "published" }).eq("id", version.id).select(), "publish version fixture");
  await mustData(admin.from("digital_textbook_chapters").update({ status: "published" }).eq("id", chapter.id).select(), "publish chapter fixture");
  await mustData(admin.from("chapter_tests").update({ status: "published" }).in("id", [...priorTests.map((item) => item.id), testRow.id]).select(), "publish test fixtures");
  await mustData(admin.from("chapter_test_questions").update({ status: "published" }).eq("test_id", testRow.id).select(), "publish questions");

  const email = `chapter-five-security-${Date.now()}@accounts.puffy.invalid`;
  const password = "LocalSecurity123!";
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "第05章本地安全测试" },
  });
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

  if (runLocalDatabaseSql("select has_table_privilege('authenticated', 'public.profiles', 'select');", "inspect profile privilege") !== "t") {
    runLocalDatabaseSql("grant select on table public.profiles to authenticated;", "install local profile prerequisite");
    profileSelectGrantInstalled = true;
  }
  const invokeAction = await createAuthenticatedActionInvoker(email, password);

  const { data: visibleSecrets, error: visibleSecretsError } = await userClient.from("digital_textbook_activity_secrets").select("activity_id,answer_key").in("activity_id", activities.map((item) => item.id));
  assert.ok(visibleSecretsError || (visibleSecrets ?? []).length === 0);
  const { data: visibleMedia, error: visibleMediaError } = await userClient.from("digital_textbook_media_assets").select("object_key").in("node_id", nodes.map((item) => item.id));
  assert.ok(visibleMediaError || (visibleMedia ?? []).length === 0);
  console.log("PASS: authenticated browser cannot read chapter-five answer secrets or private object keys");

  const firstActivity = activitiesByKey.get("orientation-check");
  const malformedResult = await invokeAction({ activityId: firstActivity.id, locale: "zh-CN", response: "0" });
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.attemptNumber, 0);
  assert.match(malformedResult.explanation, /作答结构无效/);
  assert.equal((await mustData(admin.from("digital_textbook_attempts").select("id").eq("student_id", userId).eq("activity_id", firstActivity.id), "malformed attempts")).length, 0);
  const wrongResult = await invokeAction({ activityId: firstActivity.id, locale: "zh-CN", response: 1 });
  assert.equal(wrongResult.ok, true);
  assert.equal(wrongResult.correct, false);
  assert.equal(wrongResult.attemptNumber, 1);
  console.log("PASS: malformed structure consumes no attempt while a well-formed wrong answer consumes one");

  const pendingListeningResult = await invokeAction({ activityId: listeningActivity.id, locale: "zh-CN", response: 0 });
  assert.equal(pendingListeningResult.ok, false);
  assert.match(pendingListeningResult.explanation, /待录制与核验/);
  assert.equal((await mustData(admin.from("digital_textbook_attempts").select("id").eq("student_id", userId).eq("activity_id", listeningActivity.id), "pending listening attempts")).length, 0);

  assert.ok((await userClient.from("digital_textbook_attempts").insert({ tenant_id: tenantId, student_id: userId, activity_id: firstActivity.id, version_id: version.id, attempt_number: 99, response: 0, is_correct: true, score: 100 })).error);
  assert.ok((await userClient.from("digital_textbook_node_progress").insert({ tenant_id: tenantId, student_id: userId, node_id: firstActivity.node_id, version_id: version.id, status: "completed", completion_percent: 100, mastery_score: 100, attempt_count: 1 })).error);
  assert.ok((await userClient.rpc("record_smart_textbook_attempt", { p_tenant_id: tenantId, p_student_id: userId, p_activity_id: firstActivity.id, p_version_id: version.id, p_response: 0, p_is_correct: true, p_score: 100, p_meets_completion_requirements: null })).error);
  const speakingActivity = activitiesByKey.get("speaking-weekend-story");
  const forgedOpen = await admin.rpc("record_smart_textbook_attempt", { p_tenant_id: tenantId, p_student_id: userId, p_activity_id: speakingActivity.id, p_version_id: version.id, p_response: ACTIVITY_FIXTURES.find((item) => item.key === "speaking-weekend-story").response, p_is_correct: true, p_score: 100, p_meets_completion_requirements: true });
  assert.ok(forgedOpen.error);
  assert.match(forgedOpen.error.message, /OPEN_ACTIVITY_CANNOT_BE_SCORED/);
  console.log("PASS: browser writes/RPC are denied and service role cannot forge open-activity correctness or score");

  const unknownActivity = activitiesByKey.get("dialogue-fact-check");
  const unknownSecret = secrets.find((item) => item.activity_id === unknownActivity.id);
  Object.assign(originalState, { unknownActivityId: unknownActivity.id, unknownAnswer: unknownSecret.answer_key });
  await mustData(admin.from("digital_textbook_activity_secrets").update({ answer_key: { kind: "unknown_answer_type", value: 0 } }).eq("activity_id", unknownActivity.id).select(), "install unknown answer");
  unknownAnswerFixtureInstalled = true;
  const unknownResult = await invokeAction({ activityId: unknownActivity.id, locale: "zh-CN", response: 0 });
  assert.equal(unknownResult.ok, false);
  assert.match(unknownResult.explanation, /无法识别答案类型/);
  assert.equal((await mustData(admin.from("digital_textbook_attempts").select("id").eq("student_id", userId).eq("activity_id", unknownActivity.id), "unknown attempts")).length, 0);
  await mustData(admin.from("digital_textbook_activity_secrets").update({ answer_key: unknownSecret.answer_key }).eq("activity_id", unknownActivity.id).select(), "restore answer");
  unknownAnswerFixtureInstalled = false;
  console.log("PASS: unknown answer kind fails closed without consuming an attempt");

  await mustData(admin.from("digital_textbook_activity_secrets").update({ audio_status: "ready" }).eq("activity_id", listeningActivity.id).select(), "mark local listening ready");
  const openFixtures = ACTIVITY_FIXTURES.filter((item) => item.correct === null);
  const speakingFixture = openFixtures.find((item) => item.type === "speaking");
  const speakingActivityForEvidence = activitiesByKey.get(speakingFixture.key);
  const speakingEvidence = await createSpeakingEvidence({ admin, tenantId, userId, activityId: speakingActivityForEvidence.id, response: speakingFixture.response });
  speakingFixture.response = speakingEvidence.response;
  const objectiveFixtures = ACTIVITY_FIXTURES.filter((item) => item.correct !== null);
  const completionByNode = new Set();
  for (const fixture of objectiveFixtures) {
    const activity = activitiesByKey.get(fixture.key);
    const result = await invokeAction({ activityId: activity.id, locale: "zh-CN", response: fixture.response });
    assert.equal(result.ok, true, `${fixture.key}: ${result.explanation}`);
    assert.equal(result.correct, true);
    if (result.nodeCompleted) completionByNode.add(result.nodeId);
  }
  assert.equal(completionByNode.size, 5);

  const writingActivity = activitiesByKey.get("write-weekend-diary");
  const weakWriting = await invokeAction({ activityId: writingActivity.id, locale: "zh-CN", response: { text: "가. 나. 다. 라.", informationKinds: Array(5).fill(true), rubricConfirmed: true } });
  assert.equal(weakWriting.ok, true);
  assert.equal(weakWriting.correct, null);
  assert.equal(weakWriting.score, null);
  assert.equal(weakWriting.nodeCompleted, false);
  const weakAttempt = await mustData(admin.from("digital_textbook_attempts").select("is_correct,score,meets_completion_requirements").eq("student_id", userId).eq("activity_id", writingActivity.id).single(), "load weak writing");
  assert.equal(weakAttempt.is_correct, null);
  assert.equal(weakAttempt.score, null);
  assert.equal(weakAttempt.meets_completion_requirements, false);
  assert.equal(await mustData(admin.from("course_ebook_progress").select("id").eq("student_id", userId).eq("test_slug", "korean-level-one-05").maybeSingle(), "check locked chapter"), null);

  for (const fixture of openFixtures) {
    const activity = activitiesByKey.get(fixture.key);
    const result = await invokeAction({ activityId: activity.id, locale: "zh-CN", response: fixture.response });
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

  const unlockEvidence = await mustData(admin.from("course_ebook_progress").select("progress_percent,completion_source,reading_seconds").eq("student_id", userId).eq("test_slug", "korean-level-one-05").single(), "load unlock evidence");
  assert.equal(unlockEvidence.progress_percent, 100);
  assert.equal(unlockEvidence.completion_source, "smart_textbook");
  assert.equal(unlockEvidence.reading_seconds, 0);
  const answers = Object.fromEntries(GOLDEN_QUESTIONS.map((item) => [item.key, item.answer]));
  const { data: testResult, error: testError } = await userClient.rpc("submit_course_test", { p_test_slug: "korean-level-one-05", p_answers: answers });
  assert.ifError(testError && new Error(testError.message));
  assert.equal(objectValue(testResult).passed, true);
  assert.equal(objectValue(testResult).totalQuestions, 12);
  console.log("PASS: exactly 8 completed nodes write smart_textbook evidence and unlock the chapter-five test after prior prerequisites");
} catch (error) {
  testFailure = error;
} finally {
  if (unknownAnswerFixtureInstalled && originalState.unknownActivityId) {
    await cleanup("restore unknown answer", () => admin.from("digital_textbook_activity_secrets").update({ answer_key: originalState.unknownAnswer }).eq("activity_id", originalState.unknownActivityId).select());
  }
  if (profileSelectGrantInstalled) {
    await cleanup("restore profile privilege", async () => runLocalDatabaseSql("revoke select on table public.profiles from authenticated;", "restore profile privilege"));
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
  throw new AggregateError(testFailure ? [testFailure, ...cleanupFailures] : cleanupFailures, "chapter-five security verification and/or cleanup failed");
}
if (testFailure) throw testFailure;
console.log("PASS: cleanup restored every chapter-five local fixture with no suppressed errors");
