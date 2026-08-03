"use client";

import { Fragment, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FilePenLine,
  GraduationCap,
  Landmark,
  Pencil,
  Plane,
  Plus,
  Send,
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
  createUniversityVisaRequirementAction,
  deleteUniversityVisaRequirementAction,
  moveUniversityVisaRequirementAction,
  updateUniversityVisaRequirementAction,
} from "./actions";

export type UniversityVisaRequirement = {
  id: string;
  university_id: string;
  visa_type: "d4_language" | "d2_bachelor" | "d2_master" | "d2_doctor";
  stage: "admission" | "identity" | "finance" | "application" | "appointment" | "submission" | "result" | "entry";
  title: string;
  description: string | null;
  sort_order: number;
  applicable_scopes: Array<"language" | "bachelor_fresh" | "bachelor_transfer" | "master" | "doctor">;
};

type VisaType = UniversityVisaRequirement["visa_type"];
type VisaStage = UniversityVisaRequirement["stage"];

const visaTypeOptions: Array<{ key: VisaType; label: string; description: string }> = [
  { key: "d4_language", label: "语言研修签证", description: "语学堂学生使用" },
  { key: "d2_bachelor", label: "本科签证", description: "本科新入和插班使用" },
  { key: "d2_master", label: "硕士签证", description: "硕士研究生使用" },
  { key: "d2_doctor", label: "博士签证", description: "博士研究生使用" },
];

const stageOptions = [
  { key: "admission", label: "入学许可", description: "学校录取与许可文件", icon: GraduationCap, color: "var(--app-success)", soft: "var(--app-success-soft)", suggestions: ["标准入学许可书", "学费缴纳证明", "录取通知书"] },
  { key: "identity", label: "身份材料", description: "护照、照片及身份关系", icon: UserRound, color: "var(--app-accent)", soft: "var(--app-accent-soft)", suggestions: ["护照", "签证照片", "身份证", "户口本", "亲属关系证明"] },
  { key: "finance", label: "资金材料", description: "存款、收入与资金担保", icon: Landmark, color: "var(--app-secondary)", soft: "var(--app-secondary-soft)", suggestions: ["存款证明", "银行流水", "父母在职证明", "收入证明"] },
  { key: "application", label: "申请表格", description: "签证表格和补充说明", icon: FilePenLine, color: "var(--app-warm)", soft: "var(--app-warm-soft)", suggestions: ["签证申请表", "学习计划书", "学历证明", "成绩单"] },
  { key: "appointment", label: "预约递交", description: "预约与受理地点要求", icon: CalendarClock, color: "#8b5cf6", soft: "#f3efff", suggestions: ["递签预约单", "材料核对清单", "领馆预约确认"] },
  { key: "submission", label: "正式递签", description: "现场递交与受理凭证", icon: Send, color: "#2563eb", soft: "#eff6ff", suggestions: ["受理回执", "缴费凭证", "补件通知"] },
  { key: "result", label: "结果查询", description: "审核结果和补件文件", icon: BadgeCheck, color: "#059669", soft: "#ecfdf5", suggestions: ["签证查询凭证", "补充材料", "签证签发确认"] },
  { key: "entry", label: "入境安排", description: "获签后的入境准备", icon: Plane, color: "#0891b2", soft: "#ecfeff", suggestions: ["电子签证页", "入境行程单", "住宿证明", "学校报到材料"] },
] as const satisfies ReadonlyArray<{
  key: VisaStage;
  label: string;
  description: string;
  icon: typeof GraduationCap;
  color: string;
  soft: string;
  suggestions: readonly string[];
}>;

function AddButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-white disabled:opacity-60" style={{ backgroundColor: "var(--app-success)" }}><Plus size={13} />{pending ? "添加中…" : "添加"}</button>;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-60" style={{ backgroundColor: "var(--app-success)" }}><Pencil size={13} />{pending ? "保存中…" : "保存修改"}</button>;
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return <AlertDialogAction type="submit" disabled={pending} className="gap-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"><Trash2 size={14} />{pending ? "删除中…" : "确认删除"}</AlertDialogAction>;
}

function SortButton({ direction, disabled, title }: { direction: "up" | "down"; disabled: boolean; title: string }) {
  const { pending } = useFormStatus();
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return <button type="submit" disabled={disabled || pending} aria-label={title} title={title} className="inline-flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-25" style={{ color: "var(--app-muted)" }}><Icon size={14} /></button>;
}

function RequirementSortControls({ universityId, requirement, index, itemCount }: { universityId: string; requirement: UniversityVisaRequirement; index: number; itemCount: number }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" aria-label={`${requirement.title}排序`}>
      <form action={moveUniversityVisaRequirementAction.bind(null, universityId, requirement.id, "up")}><SortButton direction="up" disabled={index === 0} title={`上移${requirement.title}`} /></form>
      <form action={moveUniversityVisaRequirementAction.bind(null, universityId, requirement.id, "down")}><SortButton direction="down" disabled={index === itemCount - 1} title={`下移${requirement.title}`} /></form>
    </div>
  );
}

function RequirementEditDialog({ universityId, requirement }: { universityId: string; requirement: UniversityVisaRequirement }) {
  return (
    <Dialog>
      <DialogTrigger type="button" aria-label={`修改${requirement.title}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-white" style={{ color: "var(--app-success)" }}><Pencil size={13} /></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black">修改签证申请资料</DialogTitle>
          <DialogDescription className="leading-6">修改会同步到该校现有学生的对应签证任务，不会清除提交次数和审核记录。</DialogDescription>
        </DialogHeader>
        <form action={updateUniversityVisaRequirementAction.bind(null, universityId, requirement.id)} className="space-y-4">
          {requirement.visa_type === "d2_bachelor" && (requirement.applicable_scopes.length > 0 ? requirement.applicable_scopes : ["bachelor_fresh", "bachelor_transfer"]).map((scope) => <input key={scope} type="hidden" name="applicableScopes" value={scope} />)}
          <div className="overflow-hidden rounded-xl border"><table className="w-full border-collapse text-left text-xs"><tbody>
            <tr className="border-b" style={{ borderColor: "var(--app-border-soft)" }}><th className="w-[110px] border-r bg-[var(--app-soft-bg)] px-3 py-3 font-black" style={{ borderColor: "var(--app-border-soft)" }}>资料名称</th><td className="px-3 py-2"><input name="title" required minLength={1} maxLength={100} defaultValue={requirement.title} className="app-input w-full rounded-lg border px-3 py-2.5 outline-none" /></td></tr>
            <tr className="border-b" style={{ borderColor: "var(--app-border-soft)" }}><th className="border-r bg-[var(--app-soft-bg)] px-3 py-3 font-black" style={{ borderColor: "var(--app-border-soft)" }}>办理阶段</th><td className="px-3 py-2"><select name="stage" defaultValue={requirement.stage} className="app-input w-full rounded-lg border px-3 py-2.5 outline-none">{stageOptions.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></td></tr>
            <tr><th className="border-r bg-[var(--app-soft-bg)] px-3 py-3 font-black align-top" style={{ borderColor: "var(--app-border-soft)" }}>学生备注</th><td className="px-3 py-2"><textarea name="description" maxLength={300} rows={4} defaultValue={requirement.description ?? ""} placeholder="学生可以看到的资料说明" className="app-input w-full resize-y rounded-lg border px-3 py-2.5 leading-6 outline-none" /></td></tr>
          </tbody></table></div>
          <div className="flex justify-end"><SaveButton /></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequirementDeleteDialog({ universityId, requirement }: { universityId: string; requirement: UniversityVisaRequirement }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger type="button" aria-label={`删除${requirement.title}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"><Trash2 size={13} /></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black">删除“{requirement.title}”？</AlertDialogTitle>
          <AlertDialogDescription className="leading-6">尚未提交的学生任务会移除；已经提交或审核过的任务会归档保留，不会丢失历史记录。</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <form action={deleteUniversityVisaRequirementAction.bind(null, universityId, requirement.id)}><DeleteButton /></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UniversityVisaRequirementsDialog({ canManage, universityId, universityName, requirements }: { canManage: boolean; universityId: string; universityName: string; requirements: UniversityVisaRequirement[] }) {
  const [selectedVisaType, setSelectedVisaType] = useState<VisaType>("d4_language");
  const selectedVisaMeta = visaTypeOptions.find((visaType) => visaType.key === selectedVisaType) ?? visaTypeOptions[0];

  return (
    <Dialog>
      <DialogTrigger type="button" className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black" style={{ color: "var(--app-success)", borderColor: "var(--app-success)" }}><FileCheck2 size={13} /> 签证申请</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">{universityName} · 签证申请资料</DialogTitle>
          <DialogDescription className="leading-6">{canManage ? "按签证类型维护学校实际要求的资料，修改会同步到学生端。" : "查看平台已经确认的签证资料；当前账号不能新增、修改或删除。"}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5" style={{ color: "var(--app-success)", borderColor: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          <p><b>{canManage ? "自动同步：" : "机构只读："}</b>{canManage ? "新增和修改会立即同步到对应学生；已有提交和审核记录会保留。" : "签证资料由平台统一维护，机构端只能查看。"}</p>
        </div>

        <section className="rounded-2xl border p-3" style={{ borderColor: "var(--app-border-soft)", backgroundColor: "var(--app-soft-bg)" }}>
          <div className="grid gap-2 sm:grid-cols-4">
            {visaTypeOptions.map((visaType) => {
              const active = selectedVisaType === visaType.key;
              const itemCount = requirements.filter((requirement) => requirement.visa_type === visaType.key).length;
              return (
                <button key={visaType.key} type="button" onClick={() => setSelectedVisaType(visaType.key)} className="rounded-xl border px-3 py-3 text-left transition" style={active ? { color: "var(--app-success)", borderColor: "var(--app-success)", backgroundColor: "var(--app-success-soft)" } : { color: "var(--app-muted)", borderColor: "transparent", backgroundColor: "var(--app-card-bg)" }}>
                  <span className="block text-xs font-black">{visaType.label}</span>
                  <span className="mt-1 block text-[10px] font-bold">{itemCount} 项资料</span>
                </button>
              );
            })}
          </div>
          <p className="app-muted-text mt-2 px-1 text-xs">当前维护：<b>{selectedVisaMeta.label}</b> · {selectedVisaMeta.description}</p>
        </section>

        <div key={selectedVisaType} className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead><tr className="border-b bg-[var(--app-soft-bg)] text-[10px] font-black app-muted-text" style={{ borderColor: "var(--app-border)" }}><th className="w-[135px] px-4 py-3">办理阶段</th><th className="w-[220px] px-3 py-3">资料名称</th><th className="px-3 py-3">学生可见备注</th><th className="w-[90px] px-3 py-3 text-center">顺序</th><th className="w-[100px] px-4 py-3 text-right">操作</th></tr></thead>
            <tbody>
          {stageOptions.map((stage) => {
            const items = requirements
              .filter((requirement) => requirement.visa_type === selectedVisaType && requirement.stage === stage.key)
              .sort((left, right) => left.sort_order - right.sort_order || left.title.localeCompare(right.title, "zh-CN"));
            const dataListId = `visa-requirement-${universityId}-${selectedVisaType}-${stage.key}`;

            return (
              <Fragment key={stage.key}>
                {items.map((requirement, index) => <tr key={requirement.id} className="border-b" style={{ borderColor: "var(--app-border-soft)" }}><td className="px-4 py-3 font-black" style={{ color: stage.color }}>{index === 0 ? stage.label : ""}</td><td className="px-3 py-3 font-black">{requirement.title}</td><td className="app-muted-text whitespace-pre-wrap px-3 py-3 leading-5">{requirement.description || "—"}</td><td className="px-3 py-3 text-center">{canManage ? <RequirementSortControls universityId={universityId} requirement={requirement} index={index} itemCount={items.length} /> : requirement.sort_order}</td><td className="px-4 py-3"><div className="flex justify-end gap-1">{canManage && <><RequirementEditDialog universityId={universityId} requirement={requirement} /><RequirementDeleteDialog universityId={universityId} requirement={requirement} /></>}</div></td></tr>)}
                {items.length === 0 && !canManage && <tr className="border-b" style={{ borderColor: "var(--app-border-soft)" }}><td className="px-4 py-3 font-black" style={{ color: stage.color }}>{stage.label}</td><td colSpan={4} className="app-muted-text px-3 py-3">暂未要求此阶段资料</td></tr>}
                {canManage && <tr className="border-b bg-[var(--app-soft-bg)]" style={{ borderColor: "var(--app-border-soft)" }}><td className="px-4 py-3 font-black" style={{ color: stage.color }}>{items.length === 0 ? stage.label : "新增"}</td><td colSpan={4} className="px-3 py-2"><form action={createUniversityVisaRequirementAction.bind(null, universityId, selectedVisaType, stage.key)} className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)_80px]">{selectedVisaType === "d2_bachelor" && <><input type="hidden" name="applicableScopes" value="bachelor_fresh" /><input type="hidden" name="applicableScopes" value="bachelor_transfer" /></>}<input name="title" required minLength={1} maxLength={100} list={dataListId} placeholder={`输入或选择${stage.label}资料`} className="app-input rounded-lg border px-3 py-2 text-xs outline-none" /><datalist id={dataListId}>{stage.suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist><input name="description" maxLength={300} placeholder="备注（可选）" className="app-input rounded-lg border px-3 py-2 text-xs outline-none" /><AddButton /></form></td></tr>}
              </Fragment>
            );
          })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
