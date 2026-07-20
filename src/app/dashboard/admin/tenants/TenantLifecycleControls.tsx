"use client";

import { useActionState, useState } from "react";
import { Archive, KeyRound, RotateCcw, Trash2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteTenantPermanentlyAction, resetTenantManagerPasswordAction, setTenantStatusAction } from "./actions";
import { initialTenantActionState } from "./action-state";

type Manager = { id: string; loginId: string; name: string };

function Message({ message, status }: { message: string; status: "idle" | "success" | "error" }) {
  return message ? <p aria-live="polite" className="mt-2 text-xs font-bold" style={{ color: status === "error" ? "#c94f45" : "var(--app-success)" }}>{message}</p> : null;
}

function DisableTenantDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const action = setTenantStatusAction.bind(null, tenantId, "suspended");
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<button type="button" className="app-soft-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black"><Archive size={13} />停用租户</button>} /><DialogContent><DialogHeader><DialogTitle>确认停用租户？</DialogTitle><DialogDescription>停用后，该租户及其管理员将不能继续使用系统；成员和数据会保留，负责人可以随时恢复。</DialogDescription></DialogHeader><form action={formAction}><DialogFooter><button type="button" onClick={() => setOpen(false)} className="app-soft-card rounded-lg border px-3 py-2 text-xs font-black">取消</button><button disabled={pending} className="rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-warm)" }}>{pending ? "停用中…" : "确认停用"}</button></DialogFooter><Message {...state} /></form></DialogContent></Dialog>;
}

function RestoreButton({ tenantId }: { tenantId: string }) {
  const action = setTenantStatusAction.bind(null, tenantId, "active");
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);
  return <form action={formAction}><button disabled={pending} className="app-soft-card inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-50"><RotateCcw size={13} />{pending ? "恢复中…" : "恢复租户"}</button><Message {...state} /></form>;
}

function PasswordReset({ tenantId, manager }: { tenantId: string; manager: Manager }) {
  const action = resetTenantManagerPasswordAction.bind(null, tenantId, manager.id);
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);
  return <details className="app-soft-card rounded-xl border p-3"><summary className="cursor-pointer list-none text-xs font-black"><span className="inline-flex items-center gap-1.5"><KeyRound size={13} />重置 {manager.loginId} 的密码</span></summary><form action={formAction} className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--app-border-soft)" }}><input name="new_password" required type="password" minLength={8} maxLength={72} autoComplete="new-password" placeholder="新密码：至少 8 位，含字母和数字" className="app-input w-full rounded-lg border px-3 py-2 text-xs" /><button disabled={pending} className="rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-secondary)" }}>{pending ? "更新中…" : "更新密码"}</button><Message {...state} /></form></details>;
}

function PermanentDeleteDialog({ tenantId, slug }: { tenantId: string; slug: string }) {
  const [open, setOpen] = useState(false);
  const action = deleteTenantPermanentlyAction.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, initialTenantActionState);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black text-white" style={{ backgroundColor: "#c94f45" }}><Trash2 size={13} />删除租户</button>} /><DialogContent><DialogHeader><DialogTitle>确认永久删除租户？</DialogTitle><DialogDescription>此操作不可恢复，会删除租户、成员关系和仅属于该租户的初始管理员账号。请输入租户标识 <b>{slug}</b> 确认。</DialogDescription></DialogHeader><form action={formAction} className="space-y-3"><input name="confirmation" required autoCapitalize="none" placeholder={slug} className="app-input w-full rounded-lg border px-3 py-2 text-xs" /><DialogFooter><button type="button" onClick={() => setOpen(false)} className="app-soft-card rounded-lg border px-3 py-2 text-xs font-black">取消</button><button disabled={pending} className="rounded-lg px-3 py-2 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "#c94f45" }}>{pending ? "删除中…" : "确认永久删除"}</button></DialogFooter><Message {...state} /></form></DialogContent></Dialog>;
}

export function TenantLifecycleControls({ tenantId, slug, status, managers }: { tenantId: string; slug: string; status: "active" | "suspended" | "archived"; managers: Manager[] }) {
  const disabled = status === "suspended" || status === "archived";
  return <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}><div className="flex flex-wrap gap-2">{status === "active" && <DisableTenantDialog tenantId={tenantId} />}{disabled && <RestoreButton tenantId={tenantId} />}{disabled && <PermanentDeleteDialog tenantId={tenantId} slug={slug} />}</div>{managers.map((manager) => <PasswordReset key={manager.id} tenantId={tenantId} manager={manager} />)}</div>;
}
