import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, MessageCircleQuestion } from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { getHelpCenterAccess } from "@/lib/help-center";
import { confirmHelpTicketResolvedAction } from "../../actions";
import { HelpTicketReplyForm } from "../../HelpTicketReplyForm";
import {
  HELP_DATE_TIME_OPTIONS,
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  type HelpTicketCategory,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "../../config";

type Ticket = { id: string; subject: string; description: string; category: HelpTicketCategory; priority: HelpTicketPriority; status: HelpTicketStatus; resolution: string; created_at: string; updated_at: string };
type Message = { id: string; sender_kind: "student" | "staff"; body: string; created_at: string };

function statusTone(status: HelpTicketStatus) {
  if (status === "open") return "bg-rose-50 text-rose-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  if (status === "waiting_student") return "bg-amber-50 text-amber-700";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700";
  return "bg-zinc-100 text-zinc-600";
}

export default async function StudentHelpTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { supabase, user, role } = await getHelpCenterAccess();
  if (role !== "student") notFound();
  const [ticketResult, messagesResult] = await Promise.all([
    supabase.from("help_tickets").select("id,subject,description,category,priority,status,resolution,created_at,updated_at").eq("id", ticketId).eq("user_id", user.id).maybeSingle(),
    supabase.from("help_ticket_messages").select("id,sender_kind,body,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
  ]);
  if (ticketResult.error) throw ticketResult.error;
  if (!ticketResult.data) notFound();
  const ticket = ticketResult.data as Ticket;
  const messages = (messagesResult.data ?? []) as Message[];
  const hasMessageError = Boolean(messagesResult.error);
  const canConfirm = ticket.status === "waiting_student" || ticket.status === "resolved";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/help" className="inline-flex items-center gap-2 text-xs font-bold app-muted-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2">
        <ArrowLeft size={14} aria-hidden="true" />返回帮助中心
      </Link>
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{HELP_TICKET_CATEGORY_LABELS[ticket.category]}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(ticket.status)}`}><span className="sr-only">状态：</span>{HELP_TICKET_STATUS_LABELS[ticket.status]}</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ticket.priority === "urgent" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}><span className="sr-only">优先级：</span>{HELP_TICKET_PRIORITY_LABELS[ticket.priority]}</span></div>
        <h2 className="mt-3 text-2xl font-bold">{ticket.subject}</h2>
        <p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p>
        <p className="app-muted-text mt-4 inline-flex items-center gap-1 text-xs"><Clock3 size={11} aria-hidden="true" />提交于 <LocalDateTime value={ticket.created_at} options={HELP_DATE_TIME_OPTIONS} /></p>
        {ticket.resolution && <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}><h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: "var(--status-success)" }}><CheckCircle2 size={16} aria-hidden="true" />处理结果</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{ticket.resolution}</p></div>}
        {canConfirm && <form action={confirmHelpTicketResolvedAction.bind(null, ticket.id)} className="mt-4"><button type="submit" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]" style={{ backgroundColor: "var(--status-success)" }}><CheckCircle2 size={14} aria-hidden="true" />确认问题已解决</button></form>}
      </section>
      <section className="app-card rounded-3xl border p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold"><MessageCircleQuestion size={19} style={{ color: "var(--primary)" }} aria-hidden="true" />沟通记录</h2>
        <div className="mt-5 space-y-3">{hasMessageError ? <p className="rounded-xl border border-dashed p-5 text-center text-xs" style={{ color: "var(--status-warning)", borderColor: "var(--status-warning)" }}>沟通记录暂时无法读取，请稍后刷新页面重试。</p> : <>{messages.map((message) => <div key={message.id} className={`flex ${message.sender_kind === "student" ? "justify-end" : "justify-start"}`}><div className="max-w-[85%] rounded-2xl border px-4 py-3" style={{ backgroundColor: message.sender_kind === "student" ? "var(--accent)" : "var(--status-success-surface)", borderColor: "var(--border-subtle)" }}><p className="text-xs font-bold" style={{ color: message.sender_kind === "student" ? "var(--primary)" : "var(--status-success)" }}>{message.sender_kind === "student" ? "我" : "老师"}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className="app-muted-text mt-2 text-[10px]"><LocalDateTime value={message.created_at} options={HELP_DATE_TIME_OPTIONS} /></p></div></div>)}{messages.length === 0 && <p className="app-muted-text rounded-xl border border-dashed p-5 text-center text-xs">老师暂未回复，可以继续补充问题信息。</p>}</>}</div>
        <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}><HelpTicketReplyForm ticketId={ticket.id} disabled={ticket.status === "closed"} /></div>
      </section>
    </div>
  );
}
