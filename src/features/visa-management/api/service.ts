import "server-only";

import {
  requireVisaManager,
  requireVisaOverviewAccess,
} from "@/lib/visa-management";
import type {
  PlatformVisaCaseAuditRow,
  PlatformVisaCaseAuditRpcRow,
  PlatformVisaOverviewRow,
  PlatformVisaOverviewRpcRow,
  VisaCaseDetailRow,
  VisaCaseRow,
  VisaManagementCase,
  VisaManagementData,
  VisaManagementStudentDetailData,
  VisaProfileRow,
  VisaTargetRow,
  VisaTaskDetailRow,
  VisaTaskRow,
} from "./types";

function numberValue(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlatformOverview(
  row: PlatformVisaOverviewRpcRow,
): PlatformVisaOverviewRow {
  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    tenantStatus: row.tenant_status,
    activeStudentCount: numberValue(row.active_student_count),
    caseCount: numberValue(row.case_count),
    adminPreparingCount: numberValue(row.admin_preparing_count),
    preparingCount: numberValue(row.preparing_count),
    submittedCount: numberValue(row.submitted_count),
    additionalDocumentsCount: numberValue(row.additional_documents_count),
    approvedCount: numberValue(row.approved_count),
    issuedCount: numberValue(row.issued_count),
    pendingTaskCount: numberValue(row.pending_task_count),
    supportTaskCount: numberValue(row.support_task_count),
    upcomingEntryCount: numberValue(row.upcoming_entry_count),
    oldestPendingAt: row.oldest_pending_at,
    lastActivityAt: row.last_activity_at,
  };
}

function normalizePlatformCaseAudit(
  row: PlatformVisaCaseAuditRpcRow,
): PlatformVisaCaseAuditRow {
  return {
    tenantId: row.tenant_id,
    caseReference: row.case_reference,
    visaType: row.visa_type,
    applicationChannel: row.application_channel,
    caseStatus: row.case_status,
    taskCount: numberValue(row.task_count),
    approvedTaskCount: numberValue(row.approved_task_count),
    pendingTaskCount: numberValue(row.pending_task_count),
    supportTaskCount: numberValue(row.support_task_count),
    targetEntryDate: row.target_entry_date,
    plannedEntryDate: row.planned_entry_date,
    oldestPendingAt: row.oldest_pending_at,
    updatedAt: row.updated_at,
  };
}

function actionPriority(item: VisaManagementCase) {
  if (
    item.tasks.some((task) =>
      ["submitted", "reviewing"].includes(task.status),
    )
  ) {
    return 0;
  }
  if (
    item.tasks.some((task) =>
      ["revision_required", "blocked"].includes(task.status),
    )
  ) {
    return 1;
  }
  if (item.caseStatus === "issued") return 3;
  return 2;
}

export async function getVisaManagementData(): Promise<VisaManagementData> {
  const access = await requireVisaOverviewAccess();

  if (access.scope === "platform") {
    // 平台分支只调用匿名汇总 RPC，不查询学生档案、身份或任务正文。
    const [overviewResult, caseAuditResult] = await Promise.all([
      access.supabase.rpc("get_platform_visa_management_overview"),
      access.supabase.rpc("get_platform_visa_case_audit"),
    ]);

    return {
      scope: "platform",
      role: access.role,
      canManageIndividualCases: false,
      cases: [],
      overview: ((overviewResult.data ?? []) as PlatformVisaOverviewRpcRow[]).map(
        normalizePlatformOverview,
      ),
      caseAudit: (
        (caseAuditResult.data ?? []) as PlatformVisaCaseAuditRpcRow[]
      ).map(normalizePlatformCaseAudit),
      hasError: Boolean(overviewResult.error || caseAuditResult.error),
    };
  }

  const tenantId = access.tenantId!;
  const [casesResult, tasksResult, targetsResult] = await Promise.all([
    access.supabase
      .from("student_visa_cases")
      .select(
        "id,user_id,source_target_id,visa_type,application_channel,case_status,target_entry_date,planned_entry_date,application_city,advisor_note,updated_at",
      )
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
    access.supabase
      .from("student_visa_tasks")
      .select(
        "id,user_id,title,stage,status,student_note,admin_note,submitted_at,updated_at",
      )
      .eq("tenant_id", tenantId)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true }),
    access.supabase
      .from("student_university_targets")
      .select(
        "id,user_id,university_name,program_name,admission_track",
      )
      .eq("tenant_id", tenantId)
      .gte("application_stage", 9),
  ]);

  if (casesResult.error || tasksResult.error || targetsResult.error) {
    throw new Error(
      "签证管理数据暂时无法读取，请确认数据库迁移已经完成。",
    );
  }

  const visaCases = (casesResult.data ?? []) as VisaCaseRow[];
  const tasks = (tasksResult.data ?? []) as VisaTaskRow[];
  const targets = (targetsResult.data ?? []) as VisaTargetRow[];
  const userIds = [...new Set(visaCases.map((item) => item.user_id))];
  const profilesResult = userIds.length
    ? await access.supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", userIds)
    : { data: [] as VisaProfileRow[], error: null };

  if (profilesResult.error) {
    throw new Error("签证管理相关账号暂时无法读取，请稍后重试。");
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as VisaProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const firstTargetByUserId = new Map<string, VisaTargetRow>();
  for (const target of targets) {
    if (!firstTargetByUserId.has(target.user_id)) {
      firstTargetByUserId.set(target.user_id, target);
    }
  }

  const tasksByUserId = new Map<string, VisaTaskRow[]>();
  for (const task of tasks) {
    const group = tasksByUserId.get(task.user_id) ?? [];
    group.push(task);
    tasksByUserId.set(task.user_id, group);
  }

  const cases: VisaManagementCase[] = visaCases
    .map((visaCase) => {
      const target =
        targetById.get(visaCase.source_target_id ?? "") ??
        firstTargetByUserId.get(visaCase.user_id);
      if (!target) return null;
      const profile = profiles.get(visaCase.user_id);
      return {
        id: visaCase.id,
        studentId: visaCase.user_id,
        studentName: profile?.full_name || profile?.email || "未填写姓名",
        studentEmail: profile?.email ?? "",
        universityName: target.university_name,
        programName: target.program_name ?? "",
        admissionTrack: target.admission_track ?? "",
        visaType: visaCase.visa_type,
        applicationChannel: visaCase.application_channel,
        caseStatus: visaCase.case_status,
        targetEntryDate: visaCase.target_entry_date,
        plannedEntryDate: visaCase.planned_entry_date,
        applicationCity: visaCase.application_city,
        advisorNote: visaCase.advisor_note,
        updatedAt: visaCase.updated_at,
        tasks: (tasksByUserId.get(visaCase.user_id) ?? []).map((task) => ({
          id: task.id,
          title: task.title,
          stage: task.stage,
          status: task.status,
          studentNote: task.student_note ?? "",
          adminNote: task.admin_note ?? "",
          submittedAt: task.submitted_at,
          updatedAt: task.updated_at,
        })),
      } satisfies VisaManagementCase;
    })
    .filter((item): item is VisaManagementCase => item !== null)
    .sort(
      (left, right) =>
        actionPriority(left) - actionPriority(right) ||
        new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
    );

  return {
    scope: "institution",
    role: access.role,
    tenantId,
    dashboardBasePath: access.dashboardBasePath,
    canManageIndividualCases: access.canManage,
    cases,
    overview: [],
    caseAudit: [],
    hasError: false,
  };
}

export async function getVisaManagementStudentDetailData(
  studentId: string,
): Promise<VisaManagementStudentDetailData | null> {
  const access = await requireVisaManager();
  const { supabase, tenantId } = access;
  const [profileResult, caseResult, tasksResult, targetsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,full_name,email")
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("student_visa_cases")
        .select(
          "id,user_id,source_target_id,visa_type,application_channel,case_status,target_entry_date,planned_entry_date,application_city,residence_province,residence_city,accommodation_status,airport_pickup_required,departure_province,departure_airport,arrival_region,arrival_airport,advisor_note,updated_at",
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", studentId)
        .maybeSingle(),
      supabase
        .from("student_visa_tasks")
        .select(
          "id,user_id,title,description,stage,status,student_note,admin_note,submission_version,submitted_at,reviewed_at,updated_at,sort_order",
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", studentId)
        .eq("is_archived", false)
        .order("sort_order", { ascending: true }),
      supabase
        .from("student_university_targets")
        .select(
          "id,user_id,university_name,program_name,admission_track",
        )
        .eq("tenant_id", tenantId)
        .eq("user_id", studentId)
        .gte("application_stage", 9),
    ]);

  if (caseResult.error || targetsResult.error) return null;

  const visaCase = caseResult.data as VisaCaseDetailRow | null;
  const targets = (targetsResult.data ?? []) as VisaTargetRow[];
  const target =
    targets.find((item) => item.id === visaCase?.source_target_id) ??
    targets[0] ??
    null;
  if (!visaCase || !target) return null;

  return {
    tenantId,
    dashboardBasePath: access.dashboardBasePath,
    student: (profileResult.data ?? {
      id: studentId,
      full_name: null,
      email: null,
    }) as VisaProfileRow,
    visaCase,
    target: {
      id: target.id,
      university_name: target.university_name,
      program_name: target.program_name,
      admission_track: target.admission_track,
    },
    tasks: (tasksResult.data ?? []) as VisaTaskDetailRow[],
  };
}
