import Link from "next/link";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import {
  ArrowRight,
  Download,
  FolderHeart,
  Library,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getLibraryAccess } from "@/lib/resource-library";
import { getStudentAppCourseScope } from "@/lib/student-app-data";
import type { StudentAppSlug } from "@/lib/student-apps";
import { LibraryBrowser } from "./LibraryBrowser";
import type { LibraryCategory, LibraryResourceType } from "./config";


type Resource = {
  id: string;
  title: string;
  description: string;
  category: LibraryCategory;
  resource_type: LibraryResourceType;
  original_file_name: string | null;
  file_size: number | null;
  is_featured: boolean;
  download_count: number;
};

export async function LibraryPageContent({
  studentAppSlug,
}: {
  studentAppSlug?: StudentAppSlug;
} = {}) {
  const { supabase, user, canManage, canCurate } = await getLibraryAccess();
  const appScope = studentAppSlug
    ? await getStudentAppCourseScope(supabase, studentAppSlug)
    : null;
  let resourcesQuery = supabase
    .from("library_resources")
    .select(
      "id,title,description,category,resource_type,original_file_name,file_size,is_featured,download_count"
    )
    .eq("status", "published");
  if (appScope) {
    resourcesQuery = resourcesQuery.in("course_id", appScope.courseIds);
  }
  const [resourcesResult, favoritesResult] = await Promise.all([
    resourcesQuery
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false }),
    supabase
      .from("library_favorites")
      .select("resource_id")
      .eq("user_id", user.id),
  ]);

  const resources = (resourcesResult.data ?? []) as Resource[];
  const resourceIds = new Set(resources.map((resource) => resource.id));
  const favorites = (favoritesResult.data ?? [])
    .map((item) => item.resource_id as string)
    .filter((resourceId) => resourceIds.has(resourceId));
  const featuredCount = resources.filter((item) => item.is_featured).length;
  const downloadCount = resources.reduce(
    (total, item) => total + item.download_count,
    0
  );

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {canManage && (
          <div className="flex justify-end">
            <Link
              href="/dashboard/admin/library"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: "var(--support)" }}
            >
              {canCurate ? "进入资料库后台" : "查看机构资料清单"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
        {canManage && <section
          className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(125deg, var(--card), var(--card), var(--support-surface))",
          }}
        >
          <div className={canManage ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-center" : "grid"}>
            {canManage && <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{
                  color: "var(--primary)",
                  backgroundColor: "var(--accent)",
                }}
              >
                <Library size={14} aria-hidden="true" />
                学习资料一站查找
              </span>
              <DashboardTitleWithHint className="mt-3" title="把需要的资料，放进自己的学习收藏夹" description="文件和实用链接按主题整理。下载文件会经过登录与发布状态校验，草稿资料不会出现在学生端。" />
            </div>}
            <div className={canManage ? "dashboard-title-metrics" : "grid grid-cols-3 gap-2"}>
              {[
                ["已发布资料", resources.length, Library, "var(--primary)", "var(--accent)"],
                ["我的收藏", favorites.length, FolderHeart, "var(--support)", "var(--support-surface)"],
                ["累计获取", downloadCount, Download, "var(--status-success)", "var(--status-success-surface)"],
              ].map(([label, value, Icon, color, soft]) => {
                const MetricIcon = Icon as typeof Library;
                return (
                  <div key={String(label)} className="app-card rounded-2xl border p-4 text-center">
                    <span
                      className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ color: String(color), backgroundColor: String(soft) }}
                    >
                      <MetricIcon size={17} aria-hidden="true" />
                    </span>
                    <p className="mt-2 text-2xl font-bold">{String(value)}</p>
                    <p className="app-muted-text text-xs font-bold">{String(label)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {featuredCount > 0 && (
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
              style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}
            >
              <Sparkles size={14} aria-hidden="true" />
              当前有 {featuredCount} 项推荐资料
            </div>
          )}
        </section>}

        {(resourcesResult.error || favoritesResult.error) && (
          <section
            role="alert"
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}
          >
            资料库暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <LibraryBrowser resources={resources} favorites={favorites} />

        <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 app-muted-text">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} aria-hidden="true" />
          <p>
            资料文件保存在私有空间，只有登录且账号状态正常的用户可以获取已发布资料。每次获取都会形成后台记录。
          </p>
        </section>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return <LibraryPageContent />;
}
