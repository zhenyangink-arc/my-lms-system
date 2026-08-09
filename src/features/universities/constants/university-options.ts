import type {
  UniversityAdmissionStage,
  UniversityOwnership,
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
