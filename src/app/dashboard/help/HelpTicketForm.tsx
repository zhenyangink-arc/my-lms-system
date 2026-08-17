"use client";

import { useActionState } from "react";
import { Send, SendHorizontal } from "lucide-react";

import { initialHelpCenterActionState } from "./action-state";
import { createHelpTicketAction } from "./actions";
import { HELP_TICKET_CATEGORY_LABELS, HELP_TICKET_PRIORITY_LABELS } from "./config";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

export function HelpTicketForm() {
  const [state, formAction, pending] = useActionState(createHelpTicketAction, initialHelpCenterActionState);
  return <section className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}><SendHorizontal size={19} /></span><div><DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-bold" title={<>没有找到答案？提交求助</>} description={<>描述越具体，后台越容易快速定位问题。</>} /></div></div><form action={formAction} className="mt-5 space-y-4"><label className="block text-xs font-bold">问题标题<input name="subject" required minLength={2} maxLength={120} placeholder="用一句话说明遇到的问题" className="app-input mt-2 w-full rounded-xl border px-4 py-3 text-sm" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">问题分类<select name="category" defaultValue="other" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm">{Object.entries(HELP_TICKET_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-bold">紧急程度<select name="priority" defaultValue="normal" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm">{Object.entries(HELP_TICKET_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label className="block text-xs font-bold">问题描述<textarea name="description" required minLength={2} maxLength={5000} rows={6} placeholder="请写明操作步骤、看到的提示、发生时间等信息。请不要填写密码。" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" /></label>{state.message && <p className="rounded-xl px-4 py-3 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--status-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--status-success-surface)" }}>{state.message}</p>}<button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: "var(--status-success)" }}><Send size={15} />{pending ? "正在提交…" : "提交求助"}</button></form></section>;
}
