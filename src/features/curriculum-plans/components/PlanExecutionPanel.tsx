"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { dispatchCurriculumExamAction } from "../actions";
import { EXECUTION_LABELS } from "../execution";
import type { CurriculumPlanStudent, CurriculumPlanTemplateItem, InstitutionCurriculumPlan } from "../types";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";

export function PlanExecutionPanel({ plan, items, students, space, appSlug }: {
  plan: InstitutionCurriculumPlan; items: CurriculumPlanTemplateItem[]; students: CurriculumPlanStudent[]; space: string; appSlug: string;
}) {
  const controlId = useId();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  if (!["published", "active", "completed"].includes(plan.status)) return null;
  const names = new Map(students.map(s => [s.id,s.name]));
  const exams = items.filter(i => i.sourceType === "assessment_paper");
  return <div className="mt-4 space-y-3">
    {exams.length > 0 && <div className="space-y-2">
      {exams.map(item => {
        const assignmentId = plan.execution.find(e => e.itemId === item.id && e.assignmentId)?.assignmentId;
        return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <span>{item.title}</span>
          {assignmentId ? <Link className="inline-flex min-h-11 items-center underline" href={`/${space}/dashboard/admin/assignments/${assignmentId}`}>查看考试与批改</Link>
            : plan.status !== "completed" ? <form action={dispatchCurriculumExamAction.bind(null,space,appSlug,plan.id,item.id)}>
              <ConfirmSubmitButton confirmText={`按本计划时间向当前已分配的 ${plan.studentIds.length} 名学生布置「${item.title}」？布置后新增学生需另发计划。`} className="min-h-11 rounded-lg border px-3 font-semibold">按计划布置考试</ConfirmSubmitButton>
            </form> : <span>尚未布置</span>}
        </div>;
      })}
    </div>}
    <details className="rounded-lg border p-3">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">查看学生执行明细</summary>
      <CardTitleWithHint title="执行情况" description="课程和章节读取实际学习记录；测试以通过为完成；考试以成绩公开为完成，未通过的考试在结课资格中继续提示。专项练习统计该安排开始后的记录。" headingLevel={3} />
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span>完成 {plan.progress?.completedCount ?? 0}/{plan.progress?.totalCount ?? 0} 项</span>
        <span>逾期 {plan.progress?.overdueCount ?? 0} 项</span>
        <span>待批改／公开 {plan.progress?.pendingGradingCount ?? 0} 项</span>
        <span>待完善／布置 {plan.progress?.unavailableCount ?? 0} 项</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-xs" htmlFor={`${controlId}-query`}>学生或安排</label><input id={`${controlId}-query`} className="ml-2 min-h-11 rounded-lg border bg-[var(--card)] px-3" value={query} onChange={event => setQuery(event.target.value)} />
        <label className="text-xs" htmlFor={`${controlId}-status`}>执行状态</label><select id={`${controlId}-status`} className="ml-2 min-h-11 rounded-lg border bg-[var(--card)] px-3" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">全部</option>{["available","in_progress","overdue","pending_grading","unavailable","completed"].map(status => <option key={status} value={status}>{EXECUTION_LABELS[status as keyof typeof EXECUTION_LABELS]}</option>)}</select>
      </div>
      <ul className="mt-3 divide-y">
        {plan.execution.filter(e => (filter === "all" || e.status === filter) && `${names.get(e.studentId) ?? ""} ${e.title}`.toLowerCase().includes(query.toLowerCase())).map(e => <li key={`${e.studentId}:${e.itemId}`} className="flex flex-wrap items-start justify-between gap-2 py-3">
          <div className="min-w-0"><p className="break-words font-medium">{names.get(e.studentId) ?? "学生"} · {e.title}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{e.reason}</p></div>
          <div className="flex flex-wrap items-center gap-3"><span className="text-xs">{EXECUTION_LABELS[e.status]}{e.progressPercent !== null ? ` · ${e.progressPercent}%` : ""}</span>
            {e.assignmentId && <Link className="inline-flex min-h-11 items-center text-xs underline" href={`/${space}/dashboard/admin/assignments/${e.assignmentId}`}>处理考试</Link>}
          </div>
        </li>)}
      </ul>
      {plan.execution.length === 0 && <p className="py-3">暂无可查看的有效学生执行记录，请检查学生授权与负责关系。</p>}
    </details>
  </div>;
}
