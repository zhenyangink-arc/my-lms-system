// 验证 Supabase Realtime Broadcast 通道：双客户端订阅同一频道，一端广播一端接收
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
if (!url || !serviceKey) {
  console.error("MISSING ENV");
  process.exit(1);
}

const room = `live-class:test-room-${Date.now()}`;
const receiver = createClient(url, serviceKey, {
  realtime: { params: { eventsPerSecond: 20 } },
});
const sender = createClient(url, serviceKey, {
  realtime: { params: { eventsPerSecond: 20 } },
});

const timeout = setTimeout(() => {
  console.error("TIMEOUT: 未收到广播（Realtime 可能未授权）");
  process.exit(1);
}, 15000);

let receiverReady = false;

receiver
  .channel(room)
  .on("broadcast", { event: "live-event" }, (payload) => {
    clearTimeout(timeout);
    console.log(`RECEIVED: ${JSON.stringify(payload)}`);
    console.log("REALTIME BROADCAST OK");
    process.exit(0);
  })
  .subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      console.log("receiver SUBSCRIBED");
      receiverReady = true;
      // 等发送端也订阅后再发
      sender
        .channel(room)
        .subscribe(async (sendStatus) => {
          if (sendStatus === "SUBSCRIBED" && receiverReady) {
            console.log("sender SUBSCRIBED");
            await sender.channel(room).send({
              type: "broadcast",
              event: "live-event",
              payload: { kind: "page", chapterSlug: "meet-hangul", page: 3 },
            });
            console.log("sent broadcast");
          }
        });
    }
  });
