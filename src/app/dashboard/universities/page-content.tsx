import Link from "next/link";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  LibraryBig,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";


type TargetPreview = {
  id: string;
  university_name: string;
  admission_track: string | null;
  degree_level: string;
  status: string;
};

const trackLabels: Record<string, string> = {
  language: "语学堂",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  bachelor: "本科",
  master: "硕士",
  doctor: "博士",
};

const statusLabels: Record<string, string> = {
  researching: "了解中",
  preparing: "准备材料",
  applied: "已申请",
  interview: "面试阶段",
  offer: "已录取",
  rejected: "未录取",
  paused: "暂缓",
};

export default async function UniversitiesPage() {
  const { supabase, user } = await requireActiveUser();
  const [targetsResult, comparisonsResult, universitiesResult] =
    await Promise.all([
      supabase
        .from("student_university_targets")
        .select("id, university_name, admission_track, degree_level, status")
        .eq("user_id", user.id)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("student_university_comparisons")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("korean_universities")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true),
    ]);

  const targets = (targetsResult.data ?? []) as TargetPreview[];
  const compareCount = comparisonsResult.count ?? 0;
  const universityCount = universitiesResult.count ?? 0;

  const entrances = [
    {
      title: "我的目标学校",
      description: "添加意向大学、设置申请阶段和优先级，持续更新申请状态，也可以随时删除。",
      href: "/dashboard/universities/targets",
      icon: Target,
      value: `${targets.length} 所目标`,
      color: "var(--app-accent)",
      soft: "var(--app-accent-soft)",
    },
    {
      title: "大学学校库",
      description: "从韩国重点院校库按地区、性质、学科、预算和排名筛选，并查看中文学校介绍。",
      href: "/dashboard/universities/library",
      icon: LibraryBig,
      value: `${universityCount} 所大学`,
      color: "var(--app-secondary)",
      soft: "var(--app-secondary-soft)",
    },
    {
      title: "学校对比",
      description: "把最多四所大学放在同一张对比表中，集中比较地区、学费、排名和申请阶段。",
      href: "/dashboard/universities/comparison",
      icon: Scale,
      value: `${compareCount}／4 所已选`,
      color: "var(--app-success)",
      soft: "var(--app-success-soft)",
    },
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-3">
          {entrances.map(({ title, description, href, icon: Icon, value, color, soft }) => (
            <Link key={href} href={href} className="app-card group flex min-h-56 flex-col rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ color, backgroundColor: soft }}><Icon size={25} /></span>
                <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color, backgroundColor: soft }}>{value}</span>
              </div>
              <DashboardTitleWithHint className="mt-7" headingLevel={2} titleClassName="text-xl font-black" title={title} description={description} />
              <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-black" style={{ color }}>进入管理 <ArrowRight className="transition group-hover:translate-x-1" size={16} /></span>
            </Link>
          ))}
        </section>

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><GraduationCap size={19} /></span>
              <div><h2 className="text-base font-black">目标进度快览</h2><p className="mt-1 text-xs app-muted-text">最近的目标学校会显示在这里。</p></div>
            </div>
            <Link href="/dashboard/universities/targets" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>管理全部 <ArrowRight size={13} /></Link>
          </div>

          {targets.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {targets.slice(0, 4).map((target) => (
                <Link
                  key={target.id}
                  href={`/dashboard/universities/targets?target=${encodeURIComponent(target.id)}#target-${target.id}`}
                  aria-label={`查看${target.university_name}的目标进度`}
                  className="app-soft-card group rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
                >
                  <div className="flex items-center justify-between gap-2"><Building2 size={17} style={{ color: "var(--app-secondary)" }} /><span className="rounded-full bg-white/60 px-2 py-1 text-[10px] font-black app-muted-text">{statusLabels[target.status] ?? target.status}</span></div>
                  <h3 className="mt-4 truncate text-sm font-black">{target.university_name}</h3>
                  <p className="mt-1 text-xs font-bold app-muted-text">{trackLabels[target.admission_track ?? target.degree_level] ?? "申请规划"}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-black" style={{ color: "var(--app-accent)" }}>查看进度 <ArrowRight className="transition group-hover:translate-x-0.5" size={11} /></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: "var(--app-border)" }}>
              <Sparkles size={22} style={{ color: "var(--app-secondary)" }} />
              <p className="mt-3 text-sm font-black">还没有目标学校</p>
              <Link href="/dashboard/universities/targets" className="mt-2 text-xs font-black" style={{ color: "var(--app-accent)" }}>添加第一所目标学校</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
