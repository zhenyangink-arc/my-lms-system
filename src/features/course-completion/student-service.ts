import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { STUDENT_APP_IDS } from "@/lib/student-apps";
import type {
  CompletionRequirementGap,
  CourseCompletionCertificate,
  StudentCourseCompletionEvaluation,
} from "./types";

type CourseRow = { id: string; title: string };

type ExamEvidence = {
  paperCode: "EX-K1-MID-V1" | "EX-K1-FIN-V1";
  title: "期中考试" | "期末考试";
  score: number | null;
  gradeReleased: boolean;
  pendingGrading: boolean;
  href: string;
};

export type StudentCompletionData = {
  evaluation: StudentCourseCompletionEvaluation | null;
  certificates: CourseCompletionCertificate[];
  courseTitle: string;
  completedRequirements: string[];
  missingRequirements: CompletionRequirementGap[];
  exams: [ExamEvidence, ExamEvidence];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function completionHrefForSpace(space: string, href: string) {
  const portalBase = `/${encodeURIComponent(space)}/apps/korean`;
  if (!href.startsWith("/")) return `${portalBase}/grades`;
  if (href === "/dashboard") return portalBase;
  if (href.startsWith("/dashboard/")) {
    return `${portalBase}${href.slice("/dashboard".length)}`;
  }
  return href.startsWith(portalBase) ? href : `${portalBase}/grades`;
}

function completedRequirements(evaluation: StudentCourseCompletionEvaluation | null) {
  if (!evaluation) return [];
  const evidence = objectValue(evaluation.evidence_snapshot);
  const missingKeys = new Set(evaluation.missing_requirements.map((gap) => gap.key));
  const labels: string[] = [];
  const textbook = objectValue(evidence.textbook);
  const completedChapterCount = numberValue(textbook.completedChapterCount) ?? 0;
  const requiredChapterCount = numberValue(textbook.requiredChapterCount) ?? 0;

  if (requiredChapterCount > 0 && completedChapterCount >= requiredChapterCount) {
    labels.push(`教材要求已完成（${completedChapterCount}/${requiredChapterCount}章）`);
  }

  const groups = [
    ["requiredAssignments", "必修作业"],
    ["formalChapterExams", "正式章节考试"],
    ["stageExams", "阶段考试"],
  ] as const;
  for (const [key, fallback] of groups) {
    for (const item of arrayValue(evidence[key])) {
      const itemKey = stringValue(item.itemKey, "");
      if (!itemKey || missingKeys.has(itemKey) || numberValue(item.score) === null) continue;
      labels.push(stringValue(item.title, fallback));
    }
  }

  for (const [key, itemKey, label] of [
    ["midtermExam", "midterm-exam", "期中考试"],
    ["finalExam", "final-exam", "期末考试"],
  ] as const) {
    if (
      numberValue(objectValue(evidence[key]).score) !== null &&
      !missingKeys.has(itemKey)
    ) {
      labels.push(label);
    }
  }

  const grading = objectValue(evidence.subjectiveGrading);
  if (grading.required === true && grading.complete === true) {
    labels.push("主观题批改已完成");
  }
  const overall = objectValue(evidence.overallScore);
  if (
    overall.published === true &&
    numberValue(overall.score) !== null &&
    !missingKeys.has("overall-score")
  ) {
    labels.push(`综合成绩已发布（${numberValue(overall.score)}分）`);
  }

  return [...new Set(labels)];
}

function examEvidence(
  evaluation: StudentCourseCompletionEvaluation | null,
  kind: "midterm" | "final",
): ExamEvidence {
  const evidence = objectValue(evaluation?.evidence_snapshot);
  const item = objectValue(evidence[kind === "midterm" ? "midtermExam" : "finalExam"]);
  return {
    paperCode: kind === "midterm" ? "EX-K1-MID-V1" : "EX-K1-FIN-V1",
    title: kind === "midterm" ? "期中考试" : "期末考试",
    score: numberValue(item.score),
    gradeReleased: item.gradeReleased === true,
    pendingGrading: item.pendingGrading === true,
    href: stringValue(item.href, "/dashboard/assignments"),
  };
}

export async function getStudentCompletionData({
  supabase,
  tenantId,
  studentId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
}): Promise<StudentCompletionData> {
  const appId = STUDENT_APP_IDS.korean;
  const [evaluationResult, certificateResult] = await Promise.all([
    supabase
      .from("student_course_completion_evaluations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("student_app_id", appId)
      .neq("status", "superseded")
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("course_completion_certificates")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("student_app_id", appId)
      .order("issued_at", { ascending: false }),
  ]);

  if (evaluationResult.error) {
    throw new Error(`无法读取结课资格：${evaluationResult.error.message}`);
  }
  if (certificateResult.error) {
    throw new Error(`无法读取结课证书：${certificateResult.error.message}`);
  }

  const evaluation =
    (evaluationResult.data as StudentCourseCompletionEvaluation | null) ?? null;
  const certificates =
    (certificateResult.data ?? []) as CourseCompletionCertificate[];
  const courseId = evaluation?.course_id ?? certificates[0]?.course_id;
  let courseTitle = certificates[0]?.course_title_snapshot ?? "韩语一级课程";

  if (courseId) {
    const courseResult = await supabase
      .from("courses")
      .select("id,title")
      .eq("id", courseId)
      .eq("student_app_id", appId)
      .maybeSingle();
    if (!courseResult.error && courseResult.data) {
      courseTitle = (courseResult.data as CourseRow).title;
    }
  }

  return {
    evaluation,
    certificates: courseId
      ? certificates.filter((certificate) => certificate.course_id === courseId)
      : certificates,
    courseTitle,
    completedRequirements: completedRequirements(evaluation),
    missingRequirements: evaluation?.missing_requirements ?? [],
    exams: [examEvidence(evaluation, "midterm"), examEvidence(evaluation, "final")],
  };
}
