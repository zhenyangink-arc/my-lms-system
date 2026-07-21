import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Flag,
  GraduationCap,
  Lock,
  Plus,
  Target,
  Trash2,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { updateUniversityStatusAction } from "../../planning-actions";
import { deleteUniversityTargetAction } from "../actions";
import {
  UniversityTargetForm,
  type UniversityTargetOption,
} from "./UniversityTargetForm";


export const runtime = "edge";
type TargetSchool = {
  id: string;
  university_id: string | null;
  university_name: string;
  program_name: string | null;
  degree_level: string;
  admission_track: string | null;
  priority: number;
  status: string;
  application_deadline: string | null;
  documents_locked_at: string | null;
};

const stages = [
  ["language", "语学堂"],
  ["bachelor_fresh", "本科新入"],
  ["bachelor_transfer", "本科插班"],
  ["master", "硕士"],
  ["doctor", "博士"],
] as const;

const stageLabels = Object.fromEntries(stages) as Record<string, string>;
const statusOptions = [
  ["researching", "了解中"],
  ["preparing", "准备材料"],
] as const;
const statusLabels = Object.fromEntries(statusOptions) as Record<string, string>;

export default async function UniversityTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireActiveUser();
  const [targetsResult, universitiesResult] = await Promise.all([
    supabase
      .from("student_university_targets")
      .select("id, university_id, university_name, program_name, degree_level, admission_track, priority, status, application_deadline, documents_locked_at")
      .eq("user_id", user.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("korean_universities")
      .select("id, name_zh, province, city, admission_stages, application_deadlines")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

  const targets = (targetsResult.data ?? []) as TargetSchool[];
  const selectedTargetId = targets.some((target) => target.id === params.target)
    ? params.target
    : null;
  const universities = (universitiesResult.data ?? []) as UniversityTargetOption[];
  // 已添加学校仍保留在下拉列表中，重复提交会修改原目标而不是新建重复记录。
  const availableUniversities = universities;
  const progressingCount = targets.filter((target) => ["preparing", "applied", "interview"].includes(target.status)).length;
  const offerCount = targets.filter((target) => target.status === "offer").length;

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/universities" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} /> 返回选校规划中心</Link>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "目标总数", value: targets.length, icon: Target, color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
            { label: "正在推进", value: progressingCount, icon: Flag, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
            { label: "已经录取", value: offerCount, icon: CheckCircle2, color: "var(--app-success)", soft: "var(--app-success-soft)" },
          ].map(({ label, value, icon: Icon, color, soft }) => (
            <div key={label} className="app-card flex items-center gap-4 rounded-2xl border p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color, backgroundColor: soft }}><Icon size={19} /></span>
              <div><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold app-muted-text">{label}</p></div>
            </div>
          ))}
        </section>

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Plus size={19} /></span>
            <div><h2 className="text-base font-black">添加目标学校</h2><p className="mt-1 text-xs app-muted-text">再次选择已有目标学校时会更新原记录，不会重复添加。</p></div>
          </div>

          <UniversityTargetForm universities={availableUniversities} />
        </section>

        {targets.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {targets.map((target) => {
              const targetLocked = target.documents_locked_at !== null;
              return (
                <article
                  key={target.id}
                  id={`target-${target.id}`}
                  className={`app-card scroll-mt-24 rounded-3xl border p-5 transition ${selectedTargetId === target.id ? "ring-2 ring-[var(--app-accent)] ring-offset-2" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><GraduationCap size={20} /></span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {targetLocked && <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}><Lock size={10} />已锁定</span>}
                      <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: target.status === "offer" ? "var(--app-success)" : "var(--app-accent-strong)", backgroundColor: target.status === "offer" ? "var(--app-success-soft)" : "var(--app-accent-soft)" }}>{statusLabels[target.status] ?? target.status}</span>
                    </div>
                  </div>
                  <h2 className="mt-4 text-lg font-black">{target.university_name}</h2>
                  <p className="mt-1 text-xs font-bold app-muted-text">{stageLabels[target.admission_track ?? target.degree_level] ?? target.degree_level}{target.program_name ? ` · ${target.program_name}` : ""}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold app-muted-text">
                    <span className="app-soft-card rounded-full border px-2.5 py-1">优先级 {target.priority}</span>
                    {target.application_deadline && <span className="app-soft-card inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><CalendarDays size={11} /> 截止 {target.application_deadline}</span>}
                  </div>
                  <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
                    {targetLocked ? (
                      <p className="app-muted-text flex items-center gap-1.5 text-xs font-bold"><Lock size={12} style={{ color: "var(--app-warm)" }} />申请阶段已锁定，无法修改或删除，请联系管理员协助解锁。</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <form action={updateUniversityStatusAction.bind(null, target.id)} className="flex min-w-0 flex-1 gap-2">
                          <select name="status" defaultValue={target.status} aria-label={`${target.university_name}的申请状态`} className="app-input min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold outline-none">
                            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <button type="submit" className="rounded-xl px-3 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>保存</button>
                        </form>
                        <form action={deleteUniversityTargetAction.bind(null, target.id)}>
                          <button type="submit" title={`删除${target.university_name}`} aria-label={`删除${target.university_name}`} className="flex h-10 w-10 items-center justify-center rounded-xl border text-red-600 transition hover:bg-red-50" style={{ borderColor: "var(--app-border)" }}><Trash2 size={15} /></button>
                        </form>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="app-card flex min-h-64 flex-col items-center justify-center rounded-3xl border p-6 text-center">
            <Target size={28} style={{ color: "var(--app-secondary)" }} />
            <h2 className="mt-4 text-base font-black">先添加第一所目标学校</h2>
            <p className="mt-2 text-xs app-muted-text">如果学校库中暂时没有需要的学校，可以联系管理员在大学管理中心补充。</p>
          </section>
        )}
      </div>
    </>
  );
}
