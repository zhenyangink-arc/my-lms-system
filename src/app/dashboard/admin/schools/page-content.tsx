import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { getManagementAppPath } from "@/lib/management-app-path";

// 学校库管理已迁移到留学服务应用工作区的“目标大学”标签页；
// 这个旧入口只负责把访问跳转到当前正式位置，不再维护独立页面。
export default async function AdminSchoolsPage() {
  const { tenant } = await requireActiveUser();
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);
  redirect(getManagementAppPath(dashboardBasePath, "study-abroad", "universities"));
}
