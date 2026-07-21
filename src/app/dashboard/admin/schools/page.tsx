import Link from "next/link";
import { ArrowRight, BadgeCheck, Database, ImageIcon, Layers3 } from "lucide-react";

import { DashboardPageHeader } from "../../DashboardPageHeader";
import { requireAdmin } from "@/lib/admin";
import { schoolCategories, schoolOverview } from "./school-config";


export const runtime = "edge";
type SchoolRow = { category: string; is_published: boolean; logo_url: string | null; detailed_introduction: string | null };

export default async function SchoolManagementPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("schools").select("category, is_published, logo_url, detailed_introduction");
  const schools = (data ?? []) as SchoolRow[];
  const published = schools.filter((school) => school.is_published).length;
  const withLogo = schools.filter((school) => Boolean(school.logo_url)).length;
  const complete = schools.filter((school) => Boolean(school.logo_url && school.detailed_introduction)).length;
  const OverviewIcon = schoolOverview.icon;

  return (
    <>
      <DashboardPageHeader title="学校管理" description="六个入口分开管理学校基础资料、校徽、详细介绍和专业内容。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5 lg:p-8">
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="grid gap-5 xl:grid-cols-[1fr_560px] xl:items-end">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Database size={15} />统一学校数据中心</span><h2 className="mt-3 text-2xl font-black tracking-tight">一套结构，分开管理五类学校</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">韩国大学保留原有 100 所学校与学生目标关联；其他院校独立建档。停用展示不会删除历史数据。</p></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
              { label: "学校总数", value: schools.length, icon: Layers3 },
              { label: "正在展示", value: published, icon: BadgeCheck },
              { label: "已有校徽", value: withLogo, icon: ImageIcon },
              { label: "资料完整", value: complete, icon: Database },
            ].map(({ label, value, icon: Icon }) => <div key={label} className="app-card rounded-2xl border p-4 text-center"><Icon className="mx-auto" size={18} style={{ color: "var(--app-accent)" }} /><p className="mt-2 text-2xl font-black">{value}</p><p className="app-muted-text mt-1 text-xs font-black">{label}</p></div>)}</div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">学校数据暂时无法读取，请先执行最新数据库迁移。</div>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link href="/dashboard/admin/schools/overview" className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><OverviewIcon size={22} /></span><div className="mt-5 flex items-center justify-between"><div><h3 className="text-lg font-black">{schoolOverview.label}</h3><p className="app-muted-text mt-2 text-xs leading-5">{schoolOverview.description}</p></div><ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={18} /></div>
          </Link>
          {schoolCategories.map((category) => {
            const Icon = category.icon;
            const count = schools.filter((school) => school.category === category.value).length;
            return <Link key={category.slug} href={`/dashboard/admin/schools/${category.slug}`} className="app-card group rounded-3xl border p-5 transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><Icon size={22} /></span><span className="app-soft-card rounded-full border px-3 py-1 text-xs font-black">{count} 所</span></div><div className="mt-5 flex items-end justify-between gap-3"><div><h3 className="text-lg font-black">{category.label}</h3><p className="app-muted-text mt-2 text-xs leading-5">{category.description}</p></div><ArrowRight className="shrink-0 transition group-hover:translate-x-1" size={18} /></div></Link>;
          })}
        </section>
      </div>
    </>
  );
}
