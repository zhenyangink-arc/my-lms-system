"use client";

import { ArrowRight, BellRing, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export type TeacherReplyReminder = {
  id: string;
  title: string;
  subtitle: string;
  /** POST to this URL to mark as read and navigate to lesson */
  actionHref: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminders: TeacherReplyReminder[];
};

export function ReminderDialog({ open, onOpenChange, reminders }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/5"
        className="!max-w-[400px] gap-0 rounded-[20px] p-0 app-glass-panel overflow-hidden"
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <BellRing size={18} style={{ color: "var(--primary)" }} />
            通知提醒
          </DialogTitle>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-bold"
            style={{
              color: "var(--primary-hover)",
              backgroundColor: "var(--accent)",
            }}
          >
            {reminders.length} 项
          </span>
        </div>

        {/* 列表 */}
        <div className="max-h-[420px] overflow-y-auto">
          {reminders.length > 0 ? (
            <div className="divide-y app-divider">
              {reminders.map((item) =>
                item.actionHref ? (
                  <form key={item.id} action={item.actionHref} method="post">
                    <button
                      type="submit"
                      className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          color: "var(--primary)",
                          backgroundColor: "var(--accent)",
                        }}
                      >
                        <MessageSquare size={16} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs app-muted-text">
                          {item.subtitle}
                        </span>
                      </span>
                      <ArrowRight
                        size={15}
                        className="mt-1.5 shrink-0 app-muted-text"
                        aria-hidden="true"
                      />
                    </button>
                  </form>
                ) : (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-5 py-3"
                  >
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        color: "var(--primary)",
                        backgroundColor: "var(--accent)",
                      }}
                    >
                      <MessageSquare size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs app-muted-text">
                        {item.subtitle}
                      </span>
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "var(--accent)" }}
              >
                <BellRing
                  size={22}
                  style={{ color: "var(--primary)" }}
                  aria-hidden="true"
                />
              </span>
              <p className="mt-3 text-sm font-bold">暂时没有新提醒</p>
              <p className="mt-1 text-xs app-muted-text">
                老师回复你之后会出现在这里
              </p>
            </div>
          )}
        </div>

        {/* 底部关闭 */}
        <div className="border-t px-5 py-3 app-divider">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl py-2 text-xs font-bold transition hover:bg-[color-mix(in_srgb,var(--accent)_30%,transparent)]"
            style={{ color: "var(--foreground-muted)" }}
          >
            关闭
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
