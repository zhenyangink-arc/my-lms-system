const fs = require("fs");
const { createServerClient } = require("@supabase/ssr");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
const readVar = (key) =>
  env
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`))
    ?.split("=")
    .slice(1)
    .join("=")
    .trim();
const supabaseUrl = readVar("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = readVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
const sessionId = process.argv[2];
const testMode = process.argv[3] || "muted";
const expectedStudentCanPublish = testMode === "granted";
if (!supabaseUrl || !anonKey || !serviceKey || !sessionId) throw new Error("TEST_INPUT_MISSING");

async function cookieFor(loginId, password) {
  const cookies = new Map();
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) => items.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `${loginId}@accounts.puffy.invalid`,
    password,
  });
  if (error) throw error;
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function requestAs(loginId, password, method = "GET", body) {
  const cookie = await cookieFor(loginId, password);
  const response = await fetch(`http://localhost:3000/api/live-class/${sessionId}/voice`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  return { status: response.status, payload: await response.json().catch(() => ({})) };
}

async function directStudentRlsChecks() {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: "codex_student_test@accounts.puffy.invalid",
    password: "CodexStudent@2026",
  });
  if (authError || !authData.user) throw authError || new Error("STUDENT_LOGIN_FAILED");
  const updateResult = await client
    .from("live_class_members")
    .update({ voice_granted_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("student_id", authData.user.id)
    .select("id");
  const connectionResult = await client.from("live_class_voice_connections").select("id").limit(1);
  await client.auth.signOut();
  return {
    memberUpdateDenied: Boolean(updateResult.error) || (updateResult.data ?? []).length === 0,
    connectionReadDenied: Boolean(connectionResult.error),
    updateError: updateResult.error?.message || null,
    connectionError: connectionResult.error?.message || null,
  };
}

(async () => {
  if (testMode === "removed") {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("login_id", "codex_student_test")
      .single();
    if (profileError) throw profileError;
    const { error: removeError } = await admin
      .from("live_class_members")
      .update({ left_at: new Date().toISOString(), voice_granted_at: null })
      .eq("session_id", sessionId)
      .eq("student_id", profile.id);
    if (removeError) throw removeError;
  }
  const outsider = await requestAs("codex_voice_outsider", "CodexOutsider@2026");
  const student = await requestAs("codex_student_test", "CodexStudent@2026");
  const teacher = await requestAs("codex_end_test", "CodexTest@2026");
  const providerSession = await requestAs(
    "codex_end_test",
    "CodexTest@2026",
    "POST",
    { operation: "create-session", kind: "subscriber" }
  );
  const directRls = testMode === "removed" ? null : await directStudentRlsChecks();

  const checks = [
    ["non-member denied", outsider.status === 403, outsider],
    [
      "member room state",
      testMode === "removed"
        ? student.status === 403
        : student.status === 200 && student.payload.canPublish === expectedStudentCanPublish,
      student,
    ],
    ["teacher room state", teacher.status === 200 && teacher.payload.isTeacher === true, teacher],
    [
      "Cloudflare SFU session created",
      providerSession.status === 200 &&
        providerSession.payload.ok === true &&
        typeof providerSession.payload.providerSessionId === "string",
      {
        status: providerSession.status,
        ok: providerSession.payload.ok,
        sessionCreated: typeof providerSession.payload.providerSessionId === "string",
      },
    ],
    ...(directRls
      ? [
          ["student cannot grant own microphone", directRls.memberUpdateDenied, directRls],
          ["student cannot read provider mappings", directRls.connectionReadDenied, directRls],
        ]
      : []),
  ];
  checks.forEach(([name, passed, detail]) =>
    console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${JSON.stringify(detail)}`)
  );
  if (checks.some(([, passed]) => !passed)) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
