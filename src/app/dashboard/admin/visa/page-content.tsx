import { requireVisaOverviewAccess } from "@/lib/visa-management";
import {
  PlatformVisaOverview,
  type PlatformVisaCaseAuditRow,
  type PlatformVisaOverviewRow,
} from "./PlatformVisaOverview";
import {
  VisaManagementWorkspace,
  type VisaManagementCase,
} from "./VisaManagementWorkspace";

type VisaCaseRow = {
  id: string;
  user_id: string;
  source_target_id: string | null;
  visa_type: string;
  application_channel: string;
  case_status: string;
  target_entry_date: string | null;
  planned_entry_date: string | null;
  application_city: string | null;
  updated_at: string;
};

type VisaTaskRow = {
  id: string;
  user_id: string;
  title: string;
  stage: string;
  status: string;
  student_note: string | null;
  admin_note: string | null;
  submitted_at: string | null;
  updated_at: string;
};

type VisaTargetRow = {
  id: string;
  user_id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const VALID_FILTERS = new Set(["all", "action", "preparing", "submitted", "issued"]);

function actionPriority(item: VisaManagementCase) {
  if (item.tasks.some((task) => ["submitted", "reviewing"].includes(task.status))) return 0;
  if (item.tasks.some((task) => ["revision_required", "blocked"].includes(task.status))) return 1;
  if (item.caseStatus === "issued") return 3;
  return 2;
}

export default async function AdminVisaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const { supabase, scope, tenantId } = await requireVisaOverviewAccess();

  if (scope === "platform") {
    const [overviewResult, caseAuditResult] = await Promise.all([
      supabase.rpc("get_platform_visa_management_overview"),
      supabase.rpc("get_platform_visa_case_audit"),
    ]);
    return (
      <PlatformVisaOverview
        rows={(overviewResult.data ?? []) as PlatformVisaOverviewRow[]}
        caseRows={(caseAuditResult.data ?? []) as PlatformVisaCaseAuditRow[]}
        hasError={Boolean(overviewResult.error || caseAuditResult.error)}
      />
    );
  }

  if (!tenantId) return null;

  const [casesResult, tasksResult, targetsResult] = await Promise.all([
    supabase
      .from("student_visa_cases")
      .select("id,user_id,source_target_id,visa_type,application_channel,case_status,target_entry_date,planned_entry_date,application_city,updated_at")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("student_visa_tasks")
      .select("id,user_id,title,stage,status,student_note,admin_note,submitted_at,updated_at")
      .eq("tenant_id", tenantId)
      .eq("is_archived", false)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select("id,user_id,university_name,program_name,admission_track")
      .eq("tenant_id", tenantId)
      .gte("application_stage", 9),
  ]);

  if (casesResult.error || tasksResult.error || targetsResult.error) {
    throw new Error("签证管理数据暂时无法读取，请确认数据库迁移已经完成。");
  }

  const visaCases = (casesResult.data ?? []) as VisaCaseRow[];
  const tasks = (tasksResult.data ?? []) as VisaTaskRow[];
  const targets = (targetsResult.data ?? []) as VisaTargetRow[];
  const userIds = [...new Set(visaCases.map((item) => item.user_id))];
  const profilesResult = userIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error("签证管理相关账号暂时无法读取，请稍后重试。");
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const firstTargetByUserId = new Map<string, VisaTargetRow>();
  for (const target of targets) {
    if (!firstTargetByUserId.has(target.user_id)) firstTargetByUserId.set(target.user_id, target);
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
      (a, b) =>
        actionPriority(a) - actionPriority(b) ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  const requestedStatus = params.status ?? "all";
  return (
    <>
      {params.deleted === "1" && (
        <div className="mx-auto mt-5 w-full max-w-[1720px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] text-emerald-700">
          签证档案、准备任务和审核记录已经删除；学生账号及其他业务数据保持不变。
        </div>
      )}
      <VisaManagementWorkspace
        cases={cases}
        initialQuery={(params.q ?? "").trim().slice(0, 80)}
        initialStatus={VALID_FILTERS.has(requestedStatus) ? requestedStatus : "all"}
      />
    </>
  );
}
