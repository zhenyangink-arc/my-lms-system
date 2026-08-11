// 验证：Realtime Postgres Changes 订阅 live_class_events 的 INSERT 分发
const fs = require("fs");
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

const url = readVar("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) { console.error("MISSING ENV"); process.exit(1); }

const SESSION_ID = "952791cb-13d2-4dda-a9a2-5035ff4a6448";

const client = createClient(url, serviceKey, {
  realtime: { params: { eventsPerSecond: 20 } },
});

const timeout = setTimeout(() => {
  console.error("TIMEOUT: 未收到 postgres_changes 事件");
  process.exit(1);
}, 15000);

client
  .channel("pg-changes-test")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "live_class_events",
      filter: `session_id=eq.${SESSION_ID}`,
    },
    (payload) => {
      clearTimeout(timeout);
      const row = payload.new;
      console.log(`RECEIVED: kind=${row.kind} sender=${row.sender_id.slice(0, 8)} page=${row.page}`);
      console.log(`PAYLOAD: ${JSON.stringify(row.payload)}`);
      console.log("POSTGRES CHANGES OK");
      // 清理测试行
      client
        .from("live_class_events")
        .delete()
        .eq("id", row.id)
        .then(() => process.exit(0))
        .catch(() => process.exit(0));
    }
  )
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      console.log("subscribed, inserting test event...");
      await client.from("live_class_events").insert({
        tenant_id: (await client
          .from("live_class_sessions")
          .select("tenant_id")
          .eq("id", SESSION_ID)
          .single()).data.tenant_id,
        session_id: SESSION_ID,
        sender_id: "2b438ee6-5fa9-4983-89ad-a43df4f46fc7",
        kind: "stroke",
        chapter_slug: "meet-hangul",
        page: 2,
        payload: { kind: "stroke", stroke: { id: "pg-test", points: [{ x: 5, y: 5 }], color: "#000", width: 3 } },
      });
    }
  });
