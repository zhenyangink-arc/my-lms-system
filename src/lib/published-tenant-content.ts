import "server-only";

import { unstable_cache } from "next/cache";

import type {
  AnnouncementCategory,
  AnnouncementPriority,
} from "@/app/dashboard/announcements/config";
import type { HelpArticleCategory } from "@/app/dashboard/help/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const PUBLISHED_ANNOUNCEMENTS_TAG = "published-announcements";

export function publishedAnnouncementsTenantTag(tenantId: string) {
  return `published-announcements:${tenantId}`;
}

export function publishedHelpArticlesTenantTag(tenantId: string) {
  return `published-help-articles:${tenantId}`;
}

export type PublishedAnnouncement = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  is_pinned: boolean;
  scope: "platform" | "tenant";
  tenant_id: string | null;
  published_at: string | null;
};

export type PublishedHelpArticle = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: HelpArticleCategory;
  is_featured: boolean;
};

type CachedResult<T> = {
  data: T[];
};

function assertTenantId(tenantId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("Invalid tenant cache scope.");
  }
}

/**
 * Published announcements are identical for every active member of one tenant:
 * platform-wide published rows plus that tenant's published rows. The service
 * client is safe here only because tenant scope and publication state are both
 * applied explicitly rather than inherited from the caller's RLS session.
 */
export async function getPublishedAnnouncementsForTenant(
  tenantId: string,
): Promise<CachedResult<PublishedAnnouncement>> {
  assertTenantId(tenantId);
  const tenantTag = publishedAnnouncementsTenantTag(tenantId);
  return unstable_cache(
    async () => {
      const { data, error } = await createAdminClient()
        .from("announcements")
        .select(
          "id,title,content,category,priority,is_pinned,scope,tenant_id,published_at",
        )
        .eq("status", "published")
        .or(`scope.eq.platform,and(scope.eq.tenant,tenant_id.eq.${tenantId})`)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false, nullsFirst: false });

      if (error) throw new Error("Unable to read published announcements.");
      return { data: (data ?? []) as PublishedAnnouncement[] };
    },
    ["published-announcements-for-tenant", tenantId],
    {
      tags: [PUBLISHED_ANNOUNCEMENTS_TAG, tenantTag],
      revalidate: 3600,
    },
  )();
}

/**
 * Published help articles have no per-user visibility rules. Tenant scope is
 * explicit so a service-role read cannot widen the result set.
 */
export async function getPublishedHelpArticlesForTenant(
  tenantId: string,
): Promise<CachedResult<PublishedHelpArticle>> {
  assertTenantId(tenantId);
  const tenantTag = publishedHelpArticlesTenantTag(tenantId);
  return unstable_cache(
    async () => {
      const { data, error } = await createAdminClient()
        .from("help_articles")
        .select("id,title,summary,content,category,is_featured")
        .eq("tenant_id", tenantId)
        .eq("status", "published")
        .order("is_featured", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false });

      if (error) throw new Error("Unable to read published help articles.");
      return { data: (data ?? []) as PublishedHelpArticle[] };
    },
    ["published-help-articles-for-tenant", tenantId],
    {
      tags: [tenantTag],
      revalidate: 3600,
    },
  )();
}
