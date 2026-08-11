"use server";

import { requirePlatformCourseManager } from "@/lib/admin";
import { revalidateDashboard } from "@/lib/revalidate-dashboard";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIEW_SLUG_PATTERN = /^[a-z0-9_-]{1,64}$/;

/**
 * 切换分类 / 课程是否在指定课程树视图中展示（course_tree_view_items）。
 * 课程树展示控制：分类与课程都命中视图时，该课程分支才会出现在学生端树里。
 */
export async function setHomeTreeVisibility(
  table: "courses" | "course_categories",
  id: string,
  show: boolean,
  viewSlug: string
): Promise<{ ok: boolean; error?: string }> {
  if (table !== "courses" && table !== "course_categories") {
    return { ok: false, error: "非法表名" };
  }
  if (!UUID_PATTERN.test(id)) {
    return { ok: false, error: "非法 id" };
  }
  if (!VIEW_SLUG_PATTERN.test(viewSlug)) {
    return { ok: false, error: "非法视图" };
  }

  const { supabase } = await requirePlatformCourseManager();
  const entityType = table === "courses" ? "course" : "category";

  if (show) {
    const { error } = await supabase
      .from("course_tree_view_items")
      .upsert(
        { view_slug: viewSlug, entity_type: entityType, entity_id: id },
        { onConflict: "view_slug,entity_type,entity_id", ignoreDuplicates: true }
      );
    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("course_tree_view_items")
      .delete()
      .eq("view_slug", viewSlug)
      .eq("entity_type", entityType)
      .eq("entity_id", id);
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  revalidateDashboard("/dashboard");
  return { ok: true };
}

/**
 * 一键批量设置：指定视图下所有已发布课程 + 所有已发布分类的展示开关。
 */
export async function setAllHomeTreeVisibility(
  show: boolean,
  viewSlug: string
): Promise<{ ok: boolean; error?: string }> {
  if (!VIEW_SLUG_PATTERN.test(viewSlug)) {
    return { ok: false, error: "非法视图" };
  }

  const { supabase } = await requirePlatformCourseManager();

  if (show) {
    const [coursesResult, categoriesResult] = await Promise.all([
      supabase.from("courses").select("id").eq("is_published", true),
      supabase
        .from("course_categories")
        .select("id")
        .eq("is_published", true),
    ]);
    if (coursesResult.error || categoriesResult.error) {
      return {
        ok: false,
        error:
          coursesResult.error?.message ?? categoriesResult.error?.message,
      };
    }
    const items = [
      ...coursesResult.data.map((r) => ({
        view_slug: viewSlug,
        entity_type: "course" as const,
        entity_id: r.id,
      })),
      ...categoriesResult.data.map((r) => ({
        view_slug: viewSlug,
        entity_type: "category" as const,
        entity_id: r.id,
      })),
    ];
    if (items.length === 0) {
      revalidateDashboard("/dashboard");
      return { ok: true };
    }
    const { error } = await supabase
      .from("course_tree_view_items")
      .upsert(items, {
        onConflict: "view_slug,entity_type,entity_id",
        ignoreDuplicates: true,
      });
    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("course_tree_view_items")
      .delete()
      .eq("view_slug", viewSlug)
      .in("entity_type", ["course", "category"]);
    if (error) {
      return { ok: false, error: error.message };
    }
  }
  revalidateDashboard("/dashboard");
  return { ok: true };
}
