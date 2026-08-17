import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  ImageOff,
} from "lucide-react";

import { SchoolCrest } from "@/components/school/SchoolCrest";
import { requireAdmin } from "@/lib/admin";

import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { schoolCategories } from "../school-config";

type SchoolRow = {
  id: string;
  category: string;
  name_zh: string;
  logo_url: string | null;
  is_published: boolean;
  detailed_introduction: string | null;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

export default async function SchoolOverviewPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("schools")
    .select(
      "id, category, name_zh, logo_url, is_published, detailed_introduction",
    )
    .order("updated_at", { ascending: false });
  const schools = (data ?? []) as SchoolRow[];
  const incomplete = schools.filter(
    (school) => !school.logo_url || !school.detailed_introduction,
  );

  return (
    <>
      <DashboardPageHeader
        title="学校总览"
        description="集中检查五类学校的数据数量、发布状态与资料完整度。"
      />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <Link
          href="/dashboard/admin/schools"
          className={`inline-flex items-center gap-2 rounded-md text-xs font-semibold app-muted-text ${focusRing}`}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回学校管理
        </Link>

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
            学校总览暂时无法读取，请刷新页面重试。
          </section>
        ) : (
          <>
            <section aria-label="各类学校摘要">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {schoolCategories.map((category) => {
                  const list = schools.filter(
                    (item) => item.category === category.value,
                  );
                  const complete = list.filter(
                    (item) => item.logo_url && item.detailed_introduction,
                  ).length;
                  const published = list.filter(
                    (item) => item.is_published,
                  ).length;

                  return (
                    <Link
                      key={category.slug}
                      href={`/dashboard/admin/schools/${category.slug}`}
                      className={`app-card rounded-2xl border p-4 ${focusRing}`}
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="font-semibold">{category.label}</h2>
                        <ArrowRight size={15} aria-hidden="true" />
                      </div>
                      <dl className="mt-3">
                        <div>
                          <dt className="sr-only">学校总数</dt>
                          <dd className="text-2xl font-semibold tabular-nums">
                            {list.length}
                          </dd>
                        </div>
                        <div className="app-muted-text mt-1 text-xs">
                          <dt className="inline">已发布</dt>{" "}
                          <dd className="inline tabular-nums">{published}</dd>
                          <span aria-hidden="true"> · </span>
                          <dt className="inline">资料完整</dt>{" "}
                          <dd className="inline tabular-nums">{complete}</dd>
                        </div>
                      </dl>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section
              className="app-card rounded-3xl border p-5"
              aria-labelledby="incomplete-schools-heading"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2
                    id="incomplete-schools-heading"
                    className="text-lg font-semibold"
                  >
                    待完善资料
                  </h2>
                  <p className="app-muted-text mt-1 text-xs">
                    缺少校徽或详细介绍的学校会出现在这里。
                  </p>
                </div>
                {incomplete.length ? (
                  <CircleAlert
                    className="text-amber-500"
                    aria-hidden="true"
                  />
                ) : (
                  <CircleCheckBig
                    className="text-emerald-500"
                    aria-hidden="true"
                  />
                )}
              </div>

              {schools.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed p-8 text-center">
                  <p className="text-sm font-semibold">尚未录入任何学校</p>
                  <p className="app-muted-text mt-2 text-xs">
                    请先进入对应学校分类建立第一条资料。
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {incomplete.slice(0, 18).map((school) => {
                    const category = schoolCategories.find(
                      (item) => item.value === school.category,
                    );
                    return (
                      <Link
                        key={school.id}
                        href={`/dashboard/admin/schools/${category?.slug}/${school.id}`}
                        className={`app-soft-card flex items-center gap-3 rounded-2xl border p-3 ${focusRing}`}
                      >
                        <SchoolCrest
                          logoUrl={school.logo_url}
                          name={school.name_zh}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {school.name_zh}
                          </span>
                          <span className="app-muted-text mt-1 block text-xs">
                            {category?.label} ·{" "}
                            {!school.logo_url ? "缺校徽" : "缺详细介绍"}
                          </span>
                        </span>
                        <ImageOff
                          size={15}
                          className="app-muted-text"
                          aria-hidden="true"
                        />
                      </Link>
                    );
                  })}
                  {incomplete.length === 0 && (
                    <p className="app-muted-text col-span-full py-10 text-center text-sm">
                      当前学校资料均已完整。
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
