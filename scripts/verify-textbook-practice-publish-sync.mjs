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
const DB_CONTAINER = "supabase_db_my-lms-system";
const KONG_CONTAINER = "supabase_kong_my-lms-system";

function runLocalSql(sql) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      DB_CONTAINER,
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

const kongConfig = execFileSync(
  "docker",
  ["exec", KONG_CONTAINER, "cat", "/home/kong/kong.yml"],
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

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
    }
    if (specifier === "next/cache") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export%20function%20revalidatePath(path,type)%7BglobalThis.__SYNC_REVALIDATED_PATHS__.push(%7Bpath,type%7D)%7D",
      };
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

globalThis.__SYNC_REVALIDATED_PATHS__ = [];
process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishableKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;

const admin = createClient(LOCAL_URL, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function mustData(label, promise) {
  const { data, error } = await promise;
  assert.ifError(error && new Error(`${label}: ${error.message}`));
  return data;
}

const email = `textbook-practice-sync-${Date.now()}@local.test`;
const password = `Local-${crypto.randomUUID()}!`;
let userId = null;
const createdCourseChapterIds = [];
const createdUnitIds = [];
const restoreRows = [];
const locallyGrantedTables = [
  "course_chapters",
  "growth_toolbox_exercises",
  "growth_toolbox_questions",
  "growth_toolbox_question_keys",
];
const originalServiceRoleSelect = new Map(
  locallyGrantedTables.map((table) => [
    table,
    runLocalSql(
      `select has_table_privilege('service_role', 'public.${table}', 'select')`,
    ) === "t",
  ]),
);
const originallyHadAuthenticatedProfileSelect =
  runLocalSql(
    "select has_table_privilege('authenticated', 'public.profiles', 'select')",
  ) === "t";
runLocalSql(
  `grant select on ${locallyGrantedTables.map((table) => `public.${table}`).join(", ")} to service_role`,
);
runLocalSql("grant select on public.profiles to authenticated");

async function snapshotRow(table, id, columns) {
  const row = await mustData(
    `snapshot ${table}`,
    admin.from(table).select(columns).eq("id", id).single(),
  );
  restoreRows.push({ table, id, row });
  return row;
}

async function restoreSnapshots() {
  for (const { table, id, row } of restoreRows.reverse()) {
    const { error } = await admin.from(table).update(row).eq("id", id);
    if (error) console.error(`restore ${table}/${id} failed: ${error.message}`);
  }
}

try {
  console.log(`LOCAL TARGET VERIFIED: ${LOCAL_URL} (${DB_CONTAINER})`);
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

  const action = await import(
    "../src/app/dashboard/admin/digital-textbook/actions.ts"
  );

  const textbook = await mustData(
    "load verification textbook",
    admin
      .from("digital_textbooks")
      .select("id,lesson_id,status,updated_at")
      .eq("student_app_id", "10000000-0000-4000-8000-000000000001")
      .eq("status", "published")
      .single(),
  );
  await snapshotRow("digital_textbooks", textbook.id, "status,updated_at");
  const version = await mustData(
    "load verification textbook version",
    admin
      .from("digital_textbook_versions")
      .select("id,status,updated_at")
      .eq("textbook_id", textbook.id)
      .eq("status", "published")
      .single(),
  );
  await snapshotRow("digital_textbook_versions", version.id, "status,updated_at");

  const chapters = await mustData(
    "load verification textbook chapters",
    admin
      .from("digital_textbook_chapters")
      .select("id,slug,chapter_test_id,status,production_status,updated_at")
      .eq("version_id", version.id)
      .in("slug", ["hello", "what-is-this"]),
  );
  const chapterBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));
  const draftFixture = chapterBySlug.get("hello");
  const failureFixture = chapterBySlug.get("what-is-this");
  assert.ok(draftFixture?.chapter_test_id && failureFixture?.chapter_test_id);

  for (const fixture of [draftFixture, failureFixture]) {
    await snapshotRow(
      "digital_textbook_chapters",
      fixture.id,
      "status,production_status,updated_at",
    );
    await snapshotRow("chapter_tests", fixture.chapter_test_id, "status,updated_at");
    const questions = await mustData(
      "snapshot chapter test questions",
      admin
        .from("chapter_test_questions")
        .select("id,status,updated_at")
        .eq("test_id", fixture.chapter_test_id),
    );
    for (const question of questions) {
      restoreRows.push({
        table: "chapter_test_questions",
        id: question.id,
        row: { status: question.status, updated_at: question.updated_at },
      });
    }
  }

  const createCourseChapter = async (fixture, suffix) => {
    const id = runLocalSql(`
      set session_replication_role = replica;
      insert into public.course_chapters (
        lesson_id, chapter_test_id, slug, title, description,
        is_published, sort_order, content_scope, tenant_id
      ) values (
        '${textbook.lesson_id}'::uuid,
        '${fixture.chapter_test_id}'::uuid,
        'practice-publish-sync-${suffix}-${Date.now()}',
        '发布同步验收 ${suffix}',
        '本地发布同步验收临时章节',
        true,
        ${9000 + createdCourseChapterIds.length},
        'platform',
        null
      ) returning id;
      set session_replication_role = origin;
    `);
    const createdId = id.split("\n").find((line) => /^[0-9a-f-]{36}$/.test(line));
    assert.ok(createdId);
    createdCourseChapterIds.push(createdId);
    return createdId;
  };

  const draftCourseChapterId = await createCourseChapter(draftFixture, "draft");
  const firstPublish = await action.publishTextbookChapterAction(draftFixture.id);
  assert.equal(firstPublish.ok, true, firstPublish.message);
  const draftUnit = await mustData(
    "read generated draft",
    admin
      .from("chapter_practice_units")
      .select("id,status,published_at,title,completion_rule,source_snapshot")
      .eq("course_chapter_id", draftCourseChapterId)
      .single(),
  );
  createdUnitIds.push(draftUnit.id);
  assert.equal(draftUnit.status, "draft");
  assert.equal(draftUnit.published_at, null);
  console.log(
    `PASS no-package publish: chapter=${draftFixture.slug}, unit=${draftUnit.id}, status=draft`,
  );

  const promotedAt = new Date().toISOString();
  await mustData(
    "promote verification unit",
    admin
      .from("chapter_practice_units")
      .update({ status: "published", published_at: promotedAt })
      .eq("id", draftUnit.id)
      .select("id")
      .single(),
  );
  const blocksBefore = await mustData(
    "snapshot practice blocks",
    admin
      .from("chapter_practice_blocks")
      .select("id,title,instructions,content_payload,sort_order,status")
      .eq("practice_unit_id", draftUnit.id)
      .order("sort_order"),
  );
  const sourceNode = await mustData(
    "load textbook source node",
    admin
      .from("digital_textbook_nodes")
      .select("id,content,updated_at,digital_textbook_modules!inner(chapter_id)")
      .eq("digital_textbook_modules.chapter_id", draftFixture.id)
      .limit(1)
      .single(),
  );
  restoreRows.push({
    table: "digital_textbook_nodes",
    id: sourceNode.id,
    row: { content: sourceNode.content, updated_at: sourceNode.updated_at },
  });
  await mustData(
    "change textbook source content",
    admin
      .from("digital_textbook_nodes")
      .update({
        content: {
          ...(sourceNode.content ?? {}),
          publishSyncVerification: crypto.randomUUID(),
        },
      })
      .eq("id", sourceNode.id)
      .select("id")
      .single(),
  );

  const secondPublish = await action.publishTextbookChapterAction(draftFixture.id);
  assert.equal(secondPublish.ok, true, secondPublish.message);
  const markedUnit = await mustData(
    "read needs-update unit",
    admin
      .from("chapter_practice_units")
      .select("status,published_at,title,completion_rule,source_snapshot")
      .eq("id", draftUnit.id)
      .single(),
  );
  const blocksAfter = await mustData(
    "read unchanged practice blocks",
    admin
      .from("chapter_practice_blocks")
      .select("id,title,instructions,content_payload,sort_order,status")
      .eq("practice_unit_id", draftUnit.id)
      .order("sort_order"),
  );
  assert.equal(markedUnit.status, "needs_update");
  assert.equal(Date.parse(markedUnit.published_at), Date.parse(promotedAt));
  assert.equal(markedUnit.title, draftUnit.title);
  assert.deepEqual(markedUnit.completion_rule, draftUnit.completion_rule);
  assert.deepEqual(markedUnit.source_snapshot, draftUnit.source_snapshot);
  assert.deepEqual(blocksAfter, blocksBefore);
  console.log(
    `PASS changed-source publish: status=needs_update; title/snapshot/${blocksAfter.length} blocks unchanged`,
  );

  const failureCourseChapterId = await createCourseChapter(
    failureFixture,
    "failure",
  );
  assert.ok(failureCourseChapterId);
  runLocalSql("revoke select on public.course_chapters from service_role");
  const originalConsoleError = console.error;
  const loggedErrors = [];
  console.error = (...values) => loggedErrors.push(values.map(String).join(" "));
  let degradedPublish;
  try {
    degradedPublish = await action.publishTextbookChapterAction(failureFixture.id);
  } finally {
    console.error = originalConsoleError;
    runLocalSql("grant select on public.course_chapters to service_role");
  }
  assert.equal(degradedPublish.ok, true, degradedPublish.message);
  assert.ok(loggedErrors.some((message) => /synchronization/.test(message)));
  const failedUnits = await mustData(
    "confirm failed synchronization created no unit",
    admin
      .from("chapter_practice_units")
      .select("id")
      .eq("course_chapter_id", failureCourseChapterId),
  );
  assert.equal(failedUnits.length, 0);
  console.log(
    `PASS degraded failure: textbook publish ok=true; synchronization error logged; no unit created`,
  );

  const refreshed = globalThis.__SYNC_REVALIDATED_PATHS__.map(({ path }) => path);
  assert.ok(
    refreshed.includes("/[space]/dashboard/admin/apps/[appSlug]/practice-center"),
  );
  assert.ok(refreshed.includes("/[space]/apps/korean/practice/course"));
  assert.ok(refreshed.includes("/dashboard/admin/digital-textbook"));
  assert.ok(
    refreshed.includes(
      "/[space]/apps/korean/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]",
    ),
  );
  console.log(`PASS cache chain: existing and practice-center paths revalidated`);
} finally {
  runLocalSql("grant select on public.course_chapters to service_role");
  await restoreSnapshots();
  if (createdCourseChapterIds.length > 0) {
    const unitList = createdUnitIds.map((id) => `'${id}'::uuid`).join(", ") || "null";
    const chapterList = createdCourseChapterIds
      .map((id) => `'${id}'::uuid`)
      .join(", ");
    runLocalSql(`
      set session_replication_role = replica;
      delete from public.chapter_practice_blocks where practice_unit_id in (${unitList});
      delete from public.chapter_practice_units where course_chapter_id in (${chapterList});
      delete from public.course_chapters where id in (${chapterList});
      set session_replication_role = origin;
    `);
  }
  if (userId) await admin.auth.admin.deleteUser(userId);
  const revokeTables = locallyGrantedTables.filter(
    (table) => !originalServiceRoleSelect.get(table),
  );
  if (revokeTables.length > 0) {
    runLocalSql(
      `revoke select on ${revokeTables.map((table) => `public.${table}`).join(", ")} from service_role`,
    );
  }
  if (!originallyHadAuthenticatedProfileSelect) {
    runLocalSql("revoke select on public.profiles from authenticated");
  }
}
