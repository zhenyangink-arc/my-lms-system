"use server";

import { randomInt } from "node:crypto";

import { requireAssessmentPaperManager } from "@/lib/assessment-papers";
import { revalidateDashboard } from "@/lib/revalidate-dashboard";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

import {
  createMathPaper,
  type MathPaperActionResult,
  type MathPaperStore,
} from "./create-paper";

type Supabase = Awaited<ReturnType<typeof requireAssessmentPaperManager>>["supabase"];

function buildStore(supabase: Supabase): MathPaperStore {
  const mathAppId = STUDENT_APP_IDS.math;
  const findContainer: MathPaperStore["findContainer"] = async (lessonId) => {
    const { data } = await supabase
      .from("chapter_tests")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("student_app_id", mathAppId)
      .eq("status", "published")
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  };
  return {
    async findLesson(lessonId) {
      const { data: lesson } = await supabase
        .from("lessons")
        .select("id,title,course_id,is_published")
        .eq("id", lessonId)
        .maybeSingle();
      if (!lesson || lesson.is_published !== true) return null;
      const { data: course } = await supabase
        .from("courses")
        .select("slug,student_app_id")
        .eq("id", lesson.course_id)
        .maybeSingle();
      if (!course || course.student_app_id !== mathAppId) return null;
      return { id: lesson.id, title: lesson.title, courseSlug: course.slug };
    },
    findContainer,
    async createContainer({ lessonId, slug, courseKey, title }) {
      const { data, error } = await supabase
        .from("chapter_tests")
        .insert({
          slug,
          course_key: courseKey,
          chapter_number: 1,
          title: title.slice(0, 120),
          lesson_id: lessonId,
        })
        .select("id")
        .single();
      if (error) {
        // 23505：同一课时已有容器（并发创建），由调用方改读已有的
        return error.code === "23505" ? { conflict: true } : { error: error.message };
      }
      return { id: data.id };
    },
    async createPaper(input) {
      const { data, error } = await supabase.rpc("create_math_paper", {
        p_title: input.title,
        p_description: input.description,
        p_paper_type: input.paperType,
        p_source_test_id: input.containerId,
        p_duration_minutes: input.durationMinutes,
        p_passing_score: input.passingScore,
        p_allow_resubmission: input.allowResubmission,
        p_questions: input.questions,
      });
      if (error || !data) return { error: error?.message };
      return { id: data as string };
    },
    async replacePaper(input) {
      const { error } = await supabase.rpc("replace_math_paper_draft", {
        p_paper_id: input.paperId,
        p_title: input.title,
        p_description: input.description,
        p_duration_minutes: input.durationMinutes,
        p_passing_score: input.passingScore,
        p_allow_resubmission: input.allowResubmission,
        p_questions: input.questions,
      });
      return { error: error?.message };
    },
    async publish(paperId) {
      const { error } = await supabase.rpc("change_assessment_paper_status", {
        p_paper_id: paperId,
        p_status: "published",
      });
      return { error: error?.message };
    },
  };
}

export async function createMathPaperAction(
  fixedType: "homework" | "exam",
  _previousState: { status: "idle" | "success" | "error"; message: string },
  formData: FormData,
): Promise<MathPaperActionResult> {
  void _previousState;
  // 权限：只有平台负责人 / 被授权的标准题库管理员；数据库函数还会再校验一次
  const { supabase, canManagePapers, canReleasePapers } = await requireAssessmentPaperManager();
  if (!canManagePapers) return { status: "error", message: "没有创建标准试卷的权限。" };

  const result = await createMathPaper(
    buildStore(supabase),
    // 判题种子：0 到 2^31-1 的随机整数
    () => randomInt(0, 2 ** 31 - 1),
    {
      // 编辑草稿时带 paper_id（此时不需要课时）；新建时带 lesson_id
      paperId: formData.get("paper_id"),
      paperType: fixedType,
      lessonId: formData.get("lesson_id"),
      allowResubmission: formData.get("allow_resubmission") === "on",
      intent: formData.get("intent"),
      draftJson: formData.get("draft_json"),
      canRelease: canReleasePapers,
    },
  );

  if (result.status === "success") {
    revalidateDashboard("/dashboard/admin/assignments");
    revalidateDashboard("/dashboard/admin/apps/[appSlug]/assessments", "page");
  }
  return result;
}
