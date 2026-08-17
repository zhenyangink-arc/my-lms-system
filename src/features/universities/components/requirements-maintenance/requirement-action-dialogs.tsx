"use client";

import { useFormStatus } from "react-dom";
import { Pencil } from "lucide-react";

import {
  updateUniversityDocumentRequirementAction,
  updateUniversityVisaRequirementAction,
} from "@/app/dashboard/admin/universities/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  UNIVERSITY_DOCUMENT_CATEGORY_LABELS,
  UNIVERSITY_VISA_STAGE_LABELS,
} from "../../constants/university-options";
import type {
  UniversityRequirementDisplayRow,
  UniversityVisaRequirementDisplayRow,
} from "./types";

const inputClass =
  "h-9 w-full border border-[var(--border)] bg-[var(--card)] px-3 text-xs outline-none focus:border-[var(--primary)]";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 bg-[var(--primary)] px-4 text-xs font-semibold text-white disabled:opacity-50"
    >
      {pending ? "正在保存…" : "保存修改"}
    </button>
  );
}

export function EditApplicationRequirementDialog({
  requirement,
}: {
  requirement: UniversityRequirementDisplayRow;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`编辑 ${requirement.title}`}
            className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)]"
          >
            <Pencil className="size-3" />编辑
          </button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>编辑申请要求</DialogTitle>
          <DialogDescription>{requirement.universityName}</DialogDescription>
        </DialogHeader>
        <form
          action={updateUniversityDocumentRequirementAction.bind(
            null,
            requirement.university_id,
            requirement.id,
          )}
          className="space-y-4"
        >
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>材料分类</span>
            <select name="category" defaultValue={requirement.category} className={inputClass}>
              {Object.entries(UNIVERSITY_DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>要求名称</span>
            <input name="title" required maxLength={100} defaultValue={requirement.title} className={inputClass} />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>补充说明</span>
            <textarea name="description" maxLength={300} rows={4} defaultValue={requirement.description ?? ""} className={`${inputClass} h-auto resize-y py-2 leading-5`} />
          </label>
          <DialogFooter className="mx-0 mb-0 rounded-none"><SaveButton /></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditVisaRequirementDialog({
  requirement,
}: {
  requirement: UniversityVisaRequirementDisplayRow;
}) {
  const isBachelorVisa = requirement.visa_type === "d2_bachelor";
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`编辑 ${requirement.title}`}
            className="inline-flex h-8 items-center gap-1.5 border border-[var(--border)] px-2.5 text-xs font-semibold text-[var(--foreground-secondary)]"
          >
            <Pencil className="size-3" />编辑
          </button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>编辑签证要求</DialogTitle>
          <DialogDescription>{requirement.universityName}</DialogDescription>
        </DialogHeader>
        <form
          action={updateUniversityVisaRequirementAction.bind(
            null,
            requirement.university_id,
            requirement.id,
          )}
          className="space-y-4"
        >
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>办理环节</span>
            <select name="stage" defaultValue={requirement.stage} className={inputClass}>
              {Object.entries(UNIVERSITY_VISA_STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>要求名称</span>
            <input name="title" required maxLength={100} defaultValue={requirement.title} className={inputClass} />
          </label>
          {isBachelorVisa && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold">适用阶段</legend>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input name="applicableScopes" type="checkbox" value="bachelor_fresh" defaultChecked={requirement.applicable_scopes.includes("bachelor_fresh")} />本科新入
                </label>
                <label className="flex items-center gap-2">
                  <input name="applicableScopes" type="checkbox" value="bachelor_transfer" defaultChecked={requirement.applicable_scopes.includes("bachelor_transfer")} />本科插班
                </label>
              </div>
            </fieldset>
          )}
          <label className="block space-y-1.5 text-xs font-semibold">
            <span>补充说明</span>
            <textarea name="description" maxLength={300} rows={4} defaultValue={requirement.description ?? ""} className={`${inputClass} h-auto resize-y py-2 leading-5`} />
          </label>
          <DialogFooter className="mx-0 mb-0 rounded-none"><SaveButton /></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
