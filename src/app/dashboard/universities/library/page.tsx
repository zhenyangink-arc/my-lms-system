import Link from "next/link";
import { ArrowLeft, LibraryBig, Scale, Search, Target } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import {
  UniversityLibrary,
  type KoreanUniversity,
} from "../UniversityLibrary";


export const runtime = "edge";
export default async function UniversityLibraryPage() {
  const { supabase, user } = await requireActiveUser();
  const [universitiesResult, comparisonsResult, targetsResult] = await Promise.all([
    supabase
      .from("korean_universities")
      .select("id, slug, name_zh, name_ko, name_en, logo_url, detailed_introduction, ownership, province, city, admission_stages, discipline_groups, tuition_min_krw, tuition_max_krw, tuition_min_cny, tuition_max_cny, tuition_reference_year, qs_rank_display, qs_rank_sort, qs_ranking_year, joongang_rank_display, joongang_rank_sort, joongang_ranking_year, summary, highlights, ranking_source_url, is_featured")
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_comparisons")
      .select("university_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select("university_id")
      .eq("user_id", user.id)
      .not("university_id", "is", null),
  ]);

  const universities = (universitiesResult.data ?? []) as KoreanUniversity[];
  const comparedIds = (comparisonsResult.data ?? []).map((item) => item.university_id as string);
  const targetIds = (targetsResult.data ?? []).map((item) => item.university_id as string);

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/universities" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} /> 返回选校规划中心</Link>
          <div className="flex gap-2">
            <Link href="/dashboard/universities/targets" className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black"><Target size={13} /> 我的目标学校</Link>
            <Link href="/dashboard/universities/comparison" className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black"><Scale size={13} /> 学校对比</Link>
          </div>
        </div>

        <section className="app-card rounded-3xl border p-4 sm:p-5" style={{ background: "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-hero-start))" }}>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><LibraryBig size={14} /> 韩国重点院校库</span>
              <h2 className="mt-3 text-2xl font-black">先筛选，再阅读学校介绍</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 app-muted-text">学校库只展示规划需要的信息，不提供学校官网入口。所有介绍、学费和排名数据都可以由管理员在大学管理中心复核并修改。</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[{ label: "收录大学", value: universities.length, icon: LibraryBig }, { label: "已选目标", value: targetIds.length, icon: Target }, { label: "已选对比", value: comparedIds.length, icon: Scale }].map(({ label, value, icon: Icon }) => (
                <div key={label} className="app-card min-w-24 rounded-2xl border p-3"><Icon className="mx-auto" size={15} style={{ color: "var(--app-accent)" }} /><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold app-muted-text">{label}</p></div>
              ))}
            </div>
          </div>
        </section>

        {universitiesResult.error ? (
          <div className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", borderColor: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><Search className="mr-2 inline" size={15} />学校库暂时无法读取，请确认数据库迁移已经完成。</div>
        ) : (
          <UniversityLibrary universities={universities} comparedIds={comparedIds} targetIds={targetIds} />
        )}
      </div>
    </>
  );
}
