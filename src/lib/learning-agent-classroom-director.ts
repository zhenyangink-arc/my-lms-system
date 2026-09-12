export const CLASSROOM_SHOT_MODES = [
  "teacher_closeup",
  "teacher_blackboard",
  "learning_closeup",
  "interaction",
  "feedback",
] as const;

export type ClassroomShotMode = (typeof CLASSROOM_SHOT_MODES)[number];
export type ClassroomShotPreference = "auto" | ClassroomShotMode;
export type ClassroomTeachingPhase = "explanation" | "task" | "task_feedback" | "question";

export function classroomResponsePhaseForTurn(input: {
  activePhase: ClassroomTeachingPhase;
  intent: "start" | "hint" | "example" | "ready" | "answer";
  answerCorrect: boolean | null;
}): ClassroomTeachingPhase {
  return input.intent === "answer" && input.answerCorrect !== null
    ? "task_feedback"
    : input.activePhase;
}

export function isClassroomShotMode(value: unknown): value is ClassroomShotMode {
  return typeof value === "string" && CLASSROOM_SHOT_MODES.includes(value as ClassroomShotMode);
}

export function defaultClassroomShotForTurn(input: {
  phase: ClassroomTeachingPhase;
  hasTeachingDisplay: boolean;
}): ClassroomShotMode {
  if (input.phase === "task_feedback") return "feedback";
  if (input.phase === "question") return "interaction";
  if (input.phase === "task") return "learning_closeup";
  return input.hasTeachingDisplay ? "teacher_blackboard" : "teacher_closeup";
}

export function classroomShotForScriptSegment(
  configuration: Record<string, unknown> | null,
  segmentIndex: number,
  fallback: Parameters<typeof defaultClassroomShotForTurn>[0],
): ClassroomShotMode {
  // Correct/incorrect and operation-complete feedback is generated after the
  // authored line has finished. A manual shot on that line must not leave the
  // feedback stranded in the student-interaction view.
  if (fallback.phase === "task_feedback") return "feedback";
  const performances = Array.isArray(configuration?.scriptPerformances)
    ? configuration.scriptPerformances
    : [];
  const value = performances[segmentIndex];
  const performance = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
  return isClassroomShotMode(performance?.classroomShot)
    ? performance.classroomShot
    : defaultClassroomShotForTurn(fallback);
}
