import { LibraryBig, ListChecks, Rows3 } from "lucide-react";

import { requireStandardQuestionBankManager } from "@/lib/question-bank";
import {
  LanguageChapterBankActions,
  type LanguageChapterMaterial,
  type LanguageChapterQuestion,
} from "./LanguageChapterBankActions";
import type { LanguageSkill } from "./LanguageBankCreateForms";
import {
  QuestionBankSectionNav,
  type QuestionBankSection,
} from "./QuestionBankSectionNav";

type LanguageBankSection = Exclude<QuestionBankSection, "chapter">;

type MaterialRow = {
  id: string;
  chapter_test_id: string | null;
  language_skill: "listening" | "reading";
  difficulty: "beginner" | "intermediate" | "advanced";
  material_length: "short" | "medium" | "long";
  title_ko: string;
  ebook_section_step: string;
  ebook_page_reference: string;
  status: "draft" | "review" | "published" | "retired";
};

type QuestionRow = {
  id: string;
  chapter_test_id: string | null;
  material_id: string | null;
  language_skill: LanguageSkill;
  assessment_category: string;
  question_type: LanguageChapterQuestion["questionType"];
  difficulty: "beginner" | "intermediate" | "advanced";
  prompt_ko: string;
  ebook_section_step: string;
  ebook_page_reference: string;
  status: "draft" | "review" | "published" | "retired";
};

type ChapterRow = {
  id: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
};

const lessonGroups = [
  { courseKey: "hangul-introduction", label: "预备课：韩文字母入门" },
  { courseKey: "korean-level-one", label: "第 1 课：韩国语1级" },
  { courseKey: "korean-level-two", label: "第 2 课：韩国语2级" },
] as const;

const skills: LanguageSkill[] = ["listening", "speaking", "reading", "writing"];

export async function LanguageQuestionBankWorkspace({
  bank,
}: {
  bank: LanguageBankSection;
}) {
  const { supabase } = await requireStandardQuestionBankManager();
  const [chaptersResult, materialsResult, questionsResult] = await Promise.all([
    supabase.from("chapter_tests").select("id,course_key,chapter_number,title,korean_title").order("course_key").order("chapter_number"),
    supabase.from(`${bank}_bank_materials`).select("id,chapter_test_id,language_skill,difficulty,material_length,title_ko,ebook_section_step,ebook_page_reference,status").order("created_at", { ascending: false }),
    supabase.from(`${bank}_bank_questions`).select("id,chapter_test_id,material_id,language_skill,assessment_category,question_type,difficulty,prompt_ko,ebook_section_step,ebook_page_reference,status").order("created_at", { ascending: false }),
  ]);
  const chapters = (chaptersResult.data ?? []) as ChapterRow[];
  const materials = (materialsResult.data ?? []) as MaterialRow[];
  const questions = (questionsResult.data ?? []) as QuestionRow[];
  const title = bank === "homework" ? "作业题库" : "考试题库";
  const publishedCount = questions.filter((item) => item.status === "published").length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-6 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <QuestionBankSectionNav active={bank} />

        <section className="border-y py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-xl font-semibold">{title}</h2></div>
            <dl className="flex flex-wrap items-center">
              {[["课程章节", chapters.length, Rows3], ["题库资源", materials.length, LibraryBig], ["已发布题目", publishedCount, ListChecks]].map(([label, value, Icon], index) => { const MetricIcon = Icon as typeof Rows3; return <div key={String(label)} className={`min-w-28 px-4 text-center ${index ? "border-l" : ""}`}><dd className="flex items-center justify-center gap-1.5 font-mono text-lg font-semibold"><MetricIcon size={14} className="app-muted-text" />{String(value)}</dd><dt className="app-muted-text text-[10px] font-bold">{String(label)}</dt></div>; })}
            </dl>
          </div>
        </section>

        {(chaptersResult.error || materialsResult.error || questionsResult.error) && <section className="border border-[#c94f45] bg-[#fff0ed] px-4 py-3 text-xs font-bold text-[#c94f45]">{title}暂时无法读取，请稍后重试或联系管理员。</section>}

        <section className="border" style={{ borderColor: "var(--border)" }}>
          <h3 className="border-b bg-[var(--surface-soft)] px-4 py-3 text-sm font-semibold">韩语初级</h3>
          {lessonGroups.map((lesson, lessonIndex) => {
            const lessonChapters = chapters.filter((chapter) => chapter.course_key === lesson.courseKey);
            return (
              <details key={lesson.courseKey} open={lessonIndex === 0} className="border-b last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-[var(--card)] px-4 py-3 hover:bg-[var(--surface-soft)]"><span className="text-sm font-semibold">{lesson.label}</span><span className="app-muted-text text-[11px] font-semibold">{lessonChapters.length} 个章节</span></summary>
                <div className="overflow-x-auto border-t">
                  <table className="w-full min-w-[1180px] border-collapse text-left">
                    <thead><tr className="border-b bg-[var(--surface-soft)] app-muted-text"><th className="px-4 py-2.5 text-[11px]">章节</th><th className="border-l px-4 py-2.5 text-[11px]">章节标题</th><th className="border-l px-4 py-2.5 text-center text-[11px]">听力</th><th className="border-l px-4 py-2.5 text-center text-[11px]">口语</th><th className="border-l px-4 py-2.5 text-center text-[11px]">阅读</th><th className="border-l px-4 py-2.5 text-center text-[11px]">写作</th><th className="border-l px-4 py-2.5 text-center text-[11px]">资源</th><th className="border-l px-4 py-2.5 text-center text-[11px]">题目合计</th><th className="border-l px-4 py-2.5 text-right text-[11px]">操作</th></tr></thead>
                    <tbody>
                      {lessonChapters.map((chapter) => {
                        const chapterMaterials = materials.filter((item) => item.chapter_test_id === chapter.id);
                        const chapterQuestions = questions.filter((item) => item.chapter_test_id === chapter.id);
                        const actionMaterials: LanguageChapterMaterial[] = chapterMaterials.map((item) => ({ id: item.id, chapterTestId: item.chapter_test_id, languageSkill: item.language_skill, titleKo: item.title_ko, ebookSectionStep: item.ebook_section_step, difficulty: item.difficulty, materialLength: item.material_length, ebookPageReference: item.ebook_page_reference, status: item.status }));
                        const actionQuestions: LanguageChapterQuestion[] = chapterQuestions.map((item) => ({ id: item.id, materialId: item.material_id, languageSkill: item.language_skill, assessmentCategory: item.assessment_category, questionType: item.question_type, difficulty: item.difficulty, promptKo: item.prompt_ko, ebookSectionStep: item.ebook_section_step, ebookPageReference: item.ebook_page_reference, status: item.status }));
                        return <tr key={chapter.id} className="border-b last:border-b-0 hover:bg-[var(--surface-soft)]"><td className="px-4 py-3 font-mono text-[11px] font-semibold app-muted-text">CH {String(chapter.chapter_number).padStart(2, "0")}</td><td className="border-l px-4 py-3"><p className="text-sm font-semibold">{chapter.title}</p><p className="app-muted-text mt-0.5 text-[10px]">{chapter.korean_title}</p></td>{skills.map((skill) => <td key={skill} className="border-l px-4 py-3 text-center font-mono text-xs">{chapterQuestions.filter((item) => item.language_skill === skill).length}</td>)}<td className="border-l px-4 py-3 text-center font-mono text-xs">{chapterMaterials.length}</td><td className="border-l px-4 py-3 text-center font-mono text-xs font-semibold">{chapterQuestions.length}</td><td className="border-l px-4 py-3 text-right"><LanguageChapterBankActions bank={bank} chapter={{ id: chapter.id, courseKey: chapter.course_key, chapterNumber: chapter.chapter_number, title: chapter.title }} materials={actionMaterials} questions={actionQuestions} /></td></tr>;
                      })}
                      {lessonChapters.length === 0 && <tr><td colSpan={9} className="app-muted-text px-4 py-7 text-center text-xs">该课暂未建立章节题库。</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </section>
      </div>
    </div>
  );
}
