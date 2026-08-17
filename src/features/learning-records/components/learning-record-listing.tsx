import { getLearningRecordManagementData } from "../api/service";
import { PlatformLearningRecordOverview } from "./platform-learning-record-overview";
import { StudentLearningRecordsTable } from "./student-learning-records-table";
import type { StudentLearningRecordTableRow } from "./student-learning-records-table/types";

const ROLE_SCOPE_LABELS: Record<string, string> = {
  teacher: "当前教师负责的学生",
  tenant_super_admin: "当前机构全部学生",
  ceo: "当前机构全部学生",
  admin: "当前机构全部学生",
};

export async function LearningRecordListingContent({
  studentAppId,
}: {
  studentAppId?: string;
}) {
  const result = await getLearningRecordManagementData(studentAppId);

  if (result.scope === "platform") {
    return (
      <PlatformLearningRecordOverview
        rows={result.overview}
        hasError={result.hasError}
      />
    );
  }

  const notesByStudent = new Map<string, typeof result.notes>();
  for (const note of result.notes) {
    const notes = notesByStudent.get(note.student_id) ?? [];
    notes.push(note);
    notesByStudent.set(note.student_id, notes);
  }
  const rows: StudentLearningRecordTableRow[] = result.overview.map((row) => ({
    ...row,
    notes: notesByStudent.get(row.student_id) ?? [],
  }));
  const hasError = result.hasOverviewError || result.hasStudentError || result.hasNoteError;
  const startedCount = rows.filter((row) => row.last_learning_at).length;
  const completedLessonCount = rows.reduce(
    (sum, row) => sum + row.completed_lesson_count,
    0,
  );
  const submissionCount = rows.reduce(
    (sum, row) => sum + row.submission_count,
    0,
  );
  const noteCount = rows.reduce((sum, row) => sum + row.note_count, 0);
  const attentionCount = rows.filter((row) => row.attention_count > 0).length;

  return (
    <div className="space-y-4">
      {hasError && (
        <p className="border border-[var(--status-warning)] bg-[var(--status-warning-surface)] px-4 py-3 text-sm font-medium text-[var(--status-warning)]">
          学生学习档案暂时无法完整读取，请稍后刷新。
        </p>
      )}
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th>统计范围</th>
                <th>学生档案</th>
                <th>已开始学习</th>
                <th>完成课时</th>
                <th>任务提交</th>
                <th>人工辅导备注</th>
                <th>需要关注</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{ROLE_SCOPE_LABELS[result.role] ?? "当前机构学生"}</th>
                <td>{rows.length}</td>
                <td>{startedCount}</td>
                <td>{completedLessonCount}</td>
                <td>{submissionCount}</td>
                <td>{noteCount}</td>
                <td>{attentionCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <StudentLearningRecordsTable
        data={rows}
        scopeLabel={ROLE_SCOPE_LABELS[result.role] ?? "当前机构学生"}
        dashboardBasePath={result.dashboardBasePath}
        studentAppId={studentAppId}
        canManageNotes={result.canManageNotes}
      />
    </div>
  );
}

export default function LearningRecordListing() {
  return <LearningRecordListingContent />;
}
