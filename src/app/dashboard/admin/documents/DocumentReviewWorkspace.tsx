"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  LockKeyhole,
  RotateCcw,
  Search,
  UnlockKeyhole,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  APPLICATION_STAGE_LABELS,
  CATEGORY_LABELS,
} from "@/app/dashboard/documents/constants";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  reviewApplicationAction,
} from "./actions";
import type { DocumentReviewActionState } from "./actions";

const initialDocumentReviewActionState: DocumentReviewActionState = {
  status: "idle",
  message: "",
};

export type DocumentReviewStatus =
  | "preparing"
  | "pending_review"
  | "revision_required"
  | "approved";

export type DocumentReviewItem = {
  id: string;
  title: string;
  category: string;
  status: "preparing" | "completed" | "not_needed";
  adminNote: string | null;
  dueDate: string | null;
  lockedAt: string | null;
};

export type DocumentReviewEvent = {
  id: string;
  previousStatus: DocumentReviewStatus;
  newStatus: DocumentReviewStatus;
  note: string;
  actorName: string;
  createdAt: string;
};

export type DocumentReviewApplication = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityName: string;
  programName: string | null;
  admissionTrackLabel: string;
  applicationStage: number;
  reviewStatus: DocumentReviewStatus;
  reviewSubmittedAt: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  documentsLockedAt: string | null;
  updatedAt: string;
  documents: DocumentReviewItem[];
  events: DocumentReviewEvent[];
};

const REVIEW_STATUS_META: Record<
  DocumentReviewStatus,
  { label: string; dot: string; text: string; soft: string }
> = {
  preparing: {
    label: "准备中",
    dot: "bg-slate-400",
    text: "text-slate-600",
    soft: "bg-slate-50",
  },
  pending_review: {
    label: "待确认",
    dot: "bg-amber-500",
    text: "text-amber-700",
    soft: "bg-amber-50",
  },
  revision_required: {
    label: "需补充",
    dot: "bg-rose-500",
    text: "text-rose-700",
    soft: "bg-rose-50",
  },
  approved: {
    label: "已确认",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    soft: "bg-emerald-50",
  },
};

const ITEM_STATUS_META: Record<
  DocumentReviewItem["status"],
  { label: string; dot: string; text: string }
> = {
  preparing: { label: "准备中", dot: "bg-amber-500", text: "text-amber-700" },
  completed: { label: "已完成", dot: "bg-emerald-500", text: "text-emerald-700" },
  not_needed: { label: "无需准备", dot: "bg-slate-300", text: "text-slate-500" },
};

const FILTERS: Array<{ value: "all" | DocumentReviewStatus; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending_review", label: "待确认" },
  { value: "revision_required", label: "需补充" },
  { value: "preparing", label: "准备中" },
  { value: "approved", label: "已确认" },
];

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit" };

function FormattedDate({ value, includeTime = false }: { value: string | null; includeTime?: boolean }) {
  return <LocalDateTime value={value} options={includeTime ? DATE_TIME_OPTIONS : DATE_OPTIONS} />;
}

function ReviewStatus({ status }: { status: DocumentReviewStatus }) {
  const meta = REVIEW_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.text}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ItemStatus({ status }: { status: DocumentReviewItem["status"] }) {
  const meta = ITEM_STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${meta.text}`}>
      <span className={`size-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function ReviewDecisionPanel({
  application,
  onCompleted,
}: {
  application: DocumentReviewApplication;
  onCompleted: () => void;
}) {
  const [note, setNote] = useState(application.reviewNote);
  const revisionAction = reviewApplicationAction.bind(
    null,
    application.id,
    "revision_required" as const
  );
  const approveAction = reviewApplicationAction.bind(
    null,
    application.id,
    "approved" as const
  );
  const [revisionState, submitRevision, revisionPending] = useActionState(
    revisionAction,
    initialDocumentReviewActionState
  );
  const [approveState, submitApproval, approvePending] = useActionState(
    approveAction,
    initialDocumentReviewActionState
  );
  const unresolvedCount = application.documents.filter(
    (item) => item.status === "preparing" && !item.lockedAt
  ).length;
  const activeState =
    approveState.status !== "idle" ? approveState : revisionState;

  useEffect(() => {
    if (revisionState.status === "success" || approveState.status === "success") {
      onCompleted();
    }
  }, [approveState, onCompleted, revisionState]);

  if (application.reviewStatus !== "pending_review") {
    return (
      <div className="border-t border-black/[0.08] px-6 py-4 text-[11px] text-zinc-500">
        当前申请单为“{REVIEW_STATUS_META[application.reviewStatus].label}”，无需执行审核操作。
      </div>
    );
  }

  return (
    <div className="border-t border-black/[0.08] bg-zinc-50/60 px-6 py-4">
      <label className="block text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500">
        审核意见
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="退回补充时必须填写原因；确认通过时可以填写内部说明。"
          className="mt-2 w-full resize-none rounded-md border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-black/25"
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-[10px]">
          {activeState.status === "error" && (
            <span className="inline-flex items-center gap-1.5 text-rose-700">
              <CircleAlert size={12} />
              {activeState.message}
            </span>
          )}
          {unresolvedCount > 0 && activeState.status !== "error" && (
            <span className="text-amber-700">
              仍有 {unresolvedCount} 项资料处于准备中，只能退回补充。
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <form action={submitRevision}>
            <input type="hidden" name="reviewNote" value={note} />
            <button
              type="submit"
              disabled={revisionPending || approvePending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-3 text-[11px] font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <RotateCcw size={13} />
              {revisionPending ? "正在退回…" : "退回补充"}
            </button>
          </form>
          <form action={submitApproval}>
            <input type="hidden" name="reviewNote" value={note} />
            <button
              type="submit"
              disabled={unresolvedCount > 0 || revisionPending || approvePending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-950 px-3 text-[11px] font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Check size={13} />
              {approvePending ? "正在确认…" : "审核确认"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ReviewDialog({
  application,
  onOpenChange,
}: {
  application: DocumentReviewApplication | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  if (!application) return null;
  const completedCount = application.documents.filter(
    (item) => item.status !== "preparing"
  ).length;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-lg border-black/10 bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.14)] sm:max-w-[1050px]">
        <DialogHeader className="border-b border-black/[0.08] px-6 py-4 pr-14 text-left">
          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-zinc-400">
            资料审核 / 申请单
          </p>
          <DialogTitle className="mt-1 text-base font-semibold tracking-[-0.025em]">
            {application.studentName} · {application.universityName}
          </DialogTitle>
          <DialogDescription className="text-[10px]">
            {application.admissionTrackLabel}
            {application.programName ? ` · ${application.programName}` : ""} · 已处理 {completedCount}/{application.documents.length} 项
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid border-b border-black/[0.08] sm:grid-cols-4">
            {[
              ["学生", application.studentName],
              ["申请项目", application.admissionTrackLabel],
              [
                "当前阶段",
                APPLICATION_STAGE_LABELS[application.applicationStage] ?? "阶段待确认",
              ],
              ["审核状态", REVIEW_STATUS_META[application.reviewStatus].label],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`px-4 py-3 ${index < 3 ? "border-b border-black/[0.06] sm:border-b-0 sm:border-r" : ""}`}
              >
                <p className="text-[9px] uppercase tracking-[0.06em] text-zinc-400">{label}</p>
                <p className="mt-1 truncate text-[11px] font-medium text-zinc-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[11px]">
              <thead>
                <tr className="h-9 border-b border-black/[0.08] bg-zinc-50/50 text-[9px] uppercase tracking-[0.06em] text-zinc-500">
                  <th className="w-[110px] px-4 font-medium">分类</th>
                  <th className="w-[230px] px-3 font-medium">资料名称</th>
                  <th className="w-[100px] px-3 font-medium">学生状态</th>
                  <th className="px-3 font-medium">管理员备注</th>
                  <th className="w-[95px] px-3 font-medium">截止日期</th>
                  <th className="w-[70px] px-4 text-right font-medium">锁定</th>
                </tr>
              </thead>
              <tbody>
                {application.documents.map((item) => (
                  <tr key={item.id} className="h-[46px] border-b border-black/[0.06] last:border-b-0">
                    <td className="px-4 text-zinc-500">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                    <td className="px-3 font-medium text-zinc-950">{item.title}</td>
                    <td className="px-3"><ItemStatus status={item.status} /></td>
                    <td className="max-w-[280px] truncate px-3 text-zinc-500">{item.adminNote || "—"}</td>
                    <td className="px-3 font-mono text-[10px] text-zinc-500">{item.dueDate || "—"}</td>
                    <td className="px-4 text-right text-zinc-400">
                      {item.lockedAt ? <LockKeyhole className="ml-auto" size={12} /> : <UnlockKeyhole className="ml-auto" size={12} />}
                    </td>
                  </tr>
                ))}
                {application.documents.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">这份申请单还没有资料项目</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {application.events.length > 0 && (
            <div className="border-t border-black/[0.08] px-6 py-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-zinc-400">审核记录</p>
              <table className="mt-2 w-full border-collapse text-left text-[10px]">
                <tbody>
                  {application.events.slice(0, 5).map((event) => (
                    <tr key={event.id} className="border-t border-black/[0.06] first:border-t-0">
                      <td className="w-[110px] py-2 font-mono text-zinc-400"><FormattedDate value={event.createdAt} includeTime /></td>
                      <td className="w-[170px] py-2 text-zinc-600">
                        {REVIEW_STATUS_META[event.previousStatus].label} → {REVIEW_STATUS_META[event.newStatus].label}
                      </td>
                      <td className="py-2 text-zinc-500">{event.note || "—"}</td>
                      <td className="w-[100px] py-2 text-right text-zinc-400">{event.actorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ReviewDecisionPanel
          application={application}
          onCompleted={() => {
            onOpenChange(false);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function DocumentReviewWorkspace({
  applications,
  initialQuery = "",
  initialStatus = "all",
}: {
  applications: DocumentReviewApplication[];
  initialQuery?: string;
  initialStatus?: "all" | DocumentReviewStatus;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState<"all" | DocumentReviewStatus>(initialStatus);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedApplication, setSelectedApplication] =
    useState<DocumentReviewApplication | null>(null);

  const counts = useMemo(() => {
    const result: Record<DocumentReviewStatus, number> = {
      preparing: 0,
      pending_review: 0,
      revision_required: 0,
      approved: 0,
    };
    for (const application of applications) result[application.reviewStatus] += 1;
    return result;
  }, [applications]);

  const filteredApplications = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return applications.filter((application) => {
      if (status !== "all" && application.reviewStatus !== status) return false;
      if (!normalized) return true;
      return `${application.studentName} ${application.studentEmail} ${application.universityName} ${application.programName ?? ""} ${application.admissionTrackLabel}`
        .toLocaleLowerCase("zh-CN")
        .includes(normalized);
    });
  }, [applications, query, status]);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-4 py-5 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">留学业务 / 资料审核</p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">申请资料审核</h2>
              <p className="mt-1 text-[11px] text-zinc-500">以“学生 × 目标大学申请单”为单位核对资料，单项准备状态与整单审核结果分开记录。</p>
            </div>
            <dl className="flex flex-wrap items-center gap-y-2 text-[10px]">
              {[
                ["申请单", applications.length, "text-zinc-950"],
                ["待确认", counts.pending_review, "text-amber-700"],
                ["需补充", counts.revision_required, "text-rose-700"],
                ["已确认", counts.approved, "text-emerald-700"],
              ].map(([label, value, color], index) => (
                <div key={String(label)} className={`min-w-[82px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className={`mt-0.5 font-mono text-base font-medium tabular-nums ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className="flex flex-col gap-3 border-b border-black/[0.08] px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-5 overflow-x-auto">
              {FILTERS.map((filter) => {
                const count = filter.value === "all" ? applications.length : counts[filter.value];
                const active = status === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setStatus(filter.value)}
                    className={`shrink-0 border-b py-1.5 text-[11px] font-medium transition ${active ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}
                  >
                    {filter.label} <span className="ml-1 font-mono text-[9px] text-zinc-400">{count}</span>
                  </button>
                );
              })}
            </div>
            <label className="relative block w-full lg:w-[310px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" size={13} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索学生、大学、项目"
                className="h-8 w-full rounded-md border border-black/10 bg-white pl-8 pr-3 text-[11px] outline-none transition placeholder:text-zinc-400 focus:border-black/25"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1220px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[9px] uppercase tracking-[0.07em] text-zinc-500">
                  <th className="w-10 px-3 font-medium"><span className="sr-only">展开</span></th>
                  <th className="w-[190px] px-3 font-medium">学生</th>
                  <th className="w-[270px] px-3 font-medium">目标大学 / 项目</th>
                  <th className="w-[150px] px-3 font-medium">资料进度</th>
                  <th className="w-[165px] px-3 font-medium">当前申请阶段</th>
                  <th className="w-[105px] px-3 font-medium">审核状态</th>
                  <th className="w-[105px] px-3 font-medium">更新时间</th>
                  <th className="w-[125px] px-4 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map((application) => {
                  const expanded = expandedIds.has(application.id);
                  const resolvedCount = application.documents.filter((item) => item.status !== "preparing").length;
                  const progress = application.documents.length > 0
                    ? Math.round((resolvedCount / application.documents.length) * 100)
                    : 0;
                  return (
                    <FragmentRow
                      key={application.id}
                      application={application}
                      expanded={expanded}
                      progress={progress}
                      resolvedCount={resolvedCount}
                      onToggle={() => toggleExpanded(application.id)}
                      onReview={() => setSelectedApplication(application)}
                    />
                  );
                })}
                {filteredApplications.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <FileCheck2 className="mx-auto text-zinc-300" size={25} />
                      <p className="mt-3 text-xs font-medium text-zinc-700">没有符合条件的申请单</p>
                      <p className="mt-1 text-[10px] text-zinc-400">可以清除搜索词或切换审核状态。</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <ReviewDialog
        application={selectedApplication}
        onOpenChange={(open) => {
          if (!open) setSelectedApplication(null);
        }}
      />
    </div>
  );
}

function FragmentRow({
  application,
  expanded,
  progress,
  resolvedCount,
  onToggle,
  onReview,
}: {
  application: DocumentReviewApplication;
  expanded: boolean;
  progress: number;
  resolvedCount: number;
  onToggle: () => void;
  onReview: () => void;
}) {
  return (
    <>
      <tr className="h-[52px] border-b border-black/[0.07] text-[11px] transition hover:bg-zinc-50/60">
        <td className="px-3">
          <button type="button" onClick={onToggle} className="flex size-6 items-center justify-center text-zinc-400 hover:text-zinc-950" aria-label={expanded ? "收起资料" : "展开资料"}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-3">
          <p className="truncate font-medium text-zinc-950">{application.studentName}</p>
          <p className="mt-0.5 truncate text-[9px] text-zinc-400">{application.studentEmail || `账号 …${application.studentId.slice(-6)}`}</p>
        </td>
        <td className="px-3">
          <p className="truncate font-medium text-zinc-900">{application.universityName}</p>
          <p className="mt-0.5 truncate text-[9px] text-zinc-400">{application.admissionTrackLabel}{application.programName ? ` · ${application.programName}` : ""}</p>
        </td>
        <td className="px-3">
          <div className="flex items-center gap-2">
            <span className="w-12 font-mono text-[10px] tabular-nums text-zinc-600">{resolvedCount}/{application.documents.length}</span>
            <span className="h-1 w-16 overflow-hidden bg-zinc-100"><span className="block h-full bg-zinc-700" style={{ width: `${progress}%` }} /></span>
            <span className="font-mono text-[9px] text-zinc-400">{progress}%</span>
          </div>
        </td>
        <td className="px-3 text-zinc-600">{APPLICATION_STAGE_LABELS[application.applicationStage] ?? "阶段待确认"}</td>
        <td className="px-3"><ReviewStatus status={application.reviewStatus} /></td>
        <td className="px-3 font-mono text-[10px] text-zinc-400"><FormattedDate value={application.updatedAt} includeTime /></td>
        <td className="px-4">
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onReview} className={`text-[10px] font-medium ${application.reviewStatus === "pending_review" ? "text-amber-700 hover:text-amber-900" : "text-zinc-600 hover:text-zinc-950"}`}>
              {application.reviewStatus === "pending_review" ? "审核" : "查看"}
            </button>
            <Link href={`/dashboard/admin/documents/${application.studentId}?target=${application.id}`} className="text-[10px] text-zinc-400 hover:text-zinc-950">管理资料</Link>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-black/[0.08] bg-zinc-50/45">
          <td colSpan={8} className="px-12 py-3">
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="h-8 border-b border-black/[0.06] text-[8px] uppercase tracking-[0.06em] text-zinc-400">
                  <th className="w-[115px] px-2 font-medium">分类</th>
                  <th className="w-[240px] px-2 font-medium">资料名称</th>
                  <th className="w-[100px] px-2 font-medium">学生状态</th>
                  <th className="px-2 font-medium">管理员备注</th>
                  <th className="w-[95px] px-2 font-medium">截止日期</th>
                  <th className="w-[70px] px-2 text-right font-medium">锁定</th>
                </tr>
              </thead>
              <tbody>
                {application.documents.map((item) => (
                  <tr key={item.id} className="h-9 border-b border-black/[0.05] last:border-b-0">
                    <td className="px-2 text-zinc-500">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                    <td className="px-2 font-medium text-zinc-800">{item.title}</td>
                    <td className="px-2"><ItemStatus status={item.status} /></td>
                    <td className="max-w-[350px] truncate px-2 text-zinc-500">{item.adminNote || "—"}</td>
                    <td className="px-2 font-mono text-[9px] text-zinc-400">{item.dueDate || "—"}</td>
                    <td className="px-2 text-right text-zinc-400">{item.lockedAt ? "已锁" : "—"}</td>
                  </tr>
                ))}
                {application.documents.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-zinc-400">暂无资料项目</td></tr>
                )}
              </tbody>
            </table>
            {application.reviewNote && (
              <div className={`mt-3 flex items-start gap-2 border-l-2 px-3 py-2 text-[10px] ${REVIEW_STATUS_META[application.reviewStatus].soft} ${REVIEW_STATUS_META[application.reviewStatus].text}`}>
                <Clock3 className="mt-0.5 shrink-0" size={11} />
                <span><b>最近审核意见：</b>{application.reviewNote}</span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
