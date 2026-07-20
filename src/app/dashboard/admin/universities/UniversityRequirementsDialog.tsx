"use client";

import { useState } from "react";
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
    color: "var(--app-accent)",
    soft: "var(--app-accent-soft)",
    suggestions: ["护照", "身份证", "户口本", "证件照", "外国人登录证"],
  },
  {
    key: "academic",
    label: "学历材料",
    description: "在读、毕业、学位及成绩证明",
    icon: BookOpenCheck,
    color: "var(--app-secondary)",
    soft: "var(--app-secondary-soft)",
    suggestions: ["成绩单", "在读证明", "毕业证明", "学位证", "会考成绩", "高考成绩", "学信网认证"],
  },
  {
    key: "application",
    label: "申请文书",
    description: "大学申请表与个人陈述类文书",
    icon: FilePenLine,
    color: "var(--app-warm)",
    soft: "var(--app-warm-soft)",
    suggestions: ["入学申请表", "学习计划书", "自我介绍书", "推荐信", "个人简历", "作品集"],
  },
  {
    key: "financial",
    label: "资金材料",
    description: "留学资金及担保关系证明",
    icon: BadgeDollarSign,
    color: "var(--app-success)",
    soft: "var(--app-success-soft)",
    suggestions: ["存款证明", "银行流水", "父母在职证明", "收入证明", "亲属关系证明"],
  },
  {
    key: "language",
    label: "语言材料",
    description: "韩语或英语能力证明",
    icon: Languages,
    color: "#8b5cf6",
    soft: "#f3efff",
    suggestions: ["TOPIK成绩", "IELTS成绩", "TOEFL成绩", "韩语课程证明", "语言成绩证明"],
  },
] as const;

function AddRequirementButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--app-accent)" }}
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
      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
      style={{ backgroundColor: "var(--app-accent)" }}
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
      style={{ color: "var(--app-muted)" }}
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
        style={{ color: "var(--app-accent)" }}
      >
        <Pencil size={13} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">修改申请资料</DialogTitle>
          <DialogDescription className="leading-6">
            修改会同步到该校现有学生的对应资料项目，不会删除已提交文件或审核记录。
          </DialogDescription>
        </DialogHeader>
        <form
          action={updateUniversityDocumentRequirementAction.bind(null, universityId, requirement.id)}
          className="space-y-4"
        >
          <label className="block text-xs font-black">
            资料名称
            <input
              name="title"
              required
              minLength={1}
              maxLength={100}
              defaultValue={requirement.title}
              className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none"
            />
          </label>
          <label className="block text-xs font-black">
            所属分类
            <select
              name="category"
              defaultValue={requirement.category}
              className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none"
            >
              {categoryOptions.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-black">
            资料备注（学生可见）
            <textarea
              name="description"
              maxLength={300}
              rows={4}
              defaultValue={requirement.description ?? ""}
              placeholder="例如：请上传身份证正反面扫描件，并合并为一个 PDF 文件。"
              className="app-input mt-2 w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6 outline-none"
            />
          </label>
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
          <AlertDialogTitle className="font-black">删除“{requirement.title}”？</AlertDialogTitle>
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
  universityId,
  universityName,
  requirements,
}: {
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
        className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black"
        style={{ color: "var(--app-accent)", borderColor: "var(--app-accent)" }}
      >
        <FileText size={13} /> 申请资料
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">{universityName} · 申请资料模板</DialogTitle>
          <DialogDescription className="leading-6">
            只添加这所大学实际要求的资料。学生把该校目标切换到“准备资料”后，系统会按此模板生成申请资料清单。
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5"
          style={{ color: "var(--app-secondary)", borderColor: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}
        >
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          <p>
            <b>自动同步：</b>新增或修改项目会同步到该校现有学生的申请表；删除项目会移除未提交项，已提交历史不会被误删。
          </p>
        </div>

        <section className="rounded-2xl border p-3" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
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
                    ? { color: "var(--app-accent-strong)", borderColor: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }
                    : { color: "var(--app-muted)", borderColor: "transparent", backgroundColor: "var(--app-card-bg)" }}
                >
                  <span className="block text-xs font-black">{stage.label}</span>
                  <span className="mt-1 block text-[10px] font-bold">{stageCount} 项资料</span>
                </button>
              );
            })}
          </div>
          <p className="app-muted-text mt-2 px-1 text-xs">
            当前维护：<b>{selectedStageMeta.label}</b> · {selectedStageMeta.description}
          </p>
        </section>

        <div key={selectedStage} className="grid gap-4 lg:grid-cols-2">
          {categoryOptions.map((category, categoryIndex) => {
            const Icon = category.icon;
            const items = requirements
              .filter((requirement) => requirement.admission_stage === selectedStage && requirement.category === category.key)
              .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, "zh-CN"));
            const dataListId = `requirement-${universityId}-${category.key}`;

            return (
              <section
                key={category.key}
                className={`app-card rounded-2xl border p-4 ${categoryIndex === categoryOptions.length - 1 ? "lg:col-span-2" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ color: category.color, backgroundColor: category.soft }}
                  >
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black">{category.label}</h3>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black app-muted-text" style={{ backgroundColor: "var(--app-soft-bg)" }}>
                        {items.length} 项
                      </span>
                    </div>
                    <p className="app-muted-text mt-1 text-xs">{category.description}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {items.map((requirement, itemIndex) => (
                    <div key={requirement.id} className="app-soft-card flex items-center gap-3 rounded-xl border px-3 py-2.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black">{requirement.title}</p>
                        {requirement.description && <p className="app-muted-text mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-4">{requirement.description}</p>}
                      </div>
                      <RequirementSortControls universityId={universityId} requirement={requirement} index={itemIndex} itemCount={items.length} />
                      <RequirementEditDialog universityId={universityId} requirement={requirement} />
                      <RequirementDeleteDialog universityId={universityId} requirement={requirement} />
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed p-4 text-center text-xs app-muted-text">
                      这所大学暂未要求此类资料
                    </div>
                  )}
                </div>

                <form
                  action={createUniversityDocumentRequirementAction.bind(null, universityId, selectedStage, category.key)}
                  className="mt-3 space-y-2"
                >
                  <label className="block">
                    <span className="sr-only">新增{category.label}</span>
                    <input
                      name="title"
                      required
                      minLength={1}
                      maxLength={100}
                      list={dataListId}
                      placeholder={`输入或选择${category.label}`}
                      className="app-input w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                    />
                    <datalist id={dataListId}>
                      {category.suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
                    </datalist>
                  </label>
                  <label className="block">
                    <span className="sr-only">资料备注</span>
                    <textarea
                      name="description"
                      maxLength={300}
                      rows={2}
                      placeholder="备注（可选，学生可以看到）"
                      className="app-input w-full resize-y rounded-xl border px-3 py-2.5 text-xs leading-5 outline-none"
                    />
                  </label>
                  <div className="flex justify-end"><AddRequirementButton /></div>
                </form>
                <p className="app-muted-text mt-2 text-[10px] leading-4">
                  常用选项：{category.suggestions.join("、")}；也可以直接输入新的资料名称。
                </p>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
