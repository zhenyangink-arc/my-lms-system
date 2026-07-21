import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Crown,
  GraduationCap,
  Languages,
  Mail,
  MapPin,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { requireExecutive } from "@/lib/admin";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { DashboardPageHeader } from "../../../DashboardPageHeader";
import { AccountManagementActions, type AccountListProfile } from "../AccountCard";
import { ROLE_LABELS, STATUS_LABELS } from "../permissions";


type AccountDetail = AccountListProfile & {
  avatar_path: string | null;
  gender: string | null;
  birth_date: string | null;
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

type AuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  changed_fields: string[] | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

const EDUCATION_LABELS: Record<string, string> = {
  bachelor: "本科",
  college: "大专",
  high_school: "高中",
  secondary_vocational: "中专",
  technical_school: "技工学校",
};

const EDUCATION_STATUS_LABELS: Record<string, string> = {
  graduated: "已毕业",
  studying: "在读",
};

const ACTION_LABELS: Record<string, string> = {
  account_created: "账号创建",
  role_changed: "角色调整",
  status_changed: "状态调整",
  membership_changed: "会员档位调整",
  profile_updated: "资料更新",
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "姓名",
  email: "邮箱",
  role: "角色",
  status: "状态",
  membership_tier: "会员档位",
  created_at: "注册信息",
};

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "暂无记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(date);
}

function DetailItem({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Mail }) {
  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <div className="flex items-center gap-2"><Icon className="app-muted-text" size={15} /><p className="app-muted-text text-xs font-black">{label}</p></div>
      <p className="mt-2 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function AbilityItem({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-black">{label}</p><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{value}</span></div>
      <p className="app-muted-text mt-2 text-xs leading-5">{hint}</p>
    </div>
  );
}

export default async function AccountDetailPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { supabase, role: viewerRole } = await requireExecutive();
  const [profileResult, auditResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, status, created_at, registered_at, updated_at, last_active_at, profile_completed_at, registration_source, deactivate_reason, membership_tier, avatar_path, gender, birth_date, address_province, address_city, education_level, education_status, education_completion_month, academic_average, gaokao_has_score, gaokao_score, english_level, math_level, has_korean, topik_level, has_work_experience")
      .eq("id", profileId)
      .neq("role", "tenant_super_admin")
      .maybeSingle(),
    supabase
      .from("account_management_audit_logs")
      .select("id, actor_id, action, changed_fields, before_data, after_data, created_at")
      .eq("target_user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profileResult.error || !profileResult.data) notFound();
  const profile = profileResult.data as AccountDetail;
  const auditLogs = auditResult.error ? [] : ((auditResult.data as AuditLog[] | null) ?? []);

  const actorIds = [...new Set(auditLogs.map((log) => log.actor_id).filter((value): value is string => Boolean(value)))];
  const actorResult = actorIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [], error: null };
  const actorNames = new Map((actorResult.data ?? []).map((actor) => [actor.id, actor.full_name || actor.email || `管理员 …${actor.id.slice(-6)}`]));

  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data: signedAvatar } = await supabase.storage.from("profile-photos").createSignedUrl(profile.avatar_path, 60 * 30);
    avatarUrl = signedAvatar?.signedUrl ?? null;
  }

  const lowerEducation = ["high_school", "secondary_vocational", "technical_school"].includes(profile.education_level ?? "");
  const completionChecks = [
    Boolean(profile.full_name && profile.email),
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
  const displayName = profile.full_name || "未填写姓名";
  const accountListProfile: AccountListProfile = profile;

  return (
    <>
      <DashboardPageHeader title="账号档案" description="查看成员资料、学习背景、服务档位和变更记录。" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 sm:p-5">
        <Link href="/dashboard/admin/accounts" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回账号管理</Link>

        <section className="app-card overflow-hidden rounded-[2rem] border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-hero-end))" }}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.6rem] text-2xl font-black sm:h-24 sm:w-24" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)", ...(avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center", color: "transparent" } : {}) }}>{displayName.slice(0, 1)}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2"><span className="rounded-full px-3 py-1 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{ROLE_LABELS[profile.role as keyof typeof ROLE_LABELS] ?? profile.role}</span><span className="app-soft-card rounded-full border px-3 py-1 text-xs font-black">{STATUS_LABELS[profile.status] ?? profile.status}</span>{profile.role === "student" && <span className="rounded-full px-3 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}><Crown className="mr-1 inline" size={12} />{MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile.membership_tier)]}</span>}</div>
                <h1 className="mt-3 truncate text-2xl font-black tracking-tight">{displayName}</h1>
                <p className="app-muted-text mt-1 truncate text-sm">{profile.email || "尚未同步邮箱"}</p>
              </div>
            </div>

            <div className="lg:ml-auto lg:min-w-[330px]">
              <div className="mb-3 flex items-end justify-between"><div><p className="app-muted-text text-xs font-black">资料完整度</p><p className="mt-1 text-2xl font-black">{completionPercent}%</p></div><span className="app-muted-text text-xs font-bold">{completionChecks.filter(Boolean).length}/{completionChecks.length} 项</span></div>
              <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-border-soft)" }}><div className="h-full rounded-full" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-accent), var(--app-secondary))" }} /></div>
              <p className="app-muted-text mt-2 text-xs">完整资料可让顾问更准确地制定课程与选校方案。</p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-black"><UserRound size={19} style={{ color: "var(--app-accent)" }} />基本信息</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="真实姓名" value={displayName} icon={UserRound} />
                <DetailItem label="电子邮箱" value={profile.email || "尚未同步"} icon={Mail} />
                <DetailItem label="性别" value={profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "未填写"} icon={UserRound} />
                <DetailItem label="出生日期" value={formatDate(profile.birth_date)} icon={CalendarDays} />
                <DetailItem label="所在地区" value={profile.address_province && profile.address_city ? `${profile.address_province} · ${profile.address_city}` : "未填写"} icon={MapPin} />
                <DetailItem label="工作经历" value={profile.has_work_experience === null ? "未填写" : profile.has_work_experience ? "有工作经历" : "暂无工作经历"} icon={BriefcaseBusiness} />
              </div>
            </section>

            <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-black"><GraduationCap size={20} style={{ color: "var(--app-secondary)" }} />教育与成绩</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="教育阶段" value={EDUCATION_LABELS[profile.education_level ?? ""] ?? "未填写"} icon={GraduationCap} />
                <DetailItem label="就读状态" value={EDUCATION_STATUS_LABELS[profile.education_status ?? ""] ?? "未填写"} icon={BookOpenCheck} />
                <DetailItem label={profile.education_status === "graduated" ? "毕业时间" : "预计毕业时间"} value={formatDate(profile.education_completion_month)} icon={CalendarDays} />
                <DetailItem label="平均成绩" value={profile.academic_average === null ? "未填写" : `${profile.academic_average} 分`} icon={BookOpenCheck} />
              </div>
              {lowerEducation && <div className="mt-3 rounded-2xl px-4 py-3 text-sm font-bold" style={{ backgroundColor: "var(--app-warm-soft)", color: "var(--app-warm)" }}>高考成绩：{profile.gaokao_has_score ? `${profile.gaokao_score ?? "待填写"} 分` : profile.gaokao_has_score === false ? "无高考成绩" : "未填写"}</div>}
            </section>

            <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-black"><Languages size={20} style={{ color: "var(--app-warm)" }} />能力评估</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AbilityItem label="英语能力" value={profile.english_level || "未评估"} hint="按照 A1 至 C2 六级记录当前能力。" />
                <AbilityItem label="数学能力" value={profile.math_level || "未评估"} hint="用于课程难度和专业方向规划。" />
                <AbilityItem label="韩语能力" value={profile.has_korean ? `TOPIK ${profile.topik_level ?? "待填写"} 级` : profile.has_korean === false ? "暂无基础" : "未评估"} hint="用于韩语课程起点和申请方案判断。" />
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="app-card rounded-[1.75rem] border p-5">
              <h2 className="flex items-center gap-2 text-lg font-black"><ShieldCheck size={19} style={{ color: "var(--app-accent)" }} />账号控制</h2>
              <p className="app-muted-text mt-2 text-xs leading-5">重要操作会写入审计记录。会员档位仅控制学生服务，不改变后台身份。</p>
              <div className="mt-4"><AccountManagementActions profile={accountListProfile} viewerRole={viewerRole} /></div>
              {profile.status !== "active" && profile.deactivate_reason && <div className="mt-4 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><CircleAlert className="mt-0.5 shrink-0" size={15} /><span><b>状态原因：</b>{profile.deactivate_reason}</span></div>}
            </section>

            <section className="app-card rounded-[1.75rem] border p-5">
              <h2 className="text-base font-black">账号时间线</h2>
              <div className="mt-4 space-y-3 text-xs">
                <div className="app-soft-card rounded-xl border p-3"><p className="app-muted-text font-bold">注册时间（韩国）</p><p className="mt-1 font-black">{formatDate(profile.registered_at || profile.created_at, true)}</p></div>
                <div className="app-soft-card rounded-xl border p-3"><p className="app-muted-text font-bold">最近更新</p><p className="mt-1 font-black">{formatDate(profile.updated_at, true)}</p></div>
                <div className="app-soft-card rounded-xl border p-3"><p className="app-muted-text font-bold">最近活跃</p><p className="mt-1 font-black">{formatDate(profile.last_active_at, true)}</p></div>
                <div className="app-soft-card rounded-xl border p-3"><p className="app-muted-text font-bold">注册来源</p><p className="mt-1 font-black">{profile.registration_source === "email" ? "邮箱注册" : profile.registration_source || "未知来源"}</p></div>
              </div>
            </section>
          </aside>
        </div>

        <section className="app-card rounded-[1.75rem] border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="app-muted-text text-xs font-black">安全审计</p><h2 className="mt-1 text-xl font-black">账号变更记录</h2></div><Activity size={21} style={{ color: "var(--app-secondary)" }} /></div>
          <div className="mt-5 space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="app-soft-card grid gap-3 rounded-2xl border p-4 sm:grid-cols-[160px_minmax(0,1fr)_150px] sm:items-center">
                <div><span className="inline-flex rounded-full px-2.5 py-1 text-xs font-black" style={{ color: log.action === "status_changed" ? "var(--app-warm)" : "var(--app-accent)", backgroundColor: log.action === "status_changed" ? "var(--app-warm-soft)" : "var(--app-accent-soft)" }}>{ACTION_LABELS[log.action] ?? "账号更新"}</span></div>
                <div><p className="text-xs font-black">{actorNames.get(log.actor_id ?? "") ?? "系统管理员"}</p><p className="app-muted-text mt-1 text-xs">变更内容：{(log.changed_fields ?? []).map((field) => FIELD_LABELS[field] ?? field).join("、") || "系统记录"}</p></div>
                <p className="app-muted-text text-xs font-bold sm:text-right">{formatDate(log.created_at, true)}</p>
              </div>
            ))}
            {auditLogs.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto opacity-30" size={28} /><p className="mt-3 text-sm font-black">暂无账号变更记录</p></div>}
          </div>
        </section>
      </div>
    </>
  );
}
