import type {
  UniversityAdmissionStage,
  UniversityDocumentCategory,
  UniversityOwnership,
  UniversityVisaStage,
  UniversityVisaType,
} from "../api/types";

export const UNIVERSITY_OWNERSHIP_LABELS: Record<
  UniversityOwnership,
  string
> = {
  national: "国立",
  public: "公立",
  private: "私立",
};

export const UNIVERSITY_ADMISSION_STAGE_LABELS: Record<
  UniversityAdmissionStage,
  string
> = {
  language: "语言课程",
  bachelor_fresh: "本科新入",
  bachelor_transfer: "本科插班",
  master: "硕士",
  doctor: "博士",
};

export const UNIVERSITY_DOCUMENT_CATEGORY_LABELS: Record<
  UniversityDocumentCategory,
  string
> = {
  identity: "身份材料",
  academic: "学历材料",
  application: "申请材料",
  financial: "财力材料",
  language: "语言材料",
};

export const UNIVERSITY_VISA_TYPE_LABELS: Record<UniversityVisaType, string> = {
  d4_language: "语言课程签证",
  d2_bachelor: "本科签证",
  d2_master: "硕士签证",
  d2_doctor: "博士签证",
};

export const UNIVERSITY_VISA_STAGE_LABELS: Record<
  UniversityVisaStage,
  string
> = {
  admission: "录取材料",
  identity: "身份材料",
  finance: "财力证明",
  application: "申请准备",
  appointment: "预约",
  submission: "递交",
  result: "结果",
  entry: "入境",
};

export const UNIVERSITY_RANKING_FILTER_OPTIONS = [
  { value: "qs_top_100", label: "世界排名前 100" },
  { value: "qs_top_300", label: "世界排名前 300" },
  { value: "qs_ranked", label: "有世界排名" },
  { value: "joongang_ranked", label: "有韩国排名" },
  { value: "unranked", label: "暂无排名" },
] as const;

export type UniversityRankingFilter =
  | "all"
  | (typeof UNIVERSITY_RANKING_FILTER_OPTIONS)[number]["value"];

export const UNIVERSITY_TUITION_FILTER_OPTIONS = [
  { value: "max_at_most_50000", label: "最高学费不超过 5 万元" },
  { value: "max_50000_to_80000", label: "最高学费 5 万至 8 万元" },
  { value: "max_above_80000", label: "最高学费超过 8 万元" },
] as const;

export type UniversityTuitionFilter =
  | "all"
  | (typeof UNIVERSITY_TUITION_FILTER_OPTIONS)[number]["value"];
