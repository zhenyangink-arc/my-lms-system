"use client";

import { useActionState, useState } from "react";
import { Archive, Download, Eye, FilePenLine, Send } from "lucide-react";

import type { LibraryCourseOption } from "@/app/dashboard/admin/library/LibraryResourceForm";
import { initialLibraryActionState } from "@/app/dashboard/library/action-state";
import { changeLibraryResourceStatusAction } from "@/app/dashboard/library/actions";
import type { LibraryStatus } from "@/app/dashboard/library/config";
import { Icons } from "@/components/icons";
import { EditLibraryResourceDialog } from "../library-action-dialogs";
import type { LibraryResourceDisplayRow } from "./types";

export function LibraryResourceCellAction({
  resource,
  course,
  courses,
  canCurate,
}: {
  resource: LibraryResourceDisplayRow;
  course?: LibraryCourseOption;
  courses: LibraryCourseOption[];
  canCurate: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <a
          href={`/api/library/${resource.id}/download?mode=view`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 border border-[var(--border)] px-2 text-xs font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
        >
          <Eye className="size-3.5" aria-hidden="true" />
          查看
        </a>
        <a
          href={`/api/library/${resource.id}/download`}
          className="inline-flex h-8 items-center gap-1 border border-[var(--border)] px-2 text-xs font-semibold text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
        >
          <Download className="size-3.5" aria-hidden="true" />
          下载
        </a>
        {canCurate && (
          <details className="group relative inline-block text-left">
            <summary
              className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-[var(--foreground-muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
              aria-label="打开资料操作"
            >
              <Icons.more className="size-4" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-30 mt-1 w-44 border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
              {course ? (
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium text-[var(--foreground-secondary)] hover:bg-[var(--surface-soft)]"
                >
                  <Icons.edit className="size-3.5" aria-hidden="true" />
                  编辑资料
                </button>
              ) : (
                <p className="px-2 py-2 text-[11px] text-amber-700">
                  课程目录无法识别，暂不能编辑
                </p>
              )}
              <div className="my-1 border-t border-[var(--border)]" />
              {resource.status !== "published" && (
                <StatusActionButton
                  resourceId={resource.id}
                  status="published"
                  label="发布"
                />
              )}
              {resource.status !== "draft" && (
                <StatusActionButton
                  resourceId={resource.id}
                  status="draft"
                  label="转为草稿"
                />
              )}
              {resource.status !== "archived" && (
                <StatusActionButton
                  resourceId={resource.id}
                  status="archived"
                  label="下架"
                />
              )}
            </div>
          </details>
        )}
      </div>
      {course && (
        <EditLibraryResourceDialog
          course={course}
          courses={courses}
          resource={resource}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </>
  );
}

function StatusActionButton({
  resourceId,
  status,
  label,
}: {
  resourceId: string;
  status: LibraryStatus;
  label: string;
}) {
  const action = changeLibraryResourceStatusAction.bind(
    null,
    resourceId,
    status,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialLibraryActionState,
  );
  const Icon =
    status === "published"
      ? Send
      : status === "archived"
        ? Archive
        : FilePenLine;

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={pending}
        className={`flex w-full items-center gap-2 px-2 py-2 text-left text-xs font-medium hover:bg-[var(--surface-soft)] disabled:opacity-50 ${
          status === "archived"
            ? "text-amber-700"
            : status === "published"
              ? "text-emerald-700"
              : "text-[var(--foreground-secondary)]"
        }`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {pending ? "处理中…" : label}
      </button>
      {state.status === "error" && (
        <span className="block px-2 py-1 text-[11px] font-medium text-rose-700">
          {state.message}
        </span>
      )}
    </form>
  );
}
