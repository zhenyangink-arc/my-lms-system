import type {
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
} from "@/app/dashboard/announcements/config";

export type AnnouncementManagementScope = "platform" | "tenant";

export type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  is_pinned: boolean;
  scope: AnnouncementManagementScope;
  tenant_id: string | null;
  created_by: string;
  published_at: string | null;
  updated_at: string;
};

export type AnnouncementTenantRow = {
  id: string;
  name: string;
  status: string;
};

export type AnnouncementMembershipRow = {
  tenant_id: string;
  user_id: string;
};

export type AnnouncementProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type AnnouncementReadRow = {
  announcement_id: string;
  user_id: string;
};

export type ManagedAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  isPinned: boolean;
  scope: AnnouncementManagementScope;
  tenantId: string | null;
  tenantName: string;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
  readCount: number;
  audienceCount: number;
};

export type AnnouncementTenantOption = {
  id: string;
  name: string;
};

export type AnnouncementManagementResult = {
  scope: AnnouncementManagementScope;
  announcements: ManagedAnnouncement[];
  tenants: AnnouncementTenantOption[];
  hasError: boolean;
};
