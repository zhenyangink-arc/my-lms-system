import type { ReactNode } from "react";
import { notFound } from "next/navigation";

export default async function KoreanCourseCategoryLayout({ children, params }: { children: ReactNode; params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  if (categorySlug !== "korean") notFound();
  return children;
}

