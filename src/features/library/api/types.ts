import type {
  LibraryCategory,
  LibraryResourceType,
  LibraryStatus,
} from "@/app/dashboard/library/config";

export type LibraryManagementScope = "platform" | "institution";

export type LibraryRawCourse = {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  is_published: boolean;
};

export type LibraryCourseCategory = {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number;
  is_published: boolean;
};

export type LibraryRawLesson = {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  sort_order: number;
  is_published: boolean;
};

export type LibraryCourseOption = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  title: string;
  slug: string;
};

export type LibraryCourseRow = LibraryCourseOption & {
  sort_order: number;
  is_published: boolean;
  category_label: string;
  group_title: string;
  group_order: number;
  category_order: number;
};

export type LibraryResourceRow = {
  id: string;
  course_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string;
  category: LibraryCategory;
  resource_type: LibraryResourceType;
  original_file_name: string | null;
  file_size: number | null;
  status: LibraryStatus;
  is_featured: boolean;
  sort_order: number;
  download_count: number;
  updated_at: string;
};

export type LibraryManagementResult = {
  scope: LibraryManagementScope;
  role: string;
  canCurate: boolean;
  courses: LibraryCourseRow[];
  resources: LibraryResourceRow[];
  hasError: boolean;
};
