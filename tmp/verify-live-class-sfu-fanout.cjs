const fs = require("fs");
const { createServerClient } = require("@supabase/ssr");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
const readVar = (key) =>
  env.split(/\r?\n/).find((line) => line.startsWith(`${key}=`))?.split("=").slice(1).join("=").trim();
const url = readVar("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = readVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
const sessionId = process.argv[2];
if (!url || !anonKey || !serviceKey || !sessionId) throw new Error("TEST_INPUT_MISSING");
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function cookieFor(loginId, password) {
  const cookies = new Map();
  const client = createServerClient(url, anonKey, {
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

async function roomState(loginId, password) {
  const response = await fetch(`http://localhost:3000/api/live-class/${sessionId}/voice`, {
    headers: { Cookie: await cookieFor(loginId, password) },
  });
  return { status: response.status, payload: await response.json() };
}

(async () => {
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, login_id")
    .in("login_id", ["test01", "test02"]);
  if (profilesError) throw profilesError;
  const idByLogin = new Map(profiles.map((profile) => [profile.login_id, profile.id]));
  const speakerId = idByLogin.get("test01");
  if (!speakerId || !idByLogin.get("test02")) throw new Error("TEST_STUDENTS_MISSING");

  await admin
    .from("live_class_members")
    .update({ voice_granted_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .eq("student_id", speakerId);
  const { error: connectionError } = await admin.from("live_class_voice_connections").upsert(
    {
      session_id: sessionId,
      user_id: speakerId,
      connection_kind: "publisher",
      provider_session_id: "fake-publisher-session-a",
      track_name: "fake-audio-track-a",
      track_mid: "0",
      closed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "session_id,user_id,connection_kind" }
  );
  if (connectionError) throw connectionError;

  try {
    const studentB = await roomState("test02", "Test@123456");
    const studentC = await roomState("codex_student_test", "CodexStudent@2026");
    for (const [name, result] of [
      ["student B", studentB],
      ["student C", studentC],
    ]) {
      const canReceiveA =
        result.status === 200 && result.payload.speakers?.some((speaker) => speaker.userId === speakerId);
      console.log(`${canReceiveA ? "PASS" : "FAIL"} ${name} receives authorized A track: ${JSON.stringify(result)}`);
      if (!canReceiveA) process.exitCode = 1;
    }
  } finally {
    await admin
      .from("live_class_voice_connections")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", speakerId);
    await admin
      .from("live_class_members")
      .update({ voice_granted_at: null })
      .eq("session_id", sessionId)
      .eq("student_id", speakerId);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
