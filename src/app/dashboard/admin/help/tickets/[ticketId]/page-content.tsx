import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MessageCircleQuestion, UserRound } from "lucide-react";

import { HelpTicketReplyForm } from "@/app/dashboard/help/HelpTicketReplyForm";
import {
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  helpDateFormatter,
  type HelpTicketCategory,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "@/app/dashboard/help/config";
import { requireHelpTicketHandler } from "@/lib/help-center";
import { createAdminClient } from "@/lib/supabase/admin";
import { HelpTicketManager, type HelpTicketTeacher } from "../../HelpTicketManager";

type Ticket = {
  id: string;
  user_id: string;
  assigned_to: string | null;
  subject: string;
  description: string;
  category: HelpTicketCategory;
  priority: HelpTicketPriority;
  status: HelpTicketStatus;
  resolution: string;
  created_at: string;
  updated_at: string;
};

type Message = { id: string; sender_kind: "student" | "staff"; body: string; created_at: string };
type Profile = { id: string; full_name: string | null; email: string | null };
type Membership = { user_id: string };

function statusTone(status: HelpTicketStatus) {
  if (status === "open") return "bg-rose-50 text-rose-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  if (status === "waiting_student") return "bg-amber-50 text-amber-700";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700";
  return "bg-zinc-100 text-zinc-600";
}

export default async function AdminHelpTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const access = await requireHelpTicketHandler();
  const [ticketResult, messagesResult] = await Promise.all([
    access.supabase.from("help_tickets").select("id,user_id,assigned_to,subject,description,category,priority,status,resolution,created_at,updated_at").eq("id", ticketId).eq("tenant_id", access.tenantId).maybeSingle(),
    access.supabase.from("help_ticket_messages").select("id,sender_kind,body,created_at").eq("ticket_id", ticketId).eq("tenant_id", access.tenantId).order("created_at", { ascending: true }),
  ]);
  if (ticketResult.error || !ticketResult.data) notFound();

  const ticket = ticketResult.data as Ticket;
  const messages = (messagesResult.data ?? []) as Message[];
  const admin = createAdminClient();
  const [studentResult, teacherMembershipResult] = await Promise.all([
    admin.from("profiles").select("id,full_name,email").eq("id", ticket.user_id).maybeSingle(),
    access.canAssignTickets
      ? admin.from("tenant_memberships").select("user_id").eq("tenant_id", access.tenantId).eq("role", "teacher").eq("status", "active")
      : Promise.resolve({ data: [] as Membership[], error: null }),
  ]);
  const student = studentResult.data as Profile | null;
  const teacherIds = ((teacherMembershipResult.data ?? []) as Membership[]).map((membership) => membership.user_id);
  const teacherProfileResult = teacherIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", teacherIds)
    : { data: [] as Profile[], error: null };
  const teachers: HelpTicketTeacher[] = ((teacherProfileResult.data ?? []) as Profile[]).map((profile) => ({
    id: profile.id,
    name: profile.full_name?.trim() || profile.email?.trim() || "未填写姓名",
  })).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return (
    <div className="mx-auto w-full max-w-[1620px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/admin/help" className="inline-flex items-center gap-2 text-[10px] font-medium text-zinc-500 hover:text-zinc-950"><ArrowLeft size={13} />返回帮助中心管理</Link>
      <section className="border-y border-black/[0.08] bg-white">
        <header className="border-b border-black/[0.08] px-5 py-5">
          <div className="flex flex-wrap items-center gap-2"><span className="bg-sky-50 px-2 py-1 text-[9px] font-medium text-sky-700">{HELP_TICKET_CATEGORY_LABELS[ticket.category]}</span><span className={`px-2 py-1 text-[9px] font-medium ${statusTone(ticket.status)}`}>{HELP_TICKET_STATUS_LABELS[ticket.status]}</span><span className={`px-2 py-1 text-[9px] font-medium ${ticket.priority === "urgent" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>{HELP_TICKET_PRIORITY_LABELS[ticket.priority]}</span></div>
          <h1 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-zinc-950">{ticket.subject}</h1>
          <div className="mt-3 flex flex-wrap gap-5 text-[10px] text-zinc-500"><span className="inline-flex items-center gap-1.5"><UserRound size={12} />{student?.full_name?.trim() || student?.email || "学生"}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={12} />提交于 {helpDateFormatter.format(new Date(ticket.created_at))}</span><span className="font-mono">工单 {ticket.id.slice(0, 8).toUpperCase()}</span></div>
        </header>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-b border-black/[0.08] px-5 py-5 lg:border-b-0 lg:border-r"><p className="text-[8px] uppercase tracking-[0.08em] text-zinc-400">学生问题</p><p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-zinc-700">{ticket.description}</p>{ticket.resolution && <div className="mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-[9px] font-medium text-emerald-700">当前处理结果</p><p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-emerald-800">{ticket.resolution}</p></div>}</div>
          <aside className="px-4 py-4"><p className="mb-3 text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-400">处理设置</p><HelpTicketManager ticketId={ticket.id} status={ticket.status} priority={ticket.priority} resolution={ticket.resolution} canAssign={access.canAssignTickets} assignedTo={ticket.assigned_to} teachers={teachers} /></aside>
        </div>
      </section>

      <section className="border-y border-black/[0.08] bg-white">
        <header className="flex items-center gap-2 border-b border-black/[0.08] px-5 py-4"><MessageCircleQuestion size={15} className="text-zinc-500" /><div><h2 className="text-sm font-semibold text-zinc-950">沟通记录</h2><p className="mt-0.5 text-[9px] text-zinc-400">教师回复后，学生端会立即显示。</p></div></header>
        <div className="divide-y divide-black/[0.07]">
          {messages.map((message) => <div key={message.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[100px_minmax(0,1fr)_130px]"><span className={`text-[9px] font-medium ${message.sender_kind === "staff" ? "text-emerald-700" : "text-sky-700"}`}>{message.sender_kind === "staff" ? "教师 / 机构" : "学生"}</span><p className="whitespace-pre-wrap text-[11px] leading-5 text-zinc-700">{message.body}</p><time className="font-mono text-[9px] text-zinc-400 sm:text-right">{helpDateFormatter.format(new Date(message.created_at))}</time></div>)}
          {messages.length === 0 && <p className="px-5 py-10 text-center text-[10px] text-zinc-400">还没有追加消息</p>}
        </div>
        <div className="border-t border-black/[0.08] px-5 py-4"><HelpTicketReplyForm ticketId={ticket.id} staff disabled={ticket.status === "closed"} /></div>
      </section>
    </div>
  );
}
