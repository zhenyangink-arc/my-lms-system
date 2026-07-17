export const HELP_ARTICLE_CATEGORIES = ["platform", "account", "course", "study", "visa", "service"] as const;
export const HELP_ARTICLE_STATUSES = ["draft", "published", "archived"] as const;
export const HELP_TICKET_CATEGORIES = ["technical", "account", "course", "service", "other"] as const;
export const HELP_TICKET_PRIORITIES = ["normal", "urgent"] as const;
export const HELP_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export type HelpArticleCategory = (typeof HELP_ARTICLE_CATEGORIES)[number];
export type HelpArticleStatus = (typeof HELP_ARTICLE_STATUSES)[number];
export type HelpTicketCategory = (typeof HELP_TICKET_CATEGORIES)[number];
export type HelpTicketPriority = (typeof HELP_TICKET_PRIORITIES)[number];
export type HelpTicketStatus = (typeof HELP_TICKET_STATUSES)[number];

export const HELP_ARTICLE_CATEGORY_LABELS: Record<HelpArticleCategory, string> = { platform: "平台使用", account: "账号安全", course: "课程学习", study: "学习成长", visa: "留学签证", service: "服务支持" };
export const HELP_ARTICLE_STATUS_LABELS: Record<HelpArticleStatus, string> = { draft: "草稿", published: "已发布", archived: "已归档" };
export const HELP_TICKET_CATEGORY_LABELS: Record<HelpTicketCategory, string> = { technical: "平台故障", account: "账号问题", course: "课程问题", service: "服务咨询", other: "其他问题" };
export const HELP_TICKET_PRIORITY_LABELS: Record<HelpTicketPriority, string> = { normal: "普通", urgent: "紧急" };
export const HELP_TICKET_STATUS_LABELS: Record<HelpTicketStatus, string> = { open: "待处理", in_progress: "处理中", resolved: "已解决", closed: "已关闭" };

export const helpDateFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
