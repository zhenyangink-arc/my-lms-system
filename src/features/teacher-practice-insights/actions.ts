"use server";

import { requireActiveUser } from "@/lib/auth";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import {
  PRACTICE_SKILLS,
  PRACTICE_SKILL_LABELS,
  type PracticeSkill,
} from "./model";
import type { PracticeRecommendationActionState } from "./action-state";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PracticeRecommendationTarget =
  | { type: "chapter"; id: string }
  | { type: "skill"; id: PracticeSkill };

function result(
  status: "success" | "error",
  message: string,
): PracticeRecommendationActionState {
  return { status, message };
}

export async function recommendStudentPracticeAction(
  studentId: string,
  target: PracticeRecommendationTarget,
  _state: PracticeRecommendationActionState,
  _formData: FormData,
): Promise<PracticeRecommendationActionState> {
  void _state;
  void _formData;
  if (!UUID_PATTERN.test(studentId)) return result("error", "学生编号不正确。");

  const { supabase, user, profile, tenant } = await requireActiveUser();
  if (profile?.role !== "teacher" || !tenant) {
    return result("error", "只有机构老师可以发送巩固推荐。");
  }

  const appId = STUDENT_APP_IDS.korean;
  const assignedIds = await getTeacherAssignedStudentIds(
    supabase,
    tenant.id,
    user.id,
    appId,
  );
  if (!assignedIds.includes(studentId)) {
    return result("error", "该学生不在你当前应用的负责名单中。");
  }

  let title = "";
  let content = "";
  let nextAction = "";

  if (target.type === "skill") {
    if (!(PRACTICE_SKILLS as readonly string[]).includes(target.id)) {
      return result("error", "专项训练类型不正确。");
    }
    const { data, error } = await supabase
      .from("student_review_items")
      .select("error_count,status,course_chapter_id,feedback_snapshot")
      .eq("tenant_id", tenant.id)
      .eq("student_id", studentId)
      .eq("student_app_id", appId)
      .eq("skill", target.id)
      .neq("status", "mastered");
    if (error) return result("error", "无法核对该生的专项薄弱数据。");
    const errorCount = (data ?? []).reduce(
      (sum, item) => sum + Math.max(0, Number(item.error_count) || 0),
      0,
    );
    if (errorCount <= 0) {
      return result("error", "该生当前没有这项能力的未掌握错误，未发送推荐。");
    }

    const label = PRACTICE_SKILL_LABELS[target.id];
    title = `巩固推荐：${label}专项训练`;
    content = `依据该生统一复习中心的真实记录，${label}仍有 ${errorCount} 次未掌握错误。`;
    nextAction = `请进入${label}专项训练完成针对性练习：/${tenant.slug}/apps/korean/practice/skills/${target.id}`;
  } else {
    if (!UUID_PATTERN.test(target.id)) return result("error", "章节编号不正确。");
    const [chapterResult, reviewResult, progressResult] = await Promise.all([
      supabase
        .from("course_chapters")
        .select("id,title,slug,lesson_id")
        .eq("id", target.id)
        .eq("is_published", true)
        .maybeSingle(),
      supabase
        .from("student_review_items")
        .select("error_count,status")
        .eq("tenant_id", tenant.id)
        .eq("student_id", studentId)
        .eq("student_app_id", appId)
        .eq("course_chapter_id", target.id)
        .neq("status", "mastered"),
      supabase
        .from("student_chapter_practice_progress")
        .select("mastery_percent,practice_unit_id")
        .eq("tenant_id", tenant.id)
        .eq("student_id", studentId),
    ]);
    if (chapterResult.error || !chapterResult.data || reviewResult.error || progressResult.error) {
      return result("error", "无法核对该生的章节薄弱数据。");
    }

    const { data: unitData, error: unitError } = await supabase
      .from("chapter_practice_units")
      .select("id,course_chapter_id")
      .eq("student_app_id", appId)
      .eq("course_chapter_id", target.id)
      .eq("status", "published");
    if (unitError) return result("error", "无法核对章节巩固内容。");
    const unitIds = new Set((unitData ?? []).map((unit) => String(unit.id)));
    const matchingProgress = (progressResult.data ?? []).filter((progress) =>
      unitIds.has(String(progress.practice_unit_id)),
    );
    const errorCount = (reviewResult.data ?? []).reduce(
      (sum, item) => sum + Math.max(0, Number(item.error_count) || 0),
      0,
    );
    const mastery = matchingProgress.length
      ? Math.min(...matchingProgress.map((item) => Number(item.mastery_percent) || 0))
      : null;
    if (errorCount <= 0 && mastery === null) {
      return result("error", "该生当前没有这个章节的巩固或薄弱数据，未发送推荐。");
    }

    const chapter = chapterResult.data;
    const { data: lesson } = await supabase
      .from("lessons")
      .select("course_id")
      .eq("id", chapter.lesson_id)
      .maybeSingle();
    const { data: course } = lesson?.course_id
      ? await supabase
          .from("courses")
          .select("slug,title")
          .eq("id", lesson.course_id)
          .eq("student_app_id", appId)
          .maybeSingle()
      : { data: null };
    if (!course?.slug || !chapter.slug) {
      return result("error", "该章节缺少学生端课程路径，未发送推荐。");
    }

    const evidence = errorCount > 0
      ? `该章节仍有 ${errorCount} 次未掌握错误`
      : `该章节当前掌握度为 ${Math.round(mastery ?? 0)}%`;
    title = `巩固推荐：复习「${chapter.title}」`;
    content = `依据该生的真实巩固与复习记录，${evidence}。`;
    nextAction = `请进入「${course.title}」的「${chapter.title}」完成巩固：/${tenant.slug}/apps/korean/practice/course/${course.slug}/${chapter.slug}`;
  }

  const { error: saveError } = await supabase.rpc("save_learning_record_note", {
    p_id: null,
    p_student_id: studentId,
    p_record_type: "plan",
    p_title: title,
    p_content: content,
    p_next_action: nextAction,
    p_visibility: "student_visible",
    p_occurred_at: new Date().toISOString(),
    p_student_app_id: appId,
  });
  if (saveError) {
    return result("error", "推荐发送失败，请确认你具备该应用的教学任务权限。");
  }

  return result("success", "推荐已发送，学生可在学习记录中看到。");
}
