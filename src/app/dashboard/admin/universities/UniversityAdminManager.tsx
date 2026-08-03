"use client";

import { Fragment, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, ChevronRight, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SchoolCrest } from "@/components/school/SchoolCrest";
import {
  createUniversityDocumentRequirementAction,
  createUniversityAction,
  createUniversityVisaRequirementAction,
  deleteUniversityDocumentRequirementAction,
  deleteUniversityAction,
  deleteUniversityVisaRequirementAction,
  toggleUniversityPublishedAction,
  updateUniversityDocumentRequirementAction,
  updateUniversityAction,
  updateUniversityVisaRequirementAction,
} from "./actions";
import type { UniversityDocumentRequirement } from "./UniversityRequirementsDialog";
import type { UniversityVisaRequirement } from "./UniversityVisaRequirementsDialog";

export type AdminUniversity = {
  id: string;
  name_zh: string;
  name_ko: string;
  logo_url: string | null;
  ownership: "national" | "public" | "private";
  province: string;
  city: string;
  admission_stages: string[];
  discipline_groups: string[];
  tuition_min_krw: number;
  tuition_max_krw: number;
  tuition_min_cny: number;
  tuition_max_cny: number;
  tuition_reference_year: number;
  qs_rank_display: string | null;
  qs_rank_sort: number | null;
  qs_ranking_year: number | null;
  joongang_rank_display: string | null;
  joongang_rank_sort: number | null;
  joongang_ranking_year: number | null;
  summary: string;
  detailed_introduction: string | null;
  highlights: string[];
  application_deadlines: Partial<Record<"language" | "bachelor_fresh" | "bachelor_transfer" | "master" | "doctor", string>>;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
};

const ownershipOptions = [["national", "国立"], ["public", "公立"], ["private", "私立"]] as const;
const ownershipLabels = Object.fromEntries(ownershipOptions) as Record<string, string>;
const stageOptions = [["language", "语学堂"], ["bachelor_fresh", "本科新入"], ["bachelor_transfer", "本科插班"], ["master", "硕士"], ["doctor", "博士"]] as const;
const disciplineOptions = [["humanities_social", "人文社会"], ["science", "理科"], ["natural_sciences", "自然"], ["medicine", "医学"]] as const;
const regionOptions = ["首尔特别市", "釜山广域市", "大邱广域市", "仁川广域市", "光州广域市", "大田广域市", "蔚山广域市", "世宗特别自治市", "京畿道", "江原特别自治道", "忠清北道", "忠清南道", "全北特别自治道", "全罗南道", "庆尚北道", "庆尚南道", "济州特别自治道"];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"><Save size={14} />{pending ? "正在保存…" : label}</button>;
}

function RowSubmitButton({ label = "保存" }: { label?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} type="submit" className="text-[10px] font-medium text-zinc-950 underline-offset-4 hover:underline disabled:opacity-50">{pending ? "保存中…" : label}</button>;
}

const inputClass = "w-full border-0 bg-transparent px-0 py-1.5 text-[11px] text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:bg-zinc-50/70";

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-black/[0.065] last:border-b-0">
      <th className="w-[145px] border-r border-black/[0.065] px-4 py-3 text-left text-[10px] font-medium text-zinc-500 align-top">
        {label}
      </th>
      <td className="px-4 py-2">{children}</td>
    </tr>
  );
}

function UniversityFormFields({ university }: { university?: AdminUniversity }) {
  const isNew = !university;
  const defaultStages = university?.admission_stages ?? stageOptions.map(([value]) => value);
  const defaultDisciplines = university?.discipline_groups ?? disciplineOptions.map(([value]) => value);

  return (
    <div className="overflow-x-auto border border-black/[0.08]">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <tbody>
          <FormRow label="学校名称">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="nameZh" required minLength={2} maxLength={80} defaultValue={university?.name_zh} className={inputClass} placeholder="中文名称" />
              <input name="nameKo" required minLength={2} maxLength={100} defaultValue={university?.name_ko} className={inputClass} placeholder="韩文名称" />
            </div>
          </FormRow>
          <FormRow label="性质与排序">
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="ownership" defaultValue={university?.ownership ?? "private"} className={inputClass}>{ownershipOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <input name="sortOrder" type="number" min="0" required defaultValue={university?.sort_order ?? 1100} className={inputClass} placeholder="推荐顺序" />
            </div>
          </FormRow>
          <FormRow label="所在地区">
            <div className="grid gap-3 sm:grid-cols-2">
              <select name="province" defaultValue={university?.province ?? "首尔特别市"} className={inputClass}>{regionOptions.map((region) => <option key={region}>{region}</option>)}</select>
              <input name="city" required defaultValue={university?.city ?? "首尔"} className={inputClass} placeholder="所在城市" />
            </div>
          </FormRow>
          <FormRow label="校徽图片"><input name="logoUrl" type="url" placeholder="https://…" defaultValue={university?.logo_url ?? ""} className={inputClass} /></FormRow>
          <FormRow label="展示设置">
            <div className="flex flex-wrap gap-6 py-1 text-[11px] font-normal text-zinc-700">
              <label className="flex items-center gap-2"><input name="isFeatured" type="checkbox" defaultChecked={university?.is_featured ?? false} />重点推荐</label>
              <label className="flex items-center gap-2"><input name="isPublished" type="checkbox" defaultChecked={university?.is_published ?? true} />对学生展示</label>
            </div>
          </FormRow>
          <FormRow label="学校介绍"><textarea name="summary" required minLength={10} maxLength={800} rows={4} defaultValue={university?.summary ?? "请在这里填写学校定位、教学特色、适合学生和申请注意事项。"} className={`${inputClass} resize-y leading-6`} /></FormRow>
          <FormRow label="院校亮点"><textarea name="highlights" rows={3} defaultValue={university?.highlights.join("\n") ?? "国际学生支持\n专业选择丰富\n校园生活便利"} className={`${inputClass} resize-y leading-6`} placeholder="逗号或换行分隔，最多八项" /></FormRow>
          <FormRow label="详细介绍"><textarea name="detailedIntroduction" maxLength={12000} rows={6} defaultValue={university?.detailed_introduction ?? university?.summary ?? ""} className={`${inputClass} resize-y leading-6`} /></FormRow>
          <FormRow label="学费参考">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <input name="tuitionReferenceYear" type="number" min="2000" required defaultValue={university?.tuition_reference_year ?? 2025} className={inputClass} placeholder="参考年份" />
              <input name="tuitionMinKrw" type="number" min="0" required defaultValue={university?.tuition_min_krw ?? 6_500_000} className={inputClass} placeholder="韩元下限" />
              <input name="tuitionMaxKrw" type="number" min="0" required defaultValue={university?.tuition_max_krw ?? 14_000_000} className={inputClass} placeholder="韩元上限" />
              <input name="tuitionMinCny" type="number" min="20000" required defaultValue={university?.tuition_min_cny ?? 35_000} className={inputClass} placeholder="人民币下限" />
              <input name="tuitionMaxCny" type="number" min="20000" required defaultValue={university?.tuition_max_cny ?? 78_000} className={inputClass} placeholder="人民币上限" />
            </div>
          </FormRow>
          <FormRow label="申请阶段"><div className="flex flex-wrap gap-4 py-1">{stageOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-[11px] font-normal text-zinc-700"><input name="admissionStages" type="checkbox" value={value} defaultChecked={defaultStages.includes(value)} />{label}</label>)}</div></FormRow>
          <FormRow label="优势学科"><div className="flex flex-wrap gap-4 py-1">{disciplineOptions.map(([value, label]) => <label key={value} className="flex items-center gap-2 text-[11px] font-normal text-zinc-700"><input name="disciplineGroups" type="checkbox" value={value} defaultChecked={defaultDisciplines.includes(value)} />{label}</label>)}</div></FormRow>
          <FormRow label="申请截止日期">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{stageOptions.map(([value, label]) => <label key={value} className="text-[9px] font-medium text-zinc-500">{label}<input name={`deadline_${value}`} type="date" defaultValue={university?.application_deadlines?.[value] ?? ""} className={`${inputClass} mt-1`} /></label>)}</div>
          </FormRow>
          <FormRow label="世界大学排名">
            <div className="grid gap-3 sm:grid-cols-3"><input name="qsRankDisplay" placeholder="显示值" defaultValue={university?.qs_rank_display ?? ""} className={inputClass} /><input name="qsRankSort" type="number" min="0" defaultValue={university?.qs_rank_sort ?? ""} className={inputClass} placeholder="排序值" /><input name="qsRankingYear" type="number" min="2000" defaultValue={university?.qs_ranking_year ?? ""} className={inputClass} placeholder="年份" /></div>
          </FormRow>
          <FormRow label="中央日报排名">
            <div className="grid gap-3 sm:grid-cols-3"><input name="joongangRankDisplay" placeholder="显示值" defaultValue={university?.joongang_rank_display ?? ""} className={inputClass} /><input name="joongangRankSort" type="number" min="0" defaultValue={university?.joongang_rank_sort ?? ""} className={inputClass} placeholder="排序值" /><input name="joongangRankingYear" type="number" min="2000" defaultValue={university?.joongang_ranking_year ?? ""} className={inputClass} placeholder="年份" /></div>
          </FormRow>
          {isNew && <FormRow label="说明"><p className="app-muted-text text-xs">内部技术标识由系统自动生成，只需维护学生能看到的资料。</p></FormRow>}
        </tbody>
      </table>
    </div>
  );
}

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      className="gap-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
    >
      <Trash2 size={14} />
      {pending ? "正在删除…" : "确认永久删除"}
    </AlertDialogAction>
  );
}

function UniversityDeleteDialog({ university }: { university: AdminUniversity }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        type="button"
        className="text-[10px] font-medium text-red-600 transition hover:text-red-700 hover:underline hover:underline-offset-4"
      >
        删除
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black">永久删除 {university.name_zh}？</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            只有在该大学没有任何学生目标、对比或评估记录时才能永久删除；有关联数据时请改用“停止展示”。
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

const documentCategoryOptions = [["identity", "身份材料"], ["academic", "学历材料"], ["application", "申请材料"], ["financial", "财力材料"], ["language", "语言材料"]] as const;
const visaStageOptions = [["admission", "录取材料"], ["identity", "身份材料"], ["finance", "财力证明"], ["application", "申请准备"], ["appointment", "预约"], ["submission", "递交"], ["result", "结果"], ["entry", "入境"]] as const;
const studyStageGroups = [
  { key: "language", label: "语学院", dot: "bg-teal-500", text: "text-teal-700", border: "border-l-teal-500" },
  { key: "bachelor_fresh", label: "本科新入", dot: "bg-sky-500", text: "text-sky-700", border: "border-l-sky-500" },
  { key: "bachelor_transfer", label: "本科插班", dot: "bg-violet-500", text: "text-violet-700", border: "border-l-violet-500" },
  { key: "master", label: "硕士", dot: "bg-amber-500", text: "text-amber-700", border: "border-l-amber-500" },
  { key: "doctor", label: "博士", dot: "bg-rose-500", text: "text-rose-700", border: "border-l-rose-500" },
] as const;
const visaTypeGroups = [
  { key: "d4_language", label: "语学院 · D-4", shortLabel: "语学院", dot: "bg-teal-500", text: "text-teal-700", border: "border-l-teal-500" },
  { key: "d2_bachelor", label: "本科新入 / 插班 · D-2", shortLabel: "本科", dot: "bg-sky-500", text: "text-sky-700", border: "border-l-sky-500" },
  { key: "d2_master", label: "硕士 · D-2", shortLabel: "硕士", dot: "bg-amber-500", text: "text-amber-700", border: "border-l-amber-500" },
  { key: "d2_doctor", label: "博士 · D-2", shortLabel: "博士", dot: "bg-rose-500", text: "text-rose-700", border: "border-l-rose-500" },
] as const;
const applicableScopeLabels: Record<string, string> = { language: "语学院", bachelor_fresh: "本科新入", bachelor_transfer: "本科插班", master: "硕士", doctor: "博士" };

const inlineInputClass = "w-full min-w-0 border-0 bg-transparent px-2 py-1.5 text-[11px] outline-none ring-1 ring-inset ring-black/10 focus:ring-black/25";

function DocumentRequirementsTable({ universityId, requirements, canManage }: { universityId: string; requirements: UniversityDocumentRequirement[]; canManage: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("academic");
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set());

  function toggleStage(stage: string) {
    setExpandedStages((current) => {
      const next = new Set(current);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto border border-black/[0.08]">
      <table className="w-full min-w-[700px] border-collapse text-left text-[11px]">
        <thead><tr className="h-9 border-b border-black/[0.08] text-[9px] uppercase tracking-[0.06em] text-zinc-500"><th className="w-[115px] px-3 font-medium">分类</th><th className="w-[190px] px-3 font-medium">材料名称</th><th className="px-3 font-medium">说明</th><th className="w-[60px] px-3 font-medium">排序</th>{canManage && <th className="w-[105px] px-3 text-right font-medium">操作</th>}</tr></thead>
        <tbody>
          {studyStageGroups.map((stage) => {
            const items = requirements.filter((item) => item.admission_stage === stage.key).sort((left, right) => left.sort_order - right.sort_order);
            const expanded = expandedStages.has(stage.key);
            const newFormId = `new-document-${universityId}-${stage.key}`;
            return <Fragment key={stage.key}>
              <tr className={`border-b border-l-2 border-black/[0.08] bg-zinc-50/50 ${stage.border}`}><td colSpan={canManage ? 5 : 4} className="p-0"><button type="button" onClick={() => toggleStage(stage.key)} className="flex h-10 w-full items-center gap-2 px-3 text-left">{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span className={`size-1.5 rounded-full ${stage.dot}`} /><span className={`text-[11px] font-medium ${stage.text}`}>{stage.label}</span><span className="ml-auto font-mono text-[9px] tabular-nums text-zinc-400">{items.length} 项</span></button></td></tr>
              {expanded && addingStage === stage.key && <tr className="border-b border-black/[0.06] bg-zinc-50/60"><td className="p-1.5"><select value={newCategory} onChange={(event) => setNewCategory(event.target.value)} className={inlineInputClass}>{documentCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-1.5"><input form={newFormId} name="title" required maxLength={100} className={inlineInputClass} placeholder="材料名称" /></td><td className="p-1.5"><input form={newFormId} name="description" maxLength={300} className={inlineInputClass} placeholder="补充说明，可留空" /></td><td className="px-3 font-mono text-zinc-400">自动</td><td className="px-3"><div className="flex justify-end gap-3"><form id={newFormId} action={createUniversityDocumentRequirementAction.bind(null, universityId, stage.key, newCategory)}><RowSubmitButton label="新增" /></form><button type="button" onClick={() => setAddingStage(null)} className="text-[10px] text-zinc-500 hover:text-zinc-950">取消</button></div></td></tr>}
              {expanded && items.map((item) => {
                const formId = `document-requirement-${item.id}`;
                const editing = editingId === item.id;
                return editing ? <tr key={item.id} className="border-b border-black/[0.06] bg-zinc-50/60"><td className="p-1.5"><select form={formId} name="category" defaultValue={item.category} className={inlineInputClass}>{documentCategoryOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-1.5"><input form={formId} name="title" required maxLength={100} defaultValue={item.title} className={inlineInputClass} /></td><td className="p-1.5"><input form={formId} name="description" maxLength={300} defaultValue={item.description ?? ""} className={inlineInputClass} /></td><td className="px-3 font-mono text-zinc-500">{item.sort_order}</td><td className="px-3"><div className="flex justify-end gap-3"><form id={formId} action={updateUniversityDocumentRequirementAction.bind(null, universityId, item.id)}><RowSubmitButton /></form><button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-zinc-500 hover:text-zinc-950">取消</button></div></td></tr> : <tr key={item.id} className="border-b border-black/[0.06]"><td className="px-3 py-2.5 text-zinc-500">{documentCategoryOptions.find(([value]) => value === item.category)?.[1] ?? item.category}</td><td className="px-3 py-2.5 font-medium text-zinc-950">{item.title}</td><td className="px-3 py-2.5 text-zinc-500">{item.description || "—"}</td><td className="px-3 py-2.5 font-mono text-zinc-400">{item.sort_order}</td>{canManage && <td className="px-3 py-2.5"><div className="flex justify-end gap-3"><button type="button" onClick={() => setEditingId(item.id)} className="text-zinc-500 hover:text-zinc-950" aria-label={`编辑 ${item.title}`}><Pencil size={12} /></button><form action={deleteUniversityDocumentRequirementAction.bind(null, universityId, item.id)}><button type="submit" className="text-zinc-400 hover:text-red-600" aria-label={`删除 ${item.title}`}><Trash2 size={12} /></button></form></div></td>}</tr>;
              })}
              {expanded && items.length === 0 && addingStage !== stage.key && <tr className="border-b border-black/[0.06]"><td colSpan={canManage ? 5 : 4} className="px-3 py-6 text-center text-zinc-400">暂无{stage.label}申请材料</td></tr>}
              {expanded && canManage && addingStage !== stage.key && <tr className="border-b border-black/[0.08]"><td colSpan={5}><button type="button" onClick={() => setAddingStage(stage.key)} className="flex h-9 w-full items-center gap-1.5 px-3 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"><Plus size={12} />新增{stage.label}申请材料</button></td></tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function VisaRequirementsTable({ universityId, requirements, canManage }: { universityId: string; requirements: UniversityVisaRequirement[]; canManage: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingVisaType, setAddingVisaType] = useState<string | null>(null);
  const [newStage, setNewStage] = useState("admission");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(() => new Set());

  function toggleVisaType(visaType: string) {
    setExpandedTypes((current) => {
      const next = new Set(current);
      if (next.has(visaType)) next.delete(visaType);
      else next.add(visaType);
      return next;
    });
  }

  function scopeEditor(formId: string, visaType: string, defaults: string[] = []) {
    if (visaType !== "d2_bachelor") return <span className="text-zinc-500">{applicableScopeLabels[visaType === "d4_language" ? "language" : visaType === "d2_master" ? "master" : "doctor"]}</span>;
    return <div className="flex flex-wrap gap-3"><label className="flex items-center gap-1 text-[10px] text-sky-700"><input form={formId} name="applicableScopes" type="checkbox" value="bachelor_fresh" defaultChecked={defaults.length === 0 || defaults.includes("bachelor_fresh")} />新入</label><label className="flex items-center gap-1 text-[10px] text-violet-700"><input form={formId} name="applicableScopes" type="checkbox" value="bachelor_transfer" defaultChecked={defaults.length === 0 || defaults.includes("bachelor_transfer")} />插班</label></div>;
  }

  return (
    <div className="overflow-x-auto border border-black/[0.08]">
      <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
        <thead><tr className="h-9 border-b border-black/[0.08] text-[9px] uppercase tracking-[0.06em] text-zinc-500"><th className="w-[105px] px-3 font-medium">办理阶段</th><th className="w-[175px] px-3 font-medium">要求名称</th><th className="w-[135px] px-3 font-medium">适用对象</th><th className="px-3 font-medium">说明</th><th className="w-[60px] px-3 font-medium">排序</th>{canManage && <th className="w-[105px] px-3 text-right font-medium">操作</th>}</tr></thead>
        <tbody>
          {visaTypeGroups.map((visaType) => {
            const items = requirements.filter((item) => item.visa_type === visaType.key).sort((left, right) => left.sort_order - right.sort_order);
            const expanded = expandedTypes.has(visaType.key);
            const newFormId = `new-visa-${universityId}-${visaType.key}`;
            return <Fragment key={visaType.key}>
              <tr className={`border-b border-l-2 border-black/[0.08] bg-zinc-50/50 ${visaType.border}`}><td colSpan={canManage ? 6 : 5} className="p-0"><button type="button" onClick={() => toggleVisaType(visaType.key)} className="flex h-10 w-full items-center gap-2 px-3 text-left">{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<span className={`size-1.5 rounded-full ${visaType.dot}`} /><span className={`text-[11px] font-medium ${visaType.text}`}>{visaType.label}</span><span className="ml-auto font-mono text-[9px] tabular-nums text-zinc-400">{items.length} 项</span></button></td></tr>
              {expanded && addingVisaType === visaType.key && <tr className="border-b border-black/[0.06] bg-zinc-50/60"><td className="p-1.5"><select value={newStage} onChange={(event) => setNewStage(event.target.value)} className={inlineInputClass}>{visaStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-1.5"><input form={newFormId} name="title" required maxLength={100} className={inlineInputClass} placeholder="要求名称" /></td><td className="px-3 py-2">{scopeEditor(newFormId, visaType.key)}</td><td className="p-1.5"><input form={newFormId} name="description" maxLength={300} className={inlineInputClass} placeholder="补充说明，可留空" /></td><td className="px-3 font-mono text-zinc-400">自动</td><td className="px-3"><div className="flex justify-end gap-3"><form id={newFormId} action={createUniversityVisaRequirementAction.bind(null, universityId, visaType.key, newStage)}><RowSubmitButton label="新增" /></form><button type="button" onClick={() => setAddingVisaType(null)} className="text-[10px] text-zinc-500 hover:text-zinc-950">取消</button></div></td></tr>}
              {expanded && items.map((item) => {
                const formId = `visa-requirement-${item.id}`;
                const editing = editingId === item.id;
                const scopes = item.applicable_scopes ?? [];
                return editing ? <tr key={item.id} className="border-b border-black/[0.06] bg-zinc-50/60"><td className="p-1.5"><select form={formId} name="stage" defaultValue={item.stage} className={inlineInputClass}>{visaStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-1.5"><input form={formId} name="title" required maxLength={100} defaultValue={item.title} className={inlineInputClass} /></td><td className="px-3 py-2">{scopeEditor(formId, item.visa_type, scopes)}</td><td className="p-1.5"><input form={formId} name="description" maxLength={300} defaultValue={item.description ?? ""} className={inlineInputClass} /></td><td className="px-3 font-mono text-zinc-500">{item.sort_order}</td><td className="px-3"><div className="flex justify-end gap-3"><form id={formId} action={updateUniversityVisaRequirementAction.bind(null, universityId, item.id)}><RowSubmitButton /></form><button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-zinc-500 hover:text-zinc-950">取消</button></div></td></tr> : <tr key={item.id} className="border-b border-black/[0.06]"><td className="px-3 py-2.5 text-zinc-500">{visaStageOptions.find(([value]) => value === item.stage)?.[1] ?? item.stage}</td><td className="px-3 py-2.5 font-medium text-zinc-950">{item.title}</td><td className="px-3 py-2.5 text-zinc-500">{scopes.map((scope) => applicableScopeLabels[scope] ?? scope).join("、") || "—"}</td><td className="px-3 py-2.5 text-zinc-500">{item.description || "—"}</td><td className="px-3 py-2.5 font-mono text-zinc-400">{item.sort_order}</td>{canManage && <td className="px-3 py-2.5"><div className="flex justify-end gap-3"><button type="button" onClick={() => setEditingId(item.id)} className="text-zinc-500 hover:text-zinc-950" aria-label={`编辑 ${item.title}`}><Pencil size={12} /></button><form action={deleteUniversityVisaRequirementAction.bind(null, universityId, item.id)}><button type="submit" className="text-zinc-400 hover:text-red-600" aria-label={`删除 ${item.title}`}><Trash2 size={12} /></button></form></div></td>}</tr>;
              })}
              {expanded && items.length === 0 && addingVisaType !== visaType.key && <tr className="border-b border-black/[0.06]"><td colSpan={canManage ? 6 : 5} className="px-3 py-6 text-center text-zinc-400">暂无{visaType.label}要求</td></tr>}
              {expanded && canManage && addingVisaType !== visaType.key && <tr className="border-b border-black/[0.08]"><td colSpan={6}><button type="button" onClick={() => setAddingVisaType(visaType.key)} className="flex h-9 w-full items-center gap-1.5 px-3 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"><Plus size={12} />新增{visaType.label}要求</button></td></tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function UniversityManagementDialog({
  university,
  requirements,
  visaRequirements,
  canManageContent,
  open,
  onOpenChange,
}: {
  university: AdminUniversity;
  requirements: UniversityDocumentRequirement[];
  visaRequirements: UniversityVisaRequirement[];
  canManageContent: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<"profile" | "application" | "visa">("profile");
  const rows = [
    ["学校名称", `${university.name_zh} / ${university.name_ko}`],
    ["地区与性质", `${university.province} · ${university.city} · ${ownershipLabels[university.ownership]}`],
    ["世界大学排名", university.qs_rank_display ? `${university.qs_ranking_year ?? "—"} 年 · ${university.qs_rank_display}` : "暂无"],
    ["中央日报排名", university.joongang_rank_display ? `${university.joongang_ranking_year ?? "—"} 年 · ${university.joongang_rank_display}` : "暂无"],
    ["年度学费参考", `${university.tuition_reference_year} 年 · ${university.tuition_min_cny.toLocaleString("zh-CN")}—${university.tuition_max_cny.toLocaleString("zh-CN")} 元`],
    ["申请阶段", university.admission_stages.map((stage) => stageOptions.find(([value]) => value === stage)?.[1] ?? stage).join("、")],
    ["优势学科", university.discipline_groups.map((group) => disciplineOptions.find(([value]) => value === group)?.[1] ?? group).join("、")],
    ["最后更新", new Date(university.updated_at).toLocaleDateString("zh-CN")],
    ["学校介绍", university.summary],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-lg border-black/10 bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:max-w-[960px]">
        <DialogHeader className="border-b border-black/[0.07] px-6 py-4 pr-14 text-left">
          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-400">大学资料 / {canManageContent ? "编辑" : "查看"}</p>
          <DialogTitle className="mt-1 truncate text-base font-semibold tracking-[-0.025em]">{university.name_zh}</DialogTitle>
          <DialogDescription className="mt-0.5 truncate text-[10px]">{university.name_ko} · {university.province} · {ownershipLabels[university.ownership]}</DialogDescription>
        </DialogHeader>

        <div className="flex h-11 shrink-0 items-end gap-5 border-b border-black/[0.08] px-6">
          {([['profile', '基本资料'], ['application', `申请条件 ${requirements.length}`], ['visa', `签证要求 ${visaRequirements.length}`]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`h-11 border-b text-[11px] font-medium transition ${tab === value ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {tab === "profile" && (
            canManageContent ? (
              <form action={updateUniversityAction.bind(null, university.id)} className="space-y-4">
                <UniversityFormFields university={university} />
                <div className="flex justify-end"><SubmitButton label="保存修改" /></div>
              </form>
            ) : (
              <div className="overflow-hidden border border-black/[0.08]">
                <table className="w-full border-collapse text-left text-xs">
                  <tbody>
                    {rows.map(([label, value]) => (
                      <tr key={label} className="border-b border-black/[0.07] last:border-b-0">
                        <th className="w-[150px] border-r border-black/[0.07] px-4 py-3.5 align-top text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500">{label}</th>
                        <td className="whitespace-pre-wrap px-4 py-3.5 font-medium leading-5 text-zinc-900">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {tab === "application" && (
            <DocumentRequirementsTable universityId={university.id} requirements={requirements} canManage={canManageContent} />
          )}

          {tab === "visa" && (
            <VisaRequirementsTable universityId={university.id} requirements={visaRequirements} canManage={canManageContent} />
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}

export function UniversityAdminManager({
  canManageContent,
  canPermanentlyDelete,
  isInstitutionViewer,
  universities,
  requirements,
  visaRequirements,
}: {
  canManageContent: boolean;
  canPermanentlyDelete: boolean;
  isInstitutionViewer: boolean;
  universities: AdminUniversity[];
  requirements: UniversityDocumentRequirement[];
  visaRequirements: UniversityVisaRequirement[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "hidden">("all");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(() => new Set());
  const [coverageUniversityId, setCoverageUniversityId] = useState<string | null>(null);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [creatingUniversity, setCreatingUniversity] = useState(false);
  const requirementsByUniversity = useMemo(() => {
    const grouped = new Map<string, UniversityDocumentRequirement[]>();
    for (const requirement of requirements) {
      const items = grouped.get(requirement.university_id) ?? [];
      items.push(requirement);
      grouped.set(requirement.university_id, items);
    }
    return grouped;
  }, [requirements]);
  const visaRequirementsByUniversity = useMemo(() => {
    const grouped = new Map<string, UniversityVisaRequirement[]>();
    for (const requirement of visaRequirements) {
      const items = grouped.get(requirement.university_id) ?? [];
      items.push(requirement);
      grouped.set(requirement.university_id, items);
    }
    return grouped;
  }, [visaRequirements]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-CN");
    return universities.filter((university) => {
      if (status === "published" && !university.is_published) return false;
      if (status === "hidden" && university.is_published) return false;
      return !keyword || [university.name_zh, university.name_ko, university.province, university.city].join(" ").toLocaleLowerCase("zh-CN").includes(keyword);
    });
  }, [search, status, universities]);
  const groupedUniversities = useMemo(() => {
    const grouped = new Map<string, AdminUniversity[]>();
    for (const university of filtered) {
      const items = grouped.get(university.province) ?? [];
      items.push(university);
      grouped.set(university.province, items);
    }

    const knownRegions = regionOptions.filter((region) => grouped.has(region));
    const additionalRegions = [...grouped.keys()].filter((region) => !regionOptions.includes(region)).sort((left, right) => left.localeCompare(right, "zh-CN"));
    return [...knownRegions, ...additionalRegions].map((region) => ({ region, universities: grouped.get(region) ?? [] }));
  }, [filtered]);
  const hasSearch = search.trim().length > 0;
  const selectedUniversity = selectedUniversityId ? universities.find((university) => university.id === selectedUniversityId) ?? null : null;

  function toggleRegion(region: string) {
    setExpandedRegions((current) => {
      const next = new Set(current);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  return (
    <section className="overflow-hidden border-y border-black/[0.08] bg-white">
      <header className="flex flex-col gap-4 border-b border-black/[0.08] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-400">留学资源 / 韩国大学</p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-[-0.03em] text-zinc-950">韩国大学管理</h1>
            <span className="font-mono text-[10px] tabular-nums text-zinc-400">{universities.length} 所大学 · {universities.filter((university) => university.is_published).length} 所已发布</span>
            {isInstitutionViewer && <span className="text-[10px] text-zinc-400">只读模式</span>}
          </div>
          <p className="mt-1 text-[10px] text-zinc-500">统一维护大学、申请材料与签证要求</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
            <span className="sr-only">搜索大学</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索大学或地区" className="w-full rounded-md border border-black/10 bg-white py-2 pl-8 pr-3 text-[11px] outline-none transition placeholder:text-zinc-400 focus:border-black/25" />
          </label>
          {canManageContent && <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-md border border-black/10 bg-white px-3 py-2 text-[11px] text-zinc-700 outline-none"><option value="all">全部状态</option><option value="published">已发布</option><option value="hidden">已隐藏</option></select>}
          {canManageContent && <button type="button" onClick={() => setCreatingUniversity(true)} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-950 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-zinc-800"><Plus size={13} />新增大学</button>}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className={`w-full border-collapse text-left ${canManageContent ? "min-w-[930px]" : "min-w-[760px]"}`}>
          <thead className="bg-white">
            <tr className="h-10 border-b border-black/[0.08] text-[10px] uppercase tracking-[0.07em] text-zinc-500">
              <th className="w-[175px] border-r border-black/[0.06] px-4 font-medium">地区</th>
              <th className="w-[340px] px-4 font-medium">大学</th>
              <th className="w-[190px] px-3 font-medium">资料状态</th>
              <th className="w-[110px] px-3 font-medium">发布状态</th>
              {canManageContent && <th className="w-[190px] px-3 text-right font-medium">操作</th>}
            </tr>
          </thead>
          <tbody>
            {groupedUniversities.map(({ region, universities: regionUniversities }) => {
              const isExpanded = hasSearch || expandedRegions.has(region);
              const publishedInRegion = regionUniversities.filter((university) => university.is_published).length;
              const hasExpandedCoverage = regionUniversities.some((university) => university.id === coverageUniversityId);
              return (
                <Fragment key={region}>
                  {!isExpanded && (
                    <tr className="h-[46px] border-b border-black/[0.08] text-xs transition hover:bg-zinc-50/60">
                      <td className="border-r border-black/[0.06] p-0">
                        <button type="button" aria-expanded={false} onClick={() => toggleRegion(region)} className="flex h-[46px] w-full items-center gap-2 px-4 text-left">
                          <ChevronRight size={13} className="text-zinc-400" /><span className="text-[11px] font-medium text-zinc-900">{region}</span>
                        </button>
                      </td>
                      <td colSpan={canManageContent ? 4 : 3} className="px-4 text-[10px] text-zinc-400"><span className="font-mono tabular-nums text-zinc-700">{regionUniversities.length}</span> 所大学<span className="mx-2 text-zinc-300">·</span><span className="font-mono tabular-nums">{publishedInRegion}</span> 所已发布</td>
                    </tr>
                  )}
                  {isExpanded && regionUniversities.map((university, index) => {
                    const universityRequirements = requirementsByUniversity.get(university.id) ?? [];
                    const universityVisaRequirements = visaRequirementsByUniversity.get(university.id) ?? [];
                    const applicationStages = new Set(universityRequirements.map((item) => item.admission_stage));
                    const visaTypes = new Set(universityVisaRequirements.map((item) => item.visa_type));
                    const coverageExpanded = coverageUniversityId === university.id;
                    return (
                      <Fragment key={university.id}>
                      <tr onClick={() => setSelectedUniversityId(university.id)} className="group h-[46px] cursor-pointer border-b border-black/[0.06] text-xs transition hover:bg-zinc-50/80">
                        {index === 0 && (
                          <td rowSpan={regionUniversities.length + (hasExpandedCoverage ? 1 : 0)} className="border-b border-r border-black/[0.08] p-0 align-top">
                            <button type="button" aria-expanded onClick={(event) => { event.stopPropagation(); toggleRegion(region); }} disabled={hasSearch} className="flex w-full items-start gap-2 px-4 py-4 text-left disabled:cursor-default">
                              <ChevronDown size={13} className="mt-0.5 shrink-0 text-zinc-400" />
                              <span><span className="block text-[11px] font-medium text-zinc-900">{region}</span><span className="mt-1 block font-mono text-[9px] tabular-nums text-zinc-400">{regionUniversities.length} 所</span></span>
                            </button>
                          </td>
                        )}
                        <td className="px-4 py-2"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedUniversityId(university.id); }} className="flex min-w-0 items-center gap-2.5 text-left"><SchoolCrest logoUrl={university.logo_url} name={university.name_zh} size="xs"/><span className="min-w-0"><span className="block truncate text-[11px] font-medium text-zinc-950">{university.name_zh}</span><span className="mt-0.5 block truncate text-[9px] text-zinc-400">{university.name_ko} · {ownershipLabels[university.ownership]}</span></span></button></td>
                        <td className="px-3 py-2"><p className="font-mono text-[10px] tabular-nums text-zinc-700">申请 {applicationStages.size}/5 <span className="mx-1 text-zinc-300">·</span> 签证 {visaTypes.size}/4</p><button type="button" onClick={(event) => { event.stopPropagation(); setCoverageUniversityId((current) => current === university.id ? null : university.id); }} className="mt-0.5 text-[9px] font-medium text-sky-700 hover:text-sky-800 hover:underline hover:underline-offset-2">{coverageExpanded ? "收起覆盖详情" : "查看覆盖详情"}</button></td>
                        <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-2 text-[11px] font-medium ${university.is_published ? "text-emerald-700" : "text-amber-700"}`}><span className={`size-1.5 rounded-full ${university.is_published ? "bg-emerald-500" : "bg-amber-500"}`} />{university.is_published ? "已发布" : "已隐藏"}</span></td>
                        {canManageContent && <td onClick={(event) => event.stopPropagation()} className="px-3 py-2 text-right"><div className="flex items-center justify-end gap-4"><form action={toggleUniversityPublishedAction.bind(null, university.id, !university.is_published)}><button type="submit" className={`text-[10px] font-medium transition hover:underline hover:underline-offset-4 ${university.is_published ? "text-amber-700 hover:text-amber-800" : "text-emerald-700 hover:text-emerald-800"}`}>{university.is_published ? "停止展示" : "恢复展示"}</button></form><button type="button" onClick={() => setSelectedUniversityId(university.id)} className="text-[10px] font-medium text-sky-700 transition hover:text-sky-800 hover:underline hover:underline-offset-4">编辑</button>{canPermanentlyDelete && <UniversityDeleteDialog university={university} />}</div></td>}
                      </tr>
                      {coverageExpanded && <tr className="border-b border-black/[0.08] bg-zinc-50/40"><td colSpan={canManageContent ? 4 : 3} className="px-4 py-3"><table className="w-full border-collapse text-[9px]"><tbody><tr className="border-b border-black/[0.05]"><th className="w-12 py-2 text-left font-medium text-zinc-500">申请</th><td className="py-2"><div className="flex flex-wrap items-center gap-x-5 gap-y-2">{studyStageGroups.map((stage) => { const covered = applicationStages.has(stage.key); return <span key={stage.key} className={`inline-flex min-w-[78px] items-center gap-1.5 ${covered ? stage.text : "text-zinc-400"}`}><span className={`size-1.5 rounded-full ${covered ? stage.dot : "bg-zinc-200"}`} /><span>{stage.label}</span><span className="text-[8px] text-zinc-400">{covered ? "已维护" : "待补充"}</span></span>; })}</div></td></tr><tr><th className="w-12 py-2 text-left font-medium text-zinc-500">签证</th><td className="py-2"><div className="flex flex-wrap items-center gap-x-5 gap-y-2">{visaTypeGroups.map((visaType) => { const covered = visaTypes.has(visaType.key); return <span key={visaType.key} className={`inline-flex min-w-[78px] items-center gap-1.5 ${covered ? visaType.text : "text-zinc-400"}`}><span className={`size-1.5 rounded-full ${covered ? visaType.dot : "bg-zinc-200"}`} /><span>{visaType.shortLabel}</span><span className="text-[8px] text-zinc-400">{covered ? "已维护" : "待补充"}</span></span>; })}</div></td></tr></tbody></table></td></tr>}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={canManageContent ? 5 : 4} className="px-5 py-16 text-center text-xs text-zinc-400">没有符合条件的大学</td></tr>}
          </tbody>
        </table>
      </div>

      {selectedUniversity && (
        <UniversityManagementDialog
          university={selectedUniversity}
          requirements={requirementsByUniversity.get(selectedUniversity.id) ?? []}
          visaRequirements={visaRequirementsByUniversity.get(selectedUniversity.id) ?? []}
          canManageContent={canManageContent}
          open
          onOpenChange={(open) => { if (!open) setSelectedUniversityId(null); }}
        />
      )}

      {canManageContent && (
        <Dialog open={creatingUniversity} onOpenChange={setCreatingUniversity}>
          <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-lg border-black/10 bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:max-w-[960px]">
            <DialogHeader className="border-b border-black/[0.07] px-6 py-4 text-left"><p className="text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-400">大学资料 / 新增</p><DialogTitle className="mt-1 text-base font-semibold tracking-[-0.025em]">新增大学</DialogTitle><DialogDescription className="text-[10px]">填写基本资料，保存后再维护申请材料和签证要求。</DialogDescription></DialogHeader>
            <form action={createUniversityAction} className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 flex-1 overflow-y-auto p-6"><UniversityFormFields /></div><div className="flex justify-end border-t border-black/[0.08] px-6 py-4"><SubmitButton label="新增大学" /></div></form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
