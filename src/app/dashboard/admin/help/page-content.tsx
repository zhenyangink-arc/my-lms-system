import {
  HelpCenterManagementWorkspace,
  type HelpManagementArticle,
  type HelpManagementTicket,
  type PlatformHelpOverviewRow,
} from "./HelpCenterManagementWorkspace";

import {
  type HelpArticleCategory,
  type HelpArticleStatus,
  type HelpTicketCategory,
  type HelpTicketPriority,
  type HelpTicketStatus,
} from "@/app/dashboard/help/config";
import { requireHelpCenterManager } from "@/lib/help-center";
import { createAdminClient } from "@/lib/supabase/admin";

type TicketRow = {
  id: string;
  user_id: string;
  assigned_to: string | null;
  subject: string;
  category: HelpTicketCategory;
  priority: HelpTicketPriority;
  status: HelpTicketStatus;
  created_at: string;
  updated_at: string;
};

type ArticleRow = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: HelpArticleCategory;
  status: HelpArticleStatus;
  is_featured: boolean;
  sort_order: number;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TenantRow = { id: string; name: string };

type OverviewRpcRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  active_members: number | string;
  total_tickets: number | string;
  open_tickets: number | string;
  in_progress_tickets: number | string;
  waiting_student_tickets: number | string;
  resolved_tickets: number | string;
  closed_tickets: number | string;
  urgent_pending_tickets: number | string;
  overdue_tickets: number | string;
  resolution_rate: number | string;
  oldest_waiting_at: string | null;
  last_updated_at: string | null;
};

const roleLabels: Record<string, string> = {
  teacher: "教师处理台",
  ceo: "运营负责人",
  tenant_super_admin: "机构负责人",
  platform_super_admin: "平台负责人",
};

export default async function HelpCenterManagementPage() {
  const access = await requireHelpCenterManager();

  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc("get_platform_help_center_overview");
    const overview: PlatformHelpOverviewRow[] = ((data ?? []) as OverviewRpcRow[]).map((row) => ({
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantStatus: row.tenant_status,
      activeMembers: Number(row.active_members) || 0,
      totalTickets: Number(row.total_tickets) || 0,
      openTickets: Number(row.open_tickets) || 0,
      inProgressTickets: Number(row.in_progress_tickets) || 0,
      waitingStudentTickets: Number(row.waiting_student_tickets) || 0,
      resolvedTickets: Number(row.resolved_tickets) || 0,
      closedTickets: Number(row.closed_tickets) || 0,
      urgentPendingTickets: Number(row.urgent_pending_tickets) || 0,
      overdueTickets: Number(row.overdue_tickets) || 0,
      resolutionRate: Number(row.resolution_rate) || 0,
      oldestWaitingAt: row.oldest_waiting_at,
      lastUpdatedAt: row.last_updated_at,
    }));

    return (
      <HelpCenterManagementWorkspace
        scope="platform"
        tenantName="平台"
        roleLabel="平台负责人"
        tickets={[]}
        articles={[]}
        overview={overview}
        canManageArticles={false}
        hasError={Boolean(error)}
      />
    );
  }

  const tenantId = access.tenantId;
  const admin = createAdminClient();
  const [ticketResult, articleResult, tenantResult] = await Promise.all([
    access.supabase
      .from("help_tickets")
      .select("id,user_id,assigned_to,subject,category,priority,status,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false }),
    access.canManageArticles
      ? access.supabase
          .from("help_articles")
          .select("id,title,summary,content,category,status,is_featured,sort_order,updated_at")
          .eq("tenant_id", tenantId)
          .order("sort_order", { ascending: true })
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as ArticleRow[], error: null }),
    admin.from("tenants").select("id,name").eq("id", tenantId).maybeSingle(),
  ]);

  const ticketRows = (ticketResult.data ?? []) as TicketRow[];
  const personIds = [...new Set(ticketRows.flatMap((ticket) => [ticket.user_id, ...(ticket.assigned_to ? [ticket.assigned_to] : [])]))];
  const profileResult = personIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", personIds)
    : { data: [] as ProfileRow[], error: null };
  const profileNames = new Map(((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
    profile.id,
    profile.full_name?.trim() || profile.email?.trim() || "未填写姓名",
  ]));

  const tickets: HelpManagementTicket[] = ticketRows.map((ticket) => ({
    id: ticket.id,
    studentName: profileNames.get(ticket.user_id) ?? "学生",
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    assignedTeacherName: ticket.assigned_to ? profileNames.get(ticket.assigned_to) ?? "已离职教师" : "待分配",
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  }));

  const articles: HelpManagementArticle[] = ((articleResult.data ?? []) as ArticleRow[]).map((article) => ({
    id: article.id,
    title: article.title,
    summary: article.summary,
    content: article.content,
    category: article.category,
    status: article.status,
    is_featured: article.is_featured,
    sort_order: article.sort_order,
    updatedAt: article.updated_at,
  }));

  return (
    <HelpCenterManagementWorkspace
      scope="tenant"
      tenantName={(tenantResult.data as TenantRow | null)?.name ?? "本机构"}
      roleLabel={roleLabels[access.role] ?? "帮助中心"}
      tickets={tickets}
      articles={articles}
      overview={[]}
      canManageArticles={access.canManageArticles}
      hasError={Boolean(ticketResult.error || articleResult.error || tenantResult.error || profileResult.error)}
    />
  );
}
