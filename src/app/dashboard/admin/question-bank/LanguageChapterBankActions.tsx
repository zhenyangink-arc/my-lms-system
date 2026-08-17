"use client";

import { Eye, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { koreanEbookSectionLabel } from "@/lib/korean-ebook-sections";
import {
  LanguageBankCreateForms,
  type LanguageBank,
  type LanguageBankChapterOption,
  type LanguageBankMaterialOption,
  type LanguageSkill,
} from "./LanguageBankCreateForms";

export type LanguageChapterMaterial = LanguageBankMaterialOption & {
  difficulty: "beginner" | "intermediate" | "advanced";
  materialLength: "short" | "medium" | "long";
  ebookPageReference: string;
  status: "draft" | "review" | "published" | "retired";
};

export type LanguageChapterQuestion = {
  id: string;
  materialId: string | null;
  languageSkill: LanguageSkill;
  assessmentCategory: string;
  questionType: "single_choice" | "multiple_choice" | "fill_blank" | "ordering" | "audio_response" | "long_text";
  difficulty: "beginner" | "intermediate" | "advanced";
  promptKo: string;
  ebookSectionStep: string;
  ebookPageReference: string;
  status: "draft" | "review" | "published" | "retired";
};

const skills: Array<{ key: LanguageSkill; label: string }> = [
  { key: "listening", label: "听力" },
  { key: "speaking", label: "口语" },
  { key: "reading", label: "阅读" },
  { key: "writing", label: "写作" },
];
const difficultyLabels = { beginner: "低级", intermediate: "中级", advanced: "高级" } as const;
const lengthLabels = { short: "短篇", medium: "中篇", long: "长篇" } as const;
const statusLabels = { draft: "草稿", review: "待审核", published: "已发布", retired: "已停用" } as const;
const typeLabels = {
  single_choice: "单选 · 四个选项", multiple_choice: "多选 · 四个选项", fill_blank: "填空",
  ordering: "排序 · 四项", audio_response: "录音作答", long_text: "写作",
} as const;

export function LanguageChapterBankActions({
  bank,
  chapter,
  materials,
  questions,
}: {
  bank: LanguageBank;
  chapter: LanguageBankChapterOption;
  materials: LanguageChapterMaterial[];
  questions: LanguageChapterQuestion[];
}) {
  const [mode, setMode] = useState<"view" | "create" | null>(null);
  const [skill, setSkill] = useState<LanguageSkill>("listening");

  useEffect(() => {
    if (!mode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMode(null);
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [mode]);

  const selectedMaterials = materials.filter((item) => item.languageSkill === skill);
  const selectedQuestions = questions.filter((item) => item.languageSkill === skill);
  const materialById = new Map(materials.map((item) => [item.id, item]));

  return (
    <>
      <div className="flex justify-end gap-1">
        <button type="button" onClick={() => setMode("view")} className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold" style={{ color: "var(--support)" }}><Eye size={14} />查看题目</button>
        <button type="button" onClick={() => setMode("create")} className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold" style={{ color: "var(--primary)" }}><Plus size={14} />新增题目</button>
      </div>

      {mode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => event.target === event.currentTarget && setMode(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${chapter.title}${mode === "view" ? "查看题目" : "新增题目"}`} className="flex max-h-[94vh] w-full max-w-[1380px] flex-col overflow-hidden border bg-[var(--card)] shadow-2xl">
            <header className="flex items-center gap-4 border-b px-5 py-4">
              <div className="min-w-0 flex-1"><p className="app-muted-text text-[10px] font-semibold">{bank === "homework" ? "作业题库" : "考试题库"} · CH {String(chapter.chapterNumber).padStart(2, "0")}</p><h2 className="mt-1 text-lg font-semibold">{chapter.title}</h2></div>
              <button type="button" onClick={() => setMode(null)} className="flex h-9 w-9 items-center justify-center border" aria-label="关闭弹窗"><X size={17} /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <table className="w-full border-collapse border text-left">
                <thead><tr className="bg-[var(--surface-soft)] app-muted-text"><th className="px-3 py-2 text-[11px]">能力</th><th className="border-l px-3 py-2 text-center text-[11px]">资源</th><th className="border-l px-3 py-2 text-center text-[11px]">题目</th><th className="border-l px-3 py-2 text-right text-[11px]">选择</th></tr></thead>
                <tbody>{skills.map((item) => <tr key={item.key} className="border-t" style={skill === item.key ? { backgroundColor: "var(--support-surface)" } : undefined}><td className="px-3 py-2.5 text-xs font-semibold">{item.label}</td><td className="border-l px-3 py-2.5 text-center font-mono text-xs">{materials.filter((row) => row.languageSkill === item.key).length}</td><td className="border-l px-3 py-2.5 text-center font-mono text-xs">{questions.filter((row) => row.languageSkill === item.key).length}</td><td className="border-l px-3 py-2.5 text-right"><button type="button" onClick={() => setSkill(item.key)} className="text-xs font-semibold" style={{ color: "var(--primary)" }}>{skill === item.key ? "当前" : mode === "view" ? "查看" : "新增"}</button></td></tr>)}</tbody>
              </table>

              {mode === "create" ? (
                <LanguageBankCreateForms key={skill} bank={bank} skill={skill} chapters={[chapter]} materials={materials} />
              ) : (
                <>
                  {(skill === "listening" || skill === "reading") && <div className="overflow-x-auto border"><table className="w-full min-w-[850px] border-collapse text-left"><caption className="border-b px-3 py-2.5 text-left text-sm font-semibold">{skill === "listening" ? "听力音频表" : "阅读文章表"}</caption><thead><tr className="border-b bg-[var(--surface-soft)] app-muted-text"><th className="px-3 py-2 text-[11px]">电子书目录</th><th className="border-l px-3 py-2 text-[11px]">韩语名称</th><th className="border-l px-3 py-2 text-center text-[11px]">难度</th><th className="border-l px-3 py-2 text-center text-[11px]">长度</th><th className="border-l px-3 py-2 text-center text-[11px]">状态</th></tr></thead><tbody>{selectedMaterials.map((item) => <tr key={item.id} className="border-b last:border-b-0"><td className="px-3 py-2.5 text-xs">{koreanEbookSectionLabel(item.ebookSectionStep)}{item.ebookPageReference ? ` · ${item.ebookPageReference}` : ""}</td><td className="border-l px-3 py-2.5 text-sm font-bold">{item.titleKo}</td><td className="border-l px-3 py-2.5 text-center text-xs">{difficultyLabels[item.difficulty]}</td><td className="border-l px-3 py-2.5 text-center text-xs">{lengthLabels[item.materialLength]}</td><td className="border-l px-3 py-2.5 text-center text-xs font-bold">{statusLabels[item.status]}</td></tr>)}{selectedMaterials.length === 0 && <tr><td colSpan={5} className="app-muted-text px-3 py-8 text-center text-xs">本章还没有{skill === "listening" ? "听力音频" : "阅读文章"}。</td></tr>}</tbody></table></div>}
                  <div className="overflow-x-auto border"><table className="w-full min-w-[1050px] border-collapse text-left"><caption className="border-b px-3 py-2.5 text-left text-sm font-semibold">{skills.find((item) => item.key === skill)?.label}题目表</caption><thead><tr className="border-b bg-[var(--surface-soft)] app-muted-text"><th className="px-3 py-2 text-[11px]">电子书目录</th><th className="border-l px-3 py-2 text-[11px]">考查类别</th><th className="border-l px-3 py-2 text-[11px]">题型</th><th className="border-l px-3 py-2 text-center text-[11px]">难度</th><th className="border-l px-3 py-2 text-[11px]">韩语题干</th><th className="border-l px-3 py-2 text-[11px]">关联资源</th><th className="border-l px-3 py-2 text-center text-[11px]">状态</th></tr></thead><tbody>{selectedQuestions.map((item) => <tr key={item.id} className="border-b align-top last:border-b-0"><td className="px-3 py-2.5 text-xs">{koreanEbookSectionLabel(item.ebookSectionStep)}{item.ebookPageReference ? ` · ${item.ebookPageReference}` : ""}</td><td className="border-l px-3 py-2.5 font-mono text-[11px]">{item.assessmentCategory}</td><td className="border-l px-3 py-2.5 text-xs font-bold">{typeLabels[item.questionType]}</td><td className="border-l px-3 py-2.5 text-center text-xs">{difficultyLabels[item.difficulty]}</td><td className="border-l px-3 py-2.5 text-sm font-bold leading-6">{item.promptKo}</td><td className="app-muted-text border-l px-3 py-2.5 text-xs">{item.materialId ? materialById.get(item.materialId)?.titleKo ?? "已关联资源" : "独立题目"}</td><td className="border-l px-3 py-2.5 text-center text-xs font-bold">{statusLabels[item.status]}</td></tr>)}{selectedQuestions.length === 0 && <tr><td colSpan={7} className="app-muted-text px-3 py-9 text-center text-xs">本章还没有该能力题目。</td></tr>}</tbody></table></div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
