import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { registerHooks } from "node:module";
import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { getEventListeners } from "node:events";
import { join } from "node:path";

const source = "/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4";
const size = 5487747;
const digest = "68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe";
const temporary = await fs.mkdtemp("/tmp/course-video-foundation-test-");
await fs.chmod(temporary, 0o700);
const wrongHash = join(temporary, "wrong-hash.mp4");
await fs.writeFile(wrongHash, new Uint8Array(size));
const wrongSize = join(temporary, "wrong-size.mp4");
await fs.writeFile(wrongSize, new Uint8Array(5));
const symlink = join(temporary, "symlink.mp4");
await fs.symlink(source, symlink);
let state;
beforeEach(() => { state = { owner: true, events: [], opened: 0, closed: 0, reads: 0, totalRead: 0, target: source }; });
globalThis.__videoAssetOwner = async () => {
  state.events.push("owner");
  if (!state.owner) throw new Error("NEXT_REDIRECT:/private-auth-details");
};
globalThis.__videoAssetRealpath = async (path) => {
  state.events.push("realpath");
  assert.equal(path, source);
  if (state.realpathFailure) throw new Error(source);
  if (state.realpathMismatch) return wrongHash;
  if (state.target === symlink) return fs.realpath(symlink);
  await fs.realpath(state.target);
  return source;
};
globalThis.__videoAssetOpen = async (path, flags) => {
  state.events.push("open");
  assert.equal(path, source);
  assert.equal(flags, constants.O_RDONLY | constants.O_NOFOLLOW);
  const file = await fs.open(state.target, flags);
  state.opened++;
  return {
    async stat() {
      if (state.statFailure) throw new Error(source);
      const result = await file.stat();
      return state.nonregular ? { size, isFile: () => false } : result;
    },
    async read(bytes, offset, length, position) {
      state.reads++;
      assert.ok(length <= 65536);
      assert.equal(offset, position);
      assert.ok(offset + length <= size + 1);
      if (state.readFailure) throw new Error(source);
      const result = await file.read(bytes, offset, length, position);
      if (state.grow && result.bytesRead === 0) { bytes[offset] = 1; result.bytesRead = 1; }
      if (state.truncate && position >= 65536) result.bytesRead = 0;
      state.totalRead += result.bytesRead;
      state.abortDuringRead?.abort();
      return result;
    },
    async close() { state.closed++; await file.close(); },
  };
};
const mock = (source) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return mock("export {};");
  if (specifier === "@/lib/admin") return mock("export const requirePlatformOwner = () => globalThis.__videoAssetOwner();");
  if (specifier === "node:fs/promises" && context.parentURL?.endsWith("/selected-video-asset.server.ts")) return mock("export const open = (...args) => globalThis.__videoAssetOpen(...args); export const realpath = (...args) => globalThis.__videoAssetRealpath(...args);");
  if (specifier === "@/features/learning-agent-script-studio/selected-video-asset.server") return { url: new URL("../src/features/learning-agent-script-studio/selected-video-asset.server.ts", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { getSelectedVideoAssetInfo, serveSelectedVideoAsset } = await import("../src/features/learning-agent-script-studio/selected-video-asset.server.ts");
const route = await import("../src/app/api/learning-agent/selected-video-preview/route.ts");
hooks.deregister();
after(async () => {
  delete globalThis.__videoAssetOwner;
  delete globalThis.__videoAssetRealpath;
  delete globalThis.__videoAssetOpen;
  await fs.rm(temporary, { recursive: true, force: true });
});
const request = (range, method = "GET", signal, query = "") => new Request(`http://localhost/api/learning-agent/selected-video-preview${query}`, {
  method, signal, ...(range === undefined ? {} : { headers: { Range: range } }),
});
function security(response) {
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Cross-Origin-Resource-Policy"), "same-origin");
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(response.headers.has("ETag"), false);
}
async function failure(response, status) {
  assert.equal(response.status, status);
  security(response);
  const body = await response.text();
  assert.ok(!body.includes(source) && !body.includes(digest) && !body.includes("Error:") && !body.includes("NEXT_REDIRECT"));
  assert.equal(state.closed, state.opened);
}

test("existing owner guard rejects before disk access, including queries and inspection", async () => {
  state.owner = false;
  await failure(await route.GET(request(undefined, "GET", undefined, "?path=/etc/passwd")), 403);
  await assert.rejects(getSelectedVideoAssetInfo());
  assert.deepEqual(state.events, ["owner", "owner"]);
  assert.equal(state.opened, 0);
});

test("fixed source reader verifies actual sample size/digest and produces only a safe DTO", async () => {
  const info = await getSelectedVideoAssetInfo();
  assert.deepEqual(info, { assetId: "course-video-sample01", title: "已选视频素材 sample01", sizeBytes: size,
    videoDurationSeconds: 30, containerDurationSeconds: 30.016, previewUrl: "/api/learning-agent/selected-video-preview" });
  assert.equal(JSON.stringify(info).includes(source), false);
  assert.equal(state.totalRead, size);
  assert.equal(state.opened, 1);
  assert.equal(state.closed, 1);
  assert.deepEqual(state.events, ["owner", "realpath", "open"]);
});

test("actual GET emits verified bytes through Web stream and cleans listeners at EOF", async () => {
  const req = request();
  const before = getEventListeners(req.signal, "abort").length;
  const response = await route.GET(req);
  assert.equal(route.runtime, "nodejs");
  assert.equal(response.status, 200);
  security(response);
  assert.equal(response.headers.get("Content-Type"), "video/mp4");
  assert.equal(response.headers.get("Content-Disposition"), "inline");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.equal(response.headers.get("Content-Length"), String(size));
  assert.equal(response.headers.has("Content-Range"), false);
  assert.equal(state.closed, 1, "descriptor closed before returning the body");
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(bytes.length, size);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), digest);
  assert.equal(getEventListeners(req.signal, "abort").length, before);
});

test("all query selectors reject after authorization and before disk", async () => {
  for (const query of ["?assetId=course-video-sample01", "?path=/etc/passwd", "?file=sample01.mp4", "?x=", "?%2e%2e=/"]) {
    await failure(await serveSelectedVideoAsset(request(undefined, "GET", undefined, query)), 400);
  }
  assert.ok(state.events.every((event) => event === "owner"));
});

test("source missing, unreadable, symlink, nonregular, wrong size/hash and changing length fail closed", async () => {
  const cases = [
    { target: join(temporary, "missing") }, { realpathFailure: true }, { realpathMismatch: true }, { target: symlink },
    { nonregular: true }, { target: wrongSize }, { target: wrongHash }, { statFailure: true },
    { readFailure: true }, { grow: true }, { truncate: true },
  ];
  for (const scenario of cases) {
    state = { owner: true, events: [], opened: 0, closed: 0, reads: 0, totalRead: 0, target: source, ...scenario };
    await failure(await serveSelectedVideoAsset(request()), 503);
    await assert.rejects(getSelectedVideoAssetInfo(), (error) => error.message === "所选视频素材暂不可用。");
    assert.equal(state.opened, state.closed);
    assert.ok(state.totalRead <= 2 * (size + 1));
  }
});

test("all single ranges return exact inclusive slices; end/suffix clamp", async () => {
  const expected = await fs.readFile(source);
  for (const [range, start, end] of [
    ["bytes=0-0", 0, 0], ["bytes=3-10", 3, 10], [`bytes=${size - 1}-${size - 1}`, size - 1, size - 1],
    [`bytes=${size - 3}-`, size - 3, size - 1], ["bytes=-3", size - 3, size - 1],
    [`bytes=${size - 3}-${size + 100}`, size - 3, size - 1], [`bytes=-${size + 100}`, 0, size - 1],
    ["bytes=0-", 0, size - 1],
  ]) {
    const response = await serveSelectedVideoAsset(request(range));
    assert.equal(response.status, 206, range);
    security(response);
    assert.equal(response.headers.get("Content-Range"), `bytes ${start}-${end}/${size}`);
    assert.equal(response.headers.get("Content-Length"), String(end - start + 1));
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected.subarray(start, end + 1));
  }
  assert.equal(state.opened, state.closed);
});

test("invalid, multiple, unsupported, overflow and unsatisfiable ranges return 416", async () => {
  for (const range of ["", "bytes=-", "bytes=-0", "bytes=3-2", `bytes=${size}-`, "bytes=0-1,4-5", "items=0-1", "bytes=1.5-2", "bytes=NaN-", "bytes=1e3-", "bytes=+1-2", "bytes=0-9007199254740992", "bytes=9007199254740992-", "bytes=-9007199254740992"]) {
    const response = await serveSelectedVideoAsset(request(range));
    await failure(response, 416);
    assert.equal(response.headers.get("Content-Range"), `bytes */${size}`);
  }
});

test("HEAD validates source, matches statuses/headers and has no body for successes/errors", async () => {
  for (const [range, status, length] of [[undefined, 200, size], ["bytes=3-8", 206, 6], ["bytes=-0", 416, null]]) {
    const response = await route.HEAD(request(range, "HEAD"));
    assert.equal(response.status, status);
    security(response);
    assert.equal(response.body, null);
    assert.equal(response.headers.get("Content-Length"), length === null ? null : String(length));
  }
  assert.equal(state.opened, 3);
  state.target = wrongHash;
  const bad = await route.HEAD(request(undefined, "HEAD"));
  await failure(bad, 503);
  assert.equal(bad.body, null);
  state.owner = false;
  const denied = await route.HEAD(request(undefined, "HEAD"));
  await failure(denied, 403);
  assert.equal(denied.body, null);
});

test("pre-abort touches no disk and during-read abort stops and closes descriptor", async () => {
  const controller = new AbortController();
  controller.abort();
  await failure(await serveSelectedVideoAsset(request(undefined, "GET", controller.signal)), 503);
  assert.deepEqual(state.events, ["owner"]);
  const during = new AbortController();
  state.abortDuringRead = during;
  const req = request(undefined, "GET", during.signal);
  const before = getEventListeners(req.signal, "abort").length;
  await failure(await serveSelectedVideoAsset(req), 503);
  assert.equal(state.reads, 1);
  assert.equal(state.closed, 1);
  assert.equal(getEventListeners(req.signal, "abort").length, before);
});

test("consumer cancel and request abort stop stream and remove listeners", async () => {
  const cancelled = request();
  const before = getEventListeners(cancelled.signal, "abort").length;
  const response = await serveSelectedVideoAsset(cancelled);
  assert.equal(getEventListeners(cancelled.signal, "abort").length, before + 1);
  await response.body.cancel();
  assert.equal(getEventListeners(cancelled.signal, "abort").length, before);
  const controller = new AbortController();
  const req = request(undefined, "GET", controller.signal);
  const aborted = await serveSelectedVideoAsset(req);
  const reader = aborted.body.getReader();
  await reader.read();
  controller.abort();
  await assert.rejects(reader.read(), /素材暂不可用/);
  assert.equal(getEventListeners(req.signal, "abort").length, 0);
  assert.equal(state.opened, state.closed);
});
