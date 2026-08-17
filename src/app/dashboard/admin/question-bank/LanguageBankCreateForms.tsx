"use client";

import { Plus, ShieldCheck } from "lucide-react";
import { useActionState, useState } from "react";

import {
  defaultEbookSectionForSkill,
  KOREAN_EBOOK_SECTIONS,
  koreanEbookSectionLabel,
} from "@/lib/korean-ebook-sections";
import {
  createLanguageBankMaterialAction,
  createLanguageBankQuestionAction,
} from "./language-bank-actions";
import type { LanguageBankActionState } from "./language-bank-actions";

export type LanguageBank = "homework" | "exam";
export type LanguageSkill = "listening" | "speaking" | "reading" | "writing";

export type LanguageBankChapterOption = {
  id: string;
  courseKey: string;
  chapterNumber: number;
  title: string;
};

export type LanguageBankMaterialOption = {
  id: string;
  chapterTestId: string | null;
  languageSkill: "listening" | "reading";
  titleKo: string;
  ebookSectionStep: string;
};

const initialLanguageBankActionState: LanguageBankActionState = {
  status: "idle",
  message: "",
};

const fieldClass = "app-input w-full rounded-md border px-3 py-2.5 text-xs";
const headerCellClass = "w-36 bg-[var(--surface-soft)] px-3 py-3 text-xs font-semibold";
const valueCellClass = "px-3 py-3";

const courseLabels: Record<string, string> = {
  "hangul-introduction": "韩语字母入门",
  "korean-level-one": "韩语初级",
};

const skillLabels: Record<LanguageSkill, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
};

const categories: Record<LanguageSkill, Array<[string, string]>> = {
  listening: [
    ["gist", "主旨理解"], ["detail", "细节理解"], ["intent", "说话人意图"],
    ["relationship", "人物关系"], ["situation", "场景判断"], ["response", "正确回应"],
    ["information_matching", "信息匹配"],
  ],
  speaking: [
    ["read_aloud", "朗读"], ["situational_response", "情景回答"],
    ["description", "内容描述"], ["personal_experience", "个人经历"], ["opinion", "观点表达"],
  ],
  reading: [
    ["main_idea", "主旨理解"], ["detail", "细节理解"],
    ["information_judgment", "信息判断"], ["inference", "内容推断"],
    ["vocabulary", "词汇理解"], ["grammar", "语法考查"],
    ["cohesion", "句子衔接"], ["information_fill", "信息填补"], ["structure", "篇章结构"],
  ],
  writing: [
    ["description", "内容描述"], ["practical", "实用写作"],
    ["narrative", "叙事写作"], ["opinion", "观点表达"],
  ],
};

const questionTypes: Record<LanguageSkill, Array<[string, string]>> = {
  listening: [["single_choice", "单选 · 四个选项"]],
  speaking: [["audio_response", "录音作答"]],
  reading: [
    ["single_choice", "单选 · 四个选项"], ["multiple_choice", "多选 · 四个选项"],
    ["fill_blank", "填空"], ["ordering", "排序 · 四项"],
  ],
  writing: [["long_text", "写作"]],
};

function chapterLabel(chapter: LanguageBankChapterOption) {
  return `${courseLabels[chapter.courseKey] ?? chapter.courseKey} · ${String(chapter.chapterNumber).padStart(2, "0")} · ${chapter.title}`;
}

function ChapterSelect({
  chapters,
  value,
  onChange,
}: {
  chapters: LanguageBankChapterOption[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  if (chapters.length === 1) {
    return (
      <>
        <input type="hidden" name="chapter_test_id" value={chapters[0].id} />
        <p className="py-2.5 text-xs font-semibold">{chapterLabel(chapters[0])}</p>
      </>
    );
  }
  const controlled = value !== undefined;
  return (
    <select
      name="chapter_test_id"
      required
      {...(controlled
        ? { value, onChange: (event) => onChange?.(event.target.value) }
        : { defaultValue: chapters[0]?.id ?? "" })}
      className={fieldClass}
    >
      {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapterLabel(chapter)}</option>)}
    </select>
  );
}

function EbookSectionSelect({ skill }: { skill: LanguageSkill }) {
  return (
    <select name="ebook_section_step" required defaultValue={defaultEbookSectionForSkill(skill)} className={fieldClass}>
      {KOREAN_EBOOK_SECTIONS.map((section) => (
        <option key={section.step} value={section.step}>{koreanEbookSectionLabel(section.step)}</option>
      ))}
    </select>
  );
}

function ActionMessage({ state }: { state: typeof initialLanguageBankActionState }) {
  if (!state.message) return null;
  return (
    <p aria-live="polite" className="border-t px-4 py-3 text-xs font-bold" style={{
      color: state.status === "error" ? "#c94f45" : "var(--status-success)",
      backgroundColor: state.status === "error" ? "#fff0ed" : "var(--status-success-surface)",
      borderColor: "var(--border-subtle)",
    }}>{state.message}</p>
  );
}

function FormFooter({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3" style={{ borderColor: "var(--border-subtle)" }}>
      <span className="app-muted-text inline-flex items-center gap-1.5 text-[10px] font-bold"><ShieldCheck size={12} />题面和答案仅支持韩语</span>
      <button disabled={pending} className="rounded-md px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}>
        {pending ? "正在保存…" : label}
      </button>
    </div>
  );
}

export function LanguageBankCreateForms({
  bank,
  skill,
  chapters,
  materials,
}: {
  bank: LanguageBank;
  skill: LanguageSkill;
  chapters: LanguageBankChapterOption[];
  materials: LanguageBankMaterialOption[];
}) {
  const [materialState, materialAction, materialPending] = useActionState(
    createLanguageBankMaterialAction.bind(null, bank),
    initialLanguageBankActionState
  );
  const [questionState, questionAction, questionPending] = useActionState(
    createLanguageBankQuestionAction.bind(null, bank),
    initialLanguageBankActionState
  );
  const [questionType, setQuestionType] = useState(questionTypes[skill][0][0]);
  const [questionChapter, setQuestionChapter] = useState(chapters[0]?.id ?? "");
  const availableMaterials = materials.filter(
    (material) => material.languageSkill === skill && material.chapterTestId === questionChapter
  );
  const hasSource = skill === "listening" || skill === "reading";
  const hasOptions = ["single_choice", "multiple_choice", "ordering"].includes(questionType);
  const sourceTitle = skill === "listening" ? "录入听力音频" : "录入阅读文章";
  const questionTitle = skill === "listening" ? "新增听力选择题" : skill === "reading" ? "新增阅读题" : `新增${skillLabels[skill]}题`;

  return (
    <section className="border" style={{ borderColor: "var(--border)" }}>
      {hasSource && (
        <details className="border-b" style={{ borderColor: "var(--border)" }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-[var(--surface-soft)]">
            <Plus size={14} style={{ color: "var(--primary)" }} />{sourceTitle}
            <span className="app-muted-text ml-auto text-[10px]">先录入电子书对应资源，再给资源配置题目</span>
          </summary>
          <form action={materialAction} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
            <input type="hidden" name="language_skill" value={skill} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left"><tbody className="divide-y">
                <tr><th className={headerCellClass}>课程章节</th><td className={valueCellClass}><ChapterSelect chapters={chapters} /></td><th className={`${headerCellClass} border-l`}>电子书目录</th><td className={valueCellClass}><EbookSectionSelect skill={skill} /></td></tr>
                <tr><th className={headerCellClass}>电子书页码</th><td className={valueCellClass}><input name="ebook_page_reference" maxLength={80} className={fieldClass} placeholder="例如：第 22—25 页" /></td><th className={`${headerCellClass} border-l`}>韩语资源名称</th><td className={valueCellClass}><input name="title_ko" required className={fieldClass} placeholder="학교에서 있었던 일" /></td></tr>
                <tr><th className={headerCellClass}>难度</th><td className={valueCellClass}><select name="difficulty" className={fieldClass}><option value="beginner">低级</option><option value="intermediate">中级</option><option value="advanced">高级</option></select></td><th className={`${headerCellClass} border-l`}>长度</th><td className={valueCellClass}><select name="material_length" className={fieldClass}><option value="short">短篇</option><option value="medium">中篇</option><option value="long">长篇</option></select></td></tr>
                <tr><th className={headerCellClass}>状态</th><td className={valueCellClass}><select name="status" className={fieldClass}><option value="draft">草稿</option><option value="review">待审核</option><option value="published">已发布</option></select></td><th className={`${headerCellClass} border-l`}>{skill === "listening" ? "音频路径" : "阅读文章"}</th><td className={valueCellClass}>{skill === "listening" ? <input name="audio_path" required className={fieldClass} placeholder="question-bank/audio/example.mp3" /> : <textarea name="content_ko" required rows={6} className={fieldClass} placeholder="읽기 자료를 한국어로 입력하십시오." />}</td></tr>
                {skill === "listening" && <><tr><th className={headerCellClass}>音频秒数</th><td className={valueCellClass}><input name="audio_duration_seconds" type="number" min={1} required className={fieldClass} /></td><th className={`${headerCellClass} border-l`}>原文权限</th><td className="px-3 py-3 text-xs font-bold text-[var(--status-success)]">仅题库管理员可读，学生接口不可读</td></tr><tr><th className={headerCellClass}>韩语听力原文</th><td colSpan={3} className={valueCellClass}><textarea name="transcript_ko" required rows={6} className={fieldClass} placeholder="학생에게 전달되지 않는 관리자 전용 원문" /></td></tr></>}
              </tbody></table>
            </div>
            <FormFooter pending={materialPending} label={`保存${skill === "listening" ? "听力音频" : "阅读文章"}`} />
            <ActionMessage state={materialState} />
          </form>
        </details>
      )}

      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-[var(--surface-soft)]">
          <Plus size={14} style={{ color: "var(--primary)" }} />{questionTitle}
        </summary>
        <form action={questionAction} className="border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <input type="hidden" name="language_skill" value={skill} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left"><tbody className="divide-y">
              <tr><th className={headerCellClass}>课程章节</th><td className={valueCellClass}><ChapterSelect chapters={chapters} value={questionChapter} onChange={setQuestionChapter} /></td><th className={`${headerCellClass} border-l`}>电子书目录</th><td className={valueCellClass}><EbookSectionSelect skill={skill} /></td></tr>
              <tr><th className={headerCellClass}>电子书页码</th><td className={valueCellClass}><input name="ebook_page_reference" maxLength={80} className={fieldClass} placeholder="例如：第 26—28 页" /></td><th className={`${headerCellClass} border-l`}>考查类别</th><td className={valueCellClass}><select name="assessment_category" className={fieldClass}>{categories[skill].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>
              <tr><th className={headerCellClass}>作答题型</th><td className={valueCellClass}><select name="question_type" value={questionType} onChange={(event) => setQuestionType(event.target.value)} className={fieldClass}>{questionTypes[skill].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><th className={`${headerCellClass} border-l`}>难度</th><td className={valueCellClass}><select name="difficulty" className={fieldClass}><option value="beginner">低级</option><option value="intermediate">中级</option><option value="advanced">高级</option></select></td></tr>
              <tr><th className={headerCellClass}>默认分值</th><td className={valueCellClass}><input name="default_points" type="number" min="0.5" step="0.5" defaultValue="1" required className={fieldClass} /></td><th className={`${headerCellClass} border-l`}>状态</th><td className={valueCellClass}><select name="status" className={fieldClass}><option value="draft">草稿</option><option value="review">待审核</option><option value="published">已发布</option></select></td></tr>
              {hasSource && <tr><th className={headerCellClass}>关联{skill === "listening" ? "音频" : "文章"}</th><td colSpan={3} className={valueCellClass}><select name="material_id" required className={fieldClass}><option value="">请选择同章节{skill === "listening" ? "音频" : "文章"}</option>{availableMaterials.map((material) => <option key={material.id} value={material.id}>{material.ebookSectionStep} · {material.titleKo}</option>)}</select></td></tr>}
              <tr><th className={headerCellClass}>韩语题干</th><td colSpan={3} className={valueCellClass}><textarea name="prompt_ko" required rows={4} className={fieldClass} placeholder="가장 알맞은 답을 고르십시오." /></td></tr>
              {hasOptions && <tr><th className={headerCellClass}>四个韩语选项</th><td className={valueCellClass}><textarea name="options_text" required rows={6} className={fieldClass} placeholder={"첫 번째 항목\n두 번째 항목\n세 번째 항목\n네 번째 항목"} /></td><th className={`${headerCellClass} border-l`}>{questionType === "ordering" ? "正确顺序" : "正确选项"}</th><td className={valueCellClass}><input name="answer_letters" required className={fieldClass} placeholder={questionType === "ordering" ? "B → D → A → C" : questionType === "multiple_choice" ? "A, C" : "B"} /></td></tr>}
              {questionType === "fill_blank" && <tr><th className={headerCellClass}>韩语可接受答案</th><td colSpan={3} className={valueCellClass}><textarea name="accepted_answers_text" required rows={5} className={fieldClass} placeholder="每行一个" /></td></tr>}
              {questionType === "long_text" && <tr><th className={headerCellClass}>最低字数</th><td className={valueCellClass}><input name="min_response_characters" type="number" min={1} required className={fieldClass} /></td><th className={`${headerCellClass} border-l`}>最高字数</th><td className={valueCellClass}><input name="max_response_characters" type="number" min={1} required className={fieldClass} /></td></tr>}
              {questionType === "audio_response" && <tr><th className={headerCellClass}>准备秒数</th><td className={valueCellClass}><input name="preparation_seconds" type="number" min={0} defaultValue={10} className={fieldClass} /></td><th className={`${headerCellClass} border-l`}>录音时长</th><td className={valueCellClass}><div className="grid grid-cols-2 gap-2"><input aria-label="最短录音秒数" name="min_recording_seconds" type="number" min={1} required className={fieldClass} placeholder="最短秒数" /><input aria-label="最长录音秒数" name="max_recording_seconds" type="number" min={1} required className={fieldClass} placeholder="最长秒数" /></div></td></tr>}
              <tr><th className={headerCellClass}>韩语解析</th><td className={valueCellClass}><textarea name="explanation_ko" rows={4} className={fieldClass} /></td><th className={`${headerCellClass} border-l`}>韩语参考答案</th><td className={valueCellClass}><textarea name="sample_answer_ko" rows={4} className={fieldClass} /></td></tr>
              <tr><th className={headerCellClass}>韩语评分标准</th><td colSpan={3} className={valueCellClass}><textarea name="rubric_ko" rows={4} className={fieldClass} /></td></tr>
            </tbody></table>
          </div>
          <FormFooter pending={questionPending} label={`保存${skillLabels[skill]}题`} />
          <ActionMessage state={questionState} />
        </form>
      </details>
    </section>
  );
}
