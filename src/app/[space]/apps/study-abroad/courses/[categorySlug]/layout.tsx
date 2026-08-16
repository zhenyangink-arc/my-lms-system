import type { ReactNode } from "react";
import { notFound } from "next/navigation";

export default async function StudyAbroadCourseCategoryLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  if (categorySlug !== "service") notFound();
  return children;
}
