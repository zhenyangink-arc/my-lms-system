import { Database, Eye, GraduationCap, ShieldCheck } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { requireAdmin } from "@/lib/admin";
import {
  UniversityAdminManager,
  type AdminUniversity,
} from "./UniversityAdminManager";

export default async function AdminUniversitiesPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("korean_universities")
    .select("id, name_zh, name_ko, ownership, province, city, admission_stages, discipline_groups, tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny, tuition_reference_year, qs_rank_display, qs_rank_sort, qs_ranking_year, joongang_rank_display, joongang_rank_sort, joongang_ranking_year, summary, highlights, is_featured, is_published, sort_order, updated_at")
    .order("sort_order", { ascending: true });

  const universities = (data ?? []) as AdminUniversity[];
  const publishedCount = universities.filter((university) => university.is_published).length;
  const featuredCount = universities.filter((university) => university.is_featured).length;

  return (
    <>
      <DashboardPageHeader title="大学管理" description="维护学校介绍、筛选标签、学费和排名；管理员修正后会同步到学生选校页面。" />
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "学校库总数", value: universities.length, icon: Database, color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
            { label: "学生可见", value: publishedCount, icon: Eye, color: "var(--app-success)", soft: "var(--app-success-soft)" },
            { label: "重点推荐", value: featuredCount, icon: GraduationCap, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
          ].map(({ label, value, icon: Icon, color, soft }) => <div key={label} className="app-card flex items-center gap-4 rounded-2xl border p-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color, backgroundColor: soft }}><Icon size={19} /></span><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] font-bold app-muted-text">{label}</p></div></div>)}
        </section>

        <div className="flex items-start gap-3 rounded-2xl border p-4 text-xs leading-6" style={{ color: "var(--app-secondary)", borderColor: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><ShieldCheck className="mt-0.5 shrink-0" size={17} /><p><b>人工复核优先：</b>学校库种子数据只用于建立初始结构。招生政策、学费和排名变化后，请在这里更新，学生端不会提供学校官网跳转。</p></div>

        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">大学数据读取失败：{error.message}</div> : <UniversityAdminManager universities={universities} />}
      </div>
    </>
  );
}
