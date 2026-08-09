import type {
  HelpArticleCategory,
  HelpArticleStatus,
  HelpTicketCategory,
  HelpTicketPriority,
  HelpTicketStatus,
} from "@/app/dashboard/help/config";

export type HelpCenterManagementScope = "platform" | "tenant";

export type HelpArticleRow = {
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

export type ManagedHelpArticle = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: HelpArticleCategory;
  status: HelpArticleStatus;
  is_featured: boolean;
  sort_order: number;
  updatedAt: string;
};

export type HelpArticleManagementResult = {
  scope: HelpCenterManagementScope;
  canManageArticles: boolean;
  articles: ManagedHelpArticle[];
  hasError: boolean;
};

export type HelpTicketRow = {
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

export type HelpProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type HelpTenantRow = {
  id: string;
  name: string;
};

export type ManagedHelpTicket = {
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

export type HelpPlatformOverviewRpcRow = {
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

export type PlatformHelpTicketManagementResult = {
  scope: "platform";
  tenantName: "平台";
  canHandleTickets: false;
  canAssignTickets: false;
  tickets: [];
  overview: PlatformHelpOverviewRow[];
  hasError: boolean;
};

export type TenantHelpTicketManagementResult = {
  scope: "tenant";
  tenantId: string;
  tenantName: string;
  canHandleTickets: true;
  canAssignTickets: boolean;
  tickets: ManagedHelpTicket[];
  overview: [];
  hasError: boolean;
};

export type HelpTicketManagementResult =
  | PlatformHelpTicketManagementResult
  | TenantHelpTicketManagementResult;

export type HelpTicketDetailRow = {
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

export type HelpTicketMessageRow = {
  id: string;
  sender_kind: "student" | "staff";
  body: string;
  created_at: string;
};

export type HelpTicketTeacher = {
  id: string;
  name: string;
};

export type HelpTicketMembershipRow = {
  user_id: string;
};

export type HelpTicketDetailResult = {
  ticket: HelpTicketDetailRow;
  messages: HelpTicketMessageRow[];
  student: HelpProfileRow | null;
  teachers: HelpTicketTeacher[];
  canAssignTickets: boolean;
  dashboardBasePath: string;
  hasMessageError: boolean;
};
