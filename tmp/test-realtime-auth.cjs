// 测试：Realtime private channel 授权 —— anon(非参与者)应被拒，service key 应正常
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
const anonKey = readVar("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceKey = readVar("SUPABASE_SERVICE_ROLE_KEY");
const SESSION_ID = "952791cb-13d2-4dda-a9a2-5035ff4a6448";
const topic = `live-class:${SESSION_ID}`;

function subscribeTest(label, key, expectSuccess) {
  return new Promise((resolve) => {
    const client = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    const timeout = setTimeout(() => {
      console.log(`${label}: TIMEOUT`);
      resolve();
    }, 12000);
    client
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "x" }, () => {})
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          const ok = expectSuccess;
          console.log(`${label}: SUBSCRIBED ${ok ? "(符合预期)" : "(未预期——应被拒！)"}`);
          client.removeChannel(client.channel(topic)).then(() => resolve());
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          const denied = !expectSuccess;
          const msg = err?.message ?? status;
          console.log(`${label}: ${status} ${denied ? "(符合预期——被拒)" : "(未预期！)"} err=${msg}`);
          resolve();
        }
      });
  });
}

(async () => {
  console.log(`topic: ${topic}`);
  await subscribeTest("anon(非参与者)", anonKey, false);
  await new Promise((r) => setTimeout(r, 1500));
  await subscribeTest("service key(bypass 验证不误伤)", serviceKey, true);
  process.exit(0);
})();
