"use client";

import { useActionState } from "react";
import { savePlatformAppSettings, type PlatformSettingState } from "./settings-actions";

export function PlatformSettingEditor({ appSlug, tenantId, name, enabled, status, customTitle, updatedAt }: { appSlug: string; tenantId: string; name: string; enabled: boolean; status: string; customTitle: string | null; updatedAt: string }) {
  const [state, action, pending] = useActionState(savePlatformAppSettings.bind(null, appSlug), { status: "idle" } as PlatformSettingState);
  return <details className="min-w-56"><summary className="inline-flex min-h-11 cursor-pointer items-center text-[var(--primary)] underline">调整应用设置</summary>
    <form action={action} className="space-y-3 border p-3" aria-label={`${name}应用设置`}>
      <input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="updated_at" value={updatedAt} />
      <label className="block text-sm">机构显示名称<input name="custom_title" maxLength={80} defaultValue={customTitle ?? ""} className="app-input mt-1 h-11 w-full border px-2" /></label>
      <label className="block text-sm">运行状态<select name="status" defaultValue={status} className="app-input mt-1 h-11 w-full border px-2"><option value="active">运行中</option><option value="coming_soon">建设中</option><option value="hidden">隐藏</option></select></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="is_enabled" defaultChecked={enabled} />允许机构使用此应用</label>
      <p className="app-muted-text text-xs">关闭后学生和普通员工无法使用，历史学习数据保留。</p>
      <button type="submit" disabled={pending} className="min-h-11 bg-[var(--primary)] px-3 text-sm text-white disabled:opacity-50">{pending ? "正在保存…" : "保存设置"}</button>
      {state.message && <p role={state.status === "error" ? "alert" : "status"} className="text-xs">{state.message}</p>}
    </form>
  </details>;
}
