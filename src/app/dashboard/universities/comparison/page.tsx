import Link from "next/link";
import {
  ArrowLeft,
  CircleDollarSign,
  LibraryBig,
  MapPin,
  Scale,
  Trash2,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import {
  clearUniversityComparisonsAction,
  removeUniversityComparisonAction,
} from "../actions";
import type { KoreanUniversity } from "../UniversityLibrary";


const ownershipLabels: Record<string, string> = {
  national: "国立",
  public: "公立",
  private: "私立",
};
const stageLabels: Record<string, string> = {
  language: "语学堂",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};
const disciplineLabels: Record<string, string> = {
  humanities_social: "人文社会",
  science: "理科",
  natural_sciences: "自然",
  medicine: "医学",
};

function formatWan(value: number) {
  const amount = value / 10_000;
  return Number.isInteger(amount) ? `${amount}` : amount.toFixed(1);
}

export default async function UniversityComparisonPage() {
  const { supabase, user } = await requireActiveUser();
  const { data: comparisonRows } = await supabase
    .from("student_university_comparisons")
    .select("university_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const orderedIds = (comparisonRows ?? []).map((row) => row.university_id as string).slice(0, 4);
  let universities: KoreanUniversity[] = [];
  if (orderedIds.length > 0) {
    const { data } = await supabase
      .from("korean_universities")
      .select("id, slug, name_zh, name_ko, name_en, ownership, province, city, admission_stages, discipline_groups, tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny, tuition_reference_year, qs_rank_display, qs_rank_sort, qs_ranking_year, joongang_rank_display, joongang_rank_sort, joongang_ranking_year, summary, highlights, ranking_source_url, is_featured")
      .in("id", orderedIds)
      .eq("is_published", true);
    const byId = new Map(((data ?? []) as KoreanUniversity[]).map((university) => [university.id, university]));
    universities = orderedIds.map((id) => byId.get(id)).filter((university): university is KoreanUniversity => Boolean(university));
  }

  const comparisonRowsData = [
    { label: "学校性质", icon: Scale, value: (university: KoreanUniversity) => ownershipLabels[university.ownership] },
    { label: "所在地区", icon: MapPin, value: (university: KoreanUniversity) => `${university.province} · ${university.city}` },
    { label: "年度学费", icon: CircleDollarSign, value: (university: KoreanUniversity) => `${formatWan(university.tuition_min_cny)}万—${formatWan(university.tuition_max_cny)}万元` },
    { label: "世界大学排名", icon: Scale, value: (university: KoreanUniversity) => university.qs_rank_display ? `${university.qs_ranking_year} 年第 ${university.qs_rank_display}` : "暂无可靠数据" },
    { label: "中央日报排名", icon: Scale, value: (university: KoreanUniversity) => university.joongang_rank_display ? `${university.joongang_ranking_year} 年第 ${university.joongang_rank_display}` : "暂无可靠数据" },
    { label: "申请阶段", icon: LibraryBig, value: (university: KoreanUniversity) => university.admission_stages.map((stage) => stageLabels[stage] ?? stage).join("、") },
    { label: "优势学科", icon: LibraryBig, value: (university: KoreanUniversity) => university.discipline_groups.map((group) => disciplineLabels[group] ?? group).join("、") },
    { label: "学校介绍", icon: LibraryBig, value: (university: KoreanUniversity) => university.summary },
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/universities" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} /> 返回选校规划中心</Link>
          <div className="flex gap-2">
            <Link href="/dashboard/universities/library" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><LibraryBig size={13} /> 去学校库选择</Link>
            {universities.length > 0 && <form action={clearUniversityComparisonsAction} data-permission="university_comparison"><button type="submit" className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black text-red-600"><Trash2 size={13} /> 清空对比</button></form>}
          </div>
        </div>

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><Scale size={20} /></span><div><h2 className="text-base font-black">四校对比席位</h2><p className="mt-1 text-xs app-muted-text">当前选择 {universities.length}／4 所，数据库也会强制执行上限。</p></div></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((index) => {
              const university = universities[index];
              return university ? (
                <article key={university.id} className="app-soft-card rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>{university.name_zh.slice(0, 1)}</span><form action={removeUniversityComparisonAction.bind(null, university.id)} data-permission="university_comparison"><button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" title={`移出${university.name_zh}`} aria-label={`移出${university.name_zh}`}><Trash2 size={14} /></button></form></div>
                  <h3 className="mt-4 text-sm font-black">{university.name_zh}</h3>
                  <p className="mt-1 text-xs font-bold app-muted-text">{university.name_ko} · {university.city}</p>
                </article>
              ) : <div key={`empty-${index}`} className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed text-xs font-bold app-muted-text" style={{ borderColor: "var(--app-border)" }}>待选择</div>;
            })}
          </div>
        </section>

        {universities.length > 0 ? (
          <section className="app-card overflow-hidden rounded-3xl border">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]" style={{ gridTemplateColumns: `170px repeat(${universities.length}, minmax(190px, 1fr))` }}>
                <div className="grid border-b" style={{ gridTemplateColumns: `170px repeat(${universities.length}, minmax(190px, 1fr))`, borderColor: "var(--app-border)" }}>
                  <div className="p-4 text-xs font-black app-muted-text">比较项目</div>
                  {universities.map((university) => <div key={university.id} className="border-l p-4 text-sm font-black" style={{ borderColor: "var(--app-border)" }}>{university.name_zh}</div>)}
                </div>
                {comparisonRowsData.map(({ label, icon: Icon, value }) => (
                  <div key={label} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `170px repeat(${universities.length}, minmax(190px, 1fr))`, borderColor: "var(--app-border-soft)" }}>
                    <div className="flex items-start gap-2 p-4 text-xs font-black"><Icon className="mt-0.5 shrink-0" size={14} style={{ color: "var(--app-accent)" }} />{label}</div>
                    {universities.map((university) => <div key={university.id} className="border-l p-4 text-xs font-bold leading-6 app-muted-text" style={{ borderColor: "var(--app-border-soft)" }}>{value(university)}</div>)}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="app-card flex min-h-72 flex-col items-center justify-center rounded-3xl border p-6 text-center"><Scale size={30} style={{ color: "var(--app-secondary)" }} /><h2 className="mt-4 text-base font-black">还没有选择对比学校</h2><p className="mt-2 text-xs app-muted-text">进入大学学校库，点击卡片上的“加入对比”即可占用一个席位。</p><Link href="/dashboard/universities/library" className="mt-5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>进入学校库</Link></section>
        )}
      </div>
    </>
  );
}
