"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LEARNING_RECORD_DATE_TIME_OPTIONS,
  LEARNING_RECORD_TYPE_LABELS,
  LEARNING_RECORD_VISIBILITY_LABELS,
} from "@/app/dashboard/records/config";
import { LocalDateTime } from "@/components/LocalDateTime";
import { LearningRecordEditDialog } from "./LearningRecordEditDialog";
import { LearningRecordForm, type LearningRecordFormValue } from "./LearningRecordForm";
import { LearningRecordStatusButton } from "./LearningRecordStatusButton";

type Student = {
  id: string;
  name: string;
  email: string;
  membershipLabel: string;
};

type Note = LearningRecordFormValue & {
  status: "active" | "archived";
  updated_at: string;
};

type Summary = {
  completedLessons: number;
  submissions: number;
  conversationPractices: number;
  grades: number;
  attentionCount: number;
};

export function StudentLearningRecordDialog({
  student,
  summary,
  notes,
}: {
  student: Student;
  summary: Summary;
  notes: Note[];
}) {
  const [showComposer, setShowComposer] = useState(false);
  const formStudents = [{ id: student.id, name: student.name, email: student.email }];

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]"
      >
        查看
      </DialogTrigger>
      <DialogContent className="max-h-[min(900px,calc(100vh-32px))] max-w-[980px] gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-4 text-left" style={{ borderColor: "var(--app-border)" }}>
          <DialogTitle className="text-base">{student.name}的学习档案</DialogTitle>
          <DialogDescription className="text-xs">{student.email} · {student.membershipLabel}</DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto border-b" style={{ borderColor: "var(--app-border)" }}>
          <table className="w-full min-w-[620px] border-collapse text-left text-xs [&_td]:border-b [&_td]:border-r [&_td]:border-[var(--app-border-soft)] [&_td]:px-4 [&_td]:py-3 [&_td]:text-base [&_td]:font-semibold [&_th]:border-b [&_th]:border-r [&_th]:border-[var(--app-border-soft)] [&_th]:bg-[var(--app-soft-bg)] [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium [&_th]:text-[var(--app-muted)] [&_tr>*:last-child]:border-r-0">
            <thead><tr><th>统计项目</th><th>完成课时</th><th>任务提交</th><th>会话练习</th><th>成绩记录</th><th>关注事项</th></tr></thead>
            <tbody><tr><th>当前数量</th><td>{summary.completedLessons}</td><td>{summary.submissions}</td><td>{summary.conversationPractices}</td><td>{summary.grades}</td><td>{summary.attentionCount}</td></tr></tbody>
          </table>
        </div>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
            <div>
              <h3 className="text-xs font-semibold">人工辅导备注</h3>
              <p className="app-muted-text mt-1 text-[10px]">可选内容，不是创建学习档案；系统学习数据会自动进入上方汇总。</p>
            </div>
            <button type="button" onClick={() => setShowComposer((current) => !current)} className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]" style={{ borderColor: "var(--app-border)" }}>
              <Plus size={13} />{showComposer ? "收起" : "添加辅导备注"}
            </button>
          </div>

          {showComposer && (
            <div className="border-b p-4 sm:p-5" style={{ borderColor: "var(--app-border)", backgroundColor: "var(--app-soft-bg)" }}>
              <LearningRecordForm students={formStudents} studentId={student.id} />
            </div>
          )}

          <div className="divide-y" style={{ borderColor: "var(--app-border)" }}>
            {notes.map((note) => (
              <article key={note.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-black/[0.04] px-2 py-1 text-[10px] font-medium">{LEARNING_RECORD_TYPE_LABELS[note.record_type]}</span>
                    <span className="app-muted-text text-[10px]">{LEARNING_RECORD_VISIBILITY_LABELS[note.visibility]}</span>
                    {note.status === "archived" && <span className="text-[10px] font-medium text-amber-700">已归档</span>}
                    <time className="app-muted-text text-[10px]"><LocalDateTime value={note.occurred_at} options={LEARNING_RECORD_DATE_TIME_OPTIONS} /></time>
                  </div>
                  <h4 className="mt-2 text-xs font-semibold">{note.title}</h4>
                  <p className="app-muted-text mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] leading-5">{note.content}</p>
                  {note.next_action && <p className="mt-2 text-[11px] leading-5"><span className="app-muted-text">下一步：</span>{note.next_action}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <LearningRecordEditDialog students={formStudents} note={note} />
                  <LearningRecordStatusButton id={note.id} status={note.status} />
                </div>
              </article>
            ))}
            {notes.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-xs font-semibold">暂无人工辅导备注</p>
                <p className="app-muted-text mt-1 text-[10px]">学生的自动学习档案仍然有效，并会在产生学习行为后更新。</p>
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-end border-t px-5 py-3" style={{ borderColor: "var(--app-border)" }}>
          <Link href={`/dashboard/admin/accounts/${student.id}`} className="inline-flex h-8 items-center rounded-md border px-3 text-xs font-semibold transition hover:bg-black/[0.035]" style={{ borderColor: "var(--app-border)" }}>查看账号档案</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
