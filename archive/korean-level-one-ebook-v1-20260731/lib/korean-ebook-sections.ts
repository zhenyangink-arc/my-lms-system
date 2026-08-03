export const KOREAN_EBOOK_SECTIONS = [
  { step: "STEP 01", label: "课前导航" },
  { step: "STEP 02", label: "核心词汇" },
  { step: "STEP 03", label: "语法讲解" },
  { step: "STEP 04", label: "句型操练" },
  { step: "STEP 05", label: "实战对话" },
  { step: "STEP 06", label: "听说任务" },
  { step: "STEP 07", label: "读写拓展" },
  { step: "STEP 08", label: "自测与复盘" },
] as const;

export type KoreanEbookSectionStep =
  (typeof KOREAN_EBOOK_SECTIONS)[number]["step"];

export function koreanEbookSectionLabel(step: string) {
  const section = KOREAN_EBOOK_SECTIONS.find((item) => item.step === step);
  return section ? `${section.step} · ${section.label}` : step;
}

export function defaultEbookSectionForSkill(skill: string): KoreanEbookSectionStep {
  if (skill === "listening" || skill === "speaking") return "STEP 06";
  if (skill === "reading" || skill === "writing") return "STEP 07";
  if (skill === "vocabulary") return "STEP 02";
  if (skill === "grammar") return "STEP 03";
  if (skill === "communication") return "STEP 05";
  return "STEP 08";
}
