"use client";

import { useFormStatus } from "react-dom";

import { toggleUniversityPublishedAction } from "@/app/dashboard/admin/universities/actions";
import type { ManagedUniversity } from "../../api/types";
import { EditUniversityDialog } from "../university-action-dialogs";

function PublishButton({ isPublished }: { isPublished: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`h-8 border px-2.5 text-xs font-semibold disabled:opacity-50 ${
        isPublished
          ? "border-amber-200 text-amber-700"
          : "border-emerald-200 text-emerald-700"
      }`}
    >
      {pending ? "处理中…" : isPublished ? "下架" : "发布"}
    </button>
  );
}

export function UniversityCellAction({
  university,
  canPermanentlyDelete,
}: {
  university: ManagedUniversity;
  canPermanentlyDelete: boolean;
}) {
  return (
    <div className="flex min-w-36 items-center justify-end gap-2">
      <form
        action={toggleUniversityPublishedAction.bind(
          null,
          university.id,
          !university.is_published,
        )}
      >
        <PublishButton isPublished={university.is_published} />
      </form>
      <EditUniversityDialog
        university={university}
        canPermanentlyDelete={canPermanentlyDelete}
      />
    </div>
  );
}
