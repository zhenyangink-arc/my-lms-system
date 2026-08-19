import type { PublishedChapterPracticeBlock } from "./types";

export type ListeningChoice = {
  value: string;
  label: string;
};

export type ListeningQuestion = {
  id: string;
  type: string;
  prompt: string;
  hint: string;
  stimulus: string;
  audioUrl: string;
  options: ListeningChoice[];
};

export type ListeningMaterial = {
  audioStatus: string;
  audioUrl: string;
  objectives: string[];
  transcript: string;
  questions: ListeningQuestion[];
};

type JsonRecord = Record<string, unknown>;

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = objectValue(value);
  for (const key of ["zh-CN", "zh", "ko-KR", "ko", "text", "label"]) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }
  return "";
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean);
  const text = textValue(value);
  if (text) return [text];
  return Object.values(objectValue(value)).map(textValue).filter(Boolean);
}

function audioUrl(value: unknown): string {
  const record = objectValue(value);
  for (const key of ["audioUrl", "audioURL", "audio_url", "url", "src"]) {
    const candidate = textValue(record[key]);
    if (/^(https?:\/\/|\/)/.test(candidate)) return candidate;
  }
  for (const nested of ["audio", "media", "source"]) {
    const nestedValue = record[nested];
    if (!nestedValue || typeof nestedValue !== "object") continue;
    const candidate = audioUrl(nestedValue);
    if (candidate) return candidate;
  }
  return "";
}

function parseQuestions(value: unknown): ListeningQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const question = objectValue(item);
    const content = objectValue(question.content);
    const prompt = textValue(question.prompt);
    if (!prompt) return [];
    const options = Array.isArray(content.options)
      ? content.options.flatMap((item) => {
          const option = objectValue(item);
          const label = textValue(option.label);
          const value = textValue(option.value);
          return label && value ? [{ label, value }] : [];
        })
      : [];
    return [
      {
        id: textValue(question.id) || String(index),
        type: textValue(question.type),
        prompt,
        hint: textValue(content.hint),
        stimulus:
          textValue(content.stimulus) || textValue(content.transcript),
        audioUrl: audioUrl(content),
        options,
      },
    ];
  });
}

export function parseListeningMaterial(
  block: PublishedChapterPracticeBlock,
): ListeningMaterial {
  const payload = objectValue(block.contentPayload);
  const exercise = objectValue(payload.exercise);
  const questions = parseQuestions(payload.questions);
  const objectives = [
    ...textList(exercise.focus),
    ...textList(exercise.goal),
    ...textList(payload.description),
  ].filter((item, index, values) => values.indexOf(item) === index);
  const transcriptCandidates = [
    textValue(exercise.transcript),
    textValue(exercise.listeningText),
    textValue(exercise.passage),
    ...questions.map((question) => question.stimulus),
  ].filter(Boolean);

  return {
    audioStatus: textValue(payload.audioStatus),
    audioUrl: audioUrl(exercise) || audioUrl(payload),
    objectives,
    transcript: transcriptCandidates.filter(
      (item, index, values) => values.indexOf(item) === index,
    ).join("\n"),
    questions,
  };
}

export function isTemporaryListeningAudio(material: ListeningMaterial) {
  return (
    !material.audioUrl &&
    !material.questions.some((question) => Boolean(question.audioUrl))
  );
}
