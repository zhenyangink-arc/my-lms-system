import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, MessageCircleQuestion } from "lucide-react";

import { getHelpCenterAccess } from "@/lib/help-center";
import { HelpTicketReplyForm } from "../../HelpTicketReplyForm";
import { HELP_TICKET_CATEGORY_LABELS, HELP_TICKET_STATUS_LABELS, helpDateFormatter, type HelpTicketCategory, type HelpTicketPriority, type HelpTicketStatus } from "../../config";

type Ticket = { id: string; subject: string; description: string; category: HelpTicketCategory; priority: HelpTicketPriority; status: HelpTicketStatus; resolution: string; created_at: string; updated_at: string };
type Message = { id: string; sender_kind: "student" | "staff"; body: string; created_at: string };

export default async function StudentHelpTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { supabase, user, role } = await getHelpCenterAccess();
  if (role !== "student") notFound();
  const [ticketResult, messagesResult] = await Promise.all([
    supabase.from("help_tickets").select("id,subject,description,category,priority,status,resolution,created_at,updated_at").eq("id", ticketId).eq("user_id", user.id).maybeSingle(),
    supabase.from("help_ticket_messages").select("id,sender_kind,body,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
  ]);
  if (ticketResult.error || !ticketResult.data) notFound();
  const ticket = ticketResult.data as Ticket;
  const messages = (messagesResult.data ?? []) as Message[];
  const solved = ticket.status === "resolved" || ticket.status === "closed";
  return <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8"><Link href="/dashboard/help" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回帮助中心</Link><section className="app-card rounded-3xl border p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{HELP_TICKET_CATEGORY_LABELS[ticket.category]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: solved ? "var(--app-success)" : "var(--app-warm)", backgroundColor: solved ? "var(--app-success-soft)" : "var(--app-warm-soft)" }}>{HELP_TICKET_STATUS_LABELS[ticket.status]}</span>{ticket.priority === "urgent" && <span className="text-xs font-black" style={{ color: "#c94f45" }}>紧急</span>}</div><h1 className="mt-3 text-2xl font-black">{ticket.subject}</h1><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{ticket.description}</p><p className="app-muted-text mt-4 inline-flex items-center gap-1 text-xs"><Clock3 size={11} />提交于 {helpDateFormatter.format(new Date(ticket.created_at))}</p>{ticket.resolution && <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><h2 className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--app-success)" }}><CheckCircle2 size={16} />最终处理结果</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{ticket.resolution}</p></div>}</section><section className="app-card rounded-3xl border p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-black"><MessageCircleQuestion size={19} style={{ color: "var(--app-accent)" }} />沟通记录</h2><div className="mt-5 space-y-3">{messages.map((message) => <div key={message.id} className={`flex ${message.sender_kind === "student" ? "justify-end" : "justify-start"}`}><div className="max-w-[85%] rounded-2xl px-4 py-3" style={{ backgroundColor: message.sender_kind === "student" ? "var(--app-accent-soft)" : "var(--app-soft-bg)", border: "1px solid var(--app-border-soft)" }}><p className="text-xs font-black" style={{ color: message.sender_kind === "student" ? "var(--app-accent)" : "var(--app-success)" }}>{message.sender_kind === "student" ? "我" : "帮助中心"}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className="app-muted-text mt-2 text-[10px]">{helpDateFormatter.format(new Date(message.created_at))}</p></div></div>)}{messages.length === 0 && <p className="app-muted-text rounded-xl border border-dashed p-5 text-center text-xs">后台暂未回复，可以继续补充问题信息。</p>}</div><div className="mt-6 border-t pt-5" style={{ borderColor: "var(--app-border-soft)" }}><HelpTicketReplyForm ticketId={ticket.id} disabled={ticket.status === "closed"} /></div></section></div>;
}
