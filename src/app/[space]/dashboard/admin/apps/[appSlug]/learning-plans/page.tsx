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
  const courseRows = courseResult.data ?? [];
  const courseIds = courseRows.map((course) => String(course.id));
  const lessonResult = context.access.scope === "platform" && courseIds.length
    ? await supabase
        .from("lessons")
        .select("id,course_id,title")
        .in("course_id", courseIds)
        .eq("is_published", true)
        .order("sort_order")
    : { data: [], error: null };
  if (lessonResult.error) throw new Error("课时目录读取失败", { cause: lessonResult.error });
  const lessons = (lessonResult.data ?? []).map((lesson) => ({
    id: String(lesson.id),
    courseId: String(lesson.course_id),
    title: String(lesson.title),
  }));
  const lessonIds = lessons.map((lesson) => lesson.id);
  const chapterTestResult = context.access.scope === "platform" && lessonIds.length
    ? await supabase
        .from("chapter_tests")
        .select("id,lesson_id,title")
        .in("lesson_id", lessonIds)
        .eq("student_app_id", context.access.appId)
        .eq("status", "published")
        .order("chapter_number")
    : { data: [], error: null };
  if (chapterTestResult.error) throw new Error("章节测试目录读取失败", { cause: chapterTestResult.error });
  const chapterTests = (chapterTestResult.data ?? []).map((test) => ({
    id: String(test.id),
    lessonId: String(test.lesson_id),
    title: String(test.title),
  }));

  return (
    <ManagementApplicationSectionFrame {...context}>
      <CurriculumPlanWorkspace
        space={space}
        appSlug={appSlug}
        scope={context.access.scope}
        courses={courseRows.map((course) => ({ id: String(course.id), title: String(course.title) }))}
        lessons={lessons}
        chapterTests={chapterTests}
        {...workspace}
        success={first(query.success)}
        error={first(query.error)}
      />
    </ManagementApplicationSectionFrame>
  );
}
