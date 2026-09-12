export const TEACHER_KIM_POSES = [
  "greeting",
  "explaining",
  "encouraging",
  "pointing-left",
  "repeat-after-me",
  "listening",
  "gentle-correction",
] as const;

export type TeacherKimPose = (typeof TEACHER_KIM_POSES)[number];

export const TEACHER_KIM_POSE_LABELS: Record<TeacherKimPose, string> = {
  greeting: "问候",
  explaining: "讲解",
  encouraging: "鼓励",
  "pointing-left": "指向学习内容",
  "repeat-after-me": "示范跟读",
  listening: "倾听学生",
  "gentle-correction": "温和纠错",
};

export function isTeacherKimPose(value: unknown): value is TeacherKimPose {
  return typeof value === "string" && TEACHER_KIM_POSES.includes(value as TeacherKimPose);
}

export type TeacherKimTeachingMoment = {
  configuredPose: TeacherKimPose;
  teachingPhase: "explanation" | "task" | "task_feedback" | "question";
  classroomShot: "teacher_closeup" | "teacher_blackboard" | "learning_closeup" | "interaction" | "feedback";
  teacherSpeaking: boolean;
  answerCorrect: boolean | null;
  sentence: string;
};

export function teacherKimPoseForTeachingMoment(input: TeacherKimTeachingMoment): TeacherKimPose {
  if (input.teachingPhase === "task_feedback" || input.classroomShot === "feedback") {
    return input.answerCorrect === false ? "gentle-correction" : "encouraging";
  }
  if (input.teachingPhase === "task" || input.classroomShot === "learning_closeup") {
    return "pointing-left";
  }
  if (/跟(?:着)?我(?:读|说)|读一遍|repeat after me|따라\s*(?:읽|말)/iu.test(input.sentence)) {
    return "repeat-after-me";
  }
  if (input.classroomShot === "interaction" && !input.teacherSpeaking) return "listening";
  return input.configuredPose;
}

export type TeacherKimSpeechRhythm = {
  mouthCycleMs: number;
  gestureCycleMs: number;
  emphasis: "soft" | "normal" | "strong";
};

export function teacherKimSpeechRhythmForCue(cueText: string, cueIndex: number): TeacherKimSpeechRhythm {
  const length = Array.from(cueText.trim()).length;
  const strong = /[!?？！]/u.test(cueText);
  const soft = /[,，、。…]/u.test(cueText) || length <= 1;
  const emphasis: TeacherKimSpeechRhythm["emphasis"] = strong ? "strong" : soft ? "soft" : "normal";
  const energy = Math.max(0, Math.min(1, 0.28 + length * 0.1 + (strong ? 0.2 : 0)));
  return {
    mouthCycleMs: Math.round(410 - energy * 180),
    gestureCycleMs: 760 + Math.abs(cueIndex % 3) * 90,
    emphasis,
  };
}

export type TeacherKimSentenceCaption = {
  text: string;
  spokenText: string;
  remainingText: string;
};

export function teacherKimSentenceCaptionForCue(
  fullText: string,
  cue: { charStart: number; charEnd: number },
): TeacherKimSentenceCaption {
  const safeStart = Math.max(0, Math.min(fullText.length, cue.charStart));
  const safeEnd = Math.max(safeStart, Math.min(fullText.length, cue.charEnd));
  let sentenceStart = 0;
  const boundaryPattern = /[。！？!?；;\n]+/gu;
  for (const match of fullText.matchAll(boundaryPattern)) {
    const boundaryEnd = (match.index ?? 0) + match[0].length;
    if (boundaryEnd <= safeStart) sentenceStart = boundaryEnd;
    else break;
  }
  const remaining = fullText.slice(safeStart);
  const nextBoundary = remaining.match(boundaryPattern);
  const sentenceEnd = nextBoundary?.index === undefined
    ? fullText.length
    : safeStart + nextBoundary.index + nextBoundary[0].length;
  const rawSentence = fullText.slice(sentenceStart, sentenceEnd);
  const leadingWhitespaceLength = rawSentence.length - rawSentence.trimStart().length;
  const trailingWhitespaceLength = rawSentence.length - rawSentence.trimEnd().length;
  const visibleStart = sentenceStart + leadingWhitespaceLength;
  const visibleEnd = Math.max(visibleStart, sentenceEnd - trailingWhitespaceLength);
  const spokenEnd = Math.max(visibleStart, Math.min(visibleEnd, safeEnd));
  const text = fullText.slice(visibleStart, visibleEnd);
  const spokenText = fullText.slice(visibleStart, spokenEnd);
  return {
    text,
    spokenText,
    remainingText: fullText.slice(spokenEnd, visibleEnd),
  };
}
