import Link from "next/link";
import {
  ArrowRight,
  Download,
  FolderHeart,
  Library,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { getLibraryAccess } from "@/lib/resource-library";
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

export default async function LibraryPage() {
  const { supabase, user, canManage } = await getLibraryAccess();
  const [resourcesResult, favoritesResult] = await Promise.all([
    supabase
      .from("library_resources")
      .select(
        "id,title,description,category,resource_type,original_file_name,file_size,is_featured,download_count"
      )
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("published_at", { ascending: false }),
    supabase
      .from("library_favorites")
      .select("resource_id")
      .eq("user_id", user.id),
  ]);

  const resources = (resourcesResult.data ?? []) as Resource[];
  const favorites = (favoritesResult.data ?? []).map(
    (item) => item.resource_id as string
  );
  const featuredCount = resources.filter((item) => item.is_featured).length;
  const downloadCount = resources.reduce(
    (total, item) => total + item.download_count,
    0
  );

  return (
    <div className="pb-12">
      <DashboardPageHeader
        title="资料库"
        description="集中查找韩语学习、留学申请、签证和升学就业资料。"
        action={
          canManage ? (
            <Link
              href="/dashboard/admin/library"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              进入资料库后台
              <ArrowRight size={15} />
            </Link>
          ) : undefined
        }
      />

      <div className="mx-auto mt-6 w-full max-w-[1500px] space-y-6 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card overflow-hidden rounded-[32px] border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(125deg, var(--app-hero-start), var(--app-card-bg), var(--app-secondary-soft))",
          }}
        >
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-end">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-accent)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <Library size={14} />
                学习资料一站查找
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                把需要的资料，放进自己的学习收藏夹
              </h1>
              <p className="app-muted-text mt-4 max-w-2xl text-sm leading-7">
                文件和实用链接按主题整理。下载文件会经过登录与发布状态校验，草稿资料不会出现在学生端。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["已发布资料", resources.length, Library, "var(--app-accent)", "var(--app-accent-soft)"],
                ["我的收藏", favorites.length, FolderHeart, "#d95768", "#fff0f3"],
                ["累计获取", downloadCount, Download, "var(--app-success)", "var(--app-success-soft)"],
              ].map(([label, value, Icon, color, soft]) => {
                const MetricIcon = Icon as typeof Library;
                return (
                  <div key={String(label)} className="app-card rounded-2xl border p-4 text-center">
                    <span
                      className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ color: String(color), backgroundColor: String(soft) }}
                    >
                      <MetricIcon size={17} />
                    </span>
                    <p className="mt-2 text-2xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-[10px] font-black">{String(label)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {featuredCount > 0 && (
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black"
              style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}
            >
              <Sparkles size={14} />
              当前有 {featuredCount} 项推荐资料
            </div>
          )}
        </section>

        {(resourcesResult.error || favoritesResult.error) && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}
          >
            资料库暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <LibraryBrowser resources={resources} favorites={favorites} />

        <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-6 app-muted-text">
          <ShieldCheck className="mt-0.5 shrink-0" size={16} />
          <p>
            资料文件保存在私有空间，只有登录且账号状态正常的用户可以获取已发布资料。每次获取都会形成后台记录。
          </p>
        </section>
      </div>
    </div>
  );
}
