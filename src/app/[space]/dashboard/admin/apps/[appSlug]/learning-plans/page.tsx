import { redirect } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { loadCurriculumPlanWorkspace } from "@/features/curriculum-plans/api/service";
import { CurriculumPlanWorkspace } from "@/features/curriculum-plans/components/CurriculumPlanWorkspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CurriculumLearningPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ space, appSlug }, query] = await Promise.all([params, searchParams]);
  const context = await requireManagementApplicationSection(space, appSlug, "learning-plans");
  const allowed =
    appSlug === "korean" &&
    (context.access.scope === "tenant" || context.access.globalRole === "platform_owner");
  if (!allowed) redirect(context.access.appPath);

  const supabase = await createClient();
  const [workspace, courseResult] = await Promise.all([
    loadCurriculumPlanWorkspace({
      supabase,
      studentAppId: context.access.appId,
      tenantId: context.access.tenantId,
      viewerId: context.access.userId,
      viewerRole: context.access.role,
    }),
    supabase
      .from("courses")
      .select("id,title")
      .eq("student_app_id", context.access.appId)
      .eq("content_scope", "platform")
      .order("sort_order"),
  ]);
  if (courseResult.error) throw new Error("课程目录读取失败", { cause: courseResult.error });

  return (
    <ManagementApplicationSectionFrame {...context}>
      <CurriculumPlanWorkspace
        space={space}
        appSlug={appSlug}
        scope={context.access.scope}
        courses={(courseResult.data ?? []).map((course) => ({ id: String(course.id), title: String(course.title) }))}
        {...workspace}
        success={first(query.success)}
        error={first(query.error)}
      />
    </ManagementApplicationSectionFrame>
  );
}
