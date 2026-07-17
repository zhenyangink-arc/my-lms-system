"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldMinus, UserPlus } from "lucide-react";

import { grantAnnouncementAdminAction, revokeAnnouncementAdminAction } from "./actions";
import { initialAnnouncementActionState } from "./action-state";

type AdminOption = {
  id: string;
  name: string;
  email: string;
  assigned: boolean;
};

function RevokeButton({ adminId }: { adminId: string }) {
  const action = revokeAnnouncementAdminAction.bind(null, adminId);
  const [state, formAction, pending] = useActionState(action, initialAnnouncementActionState);
  return (
    <form action={formAction} className="text-right">
      <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50" style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}>
        <ShieldMinus size={13} aria-hidden="true" /> {pending ? "撤销中…" : "撤销权限"}
      </button>
      {state.message && <p className="mt-1 text-[10px] font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}
    </form>
  );
}

export function AnnouncementAdminManager({ admins }: { admins: AdminOption[] }) {
  const [state, formAction, pending] = useActionState(grantAnnouncementAdminAction, initialAnnouncementActionState);
  const assigned = admins.filter((admin) => admin.assigned);
  const available = admins.filter((admin) => !admin.assigned);

  return (
    <section className="app-card rounded-[28px] border p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>
          <ShieldCheck size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black">公告管理员授权</h2>
          <p className="mt-1 text-xs leading-6 app-muted-text">只有负责人可以授予或撤销普通管理员的公告权限。</p>
        </div>
      </div>

      <form action={formAction} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <select name="admin_id" required defaultValue="" className="app-input min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm">
          <option value="" disabled>选择管理员账号</option>
          {available.map((admin) => <option key={admin.id} value={admin.id}>{admin.name} · {admin.email}</option>)}
        </select>
        <button type="submit" disabled={pending || available.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-success)" }}>
          <UserPlus size={15} aria-hidden="true" /> {pending ? "授权中…" : "授予权限"}
        </button>
      </form>
      {state.message && <p className="mt-3 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)" }}>{state.message}</p>}

      <div className="mt-5 space-y-2">
        {assigned.map((admin) => (
          <div key={admin.id} className="app-soft-card flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>{admin.name.slice(0, 1)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{admin.name}</p>
              <p className="mt-0.5 truncate text-xs app-muted-text">{admin.email}</p>
            </div>
            <RevokeButton adminId={admin.id} />
          </div>
        ))}
        {assigned.length === 0 && <p className="app-soft-card rounded-2xl border border-dashed p-5 text-center text-xs font-bold app-muted-text">暂未指定公告管理员。</p>}
      </div>
    </section>
  );
}
