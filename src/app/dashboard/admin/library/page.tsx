import Link from "next/link";
import {
  ArrowRight,
  Download,
  FilePenLine,
  Files,
  Send,
  ShieldCheck,
} from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import {
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_RESOURCE_TYPE_LABELS,
  LIBRARY_STATUS_LABELS,
  formatFileSize,
  type LibraryCategory,
  type LibraryResourceType,
  type LibraryStatus,
} from "@/app/dashboard/library/config";
import { requireLibraryManager } from "@/lib/resource-library";
import { LibraryAdminManager } from "./LibraryAdminManager";
import { LibraryResourceForm } from "./LibraryResourceForm";
import { LibraryStatusActions } from "./LibraryStatusActions";

type Resource = {
  id: string;
  title: string;
  description: string;
  category: LibraryCategory;
  resource_type: LibraryResourceType;
  original_file_name: string | null;
  file_size: number | null;
  status: LibraryStatus;
  is_featured: boolean;
  sort_order: number;
  download_count: number;
  updated_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function LibraryManagementPage() {
  const { supabase, canAssignAdmins, role } = await requireLibraryManager();
  const resourcesResult = await supabase
    .from("library_resources")
    .select(
      "id,title,description,category,resource_type,original_file_name,file_size,status,is_featured,sort_order,download_count,updated_at"
    )
    .order("updated_at", { ascending: false });
  const resources = (resourcesResult.data ?? []) as Resource[];

  let admins: Array<{
    id: string;
    name: string;
    email: string;
    assigned: boolean;
  }> = [];

  if (canAssignAdmins) {
    const [{ data: adminData }, { data: assignedData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email")
        .eq("role", "admin")
        .eq("status", "active")
        .order("full_name", { ascending: true }),
      supabase
        .from("library_admin_assignments")
        .select("admin_id")
        .is("revoked_at", null),
    ]);
    const assigned = new Set(
      (assignedData ?? []).map((item) => item.admin_id as string)
    );
    admins = ((adminData ?? []) as Profile[]).map((item) => ({
      id: item.id,
      name: item.full_name?.trim() || "未填写姓名",
      email: item.email || "未填写邮箱",
      assigned: assigned.has(item.id),
    }));
  }

  const publishedCount = resources.filter(
    (item) => item.status === "published"
  ).length;
  const downloadCount = resources.reduce(
    (total, item) => total + item.download_count,
    0
  );

  return (
    <div className="pb-12">
      <DashboardPageHeader
        title="资料库管理"
        description="上传文件、添加实用链接，统一完成分类、发布和归档。"
        action={
          <Link
            href="#create-library-resource"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
            style={{ backgroundColor: "var(--app-accent)" }}
          >
            <FilePenLine size={15} />
            新建资料
          </Link>
        }
      />

      <div className="mx-auto mt-6 w-full max-w-[1550px] space-y-6 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-[30px] border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-secondary-soft))",
          }}
        >
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_500px] xl:items-end">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-secondary)",
                  backgroundColor: "var(--app-secondary-soft)",
                }}
              >
                <ShieldCheck size={14} />
                {role === "super_admin"
                  ? "负责人权限"
                  : role === "ceo"
                    ? "CEO 权限"
                    : "已授权管理员"}
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                先整理，再发布，让学生始终看到正确版本
              </h1>
              <p className="app-muted-text mt-4 text-sm leading-7">
                草稿和已归档资料不会出现在学生端。上传文件保存在私有空间，学生只能通过受保护的下载入口获取。
              </p>
              <Link
                href="/dashboard/library"
                className="mt-5 inline-flex items-center gap-2 text-xs font-black"
                style={{ color: "var(--app-accent)" }}
              >
                查看学生端资料库
                <ArrowRight size={13} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["全部资料", resources.length, Files, "var(--app-accent)", "var(--app-accent-soft)"],
                ["已发布", publishedCount, Send, "var(--app-success)", "var(--app-success-soft)"],
                ["累计获取", downloadCount, Download, "var(--app-warm)", "var(--app-warm-soft)"],
              ].map(([label, value, Icon, color, soft]) => {
                const MetricIcon = Icon as typeof Files;
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
        </section>

        {resourcesResult.error && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}
          >
            资料库后台暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(360px,0.72fr)_minmax(0,1.35fr)]">
          <div className="space-y-6">
            <section
              id="create-library-resource"
              className="app-card rounded-[28px] border p-5 sm:p-7"
            >
              <h2 className="text-lg font-black">新建资料</h2>
              <p className="app-muted-text mt-1 text-xs leading-6">
                可以上传文件，也可以添加经过确认的外部链接。
              </p>
              <div className="mt-5">
                <LibraryResourceForm />
              </div>
            </section>
            {canAssignAdmins && <LibraryAdminManager admins={admins} />}
          </div>

          <section className="app-card rounded-[28px] border p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">资料清单</h2>
                <p className="app-muted-text mt-1 text-xs">
                  共 {resources.length} 项，按最近修改时间排列
                </p>
              </div>
              <p className="app-muted-text text-[10px]">
                修改资料信息不会改变原文件
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {resources.map((resource) => (
                <article
                  key={resource.id}
                  className="app-soft-card rounded-2xl border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[9px] font-black"
                      style={{
                        color:
                          resource.status === "published"
                            ? "var(--app-success)"
                            : resource.status === "archived"
                              ? "var(--app-warm)"
                              : "var(--app-muted)",
                        backgroundColor:
                          resource.status === "published"
                            ? "var(--app-success-soft)"
                            : resource.status === "archived"
                              ? "var(--app-warm-soft)"
                              : "var(--app-card-bg)",
                      }}
                    >
                      {LIBRARY_STATUS_LABELS[resource.status]}
                    </span>
                    <span className="app-muted-text text-[9px] font-bold">
                      {LIBRARY_CATEGORY_LABELS[resource.category]}
                    </span>
                    <span className="app-muted-text text-[9px] font-bold">
                      {LIBRARY_RESOURCE_TYPE_LABELS[resource.resource_type]}
                    </span>
                    {resource.is_featured && (
                      <span
                        className="ml-auto text-[9px] font-black"
                        style={{ color: "var(--app-warm)" }}
                      >
                        推荐
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-base font-black leading-6">
                    {resource.title}
                  </h3>
                  <p className="app-muted-text mt-2 line-clamp-2 text-xs leading-6">
                    {resource.description || "暂无资料说明"}
                  </p>
                  <div className="app-muted-text mt-3 space-y-1 text-[10px]">
                    <p className="truncate">
                      {resource.original_file_name || "外部链接"} · {formatFileSize(resource.file_size)}
                    </p>
                    <p>
                      获取 {resource.download_count} 次 · 排序 {resource.sort_order} · 更新于 {dateFormatter.format(new Date(resource.updated_at))}
                    </p>
                  </div>

                  <div
                    className="mt-4 space-y-3 border-t pt-4"
                    style={{ borderColor: "var(--app-border-soft)" }}
                  >
                    <LibraryStatusActions id={resource.id} status={resource.status} />
                    <details className="rounded-xl border p-3">
                      <summary className="cursor-pointer text-xs font-black">
                        修改资料信息
                      </summary>
                      <div className="mt-4">
                        <LibraryResourceForm resource={resource} />
                      </div>
                    </details>
                  </div>
                </article>
              ))}

              {resources.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed p-10 text-center">
                  <Files className="mx-auto opacity-30" size={32} />
                  <p className="mt-4 font-black">还没有资料</p>
                  <p className="app-muted-text mt-2 text-xs">
                    从左侧上传第一份文件或添加一个实用链接。
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
