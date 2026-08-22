import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  getStudentAppBasePath,
  getStudentPortalPath,
  type StudentAppSlug,
} from "@/lib/student-apps";

export type StudentHomeLearningRefreshScope = {
  tenantId: string;
  studentId: string;
  studentAppId: string;
  appSlug: StudentAppSlug;
  space: string;
};

export function getStudentHomeLearningCacheTags({
  tenantId,
  studentId,
  studentAppId,
}: Omit<StudentHomeLearningRefreshScope, "appSlug" | "space">) {
  return [
    `student-home-learning:${tenantId}:${studentId}`,
    `student-app-home:${tenantId}:${studentId}:${studentAppId}`,
  ] as const;
}

/**
 * 仅失效学习聚合数据，不触碰当前页面的 Router Cache。
 * 适用于智能教材内的高频保存，避免父级路径刷新重置正在进行的练习。
 */
export function refreshStudentHomeLearningData(
  scope: Pick<StudentHomeLearningRefreshScope, "tenantId" | "studentId" | "studentAppId">,
) {
  for (const tag of getStudentHomeLearningCacheTags(scope)) {
    revalidateTag(tag, { expire: 0 });
  }
}

/**
 * 学生学习状态写入后的统一首页刷新入口。
 *
 * 聚合查询当前直接读取 Supabase，尚未启用数据缓存。路径失效负责清除已访问
 * 首页的 Router Cache；标签同时定义未来接入缓存层时唯一应复用的失效边界。
 */
export function refreshStudentHomeLearning(
  scope: StudentHomeLearningRefreshScope,
) {
  refreshStudentHomeLearningData(scope);

  revalidatePath(getStudentPortalPath(scope.space));
  revalidatePath(getStudentAppBasePath(scope.space, scope.appSlug));
}
