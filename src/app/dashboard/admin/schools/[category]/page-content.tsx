import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Plus,
  Search,
  Settings2,
} from "lucide-react";

import { SchoolCrest } from "@/components/school/SchoolCrest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requireAdmin } from "@/lib/admin";

import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { createSchoolAction, toggleSchoolPublishedAction } from "../actions";
import {
  getSchoolCategoryBySlug,
  ownershipLabels,
} from "../school-config";

type SchoolRow = {
  id: string;
  name_zh: string;
  name_local: string | null;
  logo_url: string | null;
  ownership: string;
  province: string | null;
  city: string | null;
  summary: string | null;
  detailed_introduction: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
};

const PAGE_SIZE = 20;
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";
const fieldClass = `app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm ${focusRing}`;

function NewSchoolFields({ categoryValue }: { categoryValue: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="category" value={categoryValue} />
      <label className="text-xs font-semibold">
        学校中文名称
        <input
          name="nameZh"
          required
          minLength={2}
          maxLength={120}
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold">
        本地名称
        <input name="nameLocal" maxLength={160} className={fieldClass} />
      </label>
      <label className="text-xs font-semibold">
        学校性质
        <select name="ownership" defaultValue="private" className={fieldClass}>
          <option value="national">国立</option>
          <option value="public">公立</option>
          <option value="private">私立</option>
          <option value="other">其他</option>
        </select>
      </label>
      <label className="text-xs font-semibold">
        校徽图片地址
        <input
          name="logoUrl"
          type="url"
          placeholder="https://…"
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold">
        省／道／直辖市
        <input name="province" className={fieldClass} />
      </label>
      <label className="text-xs font-semibold">
        城市
        <input name="city" className={fieldClass} />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        学校摘要
        <textarea
          name="summary"
          rows={3}
          maxLength={1200}
          className={`${fieldClass} leading-6`}
        />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        学校详细介绍
        <textarea
          name="detailedIntroduction"
          rows={6}
          maxLength={12000}
          className={`${fieldClass} leading-6`}
        />
      </label>
      <label className="text-xs font-semibold">
        排序
        <input
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={1000}
          className={fieldClass}
        />
      </label>
      <fieldset className="flex items-end gap-5 pb-3 text-xs font-semibold">
        <legend className="sr-only">展示设置</legend>
        <label className="flex items-center gap-2">
          <input
            name="isPublished"
            type="checkbox"
            defaultChecked
            className={focusRing}
          />
          对学生展示
        </label>
        <label className="flex items-center gap-2">
          <input name="isFeatured" type="checkbox" className={focusRing} />
          重点推荐
        </label>
      </fieldset>
    </div>
  );
}

function paginationHref(categorySlug: string, query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/dashboard/admin/schools/${categorySlug}${search ? `?${search}` : ""}`;
}

export default async function SchoolCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { category: categorySlug } = await params;
  const resolvedSearchParams = await searchParams;
  const query = (resolvedSearchParams.q ?? "").trim().slice(0, 80);
  const requestedPage = Number.parseInt(resolvedSearchParams.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const category = getSchoolCategoryBySlug(categorySlug);
  if (!category) notFound();

  const { supabase } = await requireAdmin();
  let request = supabase
    .from("schools")
    .select(
      "id, name_zh, name_local, logo_url, ownership, province, city, summary, detailed_introduction, is_published, is_featured, sort_order",
      { count: "exact" },
    )
    .eq("category", category.value)
    .order("sort_order", { ascending: true })
    .order("name_zh", { ascending: true });

  if (query) {
    const safeQuery = query.replace(/[%_,()]/g, "");
    request = request.or(
      `name_zh.ilike.%${safeQuery}%,name_local.ilike.%${safeQuery}%`,
    );
  }

  const rangeStart = (page - 1) * PAGE_SIZE;
  const { data, error, count } = await request.range(
    rangeStart,
    rangeStart + PAGE_SIZE - 1,
  );
  const schools = (data ?? []) as SchoolRow[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <DashboardPageHeader
        title={`${category.label}管理`}
        description={category.description}
      />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/admin/schools"
            className={`inline-flex items-center gap-2 rounded-md text-xs font-semibold app-muted-text ${focusRing}`}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            返回学校管理
          </Link>
          {category.value === "korean_university" && (
            <Link
              href="/dashboard/admin/universities"
              className={`app-soft-card inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${focusRing}`}
            >
              <Settings2 size={14} aria-hidden="true" />
              进入韩国大学排名与学费管理
            </Link>
          )}
        </div>

        <section
          className="app-card rounded-3xl border p-4"
          aria-label="学校列表工具栏"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form method="get" className="flex min-w-0 flex-1 items-end gap-2">
              <label htmlFor="school-search" className="min-w-0 flex-1 text-xs font-semibold">
                搜索学校
                <span className="app-input mt-2 flex items-center gap-2 rounded-xl border px-3">
                  <Search size={15} aria-hidden="true" />
                  <input
                    id="school-search"
                    name="q"
                    defaultValue={query}
                    placeholder="学校中文或本地名称"
                    className={`min-w-0 flex-1 bg-transparent py-3 text-sm ${focusRing}`}
                  />
                </span>
              </label>
              <button
                type="submit"
                className={`min-h-11 rounded-xl px-4 text-sm font-semibold text-white ${focusRing}`}
                style={{ backgroundColor: "var(--primary)" }}
              >
                搜索
              </button>
            </form>

            <Dialog>
              <DialogTrigger
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white ${focusRing}`}
                style={{ backgroundColor: "var(--support)" }}
              >
                <Plus size={15} aria-hidden="true" />
                新增{category.label}
              </DialogTrigger>
              <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>新增{category.label}</DialogTitle>
                  <DialogDescription>
                    先建立学校基础档案，保存后再进入详情页维护专业。
                  </DialogDescription>
                </DialogHeader>
                <form
                  action={createSchoolAction.bind(null, categorySlug)}
                  className="space-y-5"
                >
                  <NewSchoolFields categoryValue={category.value} />
                  <button
                    type="submit"
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ${focusRing}`}
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    保存学校档案
                  </button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {error ? (
          <section
            role="alert"
            className="rounded-2xl border p-4 text-sm font-semibold"
            style={{
              color: "var(--status-danger)",
              backgroundColor: "var(--status-danger-surface)",
              borderColor: "var(--status-danger)",
            }}
          >
            学校列表读取失败，请刷新页面重试。
          </section>
        ) : (
          <>
            <section
              className="app-card overflow-hidden rounded-3xl border"
              aria-labelledby="school-table-heading"
            >
              <div className="border-b px-5 py-4">
                <h2 id="school-table-heading" className="text-base font-semibold">
                  学校资料
                </h2>
                <p className="app-muted-text mt-1 text-xs">
                  共 {totalCount} 所，按排序值和学校名称排列。
                </p>
              </div>
              {schools.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-semibold">
                    {query ? "没有符合搜索条件的学校" : "尚未录入学校"}
                  </p>
                  <p className="app-muted-text mt-2 text-xs">
                    {query
                      ? "请调整关键词，或清除搜索条件后重试。"
                      : "使用“新增”建立第一条学校资料。"}
                  </p>
                  {query && (
                    <Link
                      href={`/dashboard/admin/schools/${categorySlug}`}
                      className={`mt-4 inline-flex rounded-xl border px-4 py-2 text-xs font-semibold ${focusRing}`}
                    >
                      清除搜索条件
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-xs">
                    <caption className="sr-only">
                      {category.label}学校资料列表
                    </caption>
                    <thead className="app-muted-text border-b">
                      <tr>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          学校与校徽
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          性质
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          地区
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          资料状态
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          发布状态
                        </th>
                        <th scope="col" className="px-5 py-3 font-semibold">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {schools.map((school) => {
                        const isComplete = Boolean(
                          school.logo_url && school.detailed_introduction,
                        );
                        return (
                          <tr key={school.id}>
                            <th scope="row" className="px-5 py-4 font-normal">
                              <div className="flex min-w-0 items-center gap-3">
                                <SchoolCrest
                                  logoUrl={school.logo_url}
                                  name={school.name_zh}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold">
                                    {school.name_zh}
                                  </p>
                                  <p className="app-muted-text mt-1 truncate">
                                    {school.name_local || "本地名称待完善"} · 顺序{" "}
                                    <span className="tabular-nums">
                                      {school.sort_order}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </th>
                            <td className="px-4 py-4 font-semibold">
                              {ownershipLabels[school.ownership] || school.ownership}
                            </td>
                            <td className="app-muted-text px-4 py-4 leading-5">
                              {school.province || "地区待完善"}
                              <br />
                              {school.city || "城市待完善"}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className="font-semibold"
                                style={{
                                  color: isComplete
                                    ? "var(--status-success)"
                                    : "var(--status-warning)",
                                }}
                              >
                                {isComplete ? "资料完整" : "需要完善"}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-semibold">
                              {school.is_published ? "展示中" : "已停用"}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/dashboard/admin/schools/${categorySlug}/${school.id}`}
                                  className={`app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold ${focusRing}`}
                                >
                                  详情管理
                                  <ArrowRight size={13} aria-hidden="true" />
                                </Link>
                                <form
                                  action={toggleSchoolPublishedAction.bind(
                                    null,
                                    categorySlug,
                                    school.id,
                                    !school.is_published,
                                  )}
                                >
                                  <button
                                    type="submit"
                                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 font-semibold ${focusRing}`}
                                  >
                                    {school.is_published ? (
                                      <EyeOff size={13} aria-hidden="true" />
                                    ) : (
                                      <Eye size={13} aria-hidden="true" />
                                    )}
                                    {school.is_published ? "停用" : "展示"}
                                  </button>
                                </form>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <nav
              className="flex items-center justify-between gap-3"
              aria-label="学校列表分页"
            >
              {page > 1 ? (
                <Link
                  href={paginationHref(categorySlug, query, page - 1)}
                  className={`rounded-xl border px-4 py-2 text-xs font-semibold ${focusRing}`}
                >
                  上一页
                </Link>
              ) : (
                <span className="rounded-xl border px-4 py-2 text-xs opacity-50">
                  上一页
                </span>
              )}
              <p className="app-muted-text text-xs tabular-nums">
                第 {page} / {totalPages} 页
              </p>
              {page < totalPages ? (
                <Link
                  href={paginationHref(categorySlug, query, page + 1)}
                  className={`rounded-xl border px-4 py-2 text-xs font-semibold ${focusRing}`}
                >
                  下一页
                </Link>
              ) : (
                <span className="rounded-xl border px-4 py-2 text-xs opacity-50">
                  下一页
                </span>
              )}
            </nav>
          </>
        )}
      </div>
    </>
  );
}
