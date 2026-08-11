"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { requireActiveUser } from "@/lib/auth";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// 与 page-content.tsx 同一套判定：一级板块下没有任何已发布课时就算"即将开放"，
// 不能收藏。用查询代替硬编码 slug 列表，内容上线后这里不需要再改代码。
async function categoryHasPublishedLessons(
  supabase: Awaited<ReturnType<typeof requireActiveUser>>["supabase"],
  categoryId: string
) {
  const { data: subcategories } = await supabase
    .from("course_categories")
    .select("id")
    .eq("parent_id", categoryId)
    .eq("is_published", true);
  const subcategoryIds = (subcategories ?? []).map((row) => row.id as string);
  if (subcategoryIds.length === 0) return false;

  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .in("category_id", subcategoryIds)
    .eq("is_published", true);
  const courseIds = (courses ?? []).map((row) => row.id as string);
  if (courseIds.length === 0) return false;

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .in("course_id", courseIds)
    .eq("is_published", true);
  return (count ?? 0) > 0;
}

export async function addCourseCategoryToFavoritesAction(formData: FormData) {
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!isUuid(categoryId)) return;

  const { supabase, user, tenant, profile } = await requireActiveUser();
  if (profile?.role !== "student") return;

  const { data: category } = await supabase
    .from("course_categories")
    .select("id, slug")
    .eq("id", categoryId)
    .is("parent_id", null)
    .eq("is_published", true)
    .maybeSingle();

  if (!category) return;
  if (!(await categoryHasPublishedLessons(supabase, category.id))) return;

  const { error } = await supabase.from("student_course_category_favorites").upsert(
    {
      user_id: user.id,
      tenant_id: tenant?.id ?? null,
      category_id: categoryId,
    },
    { onConflict: "user_id,category_id" }
  );

  // 之前这里的错误被整个丢掉，收藏失败时页面看起来什么都没发生。
  // 表单目前没有接 useActionState 无法展示行内错误，至少先在服务端留痕，
  // 并且只在真正写入成功时才刷新页面，避免失败时误导性地"刷新"成看似成功。
  if (error) {
    console.error("收藏课程板块失败：", error);
    return;
  }

  revalidateDashboard("/dashboard/courses");
}

export async function removeCourseCategoryFromFavoritesAction(
  formData: FormData
) {
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!isUuid(categoryId)) return;

  const { supabase, user, profile } = await requireActiveUser();
  if (profile?.role !== "student") return;

  const { error } = await supabase
    .from("student_course_category_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("category_id", categoryId);

  if (error) {
    console.error("取消收藏课程板块失败：", error);
    return;
  }

  revalidateDashboard("/dashboard/courses");
}
