import { requireHelpCenterManager } from "@/lib/help-center";
import { getHelpArticleManagementData } from "../api/articles-service";
import { getHelpTicketManagementData } from "../api/tickets-service";
import { CreateHelpArticleDialog } from "./help-article-actions";
import { HelpArticlesTable } from "./help-articles-table";
import { HelpTicketsTable } from "./help-tickets-table";
import { PlatformHelpOverview } from "./platform-help-overview";

const ROLE_LABELS: Record<string, string> = {
  teacher: "教师处理台",
  ceo: "运营负责人",
  tenant_super_admin: "机构负责人",
  platform_super_admin: "平台负责人",
};

export default async function HelpCenterListing() {
  const access = await requireHelpCenterManager();
  const [articleResult, ticketResult] = await Promise.all([
    getHelpArticleManagementData(access),
    getHelpTicketManagementData(access),
  ]);

  if (ticketResult.scope === "platform") {
    return (
      <PlatformHelpOverview
        rows={ticketResult.overview}
        hasError={ticketResult.hasError || articleResult.hasError}
      />
    );
  }

  const openCount = ticketResult.tickets.filter((ticket) => ticket.status === "open").length;
  const inProgressCount = ticketResult.tickets.filter(
    (ticket) => ticket.status === "in_progress",
  ).length;
  const completedCount = ticketResult.tickets.filter(
    (ticket) => ticket.status === "resolved" || ticket.status === "closed",
  ).length;

  return (
    <div className="space-y-4">
      {(ticketResult.hasError || articleResult.hasError) && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          帮助中心数据暂时无法完整读取，请稍后刷新。
        </p>
      )}

      <section className="overflow-hidden border border-[var(--app-border)] bg-[var(--app-card-bg)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-text-soft)]">
              <tr>
                <th className="px-4 py-3 font-semibold">管理范围</th>
                <th className="px-4 py-3 font-semibold">全部工单</th>
                <th className="px-4 py-3 font-semibold">待回复</th>
                <th className="px-4 py-3 font-semibold">处理中</th>
                <th className="px-4 py-3 font-semibold">已解决</th>
                <th className="px-4 py-3 font-semibold">帮助文章</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--app-border)]">
                <th className="px-4 py-4 font-semibold text-[var(--app-text)]">
                  {ticketResult.tenantName} · {ROLE_LABELS[access.role] ?? "帮助中心"}
                </th>
                <td className="px-4 py-4 font-mono">{ticketResult.tickets.length}</td>
                <td className="px-4 py-4 font-mono">{openCount}</td>
                <td className="px-4 py-4 font-mono">{inProgressCount}</td>
                <td className="px-4 py-4 font-mono">{completedCount}</td>
                <td className="px-4 py-4 font-mono">{articleResult.articles.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--app-text)]">学生工单</h2>
        <HelpTicketsTable
          data={ticketResult.tickets}
          dashboardBasePath={access.dashboardBasePath}
        />
      </section>

      {articleResult.canManageArticles && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--app-text)]">帮助文章</h2>
            <CreateHelpArticleDialog />
          </div>
          <HelpArticlesTable data={articleResult.articles} />
        </section>
      )}
    </div>
  );
}
