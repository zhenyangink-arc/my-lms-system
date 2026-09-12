import type { DigitalTextbookCourse } from "../features/digital-textbook/api/types";

export type PracticeSnapshotItem = { nodeId: string; kind: "vocabulary" | "grammar"; value: Record<string, unknown> };
export type ChapterPracticeBinding = {
  id: string; chapter_id: string; version_id: string; revision: number;
  is_enabled: boolean; snapshot: PracticeSnapshotItem[]; reviewed_at: string;
};

/** Node identity plus the full ordered values avoids treating an array offset as a stable item ID. */
export function chapterPracticeSnapshot(courses: DigitalTextbookCourse[], chapterId: string): PracticeSnapshotItem[] | null {
  for (const course of courses) for (const lesson of course.lessons) for (const book of lesson.textbooks) {
    const chapter = book.chapters.find(item => item.id === chapterId);
    if (!chapter) continue;
    if (book.status !== "published" || chapter.status !== "published" || chapter.versionStatus !== "published") return null;
    const groups = [
      ...chapter.nodes.map(node => ({ nodeId: node.id, kind: "vocabulary" as const, values: node.vocabulary })),
      ...chapter.grammarNodes.map(node => ({ nodeId: node.id, kind: "grammar" as const, values: node.items })),
    ].sort((a, b) => a.nodeId.localeCompare(b.nodeId) || a.kind.localeCompare(b.kind));
    return groups.flatMap(group => group.values.map(value => ({ nodeId: group.nodeId, kind: group.kind, value: structuredClone(value) as unknown as Record<string, unknown> })));
  }
  return null;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function practiceSnapshotChanged(previous: PracticeSnapshotItem[], current: PracticeSnapshotItem[]) {
  return canonical(previous) !== canonical(current);
}

export function approvedVocabulary(snapshots: PracticeSnapshotItem[][]) {
  const seen = new Set<string>();
  return snapshots.flatMap(snapshot => snapshot.flatMap(item => {
    if (item.kind !== "vocabulary") return [];
    const value = Object.fromEntries(["ko", "zh", "pos", "collocation", "transcription"].map(key => [key, typeof item.value[key] === "string" ? item.value[key] : ""])) as Record<"ko" | "zh" | "pos" | "collocation" | "transcription", string>;
    if (!value.ko && !value.zh) return [];
    const key = canonical(value);
    if (seen.has(key)) return [];
    seen.add(key);
    return [value];
  }));
}
