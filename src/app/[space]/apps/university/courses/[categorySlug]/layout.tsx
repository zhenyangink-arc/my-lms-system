import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// 学科应用的一级课程分类 slug 与应用 slug 一致；只放行大学课程自己的分类。
export default async function UniversityCourseCategoryLayout({ children, params }: { children: ReactNode; params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  if (categorySlug !== "university") notFound();
  return children;
}
