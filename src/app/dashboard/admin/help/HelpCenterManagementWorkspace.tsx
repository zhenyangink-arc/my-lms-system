"use client";

import Link from "next/link";
import {
  BookOpenText,
  ChevronRight,
  CircleAlert,
  Clock3,
  Headphones,
  MessageSquareReply,
  PencilLine,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HELP_ARTICLE_CATEGORY_LABELS,
  HELP_ARTICLE_STATUS_LABELS,
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  type HelpArticleCategory,
  type HelpArticleStatus,
  type HelpTicketCategory,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "@/app/dashboard/help/config";
import { LocalDateTime } from "@/components/LocalDateTime";
import { HelpArticleForm, type HelpArticleFormValue } from "./HelpArticleForm";
import { HelpArticleStatusActions } from "./HelpArticleStatusActions";

export type HelpManagementTicket = {
  id: string;
  studentName: string;
  subject: string;
  category: HelpTicketCategory;
  priority: HelpTicketPriority;
  status: HelpTicketStatus;
  assignedTeacherName: string;
  createdAt: string;
  updatedAt: string;
};

export type HelpManagementArticle = HelpArticleFormValue & {
  updatedAt: string;
};

export type PlatformHelpOverviewRow = {
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  activeMembers: number;
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  waitingStudentTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  urgentPendingTickets: number;
  overdueTickets: number;
  resolutionRate: number;
  oldestWaitingAt: string | null;
  lastUpdatedAt: string | null;
};

const ticketStatusFilters = [
  ["all", "全部"],
  ["open", "待回复"],
  ["in_progress", "处理中"],
  ["waiting_student", "待学生确认"],
  ["resolved", "已解决"],
  ["closed", "已关闭"],
] as const;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function FormattedDate({ value }: { value: string | null }) {
  return <LocalDateTime value={value} options={DATE_OPTIONS} />;
}

function elapsedLabel(value: string | null) {
  if (!value) return "—";
  const milliseconds = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "刚刚";
  const hours = Math.floor(milliseconds / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(milliseconds / 60_000))} 分钟`;
  if (hours < 24) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

function statusTone(status: HelpTicketStatus) {
  if (status === "open") return "bg-rose-50 text-rose-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  if (status === "waiting_student") return "bg-amber-50 text-amber-700";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700";
  return "bg-zinc-100 text-zinc-600";
}

function ArticleDialog({ article }: { article?: HelpManagementArticle }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={article
          ? "inline-flex h-7 items-center gap-1.5 border border-black/[0.08] bg-white px-2.5 text-[9px] font-medium text-zinc-700"
          : "inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 text-[10px] font-medium text-white"}
      >
        {article ? <PencilLine size={11} /> : <Plus size={12} />}
        {article ? "编辑" : "新建文章"}
      </button>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-none border-black/[0.12] p-0">
        <DialogHeader className="border-b border-black/[0.08] px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em]">{article ? "编辑帮助文章" : "新建帮助文章"}</DialogTitle>
          <DialogDescription className="text-[10px] text-zinc-500">文章发布后，本机构学生可以在帮助中心直接查阅。</DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5"><HelpArticleForm article={article} /></div>
      </DialogContent>
    </Dialog>
  );
}

function PlatformOverview({ rows, hasError }: { rows: PlatformHelpOverviewRow[]; hasError: boolean }) {
  const totalTickets = rows.reduce((sum, row) => sum + row.totalTickets, 0);
  const pendingTickets = rows.reduce((sum, row) => sum + row.openTickets + row.inProgressTickets, 0);
  const overdueTickets = rows.reduce((sum, row) => sum + row.overdueTickets, 0);
  const resolvedTickets = rows.reduce((sum, row) => sum + row.resolvedTickets + row.closedTickets, 0);
  const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-5 border-b border-black/[0.08] px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">平台巡检</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">帮助中心管理</h2>
            </div>
            <dl className="flex flex-wrap text-[10px]">
              {[["机构", rows.length], ["待处理", pendingTickets], ["超时", overdueTickets], ["解决率", `${resolutionRate}%`]].map(([label, value], index) => (
                <div key={String(label)} className={`min-w-[88px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-zinc-950">{value}</dd>
                </div>
              ))}
            </dl>
          </header>
          {hasError && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[10px] text-rose-700">机构帮助中心统计暂时无法读取，请稍后刷新。</div>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left">
              <thead><tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-500"><th className="w-[260px] border-r border-black/[0.06] px-4 font-medium">机构</th><th className="w-[90px] px-3 text-right font-medium">活跃成员</th><th className="w-[90px] px-3 text-right font-medium">全部工单</th><th className="w-[90px] px-3 text-right font-medium">待回复</th><th className="w-[90px] px-3 text-right font-medium">处理中</th><th className="w-[110px] px-3 text-right font-medium">待学生确认</th><th className="w-[90px] px-3 text-right font-medium">紧急</th><th className="w-[90px] px-3 text-right font-medium">超时</th><th className="w-[100px] px-3 text-right font-medium">解决率</th><th className="w-[120px] px-3 font-medium">最长等待</th><th className="w-[130px] px-4 font-medium">最近更新</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.tenantId} className="h-[50px] border-b border-black/[0.07] text-[10px] hover:bg-zinc-50/60">
                    <td className="border-r border-black/[0.06] px-4"><div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${row.tenantStatus === "active" ? "bg-emerald-500" : "bg-amber-500"}`} /><span className="font-medium text-zinc-950">{row.tenantName}</span><span className="ml-auto text-[8px] text-zinc-400">{row.tenantStatus === "active" ? "运行中" : "已停用"}</span></div></td>
                    <td className="px-3 text-right font-mono text-zinc-600">{row.activeMembers}</td><td className="px-3 text-right font-mono text-zinc-600">{row.totalTickets}</td><td className="px-3 text-right font-mono text-rose-700">{row.openTickets}</td><td className="px-3 text-right font-mono text-sky-700">{row.inProgressTickets}</td><td className="px-3 text-right font-mono text-amber-700">{row.waitingStudentTickets}</td><td className="px-3 text-right font-mono text-rose-700">{row.urgentPendingTickets}</td><td className="px-3 text-right font-mono text-rose-700">{row.overdueTickets}</td><td className="px-3 text-right font-mono text-emerald-700">{row.resolutionRate}%</td><td className="px-3 text-zinc-500">{elapsedLabel(row.oldestWaitingAt)}</td><td className="px-4 font-mono text-[9px] text-zinc-400"><FormattedDate value={row.lastUpdatedAt} /></td>
                  </tr>
                ))}
                {!hasError && rows.length === 0 && <tr><td colSpan={11} className="px-5 py-16 text-center text-[10px] text-zinc-400">当前没有可巡检机构</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function TenantWorkspace({
  tenantName,
  roleLabel,
  tickets,
  articles,
  canManageArticles,
  hasError,
}: {
  tenantName: string;
  roleLabel: string;
  tickets: HelpManagementTicket[];
  articles: HelpManagementArticle[];
  canManageArticles: boolean;
  hasError: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof ticketStatusFilters)[number][0]>("all");
  const filteredTickets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return tickets.filter((ticket) => (
      (status === "all" || ticket.status === status)
      && (!normalized || `${ticket.subject} ${ticket.studentName} ${ticket.assignedTeacherName}`.toLocaleLowerCase("zh-CN").includes(normalized))
    ));
  }, [query, status, tickets]);
  const waitingCount = tickets.filter((ticket) => ticket.status === "open").length;
  const activeCount = tickets.filter((ticket) => ticket.status === "in_progress").length;
  const solvedCount = tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1720px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-5 border-b border-black/[0.08] px-5 py-5 xl:flex-row xl:items-end xl:justify-between">
            <div><p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">{tenantName} / {roleLabel}</p><h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">帮助中心管理</h2><p className="mt-1 text-[11px] text-zinc-500">学生提交问题后进入本机构工单；教师负责回复，负责人负责分配和监督。</p></div>
            <dl className="flex flex-wrap text-[10px]">{[["全部", tickets.length], ["待回复", waitingCount], ["处理中", activeCount], ["已解决", solvedCount]].map(([label, value], index) => <div key={String(label)} className={`min-w-[82px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}><dt className="text-zinc-400">{label}</dt><dd className="mt-0.5 font-mono text-base font-medium tabular-nums text-zinc-950">{value}</dd></div>)}</dl>
          </header>
          {hasError && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-[10px] text-rose-700">帮助中心数据暂时无法读取，请稍后刷新。</div>}
          <div className="grid border-b border-black/[0.08] lg:grid-cols-[minmax(260px,1fr)_auto]">
            <label className="flex min-h-11 items-center gap-2 border-b border-black/[0.06] px-4 lg:border-b-0 lg:border-r"><Search size={13} className="text-zinc-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、学生或负责老师" className="min-w-0 flex-1 bg-transparent text-[10px] outline-none placeholder:text-zinc-400" /></label>
            <div className="flex min-h-11 flex-wrap items-center gap-1 px-3 py-1.5">{ticketStatusFilters.map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`h-7 border px-3 text-[9px] font-medium ${status === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-transparent text-zinc-500 hover:border-black/[0.08]"}`}>{label}</button>)}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] border-collapse text-left">
              <thead><tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-500"><th className="w-[300px] border-r border-black/[0.06] px-4 font-medium">问题</th><th className="w-[130px] px-3 font-medium">学生</th><th className="w-[100px] px-3 font-medium">分类</th><th className="w-[90px] px-3 font-medium">优先级</th><th className="w-[130px] px-3 font-medium">负责老师</th><th className="w-[120px] px-3 font-medium">状态</th><th className="w-[95px] px-3 font-medium">等待时间</th><th className="w-[120px] px-3 font-medium">最近更新</th><th className="w-[130px] px-4 text-right font-medium">操作</th></tr></thead>
              <tbody>
                {filteredTickets.map((ticket) => <tr key={ticket.id} className="h-[54px] border-b border-black/[0.07] text-[10px] hover:bg-zinc-50/60"><td className="border-r border-black/[0.06] px-4"><div className="flex items-center gap-2">{ticket.priority === "urgent" ? <CircleAlert size={12} className="shrink-0 text-rose-600" /> : <Headphones size={12} className="shrink-0 text-zinc-400" />}<span className="truncate font-medium text-zinc-950">{ticket.subject}</span></div><p className="mt-0.5 font-mono text-[8px] text-zinc-400">{ticket.id.slice(0, 8).toUpperCase()}</p></td><td className="px-3 text-zinc-600">{ticket.studentName}</td><td className="px-3 text-zinc-500">{HELP_TICKET_CATEGORY_LABELS[ticket.category]}</td><td className="px-3"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${ticket.priority === "urgent" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-600"}`}>{HELP_TICKET_PRIORITY_LABELS[ticket.priority]}</span></td><td className="px-3 text-zinc-600">{ticket.assignedTeacherName}</td><td className="px-3"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${statusTone(ticket.status)}`}>{HELP_TICKET_STATUS_LABELS[ticket.status]}</span></td><td className="px-3 text-zinc-500">{elapsedLabel(ticket.status === "open" ? ticket.createdAt : ticket.updatedAt)}</td><td className="px-3 font-mono text-[9px] text-zinc-400"><FormattedDate value={ticket.updatedAt} /></td><td className="px-4"><Link href={`/dashboard/admin/help/tickets/${ticket.id}`} className="ml-auto flex h-7 w-fit items-center gap-1.5 border border-black/[0.08] bg-white px-2.5 text-[9px] font-medium text-zinc-700"><MessageSquareReply size={11} />查看并回复<ChevronRight size={10} /></Link></td></tr>)}
                {!hasError && filteredTickets.length === 0 && <tr><td colSpan={9} className="px-5 py-16 text-center"><Clock3 className="mx-auto text-zinc-300" size={23} /><p className="mt-3 text-xs font-medium text-zinc-700">没有符合条件的学生问题</p></td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {canManageArticles && (
          <section className="border-y border-black/[0.08] bg-white">
            <header className="flex items-center justify-between gap-4 border-b border-black/[0.08] px-5 py-4"><div><p className="text-[9px] uppercase tracking-[0.1em] text-zinc-400">Knowledge base / 常见问题</p><h2 className="mt-1 text-sm font-semibold text-zinc-950">帮助文章</h2><p className="mt-1 text-[10px] text-zinc-500">文章与学生工单分开管理；草稿不会出现在学生端。</p></div><ArticleDialog /></header>
            <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left"><thead><tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[8px] uppercase tracking-[0.07em] text-zinc-500"><th className="w-[360px] border-r border-black/[0.06] px-4 font-medium">文章</th><th className="w-[120px] px-3 font-medium">分类</th><th className="w-[100px] px-3 font-medium">状态</th><th className="w-[90px] px-3 text-right font-medium">排序</th><th className="w-[130px] px-3 font-medium">最近更新</th><th className="w-[260px] px-4 text-right font-medium">操作</th></tr></thead><tbody>{articles.map((article) => <tr key={article.id} className="h-[54px] border-b border-black/[0.07] text-[10px] hover:bg-zinc-50/60"><td className="border-r border-black/[0.06] px-4"><div className="flex items-center gap-2"><BookOpenText size={12} className="shrink-0 text-zinc-400" /><span className="truncate font-medium text-zinc-950">{article.title}</span>{article.is_featured && <span className="bg-violet-50 px-1.5 py-0.5 text-[8px] text-violet-700">推荐</span>}</div><p className="mt-0.5 truncate text-[9px] text-zinc-400">{article.summary || "暂无摘要"}</p></td><td className="px-3 text-zinc-500">{HELP_ARTICLE_CATEGORY_LABELS[article.category as HelpArticleCategory]}</td><td className="px-3"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${article.status === "published" ? "bg-emerald-50 text-emerald-700" : article.status === "archived" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{HELP_ARTICLE_STATUS_LABELS[article.status as HelpArticleStatus]}</span></td><td className="px-3 text-right font-mono text-zinc-500">{article.sort_order}</td><td className="px-3 font-mono text-[9px] text-zinc-400"><FormattedDate value={article.updatedAt} /></td><td className="px-4"><div className="flex justify-end gap-1"><ArticleDialog article={article} /><HelpArticleStatusActions id={article.id} status={article.status} /></div></td></tr>)}{articles.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-[10px] text-zinc-400">还没有帮助文章</td></tr>}</tbody></table></div>
          </section>
        )}
      </div>
    </div>
  );
}

export function HelpCenterManagementWorkspace({
  scope,
  tenantName,
  roleLabel,
  tickets,
  articles,
  overview,
  canManageArticles,
  hasError,
}: {
  scope: "platform" | "tenant";
  tenantName: string;
  roleLabel: string;
  tickets: HelpManagementTicket[];
  articles: HelpManagementArticle[];
  overview: PlatformHelpOverviewRow[];
  canManageArticles: boolean;
  hasError: boolean;
}) {
  if (scope === "platform") return <PlatformOverview rows={overview} hasError={hasError} />;
  return <TenantWorkspace tenantName={tenantName} roleLabel={roleLabel} tickets={tickets} articles={articles} canManageArticles={canManageArticles} hasError={hasError} />;
}
