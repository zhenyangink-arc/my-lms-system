import {
  BookOpen,
  FileText,
  Flag,
  Folder,
  GraduationCap,
  Headphones,
  Languages,
  Layers3,
  MessageCircle,
  PenLine,
  Star,
  Target,
  type LucideIcon,
} from "lucide-react";

import {
  COURSE_ACCENT_COLOR_MAP,
  type CourseAccentColor,
} from "@/lib/course-colors";
import type {
  CourseCatalogChapter,
  CourseCatalogCourse,
  CourseCatalogLesson,
  CourseCatalogNode,
  CourseCatalogNodeKind,
  CourseCategory,
} from "../../api/types";

export type CourseCatalogFolderRow = {
  key: string;
  id: string;
  kind: CourseCatalogNodeKind;
  kindLabel: string;
  title: string;
  slug: string;
  contentLabel: string;
  unlockMode: string;
  isPublished: boolean;
  isLocked: boolean;
  sortOrder: number;
  completeness: number;
  missingItems: string[];
  node: CourseCatalogNode;
  canOpen: boolean;
};

export const KIND_DEFAULT_ICON: Record<CourseCatalogNodeKind, LucideIcon> = {
  category: Folder,
  course: BookOpen,
  lesson: Layers3,
  chapter: FileText,
};

const KIND_DEFAULT_ACCENT: Record<CourseCatalogNodeKind, string> = {
  category: "indigo",
  course: "blue",
  lesson: "purple",
  chapter: "emerald",
};

// Every icon_name value is listed in both its stored casing and lower-kebab
// form, so lookups stay a plain object index with no normalization call —
// the react-hooks/static-components rule can't verify a function call
// selects a stable component, so the map itself has to absorb the variants.
export const ICON_NAME_MAP: Record<string, LucideIcon> = {
  folder: Folder,
  Folder: Folder,
  "book-open": BookOpen,
  "Book Open": BookOpen,
  BookOpen: BookOpen,
  languages: Languages,
  Languages: Languages,
  language: Languages,
  Language: Languages,
  "graduation-cap": GraduationCap,
  GraduationCap: GraduationCap,
  star: Star,
  Star: Star,
  flag: Flag,
  Flag: Flag,
  headphones: Headphones,
  Headphones: Headphones,
  pencil: PenLine,
  Pencil: PenLine,
  "pen-line": PenLine,
  target: Target,
  Target: Target,
  "message-circle": MessageCircle,
  MessageCircle: MessageCircle,
  "file-text": FileText,
  FileText: FileText,
  layers: Layers3,
  Layers: Layers3,
  layers3: Layers3,
};

export function resolveAccent(row: CourseCatalogFolderRow): CourseAccentColor {
  const explicit =
    row.kind === "category" ? (row.node as CourseCategory).accent_color : null;
  const key =
    explicit && COURSE_ACCENT_COLOR_MAP[explicit]
      ? explicit
      : KIND_DEFAULT_ACCENT[row.kind];
  return COURSE_ACCENT_COLOR_MAP[key] ?? COURSE_ACCENT_COLOR_MAP.blue;
}

export function resolveCoverObjectKey(row: CourseCatalogFolderRow): string | null {
  const node = row.node as
    | CourseCategory
    | CourseCatalogCourse
    | CourseCatalogLesson
    | CourseCatalogChapter;
  return node.cover_object_key ?? null;
}

export type StatusTone = "success" | "warning" | "inactive";

export const STATUS_TONE_VAR: Record<StatusTone, string> = {
  success: "var(--status-success)",
  warning: "var(--status-warning)",
  inactive: "var(--status-inactive)",
};

export function getStatusInfo(row: CourseCatalogFolderRow): {
  tone: StatusTone;
  label: string;
} {
  if (row.isLocked) return { tone: "inactive", label: "已锁定" };
  if (row.isPublished) return { tone: "success", label: "已上架" };
  return { tone: "warning", label: "未上架" };
}
