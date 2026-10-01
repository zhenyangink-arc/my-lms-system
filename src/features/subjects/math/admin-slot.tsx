import { requireActiveUser } from "@/lib/auth";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

import type {
  SubjectAdminSlots,
  SubjectAssessmentAuthoringProps,
} from "../admin-slot-contract.ts";
import { createMathPaperAction } from "./admin/actions";
import { prepareMathMachineGrades } from "./grading/machine-grading.server";
import { MathPaperComposer, type MathPaperLessonOption } from "./admin/MathPaperComposer";
import { draftFromRows, type SavedQuestionRow } from "./admin/paper-model";

const MAX_LESSON_OPTIONS = 300;
const MAX_DRAFT_PAPERS = 50;

type DraftPaperItem = {
  id: string;
  paperCode: string;
  paperType: "homework" | "exam";
  title: string;
  updatedAt: string;
  allowResubmission: boolean;
  lessonLabel: string;
  /** 无法还原为可编辑表单时为 null */
  draft: ReturnType<typeof draftFromRows>;
};

/** 读取当前数学应用的草稿试卷，并还原成可编辑的表单状态（读取全部走平台负责人自己的连接，受 RLS 约束）。 */
async function loadDraftPapers(): Promise<DraftPaperItem[]> {
  const { supabase } = await requireActiveUser();
  const { data: papers } = await supabase
    .from("assessment_papers")
    .select("id,paper_code,paper_type,title,description,duration_minutes,passing_score,allow_resubmission,source_test_id,updated_at")
    .eq("student_app_id", STUDENT_APP_IDS.math)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(MAX_DRAFT_PAPERS);
  if (!papers || papers.length === 0) return [];
  const paperIds = papers.map((paper) => paper.id as string);
  const { data: questions } = await supabase
    .from("assessment_paper_questions")
    .select("id,paper_id,question_type,prompt,options,points,difficulty,sort_order")
    .in("paper_id", paperIds);
  const questionIds = (questions ?? []).map((question) => question.id as string);
  const [{ data: keys }, { data: specs }, { data: containers }] = await Promise.all([
    questionIds.length
      ? supabase.from("assessment_paper_question_keys").select("question_id,correct_answer,explanation").in("question_id", questionIds)
      : Promise.resolve({ data: [] as { question_id: string; correct_answer: string | null; explanation: string | null }[] }),
    questionIds.length
      ? supabase.from("math_paper_question_specs").select("paper_question_id,spec").in("paper_question_id", questionIds)
      : Promise.resolve({ data: [] as { paper_question_id: string; spec: unknown }[] }),
    supabase.from("chapter_tests").select("id,title").in("id", [...new Set(papers.map((paper) => paper.source_test_id as string))]),
  ]);
  const keyByQuestion = new Map((keys ?? []).map((key) => [key.question_id as string, key]));
  const specByQuestion = new Map((specs ?? []).map((spec) => [spec.paper_question_id as string, spec.spec as unknown]));
  const containerTitle = new Map((containers ?? []).map((container) => [container.id as string, container.title as string]));
  return papers.map((paper) => {
    const rows: SavedQuestionRow[] = (questions ?? [])
      .filter((question) => question.paper_id === paper.id)
      .map((question) => ({
        id: question.id as string,
        question_type: question.question_type as string,
        prompt: question.prompt as string,
        options: question.options as unknown,
        points: question.points as number,
        difficulty: question.difficulty as string,
        sort_order: question.sort_order as number,
        correct_answer: keyByQuestion.get(question.id as string)?.correct_answer ?? null,
        explanation: keyByQuestion.get(question.id as string)?.explanation ?? null,
        spec: specByQuestion.get(question.id as string) ?? null,
      }));
    return {
      id: paper.id as string,
      paperCode: paper.paper_code as string,
      paperType: paper.paper_type as "homework" | "exam",
      title: paper.title as string,
      updatedAt: paper.updated_at as string,
      allowResubmission: paper.allow_resubmission === true,
      lessonLabel: containerTitle.get(paper.source_test_id as string) ?? "数学课时",
      draft: draftFromRows(
        {
          title: paper.title as string,
          description: (paper.description as string) ?? "",
          duration_minutes: paper.duration_minutes as number | null,
          passing_score: paper.passing_score as number | string | null,
        },
        rows,
      ),
    };
  });
}

async function loadLessonOptions(): Promise<MathPaperLessonOption[]> {
  const { supabase } = await requireActiveUser();
  const { data: courses } = await supabase
    .from("courses")
    .select("id,title,sort_order")
    .eq("student_app_id", STUDENT_APP_IDS.math)
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(100);
  if (!courses || courses.length === 0) return [];
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id,title,course_id,sort_order")
    .in("course_id", [...courseById.keys()])
    .eq("is_published", true)
    .order("sort_order", { ascending: true })
    .limit(MAX_LESSON_OPTIONS);
  return (lessons ?? [])
    .map((lesson) => ({
      id: lesson.id,
      label: `${courseById.get(lesson.course_id)?.title ?? "数学课程"} · ${lesson.title}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN"));
}

/** 数学“制作标准试卷”界面：平台负责人直接录入题目（见 docs/math-admin-authoring-design.md）。 */
async function MathAssessmentAuthoring({ canRelease }: SubjectAssessmentAuthoringProps) {
  const [lessons, drafts] = await Promise.all([loadLessonOptions(), loadDraftPapers()]);
  return (
    <div className="flex flex-wrap gap-2">
      <MathPaperComposer
        paperType="homework"
        lessons={lessons}
        canPublish={canRelease}
        createAction={createMathPaperAction.bind(null, "homework")}
      />
      <MathPaperComposer
        paperType="exam"
        lessons={lessons}
        canPublish={canRelease}
        createAction={createMathPaperAction.bind(null, "exam")}
      />
      {drafts.length > 0 && (
        <section className="basis-full space-y-2" aria-labelledby="math-drafts-title">
          <h3 id="math-drafts-title" className="text-xs font-semibold">
            草稿试卷（可以修改题目后再发布）
          </h3>
          <ul className="divide-y border bg-[var(--card)]" style={{ borderColor: "var(--border-subtle)" }}>
            {drafts.map((paper) => (
              <li key={paper.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{paper.title}</p>
                  <p className="app-muted-text mt-0.5 text-[11px]">
                    {paper.paperType === "exam" ? "考试卷" : "作业卷"} · {paper.lessonLabel} ·{" "}
                    <span className="font-mono">{paper.paperCode}</span>
                  </p>
                </div>
                {paper.draft ? (
                  <MathPaperComposer
                    key={`${paper.id}:${paper.updatedAt}`}
                    paperType={paper.paperType}
                    lessons={[]}
                    canPublish={canRelease}
                    createAction={createMathPaperAction.bind(null, paper.paperType)}
                    edit={{
                      paperId: paper.id,
                      paperCode: paper.paperCode,
                      initialDraft: paper.draft,
                      allowResubmission: paper.allowResubmission,
                      lessonLabel: paper.lessonLabel,
                    }}
                  />
                ) : (
                  <span className="app-muted-text text-[11px]">无法编辑，请复制为新草稿</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export const mathAdminSlots: SubjectAdminSlots = {
  AssessmentAuthoring: MathAssessmentAuthoring,
  prepareMachineGrades: prepareMathMachineGrades,
};
