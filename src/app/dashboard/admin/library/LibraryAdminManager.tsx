"use client";

import { useActionState } from "react";
import { ShieldCheck, ShieldOff, UserPlus } from "lucide-react";

import { initialLibraryActionState } from "@/app/dashboard/library/action-state";
import {
  grantLibraryAdminAction,
  revokeLibraryAdminAction,
} from "@/app/dashboard/library/actions";

type Admin = {
  id: string;
  name: string;
  email: string;
  assigned: boolean;
};

function RevokeButton({ id }: { id: string }) {
  const action = revokeLibraryAdminAction.bind(null, id);
  const [state, formAction, pending] = useActionState(
    action,
    initialLibraryActionState
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        title={state.message || undefined}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black disabled:opacity-50"
        style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}
      >
        <ShieldOff size={11} />
        {pending ? "撤销中" : "撤销"}
      </button>
    </form>
  );
}

export function LibraryAdminManager({ admins }: { admins: Admin[] }) {
  const [state, formAction, pending] = useActionState(
    grantLibraryAdminAction,
    initialLibraryActionState
  );
  const available = admins.filter((item) => !item.assigned);
  const assigned = admins.filter((item) => item.assigned);

  return (
    <section className="app-card rounded-[28px] border p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            color: "var(--app-success)",
            backgroundColor: "var(--app-success-soft)",
          }}
        >
          <ShieldCheck size={19} />
        </span>
        <div>
          <h2 className="text-lg font-black">资料库管理员授权</h2>
          <p className="app-muted-text mt-1 text-xs leading-6">
            只有负责人可以指定普通管理员，CEO 自动拥有资料库后台权限。
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <select
          name="admin_id"
          required
          defaultValue=""
          className="app-input min-w-0 flex-1 rounded-xl border px-3 py-3 text-xs"
        >
          <option value="" disabled>
            选择普通管理员
          </option>
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.email}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || available.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-success)" }}
        >
          <UserPlus size={14} />
          {pending ? "授权中" : "授权"}
        </button>
      </form>

      {state.message && (
        <p
          className="mt-2 text-xs font-bold"
          style={{
            color:
              state.status === "error" ? "#c94f45" : "var(--app-success)",
          }}
        >
          {state.message}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {assigned.map((item) => (
          <div
            key={item.id}
            className="app-soft-card flex items-center gap-3 rounded-xl border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black">{item.name}</p>
              <p className="app-muted-text truncate text-[10px]">{item.email}</p>
            </div>
            <RevokeButton id={item.id} />
          </div>
        ))}
        {assigned.length === 0 && (
          <p className="app-muted-text rounded-xl border border-dashed p-4 text-center text-xs">
            暂未指定普通管理员。
          </p>
        )}
      </div>
    </section>
  );
}
