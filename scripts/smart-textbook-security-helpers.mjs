import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { createServerClient } from "@supabase/ssr";

const RECORDING_BUCKET = "digital-textbook-student-recordings";

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

let actionModulePromise = null;
let profilePrivilegeChecked = false;

function ensureLocalProfileReadPrerequisite() {
  if (profilePrivilegeChecked) return;
  profilePrivilegeChecked = true;
  const container =
    process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_my-lms-system";
  const runSql = (sql) =>
    execFileSync(
      "docker",
      [
        "exec",
        container,
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-At",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  if (
    runSql(
      "select has_table_privilege('authenticated', 'public.profiles', 'select');",
    ) === "t"
  ) {
    return;
  }
  runSql("grant select on table public.profiles to authenticated;");
  process.once("exit", () => {
    try {
      runSql("revoke select on table public.profiles from authenticated;");
    } catch {
      // The local container may already be stopping; the next db reset restores it.
    }
  });
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
            url: "data:text/javascript,export%20async%20function%20cookies()%7Breturn%20globalThis.__SMART_TEXTBOOK_SECURITY_COOKIE_STORE__%7D",
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
        if (specifier === "next/navigation") {
          return nextResolve(`${specifier}.js`, context);
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
    actionModulePromise = import(
      "../src/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/smart-textbook-actions.ts"
    );
  }
  return actionModulePromise;
}

export async function createAuthenticatedActionInvoker({
  url,
  anonKey,
  serviceRoleKey,
  email,
  password,
}) {
  ensureLocalProfileReadPrerequisite();
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
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();
  assert.ifError(userError);
  assert.ok(user);

  process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  globalThis.__SMART_TEXTBOOK_SECURITY_COOKIE_STORE__ = {
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

export async function createSpeakingEvidence({
  admin,
  tenantId,
  userId,
  activityId,
  response,
}) {
  const evidenceId = randomUUID();
  const objectKey = `${tenantId}/${userId}/${activityId}/${evidenceId}.webm`;
  const bytes = new Uint8Array(4_096);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = (index * 31 + 17) % 256;
  }
  const { error: uploadError } = await admin.storage
    .from(RECORDING_BUCKET)
    .upload(objectKey, bytes, { contentType: "audio/webm", upsert: false });
  assert.ifError(uploadError);
  const { error: evidenceError } = await admin
    .from("digital_textbook_speaking_evidence")
    .insert({
      id: evidenceId,
      tenant_id: tenantId,
      student_id: userId,
      activity_id: activityId,
      object_key: objectKey,
      byte_size: bytes.byteLength,
      mime_type: "audio/webm",
    });
  assert.ifError(evidenceError);
  return {
    response: { ...response, recordingEvidenceId: evidenceId },
    objectKey,
  };
}
