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
  { key: "golden-02-01", prompt: "物品在说话人手边时，“这是什么？”应怎样说？", options: ["이거는 뭐예요?", "그거는 뭐예요?", "저거는 뭐예요?", "지금 몇 시예요?"], answer: 0 },
  { key: "golden-02-02", prompt: "“연필 주세요.”中的 연필 是什么？", options: ["铅笔", "橡皮", "钥匙", "雨伞"], answer: 0 },
  { key: "golden-02-03", prompt: "“공책___ 있어요?”应填入哪一项？", options: ["가", "이", "하고", "주세요"], answer: 1 },
  { key: "golden-02-04", prompt: "“지우개___ 있어요?”应填入哪一项？", options: ["가", "이", "과", "는"], answer: 0 },
  { key: "golden-02-05", prompt: "物品靠近听话人时，应选择哪一句？", options: ["이거는 공책이에요?", "그거는 공책이에요?", "저거는 공책이에요?", "공책이 없어요?"], answer: 1 },
  { key: "golden-02-06", prompt: "哪一句是在礼貌请求铅笔？", options: ["연필이 있어요?", "연필이 없어요.", "연필 주세요.", "연필하고 있어요."], answer: 2 },
  { key: "golden-02-07", prompt: "口语中连接“笔记本和铅笔”最合适的是哪一项？", options: ["공책고 연필", "공책하고 연필", "공책이 연필", "공책 주세요 연필"], answer: 1 },
  { key: "golden-02-08", prompt: "实际没有橡皮时，怎样回答“지우개가 있어요?”最自然？", options: ["아니요, 없어요.", "네, 있어요.", "지우개 주세요.", "저거는 뭐예요?"] , answer: 0 },
  { key: "golden-02-09", prompt: "母本两个场景中，主场景没有什么，第二场景远处是什么？", options: ["연필／볼펜", "공책／책", "지우개／지도", "우산／연필"], answer: 2 },
  { key: "golden-02-10", prompt: "课堂用品便条中写着“연필이 없어요.”，缺少什么？", options: ["书", "铅笔", "笔记本", "橡皮"], answer: 1 },
  { key: "golden-02-11", prompt: "哪一组最符合物品交流的自然顺序？", options: ["请求→问名称→回答→问有无", "问有无→请求→问名称→回答", "回答→问名称→请求→问有无", "问名称→回答→问有无→回答→请求"], answer: 3 },
  { key: "golden-02-12", prompt: "课末双角色任务必须满足哪一项？", options: ["只背物品清单", "只问一次名称", "约30秒、至少8轮，并包含距离、名称、有无和两件物品请求", "加入价格与付款"], answer: 2 },
];

const ACTIVITY_FIXTURES = [
  { key: "orientation-check", type: "single_choice", counts: true, response: 0, correct: true },
  { key: "vocabulary-check", type: "single_choice", counts: true, response: { selection: 0, confirmed: true }, correct: true },
  { key: "grammar-fill", type: "fill_blank", counts: true, response: ["이", "가", "그거", "주세요", "하고"], correct: true },
  { key: "pattern-order", type: "ordering", counts: true, response: [3, 1, 4, 2, 0], correct: true },
  { key: "dialogue-fact-check", type: "single_choice", counts: true, response: 0, correct: true },
  { key: "dialogue-response", type: "single_choice", counts: true, response: 0, correct: true },
  { key: "listening-missing-item", type: "listening", counts: true, response: 0, correct: true },
  { key: "speaking-object-request", type: "speaking", counts: true, response: { recorded: true, durationSeconds: 30, turns: 8, criteria: [true, true, true, true, true, true] }, correct: null },
  { key: "reading-supply-card", type: "single_choice", counts: true, response: [0, 0, 0], correct: true },
  { key: "write-object-note", type: "writing", counts: true, response: { text: "이거는 가방이에요. 책이 있어요. 연필이 없어요. 우산하고 열쇠 주세요.", informationKinds: [true, true, true, true], rubricConfirmed: true }, correct: null },
  { key: "review-multiple", type: "multiple_choice", counts: true, response: [0, 1, 2], correct: true },
  { key: "self-check", type: "self_check", counts: true, response: { checks: ["can", "can", "can", "can", "can"], returnNodes: ["none"], note: "" }, correct: null },
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

let actionModulePromise = null;

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

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
            url: "data:text/javascript,export%20async%20function%20cookies()%7Breturn%20globalThis.__CHAPTER_TWO_SECURITY_COOKIE_STORE__%7D",
          };
        }
        if (specifier.startsWith("@/")) {
          const basePath = resolvePath(process.cwd(), "src", specifier.slice(2));
          const filePath = [basePath, `${basePath}.ts`, `${basePath}.tsx`, resolvePath(basePath, "index.ts")].find(isFile);
          assert.ok(filePath, `cannot resolve production alias ${specifier}`);
          return { shortCircuit: true, url: pathToFileURL(filePath).href };
        }
        if (specifier === "next/navigation") {
          return nextResolve(`${specifier}.js`, context);
        }
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
  const { error } = await authClient.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  assert.ifError(userError);
  assert.ok(user, "local Server Action cookie session must authenticate");

  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  globalThis.__CHAPTER_TWO_SECURITY_COOKIE_STORE__ = {
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

async function recordCleanup(label, operation) {
  try {
    const result = await operation();
    if (result?.error) throw result.error;
  } catch (error) {
    cleanupFailures.push(new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`));
  }
}

function assertInvalid(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(answerKey, response, activityType, config, options);
  assert.equal(result.ok, false, `${label}: malformed response must be rejected`);
  assert.match(result.error, /作答结构无效/, `${label}: rejection must explain the structural error`);
}

function assertWrong(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(answerKey, response, activityType, config, options);
  assert.equal(result.ok, true, `${label}: well-formed wrong answer must remain an attempt`);
  assert.equal(result.correct, false, `${label}: well-formed wrong answer must be incorrect`);
}

function assertOpenBelowThreshold(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(answerKey, response, activityType, config, options);
  assert.equal(result.ok, true, `${label}: well-formed open submission must remain an attempt`);
  assert.equal(result.correct, null, `${label}: open submission must not have correctness`);
  assert.equal(result.score, null, `${label}: open submission must not have a score`);
  assert.equal(result.meetsCompletionRequirements, false, `${label}: submission must remain below threshold`);
}

function assertCorrect(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(answerKey, response, activityType, config, options);
  assert.equal(result.ok, true, `${label}: valid answer must be accepted`);
  assert.equal(result.correct, true, `${label}: equivalent whitespace must remain correct`);
}

assertInvalid("text array strict container", { kind: "text_array", value: ["그거", "주세요"] }, "그거,주세요", "fill_blank", {}, []);
assertInvalid("text array strict members", { kind: "text_array", value: ["그거", "주세요"] }, ["그거", false], "fill_blank", {}, []);
assertInvalid("text array rejects blanks", { kind: "text_array", value: ["그거", "주세요"] }, ["그거", "   "], "fill_blank", {}, []);
assertInvalid("text array rejects missing item", { kind: "text_array", value: ["그거", "주세요"] }, ["그거"], "fill_blank", {}, []);
assertInvalid("order strict container", { kind: "order", value: [1, 0] }, null, "ordering", {}, ["A", "B"]);
assertInvalid("order strict permutation members", { kind: "order", value: [1, 0] }, ["1", 0], "ordering", {}, ["A", "B"]);
assertInvalid("order rejects missing item", { kind: "order", value: [1, 0] }, [1], "ordering", {}, ["A", "B"]);
assertInvalid("order rejects duplicate item", { kind: "order", value: [1, 0] }, [1, 1], "ordering", {}, ["A", "B"]);
assertInvalid("indices strict container", { kind: "indices", value: [0, 1] }, "0,1", "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices rejects empty answer", { kind: "indices", value: [0, 1] }, [], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices strict members", { kind: "indices", value: [0, 1] }, ["0", 1], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices unique members", { kind: "indices", value: [0, 1] }, [0, 0], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices bounded members", { kind: "indices", value: [0, 1] }, [0, 3], "multiple_choice", {}, ["A", "B", "C"]);
const groupedChoiceConfig = { items: [{ options: ["A", "B"] }, { options: ["C", "D"] }] };
assertInvalid("index array strict container", { kind: "index_array", value: [0, 0] }, null, "single_choice", groupedChoiceConfig, []);
assertInvalid("index array rejects sentinel", { kind: "index_array", value: [0, 0] }, [-1, 0], "single_choice", groupedChoiceConfig, []);
assertInvalid("index array strict members", { kind: "index_array", value: [0, 0] }, ["0", 0], "single_choice", groupedChoiceConfig, []);
assertInvalid("index array rejects missing item", { kind: "index_array", value: [0, 0] }, [0], "single_choice", groupedChoiceConfig, []);
assertInvalid("index confirmation strict object", { kind: "index_confirmation", value: 0 }, null, "single_choice", {}, ["A", "B"]);
assertInvalid("index confirmation strict selection", { kind: "index_confirmation", value: 0 }, { selection: "0", confirmed: true }, "single_choice", {}, ["A", "B"]);
assertInvalid("index confirmation requires confirmation", { kind: "index_confirmation", value: 0 }, { selection: 0, confirmed: false }, "single_choice", {}, ["A", "B"]);
const speakingConfig = { minimumSeconds: 25, maximumSeconds: 40, minimumTurns: 8, requiredCriteria: 6, enforceCompletionRequirements: true };
assertInvalid("speaking strict object", { kind: "open" }, null, "speaking", speakingConfig, []);
assertInvalid("speaking strict duration", { kind: "open" }, { recorded: true, durationSeconds: "30", turns: 8, criteria: Array(6).fill(true) }, "speaking", speakingConfig, []);
assertOpenBelowThreshold("speaking below minimum duration", { kind: "open" }, { recorded: true, durationSeconds: 10, turns: 8, criteria: Array(6).fill(true) }, "speaking", speakingConfig, []);
assertOpenBelowThreshold("speaking below minimum turns", { kind: "open" }, { recorded: true, durationSeconds: 30, turns: 7, criteria: Array(6).fill(true) }, "speaking", speakingConfig, []);
assertOpenBelowThreshold("speaking missing a criterion", { kind: "open" }, { recorded: true, durationSeconds: 30, turns: 8, criteria: [true, true, true, true, true, false] }, "speaking", speakingConfig, []);
const writingConfig = { minSentences: 4, maxSentences: 5, minimumHangulCharacters: 20, minimumInformationKinds: 4, requireCompletionChecklist: true, informationChecklist: ["a", "b", "c", "d"] };
assertInvalid("writing strict object", { kind: "open" }, null, "writing", writingConfig, []);
assertInvalid("writing strict text", { kind: "open" }, { text: [] }, "writing", writingConfig, []);
assertInvalid("writing requires checklist fields", { kind: "open" }, { text: "이거는 가방이에요. 책이 있어요. 연필이 없어요. 우산 주세요." }, "writing", writingConfig, []);
assertInvalid("self-check strict object", { kind: "open" }, null, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
assertInvalid("self-check strict arrays", { kind: "open" }, { checks: ["can", false], returnNodes: ["none"] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
assertInvalid("self-check rejects empty arrays", { kind: "open" }, { checks: [], returnNodes: [] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
console.log("PASS: chapter-two structural preflight rejects malformed responses while well-formed below-threshold speaking remains unscored");

assertCorrect("outer and repeated whitespace normalization", { kind: "text", value: "공책 주세요" }, "  공책   주세요  ", "fill_blank", {}, []);
assertWrong("internal space in demonstrative", { kind: "text", value: "그거" }, "그 거", "fill_blank", {}, []);
assertWrong("internal space in request form", { kind: "text", value: "주세요" }, "주 세 요", "fill_blank", {}, []);
assertWrong("internal spaces in text array", { kind: "text_array", value: ["그거", "주세요"] }, ["그 거", "주 세 요"], "fill_blank", {}, []);
console.log("PASS: whitespace normalization trims/collapses surplus spacing but preserves internal Korean spelling differences");

const originalState = {};
const cleanupFailures = [];
let testFailure = null;
let userId = null;
let profileSelectGrantInstalled = false;
let unknownAnswerFixtureInstalled = false;

try {
  const textbook = await mustData(
    admin.from("digital_textbooks").select("id,status").eq("slug", "korean-level-one-smart").single(),
    "load textbook",
  );
  const version = await mustData(
    admin.from("digital_textbook_versions").select("id,status").eq("textbook_id", textbook.id).order("version_number", { ascending: false }).limit(1).single(),
    "load version",
  );
  const chapter = await mustData(
    admin.from("digital_textbook_chapters").select("id,status,chapter_test_id,production_status,native_review_status,audio_status,image_status,source_revision").eq("version_id", version.id).eq("chapter_number", 2).single(),
    "load chapter two",
  );
  const chapterOneTest = await mustData(
    admin.from("chapter_tests").select("id,status").eq("slug", "korean-level-one-01").single(),
    "load chapter one test prerequisite",
  );
  const testRow = await mustData(
    admin.from("chapter_tests").select("id,status,passing_score").eq("slug", "korean-level-one-02").single(),
    "load chapter two test",
  );
  const questions = await mustData(
    admin.from("chapter_test_questions").select("question_key,prompt,options,correct_option,status").eq("test_id", testRow.id).order("sort_order"),
    "load chapter two questions",
  );

  assert.equal(chapter.status, "draft");
  assert.equal(chapter.production_status, "editorial_review");
  assert.equal(chapter.native_review_status, "pending");
  assert.equal(chapter.audio_status, "pending");
  assert.equal(chapter.image_status, "pending");
  assert.match(chapter.source_revision, /83f74f20cbaf86519e541ecb273302293888195e78c1b2d590550cebe39dcf71/);
  assert.equal(testRow.status, "draft");
  assert.equal(testRow.passing_score, 60, "chapter-two passing score must match the master-recorded current value");
  assert.equal(questions.length, 12);
  assert.ok(questions.every((question) => question.status === "draft"));
  for (const [index, expected] of GOLDEN_QUESTIONS.entries()) {
    const actual = questions[index];
    assert.equal(actual.question_key, expected.key, `${expected.key}: key mismatch`);
    assert.equal(actual.prompt, expected.prompt, `${expected.key}: prompt mismatch`);
    assert.deepEqual(actual.options, expected.options, `${expected.key}: options mismatch`);
    assert.equal(actual.correct_option, expected.answer, `${expected.key}: answer mismatch`);
  }
  console.log("PASS: chapter two and its 12-question assessment are draft/pending, use passing_score=60, and match an independently hard-coded vector");

  const modules = await mustData(
    admin.from("digital_textbook_modules").select("id,module_code,sort_order").eq("chapter_id", chapter.id).order("sort_order"),
    "load modules",
  );
  assert.equal(modules.length, 8);
  assert.deepEqual(modules.map((module) => module.module_code), ["orientation", "vocabulary", "grammar", "patterns", "dialogue", "listen_speak", "read_write", "review"]);
  const nodes = await mustData(
    admin.from("digital_textbook_nodes").select("id,module_id,node_code,content").in("module_id", modules.map((module) => module.id)),
    "load nodes",
  );
  assert.equal(nodes.length, 8);
  const vocabularyNode = nodes.find((node) => node.node_code === "objects-and-distance");
  const grammarNode = nodes.find((node) => node.node_code === "point-exist-request");
  const dialogueNode = nodes.find((node) => node.node_code === "supply-desk-dialogue");
  assert.ok(vocabularyNode && grammarNode && dialogueNode);
  assert.equal(objectValue(vocabularyNode.content).vocabulary.length, 22);
  assert.equal(objectValue(grammarNode.content).grammarCards.length, 4);
  assert.deepEqual(
    objectValue(dialogueNode.content).dialogueScenes.map((scene) => scene.lines.length),
    [8, 6],
  );
  console.log("PASS: 8 nodes contain 22 source-derived vocabulary/function items, 4 grammar cards, and 8+6 dialogue turns");

  const activities = await mustData(
    admin.from("digital_textbook_activities").select("id,node_id,activity_key,activity_type,sort_order,max_attempts,counts_toward_completion,public_config").in("node_id", nodes.map((node) => node.id)),
    "load activities",
  );
  assert.equal(activities.length, 12);
  const activitiesByKey = new Map(activities.map((activity) => [activity.activity_key, activity]));
  for (const fixture of ACTIVITY_FIXTURES) {
    const activity = activitiesByKey.get(fixture.key);
    assert.ok(activity, `missing activity ${fixture.key}`);
    assert.equal(activity.activity_type, fixture.type, `${fixture.key}: type mismatch`);
    assert.equal(activity.counts_toward_completion, fixture.counts, `${fixture.key}: completion flag mismatch`);
    assert.equal(activity.max_attempts, 3, `${fixture.key}: max_attempts mismatch`);
  }
  const listeningActivity = activitiesByKey.get("listening-missing-item");
  assert.ok(listeningActivity);
  const publicListeningConfig = JSON.stringify(listeningActivity.public_config);
  for (const forbidden of ["normal_script", "slow_script", "pause_marks", "audio_object_key", "correct_index"]) {
    assert.equal(publicListeningConfig.includes(forbidden), false, `public listening config leaked ${forbidden}`);
  }
  console.log("PASS: all 12 activity contracts match the hard-coded type/completion vector and public listening config contains no private answer/script/object key");

  const secrets = await mustData(
    admin.from("digital_textbook_activity_secrets").select("activity_id,answer_key,explanation,transcript_ko,audio_object_key,audio_status").in("activity_id", activities.map((activity) => activity.id)),
    "load service-only secrets",
  );
  assert.equal(secrets.length, 12);
  for (const secret of secrets) {
    assert.equal(objectValue(secret.explanation).feedback.length, 3);
  }
  const listeningSecret = secrets.find((secret) => secret.activity_id === listeningActivity.id);
  assert.ok(listeningSecret?.transcript_ko);
  assert.equal(listeningSecret.audio_status, "pending");
  assert.equal(listeningSecret.audio_object_key, "korean-level-one/chapter-02/listening/chapter-02-listening-missing-item.mp3");

  const media = await mustData(
    admin.from("digital_textbook_media_assets").select("id,node_id,activity_id,asset_key,media_type,object_key,production_status,metadata").in("node_id", nodes.map((node) => node.id)),
    "load media manifest",
  );
  const images = media.filter((asset) => asset.media_type === "image");
  const audio = media.filter((asset) => asset.media_type === "audio");
  assert.equal(images.length, 12);
  assert.equal(audio.length, 66);
  assert.ok(media.every((asset) => asset.production_status === "pending"));
  assert.ok(media.every((asset) => asset.object_key.startsWith("korean-level-one/chapter-02/")));
  const normalAudio = media.find((asset) => asset.asset_key === "chapter-02-listening-missing-item-normal");
  const slowAudio = media.find((asset) => asset.asset_key === "chapter-02-listening-missing-item-slow");
  assert.ok(normalAudio && slowAudio);
  assert.notEqual(normalAudio.object_key, slowAudio.object_key);
  assert.equal(normalAudio.activity_id, listeningActivity.id);
  assert.equal(slowAudio.activity_id, listeningActivity.id);
  console.log("PASS: media manifest has 12 pending images and 66 pending audio bindings, including independent normal/slow listening object keys");

  Object.assign(originalState, {
    textbookId: textbook.id,
    textbookStatus: textbook.status,
    versionId: version.id,
    versionStatus: version.status,
    chapterId: chapter.id,
    chapterStatus: chapter.status,
    chapterOneTestId: chapterOneTest.id,
    chapterOneTestStatus: chapterOneTest.status,
    testId: testRow.id,
    testStatus: testRow.status,
    listeningId: listeningActivity.id,
    listeningStatus: listeningSecret.audio_status,
  });

  await mustData(admin.from("digital_textbooks").update({ status: "published" }).eq("id", textbook.id).select(), "publish textbook fixture");
  await mustData(admin.from("digital_textbook_versions").update({ status: "published" }).eq("id", version.id).select(), "publish version fixture");
  await mustData(admin.from("digital_textbook_chapters").update({ status: "published" }).eq("id", chapter.id).select(), "publish chapter fixture");
  await mustData(admin.from("chapter_tests").update({ status: "published" }).in("id", [chapterOneTest.id, testRow.id]).select(), "publish test fixtures");
  await mustData(admin.from("chapter_test_questions").update({ status: "published" }).eq("test_id", testRow.id).select(), "publish chapter two question fixtures");

  const email = `chapter-two-security-${Date.now()}@accounts.puffy.invalid`;
  const password = "LocalSecurity123!";
  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "第02章本地安全测试" },
  });
  assert.ifError(createUserError);
  assert.ok(createdUser.user);
  userId = createdUser.user.id;

  await mustData(
    admin.from("tenant_memberships").insert({ tenant_id: tenantId, user_id: userId, role: "student", status: "active", membership_tier: "vip2", is_default: true, joined_at: new Date().toISOString() }).select(),
    "create student membership",
  );
  const { error: managerSignInError } = await managerClient.auth.signInWithPassword({ email: "local-admin@accounts.puffy.invalid", password: "PuffyLocal123!" });
  assert.ifError(managerSignInError);
  const { error: enrollmentError } = await managerClient.rpc("set_student_application_enrollment", { p_student_id: userId, p_app_id: koreanAppId, p_status: "active" });
  assert.ifError(enrollmentError);
  await managerClient.auth.signOut();
  const { error: signInError } = await userClient.auth.signInWithPassword({ email, password });
  assert.ifError(signInError);

  await mustData(
    admin.from("chapter_test_attempts").insert({ tenant_id: tenantId, student_id: userId, test_id: chapterOneTest.id, test_slug: "korean-level-one-01", test_version: 1, score: 100, correct_count: 12, total_questions: 12, passed: true, answers: {}, dimension_scores: {} }).select(),
    "seed verified prior-chapter prerequisite fixture",
  );

  const profileSelectWasGranted = runLocalDatabaseSql(
    "select has_table_privilege('authenticated', 'public.profiles', 'select');",
    "inspect authenticated profile read privilege",
  );
  if (profileSelectWasGranted !== "t") {
    runLocalDatabaseSql("grant select on table public.profiles to authenticated;", "install local profile read prerequisite");
    profileSelectGrantInstalled = true;
  }
  const invokeProductionAction = await createAuthenticatedActionInvoker(email, password);

  const { data: visibleSecrets, error: visibleSecretsError } = await userClient
    .from("digital_textbook_activity_secrets")
    .select("activity_id,answer_key")
    .in("activity_id", activities.map((activity) => activity.id));
  assert.ok(visibleSecretsError || (visibleSecrets ?? []).length === 0, "authenticated client must not read answer secrets");
  const { data: visibleMedia, error: visibleMediaError } = await userClient
    .from("digital_textbook_media_assets")
    .select("object_key")
    .in("node_id", nodes.map((node) => node.id));
  assert.ok(visibleMediaError || (visibleMedia ?? []).length === 0, "authenticated client must not read private media object keys");
  console.log("PASS: authenticated browser client cannot read answer secrets or private media object keys");

  const firstActivity = activitiesByKey.get("orientation-check");
  assert.ok(firstActivity);
  const attemptsBeforeMalformed = await mustData(
    admin.from("digital_textbook_attempts").select("id").eq("tenant_id", tenantId).eq("student_id", userId).eq("activity_id", firstActivity.id),
    "count attempts before malformed action submission",
  );
  const malformedResult = await invokeProductionAction({ activityId: firstActivity.id, locale: "zh-CN", response: "0" });
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.attemptNumber, 0);
  assert.match(malformedResult.explanation, /作答结构无效/);
  const attemptsAfterMalformed = await mustData(
    admin.from("digital_textbook_attempts").select("id").eq("tenant_id", tenantId).eq("student_id", userId).eq("activity_id", firstActivity.id),
    "count attempts after malformed action submission",
  );
  assert.equal(attemptsAfterMalformed.length, attemptsBeforeMalformed.length);
  console.log("PASS: real chapter-two Server Action rejects a string index and malformed structure consumes no attempt");

  const wrongResult = await invokeProductionAction({ activityId: firstActivity.id, locale: "zh-CN", response: 1 });
  assert.equal(wrongResult.ok, true);
  assert.equal(wrongResult.correct, false);
  assert.equal(wrongResult.attemptNumber, 1);
  console.log("PASS: well-formed wrong chapter-two answer is persisted as exactly one normal attempt");

  const pendingListeningResult = await invokeProductionAction({ activityId: listeningActivity.id, locale: "zh-CN", response: 0 });
  assert.equal(pendingListeningResult.ok, false);
  assert.match(pendingListeningResult.explanation, /待录制与核验/);
  const pendingListeningAttempts = await mustData(
    admin.from("digital_textbook_attempts").select("id").eq("tenant_id", tenantId).eq("student_id", userId).eq("activity_id", listeningActivity.id),
    "verify pending listening writes no attempt",
  );
  assert.equal(pendingListeningAttempts.length, 0);
  console.log("PASS: pending listening binding blocks submission and writes no attempt");

  const { error: directAttemptError } = await userClient.from("digital_textbook_attempts").insert({ tenant_id: tenantId, student_id: userId, activity_id: firstActivity.id, version_id: version.id, attempt_number: 99, response: 0, is_correct: true, score: 100 });
  assert.ok(directAttemptError);
  const { error: directProgressError } = await userClient.from("digital_textbook_node_progress").insert({ tenant_id: tenantId, student_id: userId, node_id: firstActivity.node_id, version_id: version.id, status: "completed", completion_percent: 100, mastery_score: 100, attempt_count: 1 });
  assert.ok(directProgressError);
  const { error: directRpcError } = await userClient.rpc("record_smart_textbook_attempt", { p_tenant_id: tenantId, p_student_id: userId, p_activity_id: firstActivity.id, p_version_id: version.id, p_response: 0, p_is_correct: true, p_score: 100, p_meets_completion_requirements: null });
  assert.ok(directRpcError);
  console.log("PASS: authenticated direct attempt/progress writes and direct service-only RPC invocation are rejected");

  const speakingActivity = activitiesByKey.get("speaking-object-request");
  assert.ok(speakingActivity);
  const { error: forgedOpenScoreError } = await admin.rpc("record_smart_textbook_attempt", {
    p_tenant_id: tenantId,
    p_student_id: userId,
    p_activity_id: speakingActivity.id,
    p_version_id: version.id,
    p_response: ACTIVITY_FIXTURES.find((fixture) => fixture.key === "speaking-object-request").response,
    p_is_correct: false,
    p_score: 0,
    p_meets_completion_requirements: false,
  });
  assert.ok(forgedOpenScoreError);
  assert.match(forgedOpenScoreError.message, /OPEN_ACTIVITY_CANNOT_BE_SCORED/);
  const forgedOpenAttempts = await mustData(
    admin.from("digital_textbook_attempts").select("id").eq("tenant_id", tenantId).eq("student_id", userId).eq("activity_id", speakingActivity.id),
    "verify scored open activity writes no attempt",
  );
  assert.equal(forgedOpenAttempts.length, 0);
  console.log("PASS: even the service-only recorder rejects the legacy false/0 combination for an open activity and writes no attempt");

  const unknownKindActivity = activitiesByKey.get("dialogue-fact-check");
  assert.ok(unknownKindActivity);
  const originalUnknownAnswer = secrets.find((secret) => secret.activity_id === unknownKindActivity.id).answer_key;
  Object.assign(originalState, { unknownAnswerActivityId: unknownKindActivity.id, unknownAnswer: originalUnknownAnswer });
  await mustData(
    admin.from("digital_textbook_activity_secrets").update({ answer_key: { kind: "unknown_answer_type", value: 0 } }).eq("activity_id", unknownKindActivity.id).select(),
    "install unknown answer fixture",
  );
  unknownAnswerFixtureInstalled = true;
  const unknownKindResult = await invokeProductionAction({ activityId: unknownKindActivity.id, locale: "zh-CN", response: 0 });
  assert.equal(unknownKindResult.ok, false);
  assert.match(unknownKindResult.explanation, /无法识别答案类型/);
  const unknownKindAttempts = await mustData(
    admin.from("digital_textbook_attempts").select("id").eq("tenant_id", tenantId).eq("student_id", userId).eq("activity_id", unknownKindActivity.id),
    "verify unknown answer writes no attempt",
  );
  assert.equal(unknownKindAttempts.length, 0);
  await mustData(admin.from("digital_textbook_activity_secrets").update({ answer_key: originalUnknownAnswer }).eq("activity_id", unknownKindActivity.id).select(), "restore unknown answer fixture");
  unknownAnswerFixtureInstalled = false;
  console.log("PASS: unknown chapter-two answer kind fails closed through the real Server Action and writes no attempt");

  await mustData(
    admin.from("digital_textbook_activity_secrets").update({ audio_status: "ready" }).eq("activity_id", listeningActivity.id).select(),
    "mark local listening fixture ready",
  );

  const openFixtures = ACTIVITY_FIXTURES.filter((fixture) => ["speaking", "writing", "self_check"].includes(fixture.type));
  const objectiveFixtures = ACTIVITY_FIXTURES.filter((fixture) => !openFixtures.includes(fixture));
  const completionByNode = new Map();
  for (const fixture of objectiveFixtures) {
    const activity = activitiesByKey.get(fixture.key);
    const result = await invokeProductionAction({ activityId: activity.id, locale: "zh-CN", response: fixture.response });
    assert.equal(result.ok, true, `${fixture.key}: ${result.explanation}`);
    assert.equal(result.correct, fixture.correct, `${fixture.key}: correctness mismatch`);
    if (result.nodeCompleted) completionByNode.set(result.nodeId, result);
  }
  assert.equal(completionByNode.size, 5);

  const writingFixture = ACTIVITY_FIXTURES.find((fixture) => fixture.key === "write-object-note");
  const writingActivity = activitiesByKey.get(writingFixture.key);
  const weakWritingResult = await invokeProductionAction({
    activityId: writingActivity.id,
    locale: "zh-CN",
    response: {
      text: "가. 나. 다. 라.",
      informationKinds: [true, true, true, true],
      rubricConfirmed: true,
    },
  });
  assert.equal(weakWritingResult.ok, true, weakWritingResult.explanation);
  assert.equal(weakWritingResult.correct, null);
  assert.equal(weakWritingResult.score, null);
  assert.equal(weakWritingResult.nodeCompleted, false);
  const weakWritingAttempt = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("is_correct,score,meets_completion_requirements")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", writingActivity.id)
      .single(),
    "load below-threshold chapter-two writing attempt",
  );
  assert.equal(weakWritingAttempt.is_correct, null);
  assert.equal(weakWritingAttempt.score, null);
  assert.equal(weakWritingAttempt.meets_completion_requirements, false);
  const progressAfterWeakWriting = await mustData(
    admin
      .from("digital_textbook_node_progress")
      .select("status,completion_percent,mastery_score")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("node_id", writingActivity.node_id)
      .eq("version_id", version.id)
      .single(),
    "load mastery after below-threshold chapter-two writing",
  );
  assert.equal(progressAfterWeakWriting.status, "in_progress");
  assert.equal(progressAfterWeakWriting.completion_percent, 50);
  assert.equal(progressAfterWeakWriting.mastery_score, 100);
  console.log("PASS: below-threshold chapter-two writing persists NULL/NULL and leaves mastery at the objective reading score of 100");

  const openNodeIds = openFixtures.map((fixture) => activitiesByKey.get(fixture.key).node_id);
  const progressWithoutOpenSubmissions = await mustData(
    admin.from("digital_textbook_node_progress").select("node_id,status,completion_percent").eq("tenant_id", tenantId).eq("student_id", userId).eq("version_id", version.id).in("node_id", openNodeIds),
    "load progress with speaking/writing/self-check omitted",
  );
  assert.equal(progressWithoutOpenSubmissions.length, 3);
  assert.ok(progressWithoutOpenSubmissions.every((progress) => progress.status !== "completed" && progress.completion_percent < 100));
  const unlockWithoutOpenSubmissions = await mustData(
    admin.from("course_ebook_progress").select("id").eq("tenant_id", tenantId).eq("student_id", userId).eq("test_slug", "korean-level-one-02").maybeSingle(),
    "verify chapter remains locked with open submissions omitted",
  );
  assert.equal(unlockWithoutOpenSubmissions, null);
  console.log("PASS: omitting speaking, writing, and self-check keeps each corresponding node incomplete and leaves chapter two locked");

  for (const fixture of openFixtures) {
    const activity = activitiesByKey.get(fixture.key);
    const result = await invokeProductionAction({ activityId: activity.id, locale: "zh-CN", response: fixture.response });
    assert.equal(result.ok, true, `${fixture.key}: ${result.explanation}`);
    assert.equal(result.correct, null, `${fixture.key}: open completion evidence must remain unscored`);
    assert.equal(result.score, null, `${fixture.key}: open completion evidence must not receive a score`);
    assert.equal(result.nodeCompleted, true, `${fixture.key}: valid open submission must complete its node`);
    completionByNode.set(result.nodeId, result);
  }
  assert.equal(completionByNode.size, 8);
  const openAttempts = await mustData(
    admin.from("digital_textbook_attempts").select("activity_id,is_correct,score,meets_completion_requirements").eq("tenant_id", tenantId).eq("student_id", userId).in("activity_id", openFixtures.map((fixture) => activitiesByKey.get(fixture.key).id)),
    "load persisted open completion evidence",
  );
  assert.equal(openAttempts.length, 4);
  assert.ok(openAttempts.every((attempt) => attempt.is_correct === null && attempt.score === null));
  const persistedWritingAttempts = openAttempts.filter((attempt) => attempt.activity_id === writingActivity.id);
  assert.equal(persistedWritingAttempts.length, 2);
  assert.deepEqual(
    persistedWritingAttempts.map((attempt) => attempt.meets_completion_requirements).sort(),
    [false, true],
  );
  const completedWritingProgress = await mustData(
    admin
      .from("digital_textbook_node_progress")
      .select("status,completion_percent,mastery_score")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("node_id", writingActivity.node_id)
      .eq("version_id", version.id)
      .single(),
    "load completed chapter-two writing-node mastery",
  );
  assert.equal(completedWritingProgress.status, "completed");
  assert.equal(completedWritingProgress.completion_percent, 100);
  assert.equal(completedWritingProgress.mastery_score, 100);
  console.log("PASS: valid open submissions complete all 8 nodes; prior failed writing stays NULL/NULL and cannot reduce objective-only mastery");

  const completedProgress = await mustData(
    admin.from("digital_textbook_node_progress").select("node_id,status,completion_percent").eq("tenant_id", tenantId).eq("student_id", userId).eq("version_id", version.id).in("node_id", nodes.map((node) => node.id)).eq("status", "completed").eq("completion_percent", 100),
    "load completed chapter-two progress",
  );
  assert.equal(completedProgress.length, 8);

  const unlockEvidence = await mustData(
    admin.from("course_ebook_progress").select("progress_percent,completion_source,reading_seconds").eq("tenant_id", tenantId).eq("student_id", userId).eq("test_slug", "korean-level-one-02").single(),
    "load chapter-two smart textbook unlock",
  );
  assert.equal(unlockEvidence.progress_percent, 100);
  assert.equal(unlockEvidence.completion_source, "smart_textbook");
  assert.equal(unlockEvidence.reading_seconds, 0);
  console.log("PASS: 8-node trigger records smart_textbook completion with reading_seconds=0 and does not depend on the legacy 600-second ebook gate");

  const answers = Object.fromEntries(GOLDEN_QUESTIONS.map((question) => [question.key, question.answer]));
  const { data: testResult, error: testError } = await userClient.rpc("submit_course_test", { p_test_slug: "korean-level-one-02", p_answers: answers });
  assert.ifError(testError && new Error(testError.message));
  assert.equal(objectValue(testResult).passed, true);
  assert.equal(objectValue(testResult).totalQuestions, 12);
  console.log("PASS: chapter-two test RPC accepts the independently hard-coded 12-answer vector after prior-test and 8-node prerequisites");
} catch (error) {
  testFailure = error;
} finally {
  if (unknownAnswerFixtureInstalled && originalState.unknownAnswerActivityId) {
    await recordCleanup("restore interrupted unknown answer fixture", () =>
      admin.from("digital_textbook_activity_secrets").update({ answer_key: originalState.unknownAnswer }).eq("activity_id", originalState.unknownAnswerActivityId).select(),
    );
  }
  if (profileSelectGrantInstalled) {
    await recordCleanup("restore authenticated profile read privilege", async () => {
      runLocalDatabaseSql("revoke select on table public.profiles from authenticated;", "restore local profile read prerequisite");
    });
  }
  if (originalState.listeningId) {
    await recordCleanup("restore listening status", () =>
      admin.from("digital_textbook_activity_secrets").update({ audio_status: originalState.listeningStatus }).eq("activity_id", originalState.listeningId).select(),
    );
  }
  if (originalState.testId) {
    await recordCleanup("restore chapter two questions", () => admin.from("chapter_test_questions").update({ status: "draft" }).eq("test_id", originalState.testId).select());
    await recordCleanup("restore chapter two test", () => admin.from("chapter_tests").update({ status: originalState.testStatus }).eq("id", originalState.testId).select());
  }
  if (originalState.chapterOneTestId) {
    await recordCleanup("restore chapter one test", () => admin.from("chapter_tests").update({ status: originalState.chapterOneTestStatus }).eq("id", originalState.chapterOneTestId).select());
  }
  if (originalState.chapterId) {
    await recordCleanup("restore chapter", () => admin.from("digital_textbook_chapters").update({ status: originalState.chapterStatus }).eq("id", originalState.chapterId).select());
  }
  if (originalState.versionId) {
    await recordCleanup("restore version", () => admin.from("digital_textbook_versions").update({ status: originalState.versionStatus }).eq("id", originalState.versionId).select());
  }
  if (originalState.textbookId) {
    await recordCleanup("restore textbook", () => admin.from("digital_textbooks").update({ status: originalState.textbookStatus }).eq("id", originalState.textbookId).select());
  }
  if (userId) {
    await recordCleanup("delete local test user", () => admin.auth.admin.deleteUser(userId));
  }
  await recordCleanup("sign out local student", () => userClient.auth.signOut());
  await recordCleanup("sign out local manager", () => managerClient.auth.signOut());
}

if (cleanupFailures.length > 0) {
  throw new AggregateError(testFailure ? [testFailure, ...cleanupFailures] : cleanupFailures, "chapter-two security verification and/or cleanup failed");
}
if (testFailure) throw testFailure;
console.log("PASS: cleanup restored every chapter-two local fixture and reported no suppressed errors");
