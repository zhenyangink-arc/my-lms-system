"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const HANGUL_INTRODUCTION_PATH = "/platform/dashboard/courses/korean/korean-basic/korean-beginner/hangul-introduction";

export function CoursesAuditBannerVisibility() {
  const pathname = usePathname();

  useEffect(() => {
    const banner = document.getElementById("courses-audit-banner");
    if (banner) banner.hidden = pathname === HANGUL_INTRODUCTION_PATH;
  }, [pathname]);

  return null;
}
