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

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2";

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
  const hasDatabaseError = Boolean(
    targetsResult.error || comparisonsResult.error || universitiesResult.error,
  );

  const entrances = [
    {
      title: "我的目标学校",
      description: "添加意向大学，设置申请阶段、优先级并更新状态。",
      href: "/dashboard/universities/targets",
      icon: Target,
      value: targetsResult.error ? "暂不可用" : `${targets.length} 所目标`,
      color: "var(--primary)",
      soft: "var(--accent)",
    },
    {
      title: "大学学校库",
      description: "按地区、性质、学科、预算和排名筛选韩国大学。",
      href: "/dashboard/universities/library",
      icon: LibraryBig,
      value: universitiesResult.error ? "暂不可用" : `${universityCount} 所大学`,
      color: "var(--support)",
      soft: "var(--support-surface)",
    },
    {
      title: "学校对比",
      description: "最多四校同表比较地区、学费、排名和申请阶段。",
      href: "/dashboard/universities/comparison",
      icon: Scale,
      value: comparisonsResult.error ? "暂不可用" : `${compareCount}／4 所已选`,
      color: "var(--status-success)",
      soft: "var(--status-success-surface)",
    },
  ];

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        {hasDatabaseError && (
          <section
            role="alert"
            className="rounded-2xl border p-4"
            style={{
              color: "var(--destructive)",
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--destructive)",
            }}
          >
            <h2 className="text-sm font-bold">选校数据暂时无法完整读取</h2>
            <p className="mt-1 text-sm leading-6">
              请稍后刷新页面。显示为“暂不可用”的数量不是零条记录。
            </p>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-3">
          {entrances.map(({ title, description, href, icon: Icon, value, color, soft }) => (
            <Link key={href} href={href} className={`app-card group flex min-h-56 flex-col rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${focusRing}`}>
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ color, backgroundColor: soft }}><Icon size={25} aria-hidden="true" /></span>
                <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color, backgroundColor: soft }}>{value}</span>
              </div>
              <DashboardTitleWithHint className="mt-7" headingLevel={2} titleClassName="text-xl font-bold" title={title} description={description} />
              <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-bold" style={{ color }}>进入管理 <ArrowRight className="transition group-hover:translate-x-1" size={16} aria-hidden="true" /></span>
            </Link>
          ))}
        </section>

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ color: "var(--status-warning)", backgroundColor: "var(--status-warning-surface)" }}><GraduationCap size={19} aria-hidden="true" /></span>
              <h2 className="text-base font-bold">目标进度快览</h2>
            </div>
            <Link href="/dashboard/universities/targets" className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${focusRing}`} style={{ color: "var(--primary-hover)", backgroundColor: "var(--accent)" }}>管理全部 <ArrowRight size={13} aria-hidden="true" /></Link>
          </div>

          {targetsResult.error ? (
            <div className="mt-5 rounded-2xl border border-dashed p-5 text-center app-muted-text">
              <p className="text-sm font-bold">目标进度暂时不可用</p>
              <p className="mt-1 text-xs">数据恢复后，这里会继续显示最近的目标学校。</p>
            </div>
          ) : targets.length > 0 ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {targets.slice(0, 4).map((target) => (
                <Link
                  key={target.id}
                  href={`/dashboard/universities/targets?target=${encodeURIComponent(target.id)}#target-${target.id}`}
                  aria-label={`查看${target.university_name}的目标进度`}
                  className="app-soft-card group rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  <div className="flex items-center justify-between gap-2"><Building2 size={17} style={{ color: "var(--support)" }} aria-hidden="true" /><span className="rounded-full bg-white/60 px-2 py-1 text-[10px] font-bold app-muted-text">{statusLabels[target.status] ?? target.status}</span></div>
                  <h3 className="mt-4 truncate text-sm font-bold">{target.university_name}</h3>
                  <p className="mt-1 text-xs font-bold app-muted-text">{trackLabels[target.admission_track ?? target.degree_level] ?? "申请规划"}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--primary)" }}>查看进度 <ArrowRight className="transition group-hover:translate-x-0.5" size={11} aria-hidden="true" /></span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center" style={{ borderColor: "var(--border)" }}>
              <Sparkles size={22} style={{ color: "var(--support)" }} aria-hidden="true" />
              <p className="mt-3 text-sm font-bold">还没有目标学校</p>
              <Link href="/dashboard/universities/targets" className={`mt-2 rounded-lg text-xs font-bold ${focusRing}`} style={{ color: "var(--primary)" }}>添加第一所目标学校</Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
