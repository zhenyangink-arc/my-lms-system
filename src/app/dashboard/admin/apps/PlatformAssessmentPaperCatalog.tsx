"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { AssessmentPaperQuestionDrawer } from "@/app/dashboard/admin/assignments/AssessmentPaperQuestionDrawer";
import { AssessmentPaperStatusActions } from "@/app/dashboard/admin/assignments/AssessmentPaperStatusActions";
import type { AssessmentPaperStatus } from "@/lib/assessment-papers";

export type PlatformAssessmentPaperItem = {
  id: string;
  paperCode: string;
  title: string;
  paperType: "homework" | "exam";
  status: AssessmentPaperStatus;
  chapterTitle: string;
  questionCount: number;
  totalPoints: number;
  version: number;
  updatedAt: string;
  qualityReady: boolean;
  institutionCount: number;
  assignmentCount: number;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    points: number;
    difficulty: string;
    skill: string;
  }>;
};

const statusLabels: Record<AssessmentPaperStatus, string> = {
  draft: "草稿",
  published: "机构可用",
  retired: "已停止提供",
  archived: "已归档",
};

const statusColors: Record<AssessmentPaperStatus, string> = {
  draft: "var(--foreground-muted)",
  published: "var(--status-success)",
  retired: "var(--status-warning)",
  archived: "var(--foreground-muted)",
};

function updatedAtLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function PlatformAssessmentPaperCatalog({
  papers,
  canRelease,
}: {
  papers: PlatformAssessmentPaperItem[];
  canRelease: boolean;
}) {
  const [query, setQuery] = useState("");
  const [paperType, setPaperType] = useState<"all" | "homework" | "exam">(
    "all"
  );
  const [status, setStatus] = useState<"all" | AssessmentPaperStatus>("all");
  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return papers.filter(
      (paper) =>
        (paperType === "all" || paper.paperType === paperType) &&
        (status === "all" || paper.status === status) &&
        (!keyword ||
          `${paper.title} ${paper.paperCode} ${paper.chapterTitle}`
            .toLowerCase()
            .includes(keyword))
    );
  }, [paperType, papers, query, status]);

  return (
    <section className="overflow-hidden border bg-[var(--card)]">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">标准试卷目录</h2>
          <p className="app-muted-text mt-1 text-xs">
            草稿先完成质检，平台负责人发布后机构才能看到并布置。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="app-input flex min-h-11 min-w-64 items-center gap-2 rounded-lg border px-3">
            <Search size={15} aria-hidden="true" className="app-muted-text" />
            <span className="sr-only">搜索试卷</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、编号或章节"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </label>
          <select
            aria-label="试卷类型"
            value={paperType}
            onChange={(event) =>
              setPaperType(event.target.value as typeof paperType)
            }
            className="app-input min-h-11 rounded-lg border px-3 text-xs font-semibold"
          >
            <option value="all">全部类型</option>
            <option value="homework">作业卷</option>
            <option value="exam">考试卷</option>
          </select>
          <select
            aria-label="发布状态"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as typeof status)
            }
            className="app-input min-h-11 rounded-lg border px-3 text-xs font-semibold"
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">机构可用</option>
            <option value="retired">已停止提供</option>
            <option value="archived">已归档</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
          <caption className="sr-only">平台标准试卷目录</caption>
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-[var(--surface-soft)] app-muted-text">
            <tr>
              {[
                "试卷",
                "来源章节",
                "题量 / 总分",
                "发布状态",
                "发布质检",
                "机构采用",
                "操作",
              ].map((label, index) => (
                <th
                  key={label}
                  className={`${index > 0 ? "border-l" : ""} px-4 py-3 text-[11px] font-bold ${index >= 2 && index <= 5 ? "text-center" : index === 6 ? "text-right" : ""}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredPapers.map((paper) => (
              <tr
                key={paper.id}
                className="border-t align-middle hover:bg-[var(--surface-soft)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <td className="px-4 py-4">
                  <p className="text-sm font-bold">{paper.title}</p>
                  <p className="app-muted-text mt-1 font-mono text-[10px]">
                    {paper.paperCode} · 版本 {paper.version} · {updatedAtLabel(paper.updatedAt)}
                  </p>
                </td>
                <td className="border-l px-4 py-4 text-xs">
                  {paper.chapterTitle}
                </td>
                <td className="border-l px-4 py-4 text-center font-mono text-xs tabular-nums">
                  {paper.questionCount} / {paper.totalPoints}
                </td>
                <td className="border-l px-4 py-4 text-center">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold"
                    style={{ color: statusColors[paper.status] }}
                  >
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-current"
                    />
                    {statusLabels[paper.status]}
                  </span>
                </td>
                <td className="border-l px-4 py-4 text-center">
                  <span
                    className="text-xs font-bold"
                    style={{
                      color: paper.qualityReady
                        ? "var(--status-success)"
                        : "var(--status-danger)",
                    }}
                  >
                    {paper.qualityReady ? "可以发布" : "待完善"}
                  </span>
                </td>
                <td className="border-l px-4 py-4 text-center text-xs">
                  <p className="font-bold tabular-nums">
                    {paper.institutionCount} 家机构
                  </p>
                  <p className="app-muted-text mt-1 tabular-nums">
                    {paper.assignmentCount} 次布置
                  </p>
                </td>
                <td className="border-l px-4 py-4">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <AssessmentPaperQuestionDrawer
                      title={paper.title}
                      paperCode={paper.paperCode}
                      questions={paper.questions}
                    />
                    <AssessmentPaperStatusActions
                      paperId={paper.id}
                      paperType={paper.paperType}
                      status={paper.status}
                      canRelease={canRelease}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {filteredPapers.length === 0 && (
              <tr>
                <td colSpan={7} className="app-muted-text px-5 py-12 text-center text-sm">
                  {papers.length === 0
                    ? "当前应用还没有标准试卷。"
                    : "没有符合当前筛选条件的试卷。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
