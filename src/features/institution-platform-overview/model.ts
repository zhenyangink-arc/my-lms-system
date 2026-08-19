import type {
  InstitutionClassComparison,
  InstitutionLearningOverview,
  InstitutionPlatformOverviewSnapshot,
  OverviewRate,
} from "./types.ts";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`机构学习概览缺少 ${field}`);
  }
  return value;
}

function rate(completed: unknown, total: unknown, percentage: unknown): OverviewRate {
  return {
    completed: numberValue(completed),
    total: numberValue(total),
    rate: numberValue(percentage),
  };
}

function parseClass(value: unknown): InstitutionClassComparison {
  const row = record(value);
  return {
    classKey: stringValue(row.class_key, "class_key"),
    className: stringValue(row.class_name, "class_name"),
    teacherId: stringValue(row.teacher_id, "teacher_id"),
    studentAppId: stringValue(row.student_app_id, "student_app_id"),
    studentCount: numberValue(row.student_count),
    active: rate(row.active_count, row.student_count, row.active_rate),
    requiredCompletion: rate(
      row.required_task_completed,
      row.required_task_total,
      row.required_completion_rate,
    ),
  };
}

function parseInstitution(value: unknown): InstitutionLearningOverview {
  const row = record(value);
  const studentCount = numberValue(row.student_count);
  return {
    tenantId: stringValue(row.tenant_id, "tenant_id"),
    tenantName: stringValue(row.tenant_name, "tenant_name"),
    studentCount,
    active: rate(row.active_count, studentCount, row.active_rate),
    requiredCompletion: rate(
      row.required_task_completed,
      row.required_task_total,
      row.required_completion_rate,
    ),
    homeworkOnTime: rate(
      row.homework_on_time_count,
      row.homework_due_total,
      row.homework_on_time_rate,
    ),
    examParticipation: rate(
      row.exam_participated_count,
      row.exam_eligible_total,
      row.exam_participation_rate,
    ),
    chapterPracticeUsage: rate(
      row.chapter_practice_user_count,
      studentCount,
      row.chapter_practice_usage_rate,
    ),
    reviewUsage: rate(
      row.review_user_count,
      studentCount,
      row.review_usage_rate,
    ),
    classes: Array.isArray(row.classes) ? row.classes.map(parseClass) : [],
  };
}

export function parseInstitutionPlatformOverviewSnapshot(
  value: unknown,
): InstitutionPlatformOverviewSnapshot {
  const payload = record(value);
  const scope = payload.scope;
  if (scope !== "institution" && scope !== "platform") {
    throw new Error("机构学习概览包含未知范围");
  }
  return {
    generatedAt: stringValue(payload.generated_at, "generated_at"),
    scope,
    institutions: Array.isArray(payload.institutions)
      ? payload.institutions.map(parseInstitution)
      : [],
  };
}

export type OverviewFixtureStudent = {
  tenantId: string;
  studentId: string;
};

export type OverviewFixtureFact = {
  tenantId: string;
  studentId: string;
  activeToday?: boolean;
  requiredTaskTotal?: number;
  requiredTaskCompleted?: number;
  homeworkDueTotal?: number;
  homeworkOnTimeCount?: number;
  examEligibleTotal?: number;
  examParticipatedCount?: number;
  usedChapterPractice?: boolean;
  usedReview?: boolean;
};

function percentage(completed: number, total: number) {
  return total === 0 ? 0 : Math.round((completed * 1000) / total) / 10;
}

/** Deterministic fixture counterpart for aggregate and tenant-scope tests. */
export function buildInstitutionPlatformOverviewFixture({
  scope,
  tenants,
  authorizedTenantIds,
  students,
  facts,
  generatedAt,
}: {
  scope: "institution" | "platform";
  tenants: Array<{ tenantId: string; tenantName: string }>;
  authorizedTenantIds: Iterable<string>;
  students: OverviewFixtureStudent[];
  facts: OverviewFixtureFact[];
  generatedAt: string;
}): InstitutionPlatformOverviewSnapshot {
  const authorized = new Set(authorizedTenantIds);
  const institutions = tenants
    .filter((tenant) => authorized.has(tenant.tenantId))
    .map<InstitutionLearningOverview>((tenant) => {
      const tenantStudents = students.filter(
        (student) => student.tenantId === tenant.tenantId,
      );
      const studentIds = new Set(tenantStudents.map((student) => student.studentId));
      const tenantFacts = facts.filter(
        (fact) =>
          fact.tenantId === tenant.tenantId && studentIds.has(fact.studentId),
      );
      const sum = (field: keyof OverviewFixtureFact) =>
        tenantFacts.reduce((total, fact) => total + numberValue(fact[field]), 0);
      const count = (field: "activeToday" | "usedChapterPractice" | "usedReview") =>
        new Set(
          tenantFacts
            .filter((fact) => fact[field] === true)
            .map((fact) => fact.studentId),
        ).size;
      const studentCount = tenantStudents.length;
      const activeCount = count("activeToday");
      const requiredTotal = sum("requiredTaskTotal");
      const requiredCompleted = sum("requiredTaskCompleted");
      const homeworkTotal = sum("homeworkDueTotal");
      const homeworkCompleted = sum("homeworkOnTimeCount");
      const examTotal = sum("examEligibleTotal");
      const examCompleted = sum("examParticipatedCount");
      const chapterUsers = count("usedChapterPractice");
      const reviewUsers = count("usedReview");
      return {
        tenantId: tenant.tenantId,
        tenantName: tenant.tenantName,
        studentCount,
        active: { completed: activeCount, total: studentCount, rate: percentage(activeCount, studentCount) },
        requiredCompletion: { completed: requiredCompleted, total: requiredTotal, rate: percentage(requiredCompleted, requiredTotal) },
        homeworkOnTime: { completed: homeworkCompleted, total: homeworkTotal, rate: percentage(homeworkCompleted, homeworkTotal) },
        examParticipation: { completed: examCompleted, total: examTotal, rate: percentage(examCompleted, examTotal) },
        chapterPracticeUsage: { completed: chapterUsers, total: studentCount, rate: percentage(chapterUsers, studentCount) },
        reviewUsage: { completed: reviewUsers, total: studentCount, rate: percentage(reviewUsers, studentCount) },
        classes: [],
      };
    })
    .sort((left, right) => left.tenantName.localeCompare(right.tenantName, "zh-CN"));

  return { generatedAt, scope, institutions };
}
