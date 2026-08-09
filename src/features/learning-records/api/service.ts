import "server-only";

import { requireLearningRecordOverviewAccess } from "@/lib/learning-records";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import type {
  LearningRecordManagementData,
  LearningRecordNote,
  LearningRecordOverviewRow,
  LearningRecordOverviewRpcRow,
  LearningRecordStudent,
  PlatformLearningRecordOverviewRow,
} from "./types";

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOverviewRow(
  row: LearningRecordOverviewRpcRow,
): LearningRecordOverviewRow {
  return {
    student_id: String(row.student_id),
    full_name: typeof row.full_name === "string" ? row.full_name : null,
    email: typeof row.email === "string" ? row.email : null,
    membership_tier:
      typeof row.membership_tier === "string" ? row.membership_tier : null,
    completed_lesson_count: count(row.completed_lesson_count),
    active_lesson_count: count(row.active_lesson_count),
    submission_count: count(row.submission_count),
    graded_submission_count: count(row.graded_submission_count),
    conversation_practice_count: count(row.conversation_practice_count),
    grade_count: count(row.grade_count),
    note_count: count(row.note_count),
    attention_count: count(row.attention_count),
    last_learning_at:
      typeof row.last_learning_at === "string" ? row.last_learning_at : null,
  };
}

function buildFallbackRows(
  students: LearningRecordStudent[],
  notes: LearningRecordNote[],
): LearningRecordOverviewRow[] {
  const noteStats = new Map<string, { active: number; attention: number }>();

  for (const note of notes) {
    if (note.status !== "active") continue;
    const current = noteStats.get(note.student_id) ?? {
      active: 0,
      attention: 0,
    };
    current.active += 1;
    if (note.record_type === "attention") current.attention += 1;
    noteStats.set(note.student_id, current);
  }

  return students.map((student) => {
    const note = noteStats.get(student.id);
    return {
      student_id: student.id,
      full_name: student.full_name,
      email: student.email,
      membership_tier: student.membership_tier,
      completed_lesson_count: 0,
      active_lesson_count: 0,
      submission_count: 0,
      graded_submission_count: 0,
      conversation_practice_count: 0,
      grade_count: 0,
      note_count: note?.active ?? 0,
      attention_count: note?.attention ?? 0,
      last_learning_at: null,
    };
  });
}

export async function getLearningRecordManagementData(): Promise<LearningRecordManagementData> {
  const access = await requireLearningRecordOverviewAccess();

  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc(
      "get_platform_learning_record_overview",
    );

    return {
      scope: "platform",
      role: access.role,
      canManageNotes: false,
      overview: (data ?? []) as PlatformLearningRecordOverviewRow[],
      hasError: Boolean(error),
    };
  }

  const tenantId = access.tenantId!;
  const assignedStudentIds =
    access.role === "teacher"
      ? await getTeacherAssignedStudentIds(
          access.supabase,
          tenantId,
          access.user.id,
        )
      : null;
  const assignedStudentIdSet = assignedStudentIds
    ? new Set(assignedStudentIds)
    : null;

  let notesQuery = access.supabase
    .from("learning_record_notes")
    .select(
      "id,student_id,record_type,title,content,next_action,visibility,status,occurred_at,updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("occurred_at", { ascending: false });
  if (assignedStudentIds) {
    notesQuery = notesQuery.in("student_id", assignedStudentIds);
  }

  const [overviewResult, studentsResult, notesResult] = await Promise.all([
    access.supabase.rpc("get_tenant_student_learning_record_overview"),
    access.supabase.rpc("list_learning_record_students"),
    notesQuery,
  ]);

  const students = (
    (studentsResult.data ?? []) as LearningRecordStudent[]
  ).filter(
    (student) =>
      !assignedStudentIdSet || assignedStudentIdSet.has(student.id),
  );
  const notes = (notesResult.data ?? []) as LearningRecordNote[];
  const allOverviewRows = overviewResult.error
    ? buildFallbackRows(students, notes)
    : ((overviewResult.data ?? []) as LearningRecordOverviewRpcRow[]).map(
        normalizeOverviewRow,
      );
  const overview = assignedStudentIdSet
    ? allOverviewRows.filter((row) =>
        assignedStudentIdSet.has(row.student_id),
      )
    : allOverviewRows;

  return {
    scope: "institution",
    role: access.role,
    tenantId,
    dashboardBasePath: access.dashboardBasePath,
    canManageNotes: true,
    assignedStudentIds,
    students,
    notes,
    overview,
    hasOverviewError: Boolean(overviewResult.error),
    hasStudentError: Boolean(studentsResult.error),
    hasNoteError: Boolean(notesResult.error),
  };
}
