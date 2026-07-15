export const membershipTiers = ["normal", "vip1", "vip2", "vip3"] as const;

export type MembershipTier = (typeof membershipTiers)[number];
export type StudentFeature =
  | "message_services"
  | "university_target"
  | "university_comparison"
  | "application_documents"
  | "visa_tasks"
  | "course_preview"
  | "restricted_operation";

export const MEMBERSHIP_TIER_LABELS: Record<MembershipTier, string> = {
  normal: "普通学生",
  vip1: "VIP1 学生",
  vip2: "VIP2 学生",
  vip3: "VIP3 学生",
};

const staffRoles = new Set(["teacher", "admin", "ceo", "super_admin"]);

export function normalizeMembershipTier(value: string | null | undefined): MembershipTier {
  return membershipTiers.includes(value as MembershipTier)
    ? (value as MembershipTier)
    : "normal";
}

/** VIP2、VIP3 暂时只继承 VIP1 的基础权限，后续再独立扩展。 */
export function canUseStudentFeature(
  role: string,
  tier: MembershipTier,
  feature: StudentFeature
) {
  if (staffRoles.has(role)) return true;
  if (feature === "message_services") return true;

  const hasVipBase = tier === "vip1" || tier === "vip2" || tier === "vip3";
  if (!hasVipBase) return false;

  return (
    feature === "university_target" ||
    feature === "application_documents" ||
    feature === "visa_tasks" ||
    feature === "course_preview"
  );
}

export function getFeatureDeniedMessage(feature: StudentFeature) {
  if (feature === "university_comparison") {
    return "当前会员档位暂未开放学校对比，请联系顾问了解后续权限。";
  }
  if (feature === "course_preview") {
    return "当前账号没有试听权限，VIP1 及以上学生可以学习标记为“可试听”的课时。";
  }
  return "当前账号可浏览这部分内容，但暂时没有操作权限。请联系顾问升级或开通服务。";
}
