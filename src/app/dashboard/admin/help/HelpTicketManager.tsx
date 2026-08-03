"use client";

import { useActionState } from "react";
import { Save, UserRoundCheck } from "lucide-react";

import { initialHelpCenterActionState } from "@/app/dashboard/help/action-state";
import { assignHelpTicketAction, updateHelpTicketAction } from "@/app/dashboard/help/actions";
import {
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "@/app/dashboard/help/config";

export type HelpTicketTeacher = { id: string; name: string };

function AssignmentForm({ ticketId, assignedTo, teachers }: { ticketId: string; assignedTo: string | null; teachers: HelpTicketTeacher[] }) {
  const action = assignHelpTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState);
  return (
    <form action={formAction} className="border border-black/[0.08]">
      <div className="grid border-b border-black/[0.07] sm:grid-cols-[130px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 text-[10px] font-medium text-zinc-500">负责老师</span><span className="p-2"><select name="teacher_id" defaultValue={assignedTo ?? ""} className="app-input w-full border px-3 py-2.5 text-xs"><option value="">待分配</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></span></div>
      <div className="flex items-center justify-between gap-3 px-3 py-2"><p className={`text-[9px] ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{state.message}</p><button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 text-[10px] font-medium text-white disabled:opacity-50"><UserRoundCheck size={12} />{pending ? "分配中…" : "保存分配"}</button></div>
    </form>
  );
}

export function HelpTicketManager({
  ticketId,
  status,
  priority,
  resolution,
  canAssign,
  assignedTo,
  teachers,
}: {
  ticketId: string;
  status: HelpTicketStatus;
  priority: HelpTicketPriority;
  resolution: string;
  canAssign: boolean;
  assignedTo: string | null;
  teachers: HelpTicketTeacher[];
}) {
  const action = updateHelpTicketAction.bind(null, ticketId);
  const [state, formAction, pending] = useActionState(action, initialHelpCenterActionState);
  return (
    <div className="space-y-3">
      {canAssign && <AssignmentForm ticketId={ticketId} assignedTo={assignedTo} teachers={teachers} />}
      <form action={formAction} className="border border-black/[0.08]">
        <div className="grid border-b border-black/[0.07] sm:grid-cols-2">
          <label className="grid border-b border-black/[0.07] sm:grid-cols-[110px_minmax(0,1fr)] sm:border-b-0 sm:border-r"><span className="bg-zinc-50/60 px-3 py-3 text-[10px] font-medium text-zinc-500">处理状态</span><span className="p-2"><select name="status" defaultValue={status} className="app-input w-full border px-3 py-2.5 text-xs">{Object.entries(HELP_TICKET_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
          <label className="grid sm:grid-cols-[110px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 text-[10px] font-medium text-zinc-500">紧急程度</span><span className="p-2"><select name="priority" defaultValue={priority} className="app-input w-full border px-3 py-2.5 text-xs">{Object.entries(HELP_TICKET_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>
        </div>
        <label className="grid border-b border-black/[0.07] sm:grid-cols-[110px_minmax(0,1fr)]"><span className="bg-zinc-50/60 px-3 py-3 text-[10px] font-medium text-zinc-500">处理结果</span><span className="p-2"><textarea name="resolution" maxLength={3000} rows={5} defaultValue={resolution} placeholder="完成处理后填写结果；学生端会同步显示。" className="app-input w-full resize-y border px-3 py-2.5 text-xs leading-5" /></span></label>
        <div className="flex items-center justify-between gap-3 px-3 py-2"><p className={`text-[9px] ${state.status === "error" ? "text-rose-700" : "text-emerald-700"}`}>{state.message}</p><button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-2 border border-emerald-700 bg-emerald-700 px-3 text-[10px] font-medium text-white disabled:opacity-50"><Save size={12} />{pending ? "保存中…" : "保存处理状态"}</button></div>
      </form>
    </div>
  );
}
