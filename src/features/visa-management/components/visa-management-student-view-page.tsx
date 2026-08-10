import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentModuleCardDeleteDialog } from "@/app/dashboard/admin/StudentModuleCardDeleteDialog";
import { deleteStudentVisaCardAction } from "@/app/dashboard/admin/visa/actions";
import {
  VisaCaseAdminForm,
  VisaTaskReviewControls,
} from "@/app/dashboard/admin/visa/VisaAdminControls";
import { getVisaCaseStatusLabel } from "@/app/dashboard/visa/visa-case-stages";
import { LocalDateTime } from "@/components/LocalDateTime";
import { scopeDashboardPath } from "@/lib/dashboard-path";
import { getVisaManagementStudentDetailData } from "../api/service";

const VISA_TYPE_LABELS: Record<string, string> = {
  d4_language: "语言研修签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

const CHANNEL_LABELS: Record<string, string> = {
  china_consulate: "驻华韩国领事馆递签",
  korea_immigration: "韩国出入境返签证",
};

const TRACK_LABELS: Record<string, string> = {
  language: "语学院",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

const STAGE_LABELS: Record<string, string> = {
  admission: "入学许可",
  identity: "身份材料",
  finance: "资金材料",
  application: "申请表格",
  appointment: "预约递交",
  submission: "正式递签",
  result: "结果查询",
  entry: "入境安排",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "未开始",
  in_progress: "准备中",
  submitted: "待审核",
  reviewing: "审核中",
  approved: "已确认",
  revision_required: "需要补充",
  blocked: "需要协助",
};

const ACCOMMODATION_LABELS: Record<string, string> = {
  on_campus_dormitory: "校内宿舍",
  off_campus_dormitory: "校外宿舍",
  rental: "租房",
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function taskStatusMessage(status: string) {
  if (status === "approved") return "任务已经审核确认。";
  if (status === "revision_required") return "等待学生补充后重新提交。";
  if (status === "blocked") return "学生标记需要协助，请及时联系。";
  return "学生正在准备，暂无需审核。";
}

export default async function VisaManagementStudentViewPage({
  studentId,
}: {
  studentId: string;
}) {
  const result = await getVisaManagementStudentDetailData(studentId);
  if (!result) notFound();

  const { student, visaCase, target, tasks } = result;
  const displayName = student.full_name || student.email || "未填写姓名";
  const approvedCount = tasks.filter((task) => task.status === "approved").length;
  const reviewCount = tasks.filter((task) =>
    ["submitted", "reviewing"].includes(task.status),
  ).length;
  const supportCount = tasks.filter((task) =>
    ["revision_required", "blocked"].includes(task.status),
  ).length;
  const entryRows = [
    ["最晚入境", visaCase.target_entry_date ?? "待确认"],
    ["预计入境", visaCase.planned_entry_date ?? "待填写"],
    [
      "住宿安排",
      visaCase.accommodation_status
        ? ACCOMMODATION_LABELS[visaCase.accommodation_status] ??
          visaCase.accommodation_status
        : "待填写",
    ],
    [
      "接机服务",
      visaCase.airport_pickup_required === null
        ? "待填写"
        : visaCase.airport_pickup_required
          ? "需要"
          : "不需要",
    ],
    [
      "户籍／常住地",
      [visaCase.residence_province, visaCase.residence_city]
        .filter(Boolean)
        .join(" · ") || "待填写",
    ],
    [
      "递签领区",
      visaCase.application_city
        ? `${visaCase.application_city}递签`
        : "待确认",
    ],
    [
      "出境安排",
      [visaCase.departure_province, visaCase.departure_airport]
        .filter(Boolean)
        .join(" · ") || "待填写",
    ],
    [
      "到达安排",
      [visaCase.arrival_region, visaCase.arrival_airport]
        .filter(Boolean)
        .join(" · ") || "待填写",
    ],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={scopeDashboardPath(
            "/dashboard/admin/visa",
            result.dashboardBasePath,
          )}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--app-muted)] hover:text-[var(--app-text)]"
        >
          <ArrowLeft size={13} />
          返回签证管理
        </Link>
        <StudentModuleCardDeleteDialog
          action={deleteStudentVisaCardAction.bind(null, studentId)}
          studentName={displayName}
          cardLabel="签证档案"
          description="将永久清空签证档案、全部准备任务和审核记录。"
        />
      </div>

      <section className="management-table-panel overflow-hidden border">
        <header className="flex flex-col gap-4 border-b border-[var(--app-border)] px-4 py-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[10px] font-semibold text-[var(--app-muted)]">
              学生签证案件 · {studentId.slice(-8)}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--app-text)]">
              {displayName}
            </h2>
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              {student.email || "未填写邮箱"}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--app-border)] bg-[var(--app-border)] sm:grid-cols-4">
            {[
              ["全部任务", tasks.length],
              ["等待审核", reviewCount],
              ["补件／协助", supportCount],
              ["已经确认", approvedCount],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-24 bg-[var(--app-card-bg)] px-3 py-2">
                <dt className="text-[10px] text-[var(--app-muted)]">{label}</dt>
                <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="overflow-x-auto border-b border-[var(--app-border)]">
          <table className="management-summary-table w-full min-w-[1040px] text-left">
            <thead>
              <tr>
                <th>申请院校</th>
                <th>申请项目</th>
                <th>签证类型</th>
                <th>办理通道</th>
                <th>当前阶段</th>
                <th>最近更新</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold">{target.university_name}</td>
                <td>
                  {TRACK_LABELS[target.admission_track ?? ""] ?? "项目待确认"}
                  {target.program_name ? ` · ${target.program_name}` : ""}
                </td>
                <td>{VISA_TYPE_LABELS[visaCase.visa_type] ?? visaCase.visa_type}</td>
                <td>
                  {CHANNEL_LABELS[visaCase.application_channel] ??
                    visaCase.application_channel}
                </td>
                <td>
                  {getVisaCaseStatusLabel(
                    visaCase.application_channel,
                    visaCase.case_status,
                  )}
                </td>
                <td>
                  <LocalDateTime value={visaCase.updated_at} options={DATE_OPTIONS} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-b border-[var(--app-border)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--app-muted)]" />
            <h3 className="text-sm font-semibold">整体办理设置</h3>
          </div>
          <VisaCaseAdminForm
            studentId={studentId}
            visaType={visaCase.visa_type}
            applicationChannel={visaCase.application_channel}
            targetEntryDate={visaCase.target_entry_date}
            caseStatus={visaCase.case_status}
            advisorNote={visaCase.advisor_note}
          />
        </div>

        <div className="grid gap-px border-b border-[var(--app-border)] bg-[var(--app-border)] sm:grid-cols-2 xl:grid-cols-4">
          {entryRows.map(([label, value]) => (
            <div key={label} className="bg-[var(--app-card-bg)] px-4 py-3">
              <p className="text-[10px] text-[var(--app-muted)]">{label}</p>
              <p className="mt-1 text-xs font-semibold text-[var(--app-text-soft)]">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] border-collapse text-left text-xs">
            <thead className="bg-[var(--app-soft-bg)] text-[var(--app-muted)]">
              <tr className="border-b border-[var(--app-border)]">
                <th className="px-3 py-3 font-semibold">序号</th>
                <th className="px-3 py-3 font-semibold">任务阶段</th>
                <th className="px-3 py-3 font-semibold">任务</th>
                <th className="px-3 py-3 font-semibold">状态</th>
                <th className="px-3 py-3 font-semibold">学生说明</th>
                <th className="px-3 py-3 font-semibold">审核记录</th>
                <th className="px-3 py-3 font-semibold">提交信息</th>
                <th className="px-4 py-3 font-semibold">审核操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, index) => (
                <tr key={task.id} className="border-b border-[var(--app-border)] align-top last:border-b-0">
                  <td className="px-3 py-4 font-mono text-[var(--app-muted)]">{index + 1}</td>
                  <td className="px-3 py-4">{STAGE_LABELS[task.stage] ?? task.stage}</td>
                  <td className="max-w-64 px-3 py-4">
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--app-muted)]">
                      {task.description || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    {STATUS_LABELS[task.status] ?? task.status}
                  </td>
                  <td className="max-w-64 whitespace-pre-wrap px-3 py-4 leading-5">
                    {task.student_note || "—"}
                  </td>
                  <td className="max-w-64 whitespace-pre-wrap px-3 py-4 leading-5">
                    {task.admin_note || "—"}
                  </td>
                  <td className="px-3 py-4 text-[11px] text-[var(--app-muted)]">
                    <p>第 {task.submission_version} 次</p>
                    <LocalDateTime value={task.submitted_at} options={DATE_OPTIONS} />
                  </td>
                  <td className="w-64 px-4 py-3">
                    <VisaTaskReviewControls taskId={task.id} status={task.status} />
                    {task.status !== "submitted" && task.status !== "reviewing" && (
                      <p className="border border-[var(--app-border)] bg-[var(--app-soft-bg)] px-3 py-2 text-[11px] leading-5 text-[var(--app-muted)]">
                        {taskStatusMessage(task.status)}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-[var(--app-muted)]">
                    这名学生尚未生成签证任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
