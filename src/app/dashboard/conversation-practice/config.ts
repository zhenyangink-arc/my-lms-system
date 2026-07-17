export const CONVERSATION_CATEGORIES = ["daily", "campus", "travel", "interview", "workplace"] as const;
export const CONVERSATION_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const CONVERSATION_STATUSES = ["draft", "published", "archived"] as const;

export type ConversationCategory = (typeof CONVERSATION_CATEGORIES)[number];
export type ConversationDifficulty = (typeof CONVERSATION_DIFFICULTIES)[number];
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const CONVERSATION_CATEGORY_LABELS: Record<ConversationCategory, string> = {
  daily: "日常生活",
  campus: "校园交流",
  travel: "出行办事",
  interview: "面试升学",
  workplace: "职场沟通",
};

export const CONVERSATION_DIFFICULTY_LABELS: Record<ConversationDifficulty, string> = {
  beginner: "入门",
  intermediate: "进阶",
  advanced: "挑战",
};

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

export type DialogueLine = { speaker: string; korean: string; chinese: string };
export type KeyExpression = { korean: string; chinese: string };

export const conversationDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
