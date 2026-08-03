import "server-only";

import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  getFeatureDeniedMessage,
  normalizeMembershipTier,
  type StudentFeature,
} from "@/lib/student-permissions";

/** 所有学生写操作在服务端再次校验，不能只依赖页面按钮。 */
export async function requireStudentFeature(feature: StudentFeature) {
  const context = await requireActiveUser();
  const role = context.profile?.role ?? "student";
  const tier = normalizeMembershipTier(context.profile?.membership_tier);

  if (role === "platform_course_inspector") {
    throw new Error("课程巡检员处于只读巡检模式，不能产生学生端操作记录。");
  }

  if (!canUseStudentFeature(role, tier, feature)) {
    throw new Error(`无权限：${getFeatureDeniedMessage(feature)}`);
  }

  return { ...context, tier };
}

export async function requireStudentPageFeature(
  feature: StudentFeature,
  fallback = "/dashboard"
) {
  const context = await requireActiveUser();
  const role = context.profile?.role ?? "student";
  const tier = normalizeMembershipTier(context.profile?.membership_tier);

  if (!canUseStudentFeature(role, tier, feature)) {
    redirect(fallback);
  }

  return { ...context, tier };
}
