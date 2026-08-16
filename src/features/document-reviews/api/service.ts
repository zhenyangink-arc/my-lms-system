import "server-only";

import {
  requireDocumentReviewManager,
  requireDocumentReviewOverviewAccess,
} from "@/lib/document-reviews";
import type {
  DocumentChecklistRow,
  DocumentReviewApplication,
  DocumentReviewEventRow,
  DocumentReviewManagementData,
  DocumentReviewProfileRow,
  DocumentReviewStudentChecklistItem,
  DocumentReviewStudentDetailData,
  DocumentReviewStudentTarget,
  DocumentReviewTargetRow,
  PlatformDocumentReviewOverviewRow,
  PlatformDocumentReviewOverviewRpcRow,
} from "./types";

const ADMISSION_TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

const REVIEW_STATUS_ORDER: Record<
  DocumentReviewTargetRow["document_review_status"],
  number
> = {
  pending_review: 0,
  revision_required: 1,
  preparing: 2,
  approved: 3,
};

function count(value: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlatformOverviewRow(
  row: PlatformDocumentReviewOverviewRpcRow,
): PlatformDocumentReviewOverviewRow {
  return {
    tenantId: row.tenant_id,
    tenantSlug: row.tenant_slug,
    tenantName: row.tenant_name,
    tenantStatus: row.tenant_status,
    activeStudentCount: count(row.active_student_count),
    applicationCount: count(row.application_count),
    preparingCount: count(row.preparing_count),
    pendingReviewCount: count(row.pending_review_count),
    revisionRequiredCount: count(row.revision_required_count),
    approvedCount: count(row.approved_count),
    oldestPendingAt: row.oldest_pending_at,
    lastActivityAt: row.last_activity_at,
  };
}

export async function getDocumentReviewManagementData(): Promise<DocumentReviewManagementData> {
  const access = await requireDocumentReviewOverviewAccess();

  if (access.scope === "platform") {
    // 平台负责人只调用匿名机构汇总 RPC；不要在此分支查询任何学生个案表。
    const { data, error } = await access.supabase.rpc(
      "get_platform_document_review_overview",
    );

    return {
      scope: "platform",
      role: access.role,
      canReviewApplications: false,
      applications: [],
      overview: (
        (data ?? []) as PlatformDocumentReviewOverviewRpcRow[]
      ).map(normalizePlatformOverviewRow),
      hasError: Boolean(error),
    };
  }

  const tenantId = access.tenantId!;
  const [targetsResult, documentsResult, eventsResult] = await Promise.all([
    access.supabase
      .from("student_university_targets")
      .select(
        "id,user_id,university_name,program_name,admission_track,application_stage,document_review_status,document_review_submitted_at,document_reviewed_at,document_review_note,documents_locked_at,updated_at",
      )
      .eq("tenant_id", tenantId)
      .neq("status", "researching")
      .order("updated_at", { ascending: false }),
    access.supabase
      .from("student_application_documents")
      .select(
        "id,target_id,title,category,status,admin_note,due_date,admin_locked_at,sort_order",
      )
      .eq("tenant_id", tenantId)
      .not("target_id", "is", null)
      .order("sort_order", { ascending: true }),
    access.supabase
      .from("document_review_events")
      .select(
        "id,target_id,actor_id,previous_status,new_status,note,created_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  if (targetsResult.error || documentsResult.error || eventsResult.error) {
    throw new Error("资料审核数据暂时无法读取，请确认数据库迁移已经完成。");
  }

  const targets = (targetsResult.data ?? []) as DocumentReviewTargetRow[];
  const documents = (documentsResult.data ?? []) as DocumentChecklistRow[];
  const events = (eventsResult.data ?? []) as DocumentReviewEventRow[];
  const profileIds = [
    ...new Set([
      ...targets.map((target) => target.user_id),
      ...events.flatMap((event) =>
        event.actor_id ? [event.actor_id] : [],
      ),
    ]),
  ];
  const profilesResult = profileIds.length
    ? await access.supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", profileIds)
    : { data: [] as DocumentReviewProfileRow[], error: null };

  if (profilesResult.error) {
    throw new Error("无法读取资料审核相关账号，请稍后重试。");
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as DocumentReviewProfileRow[]).map(
      (profile) => [profile.id, profile],
    ),
  );
  const documentsByTarget = new Map<string, DocumentChecklistRow[]>();
  for (const document of documents) {
    if (!document.target_id) continue;
    const group = documentsByTarget.get(document.target_id) ?? [];
    group.push(document);
    documentsByTarget.set(document.target_id, group);
  }
  const eventsByTarget = new Map<string, DocumentReviewEventRow[]>();
  for (const event of events) {
    const group = eventsByTarget.get(event.target_id) ?? [];
    group.push(event);
    eventsByTarget.set(event.target_id, group);
  }

  const applications: DocumentReviewApplication[] = targets
    .map((target) => {
      const profile = profiles.get(target.user_id);
      return {
        id: target.id,
        studentId: target.user_id,
        studentName: profile?.full_name || profile?.email || "未填写姓名",
        studentEmail: profile?.email ?? "",
        universityName: target.university_name,
        programName: target.program_name,
        admissionTrackLabel:
          ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ??
          "申请项目待确认",
        applicationStage: target.application_stage,
        reviewStatus: target.document_review_status,
        reviewSubmittedAt: target.document_review_submitted_at,
        reviewedAt: target.document_reviewed_at,
        reviewNote: target.document_review_note ?? "",
        documentsLockedAt: target.documents_locked_at,
        updatedAt: target.updated_at,
        documents: (documentsByTarget.get(target.id) ?? []).map(
          (document) => ({
            id: document.id,
            title: document.title,
            category: document.category,
            status: document.status,
            adminNote: document.admin_note,
            dueDate: document.due_date,
            lockedAt: document.admin_locked_at,
          }),
        ),
        events: (eventsByTarget.get(target.id) ?? []).map((event) => ({
          id: event.id,
          previousStatus: event.previous_status,
          newStatus: event.new_status,
          note: event.note,
          actorName:
            (event.actor_id &&
              (profiles.get(event.actor_id)?.full_name ||
                profiles.get(event.actor_id)?.email)) ||
            "系统",
          createdAt: event.created_at,
        })),
      };
    })
    .sort(
      (a, b) =>
        REVIEW_STATUS_ORDER[a.reviewStatus] -
          REVIEW_STATUS_ORDER[b.reviewStatus] ||
        new Date(a.reviewSubmittedAt ?? a.updatedAt).getTime() -
          new Date(b.reviewSubmittedAt ?? b.updatedAt).getTime(),
    );

  return {
    scope: "institution",
    role: access.role,
    tenantId,
    dashboardBasePath: access.dashboardBasePath,
    canReviewApplications: access.canManage,
    applications,
    overview: [],
    hasError: false,
  };
}

export async function getDocumentReviewStudentDetailData(
  studentId: string,
): Promise<DocumentReviewStudentDetailData | null> {
  const { supabase, tenantId, dashboardBasePath } =
    await requireDocumentReviewManager();
  const [profileResult, documentsResult, targetsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,full_name,email")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("student_application_documents")
      .select(
        "id,target_id,title,category,notes,admin_note,status,due_date,updated_at,sort_order,admin_locked_at",
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_university_targets")
      .select(
        "id,university_name,program_name,admission_track,documents_locked_at,courier_mailed_at,courier_estimated_arrival_at,application_stage,visa_application_channel,document_review_status,document_review_note,updated_at",
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", studentId)
      .neq("status", "researching")
      .order("priority", { ascending: false }),
  ]);

  if (documentsResult.error || targetsResult.error) {
    throw new Error("学生申请资料读取失败，请稍后重试。");
  }

  const documents = (documentsResult.data ??
    []) as DocumentReviewStudentChecklistItem[];
  const targets = (targetsResult.data ?? []) as DocumentReviewStudentTarget[];

  if (!profileResult.data && documents.length === 0 && targets.length === 0) {
    return null;
  }

  return {
    tenantId,
    dashboardBasePath,
    student: (profileResult.data ?? {
      id: studentId,
      full_name: null,
      email: null,
    }) as DocumentReviewProfileRow,
    targets,
    documents,
  };
}
