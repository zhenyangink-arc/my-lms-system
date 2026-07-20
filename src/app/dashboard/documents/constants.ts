import {
  FileText,
  FolderOpen,
  GraduationCap,
  IdCard,
  Landmark,
  Languages,
  NotebookPen,
} from "lucide-react";

export const CATEGORY_ORDER = ["identity", "academic", "application", "financial", "language", "other"];

export const CATEGORY_LABELS: Record<string, string> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请文书",
  financial: "资金材料",
  language: "语言材料",
  other: "其他材料",
};

export const CATEGORY_ICONS: Record<string, typeof FileText> = {
  identity: IdCard,
  academic: GraduationCap,
  application: NotebookPen,
  financial: Landmark,
  language: Languages,
  other: FolderOpen,
};

export const STATUS_LABELS: Record<string, string> = {
  preparing: "准备中",
  completed: "已完成",
  not_needed: "无",
};

export const STATUS_TONES: Record<string, { color: string; soft: string }> = {
  preparing: { color: "var(--app-secondary)", soft: "var(--app-secondary-soft)" },
  completed: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  not_needed: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
};

export const APPLICATION_STAGE_LABELS = [
  "学生确认信息",
  "管理员确认",
  "资料邮寄",
  "资料到达韩国",
  "资料审核中",
  "审核完毕，颁发入学标准许可书",
  "资料已寄回国",
  "资料到达学生住址",
  "请进入申请签证页面",
] as const;

export const APPLICATION_FINAL_STAGE = APPLICATION_STAGE_LABELS.length;
