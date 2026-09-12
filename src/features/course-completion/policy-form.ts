export const POLICY_FIELDS = [
  { section: "textbook", key: "required_chapter_count", label: "必修教材章节数", min: 1, max: 500, initial: 16 },
  { section: "formal_chapter_exams", key: "minimum_completed_count", label: "正式章节考试完成数", min: 0, max: 500, initial: 16 },
  { section: "formal_chapter_exams", key: "minimum_passed_count", label: "正式章节考试通过数", min: 0, max: 500, initial: 16 },
  { section: "formal_chapter_exams", key: "passing_score", label: "章节考试及格分", min: 0, max: 100, initial: 60 },
  { section: "stage_exams", key: "required_count", label: "阶段考试完成数", min: 0, max: 100, initial: 4 },
  { section: "midterm_exam", key: "passing_score", label: "期中考试及格分", min: 0, max: 100, initial: 60 },
  { section: "final_exam", key: "passing_score", label: "期末考试及格分", min: 0, max: 100, initial: 60 },
  { section: "overall_score", key: "minimum_score", label: "综合成绩最低分", min: 0, max: 100, initial: 60 },
  { section: "blocking_gaps", key: "maximum_allowed_count", label: "允许未达标项数", min: 0, max: 500, initial: 0 },
] as const;

export const POLICY_CHECKS = [
  { section: "textbook", key: "require_all_mandatory_chapters", label: "完成全部必修教材章节" },
  { section: "required_assignments", key: "require_all_assigned", label: "核对全部已布置必修作业" },
  { section: "required_assignments", key: "require_submitted", label: "必修作业必须提交" },
  { section: "required_assignments", key: "require_graded", label: "必修作业必须完成批改" },
  { section: "stage_exams", key: "require_published_grades", label: "阶段考试成绩必须公开" },
  { section: "midterm_exam", key: "require_published_grade", label: "期中考试成绩必须公开" },
  { section: "final_exam", key: "require_published_grade", label: "期末考试成绩必须公开" },
  { section: "subjective_grading", key: "require_all_certification_items_graded", label: "认证主观题必须完成批改" },
] as const;

export function parsePolicyRequirements(form: FormData) {
  const requirements: Record<string, Record<string, number | boolean>> = {};
  for (const field of POLICY_FIELDS) {
    const raw = form.get(`${field.section}.${field.key}`);
    const value = raw === null || raw === "" ? NaN : Number(raw);
    if (!Number.isInteger(value) || value < field.min || value > field.max) throw new Error(`${field.label}应填写 ${field.min} 至 ${field.max} 的整数。`);
    (requirements[field.section] ??= {})[field.key] = value;
  }
  for (const field of POLICY_CHECKS) (requirements[field.section] ??= {})[field.key] = field.section !== "required_assignments" || form.get(`${field.section}.${field.key}`) === "on";
  if (Number(requirements.formal_chapter_exams.minimum_passed_count) > Number(requirements.formal_chapter_exams.minimum_completed_count)) throw new Error("通过数不能超过完成数。");
  return requirements;
}
