import "server-only";

import type { HelpCenterAccess } from "@/lib/help-center";
import { requireHelpTicketHandler } from "@/lib/help-center";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  HelpPlatformOverviewRpcRow,
  HelpProfileRow,
  HelpTenantRow,
  HelpTicketDetailResult,
  HelpTicketDetailRow,
  HelpTicketManagementResult,
  HelpTicketMembershipRow,
  HelpTicketMessageRow,
  HelpTicketRow,
  HelpTicketTeacher,
  ManagedHelpTicket,
  PlatformHelpOverviewRow,
} from "./types";

function profileName(profile: HelpProfileRow) {
  return profile.full_name?.trim() || profile.email?.trim() || "未填写姓名";
}

export async function getHelpTicketManagementData(
  access: HelpCenterAccess,
): Promise<HelpTicketManagementResult> {
  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc(
      "get_platform_help_center_overview",
    );
    const overview: PlatformHelpOverviewRow[] = (
      (data ?? []) as HelpPlatformOverviewRpcRow[]
    ).map((row) => ({
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

    return {
      scope: "platform",
      tenantName: "平台",
      canHandleTickets: false,
      canAssignTickets: false,
      tickets: [],
      overview,
      hasError: Boolean(error),
    };
  }

  const tenantId = access.tenantId!;
  const admin = createAdminClient();
  const [ticketResult, tenantResult] = await Promise.all([
    access.supabase
      .from("help_tickets")
      .select(
        "id,user_id,assigned_to,subject,category,priority,status,created_at,updated_at",
      )
      .eq("tenant_id", tenantId)
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false }),
    admin.from("tenants").select("id,name").eq("id", tenantId).maybeSingle(),
  ]);

  const ticketRows = (ticketResult.data ?? []) as HelpTicketRow[];
  const personIds = [
    ...new Set(
      ticketRows.flatMap((ticket) => [
        ticket.user_id,
        ...(ticket.assigned_to ? [ticket.assigned_to] : []),
      ]),
    ),
  ];
  const profileResult = personIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", personIds)
    : { data: [] as HelpProfileRow[], error: null };
  const profileNames = new Map(
    ((profileResult.data ?? []) as HelpProfileRow[]).map((profile) => [
      profile.id,
      profileName(profile),
    ]),
  );

  const tickets: ManagedHelpTicket[] = ticketRows.map((ticket) => ({
    id: ticket.id,
    studentName: profileNames.get(ticket.user_id) ?? "学生",
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    assignedTeacherName: ticket.assigned_to
      ? (profileNames.get(ticket.assigned_to) ?? "已离职教师")
      : "待分配",
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  }));

  return {
    scope: "tenant",
    tenantId,
    tenantName: (tenantResult.data as HelpTenantRow | null)?.name ?? "本机构",
    canHandleTickets: true,
    canAssignTickets: access.canAssignTickets,
    tickets,
    overview: [],
    hasError: Boolean(
      ticketResult.error || tenantResult.error || profileResult.error,
    ),
  };
}

export async function getHelpTicketDetailData(
  ticketId: string,
): Promise<HelpTicketDetailResult | null> {
  const access = await requireHelpTicketHandler();
  const [ticketResult, messagesResult] = await Promise.all([
    access.supabase
      .from("help_tickets")
      .select(
        "id,user_id,assigned_to,subject,description,category,priority,status,resolution,created_at,updated_at",
      )
      .eq("id", ticketId)
      .eq("tenant_id", access.tenantId)
      .maybeSingle(),
    access.supabase
      .from("help_ticket_messages")
      .select("id,sender_kind,body,created_at")
      .eq("ticket_id", ticketId)
      .eq("tenant_id", access.tenantId)
      .order("created_at", { ascending: true }),
  ]);

  if (ticketResult.error || !ticketResult.data) return null;

  const ticket = ticketResult.data as HelpTicketDetailRow;
  const admin = createAdminClient();
  const [studentResult, teacherMembershipResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id,full_name,email")
      .eq("id", ticket.user_id)
      .maybeSingle(),
    access.canAssignTickets
      ? admin
          .from("tenant_memberships")
          .select("user_id")
          .eq("tenant_id", access.tenantId)
          .eq("role", "teacher")
          .eq("status", "active")
      : Promise.resolve({
          data: [] as HelpTicketMembershipRow[],
          error: null,
        }),
  ]);
  const teacherIds = (
    (teacherMembershipResult.data ?? []) as HelpTicketMembershipRow[]
  ).map((membership) => membership.user_id);
  const teacherProfileResult = teacherIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", teacherIds)
    : { data: [] as HelpProfileRow[], error: null };
  const teachers: HelpTicketTeacher[] = (
    (teacherProfileResult.data ?? []) as HelpProfileRow[]
  )
    .map((profile) => ({ id: profile.id, name: profileName(profile) }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return {
    ticket,
    messages: (messagesResult.data ?? []) as HelpTicketMessageRow[],
    student: studentResult.data as HelpProfileRow | null,
    teachers,
    canAssignTickets: access.canAssignTickets,
    hasMessageError: Boolean(messagesResult.error),
  };
}
