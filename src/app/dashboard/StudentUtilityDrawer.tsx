"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, GraduationCap, Home } from "lucide-react";

import { LogoutButton } from "./LogoutButton";
import { ReminderDialog, type TeacherReplyReminder } from "./ReminderDialog";

type Props = {
  tenantName: string;
  userName: string;
  accountLabel: string;
  unreadCount: number;
  teacherReminders: TeacherReplyReminder[];
  dashboardBasePath: string;
};

export function StudentUtilityDrawer({
  tenantName,
  unreadCount,
  teacherReminders,
}: Props) {
  const [reminderOpen, setReminderOpen] = useState(false);

  return (
    <>
      {/* 通知提醒 Dialog */}
      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        reminders={teacherReminders}
      />

      {/* 桌面端：固定右侧窄栏，hover 展开 */}
      <aside
        className="app-student-utility-sidebar group fixed right-0 top-0 z-40 hidden h-dvh flex-col md:flex"
        aria-label="设置与通知"
      >
        <nav className="flex flex-1 flex-col overflow-y-auto py-3">

          {/* 机构标识 */}
          <div className="app-student-utility-section px-1.5">
            <span
              className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{
                background: "linear-gradient(135deg, var(--app-secondary), var(--app-accent))",
              }}
            >
              <GraduationCap size={18} aria-hidden="true" />
            </span>
            <div className="app-student-utility-expanded min-w-0 text-center">
              <p className="truncate text-xs font-black tracking-tight">{tenantName}</p>
              <p className="truncate text-[9px] font-semibold app-muted-text">
                韩语成长工作台
              </p>
            </div>
          </div>

          <hr className="app-divider mx-2 my-2" />

          {/* 快捷入口 */}
          <div className="app-student-utility-section px-1.5">
            <Link
              href="/"
              title="网站首页"
              className="flex items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition hover:bg-[color-mix(in_srgb,var(--app-accent-soft)_40%,transparent)]"
              style={{ color: "var(--app-muted)" }}
            >
              <Home size={18} className="shrink-0" />
              <span className="app-student-utility-expanded truncate">网站首页</span>
            </Link>

            <button
              type="button"
              onClick={() => setReminderOpen(true)}
              title={unreadCount > 0 ? `${unreadCount} 条未读提醒` : "通知提醒"}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition hover:bg-[color-mix(in_srgb,var(--app-accent-soft)_40%,transparent)]"
              style={{ color: "var(--app-muted)" }}
            >
              <span className="relative shrink-0">
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2"
                    style={{
                      backgroundColor: "var(--app-warm)",
                      borderColor: "var(--app-card-bg)",
                    }}
                  />
                )}
              </span>
              <span className="app-student-utility-expanded min-w-0 truncate">通知提醒</span>
              {unreadCount > 0 && (
                <span
                  className="app-student-utility-expanded flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white"
                  style={{ backgroundColor: "var(--app-accent)" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>

          <hr className="app-divider mx-2 my-2" />

          {/* 底部退出按钮 */}
          <div className="mt-auto border-t pt-2 app-divider">
            <div className="app-student-utility-section px-1.5">
              <div className="flex justify-center group-hover:hidden">
                <LogoutButton collapsed />
              </div>
              <div className="app-student-utility-expanded w-full">
                <LogoutButton />
              </div>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
