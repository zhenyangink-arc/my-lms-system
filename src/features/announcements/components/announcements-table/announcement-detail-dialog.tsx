"use client";

import { LocalDateTime } from "@/components/LocalDateTime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/app/dashboard/announcements/config";
import type { ManagedAnnouncement } from "../../api/types";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function AnnouncementDetailDialog({
  announcement,
}: {
  announcement: ManagedAnnouncement;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="h-8 rounded-md border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--surface-soft)]"
      >
        查看详情
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{announcement.title}</DialogTitle>
          <DialogDescription>
            {announcement.scope === "platform"
              ? "平台公告"
              : announcement.tenantName}
            ・{STATUS_LABELS[announcement.status]}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid border border-[var(--border)] text-xs sm:grid-cols-2">
          <DetailItem label="公告分类" value={CATEGORY_LABELS[announcement.category]} />
          <DetailItem label="重要程度" value={PRIORITY_LABELS[announcement.priority]} />
          <DetailItem label="发布人" value={announcement.authorName} />
          <DetailItem
            label="阅读情况"
            value={`${announcement.readCount} / ${announcement.audienceCount}`}
          />
          <DetailItem
            label="发布时间"
            value={
              <LocalDateTime
                value={announcement.publishedAt}
                options={DATE_OPTIONS}
                fallback="尚未发布"
              />
            }
          />
          <DetailItem
            label="最近更新"
            value={
              <LocalDateTime
                value={announcement.updatedAt}
                options={DATE_OPTIONS}
                fallback="时间待确认"
              />
            }
          />
        </dl>
        <section className="border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4">
          <p className="text-xs font-semibold text-[var(--foreground-muted)]">公告正文</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--foreground-secondary)]">
            {announcement.content}
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--border-subtle)] px-3 py-3 odd:sm:border-r">
      <dt className="text-[var(--foreground-muted)]">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
