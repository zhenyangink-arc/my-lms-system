import "server-only";

import { getStudentAppSlugById } from "@/lib/student-app-access.server";

import { refreshStudentHomeLearning } from "./refresh";

/**
 * 写入操作完成后，按数据本身所属的应用刷新学生首页。
 * 应用 ID 必须来自服务端读取的记录，不能来自客户端参数。
 */
export function refreshStudentHomeLearningForApp({
  tenantId,
  studentId,
  studentAppId,
  space,
}: {
  tenantId: string;
  studentId: string;
  studentAppId: string | null | undefined;
  space: string;
}) {
  const appSlug = getStudentAppSlugById(studentAppId);
  if (!studentAppId || !appSlug) return;
  refreshStudentHomeLearning({ tenantId, studentId, studentAppId, appSlug, space });
}
