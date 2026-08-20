import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ManagementAppAccess } from "@/lib/management-apps";
import type {
  CourseCompletionCertificate,
  StudentCourseCompletionEvaluation,
} from "./types";
import type {
  CompletionReviewCertificate,
  CompletionReviewData,
  CompletionReviewEvaluation,
} from "./review-types";

type ProfileRow = { id: string; full_name: string | null };
type CourseRow = { id: string; title: string };
type RetakePaperRow = { id: string; title: string; paper_code: string };
type AssignmentPaperRow = { id: string; source_paper_id: string | null };

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

function completedItems(evaluation: StudentCourseCompletionEvaluation) {
  const evidence = objectValue(evaluation.evidence_snapshot);
  const missingKeys = new Set(evaluation.missing_requirements.map((gap) => gap.key));
  const labels: string[] = [];
  const textbook = objectValue(evidence.textbook);
  const chapterCount = Number(textbook.completedChapterCount ?? 0);
  const requiredChapterCount = Number(textbook.requiredChapterCount ?? 0);

  if (chapterCount > 0) {
    labels.push(`教材已完成 ${chapterCount}/${requiredChapterCount} 章`);
  }

  const itemGroups = [
    ["requiredAssignments", "作业", false],
    ["formalChapterExams", "正式章节考试", true],
    ["stageExams", "阶段考试", true],
  ] as const;

  for (const [key, fallback, requiresScore] of itemGroups) {
    for (const item of arrayValue(evidence[key])) {
      const itemKey = typeof item.itemKey === "string" ? item.itemKey : "";
      if (
        !itemKey ||
        missingKeys.has(itemKey) ||
        (requiresScore && typeof item.score !== "number")
      ) continue;
      const title = typeof item.title === "string" ? item.title : null;
      const chapter = Number(item.chapterNumber ?? 0);
      const stage = Number(item.stageNumber ?? 0);
      labels.push(
        title ??
          (chapter > 0
            ? `第${chapter}章${fallback}`
            : stage > 0
              ? `第${stage}阶段考试`
              : fallback),
      );
    }
  }

  const singleItems = [
    ["midtermExam", "midterm-exam", "期中考试"],
    ["finalExam", "final-exam", "期末考试"],
  ] as const;
  for (const [key, itemKey, label] of singleItems) {
    const item = objectValue(evidence[key]);
    if (typeof item.score === "number" && !missingKeys.has(itemKey)) labels.push(label);
  }

  const grading = objectValue(evidence.subjectiveGrading);
  if (grading.required === true && grading.complete === true) labels.push("主观题批改已完成");
  const score = objectValue(evidence.overallScore);
  if (score.published === true && typeof score.score === "number") {
    labels.push(`综合成绩已发布（${score.score}分）`);
  }

  return [...new Set(labels)];
}

function toEvaluation(
  row: StudentCourseCompletionEvaluation,
  profiles: Map<string, string>,
  courses: Map<string, string>,
): CompletionReviewEvaluation {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: profiles.get(row.student_id) ?? "未填写姓名",
    courseId: row.course_id,
    courseTitle: courses.get(row.course_id) ?? "未命名课程",
    status: row.status as CompletionReviewEvaluation["status"],
    overallScore: row.overall_score,
    evaluatedAt: row.evaluated_at,
    missingRequirements: row.missing_requirements,
    completedItems: completedItems(row),
  };
}

export async function getCompletionReviewData(
  access: ManagementAppAccess,
): Promise<CompletionReviewData> {
  if (!access.tenantId) throw new Error("结课审核需要有效的机构上下文。");
  const supabase = await createClient();
  const [evaluationResult, certificateResult, retakePaperResult] = await Promise.all([
    supabase
      .from("student_course_completion_evaluations")
      .select("*")
      .eq("tenant_id", access.tenantId)
      .eq("student_app_id", access.appId)
      .neq("status", "superseded")
      .order("evaluated_at", { ascending: false }),
    supabase
      .from("course_completion_certificates")
      .select("*")
      .eq("tenant_id", access.tenantId)
      .eq("student_app_id", access.appId)
      .order("issued_at", { ascending: false }),
    supabase
      .from("assessment_papers")
      .select("id,title,paper_code")
      .eq("student_app_id", access.appId)
      .eq("paper_type", "exam")
      .eq("status", "published")
      .order("paper_code", { ascending: true }),
  ]);

  if (evaluationResult.error) {
    throw new Error(`无法读取结课资格：${evaluationResult.error.message}`);
  }
  if (certificateResult.error) {
    throw new Error(`无法读取结课证书：${certificateResult.error.message}`);
  }
  if (retakePaperResult.error) {
    throw new Error(`无法读取补考试卷：${retakePaperResult.error.message}`);
  }

  const evaluations = (evaluationResult.data ?? []) as StudentCourseCompletionEvaluation[];
  const certificates = (certificateResult.data ?? []) as CourseCompletionCertificate[];
  const studentIds = [...new Set(evaluations.map((item) => item.student_id))];
  const courseIds = [...new Set(evaluations.map((item) => item.course_id))];
  const failedAssignmentIds = [...new Set(evaluations.flatMap((item) =>
    item.missing_requirements
      .filter((gap) => gap.status === "failed" && gap.sourceId)
      .map((gap) => gap.sourceId as string),
  ))];
  const admin = createAdminClient();
  const [profileResult, courseResult, assignmentPaperResult] = await Promise.all([
    studentIds.length
      ? admin.from("profiles").select("id,full_name").in("id", studentIds)
      : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    courseIds.length
      ? supabase.from("courses").select("id,title").in("id", courseIds)
      : Promise.resolve({ data: [] as CourseRow[], error: null }),
    failedAssignmentIds.length
      ? supabase
          .from("learning_assignments")
          .select("id,source_paper_id")
          .in("id", failedAssignmentIds)
      : Promise.resolve({ data: [] as AssignmentPaperRow[], error: null }),
  ]);

  if (profileResult.error) throw new Error(`无法读取学生姓名：${profileResult.error.message}`);
  if (courseResult.error) throw new Error(`无法读取课程名称：${courseResult.error.message}`);
  if (assignmentPaperResult.error) {
    throw new Error(`无法读取原考试试卷：${assignmentPaperResult.error.message}`);
  }

  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile.full_name?.trim() || "未填写姓名",
    ]),
  );
  const courses = new Map(
    ((courseResult.data ?? []) as CourseRow[]).map((course) => [course.id, course.title]),
  );
  const certificateScopes = new Set(
    certificates.map((item) => `${item.student_id}:${item.course_id}`),
  );
  const currentEligibleByStudentCourse = new Map(
    evaluations
      .filter((item) => item.status === "eligible" && item.eligible)
      .map((item) => [`${item.student_id}:${item.course_id}`, item.id]),
  );
  const reviewEvaluations = evaluations.map((item) => toEvaluation(item, profiles, courses));

  const reviewCertificates: CompletionReviewCertificate[] = certificates.map((item) => ({
    id: item.id,
    evaluationId: item.evaluation_id,
    studentId: item.student_id,
    studentName: item.student_name_snapshot,
    courseId: item.course_id,
    courseTitle: item.course_title_snapshot,
    certificateNumber: item.certificate_number,
    status: item.status,
    overallScore: item.overall_score_snapshot,
    issuedAt: item.issued_at,
    revokedAt: item.revoked_at,
    revocationReason: item.revocation_reason,
    replacementEvaluationId:
      currentEligibleByStudentCourse.get(`${item.student_id}:${item.course_id}`) ?? null,
  }));

  return {
    eligible: reviewEvaluations.filter(
      (item) =>
        item.status === "eligible" &&
        !certificateScopes.has(`${item.studentId}:${item.courseId}`),
    ),
    notEligible: reviewEvaluations.filter((item) => item.status !== "eligible"),
    issued: reviewCertificates.filter((item) => item.status === "issued"),
    revoked: reviewCertificates.filter(
      (item) => item.status === "revoked" || item.status === "reissued",
    ),
    retakePapers: ((retakePaperResult.data ?? []) as RetakePaperRow[]).map((paper) => ({
      id: paper.id,
      title: paper.title,
      paperCode: paper.paper_code,
    })),
    retakePaperIdByAssignmentId: Object.fromEntries(
      ((assignmentPaperResult.data ?? []) as AssignmentPaperRow[])
        .filter((assignment) => assignment.source_paper_id)
        .map((assignment) => [assignment.id, assignment.source_paper_id as string]),
    ),
  };
}
