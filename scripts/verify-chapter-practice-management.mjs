#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_DB_CONTAINER = "supabase_db_my-lms-system";
const LOCAL_KONG_CONTAINER = "supabase_kong_my-lms-system";

const kongConfig = execFileSync(
  "docker",
  ["exec", LOCAL_KONG_CONTAINER, "cat", "/home/kong/kong.yml"],
  { encoding: "utf8" },
);
const jwtKeys = [...new Set(kongConfig.match(/eyJ[a-zA-Z0-9._-]+/g) ?? [])];
const jwtByRole = new Map(
  jwtKeys.flatMap((key) => {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
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

// 本地库的安全脚本会临时收紧 service_role 的来源表授权；生产服务沿用项目
// 既有的 createAdminClient，因此验收期间只补回所需 SELECT，结束后立即恢复。
const locallyGrantedTables = [
  "course_chapters",
  "growth_toolbox_exercises",
  "growth_toolbox_questions",
  "growth_toolbox_question_keys",
];
runLocalSql(
  `grant select on ${locallyGrantedTables.map((table) => `public.${table}`).join(", ")} to service_role;`,
);
runLocalSql("grant select on public.profiles to authenticated;");

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
      if (filePath) return { shortCircuit: true, url: pathToFileURL(filePath).href };
    }
    return nextResolve(specifier, context);
  },
});

const email = `chapter-practice-owner-${Date.now()}@local.test`;
const password = `Local-${crypto.randomUUID()}!`;
let userId = null;

try {
  const created = await mustData(
    "create local platform owner",
    admin.auth.admin.createUser({ email, password, email_confirm: true }),
  );
  userId = created.user.id;
  await mustData(
    "promote local platform owner",
    admin
      .from("profiles")
      .update({
        role: "platform_super_admin",
        global_role: "platform_owner",
        status: "active",
      })
      .eq("id", userId)
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
  const { error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(signInError);
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

  const chapters = await mustData(
    "load published verification chapters",
    admin
      .from("course_chapters")
      .select("id,slug,is_published")
      .in("slug", ["meet-hangul", "vowels-and-consonants"])
      .eq("is_published", true),
  );
  const chapterBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));
  const successChapter = chapterBySlug.get("meet-hangul");
  const blockedChapter = chapterBySlug.get("vowels-and-consonants");
  assert.ok(successChapter && blockedChapter, "本地库缺少验收章节");

  const latestOrNewDraft = async (chapterId) => {
    const latest = await mustData(
      "load latest version",
      admin
        .from("chapter_practice_units")
        .select("id,status")
        .eq("course_chapter_id", chapterId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (!latest) return service.generateChapterPracticeDraft(chapterId);
    if (latest.status === "draft") return latest.id;
    if (latest.status === "pending_review") {
      await service.returnChapterPracticeToDraft(latest.id);
      return latest.id;
    }
    return service.createNextChapterPracticeVersion(chapterId);
  };

  const unitId = await latestOrNewDraft(successChapter.id);
  let detail = await service.getChapterPracticeUnitDetail(successChapter.id);
  assert.equal(detail.id, unitId);
  assert.equal(detail.status, "draft");
  assert.ok(detail.blocks.length >= 9);
  console.log(
    `PASS generate: ${successChapter.slug} -> unit=${unitId}, version=${detail.version}, blocks=${detail.blocks.length}, status=${detail.status}`,
  );

  const listening = detail.blocks.find((block) => block.blockType === "listening");
  assert.ok(listening);
  assert.equal(listening.contentPayload.audioStatus, "missing");
  await service.updateChapterPracticeBlock({
    unitId,
    blockId: listening.id,
    title: listening.title,
    instructions: listening.instructions,
    enabled: false,
    isRequired: false,
  });
  await service.updateChapterPracticeUnit({
    unitId,
    title: `${detail.chapterTitle}巩固（本地验收）`,
    completionRule: {
      mode: "required_blocks",
      minimumRequiredBlocks: 5,
      requireSelfCheck: true,
    },
  });
  const movable = detail.blocks.at(-1);
  await service.moveChapterPracticeBlock({
    unitId,
    blockId: movable.id,
    direction: "up",
  });
  detail = await service.getChapterPracticeUnitDetail(successChapter.id);
  assert.equal(detail.title, `${detail.chapterTitle}巩固（本地验收）`);
  assert.equal(
    detail.blocks.find((block) => block.id === listening.id).status,
    "disabled",
  );
  console.log(
    `PASS edit: title saved, listening disabled with explicit missing-audio hint, sort_order changed`,
  );

  const previewPayload = JSON.stringify({
    title: detail.title,
    blocks: detail.blocks
      .filter((block) => block.status !== "disabled")
      .map((block) => ({ title: block.title, instructions: block.instructions })),
  });
  assert.match(previewPayload, /本章快速回顾/);
  assert.match(previewPayload, /自我检测/);
  console.log(
    `PASS preview data: enabledBlocks=${detail.blocks.filter((block) => block.status !== "disabled").length}, desktop/mobile renderer input loaded`,
  );

  const successInspection = await service.inspectChapterPracticeUnit(unitId);
  assert.equal(successInspection.passed, true);
  await service.submitChapterPracticeForReview(unitId);
  await service.publishChapterPracticeUnit(unitId);
  const published = await mustData(
    "read published result",
    admin
      .from("chapter_practice_units")
      .select("id,version,status,published_at,title")
      .eq("id", unitId)
      .single(),
  );
  assert.equal(published.status, "published");
  assert.ok(published.published_at);
  console.log(
    `PASS publish: version=${published.version}, status=${published.status}, published_at=${published.published_at}`,
  );

  const overwrite = await admin
    .from("chapter_practice_units")
    .update({ title: "不应覆盖" })
    .eq("id", unitId)
    .select("id");
  assert.ok(overwrite.error);
  assert.match(overwrite.error.message, /不可覆盖|新版本/);
  console.log(`PASS immutable: direct published update rejected: ${overwrite.error.message}`);

  const nextUnitId = await service.createNextChapterPracticeVersion(successChapter.id);
  const nextVersion = await mustData(
    "read next version",
    admin
      .from("chapter_practice_units")
      .select("id,version,status,published_at")
      .eq("id", nextUnitId)
      .single(),
  );
  assert.equal(nextVersion.version, published.version + 1);
  assert.equal(nextVersion.status, "draft");
  assert.equal(nextVersion.published_at, null);
  console.log(
    `PASS new version: old=v${published.version} published, new=v${nextVersion.version} draft`,
  );

  const blockedUnitId = await latestOrNewDraft(blockedChapter.id);
  const blockedDetail = await service.getChapterPracticeUnitDetail(blockedChapter.id);
  const grammar = blockedDetail.blocks.find((block) => block.blockType === "grammar");
  const vocabulary = blockedDetail.blocks.find((block) => block.blockType === "vocabulary");
  assert.ok(grammar && vocabulary);
  await service.updateChapterPracticeBlock({
    unitId: blockedUnitId,
    blockId: grammar.id,
    title: grammar.title,
    instructions: grammar.instructions,
    enabled: false,
    isRequired: grammar.isRequired,
  });
  await mustData(
    "invalidate source fixture",
    admin
      .from("chapter_practice_blocks")
      .update({ source_id: crypto.randomUUID() })
      .eq("id", vocabulary.id)
      .select("id")
      .single(),
  );
  const blockedInspection = await service.inspectChapterPracticeUnit(blockedUnitId);
  assert.equal(blockedInspection.passed, false);
  const blockedReasons = blockedInspection.checks
    .flatMap((check) => check.reasons)
    .join(" | ");
  assert.match(blockedReasons, /核心语法复习/);
  assert.match(blockedReasons, /来源已失效/);
  await assert.rejects(
    service.submitChapterPracticeForReview(blockedUnitId),
    (error) =>
      error instanceof service.ChapterPracticeOperationError &&
      /发布前检查未通过/.test(error.message),
  );
  const stillDraft = await mustData(
    "read rejected version",
    admin
      .from("chapter_practice_units")
      .select("status,published_at")
      .eq("id", blockedUnitId)
      .single(),
  );
  assert.equal(stillDraft.status, "draft");
  assert.equal(stillDraft.published_at, null);
  console.log(`PASS blocked publish: status=draft; reasons=${blockedReasons}`);
} finally {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
  runLocalSql(
    `revoke select on ${locallyGrantedTables.map((table) => `public.${table}`).join(", ")} from service_role;`,
  );
  runLocalSql("revoke select on public.profiles from authenticated;");
}
