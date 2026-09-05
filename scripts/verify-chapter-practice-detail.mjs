#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_DB_CONTAINER = "supabase_db_my-lms-system";
const LOCAL_KONG_CONTAINER = "supabase_kong_my-lms-system";
const APP_PORT = 3107;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const KOREAN_APP_ID = "10000000-0000-4000-8000-000000000001";
const TENANT_ID = "10000000-0000-4000-8000-000000000001";
const TENANT_SLUG = "practice-detail-e2e";

const kongConfig = execFileSync(
  "docker",
  ["exec", LOCAL_KONG_CONTAINER, "cat", "/home/kong/kong.yml"],
  { encoding: "utf8" },
);
const jwtKeys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const jwtByRole = new Map(
  jwtKeys.flatMap((key) => {
    try {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
      );
      return payload.role ? [[payload.role, key]] : [];
    } catch {
      return [];
    }
  }),
);
const publishableKey = jwtByRole.get("anon");
const secretKey = jwtByRole.get("service_role");
assert.ok(publishableKey && secretKey, "无法从本地 Kong 配置读取 API key");
console.log(`LOCAL TARGET VERIFIED: ${LOCAL_URL} (${LOCAL_DB_CONTAINER})`);

function runLocalSql(sql) {
  return execFileSync(
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
  ).trim();
}

function setPublishedListeningFixture({ id, status, contentPayload }) {
  const payload = JSON.stringify(contentPayload).replaceAll("'", "''");
  runLocalSql(`
    begin;
    alter table public.chapter_practice_blocks disable trigger chapter_practice_blocks_protect_published;
    update public.chapter_practice_blocks
    set status = '${status}', content_payload = '${payload}'::jsonb
    where id = '${id}'::uuid;
    alter table public.chapter_practice_blocks enable trigger chapter_practice_blocks_protect_published;
    commit;
  `);
}

const locallyGrantedTables = [
  "course_chapters",
  "growth_toolbox_exercises",
  "growth_toolbox_questions",
  "growth_toolbox_question_keys",
];
const locallyWritableTables = [
  "tenants",
  "tenant_student_apps",
  "tenant_memberships",
  "student_app_enrollments",
  "lesson_progress",
];
const authenticatedReadTables = [
  "tenants",
  "tenant_memberships",
  "tenant_student_apps",
  "student_app_enrollments",
  "courses",
  "lessons",
  "course_chapters",
  "chapter_practice_units",
  "chapter_practice_blocks",
  "lesson_progress",
  "chapter_test_attempts",
  "course_ebook_progress",
];
runLocalSql(
  `grant select on ${locallyGrantedTables.map((table) => `public.${table}`).join(", ")} to service_role;`,
);
runLocalSql(
  `grant select, insert, update, delete on ${locallyWritableTables.map((table) => `public.${table}`).join(", ")} to service_role;`,
);
runLocalSql("grant select on public.profiles to authenticated;");
runLocalSql(
  `grant select on ${authenticatedReadTables.map((table) => `public.${table}`).join(", ")} to authenticated;`,
);
runLocalSql(
  "grant insert, update on public.lesson_progress to authenticated;",
);

const admin = createClient(LOCAL_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function mustData(label, promise) {
  const { data, error } = await promise;
  assert.ifError(error && new Error(`${label}: ${error.message}`));
  return data;
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
    }
    if (specifier === "next/headers") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export%20async%20function%20cookies()%7Breturn%20globalThis.__CHAPTER_PRACTICE_COOKIE_STORE__%7D",
      };
    }
    if (specifier === "next/navigation") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export%20function%20redirect(path)%7Bthrow%20new%20Error('unexpected%20redirect%20'%2Bpath)%7D",
      };
    }
    if (specifier.startsWith("@/")) {
      const basePath = resolvePath(process.cwd(), "src", specifier.slice(2));
      const filePath = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        resolvePath(basePath, "index.ts"),
      ].find(isFile);
      assert.ok(filePath, `cannot resolve production alias ${specifier}`);
      return { shortCircuit: true, url: pathToFileURL(filePath).href };
    }
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const basePath = fileURLToPath(new URL(specifier, context.parentURL));
      const filePath = [
        basePath,
        `${basePath}.ts`,
        `${basePath}.tsx`,
        resolvePath(basePath, "index.ts"),
      ].find(isFile);
      if (filePath) {
        return { shortCircuit: true, url: pathToFileURL(filePath).href };
      }
    }
    return nextResolve(specifier, context);
  },
});

const ownerEmail = `chapter-practice-detail-owner-${Date.now()}@local.test`;
const ownerPassword = `Local-${crypto.randomUUID()}!`;
const studentEmail = `chapter-practice-detail-student-${Date.now()}@local.test`;
const studentPassword = "LocalPractice123!";
let ownerId = null;
let studentId = null;
let browser = null;
let server = null;
let serverOutput = "";
let listeningBlockOriginal = null;
let hangulInteractionBlockId = null;

async function waitForServer() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_URL}/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // Dev server is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Next.js 本地验收服务未在 60 秒内启动");
}

async function publishedUnitForChapter(chapterId) {
  return mustData(
    "load published practice unit",
    admin
      .from("chapter_practice_units")
      .select("id,course_chapter_id,version,title,status,published_at")
      .eq("course_chapter_id", chapterId)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

async function waitForSavedProgress(unitId, predicate, label) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const progress = await mustData(
      label,
      admin
        .from("student_chapter_practice_progress")
        .select(
          "status,progress_percent,mastery_percent,completed_block_ids,last_block_id,correct_count,attempt_count,started_at,last_practiced_at,completed_at",
        )
        .eq("tenant_id", TENANT_ID)
        .eq("student_id", studentId)
        .eq("practice_unit_id", unitId)
        .maybeSingle(),
    );
    if (progress && predicate(progress)) return progress;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`等待数据库进度超时：${label}`);
}

try {
  const createdOwner = await mustData(
    "create local platform owner",
    admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    }),
  );
  ownerId = createdOwner.user.id;
  await mustData(
    "promote local platform owner",
    admin
      .from("profiles")
      .update({
        role: "platform_super_admin",
        global_role: "platform_owner",
        status: "active",
      })
      .eq("id", ownerId)
      .select("id")
      .single(),
  );

  const cookieJar = new Map();
  const authClient = createServerClient(LOCAL_URL, publishableKey, {
    cookies: {
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const cookie of cookies) cookieJar.set(cookie.name, cookie.value);
      },
    },
  });
  assert.ifError(
    (
      await authClient.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      })
    ).error,
  );
  globalThis.__CHAPTER_PRACTICE_COOKIE_STORE__ = {
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    set: (name, value) => cookieJar.set(name, value),
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;

  const service = await import(
    "../src/features/chapter-practice/api/management-service.ts"
  );
  const model = await import("../src/features/chapter-practice/student/model.ts");
  const chapters = await mustData(
    "load verification chapters",
    admin
      .from("course_chapters")
      .select("id,lesson_id,slug,title")
      .in("slug", ["meet-hangul", "basic-pronunciation"]),
  );
  const chapterBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));
  const hangulChapter = chapterBySlug.get("meet-hangul");
  const formalChapter = chapterBySlug.get("basic-pronunciation");
  assert.ok(hangulChapter && formalChapter, "本地库缺少字母章或韩国语一级正式章");

  let formalUnit = await publishedUnitForChapter(formalChapter.id);
  if (!formalUnit) {
    const latest = await mustData(
      "load latest formal practice version",
      admin
        .from("chapter_practice_units")
        .select("id,status")
        .eq("course_chapter_id", formalChapter.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    let unitId;
    if (!latest) unitId = await service.generateChapterPracticeDraft(formalChapter.id);
    else if (latest.status === "draft") unitId = latest.id;
    else if (latest.status === "pending_review") {
      await service.returnChapterPracticeToDraft(latest.id);
      unitId = latest.id;
    } else {
      unitId = await service.createNextChapterPracticeVersion(formalChapter.id);
    }

    let detail = await service.getChapterPracticeUnitDetail(formalChapter.id);
    const presentTypes = new Set(detail.blocks.map((block) => block.blockType));
    if (!presentTypes.has("review") || !presentTypes.has("self_check")) {
      const lessonSource = await mustData(
        "load formal lesson review source",
        admin
          .from("lessons")
          .select("summary_text,reflection_questions,key_points")
          .eq("id", formalChapter.lesson_id)
          .single(),
      );
      const vocabulary = detail.blocks.find(
        (block) => block.blockType === "vocabulary",
      );
      const focus = vocabulary?.contentPayload?.exercise?.focus ?? {
        chapter: formalChapter.title,
      };
      const questionCount = detail.blocks.reduce(
        (total, block) =>
          total +
          (Array.isArray(block.contentPayload.questions)
            ? block.contentPayload.questions.length
            : 0),
        0,
      );
      const missingBlocks = [
        ...(!presentTypes.has("review")
          ? [
              {
                practice_unit_id: unitId,
                block_type: "review",
                title: "本章复习",
                instructions: "回顾本章重点，并查看仍需加强的内容。",
                content_payload: {
                  summary:
                    lessonSource.summary_text || lessonSource.key_points || formalChapter.title,
                  reflectionQuestions: lessonSource.reflection_questions,
                  testQuestionCount: questionCount,
                },
                source_type: "course_chapter",
                source_id: formalChapter.id,
                sort_order: 90,
                is_required: true,
                status: "draft",
              },
            ]
          : []),
        ...(!presentTypes.has("self_check")
          ? [
              {
                practice_unit_id: unitId,
                block_type: "self_check",
                title: "自我检测",
                instructions: "完成检测，确认本章内容是否达到完成要求。",
                content_payload: {
                  skills: focus,
                  passingScore: 80,
                  questionCount,
                },
                source_type: "course_chapter",
                source_id: formalChapter.id,
                sort_order: 100,
                is_required: true,
                status: "draft",
              },
            ]
          : []),
      ];
      await mustData(
        "install local formal chapter review fixtures",
        admin.from("chapter_practice_blocks").insert(missingBlocks).select("id"),
      );
      detail = await service.getChapterPracticeUnitDetail(formalChapter.id);
    }
    for (const block of detail.blocks) {
      if (
        block.blockType === "listening" &&
        block.contentPayload.audioStatus === "missing"
      ) {
        await service.updateChapterPracticeBlock({
          unitId,
          blockId: block.id,
          title: block.title,
          instructions: block.instructions,
          enabled: false,
          isRequired: false,
        });
      }
    }
    const inspection = await service.inspectChapterPracticeUnit(unitId);
    assert.equal(
      inspection.passed,
      true,
      inspection.checks.flatMap((item) => item.reasons).join(" | "),
    );
    await service.submitChapterPracticeForReview(unitId);
    await service.publishChapterPracticeUnit(unitId);
    formalUnit = await publishedUnitForChapter(formalChapter.id);
  }

  const hangulUnit = await publishedUnitForChapter(hangulChapter.id);
  assert.ok(hangulUnit && formalUnit, "两个验收章节都必须存在已发布巩固包");
  hangulInteractionBlockId = runLocalSql(`
    begin;
    alter table public.chapter_practice_blocks disable trigger chapter_practice_blocks_protect_published;
    insert into public.chapter_practice_blocks (
      practice_unit_id, block_type, title, instructions, content_payload,
      sort_order, is_required, status
    ) values (
      '${hangulUnit.id}'::uuid,
      'interaction',
      '字母拼合互动',
      '完成拼装、拆解、纠错和分类互动，巩固音节结构。',
      '{}'::jsonb,
      (select coalesce(max(sort_order), 0) + 1 from public.chapter_practice_blocks where practice_unit_id = '${hangulUnit.id}'::uuid),
      true,
      'published'
    ) returning id;
    alter table public.chapter_practice_blocks enable trigger chapter_practice_blocks_protect_published;
    commit;
  `).split("\n").find((line) => /^[0-9a-f-]{36}$/.test(line.trim()))?.trim();
  assert.ok(hangulInteractionBlockId, "无法安装字母互动验收内容块");
  const formalListeningBlock = await mustData(
    "load real formal listening block",
    admin
      .from("chapter_practice_blocks")
      .select("id,status,content_payload")
      .eq("practice_unit_id", formalUnit.id)
      .eq("block_type", "listening")
      .maybeSingle(),
  );
  assert.ok(
    formalListeningBlock &&
      Array.isArray(formalListeningBlock.content_payload?.questions) &&
      formalListeningBlock.content_payload.questions.length > 0,
    "验收章节必须有真实听力文本和听辨题",
  );
  listeningBlockOriginal = structuredClone(formalListeningBlock);
  setPublishedListeningFixture({
    id: formalListeningBlock.id,
    status: "published",
    contentPayload: {
      ...formalListeningBlock.content_payload,
      audioStatus: "pending",
    },
  });
  const blockRows = await mustData(
    "load real published block payloads",
    admin
      .from("chapter_practice_blocks")
      .select(
        "id,practice_unit_id,block_type,title,instructions,content_payload,source_type,source_id,sort_order,is_required,status",
      )
      .in("practice_unit_id", [hangulUnit.id, formalUnit.id])
      .eq("status", "published")
      .order("sort_order"),
  );
  const toBlock = (row) => ({
    id: row.id,
    practiceUnitId: row.practice_unit_id,
    blockType: row.block_type,
    title: row.title,
    instructions: row.instructions,
    contentPayload: row.content_payload,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sortOrder: row.sort_order,
    isRequired: row.is_required,
  });
  const hangulBlocks = blockRows
    .filter((row) => row.practice_unit_id === hangulUnit.id)
    .map(toBlock);
  const formalBlocks = blockRows
    .filter((row) => row.practice_unit_id === formalUnit.id)
    .map(toBlock);
  assert.ok(hangulBlocks.length > 0 && formalBlocks.length > 0);
  assert.notDeepEqual(
    hangulBlocks.map((block) => block.contentPayload),
    formalBlocks.map((block) => block.contentPayload),
  );
  assert.equal(
    model.isHangulPracticeChapter({
      courseKey: "korean-beginner",
      blocks: hangulBlocks,
    }),
    true,
  );
  assert.equal(
    model.isHangulPracticeChapter({
      courseKey: "korean-beginner",
      blocks: formalBlocks,
    }),
    false,
  );
  console.log(
    `PASS real published data: hangul=${hangulChapter.slug}/v${hangulUnit.version}/${hangulBlocks.length} blocks; formal=${formalChapter.slug}/v${formalUnit.version}/${formalBlocks.length} blocks; payloads differ`,
  );

  const tenant = await mustData(
    "ensure browser verification tenant",
    admin
      .from("tenants")
      .upsert(
        {
          id: TENANT_ID,
          slug: TENANT_SLUG,
          name: "章节巩固验收机构",
          status: "active",
          plan_key: "starter",
        },
        { onConflict: "id" },
      )
      .select("id,slug")
      .single(),
  );
  await mustData(
    "enable Korean app for browser tenant",
    admin
      .from("tenant_student_apps")
      .update({ is_enabled: true, status: "active" })
      .eq("tenant_id", tenant.id)
      .eq("app_id", KOREAN_APP_ID)
      .select("tenant_id")
      .single(),
  );

  const createdStudent = await mustData(
    "create browser verification student",
    admin.auth.admin.createUser({
      email: studentEmail,
      password: studentPassword,
      email_confirm: true,
      user_metadata: { full_name: "章节巩固验收学生" },
    }),
  );
  studentId = createdStudent.user.id;
  await mustData(
    "create browser student membership",
    admin
      .from("tenant_memberships")
      .insert({
        tenant_id: tenant.id,
        user_id: studentId,
        role: "student",
        status: "active",
        membership_tier: "vip2",
        is_default: true,
        joined_at: new Date().toISOString(),
      })
      .select("user_id")
      .single(),
  );
  await mustData(
    "enroll browser student in Korean app",
    admin
      .from("student_app_enrollments")
      .insert({
        tenant_id: tenant.id,
        student_id: studentId,
        app_id: KOREAN_APP_ID,
        status: "active",
        access_tier: "vip2",
      })
      .select("student_id")
      .single(),
  );
  const formalLesson = await mustData(
    "load formal lesson and course",
    admin
      .from("lessons")
      .select("id,course_id,prerequisite_lesson_id")
      .eq("id", formalChapter.lesson_id)
      .single(),
  );
  const studentClient = createClient(LOCAL_URL, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  assert.ifError(
    (
      await studentClient.auth.signInWithPassword({
        email: studentEmail,
        password: studentPassword,
      })
    ).error,
  );
  await mustData(
    "unlock formal lesson for browser student",
    studentClient
      .from("lesson_progress")
      .insert({
        tenant_id: tenant.id,
        user_id: studentId,
        course_id: formalLesson.course_id,
        lesson_id: formalLesson.prerequisite_lesson_id,
        status: "completed",
        progress_percent: 100,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
  );
  await studentClient.auth.signOut();

  const localAppEnvironment = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
  };
  if (process.env.SKIP_CHAPTER_PRACTICE_DETAIL_BUILD !== "1") {
    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      env: localAppEnvironment,
      stdio: "inherit",
    });
  }
  server = spawn("npm", ["run", "start", "--", "--port", String(APP_PORT)], {
    cwd: process.cwd(),
    env: localAppEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-12_000);
  });
  server.stderr.on("data", (chunk) => {
    serverOutput = `${serverOutput}${chunk}`.slice(-12_000);
  });
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${APP_URL}/login`);
  await page.getByLabel("登录账号").fill(studentEmail);
  await page.locator('input[name="password"]').fill(studentPassword);
  await page.getByRole("button", { name: "进入学习中心" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });

  const hangulUrl = `${APP_URL}/${TENANT_SLUG}/apps/korean/practice/course/korean-beginner/meet-hangul`;
  await page.goto(hangulUrl);
  await page.getByRole("heading", { name: "认识韩文", exact: true }).waitFor();
  await page.getByRole("heading", { name: "字母拼合互动" }).waitFor();
  const hangulText = await page.locator("body").innerText();
  assert.match(hangulText, /韩文基本概念/);
  assert.match(hangulText, /가/);
  console.log("PASS rendered Hangul chapter: real published topics + letter interaction are visible");

  const hangulLab = page.locator(`#practice-block-${hangulInteractionBlockId}`);
  async function nextInteractionQuestion() {
    await hangulLab.getByText(/回答正确。/).waitFor();
    await hangulLab.getByRole("button", { name: "下一题" }).click();
  }
  const assembleRounds = [
    ["ㄱ", "ㅏ", "无收音"],
    ["ㄱ", "ㅗ", "无收音"],
    ["ㅎ", "ㅏ", "ㄴ"],
  ];
  for (const parts of assembleRounds) {
    for (const [index, slot] of ["初声", "中声", "终声"].entries()) {
      await hangulLab.getByRole("button", { name: new RegExp(`^${slot}`) }).click();
      await hangulLab.getByRole("button", { name: parts[index], exact: true }).click();
    }
    await hangulLab.getByRole("button", { name: "检查拼装" }).click();
    await nextInteractionQuestion();
  }

  await hangulLab.getByRole("button", { name: /拆解/ }).click();
  const deconstructRounds = [
    ["ㅎ", "ㅏ", "ㄴ"],
    ["ㄱ", "ㅗ", "无终声"],
    ["ㄱ", "ㅗ", "ㅇ"],
  ];
  for (const parts of deconstructRounds) {
    for (const part of parts) {
      await hangulLab.getByRole("button", { name: part, exact: true }).click();
    }
    await nextInteractionQuestion();
  }

  await hangulLab.getByRole("button", { name: /纠错/ }).click();
  for (const [left, right] of [
    ["中声", "终声"],
    ["中声", "终声"],
    ["初声", "中声"],
  ]) {
    await hangulLab.getByRole("button", { name: new RegExp(`^${left}`) }).click();
    await hangulLab.getByRole("button", { name: new RegExp(`^${right}`) }).click();
    await hangulLab.getByRole("button", { name: "检查修复" }).click();
    await nextInteractionQuestion();
  }

  await hangulLab.getByRole("button", { name: /分类/ }).click();
  const classificationRounds = [
    {
      竖向元音: ["가", "너", "미"],
      横向元音: ["고", "누", "브"],
    },
    {
      无收音: ["아", "고"],
      单收音: ["한", "공"],
      复合收音: ["읽", "값"],
    },
    {
      左右结构: ["가", "네"],
      上下结构: ["고", "무"],
      底部带收音: ["한", "공"],
    },
  ];
  for (const buckets of classificationRounds) {
    for (const [bucket, symbols] of Object.entries(buckets)) {
      for (const symbol of symbols) {
        await hangulLab.getByRole("button", { name: symbol, exact: true }).click();
        await hangulLab
          .locator('[role="button"]')
          .filter({ hasText: bucket })
          .first()
          .click();
      }
    }
    await nextInteractionQuestion();
  }
  await hangulLab.getByText("已掌握 4/4 类", { exact: true }).waitFor();
  const hangulProgress = await waitForSavedProgress(
    hangulUnit.id,
    (row) => row.completed_block_ids.includes(hangulInteractionBlockId),
    "字母互动完成写入",
  );
  assert.equal(hangulProgress.last_block_id, hangulInteractionBlockId);
  console.log(
    `PASS alphabet interaction persistence: completed interaction block ${hangulInteractionBlockId} saved to database`,
  );

  const formalUrl = `${APP_URL}/${TENANT_SLUG}/apps/korean/practice/course/korean-beginner/basic-pronunciation`;
  await page.goto(formalUrl);
  await page
    .getByRole("heading", { name: "第 1 课：韩国语1级", exact: true })
    .waitFor();
  await page.getByText(/这组训练对应哪一课？/).first().waitFor();
  const formalText = await page.locator("body").innerText();
  assert.doesNotMatch(formalText, /字母拼合互动/);
  assert.doesNotMatch(formalText, /复合收音 ㄺ/);
  assert.doesNotMatch(formalText, /音节方块外形/);
  assert.notEqual(formalText, hangulText);
  console.log("PASS rendered formal chapter: chapter-specific questions are visible and hard-coded Hangul lab is absent");

  const listeningCard = page.locator(
    `#practice-block-${formalListeningBlock.id}`,
  );
  await listeningCard.getByText("临时语音（非正式录音）", { exact: true }).waitFor();
  await listeningCard.getByText("本页播放次数", { exact: true }).waitFor();
  await listeningCard.getByText("尚未作答", { exact: true }).waitFor();
  const temporaryPlayButtons = listeningCard.getByRole("button", {
    name: "播放临时语音",
  });
  assert.ok((await temporaryPlayButtons.count()) > 0);
  await temporaryPlayButtons.first().click();
  await listeningCard.getByText("1", { exact: true }).first().waitFor();
  await temporaryPlayButtons.first().click();
  await listeningCard.getByText("2", { exact: true }).first().waitFor();

  const listeningQuestions = listeningCard.locator("fieldset");
  const listeningQuestionCount = await listeningQuestions.count();
  assert.ok(listeningQuestionCount > 0);
  for (let index = 0; index < listeningQuestionCount; index += 1) {
    await listeningQuestions.nth(index).getByRole("radio").first().check();
  }
  await listeningCard.getByRole("button", { name: "提交并查看反馈" }).click();
  await listeningCard.getByText(/本轮答对 \d+\/\d+ 题，正确率 100%/).waitFor();
  await listeningCard.getByText("100%", { exact: true }).first().waitFor();
  await listeningCard.getByText(/回答正确。/).first().waitFor();
  await listeningCard.getByText("查看本章听力文本", { exact: true }).waitFor();
  await listeningCard.getByRole("button", { name: "再听一轮" }).click();
  for (let index = 0; index < listeningQuestionCount; index += 1) {
    await listeningQuestions.nth(index).getByRole("radio").nth(1).check();
  }
  await listeningCard.getByRole("button", { name: "提交并查看反馈" }).click();
  await listeningCard.getByText(/本轮答对 0\/\d+ 题，正确率 0%/).waitFor();
  await listeningCard.getByText("50%", { exact: true }).first().waitFor();
  await listeningCard.getByText(/回答有误。/).first().waitFor();
  console.log(
    `PASS listening browser interaction: real ${listeningQuestionCount}-question payload, explicit temporary voice, repeat play count=2, session accuracy=50%, per-question feedback visible`,
  );

  setPublishedListeningFixture({
    id: formalListeningBlock.id,
    status: "published",
    contentPayload: {
      ...formalListeningBlock.content_payload,
      audioStatus: "pending",
      questions: [],
    },
  });
  await page.goto(formalUrl);
  await page
    .getByText(
      /本章暂未提供听力文本、音频或听辨题|本章听力来源暂未提供可作答的听辨题/,
    )
    .waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), /Application error/);
  console.log("PASS incomplete listening payload: no-question state is explicit and page remains usable");

  setPublishedListeningFixture({
    id: formalListeningBlock.id,
    status: "published",
    contentPayload: {
      ...formalListeningBlock.content_payload,
      audioStatus: "pending",
    },
  });

  const selfCheckCard = page.locator("section").filter({
    has: page.getByRole("heading", { name: "自我检测", exact: true }),
  });
  const masteredChoices = selfCheckCard.getByText("已经掌握", { exact: true });
  const masteredChoiceCount = await masteredChoices.count();
  assert.ok(masteredChoiceCount > 0, "正式章自我检测必须包含本章主题");
  for (let index = 0; index < masteredChoiceCount; index += 1) {
    await masteredChoices.nth(index).click();
  }
  await selfCheckCard.getByRole("button", { name: "查看巩固结果" }).click();
  await page.getByRole("heading", { name: /巩固结果：可以继续/ }).waitFor();
  await page.getByRole("button", { name: "重新练习" }).waitFor();
  await page.getByRole("link", { name: "回看本章内容" }).waitFor();
  await page.getByRole("link", { name: "返回巩固目录" }).last().waitFor();
  console.log(
    `PASS self-check interaction: answered ${masteredChoiceCount} real topics; score feedback + retry/review/catalog actions visible`,
  );

  await page.getByRole("button", { name: "标记本块已复习" }).first().click();
  const savedFormalProgress = await waitForSavedProgress(
    formalUnit.id,
    (row) =>
      row.completed_block_ids.length >= 2 &&
      row.attempt_count >= listeningQuestionCount * 2 + masteredChoiceCount,
    "内容块、自检和听力结果写入",
  );
  assert.ok(savedFormalProgress.started_at);
  assert.ok(savedFormalProgress.last_practiced_at);
  assert.ok(savedFormalProgress.correct_count > 0);
  assert.ok(savedFormalProgress.attempt_count >= savedFormalProgress.correct_count);
  console.log(
    `PASS real database write: status=${savedFormalProgress.status}, progress=${savedFormalProgress.progress_percent}, mastery=${savedFormalProgress.mastery_percent}, blocks=${savedFormalProgress.completed_block_ids.length}, correct/attempt=${savedFormalProgress.correct_count}/${savedFormalProgress.attempt_count}`,
  );

  await page.reload();
  await page.getByText("学习进度已保存，可在其他设备继续", { exact: true }).waitFor();
  await page.getByRole("button", { name: "已完成本块" }).first().waitFor();
  assert.match(await page.locator("body").innerText(), /巩固进度/);
  console.log("PASS refresh persistence: saved block and aggregate progress restored");

  const offlineBlockButton = page.getByRole("button", {
    name: "标记本块已复习",
  }).first();
  const offlineBlockSectionFromButton = offlineBlockButton.locator(
    "xpath=ancestor::section[1]",
  );
  const offlineBlockId = (await offlineBlockSectionFromButton.getAttribute("id"))?.replace(
    "practice-block-",
    "",
  );
  assert.ok(offlineBlockId);
  const offlineBlockSection = page.locator(`#practice-block-${offlineBlockId}`);
  await page.context().setOffline(true);
  await offlineBlockButton.click();
  await offlineBlockSection.getByRole("button", { name: "已完成本块" }).waitFor();
  await page.getByText(/当前离线，进度已保存在本机/).waitFor();
  await page.context().setOffline(false);
  await page.waitForFunction(() => navigator.onLine);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.reload();
  await page
    .locator(`#practice-block-${offlineBlockId}`)
    .getByRole("button", { name: "已完成本块" })
    .waitFor();
  await waitForSavedProgress(
    formalUnit.id,
    (row) => row.completed_block_ids.includes(offlineBlockId),
    "离线缓存恢复后合并",
  );
  console.log("PASS offline fallback: optimistic local completion merged after reconnect");

  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const secondPage = await secondContext.newPage();
  await secondPage.goto(`${APP_URL}/login`);
  await secondPage.getByLabel("登录账号").fill(studentEmail);
  await secondPage.locator('input[name="password"]').fill(studentPassword);
  await secondPage.getByRole("button", { name: "进入学习中心" }).click();
  await secondPage.waitForURL((url) => url.pathname !== "/login", {
    timeout: 30_000,
  });
  await secondPage.goto(formalUrl);
  await secondPage.getByRole("button", { name: "已完成本块" }).first().waitFor();
  const secondDeviceProgress = await waitForSavedProgress(
    formalUnit.id,
    (row) => row.completed_block_ids.includes(offlineBlockId),
    "第二浏览器上下文读取服务器进度",
  );
  console.log("PASS cross-device simulation: empty local storage restored database progress");

  const progressCacheKey = `chapter-practice-progress:v1:${studentId}:${formalUnit.id}`;
  const olderTimestamp = new Date(
    Date.parse(secondDeviceProgress.last_practiced_at) - 60_000,
  ).toISOString();
  await secondPage.evaluate(
    ({ key, practiceUnitId, timestamp }) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          pending: true,
          masteredInteractions: [],
          progress: {
            practiceUnitId,
            status: "not_started",
            progressPercent: 0,
            masteryPercent: 0,
            completedBlockIds: [],
            lastBlockId: null,
            correctCount: 0,
            attemptCount: 0,
            startedAt: timestamp,
            lastPracticedAt: timestamp,
            completedAt: null,
          },
        }),
      );
    },
    { key: progressCacheKey, practiceUnitId: formalUnit.id, timestamp: olderTimestamp },
  );
  await secondPage.reload();
  await secondPage.getByRole("button", { name: "已完成本块" }).first().waitFor();
  const afterConflict = await mustData(
    "read timestamp conflict result",
    admin
      .from("student_chapter_practice_progress")
      .select("completed_block_ids,correct_count,attempt_count,last_practiced_at")
      .eq("tenant_id", TENANT_ID)
      .eq("student_id", studentId)
      .eq("practice_unit_id", formalUnit.id)
      .single(),
  );
  assert.deepEqual(
    new Set(afterConflict.completed_block_ids),
    new Set(secondDeviceProgress.completed_block_ids),
  );
  assert.equal(afterConflict.correct_count, secondDeviceProgress.correct_count);
  assert.equal(afterConflict.attempt_count, secondDeviceProgress.attempt_count);
  assert.equal(afterConflict.last_practiced_at, secondDeviceProgress.last_practiced_at);
  console.log("PASS timestamp conflict: older local cache did not overwrite newer database row");

  await secondPage.goto(`${APP_URL}/${TENANT_SLUG}/apps/korean/practice/course`);
  const formalChapterCard = secondPage.locator("a").filter({
    has: secondPage.getByText("第 1 课：韩国语1级", { exact: true }),
  });
  await formalChapterCard.getByText(/巩固中|待加强|已掌握/).waitFor();
  await secondContext.close();
  console.log("PASS directory/detail consistency: catalog status comes from saved practice row");

  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(formalUrl);
  await page.getByRole("heading", { name: "自我检测", exact: true }).waitFor();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert.equal(hasHorizontalOverflow, false);
  await page.goto(hangulUrl);
  await page.getByRole("heading", { name: "字母拼合互动" }).waitFor();
  const hangulHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert.equal(hangulHasHorizontalOverflow, false);
  console.log("PASS responsive/a11y smoke: both chapters fit 375px with reduced motion");
} catch (error) {
  if (server) {
    console.error("NEXT DEV OUTPUT (tail):\n", serverOutput);
  }
  throw error;
} finally {
  if (browser) await browser.close();
  if (server && !server.killed) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
    server.stdout?.destroy();
    server.stderr?.destroy();
    server.unref();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (studentId) await admin.auth.admin.deleteUser(studentId);
  if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  if (listeningBlockOriginal) {
    setPublishedListeningFixture({
      id: listeningBlockOriginal.id,
      status: listeningBlockOriginal.status,
      contentPayload: listeningBlockOriginal.content_payload,
    });
  }
  if (hangulInteractionBlockId) {
    runLocalSql(`
      begin;
      alter table public.chapter_practice_blocks disable trigger chapter_practice_blocks_protect_published;
      delete from public.chapter_practice_blocks where id = '${hangulInteractionBlockId}'::uuid;
      alter table public.chapter_practice_blocks enable trigger chapter_practice_blocks_protect_published;
      commit;
    `);
  }
  runLocalSql(
    `revoke select on ${locallyGrantedTables.map((table) => `public.${table}`).join(", ")} from service_role;`,
  );
  runLocalSql(
    `revoke select, insert, update, delete on ${locallyWritableTables.map((table) => `public.${table}`).join(", ")} from service_role;`,
  );
  runLocalSql("revoke select on public.profiles from authenticated;");
  runLocalSql(
    `revoke select on ${authenticatedReadTables.map((table) => `public.${table}`).join(", ")} from authenticated;`,
  );
  runLocalSql(
    "revoke insert, update on public.lesson_progress from authenticated;",
  );
}
