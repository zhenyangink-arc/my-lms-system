export const PRACTICE_SECTIONS = ["course", "skills", "review"] as const;

export type PracticeSection = (typeof PRACTICE_SECTIONS)[number];

export const DEFAULT_PRACTICE_SECTION: PracticeSection = "course";

export function isPracticeSection(value: string | null): value is PracticeSection {
  return PRACTICE_SECTIONS.includes(value as PracticeSection);
}

export function getPracticeSectionFromDashboardPath(
  pathname: string,
): PracticeSection | null {
  const match = pathname.match(
    /^\/dashboard\/practice\/(course|skills|review)(?:\/|$)/,
  );
  const section = match?.[1] ?? null;
  return isPracticeSection(section) ? section : null;
}

export function getPracticeMemoryKey(
  studentId: string,
  studentAppBasePath: string,
) {
  return `student-practice-section-v1:${studentId}:${studentAppBasePath}`;
}

export function getPracticeDashboardPath(section: PracticeSection) {
  return `/dashboard/practice/${section}`;
}

export function getPracticeAppPath(
  studentAppBasePath: string,
  section: PracticeSection,
) {
  return `${studentAppBasePath}/practice/${section}`;
}
