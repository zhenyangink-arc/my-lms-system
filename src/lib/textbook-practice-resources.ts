import type { DigitalTextbookCourse, DigitalTextbookVocabularyWord, DigitalTextbookGrammarItem } from "../features/digital-textbook/api/types";

type Origin = { key: string; chapterId: string; versionId: string; origin: string };
export type TextbookPracticeResource = Origin & (
  | { kind: "vocabulary"; value: DigitalTextbookVocabularyWord }
  | { kind: "grammar"; value: DigitalTextbookGrammarItem }
);

/** Read-only catalog. Never infer bindings for historical independent copies. */
export function textbookPracticeResources(courses: DigitalTextbookCourse[]): TextbookPracticeResource[] {
  const resources: TextbookPracticeResource[] = [];
  for (const course of courses) for (const lesson of course.lessons) for (const textbook of lesson.textbooks) {
    if (textbook.status !== "published") continue;
    for (const chapter of textbook.chapters) {
      if (chapter.status !== "published" || chapter.versionStatus !== "published") continue;
      const origin = `${course.title} › ${lesson.title} › ${textbook.title} › 第 ${chapter.number} 章 · 版本 ${chapter.versionNumber}`;
      const base = { chapterId: chapter.id, versionId: chapter.versionId, origin };
      for (const node of chapter.nodes) node.vocabulary.forEach((value, index) => {
        if (value.ko || value.zh) resources.push({ ...base, key: `${chapter.id}:${node.id}:vocabulary:${index}`, kind: "vocabulary", value: structuredClone(value) });
      });
      for (const node of chapter.grammarNodes) node.items.forEach((value, index) => {
        if (value.title) resources.push({ ...base, key: `${chapter.id}:${node.id}:grammar:${index}`, kind: "grammar", value: structuredClone(value) });
      });
    }
  }
  return resources;
}

const text = (value: unknown) => typeof value === "string" ? value.trim().normalize("NFC") : "";
export function vocabularyResourceKey(value: DigitalTextbookVocabularyWord) {
  return JSON.stringify([value.ko, value.zh, value.pos, value.collocation, value.transcription].map(text));
}
export function grammarResourceKey(value: DigitalTextbookGrammarItem) {
  return JSON.stringify([
    text(value.title), text(value.meaning), text(value.caution),
    (value.cases ?? []).map(row => [text(row.batchim), text(row.conjugation)]),
    (value.rows ?? []).map(row => [text(row.form), text(row.combination), text(row.audio)]),
    (value.examples ?? []).map(row => [text(row.ko), text(row.zh), text(row.audio)]),
  ]);
}
