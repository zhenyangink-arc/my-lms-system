import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { type StudentProfileInitialValue } from "./ProfileForm";
import { ProfileView, type ProfileChecklistItem } from "./ProfileView";


type StudentProfile = {
  full_name: string | null;
  role: string | null;
  global_role: string | null;
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
  platform_super_admin: "平台负责人",
  tenant_super_admin: "机构负责人",
  tenant_operator: "平台副负责人",
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
    .select("full_name, role, global_role, gender, birth_date, avatar_path, address_province, address_city, education_level, education_status, education_completion_month, academic_average, gaokao_has_score, gaokao_score, english_level, math_level, has_korean, topik_level, has_work_experience")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    console.error("个人资料详情读取失败：", error?.message ?? "资料行不存在");
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="app-card max-w-xl rounded-3xl border p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={20} aria-hidden="true" /></span>
          <h1 className="mt-4 text-xl font-black">个人资料暂时没有读取成功</h1>
          <p className="mt-2 text-sm leading-6 app-muted-text">其他控制台功能不受影响，请重新加载本页；若登录已过期，系统会自动返回登录页面。</p>
          <Link href="/dashboard/profile" className="mt-5 inline-flex rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}>重新加载资料</Link>
        </section>
      </div>
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

  const checklist: ProfileChecklistItem[] = [
    { label: "真实姓名", done: Boolean(profile.full_name) },
    { label: "性别与出生日期", done: Boolean(profile.gender && profile.birth_date) },
    { label: "居住地址", done: Boolean(profile.address_province && profile.address_city) },
    { label: "个人照片", done: Boolean(profile.avatar_path) },
    { label: "教育经历", done: Boolean(profile.education_level && profile.education_status && profile.education_completion_month) },
    { label: "平均成绩", done: profile.academic_average !== null },
    ...(lowerEducation ? [{ label: "高考成绩", done: profile.gaokao_has_score !== null }] : []),
    { label: "英语能力", done: Boolean(profile.english_level) },
    { label: "数学能力", done: Boolean(profile.math_level) },
    { label: "韩语能力", done: profile.has_korean !== null && (!profile.has_korean || profile.topik_level !== null) },
    { label: "工作经历", done: profile.has_work_experience !== null },
  ];

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
    <ProfileView
      displayName={displayName}
      roleLabel={roleLabel}
      email={user.email ?? ""}
      emailConfirmed={emailConfirmed}
      avatarUrl={avatarUrl}
      createdAtLabel={formatAccountDate(user.created_at)}
      lastSignInLabel={formatAccountDate(user.last_sign_in_at)}
      checklist={checklist}
      initialValue={initialValue}
    />
  );
}
