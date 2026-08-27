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
import {
  ManagementMetricStrip,
  ManagementPage,
} from "@/components/layout/management-page";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { getHelpTicketDetailData } from "../api/tickets-service";

export default async function HelpTicketViewPage({ ticketId }: { ticketId: string }) {
  const result = await getHelpTicketDetailData(ticketId);
  if (!result) notFound();
  const { ticket } = result;

  return (
    <ManagementPage
      title={ticket.subject}
      description="查看学生问题、调整处理状态、回复消息并保留完整服务记录。"
      meta={<span>工单 {ticket.id.slice(0, 8).toUpperCase()}</span>}
      action={
        <Link
          href={scopeDashboardPath(
            "/dashboard/admin/help",
            result.dashboardBasePath,
          )}
          className="management-secondary-button inline-flex items-center border px-3 text-xs font-semibold"
        >
          返回帮助中心
        </Link>
      }
    >

      <ManagementMetricStrip
        label="工单概况"
        items={[
          { label: "学生", value: displayName(result.student) },
          {
            label: "问题",
            value: <span title={ticket.subject}>{ticket.subject}</span>,
          },
          {
            label: "分类",
            value: HELP_TICKET_CATEGORY_LABELS[ticket.category],
          },
          {
            label: "优先级",
            value: HELP_TICKET_PRIORITY_LABELS[ticket.priority],
          },
          { label: "状态", value: HELP_TICKET_STATUS_LABELS[ticket.status] },
        ]}
      />

      <section className="overflow-hidden border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
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

      <section className="overflow-hidden border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
          学生问题
        </div>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border-b border-[var(--border)] p-4 lg:border-r lg:border-b-0">
            <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--foreground-secondary)]">
              {ticket.description}
            </p>
          </div>
          <dl className="divide-y divide-[var(--border)] text-xs">
            <MetaRow label="提交时间">
              <LocalDateTime value={ticket.created_at} options={HELP_DATE_TIME_OPTIONS} />
            </MetaRow>
            <MetaRow label="最近更新">
              <LocalDateTime value={ticket.updated_at} options={HELP_DATE_TIME_OPTIONS} />
            </MetaRow>
          </dl>
        </div>
        {ticket.resolution && (
          <div className="border-t border-[var(--border)] bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700">当前处理结果</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-900">
              {ticket.resolution}
            </p>
          </div>
        )}
        <div className="border-t border-[var(--border)] p-4">
          <HelpTicketReplyForm
            ticketId={ticket.id}
            staff
            disabled={ticket.status === "closed"}
          />
        </div>
      </section>

      <section className="overflow-hidden border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
          消息记录
        </div>
        {result.hasMessageError ? (
          <p className="px-4 py-8 text-center text-sm text-amber-700">
            消息记录暂时无法完整读取，请稍后刷新。
          </p>
        ) : result.messages.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--foreground-muted)]">
            还没有追加消息
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {result.messages.map((message) => (
              <div
                key={message.id}
                className="grid gap-2 px-4 py-4 text-xs md:grid-cols-[120px_minmax(0,1fr)_170px]"
              >
                <span className="font-semibold text-[var(--foreground-secondary)]">
                  {message.sender_kind === "staff" ? "教师 / 机构" : "学生"}
                </span>
                <p className="whitespace-pre-wrap leading-6 text-[var(--foreground)]">
                  {message.body}
                </p>
                <span className="text-[var(--foreground-muted)] md:text-right">
                  <LocalDateTime value={message.created_at} options={HELP_DATE_TIME_OPTIONS} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </ManagementPage>
  );
}

function displayName(profile: { full_name: string | null; email: string | null } | null) {
  return profile?.full_name?.trim() || profile?.email?.trim() || "学生";
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 px-4 py-3">
      <dt className="font-semibold text-[var(--foreground-muted)]">{label}</dt>
      <dd className="text-[var(--foreground-secondary)]">{children}</dd>
    </div>
  );
}
