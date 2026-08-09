export type CourseCatalogNodeKind =
  | "category"
  | "course"
  | "lesson"
  | "chapter";

export type CourseCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  icon_name: string | null;
  accent_color: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  content_scope: string;
};

export type CourseCatalogCourse = {
  id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  icon_name: string | null;
  cover_url: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  unlock_mode: string;
  prerequisite_course_id: string | null;
  available_from: string | null;
  is_manually_locked: boolean;
  content_scope: string;
};

export type CourseCatalogLesson = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  lesson_type: string | null;
  duration_minutes: number | null;
  is_free_preview: boolean;
  video_provider: string | null;
  video_url: string | null;
  video_object_key: string | null;
  video_mime_type: string | null;
  learning_objectives: string | null;
  lesson_tasks: string | null;
  teacher_note: string | null;
  content_text: string | null;
  key_points: string | null;
  case_study: string | null;
  common_mistakes: string | null;
  summary_text: string | null;
  reflection_questions: string | null;
  extra_note: string | null;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  unlock_mode: string;
  prerequisite_lesson_id: string | null;
  prerequisite_chapter_id: string | null;
  required_score: number | null;
  available_from: string | null;
  is_manually_locked: boolean;
  content_scope: string;
};

export type CourseCatalogChapter = {
  id: string;
  lesson_id: string;
  chapter_test_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  cover_object_key: string | null;
  cover_alt: string | null;
  cover_focal_point: string | null;
  is_published: boolean;
  sort_order: number;
  completion_rule: string;
  unlock_mode: string;
  prerequisite_chapter_id: string | null;
  required_score: number | null;
  available_from: string | null;
  is_manually_locked: boolean;
  content_scope: string;
};

export type CourseLessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  resource_type: string;
  resource_url: string | null;
  resource_object_key: string | null;
  original_file_name: string | null;
  is_required: boolean;
  is_published: boolean;
  sort_order: number;
  is_deleted: boolean;
  deleted_at: string | null;
  delete_reason: string | null;
};

export type CourseCatalogNode =
  | CourseCategory
  | CourseCatalogCourse
  | CourseCatalogLesson
  | CourseCatalogChapter;

export type CourseManagementSelection = {
  node?: string;
  id?: string;
};

export type CourseManagementData = {
  globalRole: string | null;
  canManage: boolean;
  canPermanentlyDeleteResources: boolean;
  categories: CourseCategory[];
  courses: CourseCatalogCourse[];
  lessons: CourseCatalogLesson[];
  chapters: CourseCatalogChapter[];
  resources: CourseLessonResource[];
  catalogErrorMessage: string | null;
  resourceErrorMessage: string | null;
};
