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
  formatFileSize,
  LIBRARY_CATEGORY_LABELS,
  LIBRARY_RESOURCE_TYPE_LABELS,
  LIBRARY_STATUS_LABELS,
} from "@/app/dashboard/library/config";
import type { LibraryResourceDisplayRow } from "./types";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

export function ResourceDetailDialog({
  resource,
}: {
  resource: LibraryResourceDisplayRow;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="h-8 rounded-md border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)] transition-colors hover:bg-[var(--app-soft-bg)]"
      >
        查看详情
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{resource.title}</DialogTitle>
          <DialogDescription>
            {resource.targetLabel}・{LIBRARY_STATUS_LABELS[resource.status]}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid border border-[var(--app-border)] text-xs sm:grid-cols-2">
          <DetailItem label="课程分组" value={resource.groupTitle} />
          <DetailItem label="所属课程" value={resource.courseLabel} />
          <DetailItem label="资料位置" value={resource.lessonLabel} />
          <DetailItem
            label="资料分类"
            value={LIBRARY_CATEGORY_LABELS[resource.category]}
          />
          <DetailItem
            label="资料类型"
            value={LIBRARY_RESOURCE_TYPE_LABELS[resource.resource_type]}
          />
          <DetailItem
            label="文件大小"
            value={formatFileSize(resource.file_size)}
          />
          <DetailItem
            label="原始文件名"
            value={resource.original_file_name ?? "外部链接"}
          />
          <DetailItem label="下载次数" value={`${resource.download_count} 次`} />
          <DetailItem label="排序序号" value={resource.sort_order} />
          <DetailItem
            label="最近更新"
            value={
              <LocalDateTime
                value={resource.updated_at}
                options={DATE_OPTIONS}
                fallback="时间待确认"
              />
            }
          />
        </dl>
        <section className="border border-[var(--app-border)] bg-[var(--app-soft-bg)] px-4 py-4">
          <p className="text-xs font-semibold text-[var(--app-muted)]">资料说明</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--app-text-soft)]">
            {resource.description || "暂无资料说明"}
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
    <div className="border-b border-[var(--app-border-soft)] px-3 py-3 odd:sm:border-r">
      <dt className="text-[var(--app-muted)]">{label}</dt>
      <dd className="mt-1 break-words font-medium text-[var(--app-text)]">
        {value}
      </dd>
    </div>
  );
}
