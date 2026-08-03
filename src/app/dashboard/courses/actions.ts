"use server";

import { revalidatePath } from "next/cache";

import { requireActiveUser } from "@/lib/auth";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const UPCOMING_CATEGORY_SLUGS = new Set(["english", "math", "university"]);

export async function addCourseCategoryToCurrentLearningAction(formData: FormData) {
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

  if (UPCOMING_CATEGORY_SLUGS.has(category.slug)) return;

  await supabase
    .from("student_course_category_learning_plans")
    .upsert(
      {
        user_id: user.id,
        tenant_id: tenant?.id ?? null,
        category_id: categoryId,
      },
      { onConflict: "user_id,category_id" }
    );

  revalidatePath("/dashboard/courses");
}

export async function removeCourseCategoryFromCurrentLearningAction(
  formData: FormData
) {
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  if (!isUuid(categoryId)) return;

  const { supabase, user, profile } = await requireActiveUser();
  if (profile?.role !== "student") return;

  await supabase
    .from("student_course_category_learning_plans")
    .delete()
    .eq("user_id", user.id)
    .eq("category_id", categoryId);

  revalidatePath("/dashboard/courses");
}
