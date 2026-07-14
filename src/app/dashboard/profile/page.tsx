import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { ProfileForm } from "./ProfileForm";

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
  const { user, profile } = await requireActiveUser();
  const displayName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";
  const roleLabel = roleLabelMap[profile?.role ?? "student"] ?? "学生";
  const emailConfirmed = Boolean(user.email_confirmed_at);
  const completedFields = [profile?.full_name, user.email, user.email_confirmed_at].filter(Boolean).length;
  const completionPercent = Math.round((completedFields / 3) * 100);

  const quickLinks = [
    {
      title: "查看学习进度",
      description: "回顾课程完成情况与学习成果",
      href: "/dashboard/progress",
      icon: BarChart3,
      color: "var(--app-secondary)",
      softColor: "var(--app-secondary-soft)",
    },
    {
      title: "调整界面主题",
      description: "选择白天或夜间使用的配色",
      href: "/dashboard/settings",
      icon: Palette,
      color: "var(--app-accent)",
      softColor: "var(--app-accent-soft)",
    },
    {
      title: "前往帮助中心",
      description: "查看常见问题与平台使用指引",
      href: "/dashboard/help",
      icon: HelpCircle,
      color: "var(--app-success)",
      softColor: "var(--app-success-soft)",
    },
  ];

  return (
    <>
      <DashboardPageHeader
        title="个人资料"
        description="管理账号身份信息，并查看你的学习档案状态。"
      />

      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section
          className="app-card overflow-hidden rounded-[30px] border p-6 sm:p-8"
          style={{
            background:
              "linear-gradient(120deg, var(--app-hero-start), var(--app-card-bg) 52%, var(--app-hero-end))",
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span
                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] text-3xl font-black text-white shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, var(--app-secondary), var(--app-accent))",
                }}
              >
                {displayName.trim().slice(0, 1) || "学"}
              </span>
              <div className="min-w-0">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black"
                  style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}
                >
                  <Sparkles size={12} aria-hidden="true" />
                  {roleLabel}
                </span>
                <h1 className="mt-2 truncate text-2xl font-black sm:text-3xl">{displayName}</h1>
                <p className="mt-1 flex items-center gap-1.5 truncate text-sm app-muted-text">
                  <Mail size={14} className="shrink-0" aria-hidden="true" />
                  {user.email}
                </p>
              </div>
            </div>

            <div className="app-card min-w-64 rounded-3xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold app-muted-text">资料完成度</span>
                <strong style={{ color: "var(--app-success)" }}>{completionPercent}%</strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${completionPercent}%`,
                    background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))",
                  }}
                />
              </div>
              <p className="mt-3 text-[11px] app-muted-text">完善资料有助于老师和顾问准确识别你的档案。</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <ProfileForm
              initialName={profile?.full_name || user.user_metadata?.name || ""}
            />
          </div>

          <aside className="space-y-4 xl:col-span-4">
            <section className="app-card rounded-3xl border p-5">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-2xl"
                  style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}
                >
                  <ShieldCheck size={19} aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-black">账号安全</h2>
                  <p className="mt-0.5 text-xs app-muted-text">邮箱与登录状态</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="app-soft-card flex items-center justify-between gap-3 rounded-2xl border p-3">
                  <span className="text-xs font-bold app-muted-text">邮箱验证</span>
                  <span className="flex items-center gap-1.5 text-xs font-black" style={{ color: emailConfirmed ? "var(--app-success)" : "var(--app-warm)" }}>
                    <CheckCircle2 size={13} aria-hidden="true" />
                    {emailConfirmed ? "已验证" : "待验证"}
                  </span>
                </div>
                <p className="text-[11px] leading-5 app-muted-text">如需更换登录邮箱，请联系平台管理员协助处理。</p>
              </div>
            </section>

            <section className="app-card rounded-3xl border p-5">
              <h2 className="text-sm font-black">账号记录</h2>
              <div className="mt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <CalendarDays size={16} className="mt-0.5 shrink-0" style={{ color: "var(--app-secondary)" }} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold app-muted-text">加入时间</p>
                    <p className="mt-1 text-sm font-black">{formatAccountDate(user.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--app-accent)" }} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold app-muted-text">最近登录</p>
                    <p className="mt-1 text-sm font-black">{formatAccountDate(user.last_sign_in_at)}</p>
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-black">常用入口</h2>
            <p className="mt-1 text-xs app-muted-text">从个人资料继续管理你的成长档案。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="app-card flex items-center gap-3 rounded-3xl border p-4 transition hover:-translate-y-0.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: item.color, backgroundColor: item.softColor }}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{item.title}</span>
                    <span className="mt-1 block text-xs app-muted-text">{item.description}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 app-muted-text" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
