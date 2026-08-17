export const KOREAN_EBOOK_SECTIONS = [
  { number: 1, label: "课前导航" },
  { number: 2, label: "核心词汇" },
  { number: 3, label: "语法讲解" },
  { number: 4, label: "句型操练" },
  { number: 5, label: "实战对话" },
  { number: 6, label: "听说任务" },
  { number: 7, label: "读写拓展" },
  { number: 8, label: "自测与复盘" },
] as const;

export type KoreanEbookSectionNumber =
  (typeof KOREAN_EBOOK_SECTIONS)[number]["number"];

export type KoreanEbookSectionStep = `STEP 0${KoreanEbookSectionNumber}`;

export function koreanEbookSectionStep(
  number: KoreanEbookSectionNumber,
): KoreanEbookSectionStep {
  return `STEP 0${number}`;
}

export function koreanEbookStepLabel(step: string) {
  const stepNumber = Number(step.match(/\d+/)?.[0]);
  const labels: Record<number, string> = {
    1: "第一步",
    2: "第二步",
    3: "第三步",
    4: "第四步",
    5: "第五步",
    6: "第六步",
    7: "第七步",
    8: "第八步",
  };
  return labels[stepNumber] ?? "学习步骤";
}

export function koreanEbookSectionLabel(step: string) {
  const stepNumber = Number(step.match(/\d+/)?.[0]);
  const section = KOREAN_EBOOK_SECTIONS.find(
    (item) => item.number === stepNumber,
  );
  return section
    ? `${koreanEbookStepLabel(step)} · ${section.label}`
    : koreanEbookStepLabel(step);
}

export function defaultEbookSectionForSkill(skill: string): KoreanEbookSectionStep {
  if (skill === "listening" || skill === "speaking") return "STEP 06";
  if (skill === "reading" || skill === "writing") return "STEP 07";
  if (skill === "vocabulary") return "STEP 02";
  if (skill === "grammar") return "STEP 03";
  if (skill === "communication") return "STEP 05";
  return "STEP 08";
}
