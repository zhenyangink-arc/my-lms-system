import {
  AnnouncementManagementWorkspace,
  type AnnouncementTenantOption,
  type ManagedAnnouncement,
} from "./AnnouncementManagementWorkspace";

import {
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementStatus,
} from "@/app/dashboard/announcements/config";
import { requireAnnouncementAccess } from "@/lib/announcements";
import { createAdminClient } from "@/lib/supabase/admin";

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  is_pinned: boolean;
  scope: "platform" | "tenant";
  tenant_id: string | null;
  created_by: string;
  published_at: string | null;
  updated_at: string;
};

type TenantRow = {
  id: string;
  name: string;
  status: string;
};

type MembershipRow = {
  tenant_id: string;
  user_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ReadRow = {
  announcement_id: string;
  user_id: string;
};

export default async function AnnouncementManagementPage() {
  const access = await requireAnnouncementAccess();
  const admin = createAdminClient();

  let announcementQuery = access.supabase
    .from("announcements")
    .select("id,title,content,category,priority,status,is_pinned,scope,tenant_id,created_by,published_at,updated_at")
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (access.scope === "tenant") {
    announcementQuery = announcementQuery
      .eq("scope", "tenant")
      .eq("tenant_id", access.tenantId);
  }

  const { data: announcementData, error: announcementError } = await announcementQuery;
  const announcementRows = (announcementData ?? []) as AnnouncementRow[];
  const announcementIds = announcementRows.map((item) => item.id);
  const authorIds = [...new Set(announcementRows.map((item) => item.created_by))];

  const tenantQuery = admin
    .from("tenants")
    .select("id,name,status")
    .order("name", { ascending: true });
  if (access.scope === "tenant" && access.tenantId) {
    tenantQuery.eq("id", access.tenantId);
  }

  const membershipQuery = admin
    .from("tenant_memberships")
    .select("tenant_id,user_id")
    .eq("status", "active");
  if (access.scope === "tenant" && access.tenantId) {
    membershipQuery.eq("tenant_id", access.tenantId);
  }

  const [tenantResult, membershipResult, profileResult, readResult] = await Promise.all([
    tenantQuery,
    membershipQuery,
    authorIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", authorIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    announcementIds.length
      ? admin.from("announcement_reads").select("announcement_id,user_id").in("announcement_id", announcementIds)
      : Promise.resolve({ data: [] as ReadRow[], error: null }),
  ]);

  const tenantRows = ((tenantResult.data ?? []) as TenantRow[]).filter((tenant) => tenant.status !== "archived");
  const membershipRows = (membershipResult.data ?? []) as MembershipRow[];
  const profileRows = (profileResult.data ?? []) as ProfileRow[];
  const readRows = (readResult.data ?? []) as ReadRow[];

  const tenantNameById = new Map(tenantRows.map((tenant) => [tenant.id, tenant.name]));
  const activeTenantIds = new Set(
    tenantRows.filter((tenant) => tenant.status === "active").map((tenant) => tenant.id)
  );
  const authorNameById = new Map(
    profileRows.map((profile) => [
      profile.id,
      profile.full_name?.trim() || profile.email?.trim() || "未填写姓名",
    ])
  );

  const membersByTenant = new Map<string, Set<string>>();
  const platformAudience = new Set<string>();
  for (const membership of membershipRows) {
    if (!tenantNameById.has(membership.tenant_id)) continue;
    if (activeTenantIds.has(membership.tenant_id)) {
      platformAudience.add(membership.user_id);
    }
    const members = membersByTenant.get(membership.tenant_id) ?? new Set<string>();
    members.add(membership.user_id);
    membersByTenant.set(membership.tenant_id, members);
  }

  const readersByAnnouncement = new Map<string, Set<string>>();
  for (const read of readRows) {
    const readers = readersByAnnouncement.get(read.announcement_id) ?? new Set<string>();
    readers.add(read.user_id);
    readersByAnnouncement.set(read.announcement_id, readers);
  }

  const announcements: ManagedAnnouncement[] = announcementRows.map((announcement) => {
    const audience = announcement.scope === "platform"
      ? platformAudience
      : membersByTenant.get(announcement.tenant_id ?? "") ?? new Set<string>();
    const readers = readersByAnnouncement.get(announcement.id) ?? new Set<string>();
    const readCount = [...readers].filter((userId) => audience.has(userId)).length;

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      category: announcement.category,
      priority: announcement.priority,
      status: announcement.status,
      isPinned: announcement.is_pinned,
      scope: announcement.scope,
      tenantId: announcement.tenant_id,
      tenantName: announcement.tenant_id
        ? tenantNameById.get(announcement.tenant_id) ?? "未知机构"
        : "平台",
      authorName: authorNameById.get(announcement.created_by) ?? "未知发布人",
      publishedAt: announcement.published_at,
      updatedAt: announcement.updated_at,
      readCount,
      audienceCount: audience.size,
    };
  });

  const tenants: AnnouncementTenantOption[] = tenantRows.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
  }));

  const hasError = Boolean(
    announcementError
    || tenantResult.error
    || membershipResult.error
    || profileResult.error
    || readResult.error
  );

  return (
    <AnnouncementManagementWorkspace
      scope={access.scope}
      announcements={announcements}
      tenants={tenants}
      hasError={hasError}
    />
  );
}
