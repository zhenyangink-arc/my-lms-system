export const INTEREST_TAG_OPTIONS = [
  "旅行",
  "摄影",
  "K-POP",
  "设计",
  "美食",
  "运动",
  "电影",
  "语言",
  "科技",
  "阅读",
  "游戏",
  "音乐",
] as const;

export type InterestTag = (typeof INTEREST_TAG_OPTIONS)[number];

export function isInterestTag(value: string): value is InterestTag {
  return (INTEREST_TAG_OPTIONS as readonly string[]).includes(value);
}
