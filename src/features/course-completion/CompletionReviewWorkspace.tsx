"use client";

import { useActionState, useId, useState } from "react";
import {
  Award,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  issueCompletionCertificateAction,
  configureCompletionRetakeAction,
  reissueCompletionCertificateAction,
  revokeCompletionCertificateAction,
} from "./review-actions";
import {
  initialCompletionCertificateActionState,
  type CompletionReviewCertificate,
  type CompletionReviewData,
  type CompletionReviewEvaluation,
  type CompletionRetakePaper,
} from "./review-types";

type ReviewTab = "eligible" | "notEligible" | "issued" | "revoked";

const tabDefinitions: Array<{
  key: ReviewTab;
  label: string;
  icon: typeof ClipboardCheck;
}> = [
  { key: "eligible", label: "待审核", icon: ClipboardCheck },
  { key: "notEligible", label: "未达标", icon: ShieldAlert },
  { key: "issued", label: "已颁发", icon: Award },
  { key: "revoked", label: "已撤销", icon: Ban },
];

const evaluationStatusLabels = {
  not_ready: "条件未齐",
  pending_grading: "等待批改",
  not_eligible: "未达标",
  eligible: "符合资格",
} as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function localDateTimeValue(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function RetakeDialog({
  evaluation,
  papers,
  paperIdByAssignmentId,
  space,
  appSlug,
}: {
  evaluation: CompletionReviewEvaluation;
  papers: CompletionRetakePaper[];
  paperIdByAssignmentId: Record<string, string>;
  space: string;
  appSlug: string;
}) {
  const fieldBase = useId();
  const failedExams = evaluation.missingRequirements.filter(
    (gap) =>
      gap.status === "failed" &&
      Boolean(gap.sourceId) &&
      ["chapter_exam", "stage_exam", "midterm_exam", "final_exam"].includes(gap.category),
  );
  const action = configureCompletionRetakeAction.bind(
    null,
    space,
    appSlug,
    evaluation.id,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialCompletionCertificateActionState,
  );
  const now = new Date();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState(
    failedExams[0]?.sourceId ?? "",
  );
  const originalPaperId = paperIdByAssignmentId[selectedAssignmentId] ?? "";
  const [selectedPaperId, setSelectedPaperId] = useState(originalPaperId);

  if (failedExams.length === 0) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white outline-none transition hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2">
        <RotateCcw size={16} aria-hidden="true" />
        发起补考
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>为{evaluation.studentName}发起补考</AlertDialogTitle>
          <AlertDialogDescription>
            补考会追加到未通过的原考试，并沿用现有考试提交、批改和资格重算流程。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-4">
          <label htmlFor={`${fieldBase}-assignment`} className="block text-sm font-semibold">
            未通过考试
          </label>
          <select
            id={`${fieldBase}-assignment`}
            name="assignment_id"
            required
            value={selectedAssignmentId}
            onChange={(event) => {
              const assignmentId = event.target.value;
              setSelectedAssignmentId(assignmentId);
              setSelectedPaperId(paperIdByAssignmentId[assignmentId] ?? "");
            }}
            className="app-input min-h-11 w-full rounded-xl border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            {failedExams.map((gap) => (
              <option key={gap.key} value={gap.sourceId}>{gap.title}</option>
            ))}
          </select>

          <label htmlFor={`${fieldBase}-paper`} className="block text-sm font-semibold">
            补考卷
          </label>
          <select
            id={`${fieldBase}-paper`}
            name="retake_paper_id"
            required
            value={selectedPaperId}
            onChange={(event) => setSelectedPaperId(event.target.value)}
            className="app-input min-h-11 w-full rounded-xl border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="">请选择已发布的合法补考卷</option>
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.paperCode} · {paper.title}
                {paper.id === originalPaperId ? "（原考试卷）" : ""}
              </option>
            ))}
          </select>

          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor={`${fieldBase}-starts`} className="text-sm font-semibold">
              补考开始时间
              <input
                id={`${fieldBase}-starts`}
                name="retake_starts_at"
                type="datetime-local"
                required
                defaultValue={localDateTimeValue(new Date(now.getTime() + 24 * 60 * 60 * 1000))}
                className="app-input mt-2 min-h-11 w-full rounded-xl border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </label>
            <label htmlFor={`${fieldBase}-due`} className="text-sm font-semibold">
              补考截止时间
              <input
                id={`${fieldBase}-due`}
                name="retake_due_at"
                type="datetime-local"
                required
                defaultValue={localDateTimeValue(new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000))}
                className="app-input mt-2 min-h-11 w-full rounded-xl border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
              />
            </label>
          </div>

          <label htmlFor={`${fieldBase}-policy`} className="block text-sm font-semibold">
            成绩采用规则
          </label>
          <select
            id={`${fieldBase}-policy`}
            name="retake_score_policy"
            defaultValue="highest"
            className="app-input min-h-11 w-full rounded-xl border px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <option value="highest">首次与补考取最高分</option>
            <option value="latest">采用补考最新分</option>
            <option value="weighted">首次成绩 50% + 补考成绩 50%</option>
          </select>
          <input type="hidden" name="retake_original_weight_percent" value="50" />
          <ActionMessage state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">取消</AlertDialogCancel>
            <button
              type="submit"
              disabled={pending || !selectedPaperId}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "发起中…" : selectedPaperId ? "确认发起补考" : "请选择补考卷"}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Score({ value }: { value: number | null }) {
  return (
    <span className="tabular-nums">
      {value === null ? "暂无综合成绩" : `综合成绩 ${Number(value).toFixed(1)} 分`}
    </span>
  );
}

function ActionMessage({
  state,
}: {
  state: typeof initialCompletionCertificateActionState;
}) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-sm leading-6 ${
        state.status === "error"
          ? "bg-red-50 text-red-700"
          : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.message}
    </p>
  );
}

function IssueCertificateDialog({
  evaluation,
  space,
  appSlug,
}: {
  evaluation: CompletionReviewEvaluation;
  space: string;
  appSlug: string;
}) {
  const action = issueCompletionCertificateAction.bind(
    null,
    space,
    appSlug,
    evaluation.id,
  );
  const [state, formAction, pending] = useActionState(
    action,
    initialCompletionCertificateActionState,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white outline-none transition hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2">
        <Award size={16} aria-hidden="true" />
        颁发证书
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认颁发结课证书？</AlertDialogTitle>
          <AlertDialogDescription>
            将按当前资格快照为{evaluation.studentName}颁发“{evaluation.courseTitle}”结课证书。证书内容颁发后不会随学习数据变化。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-4">
          <ActionMessage state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">取消</AlertDialogCancel>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--control-radius)] bg-[var(--primary)] px-4 text-sm font-semibold text-white outline-none hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "颁发中…" : "确认颁发"}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReasonActionDialog({
  certificate,
  mode,
  space,
  appSlug,
}: {
  certificate: CompletionReviewCertificate;
  mode: "revoke" | "reissue";
  space: string;
  appSlug: string;
}) {
  const fieldId = useId();
  const canReissue = Boolean(certificate.replacementEvaluationId);
  const action = mode === "revoke"
    ? revokeCompletionCertificateAction.bind(null, space, appSlug, certificate.id)
    : reissueCompletionCertificateAction.bind(
        null,
        space,
        appSlug,
        certificate.id,
        certificate.replacementEvaluationId ?? "",
      );
  const [state, formAction, pending] = useActionState(
    action,
    initialCompletionCertificateActionState,
  );
  const isReissue = mode === "reissue";
  const Icon = isReissue ? RefreshCw : Ban;

  if (isReissue && !canReissue) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
        当前没有同一学生、同一课程的有效资格快照，暂不能重新颁发。
      </p>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 ${
        isReissue
          ? "border-[var(--primary)] text-[var(--primary-hover)] hover:bg-[var(--accent)] focus-visible:ring-[var(--primary)]"
          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500"
      }`}>
        <Icon size={16} aria-hidden="true" />
        {isReissue ? "重新颁发" : "撤销证书"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isReissue ? "重新颁发证书" : "撤销当前证书"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isReissue
              ? "系统会使用当前有效资格快照生成新证书，并保留原证书及本次原因作为审核记录。"
              : "撤销后证书立即失效，但记录会继续保留。重新颁发前仍需再次确认学生符合资格。"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-4">
          <label htmlFor={fieldId} className="block text-sm font-semibold">
            {isReissue ? "重新颁发原因" : "撤销原因"}
          </label>
          <textarea
            id={fieldId}
            name="reason"
            required
            minLength={2}
            maxLength={1000}
            rows={4}
            aria-describedby={`${fieldId}-help`}
            className="app-input min-h-28 w-full resize-y rounded-xl border px-3 py-2.5 text-base leading-6 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder={isReissue ? "例如：学生姓名更正后重新颁发" : "请说明撤销依据"}
          />
          <p id={`${fieldId}-help`} className="text-xs leading-5 text-[var(--foreground-muted)]">
            请填写 2 至 1000 字，原因会进入证书审核记录。
          </p>
          <ActionMessage state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">取消</AlertDialogCancel>
            <button
              type="submit"
              disabled={pending}
              className={`inline-flex min-h-11 items-center justify-center rounded-[var(--control-radius)] px-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                isReissue
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus-visible:ring-[var(--primary)]"
                  : "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
              }`}
            >
              {pending
                ? isReissue
                  ? "重新颁发中…"
                  : "撤销中…"
                : isReissue
                  ? "确认重新颁发"
                  : "确认撤销"}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EvaluationDetail({ evaluation }: { evaluation: CompletionReviewEvaluation }) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-semibold outline-none transition hover:bg-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2">
        <FileSearch size={16} aria-hidden="true" />
        查看资格明细
      </SheetTrigger>
      <SheetContent className="w-full max-w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>资格明细</SheetTitle>
          <SheetDescription>
            {evaluation.studentName} · {evaluation.courseTitle} · 计算于 {formatDate(evaluation.evaluatedAt)}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <section aria-labelledby={`${evaluation.id}-completed`}>
            <h3 id={`${evaluation.id}-completed`} className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 size={17} className="text-emerald-600" aria-hidden="true" />
              已完成项目
            </h3>
            {evaluation.completedItems.length ? (
              <ul className="mt-3 space-y-2">
                {evaluation.completedItems.map((item) => (
                  <li key={item} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-900">
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-600">
                当前快照中尚无可归纳的完成项目。
              </p>
            )}
          </section>
          <section aria-labelledby={`${evaluation.id}-missing`}>
            <h3 id={`${evaluation.id}-missing`} className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert size={17} className="text-amber-600" aria-hidden="true" />
              未达标项目
            </h3>
            {evaluation.missingRequirements.length ? (
              <ul className="mt-3 space-y-3">
                {evaluation.missingRequirements.map((gap) => (
                  <li key={gap.key} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <p className="text-sm font-semibold text-amber-950">{gap.title}</p>
                    <p className="mt-1 text-sm leading-6 text-amber-900">{gap.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-900">
                当前资格快照没有未达标项目。
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EvaluationCard({
  evaluation,
  eligible,
  space,
  appSlug,
  retakePapers,
  retakePaperIdByAssignmentId,
  canManageCertificates,
}: {
  evaluation: CompletionReviewEvaluation;
  eligible: boolean;
  space: string;
  appSlug: string;
  retakePapers: CompletionRetakePaper[];
  retakePaperIdByAssignmentId: Record<string, string>;
  canManageCertificates: boolean;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{evaluation.studentName}</h3>
          <p className="mt-1 break-words text-sm text-[var(--foreground-muted)]">{evaluation.courseTitle}</p>
        </div>
        <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          eligible ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
        }`}>
          {evaluationStatusLabels[evaluation.status]}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--foreground-secondary)]">
        <Score value={evaluation.overallScore} />
        <span>资格计算：{formatDate(evaluation.evaluatedAt)}</span>
      </div>
      {!eligible && (
        <ul className="mt-4 space-y-2" aria-label="缺口摘要">
          {evaluation.missingRequirements.slice(0, 3).map((gap) => (
            <li key={gap.key} className="flex gap-2 text-sm leading-6 text-amber-900">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              <span>{gap.reason}</span>
            </li>
          ))}
          {evaluation.missingRequirements.length > 3 && (
            <li className="text-sm text-[var(--foreground-muted)]">
              另有 {evaluation.missingRequirements.length - 3} 项，请在资格明细中查看。
            </li>
          )}
        </ul>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <EvaluationDetail evaluation={evaluation} />
        {!eligible && (
          <RetakeDialog
            evaluation={evaluation}
            papers={retakePapers}
            paperIdByAssignmentId={retakePaperIdByAssignmentId}
            space={space}
            appSlug={appSlug}
          />
        )}
        {eligible && canManageCertificates && (
          <IssueCertificateDialog evaluation={evaluation} space={space} appSlug={appSlug} />
        )}
      </div>
    </article>
  );
}

function CertificateCard({
  certificate,
  space,
  appSlug,
}: {
  certificate: CompletionReviewCertificate;
  space: string;
  appSlug: string;
}) {
  const active = certificate.status === "issued";
  return (
    <article className="min-w-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold">{certificate.studentName}</h3>
          <p className="mt-1 break-words text-sm text-[var(--foreground-muted)]">{certificate.courseTitle}</p>
        </div>
        <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          active ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
        }`}>
          {active ? "证书有效" : certificate.status === "reissued" ? "已被新证书替代" : "已撤销"}
        </span>
      </div>
      <dl className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-[var(--foreground-muted)]">证书编号</dt>
          <dd className="mt-1 overflow-wrap-anywhere break-words font-mono text-xs leading-5">{certificate.certificateNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--foreground-muted)]">颁发时间</dt>
          <dd className="mt-1">{formatDate(certificate.issuedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--foreground-muted)]">综合成绩</dt>
          <dd className="mt-1"><Score value={certificate.overallScore} /></dd>
        </div>
        {!active && (
          <div>
            <dt className="text-xs text-[var(--foreground-muted)]">撤销时间</dt>
            <dd className="mt-1">{formatDate(certificate.revokedAt)}</dd>
          </div>
        )}
      </dl>
      {certificate.revocationReason && (
        <div className="mt-4 rounded-xl bg-zinc-50 px-3 py-3 text-sm leading-6 text-zinc-700">
          <span className="font-semibold">撤销原因：</span>{certificate.revocationReason}
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {active ? (
          <ReasonActionDialog certificate={certificate} mode="revoke" space={space} appSlug={appSlug} />
        ) : certificate.status === "revoked" ? (
          <ReasonActionDialog certificate={certificate} mode="reissue" space={space} appSlug={appSlug} />
        ) : null}
      </div>
    </article>
  );
}

function EmptyState({ tab }: { tab: ReviewTab }) {
  const messages: Record<ReviewTab, string> = {
    eligible: "目前没有等待审核的学生。",
    notEligible: "目前没有未达标的资格记录。",
    issued: "目前还没有已颁发证书。",
    revoked: "目前没有已撤销证书。",
  };
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] px-4 py-10 text-center text-sm text-[var(--foreground-muted)]">
      {messages[tab]}
    </div>
  );
}

export function CompletionReviewWorkspace({
  data,
  space,
  appSlug,
  canManageCertificates = true,
}: {
  data: CompletionReviewData;
  space: string;
  appSlug: string;
  canManageCertificates?: boolean;
}) {
  const availableTabs = canManageCertificates
    ? tabDefinitions
    : tabDefinitions.filter((tab) => tab.key === "eligible" || tab.key === "notEligible");
  const [activeTab, setActiveTab] = useState<ReviewTab>(
    canManageCertificates ? "eligible" : "notEligible",
  );
  const counts: Record<ReviewTab, number> = {
    eligible: data.eligible.length,
    notEligible: data.notEligible.length,
    issued: data.issued.length,
    revoked: data.revoked.length,
  };
  const activeItems = data[activeTab];

  return (
    <div className="min-w-0 space-y-5">
      <div
        role="tablist"
        aria-label="结课审核状态"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card)] p-2 sm:grid-cols-4"
      >
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`completion-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`completion-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = availableTabs.findIndex((item) => item.key === tab.key);
                const nextIndex = event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? availableTabs.length - 1
                    : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + availableTabs.length) % availableTabs.length;
                const nextKey = availableTabs[nextIndex].key;
                setActiveTab(nextKey);
                document.getElementById(`completion-tab-${nextKey}`)?.focus();
              }}
              className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ${
                selected
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--foreground-secondary)] hover:bg-[var(--accent)]"
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{tab.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                selected ? "bg-white/20" : "bg-[var(--accent)]"
              }`} aria-label={`${counts[tab.key]} 条`}>
                {counts[tab.key]}
              </span>
            </button>
          );
        })}
      </div>

      <section
        id={`completion-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`completion-tab-${activeTab}`}
        className="min-w-0"
      >
        <div className="mb-4">
          <CardTitleWithHint
            headingLevel={2}
            title={tabDefinitions.find((tab) => tab.key === activeTab)?.label}
            titleClassName="text-lg font-semibold"
            description={
              activeTab === "eligible"
                ? "只显示当前资格为符合条件且尚未生成证书的记录。"
                : activeTab === "notEligible"
                  ? "包含条件未齐、等待批改和成绩未达标的当前资格记录。"
                  : activeTab === "issued"
                    ? "显示当前有效证书；撤销后会立即移入已撤销列表。"
                    : "保留撤销原因与被替代记录；重新颁发仍需有效资格快照。"
            }
          />
        </div>
        {activeItems.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {activeTab === "eligible" || activeTab === "notEligible"
              ? (activeItems as CompletionReviewEvaluation[]).map((evaluation) => (
                  <EvaluationCard
                    key={evaluation.id}
                    evaluation={evaluation}
                    eligible={activeTab === "eligible"}
                    space={space}
                    appSlug={appSlug}
                    retakePapers={data.retakePapers}
                    retakePaperIdByAssignmentId={data.retakePaperIdByAssignmentId}
                    canManageCertificates={canManageCertificates}
                  />
                ))
              : (activeItems as CompletionReviewCertificate[]).map((certificate) => (
                  <CertificateCard
                    key={certificate.id}
                    certificate={certificate}
                    space={space}
                    appSlug={appSlug}
                  />
                ))}
          </div>
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        当前显示{tabDefinitions.find((tab) => tab.key === activeTab)?.label}，共 {counts[activeTab]} 条。
      </p>
    </div>
  );
}
