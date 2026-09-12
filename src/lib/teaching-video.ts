/** Authored, pre-rendered teacher media. Object keys are immutable asset identities. */
export const TEACHER_VIDEO_PREFIX = "teacher-video/";
export const VIDEO_TURN_SLOTS = ["task", "question", "operationFeedback", "correctFeedback", "incorrectFeedback"] as const;
export type VideoTurnSlot = typeof VIDEO_TURN_SLOTS[number];
export type TeacherVideoBinding = { objectKey: string; title: string; transcript: string };
export type TeachingVideoConfiguration = {
  mode: "video" | "legacy";
  explanations: Array<TeacherVideoBinding | null>;
  turns: Partial<Record<VideoTurnSlot, TeacherVideoBinding | null>>;
  continuous: boolean;
  taskInExplanation: boolean;
  questionInExplanation: boolean;
};
export type TeacherVideoPlayback = {
  mode: "video";
  objectKey: string | null;
  title: string;
  identity: string;
  status: "ready" | "missing" | "stale" | "text";
  continuous: boolean;
  feedback?: boolean;
};

/** Explicit editor rows preserve paragraph breaks inside a single media segment.
 * Video narration follows its authored language, not the language of the UI. */
export function teachingScriptSegments(script: unknown, configuration: Record<string, unknown> | null, locale = "zh-CN"): string[] {
  const source = record(script);
  const language = normalizeTeachingVideo(configuration?.teacherVideo).mode === "video" ? "zh-CN" : locale;
  const content = String(source[language] ?? source["zh-CN"] ?? "").trim();
  const rows = record(configuration?.scriptSegments)[language];
  if (Array.isArray(rows) && rows.length <= 50 && rows.every((row) => typeof row === "string")
    && rows.join("\n\n").trim() === content) return rows.map((row) => row.trim()).filter(Boolean);
  return content.split(/\n\s*\n/).map((row) => row.trim()).filter(Boolean);
}

/** Only assets the current teaching flow can play must block publication. */
export function activeTeacherVideoBindings(configuration: Record<string, unknown> | null, segmentCount: number, referenceActivityId?: unknown) {
  const video = normalizeTeachingVideo(configuration?.teacherVideo);
  if (video.mode !== "video") return [];
  const taskKind = record(configuration?.studentTask).kind;
  const questionKind = record(configuration?.interaction).kind;
  const hasTask = Boolean(taskKind && taskKind !== "none");
  const hasQuestion = Boolean(referenceActivityId || (questionKind && questionKind !== "none"));
  const bindings = [...video.explanations.slice(0, segmentCount)];
  if (hasTask) {
    if (!video.taskInExplanation) bindings.push(video.turns.task ?? null);
    bindings.push(video.turns.operationFeedback ?? null);
  }
  if (hasQuestion) {
    if (!video.questionInExplanation) bindings.push(video.turns.question ?? null);
    bindings.push(video.turns.correctFeedback ?? null, video.turns.incorrectFeedback ?? null);
  }
  return bindings.filter((binding): binding is TeacherVideoBinding => Boolean(binding));
}

/** Shared authoring checks; object existence is additionally checked on publish. */
export function teachingVideoIssues(input: {
  video: unknown;
  lines: string[];
  hasTask?: boolean;
  hasQuestion?: boolean;
}): Array<{ section: "script" | "interaction"; message: string }> {
  const video = normalizeTeachingVideo(input.video);
  if (video.mode !== "video") return [];
  const issues: Array<{ section: "script" | "interaction"; message: string }> = [];
  if (!input.lines.some((line) => line.trim())) issues.push({ section: "script", message: "请添加讲解片段并绑定视频。" });
  input.lines.forEach((line, index) => {
    if (!line.trim()) return;
    const binding = video.explanations[index];
    if (!binding) issues.push({ section: "script", message: `讲解片段 ${index + 1} 尚未绑定视频。` });
    else if (binding.transcript.trim() !== line.trim()) issues.push({ section: "script", message: `讲解片段 ${index + 1} 台词已修改，请重新核对并绑定视频。` });
  });
  if (input.hasTask && !video.turns.task && !video.taskInExplanation) issues.push({ section: "interaction", message: "请绑定操作要求视频，或标记讲解视频已包含操作要求。" });
  if (input.hasQuestion && !video.turns.question && !video.questionInExplanation) issues.push({ section: "interaction", message: "请绑定提问视频，或标记讲解视频已包含提问。" });
  return issues;
}

export function isTeacherVideoKey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 500
    && value.startsWith(TEACHER_VIDEO_PREFIX) && /\.mp4$/i.test(value)
    && !/[\\\u0000-\u001f?#%]/.test(value)
    && value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeTeacherVideoBinding(value: unknown): TeacherVideoBinding | null {
  const source = record(value);
  if (!isTeacherVideoKey(source.objectKey)) return null;
  return {
    objectKey: source.objectKey,
    title: String(source.title ?? source.objectKey.split("/").at(-1)).slice(0, 100),
    transcript: String(source.transcript ?? "").slice(0, 1600),
  };
}

export function normalizeTeachingVideo(value: unknown): TeachingVideoConfiguration {
  const source = record(value);
  const turns = record(source.turns);
  return {
    mode: source.mode === "video" ? "video" : "legacy",
    explanations: Array.isArray(source.explanations) ? source.explanations.slice(0, 50).map(normalizeTeacherVideoBinding) : [],
    turns: Object.fromEntries(VIDEO_TURN_SLOTS.map((slot) => [slot, normalizeTeacherVideoBinding(turns[slot])])),
    continuous: source.continuous !== false,
    taskInExplanation: source.taskInExplanation === true,
    questionInExplanation: source.questionInExplanation === true,
  };
}

export function teacherVideoBindings(value: unknown) {
  const config = normalizeTeachingVideo(value);
  return [...config.explanations, ...Object.values(config.turns)].filter((binding): binding is TeacherVideoBinding => Boolean(binding));
}

export function teacherVideoForTurn(input: {
  configuration: Record<string, unknown> | null;
  nodeId: string;
  segmentIndex: number;
  phase: string;
  answerCorrect: boolean | null;
  intent: string;
  authoredText?: string;
}): TeacherVideoPlayback | null {
  const config = normalizeTeachingVideo(input.configuration?.teacherVideo);
  if (config.mode !== "video") return null;
  const slot = input.answerCorrect !== null ? input.answerCorrect ? "correctFeedback" : "incorrectFeedback"
    : input.phase === "task_feedback" ? "operationFeedback"
      : input.phase === "question" ? "question" : input.phase === "task" ? "task" : null;
  const isTextResponse = ["hint", "example", "ask", "roleplay"].includes(input.intent);
  const included = (slot === "task" && config.taskInExplanation) || (slot === "question" && config.questionInExplanation);
  const binding = isTextResponse || included ? null : slot ? config.turns[slot] : config.explanations[input.segmentIndex];
  const stale = Boolean(!slot && binding && input.authoredText !== undefined && binding.transcript.trim() !== input.authoredText.trim());
  return {
    mode: "video",
    objectKey: stale ? null : binding?.objectKey ?? null,
    title: binding?.title ?? "教师视频",
    identity: `${input.nodeId}:${slot ?? input.segmentIndex}:${binding?.objectKey ?? "text"}`,
    status: isTextResponse || included || (!binding && input.phase === "task_feedback") ? "text" : stale ? "stale" : binding ? "ready" : "missing",
    continuous: config.continuous && !slot && !isTextResponse,
    feedback: input.phase === "task_feedback",
  };
}
