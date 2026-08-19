type JsonRecord = Record<string, unknown>;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as JsonRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

/** A small deterministic, non-cryptographic digest for source-change detection. */
export function createChapterPracticeSourceDigest(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }

  return `${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

export function didChapterPracticeSourcesChange(input: {
  previousSnapshot: JsonRecord;
  currentContentDigest: string;
  currentSourceUpdatedAts: string[];
}): boolean {
  const previousDigest = input.previousSnapshot.contentDigest;
  if (typeof previousDigest === "string" && previousDigest.length > 0) {
    return previousDigest !== input.currentContentDigest;
  }

  const generatedAt = Date.parse(String(input.previousSnapshot.generatedAt ?? ""));
  if (!Number.isFinite(generatedAt)) return true;

  return input.currentSourceUpdatedAts.some((updatedAt) => {
    const timestamp = Date.parse(updatedAt);
    return Number.isFinite(timestamp) && timestamp > generatedAt;
  });
}
