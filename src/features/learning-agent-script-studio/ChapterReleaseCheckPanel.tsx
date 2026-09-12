"use client";

import { useState, useTransition } from "react";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { inspectChapterRelease, searchReleaseCheckStudents, type ReleaseReport, type StudentChoice } from "./release-check-actions";

export function ChapterReleaseCheckPanel({ appId, chapterId, disabled }: { appId: string; chapterId: string; disabled: boolean }) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<StudentChoice[]>([]);
  const [studentKey, setStudentKey] = useState("");
  const [message, setMessage] = useState("");
  const [report, setReport] = useState<ReleaseReport | null>(null);
  const [pending, startTransition] = useTransition();
  function search() {
    startTransition(async () => {
      try {
        const result = await searchReleaseCheckStudents(query);
        setStudents(result.options); setStudentKey(""); setReport(null); setMessage(result.message);
      } catch { setStudents([]); setStudentKey(""); setReport(null); setMessage("搜索失败，请重试。"); }
    });
  }
  function inspect() {
    const student = students.find(item => `${item.tenantId}:${item.studentId}` === studentKey);
    startTransition(async () => {
      setReport(null); setMessage("");
      try { setReport(await inspectChapterRelease({ appId, chapterId, student })); }
      catch { setMessage("检查未完成，请稍后重试。"); }
    });
  }
  return <section className="space-y-3 rounded-lg border border-[var(--border)] p-4">
    <CardTitleWithHint headingLevel={2} title="学生预览与发布检查" description="检查正式教材、脚本、复核状态、视频文件与练习引用。选择学生后，以其机构授权和真实学习进度计算开放条件，不创建或使用该学生的登录会话。结果仅代表检查时状态；视频画面与播放效果仍需在脚本预览中试看。" />
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">查找学生
        <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !pending) { event.preventDefault(); search(); } }} placeholder="输入学生姓名" className="app-input min-h-11 rounded-md border px-3" />
      </label>
      <button type="button" disabled={pending || query.trim().length < 2} onClick={search} className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50">查找</button>
      <label className="grid min-w-0 gap-1 text-sm">检查对象
        <select value={studentKey} onChange={event => { setStudentKey(event.target.value); setReport(null); }} className="app-input min-h-11 max-w-full rounded-md border px-3" disabled={pending}>
          <option value="">只检查本章内容</option>
          {students.map(student => <option key={`${student.tenantId}:${student.studentId}`} value={`${student.tenantId}:${student.studentId}`}>{student.label}</option>)}
        </select>
      </label>
      <button type="button" disabled={pending || disabled} onClick={inspect} className="min-h-11 rounded-md border px-3 text-sm disabled:opacity-50">{pending ? "正在处理…" : "检查本章准备情况"}</button>
    </div>
    {disabled && <p className="text-sm">请先保存当前修改，再检查正式发布状态。</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {report && <div className="space-y-2" aria-live="polite">
      <p className="text-xs text-[var(--foreground-muted)]">检查时间：{new Date(report.checkedAt).toLocaleString("zh-CN")}{disabled ? " · 当前有未保存修改，保存后请重新检查" : ""}</p>
      <ul className="divide-y divide-[var(--border)]">
        {report.checks.map((check, index) => <li key={`${check.label}:${index}`} className="py-2 text-sm">
          <p className="font-medium">{check.label} · {({ ready: "已满足", blocked: "需处理", unknown: "待核验" })[check.state]}</p>
          <p className="mt-1 text-[var(--foreground-muted)]">{check.detail}</p>
        </li>)}
      </ul>
    </div>}
  </section>;
}
