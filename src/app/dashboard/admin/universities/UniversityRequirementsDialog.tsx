"use client";

import { Fragment, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BadgeDollarSign,
  BookOpenCheck,
  ChevronDown,
  ChevronUp,
  FilePenLine,
  FileText,
  Languages,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";

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
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  createUniversityDocumentRequirementAction,
  deleteUniversityDocumentRequirementAction,
  moveUniversityDocumentRequirementAction,
  updateUniversityDocumentRequirementAction,
} from "./actions";

export type UniversityDocumentRequirement = {
  id: string;
  university_id: string;
  admission_stage: "language" | "bachelor_fresh" | "bachelor_transfer" | "master" | "doctor";
  category: "identity" | "academic" | "application" | "financial" | "language";
  title: string;
  description: string | null;
  sort_order: number;
};

type AdmissionStage = UniversityDocumentRequirement["admission_stage"];

const admissionStageOptions: Array<{ key: AdmissionStage; label: string; description: string }> = [
  { key: "language", label: "语学院", description: "韩国大学附属语学院申请" },
  { key: "bachelor_fresh", label: "大学新入", description: "本科一年级新生申请" },
  { key: "bachelor_transfer", label: "大学插班", description: "本科插班申请" },
  { key: "master", label: "硕士", description: "硕士研究生申请" },
  { key: "doctor", label: "博士", description: "博士研究生申请" },
];

const categoryOptions = [
  {
    key: "identity",
    label: "身份材料",
    description: "确认学生身份、国籍和证件信息",
    icon: UserRound,
    color: "var(--primary)",
    soft: "var(--accent)",
    suggestions: ["护照", "身份证", "户口本", "证件照", "外国人登录证"],
  },
  {
    key: "academic",
    label: "学历材料",
    description: "在读、毕业、学位及成绩证明",
    icon: BookOpenCheck,
    color: "var(--support)",
    soft: "var(--support-surface)",
    suggestions: ["成绩单", "在读证明", "毕业证明", "学位证", "会考成绩", "高考成绩", "学信网认证"],
  },
  {
    key: "application",
    label: "申请文书",
    description: "大学申请表与个人陈述类文书",
    icon: FilePenLine,
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
    suggestions: ["入学申请表", "学习计划书", "自我介绍书", "推荐信", "个人简历", "作品集"],
  },
  {
    key: "financial",
    label: "资金材料",
    description: "留学资金及担保关系证明",
    icon: BadgeDollarSign,
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
    suggestions: ["存款证明", "银行流水", "父母在职证明", "收入证明", "亲属关系证明"],
  },
  {
    key: "language",
    label: "语言材料",
    description: "韩语或英语能力证明",
    icon: Languages,
    color: "#8b5cf6",
    soft: "#f3efff",
    suggestions: ["韩国语能力考试成绩", "国际英语能力考试成绩", "英语能力考试成绩", "韩语课程证明", "语言成绩证明"],
  },
] as const;

function AddRequirementButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--primary)" }}
    >
      <Plus size={13} />
      {pending ? "添加中…" : "添加"}
    </button>
  );
}

function DeleteRequirementButton() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction
      type="submit"
      disabled={pending}
      className="gap-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
    >
      <Trash2 size={14} />
      {pending ? "删除中…" : "确认删除"}
    </AlertDialogAction>
  );
}

function EditRequirementButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--primary)" }}
    >
      <Pencil size={13} />
      {pending ? "保存中…" : "保存修改"}
    </button>
  );
}

function SortRequirementButton({
  direction,
  disabled,
  title,
}: {
  direction: "up" | "down";
  disabled: boolean;
  title: string;
}) {
  const { pending } = useFormStatus();
  const Icon = direction === "up" ? ChevronUp : ChevronDown;

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-label={title}
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-25"
      style={{ color: "var(--foreground-muted)" }}
    >
      <Icon size={14} />
    </button>
  );
}

function RequirementSortControls({
  universityId,
  requirement,
  index,
  itemCount,
}: {
  universityId: string;
  requirement: UniversityDocumentRequirement;
  index: number;
  itemCount: number;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label={`${requirement.title}排序`}>
      <form action={moveUniversityDocumentRequirementAction.bind(null, universityId, requirement.id, "up")}>
        <SortRequirementButton direction="up" disabled={index === 0} title={`上移${requirement.title}`} />
      </form>
      <form action={moveUniversityDocumentRequirementAction.bind(null, universityId, requirement.id, "down")}>
        <SortRequirementButton direction="down" disabled={index === itemCount - 1} title={`下移${requirement.title}`} />
      </form>
    </div>
  );
}

function RequirementEditDialog({
  universityId,
  requirement,
}: {
  universityId: string;
  requirement: UniversityDocumentRequirement;
}) {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        aria-label={`修改${requirement.title}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white"
        style={{ color: "var(--primary)" }}
      >
        <Pencil size={13} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-semibold">修改申请资料</DialogTitle>
          <DialogDescription className="leading-6">
            修改会同步到该校现有学生的对应资料项目，不会删除已提交文件或审核记录。
          </DialogDescription>
        </DialogHeader>
        <form
          action={updateUniversityDocumentRequirementAction.bind(null, universityId, requirement.id)}
          className="space-y-4"
        >
          <div className="overflow-hidden rounded-xl border"><table className="w-full border-collapse text-left text-xs"><tbody>
            <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}><th className="w-[110px] border-r bg-[var(--surface-soft)] px-3 py-3 font-semibold" style={{ borderColor: "var(--border-subtle)" }}>资料名称</th><td className="px-3 py-2"><input name="title" required minLength={1} maxLength={100} defaultValue={requirement.title} className="app-input w-full rounded-lg border px-3 py-2.5 outline-none" /></td></tr>
            <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}><th className="border-r bg-[var(--surface-soft)] px-3 py-3 font-semibold" style={{ borderColor: "var(--border-subtle)" }}>所属分类</th><td className="px-3 py-2"><select name="category" defaultValue={requirement.category} className="app-input w-full rounded-lg border px-3 py-2.5 outline-none">{categoryOptions.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}</select></td></tr>
            <tr><th className="border-r bg-[var(--surface-soft)] px-3 py-3 font-semibold align-top" style={{ borderColor: "var(--border-subtle)" }}>学生备注</th><td className="px-3 py-2"><textarea name="description" maxLength={300} rows={4} defaultValue={requirement.description ?? ""} placeholder="学生可以看到的资料说明" className="app-input w-full resize-y rounded-lg border px-3 py-2.5 leading-6 outline-none" /></td></tr>
          </tbody></table></div>
          <div className="flex justify-end">
            <EditRequirementButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDeleteDialog({
  universityId,
  requirement,
}: {
  universityId: string;
  requirement: UniversityDocumentRequirement;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        type="button"
        aria-label={`删除${requirement.title}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
      >
        <Trash2 size={13} />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-semibold">删除“{requirement.title}”？</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">
            该校尚未提交的这项资料会从学生申请表中移除；已经提交或审核过的文件会归档保留，但不再显示在当前清单中。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <form action={deleteUniversityDocumentRequirementAction.bind(null, universityId, requirement.id)}>
            <DeleteRequirementButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UniversityRequirementsDialog({
  canManage,
  universityId,
  universityName,
  requirements,
}: {
  canManage: boolean;
  universityId: string;
  universityName: string;
  requirements: UniversityDocumentRequirement[];
}) {
  const [selectedStage, setSelectedStage] = useState<AdmissionStage>("language");
  const selectedStageMeta = admissionStageOptions.find((stage) => stage.key === selectedStage) ?? admissionStageOptions[0];

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold"
        style={{ color: "var(--primary)", borderColor: "var(--primary)" }}
      >
        <FileText size={13} /> 申请资料
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{universityName} · 申请资料模板</DialogTitle>
          <DialogDescription className="leading-6">
            {canManage
              ? "维护这所大学实际要求的申请资料，修改会同步到学生端。"
              : "查看平台已经确认的申请资料要求；当前账号不能新增、修改或删除。"}
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5"
          style={{ color: "var(--support)", borderColor: "var(--support)", backgroundColor: "var(--support-surface)" }}
        >
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          <p>
            <b>{canManage ? "自动同步：" : "机构只读："}</b>{canManage ? "新增或修改项目会同步到该校现有学生的申请表；已提交历史不会被误删。" : "申请资料由平台统一维护，机构端只能查看。"}
          </p>
        </div>

        <section className="rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-soft)" }}>
          <div className="grid gap-2 sm:grid-cols-5">
            {admissionStageOptions.map((stage) => {
              const stageCount = requirements.filter((requirement) => requirement.admission_stage === stage.key).length;
              const active = selectedStage === stage.key;
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setSelectedStage(stage.key)}
                  className="rounded-xl border px-3 py-3 text-left transition"
                  style={active
                    ? { color: "var(--primary-hover)", borderColor: "var(--primary)", backgroundColor: "var(--accent)" }
                    : { color: "var(--foreground-muted)", borderColor: "transparent", backgroundColor: "var(--card)" }}
                >
                  <span className="block text-xs font-semibold">{stage.label}</span>
                  <span className="mt-1 block text-[10px] font-bold">{stageCount} 项资料</span>
                </button>
              );
            })}
          </div>
          <p className="app-muted-text mt-2 px-1 text-xs">
            当前维护：<b>{selectedStageMeta.label}</b> · {selectedStageMeta.description}
          </p>
        </section>

        <div key={selectedStage} className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead><tr className="border-b bg-[var(--surface-soft)] text-[10px] font-semibold app-muted-text" style={{ borderColor: "var(--border)" }}><th className="w-[135px] px-4 py-3">资料分类</th><th className="w-[220px] px-3 py-3">资料名称</th><th className="px-3 py-3">学生可见备注</th><th className="w-[90px] px-3 py-3 text-center">顺序</th><th className="w-[100px] px-4 py-3 text-right">操作</th></tr></thead>
            <tbody>{categoryOptions.map((category) => {
            const items = requirements
              .filter((requirement) => requirement.admission_stage === selectedStage && requirement.category === category.key)
              .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "zh-CN"));
            const dataListId = `requirement-${universityId}-${category.key}`;

            return (
              <Fragment key={category.key}>
                {items.map((requirement, itemIndex) => <tr key={requirement.id} className="border-b" style={{ borderColor: "var(--border-subtle)" }}><td className="px-4 py-3 font-semibold" style={{ color: category.color }}>{itemIndex === 0 ? category.label : ""}</td><td className="px-3 py-3 font-semibold">{requirement.title}</td><td className="app-muted-text whitespace-pre-wrap px-3 py-3 leading-5">{requirement.description || "—"}</td><td className="px-3 py-3 text-center">{canManage ? <RequirementSortControls universityId={universityId} requirement={requirement} index={itemIndex} itemCount={items.length} /> : requirement.sort_order}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{canManage && <><RequirementEditDialog universityId={universityId} requirement={requirement} /><RequirementDeleteDialog universityId={universityId} requirement={requirement} /></>}</div></td></tr>)}
                {items.length === 0 && !canManage && <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}><td className="px-4 py-3 font-semibold" style={{ color: category.color }}>{category.label}</td><td colSpan={4} className="app-muted-text px-3 py-3">暂未要求此类资料</td></tr>}
                {canManage && <tr className="border-b bg-[var(--surface-soft)]" style={{ borderColor: "var(--border-subtle)" }}><td className="px-4 py-3 font-semibold" style={{ color: category.color }}>{items.length === 0 ? category.label : "新增"}</td><td colSpan={4} className="px-3 py-2"><form action={createUniversityDocumentRequirementAction.bind(null, universityId, selectedStage, category.key)} className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)_80px]"><input name="title" required minLength={1} maxLength={100} list={dataListId} placeholder={`输入或选择${category.label}`} className="app-input rounded-lg border px-3 py-2 text-xs outline-none" /><datalist id={dataListId}>{category.suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist><input name="description" maxLength={300} placeholder="备注（可选）" className="app-input rounded-lg border px-3 py-2 text-xs outline-none" /><AddRequirementButton /></form></td></tr>}
              </Fragment>
            );
          })}</tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
