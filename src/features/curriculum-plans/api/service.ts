import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import { createHomeLearningTaskKey } from "@/features/student-home-learning/priority";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { expandPlanItemTime, itemOffsetMinutes } from "../time";
import type {
  CurriculumPlanStudent,
  CurriculumPlanTemplate,
  CurriculumPlanTemplateItem,
  InstitutionCurriculumPlan,
} from "../types";

type TemplateRow = {
  id: string;
  student_app_id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  duration_days: number;
  version: number;
  status: CurriculumPlanTemplate["status"];
  published_at: string | null;
  updated_at: string;
};

type ItemRow = {
  id: string;
  template_id: string;
  day_offset: number;
  start_minute: number;
  duration_minutes: number;
  activity_type: CurriculumPlanTemplateItem["activityType"];
  source_type: string;
  source_id: string | null;
  title: string;
  destination_path: string | null;
  instructions: string | null;
  is_required: boolean;
  sort_order: number;
};

type InstitutionPlanRow = {
  id: string;
  template_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: InstitutionCurriculumPlan["status"];
  published_at: string | null;
};

export const TEMPLATE_COLUMNS =
  "id,student_app_id,course_id,title,description,duration_days,version,status,published_at,updated_at";
export const TEMPLATE_ITEM_COLUMNS =
  "id,template_id,day_offset,start_minute,duration_minutes,activity_type,source_type,source_id,title,destination_path,instructions,is_required,sort_order";

export function mapTemplate(row: TemplateRow): CurriculumPlanTemplate {
  return {
    id: row.id,
    studentAppId: row.student_app_id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    durationDays: Number(row.duration_days),
    version: Number(row.version),
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

export function mapTemplateItem(row: ItemRow): CurriculumPlanTemplateItem {
  return {
    id: row.id,
    templateId: row.template_id,
    dayOffset: Number(row.day_offset),
    startMinute: Number(row.start_minute),
    durationMinutes: Number(row.duration_minutes),
    activityType: row.activity_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    destinationPath: row.destination_path,
    instructions: row.instructions,
    isRequired: Boolean(row.is_required),
    sortOrder: Number(row.sort_order),
  };
}

export async function loadCurriculumPlanWorkspace({
  supabase,
  studentAppId,
  tenantId,
  viewerId,
  viewerRole,
}: {
  supabase: SupabaseClient;
  studentAppId: string;
  tenantId: string | null;
  viewerId: string;
  viewerRole: string;
}) {
  let templateQuery = supabase
    .from("curriculum_plan_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("student_app_id", studentAppId);
  if (tenantId) templateQuery = templateQuery.eq("status", "published");

  const { data: templateData, error: templateError } = await templateQuery
    .order("updated_at", { ascending: false });
  if (templateError) throw new Error("标准学习流程读取失败", { cause: templateError });
  const templates = ((templateData ?? []) as TemplateRow[]).map(mapTemplate);

  const { data: itemData, error: itemError } = templates.length
    ? await supabase
        .from("curriculum_plan_template_items")
        .select(TEMPLATE_ITEM_COLUMNS)
        .in("template_id", templates.map((template) => template.id))
        .order("day_offset")
        .order("start_minute")
        .order("sort_order")
    : { data: [] as ItemRow[], error: null };
  if (itemError) throw new Error("标准学习流程明细读取失败", { cause: itemError });
  const items = ((itemData ?? []) as ItemRow[]).map(mapTemplateItem);

  if (!tenantId) return { templates, items, plans: [], students: [] };

  const [planResult, enrollmentResult, teachingAssignmentResult] = await Promise.all([
    supabase
      .from("institution_curriculum_plans")
      .select("id,template_id,title,starts_at,ends_at,status,published_at")
      .eq("tenant_id", tenantId)
      .eq("student_app_id", studentAppId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_app_enrollments")
      .select("student_id")
      .eq("tenant_id", tenantId)
      .eq("app_id", studentAppId)
      .eq("status", "active"),
    viewerRole === "teacher"
      ? supabase
          .from("tenant_student_assignments")
          .select("student_id")
          .eq("tenant_id", tenantId)
          .eq("teacher_id", viewerId)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (planResult.error) throw new Error("机构执行计划读取失败", { cause: planResult.error });
  if (enrollmentResult.error) throw new Error("机构学生读取失败", { cause: enrollmentResult.error });
  if (teachingAssignmentResult.error) throw new Error("负责学生范围读取失败", { cause: teachingAssignmentResult.error });

  const planRows = (planResult.data ?? []) as InstitutionPlanRow[];
  const planIds = planRows.map((plan) => plan.id);
  const teacherStudentIds = teachingAssignmentResult.data
    ? new Set(teachingAssignmentResult.data.map((row) => String(row.student_id)))
    : null;
  const studentIds = (enrollmentResult.data ?? [])
    .map((row) => String(row.student_id))
    .filter((studentId) => !teacherStudentIds || teacherStudentIds.has(studentId));
  const [assignmentResult, profileResult] = await Promise.all([
    planIds.length
      ? supabase
          .from("institution_curriculum_plan_students")
          .select("plan_id,student_id")
          .in("plan_id", planIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from("profiles").select("id,full_name,login_id").in("id", studentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (assignmentResult.error) throw new Error("计划学生分配读取失败", { cause: assignmentResult.error });
  if (profileResult.error) throw new Error("学生资料读取失败", { cause: profileResult.error });

  const studentIdsByPlan = new Map<string, string[]>();
  for (const row of assignmentResult.data ?? []) {
    const values = studentIdsByPlan.get(String(row.plan_id)) ?? [];
    values.push(String(row.student_id));
    studentIdsByPlan.set(String(row.plan_id), values);
  }
  const plans: InstitutionCurriculumPlan[] = planRows.map((row) => ({
    id: row.id,
    templateId: row.template_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    publishedAt: row.published_at,
    studentIds: studentIdsByPlan.get(row.id) ?? [],
  }));
  const students: CurriculumPlanStudent[] = (profileResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.full_name ?? row.login_id ?? "学生"),
    loginId: row.login_id ? String(row.login_id) : null,
  }));

  return { templates, items, plans, students };
}

export async function loadPublishedStudentCurriculumTasks({
  supabase,
  tenantId,
  studentId,
  studentAppId,
  dashboardBasePath,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  studentAppId: string;
  dashboardBasePath: string;
  now?: Date;
}): Promise<HomeLearningTask[]> {
  const assignmentResult = await supabase
    .from("institution_curriculum_plan_students")
    .select("plan_id")
    .eq("tenant_id", tenantId)
    .eq("student_id", studentId);
  if (assignmentResult.error) throw new Error("学生正式学习计划分配读取失败", { cause: assignmentResult.error });
  const planIds = (assignmentResult.data ?? []).map((row) => String(row.plan_id));
  if (planIds.length === 0) return [];

  const planResult = await supabase
    .from("institution_curriculum_plans")
    .select("id,template_id,title,starts_at,ends_at,status,published_at")
    .in("id", planIds)
    .eq("tenant_id", tenantId)
    .eq("student_app_id", studentAppId)
    .in("status", ["published", "active"])
    .lte("starts_at", new Date(now.getTime() + 45 * 86_400_000).toISOString())
    .gte("ends_at", new Date(now.getTime() - 7 * 86_400_000).toISOString())
    .order("starts_at", { ascending: true });
  if (planResult.error) throw new Error("学生正式学习计划读取失败", { cause: planResult.error });
  const plans = (planResult.data ?? []) as InstitutionPlanRow[];
  if (plans.length === 0) return [];

  const itemResult = await supabase
    .from("curriculum_plan_template_items")
    .select(TEMPLATE_ITEM_COLUMNS)
    .in("template_id", [...new Set(plans.map((plan) => plan.template_id))])
    .order("day_offset")
    .order("start_minute");
  if (itemResult.error) throw new Error("学生正式学习计划明细读取失败", { cause: itemResult.error });
  const items = ((itemResult.data ?? []) as ItemRow[]).map(mapTemplateItem);

  return plans.flatMap((plan) => {
    const planItems = items.filter((item) => item.templateId === plan.template_id);
    if (planItems.length === 0) return [];
    const anchorMinute = Math.min(...planItems.map(itemOffsetMinutes));
    return planItems.map((item): HomeLearningTask => {
      const schedule = expandPlanItemTime(new Date(plan.starts_at), anchorMinute, item);
      return {
        taskKey: createHomeLearningTaskKey(studentAppId, "student_plan", `${plan.id}:${item.id}`),
        studentAppId,
        appSlug: "korean",
        appLabel: "韩语学习",
        sourceType: "student_plan",
        sourceId: item.id,
        title: item.title,
        description: plan.title,
        status: schedule.endsAt < now
          ? item.isRequired ? "overdue" : "available"
          : schedule.startsAt <= now ? "in_progress" : "available",
        priority: item.isRequired ? "high" : "normal",
        required: item.isRequired,
        startsAt: schedule.startsAt.toISOString(),
        dueAt: schedule.endsAt.toISOString(),
        progressPercent: null,
        reason: item.instructions ?? `按照${plan.title}完成本项学习。`,
        href: item.destinationPath
          ? scopeDashboardPath(item.destinationPath, dashboardBasePath)
          : scopeDashboardPath("/dashboard/courses", dashboardBasePath),
        courseId: null,
        courseChapterId: null,
        skill: item.activityType,
        updatedAt: plan.published_at ?? plan.starts_at,
      };
    });
  });
}
