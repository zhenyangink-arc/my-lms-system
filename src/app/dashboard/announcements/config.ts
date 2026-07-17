export const ANNOUNCEMENT_CATEGORIES = ["general", "course", "exam", "system"] as const;
export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"] as const;
export const ANNOUNCEMENT_STATUSES = ["draft", "published", "archived"] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  general: "综合通知",
  course: "课程通知",
  exam: "考试通知",
  system: "系统通知",
};

export const PRIORITY_LABELS: Record<AnnouncementPriority, string> = {
  normal: "普通",
  important: "重要",
  urgent: "紧急",
};

export const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};
