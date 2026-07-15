import Link from "next/link";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { ProfileForm, type StudentProfileInitialValue } from "./ProfileForm";

type StudentProfile = {
  full_name: string | null;
  role: string | null;
  gender: string | null;
  birth_date: string | null;
  avatar_path: string | null;
  address_province: string | null;
  address_city: string | null;
  education_level: string | null;
  education_status: string | null;
  education_completion_month: string | null;
  academic_average: number | null;
  gaokao_has_score: boolean | null;
  gaokao_score: number | null;
  english_level: string | null;
  math_level: string | null;
  has_korean: boolean | null;
  topik_level: number | null;
  has_work_experience: boolean | null;
};

const roleLabelMap: Record<string, string> = {
  student: "学生",
  teacher: "教师",
  admin: "管理员",
  ceo: "运营负责人",
  super_admin: "负责人",
};

function formatAccountDate(dateString: string | null | undefined) {
  if (!dateString) return "暂无记录";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

export default async function ProfilePage() {
  const { supabase, user } = await requireActiveUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, role, gender, birth_date, avatar_path, address_province, address_city, education_level, education_status, education_completion_month, academic_average, gaokao_has_score, gaokao_score, english_level, math_level, has_korean, topik_level, has_work_experience")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    console.error("个人资料详情读取失败：", error?.message ?? "资料行不存在");
    return (
      <>
        <DashboardPageHeader title="个人资料" description="完善学习背景与能力档案，为选校和课程规划提供可靠依据。" />
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <section className="app-card max-w-xl rounded-3xl border p-7">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={20} aria-hidden="true" /></span>
            <h1 className="mt-4 text-xl font-black">个人资料暂时没有读取成功</h1>
            <p className="mt-2 text-sm leading-6 app-muted-text">其他控制台功能不受影响，请重新加载本页；若登录已过期，系统会自动返回登录页面。</p>
            <Link href="/dashboard/profile" className="mt-5 inline-flex rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>重新加载资料</Link>
          </section>
        </div>
      </>
    );
  }

  const profile = data as StudentProfile;
  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data: signedAvatar } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.avatar_path, 60 * 60);
    avatarUrl = signedAvatar?.signedUrl ?? null;
  }

  const displayName = profile.full_name || user.user_metadata?.name || user.email || "用户";
  const roleLabel = roleLabelMap[profile.role ?? "student"] ?? "学生";
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const lowerEducation = ["high_school", "secondary_vocational", "technical_school"].includes(profile.education_level ?? "");
  const completionChecks = [
    Boolean(profile.full_name),
    Boolean(profile.gender && profile.birth_date),
    Boolean(profile.address_province && profile.address_city),
    Boolean(profile.avatar_path),
    Boolean(profile.education_level && profile.education_status && profile.education_completion_month),
    profile.academic_average !== null,
    !lowerEducation || profile.gaokao_has_score !== null,
    Boolean(profile.english_level),
    Boolean(profile.math_level),
    profile.has_korean !== null && (!profile.has_korean || profile.topik_level !== null),
    profile.has_work_experience !== null,
  ];
  const completionPercent = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  const initialValue: StudentProfileInitialValue = {
    fullName: profile.full_name || user.user_metadata?.name || "",
    gender: profile.gender ?? "",
    birthDate: profile.birth_date ?? "",
    avatarUrl,
    province: profile.address_province ?? "",
    city: profile.address_city ?? "",
    educationLevel: profile.education_level ?? "",
    educationStatus: profile.education_status ?? "",
    completionDate: profile.education_completion_month?.replaceAll("-", ".") ?? "",
    academicAverage: profile.academic_average?.toString() ?? "",
    gaokaoHasScore: profile.gaokao_has_score,
    gaokaoScore: profile.gaokao_score?.toString() ?? "",
    englishLevel: profile.english_level ?? "",
    mathLevel: profile.math_level ?? "",
    hasKorean: profile.has_korean,
    topikLevel: profile.topik_level?.toString() ?? "",
    hasWorkExperience: profile.has_work_experience,
  };

  return (
    <>
      <DashboardPageHeader title="个人资料" description="完善学习背景与能力档案，为选校和课程规划提供可靠依据。" />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-[30px] border p-5 sm:p-7" style={{ background: "linear-gradient(120deg, var(--app-hero-start), var(--app-card-bg) 52%, var(--app-hero-end))" }}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] bg-cover bg-center text-3xl font-black text-white shadow-sm"
                style={{
                  backgroundImage: avatarUrl ? `url("${avatarUrl}")` : "linear-gradient(135deg, var(--app-secondary), var(--app-accent))",
                }}
              >
                {!avatarUrl && (displayName.trim().slice(0, 1) || "学")}
              </span>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>
                  <Sparkles size={12} aria-hidden="true" />{roleLabel}
                </span>
                <h1 className="mt-2 truncate text-2xl font-black sm:text-3xl">{displayName}</h1>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm app-muted-text"><Mail size={14} className="shrink-0" aria-hidden="true" />{user.email}</p>
              </div>
            </div>

            <div className="app-card min-w-64 rounded-3xl border p-4">
              <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold app-muted-text">资料完成度</span><strong style={{ color: "var(--app-success)" }}>{completionPercent}%</strong></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}><div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} /></div>
              <p className="mt-3 text-[11px] leading-5 app-muted-text">资料越完整，顾问给出的留学与学习建议越准确。</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8"><ProfileForm initialValue={initialValue} /></div>
          <aside className="space-y-4 xl:col-span-4">
            <section className="app-card rounded-3xl border p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}><ShieldCheck size={19} aria-hidden="true" /></span>
                <div><h2 className="text-sm font-black">账号安全</h2><p className="mt-0.5 text-xs app-muted-text">邮箱与登录状态</p></div>
              </div>
              <div className="app-soft-card mt-5 flex items-center justify-between gap-3 rounded-2xl border p-3">
                <span className="text-xs font-bold app-muted-text">邮箱验证</span>
                <span className="flex items-center gap-1.5 text-xs font-black" style={{ color: emailConfirmed ? "var(--app-success)" : "var(--app-warm)" }}><CheckCircle2 size={13} aria-hidden="true" />{emailConfirmed ? "已验证" : "待验证"}</span>
              </div>
            </section>
            <section className="app-card rounded-3xl border p-5">
              <h2 className="text-sm font-black">账号记录</h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3"><CalendarDays size={16} className="mt-0.5 shrink-0" style={{ color: "var(--app-secondary)" }} aria-hidden="true" /><div><p className="text-xs font-bold app-muted-text">加入时间</p><p className="mt-1 text-sm font-black">{formatAccountDate(user.created_at)}</p></div></div>
                <div className="flex items-start gap-3"><Clock3 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--app-accent)" }} aria-hidden="true" /><div><p className="text-xs font-bold app-muted-text">最近登录</p><p className="mt-1 text-sm font-black">{formatAccountDate(user.last_sign_in_at)}</p></div></div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
