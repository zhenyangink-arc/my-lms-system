import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Flag,
  GraduationCap,
  Plus,
  Target,
  Trash2,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../../DashboardPageHeader";
import { updateUniversityStatusAction } from "../../planning-actions";
import {
  addUniversityTargetFromFormAction,
  deleteUniversityTargetAction,
} from "../actions";

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
};

type UniversityOption = {
  id: string;
  name_zh: string;
  province: string;
  city: string;
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
  ["applied", "已申请"],
  ["interview", "面试阶段"],
  ["offer", "已录取"],
  ["rejected", "未录取"],
  ["paused", "暂缓"],
] as const;
const statusLabels = Object.fromEntries(statusOptions) as Record<string, string>;

export default async function UniversityTargetsPage() {
  const { supabase, user } = await requireActiveUser();
  const [targetsResult, universitiesResult] = await Promise.all([
    supabase
      .from("student_university_targets")
      .select("id, university_id, university_name, program_name, degree_level, admission_track, priority, status, application_deadline")
      .eq("user_id", user.id)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("korean_universities")
      .select("id, name_zh, province, city")
      .eq("is_published", true)
      .order("sort_order", { ascending: true }),
  ]);

  const targets = (targetsResult.data ?? []) as TargetSchool[];
  const universities = (universitiesResult.data ?? []) as UniversityOption[];
  // 已添加学校仍保留在下拉列表中，重复提交会修改原目标而不是新建重复记录。
  const availableUniversities = universities;
  const progressingCount = targets.filter((target) => ["preparing", "applied", "interview"].includes(target.status)).length;
  const offerCount = targets.filter((target) => target.status === "offer").length;

  return (
    <>
      <DashboardPageHeader title="我的目标学校" description="添加、更新和删除自己的申请目标，集中管理每所学校的推进状态。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Link href="/dashboard/universities" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} /> 返回选校规划中心</Link>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "目标总数", value: targets.length, icon: Target, color: "var(--app-accent)", soft: "var(--app-accent-soft)" },
            { label: "正在推进", value: progressingCount, icon: Flag, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
            { label: "已经录取", value: offerCount, icon: CheckCircle2, color: "var(--app-success)", soft: "var(--app-success-soft)" },
          ].map(({ label, value, icon: Icon, color, soft }) => (
            <div key={label} className="app-card flex items-center gap-4 rounded-2xl border p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color, backgroundColor: soft }}><Icon size={19} /></span>
              <div><p className="text-2xl font-black">{value}</p><p className="text-[10px] font-bold app-muted-text">{label}</p></div>
            </div>
          ))}
        </section>

        <section className="app-card rounded-[30px] border p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Plus size={19} /></span>
            <div><h2 className="text-base font-black">添加目标学校</h2><p className="mt-1 text-xs app-muted-text">再次选择已有目标学校时会更新原记录，不会重复添加。</p></div>
          </div>

          <form action={addUniversityTargetFromFormAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6 xl:items-end">
            <label className="text-xs font-black xl:col-span-2">
              选择大学
              <select name="universityId" required defaultValue="" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none">
                <option value="" disabled>请选择学校库中的大学</option>
                {availableUniversities.map((university) => <option key={university.id} value={university.id}>{university.name_zh} · {university.province}</option>)}
              </select>
            </label>
            <label className="text-xs font-black">
              申请阶段
              <select name="admissionTrack" defaultValue="language" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none">
                {stages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-black">
              申请专业
              <input name="programName" maxLength={120} placeholder="可以稍后补充" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" />
            </label>
            <label className="text-xs font-black">
              截止日期
              <input name="deadline" type="date" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none" />
            </label>
            <div className="flex gap-2">
              <label className="min-w-20 flex-1 text-xs font-black">
                优先级
                <select name="priority" defaultValue="3" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none">
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} 级</option>)}
                </select>
              </label>
              <button disabled={availableUniversities.length === 0} type="submit" className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><Plus size={14} /> 添加</button>
            </div>
          </form>
        </section>

        {targets.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {targets.map((target) => (
              <article key={target.id} className="app-card rounded-[26px] border p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><GraduationCap size={20} /></span>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: target.status === "offer" ? "var(--app-success)" : "var(--app-accent-strong)", backgroundColor: target.status === "offer" ? "var(--app-success-soft)" : "var(--app-accent-soft)" }}>{statusLabels[target.status] ?? target.status}</span>
                </div>
                <h2 className="mt-4 text-lg font-black">{target.university_name}</h2>
                <p className="mt-1 text-xs font-bold app-muted-text">{stageLabels[target.admission_track ?? target.degree_level] ?? target.degree_level}{target.program_name ? ` · ${target.program_name}` : ""}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold app-muted-text">
                  <span className="app-soft-card rounded-full border px-2.5 py-1">优先级 {target.priority}</span>
                  {target.application_deadline && <span className="app-soft-card inline-flex items-center gap-1 rounded-full border px-2.5 py-1"><CalendarDays size={11} /> 截止 {target.application_deadline}</span>}
                </div>
                <div className="mt-5 flex items-center gap-2 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
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
              </article>
            ))}
          </section>
        ) : (
          <section className="app-card flex min-h-64 flex-col items-center justify-center rounded-[30px] border p-8 text-center">
            <Target size={28} style={{ color: "var(--app-secondary)" }} />
            <h2 className="mt-4 text-base font-black">先添加第一所目标学校</h2>
            <p className="mt-2 text-xs app-muted-text">如果学校库中暂时没有需要的学校，可以联系管理员在大学管理中心补充。</p>
          </section>
        )}
      </div>
    </>
  );
}
