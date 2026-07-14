import Link from "next/link";
import { Bell, GraduationCap, Globe, Search } from "lucide-react";

import { requireActiveUser } from "@/lib/auth";

/*
  全局顶部条

  贯穿页面最顶部的全宽横条，在侧边栏和内容区域之上。
  Logo 从原来的侧边栏挪到这里，因为它应该是"整个平台"的标识，
  不该随侧边栏收缩/展开而跟着变化。

  包含：
  1. Logo（PUFFY） —— 点击回到学生控制台
  2. 搜索框 —— 视觉占位，暂无搜索后端
  3. 语言切换 —— 视觉占位，暂无多语言系统
  4. 通知铃铛 —— 真实数据，仅学生角色统计"老师已回复但未读"的数量
  5. 用户名 —— 点击跳转个人资料页

  这是 Server Component（不是 "use client"），因为通知数量需要现查数据库。
*/
export async function GlobalTopbar() {
  let userName = "";
  let unreadCount = 0;

  const { supabase, user, profile } = await requireActiveUser();

  userName = profile?.full_name || user.email || "用户";

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
    <header
      className="app-sidebar flex items-center justify-between gap-4 border-b px-5 py-3"
      style={{ borderColor: "var(--app-border)" }}
    >
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white">
          <GraduationCap size={19} />
        </div>
        <span
          className="text-base font-black tracking-tight"
          style={{ color: "var(--app-text)" }}
        >
          PUFFY <span className="font-medium">(LMS)</span>
        </span>
      </Link>

      <div
        className="hidden max-w-sm flex-1 items-center gap-2 rounded-xl border px-3 py-2 opacity-60 lg:flex"
        style={{ borderColor: "var(--app-border)" }}
      >
        <Search size={15} className="app-muted-text shrink-0" />
        <input
          type="text"
          readOnly
          placeholder="搜索课程、内容或公告……（即将上线）"
          className="w-full bg-transparent text-sm outline-none app-muted-text"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <div
          className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold opacity-60 sm:flex"
          style={{ borderColor: "var(--app-border)" }}
        >
          <Globe size={13} className="app-muted-text" />
          <span className="app-muted-text">中文</span>
        </div>

        <Link
          href="/dashboard/announcements"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg transition hover:opacity-80"
          style={{ backgroundColor: "var(--app-soft-bg)" }}
          title={unreadCount > 0 ? `${unreadCount} 条未读提醒` : "暂无未读提醒"}
        >
          <Bell size={15} className="app-muted-text" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ backgroundColor: "var(--app-accent)" }}
            >
              {unreadCount}
            </span>
          )}
        </Link>

        <Link
          href="/dashboard/profile"
          className="hidden text-sm font-semibold transition hover:opacity-80 sm:block"
          style={{ color: "var(--app-text)" }}
        >
          {userName}
        </Link>
      </div>
    </header>
  );
}
