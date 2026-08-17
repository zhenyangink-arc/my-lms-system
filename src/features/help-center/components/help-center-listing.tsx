import { CircleHelp } from "lucide-react";

import {
  ManagementMetricStrip,
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
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
      <ManagementPage
        eyebrow="支持与服务"
        title="帮助中心管理"
        description="以机构级汇总视角巡检工单规模、响应时效和解决率，不读取学生问题正文与消息记录。"
        icon={CircleHelp}
        meta={<span>{ticketResult.overview.length} 个机构</span>}
      >
        <PlatformHelpOverview
          rows={ticketResult.overview}
          hasError={ticketResult.hasError || articleResult.hasError}
        />
      </ManagementPage>
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
    <ManagementPage
      eyebrow="支持与服务"
      title="帮助中心管理"
      description="处理本机构学生工单，维护帮助文章，并持续跟踪待回复、处理中和已解决事项。"
      icon={CircleHelp}
      meta={<span>{ticketResult.tenantName} · {ROLE_LABELS[access.role] ?? "帮助中心"}</span>}
    >
      {(ticketResult.hasError || articleResult.hasError) && (
        <ManagementNotice tone="warning">
          帮助中心数据暂时无法完整读取，请稍后刷新。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="帮助中心概况"
        items={[
          { label: "全部工单", value: ticketResult.tickets.length },
          { label: "待回复", value: openCount },
          { label: "处理中", value: inProgressCount },
          { label: "已解决", value: completedCount },
          { label: "帮助文章", value: articleResult.articles.length },
        ]}
      />

      <section className="management-content-section space-y-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">学生工单</h2>
        <HelpTicketsTable
          data={ticketResult.tickets}
          dashboardBasePath={access.dashboardBasePath}
        />
      </section>

      {articleResult.canManageArticles && (
        <section className="management-content-section space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--foreground)]">帮助文章</h2>
            <CreateHelpArticleDialog />
          </div>
          <HelpArticlesTable data={articleResult.articles} />
        </section>
      )}
    </ManagementPage>
  );
}
