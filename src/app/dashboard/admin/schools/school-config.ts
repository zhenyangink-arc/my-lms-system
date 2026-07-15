import { Building2, Factory, GraduationCap, LibraryBig, School, University } from "lucide-react";

export const schoolCategories = [
  { slug: "korean-universities", value: "korean_university", label: "韩国大学", description: "管理韩国大学库、校徽、排名关联与详细介绍。", icon: University },
  { slug: "chinese-universities", value: "chinese_university", label: "中国大学", description: "独立维护中国本科和研究生院校资料。", icon: GraduationCap },
  { slug: "high-schools", value: "high_school", label: "高中院校", description: "维护普通高中及国际高中信息。", icon: School },
  { slug: "vocational-schools", value: "vocational_secondary", label: "中专院校", description: "维护中等专业学校与专业方向。", icon: Building2 },
  { slug: "technical-schools", value: "technical_school", label: "技工院校", description: "维护技工学校、培养方向与学制。", icon: Factory },
] as const;

export const schoolOverview = { slug: "overview", label: "学校总览", description: "查看全部学校的数据完整度、发布状态和分类分布。", icon: LibraryBig };

export type SchoolCategoryValue = (typeof schoolCategories)[number]["value"];

export function getSchoolCategoryBySlug(slug: string) {
  return schoolCategories.find((category) => category.slug === slug);
}

export const ownershipLabels: Record<string, string> = {
  national: "国立",
  public: "公立",
  private: "私立",
  other: "其他",
};

export const educationStageLabels: Record<string, string> = {
  language: "语学堂",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
  high_school: "高中",
  vocational: "中专",
  technical: "技工",
  other: "其他",
};
