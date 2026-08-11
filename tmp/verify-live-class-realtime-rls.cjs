// 阶段二：使用真实用户 JWT 验证 Supabase 私有 Realtime 课堂频道授权。
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const env = fs.readFileSync(".env.local", "utf8");
const readVar = (key) => env
  .split(/\r?\n/)
  .find((line) => line.startsWith(`${key}=`))
  ?.split("=")
  .slice(1)
  .join("=")
  .trim();

const url = readVar("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = readVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !anonKey || !serviceKey) throw new Error("SUPABASE_ENV_MISSING");

const teacherId = "2b438ee6-5fa9-4983-89ad-a43df4f46fc7";
const password = "Test@123456";
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient() {
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
}

async function subscribe(client, topic, timeoutMs = 10000) {
  return new Promise((resolve) => {
    let settled = false;
    const channel = client
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "stage2" }, () => {});
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, channel });
    };
    const timer = setTimeout(() => finish({ allowed: false, status: "TIMEOUT" }), timeoutMs);
    channel.subscribe((status, error) => {
      if (status === "SUBSCRIBED") finish({ allowed: true, status });
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        finish({ allowed: false, status, error: error?.message ?? null });
      }
    });
  });
}

const results = [];
function report(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

let sessionId = null;
const clients = [];

(async () => {
  try {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, login_id, email")
      .in("login_id", ["test01", "test02"]);
    if (profileError) throw profileError;
    const member = profiles?.find((item) => item.login_id === "test01");
    const outsider = profiles?.find((item) => item.login_id === "test02");
    if (!member?.email || !outsider?.email) throw new Error("TEST_ACCOUNTS_NOT_FOUND");

    const { data: source, error: sourceError } = await admin
      .from("live_class_sessions")
      .select("tenant_id, course_id, lesson_id, chapter_slug")
      .eq("teacher_id", teacherId)
      .limit(1)
      .single();
    if (sourceError) throw sourceError;

    const { data: session, error: sessionError } = await admin
      .from("live_class_sessions")
      .insert({
        tenant_id: source.tenant_id,
        teacher_id: teacherId,
        student_id: null,
        course_id: source.course_id,
        lesson_id: source.lesson_id,
        chapter_slug: source.chapter_slug,
        status: "active",
        mode: "group",
      })
      .select("id")
      .single();
    if (sessionError) throw sessionError;
    sessionId = session.id;

    const { error: memberError } = await admin
      .from("live_class_members")
      .insert({ session_id: sessionId, student_id: member.id });
    if (memberError) throw memberError;

    const memberClient = userClient();
    const outsiderClient = userClient();
    clients.push(memberClient, outsiderClient);

    const memberLogin = await memberClient.auth.signInWithPassword({ email: member.email, password });
    const outsiderLogin = await outsiderClient.auth.signInWithPassword({ email: outsider.email, password });
    if (memberLogin.error) throw memberLogin.error;
    if (outsiderLogin.error) throw outsiderLogin.error;

    const topic = `live-class:${sessionId}`;
    const memberSubscription = await subscribe(memberClient, topic);
    report("在场成员可订阅私有频道", memberSubscription.allowed, memberSubscription.status);

    const outsiderSubscription = await subscribe(outsiderClient, topic);
    report("非成员不可订阅私有频道", !outsiderSubscription.allowed, outsiderSubscription.status);

    await memberClient.removeChannel(memberSubscription.channel);
    await outsiderClient.removeChannel(outsiderSubscription.channel);

    const { error: removeError } = await admin
      .from("live_class_members")
      .update({ left_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("student_id", member.id);
    if (removeError) throw removeError;

    const removedSubscription = await subscribe(memberClient, topic);
    report("被移除成员不可重新订阅私有频道", !removedSubscription.allowed, removedSubscription.status);
    await memberClient.removeChannel(removedSubscription.channel);
  } finally {
    for (const client of clients) {
      await client.removeAllChannels();
      await client.auth.signOut({ scope: "local" });
    }
    if (sessionId) {
      await admin.from("live_class_sessions").delete().eq("id", sessionId);
    }
  }

  const failed = results.filter((item) => !item.passed);
  console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((error) => {
  console.error(`REALTIME_RLS_TEST_FAILED: ${error.message}`);
  process.exit(1);
});
