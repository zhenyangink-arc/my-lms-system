#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

import {
  gradeSmartTextbookActivity,
  submitSmartTextbookActivityForContext,
} from "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-submission.ts";
import {
  isServerConfirmedNodeCompletion,
  isSmartTextbookModuleCompleted,
} from "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-completion.ts";
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

const completionResult = {
  nodeId: "node-confirmation-fixture",
  nodeCompleted: true,
  completionPercent: 100,
  preview: false,
};
assert.equal(
  isServerConfirmedNodeCompletion({ ...completionResult, preview: true }),
  false,
);
console.log("PASS: frontend completion logic rejects preview=true");
assert.equal(
  isServerConfirmedNodeCompletion({
    ...completionResult,
    nodeCompleted: false,
  }),
  false,
);
console.log("PASS: frontend completion logic rejects nodeCompleted=false");
for (const completionPercent of [0, 99, 101]) {
  assert.equal(
    isServerConfirmedNodeCompletion({
      ...completionResult,
      completionPercent,
    }),
    false,
  );
}
console.log("PASS: frontend completion logic rejects completionPercent other than 100");
assert.equal(isServerConfirmedNodeCompletion(completionResult), true);
console.log(
  "PASS: frontend completion logic accepts only non-preview, server-confirmed 100% node completion",
);

const moduleWithLocalSubmissions = {
  nodes: [
    { id: "node-one", activities: [{ id: "activity-local-one" }] },
    { id: "node-two", activities: [{ id: "activity-local-two" }] },
  ],
};
const localCompletedActivityIds = new Set([
  "activity-local-one",
  "activity-local-two",
]);
assert.equal(
  moduleWithLocalSubmissions.nodes.every((node) =>
    node.activities.every((activity) =>
      localCompletedActivityIds.has(activity.id),
    ),
  ),
  true,
);
assert.equal(
  isSmartTextbookModuleCompleted(moduleWithLocalSubmissions, new Set()),
  false,
);
assert.equal(
  isSmartTextbookModuleCompleted(
    moduleWithLocalSubmissions,
    new Set(["node-one", "node-two"]),
  ),
  true,
);
console.log(
  "PASS: frontend module completion ignores local activity submission state and requires every server-confirmed node",
);

const GOLDEN_QUESTIONS = [
  { key: "golden-01-01", prompt: "第一次见面时，哪一句是合适的问候？", options: ["안녕하세요?", "안녕히 가세요.", "감사합니다.", "괜찮아요."], answer: 0 },
  { key: "golden-01-02", prompt: "韩语“저”在本课中的意思是什么？", options: ["我（谦称）", "老师", "朋友", "名字"], answer: 0 },
  { key: "golden-01-03", prompt: "“저는 학생___.”应填入哪一项？", options: ["예요", "이에요", "은", "는"], answer: 1 },
  { key: "golden-01-04", prompt: "“저는 리나___.”的正确形态是哪一项？", options: ["이에요", "은", "예요", "는"], answer: 2 },
  { key: "golden-01-05", prompt: "要把“지민 씨”设为话题，应写成哪一项？", options: ["지민 씨은", "지민 씨는", "지민 씨예요는", "지민 씨이에요"], answer: 1 },
  { key: "golden-01-06", prompt: "哪一句能礼貌确认对方是不是学生？", options: ["학생은 지민 씨.", "지민 씨는 학생이에요?", "지민 씨 학생 까?", "학생이 지민 씨는."], answer: 1 },
  { key: "golden-01-07", prompt: "听到“지민 씨는 학생이에요?”时，哪一回答最完整？", options: ["네, 학생이에요.", "학생?", "저는?", "안녕하세요."], answer: 0 },
  { key: "golden-01-08", prompt: "“만나서 반가워요.”最适合出现在初次见面对话的什么位置？", options: ["确认地点时", "自然收尾时", "询问价格时", "说明时间时"], answer: 1 },
  { key: "golden-01-09", prompt: "哪一组最符合本课初次见面对话的顺序？", options: ["告别→问候→身份→姓名", "身份→告别→问候→姓名", "问候→姓名→身份确认→礼貌收尾", "姓名→购物→问候→告别"], answer: 2 },
  { key: "golden-01-10", prompt: "资料卡写着“이름: 왕밍 / 신분: 학생”，哪一句正确？", options: ["왕밍 씨는 선생님이에요.", "왕밍 씨는 학생이에요.", "왕밍 씨는 친구예요? 아니요.", "왕밍 씨는 이름이에요."], answer: 1 },
  { key: "golden-01-11", prompt: "哪一句同时包含话题和身份说明？", options: ["학생이에요?", "저는 왕밍이에요.", "이름이 뭐예요?", "만나서 반가워요."], answer: 1 },
  { key: "golden-01-12", prompt: "课末双角色任务必须满足哪一项？", options: ["只说一句问候", "单人背诵词汇", "只写姓名资料卡", "约30秒并至少8轮，包含问候、姓名、身份确认和收尾"], answer: 3 },
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

function responseFor(activity, answerKey) {
  const kind = String(answerKey.kind ?? "");
  if (kind === "index") return Number(answerKey.value);
  if (kind === "indices") return [...answerKey.value];
  if (kind === "order") return [...answerKey.value];
  if (kind === "text") return String(answerKey.value);
  if (kind === "text_array" || kind === "index_array") return [...answerKey.value];
  if (kind === "index_confirmation") {
    return { selection: Number(answerKey.value), confirmed: true };
  }
  if (activity.activity_type === "speaking") {
    return {
      recorded: true,
      durationSeconds: 30,
      turns: 8,
      criteria: [true, true, true, true, true],
    };
  }
  if (activity.activity_type === "writing") {
    return {
      text: "안녕하세요? 저는 민수예요. 저는 학생이에요. 만나서 반가워요.",
      informationKinds: [false, false, false, false, false],
      rubricConfirmed: false,
    };
  }
  if (activity.activity_type === "self_check") {
    return {
      checks: ["can", "can", "can", "can", "can"],
      returnNodes: ["none"],
      note: "",
    };
  }
  throw new Error(`No response builder for ${activity.activity_key}/${kind}`);
}

async function mustData(promise, label) {
  const { data, error } = await promise;
  assert.ifError(error && new Error(`${label}: ${error.message}`));
  return data;
}

function runLocalDatabaseSql(sql, label) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      LOCAL_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: sql, encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    `${label}: ${result.stderr || result.stdout || "local psql failed"}`,
  );
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
          return {
            shortCircuit: true,
            url: "data:text/javascript,export%20{}",
          };
        }
        if (specifier === "next/headers") {
          return {
            shortCircuit: true,
            url: "data:text/javascript,export%20async%20function%20cookies()%7Breturn%20globalThis.__CHAPTER_ONE_SECURITY_COOKIE_STORE__%7D",
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
          if (filePath) {
            return { shortCircuit: true, url: pathToFileURL(filePath).href };
          }
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
  const {
    data: { user: authenticatedUser },
    error: authenticatedUserError,
  } = await authClient.auth.getUser();
  assert.ifError(authenticatedUserError);
  assert.ok(authenticatedUser, "local Server Action cookie session must authenticate");
  const { error: authenticatedProfileError } = await authClient
    .from("profiles")
    .select("id")
    .eq("id", authenticatedUser.id)
    .single();
  assert.ifError(authenticatedProfileError);

  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  globalThis.__CHAPTER_ONE_SECURITY_COOKIE_STORE__ = {
    getAll() {
      return [...cookieJar].map(([name, value]) => ({ name, value }));
    },
    set(name, value) {
      cookieJar.set(name, value);
    },
  };

  const { submitSmartTextbookActivityAction } =
    await loadProductionActionModule();

  return (input) => submitSmartTextbookActivityAction(input);
}

async function recordCleanup(label, operation) {
  try {
    const result = await operation();
    if (result?.error) throw result.error;
  } catch (error) {
    cleanupFailures.push(
      new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`),
    );
  }
}

function assertInvalid(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(
    answerKey,
    response,
    activityType,
    config,
    options,
  );
  assert.equal(result.ok, false, `${label}: malformed response must be rejected`);
  assert.match(result.error, /作答结构无效/, `${label}: rejection must explain the structural error`);
}

function assertWrong(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(
    answerKey,
    response,
    activityType,
    config,
    options,
  );
  assert.equal(result.ok, true, `${label}: well-formed wrong answer must remain an attempt`);
  assert.equal(result.correct, false, `${label}: well-formed wrong answer must be incorrect`);
}

function assertOpenBelowThreshold(label, answerKey, response, activityType, config, options) {
  const result = gradeSmartTextbookActivity(
    answerKey,
    response,
    activityType,
    config,
    options,
  );
  assert.equal(result.ok, true, `${label}: well-formed open submission must remain an attempt`);
  assert.equal(result.correct, null, `${label}: open submission must not have correctness`);
  assert.equal(result.score, null, `${label}: open submission must not have a score`);
  assert.equal(result.meetsCompletionRequirements, false, `${label}: submission must remain below threshold`);
}

for (const response of [null, false, "0", [], {}]) {
  assertInvalid("index strict type", { kind: "index", value: 0 }, response, "single_choice", {}, ["A", "B"]);
}
for (const response of [-1, 2, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  assertInvalid("index strict range", { kind: "index", value: 0 }, response, "single_choice", {}, ["A", "B"]);
}
assertInvalid("indices strict container", { kind: "indices", value: [0, 1] }, "0,1", "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices rejects empty answer", { kind: "indices", value: [0, 1] }, [], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices strict members", { kind: "indices", value: [0, 1] }, ["0", 1], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices unique members", { kind: "indices", value: [0, 1] }, [0, 0, 1], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("indices bounded members", { kind: "indices", value: [0, 1] }, [0, 3], "multiple_choice", {}, ["A", "B", "C"]);
assertInvalid("order strict container", { kind: "order", value: [1, 0] }, null, "ordering", {}, ["A", "B"]);
assertInvalid("order strict permutation", { kind: "order", value: [1, 0] }, ["1", 0], "ordering", {}, ["A", "B"]);
assertInvalid("order rejects missing item", { kind: "order", value: [1, 0] }, [1], "ordering", {}, ["A", "B"]);
assertInvalid("order rejects duplicate item", { kind: "order", value: [1, 0] }, [1, 1], "ordering", {}, ["A", "B"]);
assertInvalid("text strict type", { kind: "text", value: "예요" }, ["예요"], "fill_blank", {}, []);
assertInvalid("text rejects whitespace", { kind: "text", value: "예요" }, "   ", "fill_blank", {}, []);
assertInvalid("text array strict container", { kind: "text_array", value: ["예요", "는"] }, "예요,는", "fill_blank", {}, []);
assertInvalid("text array strict members", { kind: "text_array", value: ["예요", "는"] }, ["예요", false], "fill_blank", {}, []);
assertInvalid("text array rejects blanks", { kind: "text_array", value: ["예요", "는"] }, ["", ""], "fill_blank", {}, []);
assertInvalid("text array rejects a partial blank", { kind: "text_array", value: ["예요", "는"] }, ["예요", "   "], "fill_blank", {}, []);
assertInvalid("text array rejects missing item", { kind: "text_array", value: ["예요", "는"] }, ["예요"], "fill_blank", {}, []);
assertInvalid("index array strict container", { kind: "index_array", value: [0, 0] }, null, "single_choice", { items: [{ options: ["A", "B"] }, { options: ["C", "D"] }] }, []);
assertInvalid("index array rejects sentinel", { kind: "index_array", value: [0, 0] }, [-1, 0], "single_choice", { items: [{ options: ["A", "B"] }, { options: ["C", "D"] }] }, []);
assertInvalid("index array strict members", { kind: "index_array", value: [0, 0] }, ["0", 0], "single_choice", { items: [{ options: ["A", "B"] }, { options: ["C", "D"] }] }, []);
assertInvalid("index array rejects missing item", { kind: "index_array", value: [0, 0] }, [0], "single_choice", { items: [{ options: ["A", "B"] }, { options: ["C", "D"] }] }, []);
assert.equal(
  gradeSmartTextbookActivity(
    { kind: "index_array", value: [1, 2, 1, 3, 1, 1, 2, 3] },
    [1, 2, 1, 3, 1, 1, 2, 3],
    "listening",
    { items: Array.from({ length: 8 }, () => ({ options: ["A", "B", "C", "D"] })) },
    [],
  ).correct,
  true,
  "paged listening accepts a strict index_array response",
);
assertInvalid("index confirmation strict object", { kind: "index_confirmation", value: 0 }, null, "single_choice", {}, ["A", "B"]);
for (const selection of [null, false, "0", []]) {
  assertInvalid("index confirmation strict selection", { kind: "index_confirmation", value: 0 }, { selection, confirmed: true }, "single_choice", {}, ["A", "B"]);
}
assertInvalid("index confirmation requires confirmation", { kind: "index_confirmation", value: 0 }, { selection: 0, confirmed: false }, "single_choice", {}, ["A", "B"]);
assertInvalid("speaking strict object", { kind: "open" }, null, "speaking", {}, []);
assertInvalid("speaking strict duration", { kind: "open" }, { recorded: true, durationSeconds: "30" }, "speaking", {}, []);
assertInvalid("speaking rejects absent recording", { kind: "open" }, { recorded: false, durationSeconds: 30 }, "speaking", {}, []);
assertInvalid("speaking strict auxiliary fields", { kind: "open" }, { recorded: true, durationSeconds: 30, turns: "8", criteria: [true] }, "speaking", {}, []);
assertInvalid("writing strict object", { kind: "open" }, null, "writing", {}, []);
assertInvalid("writing strict text", { kind: "open" }, { text: [] }, "writing", {}, []);
assertInvalid("writing rejects whitespace", { kind: "open" }, { text: "   " }, "writing", {}, []);
assertInvalid("writing strict auxiliary fields", { kind: "open" }, { text: "안녕하세요.", informationKinds: [true, "false"] }, "writing", {}, []);
assertInvalid("self-check strict object", { kind: "open" }, null, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
assertInvalid("self-check strict arrays", { kind: "open" }, { checks: ["can", false], returnNodes: ["none"] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
assertInvalid("self-check rejects empty arrays", { kind: "open" }, { checks: [], returnNodes: [] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);

assertWrong("index valid wrong answer", { kind: "index", value: 0 }, 1, "single_choice", {}, ["A", "B"]);
assertWrong("indices valid wrong answer", { kind: "indices", value: [0, 1] }, [0, 2], "multiple_choice", {}, ["A", "B", "C"]);
assertWrong("order valid wrong answer", { kind: "order", value: [1, 0] }, [0, 1], "ordering", {}, ["A", "B"]);
assertWrong("text valid wrong answer", { kind: "text", value: "예요" }, "이에요", "fill_blank", {}, []);
assertWrong("text array valid wrong answer", { kind: "text_array", value: ["예요", "는"] }, ["이에요", "는"], "fill_blank", {}, []);
assertWrong("index array valid wrong answer", { kind: "index_array", value: [0, 0] }, [1, 0], "single_choice", { items: [{ options: ["A", "B"] }, { options: ["C", "D"] }] }, []);
assertWrong("index confirmation valid wrong answer", { kind: "index_confirmation", value: 0 }, { selection: 1, confirmed: true }, "single_choice", {}, ["A", "B"]);
assertOpenBelowThreshold("writing valid weak content", { kind: "open" }, { text: "가. 나. 다. 라." }, "writing", {}, []);
assertOpenBelowThreshold("self-check valid inconsistent content", { kind: "open" }, { checks: ["review", "can"], returnNodes: ["none"] }, "self_check", { requiredChecks: 2, returnNodes: [{ value: "none" }] }, []);
console.log("PASS: structural preflight rejects malformed responses for every answer kind while well-formed wrong answers remain normal attempts");

const originalState = {};
let userId = null;
let unknownActivityFixtureInstalled = false;
let unknownAnswerFixtureInstalled = false;
let profileSelectGrantInstalled = false;
let testFailure = null;
const cleanupFailures = [];

try {
  const textbook = await mustData(
    admin
      .from("digital_textbooks")
      .select("id,status")
      .eq("slug", "korean-level-one-smart")
      .single(),
    "load textbook",
  );
  const version = await mustData(
    admin
      .from("digital_textbook_versions")
      .select("id,status")
      .eq("textbook_id", textbook.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single(),
    "load version",
  );
  const chapter = await mustData(
    admin
      .from("digital_textbook_chapters")
      .select("id,status,chapter_test_id")
      .eq("version_id", version.id)
      .eq("chapter_number", 1)
      .single(),
    "load chapter",
  );
  const testRow = await mustData(
    admin
      .from("chapter_tests")
      .select("id,status,duration_minutes,passing_score")
      .eq("slug", "korean-level-one-01")
      .single(),
    "load chapter test",
  );
  const questions = await mustData(
    admin
      .from("chapter_test_questions")
      .select("question_key,prompt,options,correct_option,status")
      .eq("test_id", testRow.id)
      .order("sort_order"),
    "load chapter questions",
  );

  assert.equal(testRow.status, "draft", "migration must force the test to draft");
  assert.equal(testRow.duration_minutes, 12, "chapter-one duration must match the master-recorded current value");
  assert.equal(testRow.passing_score, 60, "chapter-one passing score must match the master-recorded current value");
  assert.equal(questions.length, 12, "migration must leave exactly 12 golden questions");
  assert.deepEqual(questions.map((question) => question.question_key), GOLDEN_QUESTIONS.map((question) => question.key));
  assert.ok(questions.every((question) => question.status === "draft"));
  for (const [index, expectedQuestion] of GOLDEN_QUESTIONS.entries()) {
    const actualQuestion = questions[index];
    assert.equal(actualQuestion.prompt, expectedQuestion.prompt, `${expectedQuestion.key}: prompt mismatch`);
    assert.deepEqual(actualQuestion.options, expectedQuestion.options, `${expectedQuestion.key}: options mismatch`);
    assert.equal(actualQuestion.correct_option, expectedQuestion.answer, `${expectedQuestion.key}: correct answer mismatch`);
    console.log(`PASS: ${expectedQuestion.key} prompt/options/correct answer independently match the hard-coded golden vector`);
  }
  assert.deepEqual(
    questions.map((question) => question.correct_option),
    GOLDEN_QUESTIONS.map((question) => question.answer),
    "database correct answers must match the independently hard-coded 12-answer vector",
  );
  console.log("PASS: chapter test is draft, uses duration_minutes=12 and passing_score=60, and has exactly 12 deterministic golden questions with a hard-coded answer vector");

  const moduleRows = await mustData(
    admin
      .from("digital_textbook_modules")
      .select("id,sort_order")
      .eq("chapter_id", chapter.id)
      .order("sort_order"),
    "load modules",
  );
  const nodeRows = await mustData(
    admin
      .from("digital_textbook_nodes")
      .select("id,module_id")
      .in(
        "module_id",
        moduleRows.map((module) => module.id),
      ),
    "load nodes",
  );
  const activities = await mustData(
    admin
      .from("digital_textbook_activities")
      .select("id,node_id,activity_key,activity_type,sort_order,max_attempts")
      .in(
        "node_id",
        nodeRows.map((node) => node.id),
      )
      .order("sort_order"),
    "load activities",
  );
  const secrets = await mustData(
    admin
      .from("digital_textbook_activity_secrets")
      .select("activity_id,answer_key,audio_status")
      .in(
        "activity_id",
        activities.map((activity) => activity.id),
      ),
    "load activity secrets",
  );
  const secretsByActivity = new Map(
    secrets.map((secret) => [secret.activity_id, secret]),
  );
  const listeningActivity = activities.find(
    (activity) => activity.activity_type === "listening",
  );
  assert.ok(listeningActivity, "chapter must include the listening activity");

  Object.assign(originalState, {
    textbookStatus: textbook.status,
    versionStatus: version.status,
    chapterStatus: chapter.status,
    testStatus: testRow.status,
    listeningStatus: secretsByActivity.get(listeningActivity.id)?.audio_status,
    textbookId: textbook.id,
    versionId: version.id,
    chapterId: chapter.id,
    testId: testRow.id,
    listeningId: listeningActivity.id,
  });

  await mustData(
    admin.from("digital_textbooks").update({ status: "published" }).eq("id", textbook.id).select(),
    "publish textbook for local integration test",
  );
  await mustData(
    admin.from("digital_textbook_versions").update({ status: "published" }).eq("id", version.id).select(),
    "publish version for local integration test",
  );
  await mustData(
    admin.from("digital_textbook_chapters").update({ status: "published" }).eq("id", chapter.id).select(),
    "publish chapter for local integration test",
  );
  await mustData(
    admin.from("chapter_tests").update({ status: "published" }).eq("id", testRow.id).select(),
    "publish test for local integration test",
  );
  await mustData(
    admin
      .from("chapter_test_questions")
      .update({ status: "published" })
      .eq("test_id", testRow.id)
      .select(),
    "publish questions for local integration test",
  );
  await mustData(
    admin
      .from("digital_textbook_activity_secrets")
      .update({ audio_status: "ready" })
      .eq("activity_id", listeningActivity.id)
      .select(),
    "mark local listening fixture ready",
  );

  const email = `chapter-one-security-${Date.now()}@accounts.puffy.invalid`;
  const password = "LocalSecurity123!";
  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "第01章本地安全测试" },
    });
  assert.ifError(createUserError);
  assert.ok(createdUser.user);
  userId = createdUser.user.id;

  await mustData(
    admin
      .from("tenant_memberships")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role: "student",
        status: "active",
        membership_tier: "vip2",
        is_default: true,
        joined_at: new Date().toISOString(),
      })
      .select(),
    "create local student membership",
  );
  const { error: managerSignInError } = await managerClient.auth.signInWithPassword({
    email: "local-admin@accounts.puffy.invalid",
    password: "PuffyLocal123!",
  });
  assert.ifError(managerSignInError);
  const { error: enrollmentError } = await managerClient.rpc(
    "set_student_application_enrollment",
    { p_student_id: userId, p_app_id: koreanAppId, p_status: "active" },
  );
  assert.ifError(enrollmentError);
  await managerClient.auth.signOut();

  const { error: signInError } = await userClient.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(signInError);

  const firstActivity = activities.find(
    (activity) => activity.activity_key === "orientation-check",
  );
  assert.ok(firstActivity);
  const firstNode = nodeRows.find((node) => node.id === firstActivity.node_id);
  assert.ok(firstNode);
  originalState.unknownActivityId = firstActivity.id;

  const profileSelectWasGranted = runLocalDatabaseSql(
    "select has_table_privilege('authenticated', 'public.profiles', 'select');",
    "inspect authenticated profile read privilege",
  );
  if (profileSelectWasGranted !== "t") {
    runLocalDatabaseSql(
      "grant select on table public.profiles to authenticated;",
      "install local profile read prerequisite",
    );
    profileSelectGrantInstalled = true;
  }

  const invokeProductionAction = await createAuthenticatedActionInvoker(
    email,
    password,
  );

  const attemptsBeforeUnknownActivity = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", firstActivity.id),
    "count attempts before unknown activity type",
  );
  unknownActivityFixtureInstalled = true;
  runLocalDatabaseSql(
    `alter table public.digital_textbook_activities drop constraint digital_textbook_activities_activity_type_check;
     update public.digital_textbook_activities set activity_type = 'unknown_activity_type' where id = '${firstActivity.id}'::uuid;`,
    "install local unknown activity_type fixture",
  );
  const unknownActivityResult = await invokeProductionAction({
    activityId: firstActivity.id,
    locale: "zh-CN",
    response: 0,
  });
  assert.equal(unknownActivityResult.ok, false);
  assert.match(unknownActivityResult.explanation, /无法识别活动类型/);
  const attemptsAfterUnknownActivity = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", firstActivity.id),
    "count attempts after unknown activity type",
  );
  assert.equal(
    attemptsAfterUnknownActivity.length,
    attemptsBeforeUnknownActivity.length,
    "unknown activity_type must not write an attempt",
  );
  runLocalDatabaseSql(
    `update public.digital_textbook_activities set activity_type = 'single_choice' where id = '${firstActivity.id}'::uuid;
     do $$ begin
       if not exists (
         select 1 from pg_constraint where conrelid = 'public.digital_textbook_activities'::regclass and conname = 'digital_textbook_activities_activity_type_check'
       ) then
         alter table public.digital_textbook_activities add constraint digital_textbook_activities_activity_type_check check (activity_type in ('single_choice','multiple_choice','fill_blank','ordering','listening','speaking','writing','self_check'));
       end if;
     end $$;`,
    "restore local unknown activity_type fixture",
  );
  unknownActivityFixtureInstalled = false;
  console.log("PASS: unknown activity_type traverses the real Server Action, requireActiveUser, permission calculation, and writes zero attempts");

  const forgedStringIndexResult = await invokeProductionAction({
    activityId: firstActivity.id,
    locale: "zh-CN",
    response: "0",
  });
  assert.equal(forgedStringIndexResult.ok, false);
  assert.equal(forgedStringIndexResult.correct, null);
  assert.match(forgedStringIndexResult.explanation, /作答结构无效/);
  assert.equal(forgedStringIndexResult.attemptNumber, 0);
  assert.equal(forgedStringIndexResult.nodeCompleted, false);
  assert.equal(forgedStringIndexResult.completionPercent, 0);
  const attemptsAfterForgedStringIndex = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id,is_correct")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", firstActivity.id),
    "verify forged string-index attempt",
  );
  assert.equal(
    attemptsAfterForgedStringIndex.length,
    attemptsBeforeUnknownActivity.length,
  );
  assert.equal(
    attemptsAfterForgedStringIndex.filter((attempt) => attempt.is_correct === true).length,
    0,
  );
  console.log("PASS: authenticated production Server Action rejects forged string index with ok:false and writes zero attempts");

  const previewProgressBefore = await mustData(
    admin
      .from("digital_textbook_node_progress")
      .select("node_id")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("node_id", firstNode.id)
      .eq("version_id", version.id),
    "count progress before preview submission",
  );
  const previewResult = await submitSmartTextbookActivityForContext(
    {
      activityId: firstActivity.id,
      locale: "zh-CN",
      response: 0,
    },
    {
      supabase: userClient,
      admin,
      userId,
      tenantId,
      canSubmit: true,
      preview: true,
    },
  );
  assert.equal(previewResult.ok, true, previewResult.explanation);
  assert.equal(previewResult.correct, true);
  assert.equal(previewResult.preview, true);
  assert.equal(previewResult.nodeCompleted, false);
  assert.equal(previewResult.completionPercent, 0);
  const [attemptsAfterPreview, progressAfterPreview] = await Promise.all([
    mustData(
      admin
        .from("digital_textbook_attempts")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("student_id", userId)
        .eq("activity_id", firstActivity.id),
      "count attempts after preview submission",
    ),
    mustData(
      admin
        .from("digital_textbook_node_progress")
        .select("node_id")
        .eq("tenant_id", tenantId)
        .eq("student_id", userId)
        .eq("node_id", firstNode.id)
        .eq("version_id", version.id),
      "count progress after preview submission",
    ),
  ]);
  assert.equal(attemptsAfterPreview.length, attemptsBeforeUnknownActivity.length);
  assert.equal(progressAfterPreview.length, previewProgressBefore.length);
  console.log("PASS: preview correct answer returns immediate correctness but nodeCompleted:false/completionPercent:0 and writes zero attempt/progress rows");

  const productionActionResult = await invokeProductionAction({
    activityId: firstActivity.id,
    locale: "zh-CN",
    response: 0,
  });
  assert.equal(productionActionResult.ok, true, productionActionResult.explanation);
  assert.equal(productionActionResult.correct, true);
  assert.equal(productionActionResult.nodeId, firstNode.id);
  assert.equal(productionActionResult.nodeCompleted, true);
  assert.equal(productionActionResult.completionPercent, 100);
  const productionActionAttempts = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id,is_correct")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", firstActivity.id),
    "verify real Server Action attempt",
  );
  assert.equal(productionActionAttempts.length, attemptsBeforeUnknownActivity.length + 1);
  assert.equal(
    productionActionAttempts.filter((attempt) => attempt.is_correct === true).length,
    1,
  );
  console.log("PASS: authenticated production Server Action succeeds only after requireActiveUser and real VIP2 korean_course permission calculation");

  const { error: directAttemptError } = await userClient
    .from("digital_textbook_attempts")
    .insert({
      tenant_id: tenantId,
      student_id: userId,
      activity_id: firstActivity.id,
      version_id: version.id,
      attempt_number: 1,
      response: {},
      is_correct: true,
      score: 100,
    });
  assert.ok(directAttemptError, "authenticated direct attempt insert must fail");
  console.log(
    `PASS: authenticated direct INSERT digital_textbook_attempts rejected (${directAttemptError.code})`,
  );

  const { error: directProgressError } = await userClient
    .from("digital_textbook_node_progress")
    .insert({
      tenant_id: tenantId,
      student_id: userId,
      node_id: firstNode.id,
      version_id: version.id,
      status: "completed",
      completion_percent: 100,
      mastery_score: 100,
      attempt_count: 1,
    });
  assert.ok(directProgressError, "authenticated direct progress insert must fail");
  console.log(
    `PASS: authenticated direct INSERT digital_textbook_node_progress rejected (${directProgressError.code})`,
  );

  const context = {
    supabase: userClient,
    admin,
    userId,
    tenantId,
    canSubmit: true,
    preview: false,
  };

  const writingActivity = activities.find(
    (activity) => activity.activity_type === "writing",
  );
  assert.ok(writingActivity);
  const weakWritingAttemptsBefore = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", writingActivity.id),
    "count attempts before well-formed wrong writing submission",
  );
  const weakWriting = await submitSmartTextbookActivityForContext(
    {
      activityId: writingActivity.id,
      locale: "zh-CN",
      response: {
        text: "가. 나. 다. 라.",
        informationKinds: [true, true, true, true, true],
        rubricConfirmed: true,
      },
    },
    context,
  );
  assert.equal(weakWriting.ok, true, weakWriting.explanation);
  assert.equal(weakWriting.correct, null);
  assert.equal(weakWriting.score, null);
  const weakWritingAttemptsAfter = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id,is_correct,score,meets_completion_requirements")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", writingActivity.id)
      .order("attempt_number", { ascending: false }),
    "count attempts after well-formed wrong writing submission",
  );
  assert.equal(
    weakWritingAttemptsAfter.length,
    weakWritingAttemptsBefore.length + 1,
    "a well-formed wrong answer must consume exactly one persisted attempt",
  );
  assert.equal(weakWritingAttemptsAfter[0].is_correct, null);
  assert.equal(weakWritingAttemptsAfter[0].score, null);
  assert.equal(weakWritingAttemptsAfter[0].meets_completion_requirements, false);
  console.log(
    "PASS: below-threshold chapter-one writing persists exactly one NULL/NULL, non-qualifying attempt",
  );

  const unknownKindActivity = activities.find(
    (activity) => activity.activity_key === "dialogue-fact-check",
  );
  assert.ok(unknownKindActivity);
  const originalAnswer = secretsByActivity.get(unknownKindActivity.id)?.answer_key;
  assert.ok(originalAnswer);
  await mustData(
    admin
      .from("digital_textbook_activity_secrets")
      .update({ answer_key: { kind: "unknown_answer_type", value: 0 } })
      .eq("activity_id", unknownKindActivity.id)
      .select(),
    "install local unknown-answer fixture",
  );
  Object.assign(originalState, {
    unknownAnswerActivityId: unknownKindActivity.id,
    unknownAnswer: originalAnswer,
  });
  unknownAnswerFixtureInstalled = true;
  const unknownKindResult = await submitSmartTextbookActivityForContext(
    {
      activityId: unknownKindActivity.id,
      locale: "zh-CN",
      response: 0,
    },
    context,
  );
  assert.equal(unknownKindResult.ok, false);
  assert.match(unknownKindResult.explanation, /无法识别答案类型/);
  const unknownAttemptRows = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", unknownKindActivity.id),
    "check unknown answer attempts",
  );
  assert.equal(unknownAttemptRows.length, 0);
  await mustData(
    admin
      .from("digital_textbook_activity_secrets")
      .update({ answer_key: originalAnswer })
      .eq("activity_id", unknownKindActivity.id)
      .select(),
    "restore answer fixture",
  );
  unknownAnswerFixtureInstalled = false;
  console.log("PASS: unknown answer_type fails closed and writes no attempt");

  const moduleOrder = new Map(
    moduleRows.map((module) => [module.id, module.sort_order]),
  );
  const nodeModule = new Map(nodeRows.map((node) => [node.id, node.module_id]));
  activities.sort((left, right) => {
    const moduleDifference =
      moduleOrder.get(nodeModule.get(left.node_id)) -
      moduleOrder.get(nodeModule.get(right.node_id));
    return moduleDifference || left.sort_order - right.sort_order;
  });

  for (const activity of activities) {
    const secret = secretsByActivity.get(activity.id);
    assert.ok(secret, `secret missing for ${activity.activity_key}`);
    const answerKey =
      activity.id === unknownKindActivity.id ? originalAnswer : secret.answer_key;
    let response = responseFor(activity, objectValue(answerKey));
    if (activity.activity_type === "speaking") {
      const evidence = await createSpeakingEvidence({
        admin,
        tenantId,
        userId,
        activityId: activity.id,
        response,
      });
      response = evidence.response;
    }
    const result = await submitSmartTextbookActivityForContext(
      {
        activityId: activity.id,
        locale: "zh-CN",
        response,
      },
      context,
    );
    assert.equal(result.ok, true, `${activity.activity_key}: ${result.explanation}`);
    if (["speaking", "writing", "self_check"].includes(activity.activity_type)) {
      assert.equal(result.correct, null, `${activity.activity_key} must remain pending review`);
    } else {
      assert.equal(result.correct, true, `${activity.activity_key} must be objectively correct`);
    }
  }

  const writingAttempts = await mustData(
    admin
      .from("digital_textbook_attempts")
      .select("attempt_number,is_correct,score,meets_completion_requirements")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("activity_id", writingActivity.id)
      .order("attempt_number"),
    "load chapter-one writing regression attempts",
  );
  assert.equal(writingAttempts.length, 2);
  assert.ok(writingAttempts.every((attempt) => attempt.is_correct === null && attempt.score === null));
  assert.deepEqual(
    writingAttempts.map((attempt) => attempt.meets_completion_requirements),
    [false, true],
  );
  const writingNodeProgress = await mustData(
    admin
      .from("digital_textbook_node_progress")
      .select("status,completion_percent,mastery_score")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("node_id", writingActivity.node_id)
      .eq("version_id", version.id)
      .single(),
    "load chapter-one writing-node mastery regression",
  );
  assert.equal(writingNodeProgress.status, "completed");
  assert.equal(writingNodeProgress.completion_percent, 100);
  assert.equal(writingNodeProgress.mastery_score, 100);
  console.log(
    "PASS: chapter-one failed then qualifying writing attempts stay NULL/NULL and writing-node mastery remains the objective reading score of 100",
  );

  const selfCheckActivity = activities.find(
    (activity) => activity.activity_type === "self_check",
  );
  assert.ok(selfCheckActivity);
  const selfCheckResponse = responseFor(selfCheckActivity, { kind: "open" });
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    const result = await submitSmartTextbookActivityForContext(
      { activityId: selfCheckActivity.id, locale: "zh-CN", response: selfCheckResponse },
      context,
    );
    assert.equal(result.ok, true);
    assert.equal(result.attemptNumber, attempt);
  }
  const fourthAttempt = await submitSmartTextbookActivityForContext(
    { activityId: selfCheckActivity.id, locale: "zh-CN", response: selfCheckResponse },
    context,
  );
  assert.equal(fourthAttempt.ok, false);
  assert.match(fourthAttempt.explanation, /最多提交 3 次/);
  console.log("PASS: Server Action max_attempts=3 rejects the fourth submission");

  const completedProgress = await mustData(
    admin
      .from("digital_textbook_node_progress")
      .select("node_id,status,completion_percent")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("version_id", version.id)
      .eq("status", "completed")
      .eq("completion_percent", 100),
    "load completed node progress",
  );
  assert.equal(completedProgress.length, 8);

  const unlockEvidence = await mustData(
    admin
      .from("course_ebook_progress")
      .select("progress_percent,completion_source,reading_seconds")
      .eq("tenant_id", tenantId)
      .eq("student_id", userId)
      .eq("test_slug", "korean-level-one-01")
      .single(),
    "load smart textbook unlock evidence",
  );
  assert.equal(unlockEvidence.progress_percent, 100);
  assert.ok(["smart_textbook", "both"].includes(unlockEvidence.completion_source));

  const answers = Object.fromEntries(
    GOLDEN_QUESTIONS.map((question) => [question.key, question.answer]),
  );
  const { data: testResult, error: testError } = await userClient.rpc(
    "submit_course_test",
    { p_test_slug: "korean-level-one-01", p_answers: answers },
  );
  assert.ifError(testError && new Error(testError.message));
  assert.equal(objectValue(testResult).passed, true);
  console.log(
    "PASS: all 8 nodes completed through the server-side submission pipeline and the chapter-test database gate accepted the independently hard-coded answers",
  );
} catch (error) {
  testFailure = error;
} finally {
  if (unknownActivityFixtureInstalled && originalState.unknownActivityId) {
    await recordCleanup("restore unknown activity_type fixture", async () => {
      runLocalDatabaseSql(
        `update public.digital_textbook_activities set activity_type = 'single_choice' where id = '${originalState.unknownActivityId ?? "00000000-0000-0000-0000-000000000000"}'::uuid;
         do $$ begin
           if not exists (
             select 1 from pg_constraint where conrelid = 'public.digital_textbook_activities'::regclass and conname = 'digital_textbook_activities_activity_type_check'
           ) then
             alter table public.digital_textbook_activities add constraint digital_textbook_activities_activity_type_check check (activity_type in ('single_choice','multiple_choice','fill_blank','ordering','listening','speaking','writing','self_check'));
           end if;
         end $$;`,
        "restore interrupted unknown activity_type fixture",
      );
    });
  }
  if (unknownAnswerFixtureInstalled && originalState.unknownAnswerActivityId) {
    await recordCleanup("restore interrupted unknown answer fixture", () =>
      admin
        .from("digital_textbook_activity_secrets")
        .update({ answer_key: originalState.unknownAnswer })
        .eq("activity_id", originalState.unknownAnswerActivityId)
        .select(),
    );
  }
  if (profileSelectGrantInstalled) {
    await recordCleanup("restore authenticated profile read privilege", async () => {
      runLocalDatabaseSql(
        "revoke select on table public.profiles from authenticated;",
        "restore local profile read prerequisite",
      );
    });
  }
  if (originalState.listeningId) {
    await recordCleanup("restore listening fixture", () =>
      admin
        .from("digital_textbook_activity_secrets")
        .update({ audio_status: originalState.listeningStatus })
        .eq("activity_id", originalState.listeningId)
        .select(),
    );
  }
  if (originalState.testId) {
    await recordCleanup("restore chapter question statuses", () =>
      admin
        .from("chapter_test_questions")
        .update({ status: "draft" })
        .eq("test_id", originalState.testId)
        .select(),
    );
    await recordCleanup("restore chapter test status", () =>
      admin
        .from("chapter_tests")
        .update({ status: originalState.testStatus })
        .eq("id", originalState.testId)
        .select(),
    );
  }
  if (originalState.chapterId) {
    await recordCleanup("restore chapter status", () =>
      admin
        .from("digital_textbook_chapters")
        .update({ status: originalState.chapterStatus })
        .eq("id", originalState.chapterId)
        .select(),
    );
  }
  if (originalState.versionId) {
    await recordCleanup("restore version status", () =>
      admin
        .from("digital_textbook_versions")
        .update({ status: originalState.versionStatus })
        .eq("id", originalState.versionId)
        .select(),
    );
  }
  if (originalState.textbookId) {
    await recordCleanup("restore textbook status", () =>
      admin
        .from("digital_textbooks")
        .update({ status: originalState.textbookStatus })
        .eq("id", originalState.textbookId)
        .select(),
    );
  }
  if (userId) {
    await recordCleanup("delete local test user", () =>
      admin.auth.admin.deleteUser(userId),
    );
  }
  await recordCleanup("sign out local student client", () => userClient.auth.signOut());
  await recordCleanup("sign out local manager client", () => managerClient.auth.signOut());
}

if (cleanupFailures.length > 0) {
  throw new AggregateError(
    testFailure ? [testFailure, ...cleanupFailures] : cleanupFailures,
    "chapter-one security verification and/or cleanup failed",
  );
}
if (testFailure) throw testFailure;
console.log("PASS: cleanup restored every local fixture and reported no suppressed errors");
