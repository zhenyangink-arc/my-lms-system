import Link from "next/link";
import { Bell, GraduationCap, Home } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";

// 顶部栏只保留真实可用的入口，不再展示尚未接入后端的搜索和语言切换。
export async function GlobalTopbar() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const userName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";

  let unreadCount = 0;
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  if (profile?.role === "student") {
    const { data: answeredQuestions } = await supabase
      .from("lesson_questions")
      .select("id, answered_at, student_read_at, teacher_answer")
      .eq("student_id", user.id)
      .not("teacher_answer", "is", null);

    unreadCount = (answeredQuestions ?? []).filter(
      (row) =>
        !row.student_read_at ||
        (row.answered_at && row.student_read_at < row.answered_at)
    ).length;
  }

  return (
    <header className="app-topbar sticky top-0 z-30 flex h-[68px] items-center justify-between gap-4 border-b px-4 sm:px-6">
      <Link href={dashboardBasePath} className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{
            background:
              "linear-gradient(135deg, var(--app-secondary), var(--app-accent))",
          }}
        >
          <GraduationCap size={21} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-black tracking-tight">
            韩语教育
          </span>
          <span className="hidden truncate text-xs font-semibold app-muted-text sm:block">
            韩国留学与韩语成长工作台
          </span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeSwitcher />

        <Link
          href="/"
          className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition hover:-translate-y-0.5 sm:flex"
          style={{
            color: "var(--app-muted)",
            backgroundColor: "var(--app-soft-bg)",
          }}
        >
          <Home size={14} aria-hidden="true" />
          网站首页
        </Link>

        <Link
          href={`${dashboardBasePath}#reminders`}
          className="app-soft-card relative flex h-10 w-10 items-center justify-center rounded-xl border transition hover:-translate-y-0.5"
          title={unreadCount > 0 ? `${unreadCount} 条未读回复` : "暂无未读回复"}
          aria-label={unreadCount > 0 ? `${unreadCount} 条未读回复` : "暂无未读回复"}
        >
          <Bell size={17} aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <Link
          href={scopeDashboardPath("/dashboard/profile", dashboardBasePath)}
          className="app-soft-card flex items-center gap-2 rounded-xl border p-1.5 pr-2.5 transition hover:-translate-y-0.5"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black text-white"
            style={{ backgroundColor: "var(--app-success)" }}
          >
            {userName.trim().slice(0, 1) || "学"}
          </span>
          <span className="hidden max-w-28 truncate text-xs font-bold sm:block">
            {userName}
          </span>
        </Link>
      </div>
    </header>
  );
}
