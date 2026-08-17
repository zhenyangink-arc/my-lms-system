import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath, scopeDashboardPath } from "@/lib/dashboard-path";

export default async function LoginRedirectPage() {
  const { profile, tenant } = await requireActiveUser();

  if (profile?.role === "student" && tenant?.slug) {
    redirect(`/${encodeURIComponent(tenant.slug)}`);
  }

  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  if (profile?.role === "platform_course_inspector") {
    redirect(dashboardBasePath);
  }

  redirect(scopeDashboardPath("/dashboard/admin", dashboardBasePath));
}
