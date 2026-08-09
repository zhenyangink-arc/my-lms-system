"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  createUniversityAction,
  deleteUniversityAction,
  updateUniversityAction,
} from "@/app/dashboard/admin/universities/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type {
  ManagedUniversity,
  UniversityAdmissionStage,
  UniversityDisciplineGroup,
} from "../api/types";
import {
  KOREAN_UNIVERSITY_REGIONS,
  UNIVERSITY_ADMISSION_STAGE_LABELS,
  UNIVERSITY_DISCIPLINE_GROUP_LABELS,
  UNIVERSITY_OWNERSHIP_LABELS,
} from "../constants/university-options";

const inputClass =
  "h-9 w-full border border-[var(--app-border)] bg-[var(--app-input-bg)] px-3 text-xs outline-none focus:border-[var(--app-accent)]";
const textareaClass = `${inputClass} h-auto resize-y py-2 leading-5`;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 bg-[var(--app-accent)] px-4 text-xs font-semibold text-white disabled:opacity-50"
    >
      {pending ? "正在保存…" : label}
    </button>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
    >
      {pending ? "正在删除…" : "确认永久删除"}
    </AlertDialogAction>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-semibold text-[var(--app-text-soft)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function UniversityFormFields({ university }: { university?: ManagedUniversity }) {
  const selectedStages =
    university?.admission_stages ??
    Object.keys(UNIVERSITY_ADMISSION_STAGE_LABELS);
  const selectedDisciplines =
    university?.discipline_groups ??
    Object.keys(UNIVERSITY_DISCIPLINE_GROUP_LABELS);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="中文名称">
          <input name="nameZh" required minLength={2} maxLength={80} defaultValue={university?.name_zh} className={inputClass} />
        </Field>
        <Field label="韩文名称">
          <input name="nameKo" required minLength={2} maxLength={100} defaultValue={university?.name_ko} className={inputClass} />
        </Field>
        <Field label="学校性质">
          <select name="ownership" defaultValue={university?.ownership ?? "private"} className={inputClass}>
            {Object.entries(UNIVERSITY_OWNERSHIP_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="推荐顺序">
          <input name="sortOrder" type="number" min="0" required defaultValue={university?.sort_order ?? 1100} className={inputClass} />
        </Field>
        <Field label="所在地区">
          <select name="province" defaultValue={university?.province ?? "首尔特别市"} className={inputClass}>
            {KOREAN_UNIVERSITY_REGIONS.map((region) => <option key={region}>{region}</option>)}
          </select>
        </Field>
        <Field label="所在城市">
          <input name="city" required defaultValue={university?.city ?? "首尔"} className={inputClass} />
        </Field>
      </div>

      <Field label="校徽图片地址">
        <input name="logoUrl" type="url" placeholder="https://…" defaultValue={university?.logo_url ?? ""} className={inputClass} />
      </Field>

      <div className="flex flex-wrap gap-5 text-xs text-[var(--app-text-soft)]">
        <label className="flex items-center gap-2">
          <input name="isFeatured" type="checkbox" defaultChecked={university?.is_featured ?? false} />
          重点推荐
        </label>
        <label className="flex items-center gap-2">
          <input name="isPublished" type="checkbox" defaultChecked={university?.is_published ?? true} />
          对学生展示
        </label>
      </div>

      <Field label="学校介绍">
        <textarea name="summary" required minLength={10} maxLength={800} rows={4} defaultValue={university?.summary ?? "请填写学校定位、教学特色、适合学生和申请注意事项。"} className={textareaClass} />
      </Field>
      <Field label="院校亮点">
        <textarea name="highlights" rows={3} defaultValue={university?.highlights.join("\n") ?? "国际学生支持\n专业选择丰富\n校园生活便利"} className={textareaClass} placeholder="逗号或换行分隔，最多八项" />
      </Field>
      <Field label="详细介绍">
        <textarea name="detailedIntroduction" maxLength={12000} rows={6} defaultValue={university?.detailed_introduction ?? university?.summary ?? ""} className={textareaClass} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="学费参考年份"><input name="tuitionReferenceYear" type="number" min="2000" required defaultValue={university?.tuition_reference_year ?? 2025} className={inputClass} /></Field>
        <Field label="韩元学费下限"><input name="tuitionMinKrw" type="number" min="0" required defaultValue={university?.tuition_min_krw ?? 6_500_000} className={inputClass} /></Field>
        <Field label="韩元学费上限"><input name="tuitionMaxKrw" type="number" min="0" required defaultValue={university?.tuition_max_krw ?? 14_000_000} className={inputClass} /></Field>
        <Field label="人民币学费下限"><input name="tuitionMinCny" type="number" min="20000" required defaultValue={university?.tuition_min_cny ?? 35_000} className={inputClass} /></Field>
        <Field label="人民币学费上限"><input name="tuitionMaxCny" type="number" min="20000" required defaultValue={university?.tuition_max_cny ?? 78_000} className={inputClass} /></Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-[var(--app-text-soft)]">申请阶段</legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(UNIVERSITY_ADMISSION_STAGE_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs">
              <input name="admissionStages" type="checkbox" value={value} defaultChecked={selectedStages.includes(value as UniversityAdmissionStage)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-[var(--app-text-soft)]">优势学科</legend>
        <div className="flex flex-wrap gap-4">
          {Object.entries(UNIVERSITY_DISCIPLINE_GROUP_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs">
              <input name="disciplineGroups" type="checkbox" value={value} defaultChecked={selectedDisciplines.includes(value as UniversityDisciplineGroup)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(UNIVERSITY_ADMISSION_STAGE_LABELS).map(([value, label]) => (
          <Field key={value} label={`${label}截止日期`}>
            <input name={`deadline_${value}`} type="date" defaultValue={university?.application_deadlines?.[value as keyof ManagedUniversity["application_deadlines"]] ?? ""} className={inputClass} />
          </Field>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="世界排名显示"><input name="qsRankDisplay" defaultValue={university?.qs_rank_display ?? ""} className={inputClass} /></Field>
        <Field label="世界排名排序值"><input name="qsRankSort" type="number" min="0" defaultValue={university?.qs_rank_sort ?? ""} className={inputClass} /></Field>
        <Field label="世界排名年份"><input name="qsRankingYear" type="number" min="2000" defaultValue={university?.qs_ranking_year ?? ""} className={inputClass} /></Field>
        <Field label="韩国排名显示"><input name="joongangRankDisplay" defaultValue={university?.joongang_rank_display ?? ""} className={inputClass} /></Field>
        <Field label="韩国排名排序值"><input name="joongangRankSort" type="number" min="0" defaultValue={university?.joongang_rank_sort ?? ""} className={inputClass} /></Field>
        <Field label="韩国排名年份"><input name="joongangRankingYear" type="number" min="2000" defaultValue={university?.joongang_ranking_year ?? ""} className={inputClass} /></Field>
      </div>
    </div>
  );
}

function PermanentUniversityDelete({ university }: { university: ManagedUniversity }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger className="inline-flex h-9 items-center gap-2 border border-red-200 px-3 text-xs font-semibold text-red-700">
        <Trash2 className="size-3.5" />永久删除大学
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>永久删除“{university.name_zh}”</AlertDialogTitle>
          <AlertDialogDescription>
            仅平台负责人可以执行。有关联学生目标、对比或评估记录时，服务端会拒绝删除。该操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <form action={deleteUniversityAction.bind(null, university.id)}>
            <DeleteSubmitButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CreateUniversityDialog() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex h-9 items-center gap-2 bg-[var(--app-accent)] px-4 text-xs font-semibold text-white">
        <Plus className="size-3.5" />新增大学
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[980px]">
        <DialogHeader className="border-b border-[var(--app-border)] px-6 py-4">
          <DialogTitle>新增大学</DialogTitle>
          <DialogDescription>内部技术标识由系统生成，只需维护学生可见资料。</DialogDescription>
        </DialogHeader>
        <form action={createUniversityAction} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6"><UniversityFormFields /></div>
          <DialogFooter className="mx-0 mb-0 rounded-none px-6"><SubmitButton label="新增大学" /></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditUniversityDialog({
  university,
  canPermanentlyDelete,
}: {
  university: ManagedUniversity;
  canPermanentlyDelete: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex h-8 items-center gap-1.5 border border-[var(--app-border)] px-2.5 text-xs font-semibold text-[var(--app-text-soft)]">
        <Pencil className="size-3" />编辑
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[980px]">
        <DialogHeader className="border-b border-[var(--app-border)] px-6 py-4">
          <DialogTitle>编辑大学资料</DialogTitle>
          <DialogDescription>{university.name_zh} · {university.name_ko}</DialogDescription>
        </DialogHeader>
        <form action={updateUniversityAction.bind(null, university.id)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6"><UniversityFormFields university={university} /></div>
          <DialogFooter className="mx-0 mb-0 rounded-none px-6"><SubmitButton label="保存大学资料" /></DialogFooter>
        </form>
        {canPermanentlyDelete && (
          <div className="border-t border-red-100 bg-red-50/60 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-red-700">危险操作仅限平台负责人，并需要再次确认。</p>
              <PermanentUniversityDelete university={university} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
