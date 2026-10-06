"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { saveTeachingScriptNodeAction, type TeachingScriptActionState } from "@/app/dashboard/admin/teaching-scripts/actions";
import { TeacherVideoPicker } from "./TeacherVideoPicker";
import { inspectSelectedVideoAssetAction } from "./teacher-video-actions";
import { createEmptyVideoPilotDraft, inspectVideoPilotDraft, parseVideoPilotDraft, readVideoPilotDraft,
  SELECTED_VIDEO_ASSET_ID, type SelectedVideoAssetInfo, type VideoPilotDraft } from "./video-pilot-authoring";
import type { TeachingScriptActivity, TeachingScriptNode } from "./types";

const controlClass = "min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60";
const buttonClass = "min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60";

export function TeachingVideoPilotEditor({ node, activities, editable, formId, returnTo, onDirtyChange, onPendingChange, onCancel }: {
  node: TeachingScriptNode; activities: TeachingScriptActivity[]; editable: boolean; formId?: string; returnTo: string;
  onDirtyChange: (dirty: boolean) => void; onPendingChange: (pending: boolean) => void; onCancel?: () => void;
}) {
  const initial = readVideoPilotDraft(node.configuration);
  const initialDraft = initial.kind === "pilot" ? initial.draft : createEmptyVideoPilotDraft();
  const [draft, setDraft] = useState<VideoPilotDraft>(initialDraft);
  const [rawTime, setRawTime] = useState(initialDraft.cue?.atSeconds?.toString() ?? "");
  const [token, setToken] = useState(node.updatedAt);
  const [dirty, setDirty] = useState(Boolean(onCancel));
  const [asset, setAsset] = useState<SelectedVideoAssetInfo | null>(null);
  const [assetError, setAssetError] = useState("");
  const [inspecting, startInspection] = useTransition();
  const errorSummary = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const controls = { videoPilot: `${prefix}-config`, videoPilotMedia: `${prefix}-media`,
    videoPilotCueAtSeconds: `${prefix}-time`, videoPilotActivityId: `${prefix}-activity` };
  const eligibleActivities = activities.filter((activity) => activity.type === "single_choice");
  const invalidActivity = draft.cue?.activityId && !eligibleActivities.some((activity) => activity.id === draft.cue?.activityId);
  const numericalTime = rawTime.trim() === "" ? null
    : /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(rawTime.trim()) && Number.isFinite(Number(rawTime)) ? Number(rawTime) : rawTime;
  const json = JSON.stringify({ ...draft, cue: draft.cue === null && rawTime === "" ? null
    : { id: "pause-1", atSeconds: numericalTime, activityId: draft.cue?.activityId ?? null } });
  const [state, action, pending] = useActionState(async (previous: TeachingScriptActionState, form: FormData): Promise<TeachingScriptActionState> => {
    const parsed = parseVideoPilotDraft(form.get("video_pilot_json"));
    if (!parsed.ok || invalidActivity) {
      const fieldErrors: Record<string, string[]> = {};
      if (!parsed.ok) for (const issue of parsed.issues) (fieldErrors[issue.field] ??= []).push(issue.message);
      if (invalidActivity) fieldErrors.videoPilotActivityId = ["原关联单选题已不可用，请重新选择。"];
      return { status: "error", message: "请检查标出的视频草稿字段。", fieldErrors };
    }
    const result = await saveTeachingScriptNodeAction(previous, form);
    if (result.status === "success") setDirty(false);
    return result;
  }, { status: "idle" });
  const errors = Object.entries(state.fieldErrors ?? {}).flatMap(([field, messages]) => messages.map((message) => ({ field, message })));
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onPendingChange(pending || inspecting); }, [pending, inspecting, onPendingChange]);
  useEffect(() => {
    if (state.status === "error") errorSummary.current?.focus();
  }, [state]);
  if (node.updatedAt !== token && !dirty) {
    const stored = readVideoPilotDraft(node.configuration);
    if (stored.kind === "pilot") {
      setDraft(stored.draft); setRawTime(stored.draft.cue?.atSeconds?.toString() ?? ""); setToken(node.updatedAt);
    }
  }
  function change(next: VideoPilotDraft) { setDraft(next); setDirty(true); }
  function inspectLocal(select: boolean) {
    startInspection(async () => {
      setAssetError("");
      const result = await inspectSelectedVideoAssetAction();
      if (!result.ok) { setAssetError(result.message); return; }
      setAsset(result.asset);
      if (select) change({ ...draft, media: { kind: "selected-local", assetId: SELECTED_VIDEO_ASSET_ID, state: "pending-ingestion" } });
    });
  }
  function focusField(field: string) {
    const element = document.getElementById(controls[field as keyof typeof controls] ?? controls.videoPilot);
    element?.scrollIntoView({ block: "center" }); element?.focus();
  }
  const parsed = parseVideoPilotDraft(json);
  const filled = parsed.ok && inspectVideoPilotDraft(parsed.draft).authoring === "configured" && !invalidActivity;
  const disabled = !editable || pending || inspecting;
  const describedBy = (field: keyof typeof controls) => state.fieldErrors?.[field]?.length ? `${controls[field]}-error` : undefined;
  const fieldError = (field: keyof typeof controls) => state.fieldErrors?.[field]?.length
    ? <p id={`${controls[field]}-error`} className="text-sm text-[var(--status-danger)]">{state.fieldErrors[field][0]}</p> : null;
  const libraryPicker = <TeacherVideoPicker label="视频库素材试看" value={draft.media?.kind === "r2-library" ? { objectKey: draft.media.objectKey, title: draft.media.title, transcript: "" } : null}
    editable={!disabled} onChange={(binding) => change({ ...draft, media: binding ? { kind: "r2-library", objectKey: binding.objectKey, title: binding.title.trim(), state: "unverified" } : null })} />;

  return <form id={formId} action={action} noValidate className="space-y-4" data-video-pilot-editor>
    <input type="hidden" name="node_id" value={node.id} />
    <input type="hidden" name="node_updated_at" value={token} />
    <input type="hidden" name="return_to" value={returnTo} />
    <input type="hidden" name="video_pilot_intent" value={initial.kind === "pilot" ? "save" : "enable"} />
    <input type="hidden" name="video_pilot_json" value={json} />
    <section id={controls.videoPilot} tabIndex={-1} className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4" aria-describedby={describedBy("videoPilot")}>
      <CardTitleWithHint headingLevel={3} title="视频暂停题草稿" description="保存视频素材、一个暂停时间和本步骤单选题。原台词与画面保留为草稿历史；完整流程预览、发布及学生学习记录仍待接入。" />
      <p role="status" className="text-sm text-[var(--muted-foreground)]">{filled ? "草稿字段已填写，待接入。" : "草稿尚未填写完整，可先保存继续编辑。"}</p>
      {node.updatedAt !== token && dirty && <p role="alert" className="text-sm text-[var(--status-danger)]">此小节已有新版本。请刷新后重新编辑，当前内容不会自动提交。</p>}
      {fieldError("videoPilot")}
    </section>
    {state.status === "error" && <div ref={errorSummary} tabIndex={-1} role="alert" className="space-y-2 rounded-lg border border-[var(--status-danger)] p-4 text-sm text-[var(--status-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      <p>{state.message}</p><ul>{(errors.length ? errors : [{ field: "videoPilot", message: "请刷新或核对当前草稿后重试。" }]).map(({ field, message }, index) =>
        <li key={`${field}-${index}`}><button type="button" onClick={() => focusField(field)} className="min-h-11 text-left underline">{message}</button></li>)}</ul>
    </div>}
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <CardTitleWithHint headingLevel={3} title="视频素材" description="本地已选素材仅用于试看，保存后仍待入库。视频库素材只检查存在与文件类型，暂停时间尚未按其真实时长校验。" />
      <div id={controls.videoPilotMedia} tabIndex={-1} aria-describedby={describedBy("videoPilotMedia")} className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={disabled} onClick={() => inspectLocal(true)}>{inspecting ? "正在检查素材…" : "选择 sample01.mp4"}</button>
        {draft.media && editable && <button type="button" className={buttonClass} disabled={disabled} onClick={() => { change({ ...draft, media: null }); setAsset(null); }}>清除素材</button>}
      </div>
      {fieldError("videoPilotMedia")}
      {assetError && <p role="alert" className="text-sm text-[var(--status-danger)]">{assetError}</p>}
      {draft.media?.kind === "selected-local" && <div className="space-y-2">
        <p className="text-sm">sample01.mp4 · 视频时长 30 秒 · 待入库</p>
        {!asset && <button type="button" className={buttonClass} disabled={inspecting || pending} onClick={() => inspectLocal(false)}>打开素材试看</button>}
        {asset && <><p className="text-sm font-semibold">素材试看</p><video src={asset.previewUrl} controls playsInline preload="metadata" aria-label="素材试看" className="aspect-video w-full rounded-lg bg-black" onError={() => setAssetError("素材暂时无法播放，请重新检查。")} /></>}
      </div>}
      {draft.media?.kind === "selected-local" ? <details className="space-y-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">改用视频库素材</summary>
        {libraryPicker}
      </details> : libraryPicker}
    </section>
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <CardTitleWithHint headingLevel={3} title="暂停题" description="可先留空；只引用当前学习步骤的单选题，不复制答案。此处不会执行暂停、判题或学习完成流程。" />
      <div className="space-y-2"><label htmlFor={controls.videoPilotCueAtSeconds} className="block text-sm font-semibold">暂停时间（秒）</label>
        <input id={controls.videoPilotCueAtSeconds} type="text" inputMode="decimal" value={rawTime} disabled={disabled} className={controlClass}
          aria-invalid={Boolean(state.fieldErrors?.videoPilotCueAtSeconds?.length) || undefined} aria-describedby={[`${prefix}-time-hint`, describedBy("videoPilotCueAtSeconds")].filter(Boolean).join(" ")}
          onChange={(event) => { setRawTime(event.target.value); setDirty(true); }} />
        <p id={`${prefix}-time-hint`} className="text-sm text-[var(--muted-foreground)]">留空表示待填写。所选本地素材须小于 30 秒。</p>{fieldError("videoPilotCueAtSeconds")}
      </div>
      <div className="space-y-2"><label htmlFor={controls.videoPilotActivityId} className="block text-sm font-semibold">关联单选题</label>
        <select id={controls.videoPilotActivityId} className={controlClass} value={draft.cue?.activityId ?? ""} disabled={disabled}
          aria-invalid={Boolean(state.fieldErrors?.videoPilotActivityId?.length || invalidActivity) || undefined}
          aria-describedby={[describedBy("videoPilotActivityId"), invalidActivity ? `${prefix}-unavailable` : ""].filter(Boolean).join(" ") || undefined}
          onChange={(event) => change({ ...draft, cue: { id: "pause-1", atSeconds: draft.cue?.atSeconds ?? null, activityId: event.target.value || null } })}>
          <option value="">暂不选择</option>{invalidActivity && <option value={draft.cue!.activityId!}>原关联题目已不可用</option>}
          {eligibleActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.prompt["zh-CN"] || activity.key}</option>)}
        </select>{invalidActivity && <p id={`${prefix}-unavailable`} className="text-sm text-[var(--status-danger)]">原关联单选题已不可用，请重新选择。</p>}{fieldError("videoPilotActivityId")}
      </div>
    </section>
    <div className="flex flex-wrap items-center gap-3">
      {editable && <button type="submit" disabled={pending || inspecting} className={buttonClass}>{pending ? "正在保存…" : "保存视频草稿"}</button>}
      {onCancel && <button type="button" disabled={pending || inspecting} className={buttonClass} onClick={() => { onDirtyChange(false); onCancel(); }}>取消启用</button>}
      <p role="status" aria-live="polite" className="text-sm">{state.status === "success" ? state.message : dirty ? "草稿尚未保存。" : "当前为已保存草稿。"}</p>
    </div>
  </form>;
}
