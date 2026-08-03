import {
  Archive,
  BookOpenCheck,
  History,
  ShieldCheck,
  TriangleAlert,
  UsersRound,
} from "lucide-react";

import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import {
  LEARNING_RECORD_TYPE_LABELS,
  LEARNING_RECORD_VISIBILITY_LABELS,
  learningRecordDateFormatter,
} from "@/app/dashboard/records/config";
import { requireLearningRecordOverviewAccess } from "@/lib/learning-records";
import { LearningRecordEditDialog } from "./LearningRecordEditDialog";
import {
  LearningRecordForm,
  type LearningRecordFormValue,
} from "./LearningRecordForm";
import { LearningRecordStatusButton } from "./LearningRecordStatusButton";
import {
  PlatformLearningRecordOverview,
  type PlatformLearningRecordOverviewRow,
} from "./PlatformLearningRecordOverview";

type Student = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
};

type Note = LearningRecordFormValue & {
  status: "active" | "archived";
  updated_at: string;
};

export default async function LearningRecordManagementPage() {
  const access = await requireLearningRecordOverviewAccess();

  if (access.scope === "platform") {
    const { data, error } = await access.supabase.rpc(
      "get_platform_learning_record_overview",
    );
    return (
      <PlatformLearningRecordOverview
        rows={(data ?? []) as PlatformLearningRecordOverviewRow[]}
        hasError={Boolean(error)}
      />
    );
  }

  const { supabase, role, tenantId } = access;
  const [studentsResult, notesResult] = await Promise.all([
    supabase.rpc("list_learning_record_students"),
    supabase
      .from("learning_record_notes")
      .select(
        "id,student_id,record_type,title,content,next_action,visibility,status,occurred_at,updated_at",
      )
      .eq("tenant_id", tenantId)
      .order("occurred_at", { ascending: false }),
  ]);

  const students = (studentsResult.data ?? []) as Student[];
  const notes = (notesResult.data ?? []) as Note[];
  const studentNameById = new Map(
    students.map((student) => [
      student.id,
      student.full_name?.trim() || student.email || "学生",
    ]),
  );
  const formStudents = students.map((student) => ({
    id: student.id,
    name: student.full_name?.trim() || "未填写姓名",
    email: student.email || "未填写邮箱",
  }));
  const activeNotes = notes.filter((note) => note.status === "active");
  const visibleCount = activeNotes.filter(
    (note) => note.visibility === "student_visible",
  ).length;
  const internalCount = activeNotes.filter(
    (note) => note.visibility === "internal",
  ).length;
  const attentionCount = activeNotes.filter(
    (note) => note.record_type === "attention",
  ).length;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1600px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section
          className="app-card rounded-3xl border p-5 sm:p-6"
          style={{ backgroundColor: "var(--app-card-bg)" }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_620px] xl:items-center">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-accent)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <ShieldCheck size={14} />
                {role === "tenant_super_admin"
                  ? "机构负责人权限"
                  : role === "ceo"
                    ? "运营负责人权限"
                    : "已授权管理员"}
              </span>
              <DashboardTitleWithHint
                className="mt-3"
                title="学习记录管理"
                description="以表格统一维护本机构学生的辅导记录、阶段评价、关注事项和下一步计划。"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["学生", students.length, UsersRound, "var(--app-secondary)"],
                ["有效记录", activeNotes.length, History, "var(--app-accent)"],
                ["学生可见", visibleCount, BookOpenCheck, "var(--app-success)"],
                ["关注事项", attentionCount, TriangleAlert, "var(--app-warm)"],
              ].map(([label, value, Icon, color]) => {
                const MetricIcon = Icon as typeof History;
                return (
                  <div
                    key={String(label)}
                    className="app-soft-card rounded-2xl border p-4 text-center"
                  >
                    <MetricIcon
                      className="mx-auto"
                      size={17}
                      style={{ color: String(color) }}
                    />
                    <p className="mt-2 text-xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-[10px] font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {(studentsResult.error || notesResult.error) && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
            }}
          >
            学习记录后台数据暂时无法读取，请确认数据库迁移已经执行。
          </section>
        )}

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black">新增学习记录</h2>
              <p className="app-muted-text mt-1 text-[10px]">
                按表格填写记录信息；管理员授权统一在组织权限中维护。
              </p>
            </div>
            <span className="app-muted-text text-[10px] font-black">
              内部记录 {internalCount} 条
            </span>
          </div>
          <LearningRecordForm students={formStudents} />
        </section>

        <section className="app-card overflow-hidden rounded-3xl border">
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
            style={{ borderColor: "var(--app-border)" }}
          >
            <div>
              <h2 className="text-base font-black">学习记录档案</h2>
              <p className="app-muted-text mt-1 text-[10px]">
                当前机构共 {notes.length} 条人工记录，可在操作列编辑、归档或恢复。
              </p>
            </div>
            <span className="app-muted-text text-xs font-black">
              有效 {activeNotes.length} · 归档 {notes.length - activeNotes.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px] border-collapse text-left">
              <thead>
                <tr
                  className="app-muted-text border-b bg-[var(--app-soft-bg)] text-[10px]"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <th className="w-[12%] px-5 py-3 font-black">学生</th>
                  <th className="w-[18%] px-3 py-3 font-black">类型与标题</th>
                  <th className="w-[25%] px-3 py-3 font-black">记录内容</th>
                  <th className="w-[18%] px-3 py-3 font-black">下一步建议</th>
                  <th className="w-[10%] px-3 py-3 font-black">可见范围</th>
                  <th className="w-[9%] px-3 py-3 font-black">记录时间</th>
                  <th className="w-[8%] px-5 py-3 font-black">操作</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr
                    key={note.id}
                    className="border-b align-top text-[11px] last:border-b-0"
                    style={{ borderColor: "var(--app-border-soft)" }}
                  >
                    <td className="px-5 py-4 font-black">
                      {studentNameById.get(note.student_id) || "学生"}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className="inline-flex rounded-full px-2 py-1 text-[9px] font-black"
                        style={{
                          color: "var(--app-secondary)",
                          backgroundColor: "var(--app-secondary-soft)",
                        }}
                      >
                        {LEARNING_RECORD_TYPE_LABELS[note.record_type]}
                      </span>
                      <p className="mt-2 font-black leading-5">{note.title}</p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="line-clamp-3 whitespace-pre-wrap text-[10px] leading-5">
                        {note.content}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      {note.next_action ? (
                        <p className="line-clamp-3 text-[10px] leading-5">
                          {note.next_action}
                        </p>
                      ) : (
                        <span className="app-muted-text text-[10px]">未填写</span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className="inline-flex rounded-full px-2 py-1 text-[9px] font-black"
                        style={{
                          color:
                            note.visibility === "student_visible"
                              ? "var(--app-success)"
                              : "var(--app-warm)",
                          backgroundColor:
                            note.visibility === "student_visible"
                              ? "var(--app-success-soft)"
                              : "var(--app-warm-soft)",
                        }}
                      >
                        {LEARNING_RECORD_VISIBILITY_LABELS[note.visibility]}
                      </span>
                      {note.status === "archived" && (
                        <span className="app-muted-text mt-2 flex items-center gap-1 text-[9px] font-black">
                          <Archive size={10} />
                          已归档
                        </span>
                      )}
                    </td>
                    <td className="app-muted-text px-3 py-4 text-[10px] leading-5">
                      {learningRecordDateFormatter.format(
                        new Date(note.occurred_at),
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <LearningRecordEditDialog
                          students={formStudents}
                          note={note}
                        />
                        <LearningRecordStatusButton
                          id={note.id}
                          status={note.status}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {notes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-14 text-center">
                      <History className="mx-auto opacity-30" size={30} />
                      <p className="mt-3 font-black">还没有人工学习记录</p>
                      <p className="app-muted-text mt-2 text-xs">
                        使用上方表格为学生添加第一条辅导或评价记录。
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
