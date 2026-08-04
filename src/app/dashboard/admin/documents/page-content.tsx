import { requireDocumentReviewOverviewAccess } from "@/lib/document-reviews";
import {
  DocumentReviewWorkspace,
  type DocumentReviewApplication,
  type DocumentReviewStatus,
} from "./DocumentReviewWorkspace";
import {
  PlatformDocumentReviewOverview,
  type PlatformDocumentReviewOverviewRow,
} from "./PlatformDocumentReviewOverview";

type TargetRow = {
  id: string;
  user_id: string;
  university_name: string;
  program_name: string | null;
  admission_track: string | null;
  application_stage: number;
  document_review_status: DocumentReviewStatus;
  document_review_submitted_at: string | null;
  document_reviewed_at: string | null;
  document_review_note: string | null;
  documents_locked_at: string | null;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  target_id: string | null;
  title: string;
  category: string;
  status: "preparing" | "completed" | "not_needed";
  admin_note: string | null;
  due_date: string | null;
  admin_locked_at: string | null;
  sort_order: number;
};

type ReviewEventRow = {
  id: string;
  target_id: string;
  actor_id: string | null;
  previous_status: DocumentReviewStatus;
  new_status: DocumentReviewStatus;
  note: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const ADMISSION_TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

const REVIEW_STATUS_ORDER: Record<DocumentReviewStatus, number> = {
  pending_review: 0,
  revision_required: 1,
  preparing: 2,
  approved: 3,
};

const VALID_REVIEW_STATUSES = new Set<DocumentReviewStatus>([
  "preparing",
  "pending_review",
  "revision_required",
  "approved",
]);

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const access = await requireDocumentReviewOverviewAccess();

  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc(
      "get_platform_document_review_overview"
    );
    return (
      <PlatformDocumentReviewOverview
        rows={(data ?? []) as PlatformDocumentReviewOverviewRow[]}
        hasError={Boolean(error)}
      />
    );
  }

  const { supabase, tenantId } = access;
  if (!tenantId) return null;

  const [targetsResult, documentsResult, eventsResult] = await Promise.all([
    supabase
      .from("student_university_targets")
      .select(
        "id,user_id,university_name,program_name,admission_track,application_stage,document_review_status,document_review_submitted_at,document_reviewed_at,document_review_note,documents_locked_at,updated_at"
      )
      .eq("tenant_id", tenantId)
      .neq("status", "researching")
      .order("updated_at", { ascending: false }),
    supabase
      .from("student_application_documents")
      .select(
        "id,target_id,title,category,status,admin_note,due_date,admin_locked_at,sort_order"
      )
      .eq("tenant_id", tenantId)
      .not("target_id", "is", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("document_review_events")
      .select(
        "id,target_id,actor_id,previous_status,new_status,note,created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  if (targetsResult.error || documentsResult.error || eventsResult.error) {
    throw new Error("资料审核数据暂时无法读取，请确认数据库迁移已经完成。");
  }

  const targets = (targetsResult.data ?? []) as TargetRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const events = (eventsResult.data ?? []) as ReviewEventRow[];
  const profileIds = [
    ...new Set([
      ...targets.map((target) => target.user_id),
      ...events.flatMap((event) => (event.actor_id ? [event.actor_id] : [])),
    ]),
  ];
  const profilesResult = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", profileIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throw new Error("无法读取资料审核相关账号，请稍后重试。");
  }

  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ])
  );
  const documentsByTarget = new Map<string, DocumentRow[]>();
  for (const document of documents) {
    if (!document.target_id) continue;
    const group = documentsByTarget.get(document.target_id) ?? [];
    group.push(document);
    documentsByTarget.set(document.target_id, group);
  }
  const eventsByTarget = new Map<string, ReviewEventRow[]>();
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
          ADMISSION_TRACK_LABELS[target.admission_track ?? ""] ?? "申请项目待确认",
        applicationStage: target.application_stage,
        reviewStatus: target.document_review_status,
        reviewSubmittedAt: target.document_review_submitted_at,
        reviewedAt: target.document_reviewed_at,
        reviewNote: target.document_review_note ?? "",
        documentsLockedAt: target.documents_locked_at,
        updatedAt: target.updated_at,
        documents: (documentsByTarget.get(target.id) ?? []).map((document) => ({
          id: document.id,
          title: document.title,
          category: document.category,
          status: document.status,
          adminNote: document.admin_note,
          dueDate: document.due_date,
          lockedAt: document.admin_locked_at,
        })),
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
        REVIEW_STATUS_ORDER[a.reviewStatus] - REVIEW_STATUS_ORDER[b.reviewStatus] ||
        new Date(a.reviewSubmittedAt ?? a.updatedAt).getTime() -
          new Date(b.reviewSubmittedAt ?? b.updatedAt).getTime()
    );

  const requestedStatus = params.status as DocumentReviewStatus | undefined;
  const initialStatus =
    requestedStatus && VALID_REVIEW_STATUSES.has(requestedStatus)
      ? requestedStatus
      : "all";

  return (
    <DocumentReviewWorkspace
      applications={applications}
      initialQuery={(params.q ?? "").trim().slice(0, 80)}
      initialStatus={initialStatus}
    />
  );
}
