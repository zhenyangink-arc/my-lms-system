import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { StudentUtilityDrawer } from "./StudentUtilityDrawer";
import type { TeacherReplyReminder } from "./ReminderDialog";

// 只保留数据获取：租户名、用户名、未读回复数、教师回复提醒列表。
export async function StudentTopbar() {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  const userName =
    profile?.full_name || user.user_metadata?.name || user.email || "用户";
  const accountLabel =
    profile?.role === "platform_course_inspector"
      ? "平台课程巡检员"
      : MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(profile?.membership_tier)];

  let unreadCount = 0;
  let teacherReminders: TeacherReplyReminder[] = [];
  const dashboardBasePath = getDashboardBasePath(tenant?.slug);

  if (profile?.role === "student") {
    // 教师回复（无条件取前 20 条，由前端按 unread 过滤计数）
    const { data: answeredQuestions } = await supabase
      .from("lesson_questions")
      .select("id, title, course_id, lesson_id, teacher_name, answered_at, student_read_at, teacher_answer")
      .eq("student_id", user.id)
      .not("teacher_answer", "is", null)
      .order("answered_at", { ascending: false, nullsFirst: false })
      .limit(20);

    const rows = answeredQuestions ?? [];

    const unread = rows.filter(
      (row) =>
        !row.student_read_at ||
        (row.answered_at && row.student_read_at < row.answered_at)
    );
    unreadCount = unread.length;

    // 只为未读的构建提醒项
    if (unread.length > 0) {
      const lessonIds = [...new Set(unread.map((r) => r.lesson_id))];

      const { data: lessonsData } = await supabase
        .from("lessons")
        .select("id, slug, course_id")
        .in("id", lessonIds);

      const lessonMap = new Map((lessonsData ?? []).map((l) => [l.id, { slug: l.slug, course_id: l.course_id }]));
      const courseIds = [...new Set((lessonsData ?? []).map((l) => l.course_id))];

      const [{ data: coursesData }, { data: subcategoriesData }] = await Promise.all([
        courseIds.length > 0
          ? supabase.from("courses").select("id, slug, category_id").in("id", courseIds)
          : Promise.resolve({ data: [] as { id: string; slug: string; category_id: string }[] }),
        (async () => {
          if (courseIds.length === 0) return { data: [] as { id: string; slug: string; parent_id: string }[] };
          const courses = (await supabase.from("courses").select("category_id").in("id", courseIds)).data ?? [];
          const categoryIds = [...new Set(courses.map((c) => c.category_id))];
          if (categoryIds.length === 0) return { data: [] as { id: string; slug: string; parent_id: string }[] };
          return supabase.from("course_categories").select("id, slug, parent_id").in("id", categoryIds);
        })(),
      ]);

      const courseMap = new Map((coursesData ?? []).map((c) => [c.id, { slug: c.slug, category_id: c.category_id }]));
      const subcategoryMap = new Map((subcategoriesData ?? []).map((c) => [c.id, { slug: c.slug, parent_id: c.parent_id }]));

      const parentIds = [...new Set((subcategoriesData ?? []).map((c) => c.parent_id).filter(Boolean))] as string[];
      const { data: parentsData } = parentIds.length > 0
        ? await supabase.from("course_categories").select("id, slug").in("id", parentIds)
        : { data: [] as { id: string; slug: string }[] };
      const parentMap = new Map((parentsData ?? []).map((c) => [c.id, c.slug]));

      function buildLessonHref(courseId: string, lessonSlug: string): string | null {
        const course = courseMap.get(courseId);
        if (!course) return null;
        const sub = subcategoryMap.get(course.category_id);
        if (!sub?.parent_id) return null;
        const parentSlug = parentMap.get(sub.parent_id);
        if (!parentSlug) return null;
        return `/dashboard/courses/${parentSlug}/${sub.slug}/${course.slug}/${lessonSlug}`;
      }

      teacherReminders = unread.map((row) => {
        const lesson = lessonMap.get(row.lesson_id);
        const lessonHref = lesson ? buildLessonHref(lesson.course_id, lesson.slug) : null;
        const actionHref = lessonHref
          ? `/api/lesson-questions/${row.id}/mark-read?to=${encodeURIComponent(lessonHref)}`
          : null;

        return {
          id: `reply-${row.id}`,
          title: row.title,
          subtitle: row.teacher_name ? `${row.teacher_name} 老师已回复` : "老师已回复",
          actionHref,
        };
      });
    }
  }

  return (
    <StudentUtilityDrawer
      tenantName={tenant?.name ?? "韩语教育"}
      userName={userName}
      accountLabel={accountLabel}
      unreadCount={unreadCount}
      teacherReminders={teacherReminders}
      dashboardBasePath={dashboardBasePath}
    />
  );
}
