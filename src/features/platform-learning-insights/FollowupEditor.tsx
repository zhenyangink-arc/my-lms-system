"use client";
import { useActionState } from "react";
import { saveInstitutionFollowup, type FollowupState } from "./followup-actions";
export function FollowupEditor({ appSlug, tenant, topic, latestId, status }: { appSlug: string; tenant: string; topic: string; latestId: string; status: string }) {
  const [state, action, pending] = useActionState(saveInstitutionFollowup.bind(null, appSlug), { status: "idle" } as FollowupState);
  return <form action={action} className="space-y-3" aria-label="机构跟进">
    <input type="hidden" name="tenant" value={tenant} /><input type="hidden" name="topic" value={topic} /><input type="hidden" name="expected" value={latestId} />
    <label className="block text-sm">处理状态<select name="status" key={state.id ?? latestId} defaultValue={state.savedStatus ?? status} className="app-input ml-3 min-h-11 border px-3"><option value="pending">待处理</option><option value="in_progress">跟进中</option><option value="resolved">已复查关闭</option></select></label>
    <label className="block text-sm">处理说明<textarea name="note" required maxLength={2000} rows={3} placeholder="记录问题、已采取的措施或复查结果；关闭后也可以重新跟进。" className="app-input mt-2 w-full border p-3" /></label>
    <button disabled={pending} className="min-h-11 bg-[var(--primary)] px-4 text-sm text-white disabled:opacity-50">{pending ? "正在保存…" : "保存跟进"}</button>
    {state.message && <p role={state.status === "error" ? "alert" : "status"} className="text-sm">{state.message}</p>}
  </form>;
}
