import "server-only";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { requirePlatformOwner } from "@/lib/admin";
import type { SelectedVideoAssetInfo } from "./video-pilot-authoring.ts";

const ASSET_PATH = "/home/yangzhen/projects/media-studio/spikes/p0-3a-remux/input/sample01.mp4";
const ASSET_SHA256 = "68f72af1fecee3ce6ad9e2218df1d72ca9773b569bbf8f20847eb6fe0a39cabe";
const ASSET_SIZE = 5487747;
const CHUNK_SIZE = 64 * 1024;
const UNAVAILABLE = "所选视频素材暂不可用。";

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error(UNAVAILABLE);
}

/** Hash and serve the same bounded bytes from one descriptor; never reopen by path. */
async function readVerifiedSnapshot(signal?: AbortSignal): Promise<Uint8Array> {
  assertNotAborted(signal);
  if (await realpath(ASSET_PATH) !== ASSET_PATH) throw new Error(UNAVAILABLE);
  assertNotAborted(signal);
  const file = await open(ASSET_PATH, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    assertNotAborted(signal);
    const stat = await file.stat();
    if (!stat.isFile() || stat.size !== ASSET_SIZE) throw new Error(UNAVAILABLE);
    const bytes = new Uint8Array(ASSET_SIZE + 1);
    let offset = 0;
    while (offset < bytes.length) {
      assertNotAborted(signal);
      const { bytesRead } = await file.read(bytes, offset, Math.min(CHUNK_SIZE, bytes.length - offset), offset);
      assertNotAborted(signal);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== ASSET_SIZE || createHash("sha256").update(bytes.subarray(0, offset)).digest("hex") !== ASSET_SHA256) {
      throw new Error(UNAVAILABLE);
    }
    assertNotAborted(signal);
    return bytes.subarray(0, offset);
  } finally {
    await file.close();
  }
}

export async function getSelectedVideoAssetInfo(): Promise<SelectedVideoAssetInfo> {
  await requirePlatformOwner();
  try { await readVerifiedSnapshot(); }
  catch { throw new Error(UNAVAILABLE); }
  return {
    assetId: "course-video-sample01", title: "已选视频素材 sample01", sizeBytes: ASSET_SIZE,
    videoDurationSeconds: 30, containerDurationSeconds: 30.016,
    previewUrl: "/api/learning-agent/selected-video-preview",
  };
}

function securityHeaders(): Headers {
  return new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie",
    "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" });
}

function failure(request: Request, status: number, message: string): Response {
  const headers = securityHeaders();
  headers.set("Content-Type", "text/plain; charset=utf-8");
  if (status === 416) headers.set("Content-Range", `bytes */${ASSET_SIZE}`);
  return new Response(request.method === "HEAD" ? null : message, { status, headers });
}

function selectedRange(range: string | null): { start: number; end: number; partial: boolean } | null {
  if (range === null) return { start: 0, end: ASSET_SIZE - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return null;
  if (first === null) {
    if (last === null || last <= 0) return null;
    return { start: Math.max(0, ASSET_SIZE - last), end: ASSET_SIZE - 1, partial: true };
  }
  if (first >= ASSET_SIZE || (last !== null && last < first)) return null;
  return { start: first, end: Math.min(last ?? ASSET_SIZE - 1, ASSET_SIZE - 1), partial: true };
}

function snapshotStream(bytes: Uint8Array, start: number, end: number, signal: AbortSignal): ReadableStream<Uint8Array> {
  let offset = start;
  let finished = false;
  let abort: () => void;
  const cleanup = () => { finished = true; signal.removeEventListener("abort", abort); };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      abort = () => {
        if (finished) return;
        cleanup();
        controller.error(new Error(UNAVAILABLE));
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    },
    pull(controller) {
      if (finished) return;
      if (signal.aborted) { abort(); return; }
      const next = Math.min(offset + CHUNK_SIZE, end + 1);
      controller.enqueue(bytes.subarray(offset, next));
      offset = next;
      if (offset > end) { cleanup(); controller.close(); }
    },
    cancel() { cleanup(); },
  });
}

export async function serveSelectedVideoAsset(request: Request): Promise<Response> {
  try { await requirePlatformOwner(); }
  catch { return failure(request, 403, "无权查看此视频素材。"); }
  if (new URL(request.url).search) return failure(request, 400, "素材试看不接受查询参数。");
  let bytes: Uint8Array;
  try { bytes = await readVerifiedSnapshot(request.signal); assertNotAborted(request.signal); }
  catch { return failure(request, 503, UNAVAILABLE); }
  const range = selectedRange(request.headers.get("Range"));
  if (!range) return failure(request, 416, "请求的视频范围无效。");
  const headers = securityHeaders();
  headers.set("Content-Type", "video/mp4");
  headers.set("Content-Disposition", "inline");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(range.end - range.start + 1));
  if (range.partial) headers.set("Content-Range", `bytes ${range.start}-${range.end}/${ASSET_SIZE}`);
  return new Response(request.method === "HEAD" ? null : snapshotStream(bytes, range.start, range.end, request.signal), {
    status: range.partial ? 206 : 200, headers,
  });
}
