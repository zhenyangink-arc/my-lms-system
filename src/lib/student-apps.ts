export const STUDENT_APP_SLUGS = [
  "korean",
  "english",
  "math",
  "university",
  "study-abroad",
] as const;

export type StudentAppSlug = (typeof STUDENT_APP_SLUGS)[number];
export type StudentAppKind = "learning" | "service";
export type StudentAppStatus = "active" | "coming_soon" | "hidden";

export type StudentAppDefinition = {
  slug: StudentAppSlug;
  title: string;
  shortTitle: string;
  description: string;
  kind: StudentAppKind;
  status: StudentAppStatus;
  categorySlug: string;
  accent: "emerald" | "sky" | "amber" | "violet" | "rose";
};

export const STUDENT_APP_IDS: Record<StudentAppSlug, string> = {
  korean: "10000000-0000-4000-8000-000000000001",
  english: "10000000-0000-4000-8000-000000000002",
  math: "10000000-0000-4000-8000-000000000003",
  university: "10000000-0000-4000-8000-000000000004",
  "study-abroad": "10000000-0000-4000-8000-000000000005",
};

export const STUDENT_APPS: readonly StudentAppDefinition[] = [
  {
    slug: "korean",
    title: "韩语学习",
    shortTitle: "韩语",
    description: "从韩文字母到综合应用，继续你的韩语学习路线。",
    kind: "learning",
    status: "active",
    categorySlug: "korean",
    accent: "emerald",
  },
  {
    slug: "english",
    title: "英语学习",
    shortTitle: "英语",
    description: "围绕听说读写建立系统化的英语能力。",
    kind: "learning",
    status: "coming_soon",
    categorySlug: "english",
    accent: "sky",
  },
  {
    slug: "math",
    title: "数学学习",
    shortTitle: "数学",
    description: "按知识体系组织课程、练习与阶段测评。",
    kind: "learning",
    status: "coming_soon",
    categorySlug: "math",
    accent: "amber",
  },
  {
    slug: "university",
    title: "大学课程",
    shortTitle: "大学课程",
    description: "进入独立的大学课程与专业学习空间。",
    kind: "learning",
    status: "coming_soon",
    categorySlug: "university",
    accent: "violet",
  },
  {
    slug: "study-abroad",
    title: "留学服务",
    shortTitle: "留学服务",
    description: "管理目标大学、申请材料与签证准备进度。",
    kind: "service",
    status: "active",
    categorySlug: "service",
    accent: "rose",
  },
] as const;

const STUDENT_APP_BY_SLUG = new Map<StudentAppSlug, StudentAppDefinition>(
  STUDENT_APPS.map((app) => [app.slug, app]),
);

export function isStudentAppSlug(value: string): value is StudentAppSlug {
  return STUDENT_APP_SLUGS.includes(value as StudentAppSlug);
}

export function getStudentAppDefinition(slug: StudentAppSlug) {
  return STUDENT_APP_BY_SLUG.get(slug)!;
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value.trim());
}

export function getStudentPortalPath(space: string) {
  return `/${encodePathSegment(space)}`;
}

export function getStudentAppBasePath(
  space: string,
  appSlug: StudentAppSlug,
) {
  return `${getStudentPortalPath(space)}/apps/${appSlug}`;
}

export function getStudentAppCoursesPath(
  space: string,
  appSlug: StudentAppSlug,
) {
  return `${getStudentAppBasePath(space, appSlug)}/courses`;
}

export function getStudentAppPath(
  space: string,
  appSlug: StudentAppSlug,
  suffix = "",
) {
  const basePath = getStudentAppBasePath(space, appSlug);
  if (!suffix) return basePath;

  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${basePath}${normalizedSuffix}`;
}

export function getStudentPortalPathFromWorkspace(workspaceBasePath: string) {
  const appMarker = "/apps/";
  const appMarkerIndex = workspaceBasePath.indexOf(appMarker);
  if (appMarkerIndex >= 0) {
    return workspaceBasePath.slice(0, appMarkerIndex) || "/";
  }

  if (workspaceBasePath.endsWith("/dashboard")) {
    return workspaceBasePath.slice(0, -"/dashboard".length) || "/";
  }

  return "/";
}
