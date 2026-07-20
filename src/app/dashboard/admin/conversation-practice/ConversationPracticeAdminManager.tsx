"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldOff, UserPlus } from "lucide-react";

import { initialConversationPracticeActionState } from "@/app/dashboard/conversation-practice/action-state";
import { grantConversationPracticeAdminAction, revokeConversationPracticeAdminAction } from "@/app/dashboard/conversation-practice/actions";

type AdminOption = { id: string; name: string; email: string; assigned: boolean };

function RevokeButton({ adminId }: { adminId: string }) {
  const action = revokeConversationPracticeAdminAction.bind(null, adminId);
  const [state, formAction, pending] = useActionState(action, initialConversationPracticeActionState);
  return <form action={formAction}><button type="submit" disabled={pending} title={state.message || undefined} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-black disabled:opacity-50" style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}><ShieldOff size={11} />{pending ? "处理中" : "撤销"}</button></form>;
}

export function ConversationPracticeAdminManager({ admins }: { admins: AdminOption[] }) {
  const [state, formAction, pending] = useActionState(grantConversationPracticeAdminAction, initialConversationPracticeActionState);
  const available = admins.filter((admin) => !admin.assigned);

  return (
    <section className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><ShieldCheck size={20} /></span><div><h2 className="text-lg font-black">指定后台管理员</h2><p className="app-muted-text mt-1 text-xs leading-5">负责人可单独授予或撤销普通管理员的编辑权限；CEO 无需单独授权。</p></div></div>
      <form action={formAction} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <select name="admin_id" required defaultValue="" className="app-input min-w-0 flex-1 rounded-xl border px-3 py-3 text-xs font-bold"><option value="" disabled>选择普通管理员</option>{available.map((admin) => <option key={admin.id} value={admin.id}>{admin.name} · {admin.email}</option>)}</select>
        <button type="submit" disabled={pending || available.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-success)" }}><UserPlus size={14} />{pending ? "正在授权…" : "授予权限"}</button>
      </form>
      {state.message && <p className="mt-3 rounded-xl px-3 py-2.5 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}
      <div className="mt-5 space-y-2">{admins.filter((admin) => admin.assigned).map((admin) => <div key={admin.id} className="app-soft-card flex items-center gap-3 rounded-xl border px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><ShieldCheck size={14} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{admin.name}</p><p className="app-muted-text truncate text-xs">{admin.email}</p></div><RevokeButton adminId={admin.id} /></div>)}{admins.every((admin) => !admin.assigned) && <p className="app-muted-text rounded-xl border border-dashed p-4 text-center text-xs">还没有单独指定普通管理员。</p>}</div>
    </section>
  );
}
