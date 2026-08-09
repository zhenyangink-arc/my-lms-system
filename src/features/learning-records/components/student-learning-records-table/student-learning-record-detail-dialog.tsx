"use client";

import { LocalDateTime } from "@/components/LocalDateTime";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import type {
  LearningRecordStatus,
  LearningRecordType,
  LearningRecordVisibility,
} from "../../api/types";
import type { StudentLearningRecordTableRow } from "./types";

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const TYPE_LABELS: Record<LearningRecordType, string> = {
  coaching: "辅导记录",
  evaluation: "阶段评价",
  milestone: "成长里程碑",
  attention: "关注事项",
  plan: "学习计划",
};

const STATUS_LABELS: Record<LearningRecordStatus, string> = {
  active: "有效",
  archived: "已归档",
};

const VISIBILITY_LABELS: Record<LearningRecordVisibility, string> = {
  student_visible: "学生可见",
  internal: "仅后台可见",
};

function CountCell({ value }: { value: number }) {
  return (
    <td className="border-r border-[var(--app-border-soft)] px-4 py-3 font-mono text-base font-semibold tabular-nums last:border-r-0">
      {value.toLocaleString("zh-CN")}
    </td>
  );
}

export function StudentLearningRecordDetailDialog({
  student,
}: {
  student: StudentLearningRecordTableRow;
}) {
  const name = student.full_name?.trim() || "未填写姓名";
  const account = student.email || `账号 …${student.student_id.slice(-8)}`;
  const membership = MEMBERSHIP_TIER_LABELS[
    normalizeMembershipTier(student.membership_tier)
  ];

  return (
    <Dialog>
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center border border-[var(--app-border)] px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--app-soft-bg)]"
      >
        查看详情
      </DialogTrigger>
      <DialogContent className="max-h-[min(900px,calc(100vh-32px))] max-w-[980px] gap-0 overflow-y-auto p-0">
        <DialogHeader className="border-b border-[var(--app-border)] px-5 py-4 text-left">
          <DialogTitle className="text-base">{name}的学习档案</DialogTitle>
          <DialogDescription className="text-xs">
            {account} · {membership}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto border-b border-[var(--app-border)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
              <tr>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">统计项目</th>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">完成课时</th>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">学习中课时</th>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">任务提交</th>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">会话练习</th>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">成绩记录</th>
                <th className="px-4 py-3 font-medium">人工辅导备注</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="border-r border-[var(--app-border-soft)] px-4 py-3 font-medium">当前数量</th>
                <CountCell value={student.completed_lesson_count} />
                <CountCell value={student.active_lesson_count} />
                <CountCell value={student.submission_count} />
                <CountCell value={student.conversation_practice_count} />
                <CountCell value={student.grade_count} />
                <CountCell value={student.note_count} />
              </tr>
            </tbody>
          </table>
        </div>

        <section>
          <div className="border-b border-[var(--app-border)] px-5 py-3">
            <h3 className="text-xs font-semibold">人工辅导备注</h3>
            <p className="mt-1 text-[10px] text-[var(--app-muted)]">
              这里仅展示人工填写的辅导、评价、里程碑、关注事项和学习计划；上方学习数据由系统自动汇总。
            </p>
          </div>
          <div className="divide-y divide-[var(--app-border)]">
            {student.notes.map((note) => (
              <article key={note.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-[var(--app-soft-bg)] px-2 py-1 text-[10px] font-semibold">
                    {TYPE_LABELS[note.record_type]}
                  </span>
                  <span className={note.status === "active" ? "text-[10px] font-medium text-emerald-700" : "text-[10px] font-medium text-amber-700"}>
                    {STATUS_LABELS[note.status]}
                  </span>
                  <span className="text-[10px] text-[var(--app-muted)]">
                    {VISIBILITY_LABELS[note.visibility]}
                  </span>
                  <time className="ml-auto text-[10px] text-[var(--app-muted)]">
                    <LocalDateTime value={note.occurred_at} options={DATE_TIME_OPTIONS} />
                  </time>
                </div>
                <h4 className="mt-2 text-xs font-semibold text-[var(--app-text)]">{note.title}</h4>
                <p className="mt-1 whitespace-pre-wrap text-[11px] leading-5 text-[var(--app-text-soft)]">{note.content}</p>
                {note.next_action && (
                  <p className="mt-2 border-l-2 border-[var(--app-accent)] pl-3 text-[11px] leading-5">
                    <span className="text-[var(--app-muted)]">下一步建议：</span>
                    {note.next_action}
                  </p>
                )}
              </article>
            ))}
            {student.notes.length === 0 && (
              <div className="px-5 py-10 text-center">
                <p className="text-xs font-semibold">暂无人工辅导备注</p>
                <p className="mt-1 text-[10px] text-[var(--app-muted)]">系统自动学习档案仍会根据真实学习行为持续更新。</p>
              </div>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
