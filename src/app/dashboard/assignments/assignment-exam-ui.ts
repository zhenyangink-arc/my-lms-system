export type ExamQuestionStatus = "answered" | "unanswered" | "review";

export function getExamQuestionStatus(
  answer: string | undefined,
  markedForReview: boolean,
): ExamQuestionStatus {
  if (markedForReview) return "review";
  return answer?.trim() ? "answered" : "unanswered";
}

export function getExamRemainingSeconds({
  startedAt,
  durationMinutes,
  now,
  dueAt,
  expiresAt,
}: {
  startedAt: string;
  durationMinutes: number;
  now: number;
  dueAt?: string | null;
  expiresAt?: string | null;
}) {
  const startedAtMs = new Date(startedAt).getTime();
  const durationEndMs = startedAtMs + durationMinutes * 60_000;
  const dueAtMs = dueAt ? new Date(dueAt).getTime() : Number.POSITIVE_INFINITY;
  const serverExpiresAtMs = expiresAt
    ? new Date(expiresAt).getTime()
    : Number.POSITIVE_INFINITY;
  const endAtMs = Math.min(durationEndMs, dueAtMs, serverExpiresAtMs);

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endAtMs)) return 0;
  return Math.max(0, Math.ceil((endAtMs - now) / 1000));
}

export function getSubmissionConfirmationStage(unansweredCount: number) {
  return unansweredCount > 0 ? "unanswered" : "final";
}

export function formatExamRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
