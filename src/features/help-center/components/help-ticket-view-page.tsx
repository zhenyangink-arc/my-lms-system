import Link from "next/link";
import { notFound } from "next/navigation";

import {
  HELP_DATE_TIME_OPTIONS,
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
} from "@/app/dashboard/help/config";
import { HelpTicketReplyForm } from "@/app/dashboard/help/HelpTicketReplyForm";
import { HelpTicketManager } from "@/app/dashboard/admin/help/HelpTicketManager";
import { LocalDateTime } from "@/components/LocalDateTime";
import { getHelpTicketDetailData } from "../api/tickets-service";

export default async function HelpTicketViewPage({ ticketId }: { ticketId: string }) {
  const result = await getHelpTicketDetailData(ticketId);
  if (!result) notFound();
  const { ticket } = result;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/admin/help"
          className="text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-text)]"
        >
          ← 返回帮助中心管理
        </Link>
        <span className="font-mono text-[10px] text-[var(--app-muted)]">
          工单 {ticket.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <section className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <div className="grid min-w-[920px] grid-cols-[160px_minmax(220px,1.2fr)_140px_140px_160px] border-b border-[var(--app-border)] bg-[var(--app-soft-bg)] text-xs font-semibold text-[var(--app-text-soft)]">
          <HeaderCell>学生</HeaderCell>
          <HeaderCell>问题</HeaderCell>
          <HeaderCell>分类</HeaderCell>
          <HeaderCell>优先级</HeaderCell>
          <HeaderCell>状态</HeaderCell>
        </div>
        <div className="grid min-w-[920px] grid-cols-[160px_minmax(220px,1.2fr)_140px_140px_160px] text-xs text-[var(--app-text-soft)]">
          <DataCell>{displayName(result.student)}</DataCell>
          <DataCell strong>{ticket.subject}</DataCell>
          <DataCell>{HELP_TICKET_CATEGORY_LABELS[ticket.category]}</DataCell>
          <DataCell>{HELP_TICKET_PRIORITY_LABELS[ticket.priority]}</DataCell>
          <DataCell>{HELP_TICKET_STATUS_LABELS[ticket.status]}</DataCell>
        </div>
      </section>

      <section className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <div className="border-b border-[var(--app-border)] px-4 py-3 text-sm font-semibold text-[var(--app-text)]">
          处理设置
        </div>
        <div className="p-4">
          <HelpTicketManager
            ticketId={ticket.id}
            status={ticket.status}
            priority={ticket.priority}
            resolution={ticket.resolution}
            canAssign={result.canAssignTickets}
            assignedTo={ticket.assigned_to}
            teachers={result.teachers}
          />
        </div>
      </section>

      <section className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <div className="border-b border-[var(--app-border)] px-4 py-3 text-sm font-semibold text-[var(--app-text)]">
          学生问题
        </div>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border-b border-[var(--app-border)] p-4 lg:border-r lg:border-b-0">
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--app-text-soft)]">
              {ticket.description}
            </p>
          </div>
          <dl className="divide-y divide-[var(--app-border)] text-xs">
            <MetaRow label="提交时间">
              <LocalDateTime value={ticket.created_at} options={HELP_DATE_TIME_OPTIONS} />
            </MetaRow>
            <MetaRow label="最近更新">
              <LocalDateTime value={ticket.updated_at} options={HELP_DATE_TIME_OPTIONS} />
            </MetaRow>
          </dl>
        </div>
        {ticket.resolution && (
          <div className="border-t border-[var(--app-border)] bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700">当前处理结果</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
              {ticket.resolution}
            </p>
          </div>
        )}
        <div className="border-t border-[var(--app-border)] p-4">
          <HelpTicketReplyForm
            ticketId={ticket.id}
            staff
            disabled={ticket.status === "closed"}
          />
        </div>
      </section>

      <section className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <div className="border-b border-[var(--app-border)] px-4 py-3 text-sm font-semibold text-[var(--app-text)]">
          消息记录
        </div>
        {result.hasMessageError ? (
          <p className="px-4 py-8 text-center text-sm text-amber-700">
            消息记录暂时无法完整读取，请稍后刷新。
          </p>
        ) : result.messages.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--app-muted)]">
            还没有追加消息
          </p>
        ) : (
          <div className="divide-y divide-[var(--app-border)]">
            {result.messages.map((message) => (
              <div
                key={message.id}
                className="grid gap-2 px-4 py-4 text-xs md:grid-cols-[120px_minmax(0,1fr)_170px]"
              >
                <span className="font-semibold text-[var(--app-text-soft)]">
                  {message.sender_kind === "staff" ? "教师 / 机构" : "学生"}
                </span>
                <p className="whitespace-pre-wrap leading-6 text-[var(--app-text)]">
                  {message.body}
                </p>
                <span className="text-[var(--app-muted)] md:text-right">
                  <LocalDateTime value={message.created_at} options={HELP_DATE_TIME_OPTIONS} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function displayName(profile: { full_name: string | null; email: string | null } | null) {
  return profile?.full_name?.trim() || profile?.email?.trim() || "学生";
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3">{children}</div>;
}

function DataCell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`px-4 py-4 ${strong ? "font-semibold text-[var(--app-text)]" : ""}`}>
      {children}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 px-4 py-3">
      <dt className="font-semibold text-[var(--app-muted)]">{label}</dt>
      <dd className="text-[var(--app-text-soft)]">{children}</dd>
    </div>
  );
}
