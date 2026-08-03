export const membershipTiers = ["normal", "vip1", "vip2", "vip3"] as const;

export type MembershipTier = (typeof membershipTiers)[number];
export type StudentFeature =
  | "dashboard_section"
  | "message_services"
  | "learning_assignments"
  | "korean_course"
  | "ai_conversation_experience"
  | "conversation_course"
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

const staffRoles = new Set([
  "teacher",
  "admin",
  "ceo",
  "platform_super_admin",
  "tenant_super_admin",
  "tenant_operator",
]);

export function normalizeMembershipTier(value: string | null | undefined): MembershipTier {
  return membershipTiers.includes(value as MembershipTier)
    ? (value as MembershipTier)
    : "normal";
}

export function canUseStudentFeature(
  role: string,
  tier: MembershipTier,
  feature: StudentFeature
) {
  if (staffRoles.has(role)) return true;
  if (role === "platform_course_inspector") return true;
  if (feature === "message_services") return true;

  const hasVipBase = tier === "vip1" || tier === "vip2" || tier === "vip3";
  if (!hasVipBase) return false;

  if (feature === "learning_assignments") {
    return tier === "vip2" || tier === "vip3";
  }
  if (feature === "korean_course") {
    return tier === "vip2" || tier === "vip3";
  }
  if (feature === "ai_conversation_experience") {
    return tier === "vip2" || tier === "vip3";
  }
  if (feature === "conversation_course") {
    return tier === "vip3";
  }

  return (
    feature === "dashboard_section" ||
    feature === "university_target" ||
    feature === "application_documents" ||
    feature === "visa_tasks" ||
    feature === "course_preview"
  );
}

export function getFeatureDeniedMessage(feature: StudentFeature) {
  if (feature === "dashboard_section") {
    return "您暂无权限，如想新增权限，请联系管理员。管理员授权后即可进入该板块观看。";
  }
  if (feature === "university_comparison") {
    return "当前会员档位暂未开放学校对比，请联系顾问了解后续权限。";
  }
  if (feature === "course_preview") {
    return "当前账号没有试听权限，VIP1 及以上学生可以学习标记为“可试听”的课时。";
  }
  if (feature === "korean_course") {
    return "当前账号没有完整韩语课程权限，VIP2 及以上学生可以学习全部韩语课时。";
  }
  if (feature === "learning_assignments") {
    return "当前账号没有作业与考试权限，VIP2 及以上学生可以查看和提交已发布任务。";
  }
  if (feature === "conversation_course") {
    return "VIP2 学生暂不开放会话课程，可以进入“与 AI 交流体验”；完整会话课程仅对 VIP3 开放。";
  }
  if (feature === "ai_conversation_experience") {
    return "当前账号没有 AI 交流体验权限，VIP2 及以上学生可以使用。";
  }
  return "当前账号可浏览这部分内容，但暂时没有操作权限。请联系顾问升级或开通服务。";
}
