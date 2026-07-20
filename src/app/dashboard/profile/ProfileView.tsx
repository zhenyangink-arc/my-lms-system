import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  ListChecks,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ProfileForm, type StudentProfileInitialValue } from "./ProfileForm";

export type ProfileChecklistItem = { label: string; done: boolean };

export type ProfileViewProps = {
  displayName: string;
  roleLabel: string;
  email: string;
  emailConfirmed: boolean;
  avatarUrl: string | null;
  createdAtLabel: string;
  lastSignInLabel: string;
  checklist: ProfileChecklistItem[];
  initialValue: StudentProfileInitialValue;
};

export function ProfileView({
  displayName,
  roleLabel,
  email,
  emailConfirmed,
  avatarUrl,
  createdAtLabel,
  lastSignInLabel,
  checklist,
  initialValue,
}: ProfileViewProps) {
  const doneCount = checklist.filter((item) => item.done).length;
  const completionPercent = Math.round((doneCount / checklist.length) * 100);
  const pendingItems = checklist.filter((item) => !item.done);

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* 头部横幅：个人身份 + 账号元信息合并成一张卡，避免右栏出现零碎小卡片 */}
      <section className="app-card overflow-hidden rounded-3xl border" style={{ background: "linear-gradient(120deg, var(--app-hero-start), var(--app-card-bg) 52%, var(--app-hero-end))" }}>
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <span
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-cover bg-center text-3xl font-black text-white shadow-sm sm:h-24 sm:w-24"
              style={{
                backgroundImage: avatarUrl ? `url("${avatarUrl}")` : "linear-gradient(135deg, var(--app-secondary), var(--app-accent))",
              }}
            >
              {!avatarUrl && (displayName.trim().slice(0, 1) || "学")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>
                  <Sparkles size={12} aria-hidden="true" />{roleLabel}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black"
                  style={emailConfirmed
                    ? { color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }
                    : { color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)" }}
                >
                  <ShieldCheck size={12} aria-hidden="true" />{emailConfirmed ? "邮箱已验证" : "邮箱待验证"}
                </span>
              </div>
              <h1 className="mt-2.5 truncate text-2xl font-black">{displayName}</h1>
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm app-muted-text"><Mail size={14} className="shrink-0" aria-hidden="true" />{email}</p>
            </div>
          </div>

          <div className="app-card w-full shrink-0 rounded-3xl border p-5 lg:w-80">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold app-muted-text">资料完成度</span>
              <strong className="text-lg" style={{ color: "var(--app-success)" }}>{completionPercent}%</strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--app-soft-bg)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${completionPercent}%`, background: "linear-gradient(90deg, var(--app-secondary), var(--app-success))" }} />
            </div>
            <p className="mt-3 text-xs leading-5 app-muted-text">
              {pendingItems.length === 0 ? "资料已全部完善，顾问可以给出最准确的规划建议。" : `已完成 ${doneCount}/${checklist.length} 项，资料越完整，留学与学习建议越准确。`}
            </p>
          </div>
        </div>

        {/* 账号元信息栏：原来的"账号记录"小卡片并进头部，一行读完 */}
        <div className="flex flex-col gap-3 border-t px-6 py-4 app-divider sm:flex-row sm:items-center sm:gap-8 sm:px-8">
          <p className="flex items-center gap-2 text-xs app-muted-text">
            <CalendarDays size={14} className="shrink-0" style={{ color: "var(--app-secondary)" }} aria-hidden="true" />
            加入时间<strong className="font-black" style={{ color: "var(--app-text)" }}>{createdAtLabel}</strong>
          </p>
          <p className="flex items-center gap-2 text-xs app-muted-text">
            <Clock3 size={14} className="shrink-0" style={{ color: "var(--app-accent)" }} aria-hidden="true" />
            最近登录<strong className="font-black" style={{ color: "var(--app-text)" }}>{lastSignInLabel}</strong>
          </p>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ProfileForm initialValue={initialValue} />

        {/* 右栏：资料完善清单，桌面端吸顶跟随滚动，随时能看到还差哪几项 */}
        <aside className="xl:sticky xl:top-6">
          <section className="app-card rounded-3xl border p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>
                <ListChecks size={19} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-black">资料完善清单</h2>
                <p className="mt-0.5 text-xs app-muted-text">已完成 {doneCount} / {checklist.length} 项</p>
              </div>
            </div>
            <ul className="mt-4 space-y-1">
              {checklist.map((item) => (
                <li key={item.label} className="app-flat-row flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm">
                  {item.done ? (
                    <CheckCircle2 size={16} className="shrink-0" style={{ color: "var(--app-success)" }} aria-hidden="true" />
                  ) : (
                    <Circle size={16} className="shrink-0" style={{ color: "var(--app-muted-light)" }} aria-hidden="true" />
                  )}
                  <span className={item.done ? "font-bold" : "font-bold app-muted-text"}>{item.label}</span>
                  {!item.done && <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-black" style={{ color: "var(--app-accent-strong)", backgroundColor: "var(--app-accent-soft)" }}>待完善</span>}
                </li>
              ))}
            </ul>
            {pendingItems.length > 0 && (
              <p className="app-soft-card mt-4 rounded-2xl border px-3.5 py-3 text-xs leading-5 app-muted-text">
                在左侧表单补全对应内容并保存后，清单会自动更新。
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
