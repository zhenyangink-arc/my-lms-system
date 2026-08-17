import Link from "next/link";
import { ArrowRight, BadgeCheck, Database, ImageIcon, Layers3 } from "lucide-react";

import { DashboardPageHeader } from "../../DashboardPageHeader";
import { requireAdmin } from "@/lib/admin";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { getManagementAppPath } from "@/lib/management-app-path";
import { schoolCategories, schoolOverview } from "./school-config";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";


type SchoolRow = { category: string; is_published: boolean; logo_url: string | null; detailed_introduction: string | null };

export default async function SchoolManagementPage() {
  const { supabase, tenant } = await requireAdmin();
  const universitiesPath = getManagementAppPath(
    getDashboardBasePath(tenant?.slug),
    "study-abroad",
    "universities",
  );
  const { data, error } = await supabase.from("schools").select("category, is_published, logo_url, detailed_introduction");
  const schools = (data ?? []) as SchoolRow[];
  const published = schools.filter((school) => school.is_published).length;
  const withLogo = schools.filter((school) => Boolean(school.logo_url)).length;
  const complete = schools.filter((school) => Boolean(school.logo_url && school.detailed_introduction)).length;
  const OverviewIcon = schoolOverview.icon;

  return (
    <>
      <DashboardPageHeader title="学校管理" description="管理学校资料与专业内容。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5 lg:p-8">
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--card), var(--card), var(--accent))" }}>
          <div className="grid gap-5 xl:grid-cols-[1fr_560px] xl:items-center">
            <div><DashboardTitleWithHint headingLevel={2} titleClassName="text-2xl font-semibold tracking-tight" title={<>学校资料概览</>} description={<>停用展示不会删除历史数据。</>} /></div>
            <div className="dashboard-title-metrics">{[
              { label: "学校总数", value: schools.length, icon: Layers3 },
              { label: "正在展示", value: published, icon: BadgeCheck },
              { label: "已有校徽", value: withLogo, icon: ImageIcon },
              { label: "资料完整", value: complete, icon: Database },
            ].map(({ label, value, icon: Icon }) => <div key={label} className="app-card rounded-2xl border p-4 text-center"><Icon className="mx-auto" size={18} style={{ color: "var(--primary)" }} /><p className="mt-2 text-2xl font-semibold">{value}</p><p className="app-muted-text mt-1 text-xs font-semibold">{label}</p></div>)}</div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">学校数据暂时无法读取，请刷新页面重试。</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link href={universitiesPath} className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><OverviewIcon size={22} /></span><div className="mt-5 flex items-center justify-between"><div><h3 className="text-lg font-semibold">{schoolOverview.label}</h3><p className="app-muted-text mt-2 text-xs leading-5">{schoolOverview.description}</p></div><ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={18} /></div>
          </Link>
          {schoolCategories.map((category) => {
            const Icon = category.icon;
            const count = schools.filter((school) => school.category === category.value).length;
            return <Link key={category.slug} href={universitiesPath} className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}><Icon size={22} /></span><span className="app-soft-card rounded-full border px-3 py-1 text-xs font-semibold">{count} 所</span></div><div className="mt-5 flex items-end justify-between gap-3"><div><h3 className="text-lg font-semibold">{category.label}</h3><p className="app-muted-text mt-2 text-xs leading-5">{category.description}</p></div><ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={18} /></div></Link>;
          })}
        </section>
      </div>
    </>
  );
}
