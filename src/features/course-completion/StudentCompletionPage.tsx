import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  CircleX,
  Clock3,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type { CourseCompletionCertificate } from "./types";
import { PrintCertificateButton } from "./PrintCertificateButton";
import {
  completionHrefForSpace,
  type StudentCompletionData,
} from "./student-service";

type Conclusion = "not_met" | "pending" | "eligible" | "issued";

const conclusionContent: Record<
  Conclusion,
  { label: string; title: string; description: string; icon: typeof CircleX }
> = {
  not_met: {
    label: "未满足",
    title: "还有结课要求需要完成",
    description: "先完成下方最重要的一项，系统会在学习记录更新后重新计算资格。",
    icon: CircleX,
  },
  pending: {
    label: "等待批改",
    title: "已提交的内容正在批改",
    description: "你不需要重复提交。老师发布成绩后，系统会自动更新结课资格。",
    icon: Clock3,
  },
  eligible: {
    label: "符合资格",
    title: "你已符合结课资格",
    description: "机构正在审核证书信息。证书颁发后会直接显示在本页。",
    icon: ShieldCheck,
  },
  issued: {
    label: "已颁发",
    title: "你的结课证书已颁发",
    description: "证书当前有效，可在下方查看完整信息并使用独立打印版式打印。",
    icon: Award,
  },
};

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(new Date(value));
}

function formatScore(value: number | null) {
  if (value === null) return "尚未发布";
  return `${Number(value).toFixed(1).replace(/\.0$/, "")} 分`;
}

function certificateStatus(certificate: CourseCompletionCertificate) {
  if (certificate.status === "issued") {
    return certificate.reissued_from_id ? "重新颁发 · 有效" : "证书有效";
  }
  return certificate.status === "reissued" ? "已被新证书替代" : "已撤销";
}

function CertificateDetails({
  certificate,
  institutionName,
}: {
  certificate: CourseCompletionCertificate;
  institutionName: string;
}) {
  const active = certificate.status === "issued";
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{certificate.course_title_snapshot}</h3>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            结课证书
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
            active
              ? "bg-emerald-50 text-emerald-800"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {active ? (
            <CheckCircle2 size={14} aria-hidden="true" />
          ) : certificate.status === "reissued" ? (
            <RefreshCw size={14} aria-hidden="true" />
          ) : (
            <CircleX size={14} aria-hidden="true" />
          )}
          {certificateStatus(certificate)}
        </span>
      </div>
      <dl className="mt-5 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[var(--foreground-muted)]">姓名</dt>
          <dd className="mt-1 break-words font-semibold">
            {certificate.student_name_snapshot}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--foreground-muted)]">颁发机构</dt>
          <dd className="mt-1 break-words font-semibold">{institutionName}</dd>
        </div>
        <div>
          <dt className="text-[var(--foreground-muted)]">颁发日期</dt>
          <dd className="mt-1 font-semibold">{formatDate(certificate.issued_at)}</dd>
        </div>
        <div>
          <dt className="text-[var(--foreground-muted)]">综合成绩</dt>
          <dd className="mt-1 font-semibold tabular-nums">
            {formatScore(certificate.overall_score_snapshot)}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[var(--foreground-muted)]">证书编号</dt>
          <dd className="mt-1 break-all font-mono text-xs font-semibold leading-6">
            {certificate.certificate_number}
          </dd>
        </div>
        {!active ? (
          <div className="sm:col-span-2">
            <dt className="text-[var(--foreground-muted)]">状态变更</dt>
            <dd className="mt-1 leading-6">
              {formatDate(certificate.revoked_at, true)}
              {certificate.revocation_reason
                ? ` · ${certificate.revocation_reason}`
                : ""}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

function CertificatePrintView({
  certificate,
  institutionName,
}: {
  certificate: CourseCompletionCertificate;
  institutionName: string;
}) {
  return (
    <section
      className="completion-print-root"
      aria-label="结课证书打印版"
    >
      <div className="completion-print-certificate">
        <div className="completion-print-mark" aria-hidden="true">
          <Award size={42} strokeWidth={1.5} />
        </div>
        <h1>结课证书</h1>
        <p className="completion-print-lead">兹证明</p>
        <p className="completion-print-name">{certificate.student_name_snapshot}</p>
        <p className="completion-print-copy">
          已完成“{certificate.course_title_snapshot}”规定的学习与考核要求，成绩合格，准予结课。
        </p>
        <dl className="completion-print-meta">
          <div>
            <dt>颁发机构</dt>
            <dd>{institutionName}</dd>
          </div>
          <div>
            <dt>颁发日期</dt>
            <dd>{formatDate(certificate.issued_at)}</dd>
          </div>
          <div>
            <dt>证书编号</dt>
            <dd>{certificate.certificate_number}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export function StudentCompletionPage({
  data,
  space,
  institutionName,
}: {
  data: StudentCompletionData;
  space: string;
  institutionName: string;
}) {
  const activeCertificate = data.certificates.find(
    (certificate) => certificate.status === "issued",
  );
  const evaluation = data.evaluation;
  const conclusion: Conclusion = activeCertificate
    ? "issued"
    : evaluation?.status === "eligible"
      ? "eligible"
      : evaluation?.status === "pending_grading"
        ? "pending"
        : "not_met";
  const conclusionCopy = conclusionContent[conclusion];
  const ConclusionIcon = conclusionCopy.icon;
  const actionableGaps = data.missingRequirements.filter(
    (gap) => gap.status !== "pending_grading" && Boolean(gap.href),
  );
  const firstActionableGap = actionableGaps.findLast(
    (gap) => gap.category === "course",
  ) ?? actionableGaps[0];
  const gradesPath = `/${encodeURIComponent(space)}/apps/korean/grades`;

  return (
    <>
      <main className="completion-screen-page min-w-0 pb-14">
        <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pt-5 sm:px-6 lg:px-8">
          <Link
            href={gradesPath}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--foreground-secondary)] outline-none transition hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            返回成绩
          </Link>

          <section className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--card)] shadow-sm">
            <div className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-7">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">
                <ConclusionIcon size={25} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 py-1 text-sm font-bold text-[var(--primary-hover)]">
                  {conclusionCopy.label}
                </div>
                <h1 className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                  {conclusionCopy.title}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--foreground-secondary)]">
                  {conclusionCopy.description}
                </p>
                {conclusion === "not_met" && firstActionableGap ? (
                  <Link
                    href={completionHrefForSpace(space, firstActionableGap.href!)}
                    className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white outline-none transition hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 sm:w-auto"
                  >
                    下一步：{firstActionableGap.title}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                ) : null}
                {activeCertificate ? (
                  <div className="mt-5">
                    <PrintCertificateButton />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-6">
            <CardTitleWithHint
              title="考试成绩"
              description="期中与期末只采用指定正式试卷已发布的成绩；未发布成绩不会计入结课资格。"
              headingLevel={2}
              titleClassName="text-lg font-bold"
              hintLabel="查看考试成绩说明"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.exams.map((exam) => {
                const hasScore = exam.score !== null && exam.gradeReleased;
                const pending = exam.pendingGrading;
                const StatusIcon = hasScore
                  ? CheckCircle2
                  : pending
                    ? Clock3
                    : CircleX;
                return (
                  <article
                    key={exam.paperCode}
                    className="min-w-0 rounded-2xl border border-[var(--border-subtle)] p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">{exam.title}</h3>
                        <p className="mt-1 break-all font-mono text-xs text-[var(--foreground-muted)]">
                          {exam.paperCode}
                        </p>
                      </div>
                      <StatusIcon
                        size={19}
                        className={
                          hasScore
                            ? "shrink-0 text-emerald-600"
                            : pending
                              ? "shrink-0 text-amber-600"
                              : "shrink-0 text-zinc-500"
                        }
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-4 text-2xl font-bold tabular-nums">
                      {hasScore
                        ? formatScore(exam.score)
                        : pending
                          ? "等待批改"
                          : "暂无成绩"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                      {pending ? "已提交，无需重复提交" : hasScore ? "成绩已发布" : "尚未完成或发布"}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            <section className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-6">
              <CardTitleWithHint
                title="已完成要求"
                description="这些项目来自最近一次结课资格快照，只显示已经满足的要求。"
                headingLevel={2}
                titleClassName="text-lg font-bold"
                hintLabel="查看已完成要求说明"
              />
              {data.completedRequirements.length ? (
                <ul className="mt-4 space-y-2">
                  {data.completedRequirements.map((item) => (
                    <li
                      key={item}
                      className="flex min-w-0 items-start gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-950"
                    >
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 break-words">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl bg-[var(--background-subtle)] px-3 py-4 text-sm leading-6 text-[var(--foreground-muted)]">
                  当前资格快照中还没有可确认的已完成要求。
                </p>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-6">
              <CardTitleWithHint
                title="未完成要求"
                description="每项原因均来自资格计算结果。等待批改的项目不需要重复提交。"
                headingLevel={2}
                titleClassName="text-lg font-bold"
                hintLabel="查看未完成要求说明"
              />
              {data.missingRequirements.length ? (
                <ul className="mt-4 space-y-3">
                  {data.missingRequirements.map((gap) => {
                    const pending = gap.status === "pending_grading";
                    const StatusIcon = pending ? Clock3 : CircleX;
                    const statusLabel = pending
                      ? "等待批改"
                      : gap.status === "failed"
                        ? "未通过"
                        : gap.status === "in_progress"
                          ? "进行中"
                          : "未完成";
                    return (
                      <li
                        key={gap.key}
                        className="min-w-0 rounded-xl border border-[var(--border-subtle)] p-3"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon
                            size={18}
                            className={`mt-0.5 shrink-0 ${pending ? "text-amber-600" : "text-rose-600"}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="min-w-0 break-words text-sm font-semibold">
                                {gap.title}
                              </p>
                              <span
                                className={`text-xs font-semibold ${pending ? "text-amber-800" : "text-rose-700"}`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground-secondary)]">
                              {gap.reason}
                            </p>
                            {pending ? (
                              <p className="mt-2 text-sm font-semibold text-amber-800">
                                已提交，无需重复提交
                              </p>
                            ) : gap.href ? (
                              <Link
                                href={completionHrefForSpace(space, gap.href)}
                                className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[var(--primary)] outline-none transition hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                              >
                                去完成
                                <ArrowRight size={15} aria-hidden="true" />
                              </Link>
                            ) : gap.status === "failed" &&
                              ["chapter_exam", "stage_exam", "midterm_exam", "final_exam"].includes(gap.category) ? (
                              <p className="mt-2 text-sm font-semibold text-[var(--foreground-secondary)]">
                                老师将根据本次成绩布置补考，无需重复进入原考试。
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-4 text-sm font-semibold text-emerald-900">
                  <FileCheck2 size={18} aria-hidden="true" />
                  当前没有未完成要求。
                </p>
              )}
            </section>
          </div>

          <section className="min-w-0 space-y-3">
            <CardTitleWithHint
              title="结课证书"
              description="证书信息固定为颁发时快照；已撤销或被替代的旧证书会保留状态记录。"
              headingLevel={2}
              titleClassName="text-lg font-bold"
              hintLabel="查看结课证书说明"
            />
            {data.certificates.length ? (
              <div className="space-y-3">
                {data.certificates.map((certificate) => (
                  <CertificateDetails
                    key={certificate.id}
                    certificate={certificate}
                    institutionName={institutionName}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--card)] px-4 py-8 text-center">
                <Award
                  size={24}
                  className="mx-auto text-[var(--foreground-muted)]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold">尚未颁发证书</p>
                <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                  符合资格并通过机构审核后，证书会显示在这里。
                </p>
              </div>
            )}
          </section>

          {evaluation ? (
            <p className="text-center text-xs leading-5 text-[var(--foreground-muted)]">
              最近计算：{formatDate(evaluation.evaluated_at, true)} · {data.courseTitle}
            </p>
          ) : null}
        </div>
      </main>

      {activeCertificate ? (
        <CertificatePrintView
          certificate={activeCertificate}
          institutionName={institutionName}
        />
      ) : null}
    </>
  );
}
