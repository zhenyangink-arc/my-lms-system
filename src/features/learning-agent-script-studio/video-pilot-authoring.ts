import { z } from "zod";
import { isTeacherVideoKey } from "../../lib/teaching-video.ts";

export const VIDEO_PILOT_AUTHORING_CONTRACT = "video-pilot-authoring/1";
export const SELECTED_VIDEO_ASSET_ID = "course-video-sample01";

export type VideoPilotDraft = {
  contract: typeof VIDEO_PILOT_AUTHORING_CONTRACT;
  mode: "video";
  state: "draft";
  media: null
    | { kind: "selected-local"; assetId: typeof SELECTED_VIDEO_ASSET_ID; state: "pending-ingestion" }
    | { kind: "r2-library"; objectKey: string; title: string; state: "unverified" };
  cue: null | { id: "pause-1"; atSeconds: number | null; activityId: string | null };
  captions: null;
};

export type VideoPilotIssue = {
  field: "videoPilot" | "videoPilotMedia" | "videoPilotCueAtSeconds" | "videoPilotActivityId";
  message: string;
};

export type SelectedVideoAssetInfo = {
  assetId: typeof SELECTED_VIDEO_ASSET_ID;
  title: string;
  sizeBytes: 5487747;
  videoDurationSeconds: 30;
  containerDurationSeconds: 30.016;
  previewUrl: "/api/learning-agent/selected-video-preview";
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return record(value) && Reflect.ownKeys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

/** Marker presence is authoritative even when its value cannot be parsed. */
export function hasVideoPilotMarker(configuration: unknown): boolean {
  return configuration !== null && typeof configuration === "object"
    && Object.hasOwn(configuration, "videoPilot");
}

export function parseVideoPilotDraft(value: unknown):
  | { ok: true; draft: VideoPilotDraft }
  | { ok: false; issues: VideoPilotIssue[] } {
  const issues: VideoPilotIssue[] = [];
  const add = (field: VideoPilotIssue["field"], message: string) => issues.push({ field, message });
  if (typeof value === "string") {
    if (value.length > 8192) return { ok: false, issues: [{ field: "videoPilot", message: "视频草稿内容过长。" }] };
    try { value = JSON.parse(value); }
    catch { return { ok: false, issues: [{ field: "videoPilot", message: "视频草稿格式不正确。" }] }; }
  }
  if (!exactKeys(value, ["contract", "mode", "state", "media", "cue", "captions"])) {
    return { ok: false, issues: [{ field: "videoPilot", message: "视频草稿字段缺失或包含不支持的字段。" }] };
  }
  if (value.contract !== VIDEO_PILOT_AUTHORING_CONTRACT || value.mode !== "video" || value.state !== "draft") {
    add("videoPilot", "不支持此视频草稿版本或状态。");
  }
  if (value.captions !== null) add("videoPilot", "此草稿暂不支持字幕配置。");
  const media = value.media;
  if (media !== null) {
    if (record(media) && media.kind === "selected-local") {
      if (!exactKeys(media, ["kind", "assetId", "state"]) || media.assetId !== SELECTED_VIDEO_ASSET_ID || media.state !== "pending-ingestion") {
        add("videoPilotMedia", "本地素材配置不正确。");
      }
    } else if (record(media) && media.kind === "r2-library") {
      if (!exactKeys(media, ["kind", "objectKey", "title", "state"]) || !isTeacherVideoKey(media.objectKey)
        || typeof media.title !== "string" || media.title !== media.title.trim() || media.title.length < 1 || media.title.length > 100
        || media.state !== "unverified") {
        add("videoPilotMedia", "请选择有效的视频库 MP4，并填写不超过 100 字的素材名称。");
      }
    } else add("videoPilotMedia", "不支持此视频素材类型。");
  }
  const cue = value.cue;
  if (cue !== null) {
    if (!exactKeys(cue, ["id", "atSeconds", "activityId"]) || cue.id !== "pause-1") {
      add("videoPilot", "此草稿只支持一个暂停题。");
    } else {
      if (cue.atSeconds !== null && (typeof cue.atSeconds !== "number" || !Number.isFinite(cue.atSeconds)
        || cue.atSeconds < 0 || cue.atSeconds > 86400)) {
        add("videoPilotCueAtSeconds", "暂停时间须为 0 至 86400 之间的秒数。");
      } else if (cue.atSeconds !== null && record(media) && media.kind === "selected-local" && cue.atSeconds >= 30) {
        add("videoPilotCueAtSeconds", "所选素材的暂停时间须小于 30 秒。");
      }
      if (cue.activityId !== null && !z.uuid().safeParse(cue.activityId).success) {
        add("videoPilotActivityId", "请选择有效的单选题。");
      }
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true, draft: value as VideoPilotDraft };
}

export function readVideoPilotDraft(configuration: unknown):
  | { kind: "absent" }
  | { kind: "invalid"; issues: VideoPilotIssue[] }
  | { kind: "pilot"; draft: VideoPilotDraft } {
  if (!hasVideoPilotMarker(configuration)) return { kind: "absent" };
  const value = (configuration as Record<string, unknown>).videoPilot;
  // Persisted data must be an object, not a second JSON encoding.
  if (!record(value)) return { kind: "invalid", issues: [{ field: "videoPilot", message: "已保存的视频草稿配置不受支持。" }] };
  const parsed = parseVideoPilotDraft(value);
  return parsed.ok ? { kind: "pilot", draft: parsed.draft } : { kind: "invalid", issues: parsed.issues };
}

export function createEmptyVideoPilotDraft(): VideoPilotDraft {
  return { contract: VIDEO_PILOT_AUTHORING_CONTRACT, mode: "video", state: "draft", media: null,
    cue: { id: "pause-1", atSeconds: null, activityId: null }, captions: null };
}

export function inspectVideoPilotDraft(draft: VideoPilotDraft): {
  authoring: "incomplete" | "configured"; issues: VideoPilotIssue[]; runtimeReady: false;
} {
  const parsed = parseVideoPilotDraft(draft);
  if (!parsed.ok) return { authoring: "incomplete", issues: parsed.issues, runtimeReady: false };
  const issues: VideoPilotIssue[] = [];
  if (draft.media === null) issues.push({ field: "videoPilotMedia", message: "请选择视频素材。" });
  if (draft.cue === null || draft.cue.atSeconds === null) issues.push({ field: "videoPilotCueAtSeconds", message: "请填写暂停时间。" });
  if (draft.cue === null || draft.cue.activityId === null) issues.push({ field: "videoPilotActivityId", message: "请选择关联单选题。" });
  return { authoring: issues.length ? "incomplete" : "configured", issues, runtimeReady: false };
}
