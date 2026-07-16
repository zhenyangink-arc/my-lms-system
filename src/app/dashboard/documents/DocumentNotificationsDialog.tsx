"use client";

import { Bell } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DocumentEvent = {
  id: number;
  document_id: string;
  event_type: string;
  note: string | null;
  created_at: string;
};

const DOCUMENT_NOTIFICATION_LABELS: Record<string, string> = {
  submitted: "您提交了",
  review_started: "管理员开始审核",
  approved: "管理员确认通过",
  revision_requested: "管理员要求补充",
};

const DOCUMENT_NOTIFICATION_ICONS: Record<string, string> = {
  submitted: "📄",
  review_started: "🔍",
  approved: "✅",
  revision_requested: "⚠️",
};

const DOCUMENT_NOTIFICATION_DOT_COLORS: Record<string, string> = {
  submitted: "var(--app-accent)",
  review_started: "var(--app-secondary)",
  approved: "var(--app-success)",
  revision_requested: "var(--app-warm)",
};

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待确认";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function DocumentNotificationsDialog({ notifications, documentTitleById }: { notifications: DocumentEvent[]; documentTitleById: Record<string, string> }) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="app-soft-card relative inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-black transition hover:-translate-y-0.5 hover:opacity-90"
        style={{ color: "var(--app-secondary)" }}
      >
        <Bell size={15} />通知区
        {notifications.length > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black text-white" style={{ backgroundColor: "var(--app-warm)" }}>{notifications.length}</span>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>通知区</DialogTitle>
          <DialogDescription>最近的材料提交与审核动态。</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-3.5 overflow-y-auto">
          {notifications.map((event) => (
            <div key={event.id} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: DOCUMENT_NOTIFICATION_DOT_COLORS[event.event_type] ?? "var(--app-accent)" }} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-5"><span className="mr-1" aria-hidden="true">{DOCUMENT_NOTIFICATION_ICONS[event.event_type] ?? "📄"}</span>{DOCUMENT_NOTIFICATION_LABELS[event.event_type] ?? "更新了"}{documentTitleById[event.document_id] ?? "申请材料"}</p>
                {event.event_type === "revision_requested" && event.note && <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--app-warm)" }}>{event.note}</p>}
                <p className="app-muted-text mt-0.5 text-[11px] font-bold">{formatShortDateTime(event.created_at)}</p>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="app-soft-card rounded-2xl border border-dashed p-6 text-center">
              <p className="text-xs font-black app-muted-text">暂无最新动态，提交或审核后会在这里提醒你。</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
