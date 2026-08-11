import "server-only";

import type { HelpCenterAccess } from "@/lib/help-center";
import type {
  HelpArticleManagementResult,
  HelpArticleRow,
  ManagedHelpArticle,
} from "./types";

export async function getHelpArticleManagementData(
  access: HelpCenterAccess,
): Promise<HelpArticleManagementResult> {
  if (access.scope === "platform") {
    return {
      scope: "platform",
      canManageArticles: false,
      articles: [],
      hasError: false,
    };
  }

  if (!access.tenantId || !access.canManageArticles) {
    return {
      scope: "tenant",
      canManageArticles: false,
      articles: [],
      hasError: false,
    };
  }

  const articleResult = await access.supabase
    .from("help_articles")
    .select(
      "id,title,summary,content,category,status,is_featured,sort_order,updated_at",
    )
    .eq("tenant_id", access.tenantId)
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false });

  const articles: ManagedHelpArticle[] = (
    (articleResult.data ?? []) as HelpArticleRow[]
  ).map((article) => ({
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

  return {
    scope: "tenant",
    canManageArticles: true,
    articles,
    hasError: Boolean(articleResult.error),
  };
}
