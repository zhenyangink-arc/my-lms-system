import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { loadUniversityCategoryScope } from "@/features/subjects/university/major-scope.server";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createClient } from "@/lib/supabase/server";

// 学生只能进入自己专业、关联公共课组和通识下的内容；专业下的课程页、课时页都在这个布局之下，一并拦截。
// 教职人员和平台账号不受限。
export default async function UniversityMajorLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ subcategorySlug: string }>;
}) {
  const { subcategorySlug } = await params;
  const scope = await loadUniversityCategoryScope();
  if (scope.restricted) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("course_categories")
      .select("id")
      .eq("slug", subcategorySlug)
      .eq("student_app_id", STUDENT_APP_IDS.university)
      .not("parent_id", "is", null)
      .limit(5);
    // 同名分类必须全部可见才放行，避免通过重名越过范围
    if (error || !data || data.length === 0 || data.some((row) => !scope.categoryIds.has(row.id))) notFound();
  }
  return children;
}
