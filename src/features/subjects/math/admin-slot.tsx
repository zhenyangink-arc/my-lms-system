import { requireActiveUser } from "@/lib/auth";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

import type {
  SubjectAdminSlots,
  SubjectAssessmentAuthoringProps,
} from "../admin-slot-contract.ts";
import { createMathPaperAction } from "./admin/actions";
import { MathPaperComposer, type MathPaperLessonOption } from "./admin/MathPaperComposer";

const MAX_LESSON_OPTIONS = 300;

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
  const lessons = await loadLessonOptions();
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
    </div>
  );
}

export const mathAdminSlots: SubjectAdminSlots = {
  AssessmentAuthoring: MathAssessmentAuthoring,
};
