"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { getVisaCaseStatusLabel } from "../../visa/visa-case-stages";
import { LocalDateTime } from "@/components/LocalDateTime";

export type VisaTaskSummary = {
  id: string;
  title: string;
  stage: string;
  status: string;
  studentNote: string;
  adminNote: string;
  submittedAt: string | null;
  updatedAt: string;
};

export type VisaManagementCase = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  universityName: string;
  programName: string;
  admissionTrack: string;
  visaType: string;
  applicationChannel: string;
  caseStatus: string;
  targetEntryDate: string | null;
  plannedEntryDate: string | null;
  applicationCity: string | null;
  updatedAt: string;
  tasks: VisaTaskSummary[];
};

const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

const CHANNEL_LABELS: Record<string, string> = {
  china_consulate: "驻华领馆递签",
  korea_immigration: "韩国出入境返签",
};

const TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

const TASK_STAGE_LABELS: Record<string, string> = {
  admission: "入学许可",
  identity: "身份材料",
  finance: "资金材料",
  application: "申请表格",
  appointment: "预约递交",
  submission: "正式递签",
  result: "结果查询",
  entry: "入境安排",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "未开始",
  in_progress: "准备中",
  submitted: "待审核",
  reviewing: "审核中",
  approved: "已确认",
  revision_required: "需要补充",
  blocked: "需要协助",
};

const FILTERS = [
  ["all", "全部档案"],
  ["action", "需要处理"],
  ["preparing", "准备阶段"],
  ["submitted", "已经递签"],
  ["issued", "已经获签"],
] as const;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function FormattedDate({ value }: { value: string | null }) {
  return <LocalDateTime value={value} options={DATE_OPTIONS} />;
}

function taskTone(status: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "revision_required" || status === "blocked") return "bg-rose-50 text-rose-700";
  if (status === "submitted" || status === "reviewing") return "bg-amber-50 text-amber-700";
  if (status === "in_progress") return "bg-sky-50 text-sky-700";
  return "bg-zinc-100 text-zinc-500";
}

function caseTone(status: string) {
  if (status === "issued") return "bg-emerald-50 text-emerald-700";
  if (status === "additional_documents") return "bg-rose-50 text-rose-700";
  if (status === "submitted" || status === "approved") return "bg-amber-50 text-amber-700";
  if (["planning", "preparing", "ready_to_submit"].includes(status)) return "bg-sky-50 text-sky-700";
  if (status === "admin_preparing") return "bg-violet-50 text-violet-700";
  return "bg-zinc-100 text-zinc-600";
}

export function VisaManagementWorkspace({
  cases,
  initialQuery,
  initialStatus,
}: {
  cases: VisaManagementCase[];
  initialQuery: string;
  initialStatus: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(new Set());

  const metrics = useMemo(() => {
    const pending = cases.reduce(
      (sum, item) => sum + item.tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length,
      0
    );
    const support = cases.reduce(
      (sum, item) => sum + item.tasks.filter((task) => ["revision_required", "blocked"].includes(task.status)).length,
      0
    );
    return {
      pending,
      support,
      issued: cases.filter((item) => item.caseStatus === "issued").length,
    };
  }, [cases]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return cases.filter((item) => {
      const pending = item.tasks.some((task) => ["submitted", "reviewing"].includes(task.status));
      const support = item.tasks.some((task) => ["revision_required", "blocked"].includes(task.status));
      const matchesStatus =
        status === "all" ||
        (status === "action" && (pending || support)) ||
        (status === "preparing" && ["admin_preparing", "planning", "preparing", "ready_to_submit"].includes(item.caseStatus)) ||
        (status === "submitted" && ["submitted", "additional_documents", "approved"].includes(item.caseStatus)) ||
        (status === "issued" && item.caseStatus === "issued");
      const searchable = `${item.studentName} ${item.studentEmail} ${item.universityName} ${item.programName} ${VISA_TYPE_LABELS[item.visaType] ?? item.visaType} ${CHANNEL_LABELS[item.applicationChannel] ?? item.applicationChannel}`.toLocaleLowerCase("zh-CN");
      return matchesStatus && (!normalized || searchable.includes(normalized));
    });
  }, [cases, query, status]);

  function toggleCase(caseId: string) {
    setExpandedCaseIds((current) => {
      const next = new Set(current);
      if (next.has(caseId)) next.delete(caseId);
      else next.add(caseId);
      return next;
    });
  }

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1720px] px-4 sm:px-6 lg:px-8">
        <section className="border-y border-black/[0.08] bg-white">
          <header className="flex flex-col gap-4 border-b border-black/[0.08] px-4 py-5 sm:px-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                机构签证工作台 / 学生案件
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.035em] text-zinc-950">签证管理</h2>
              <p className="mt-1 text-[11px] text-zinc-500">按学生档案跟进签证任务、补件、递签结果与入境安排；所有案件默认收缩。</p>
            </div>
            <dl className="flex flex-wrap items-center gap-y-2 text-[10px]">
              {[
                ["签证档案", cases.length, "text-zinc-950"],
                ["等待审核", metrics.pending, "text-amber-700"],
                ["补件 / 协助", metrics.support, "text-rose-700"],
                ["已经获签", metrics.issued, "text-emerald-700"],
              ].map(([label, value, color], index) => (
                <div key={String(label)} className={`min-w-[94px] px-4 ${index > 0 ? "border-l border-black/[0.08]" : ""}`}>
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className={`mt-0.5 font-mono text-base font-medium tabular-nums ${color}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </header>

          <div className="grid gap-0 border-b border-black/[0.08] lg:grid-cols-[minmax(260px,1fr)_auto]">
            <label className="flex min-h-11 items-center gap-2 border-b border-black/[0.06] px-4 lg:border-b-0 lg:border-r">
              <Search size={13} className="text-zinc-400" />
              <span className="sr-only">搜索签证档案</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索学生、院校、专业或签证类型"
                className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-800 outline-none placeholder:text-zinc-400"
              />
            </label>
            <div className="flex min-h-11 flex-wrap items-center gap-1 px-3 py-1.5">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={`h-7 border px-3 text-[10px] font-medium transition ${status === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-transparent text-zinc-500 hover:border-black/[0.08] hover:text-zinc-900"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-black/[0.08] bg-zinc-50/40 text-[9px] uppercase tracking-[0.07em] text-zinc-500">
                  <th className="w-10 px-3 font-medium"><span className="sr-only">展开</span></th>
                  <th className="w-[190px] border-r border-black/[0.06] px-3 font-medium">学生</th>
                  <th className="w-[230px] px-3 font-medium">申请院校</th>
                  <th className="w-[125px] px-3 font-medium">签证类型</th>
                  <th className="w-[150px] px-3 font-medium">办理通道</th>
                  <th className="w-[125px] px-3 font-medium">当前阶段</th>
                  <th className="w-[120px] px-3 text-right font-medium">任务进度</th>
                  <th className="w-[110px] px-3 text-right font-medium">异常任务</th>
                  <th className="w-[115px] px-3 font-medium">计划入境</th>
                  <th className="w-[115px] px-3 font-medium">最近更新</th>
                  <th className="w-[90px] px-5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((item) => {
                  const expanded = expandedCaseIds.has(item.id);
                  const approved = item.tasks.filter((task) => task.status === "approved").length;
                  const pending = item.tasks.filter((task) => ["submitted", "reviewing"].includes(task.status)).length;
                  const support = item.tasks.filter((task) => ["revision_required", "blocked"].includes(task.status)).length;
                  return (
                    <Fragment key={item.id}>
                      <tr className="h-[54px] border-b border-black/[0.07] text-[11px] hover:bg-zinc-50/60">
                        <td className="px-3">
                          <button type="button" onClick={() => toggleCase(item.id)} className="flex size-6 items-center justify-center text-zinc-400 hover:text-zinc-950" aria-label={expanded ? `收起 ${item.studentName}` : `展开 ${item.studentName}`}>
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="border-r border-black/[0.06] px-3">
                          <p className="truncate font-medium text-zinc-950">{item.studentName}</p>
                          <p className="mt-0.5 truncate text-[9px] text-zinc-400">{item.studentEmail || `账号 · ${item.studentId.slice(-6)}`}</p>
                        </td>
                        <td className="px-3">
                          <p className="truncate font-medium text-zinc-800">{item.universityName}</p>
                          <p className="mt-0.5 truncate text-[9px] text-zinc-400">{TRACK_LABELS[item.admissionTrack] ?? "项目待确认"}{item.programName ? ` · ${item.programName}` : ""}</p>
                        </td>
                        <td className="px-3 text-zinc-600">{VISA_TYPE_LABELS[item.visaType] ?? item.visaType}</td>
                        <td className="px-3 text-zinc-600">{CHANNEL_LABELS[item.applicationChannel] ?? item.applicationChannel}</td>
                        <td className="px-3"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${caseTone(item.caseStatus)}`}>{getVisaCaseStatusLabel(item.applicationChannel, item.caseStatus)}</span></td>
                        <td className="px-3 text-right font-mono tabular-nums text-zinc-600">{approved} / {item.tasks.length}</td>
                        <td className={`px-3 text-right font-mono tabular-nums ${pending + support > 0 ? "text-rose-700" : "text-zinc-400"}`}>{pending + support}</td>
                        <td className="px-3 font-mono text-[10px] text-zinc-500">{item.plannedEntryDate ?? item.targetEntryDate ?? "—"}</td>
                        <td className="px-3 font-mono text-[10px] text-zinc-400"><FormattedDate value={item.updatedAt} /></td>
                        <td className="px-5 text-right"><Link href={`/dashboard/admin/visa/${item.studentId}`} className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950">进入办理</Link></td>
                      </tr>

                      {expanded && (
                        <tr className="border-b border-black/[0.08] bg-zinc-50/45">
                          <td colSpan={11} className="px-12 py-3">
                            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                              <table className="w-full border-collapse text-left text-[10px]">
                                <thead>
                                  <tr className="h-8 border-b border-black/[0.06] text-[8px] uppercase tracking-[0.06em] text-zinc-400">
                                    <th className="w-[120px] px-2 font-medium">任务阶段</th>
                                    <th className="px-2 font-medium">任务</th>
                                    <th className="w-[100px] px-2 font-medium">状态</th>
                                    <th className="w-[120px] px-2 font-medium">提交时间</th>
                                    <th className="w-[220px] px-2 font-medium">学生说明</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.tasks.map((task) => (
                                    <tr key={task.id} className="h-10 border-b border-black/[0.05] last:border-b-0">
                                      <td className="px-2 text-zinc-500">{TASK_STAGE_LABELS[task.stage] ?? task.stage}</td>
                                      <td className="px-2 font-medium text-zinc-800">{task.title}</td>
                                      <td className="px-2"><span className={`inline-flex px-2 py-1 text-[9px] font-medium ${taskTone(task.status)}`}>{TASK_STATUS_LABELS[task.status] ?? task.status}</span></td>
                                      <td className="px-2 font-mono text-[9px] text-zinc-400"><FormattedDate value={task.submittedAt} /></td>
                                      <td className="max-w-[220px] truncate px-2 text-zinc-500">{task.studentNote || "—"}</td>
                                    </tr>
                                  ))}
                                  {item.tasks.length === 0 && <tr><td colSpan={5} className="px-2 py-8 text-center text-zinc-400">尚未生成签证任务</td></tr>}
                                </tbody>
                              </table>

                              <div className="border-l border-black/[0.07] pl-5 text-[10px]">
                                <p className="text-[8px] font-medium uppercase tracking-[0.07em] text-zinc-400">案件判断</p>
                                <p className={`mt-2 text-xs font-medium ${pending > 0 ? "text-amber-700" : support > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                  {pending > 0 ? `${pending} 项任务等待审核` : support > 0 ? `${support} 项任务需要补件或协助` : "当前没有待处理任务"}
                                </p>
                                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-zinc-500">
                                  <div><dt className="text-[8px] text-zinc-400">递签领区</dt><dd className="mt-0.5">{item.applicationCity || "待确认"}</dd></div>
                                  <div><dt className="text-[8px] text-zinc-400">最晚入境</dt><dd className="mt-0.5 font-mono">{item.targetEntryDate || "待确认"}</dd></div>
                                  <div><dt className="text-[8px] text-zinc-400">已确认任务</dt><dd className="mt-0.5 font-mono">{approved} / {item.tasks.length}</dd></div>
                                  <div><dt className="text-[8px] text-zinc-400">最近更新</dt><dd className="mt-0.5 font-mono"><FormattedDate value={item.updatedAt} /></dd></div>
                                </dl>
                                <Link href={`/dashboard/admin/visa/${item.studentId}`} className="mt-4 inline-flex h-8 items-center gap-2 border border-zinc-900 bg-zinc-900 px-3 text-[10px] font-medium text-white">
                                  <ShieldCheck size={12} />进入完整办理
                                </Link>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {filteredCases.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center">
                      {query || status !== "all" ? <Search className="mx-auto text-zinc-300" size={24} /> : <FileCheck2 className="mx-auto text-zinc-300" size={24} />}
                      <p className="mt-3 text-xs font-medium text-zinc-700">{query || status !== "all" ? "没有符合条件的签证档案" : "本机构尚未产生签证档案"}</p>
                      <p className="mt-1 text-[10px] text-zinc-400">申请流程进入签证阶段后，系统会在这里生成对应案件。</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="flex items-center gap-2 border-t border-black/[0.08] px-5 py-3 text-[10px] text-zinc-400">
            {metrics.pending + metrics.support > 0 ? <CircleAlert size={12} className="text-amber-600" /> : <ShieldCheck size={12} className="text-emerald-600" />}
            <span>当前显示 {filteredCases.length} / {cases.length} 份档案</span>
            <span className="ml-auto inline-flex items-center gap-1"><Clock3 size={11} />案件数据按最近更新时间排序</span>
          </footer>
        </section>
      </div>
    </div>
  );
}
