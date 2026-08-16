"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { StudentRouteLoading } from "@/app/dashboard/DashboardRouteLoading";
import {
  DEFAULT_PRACTICE_SECTION,
  getPracticeAppPath,
  getPracticeMemoryKey,
  isPracticeSection,
} from "@/lib/practice-navigation-memory";

export function PracticeMemoryRedirect({
  studentId,
  studentAppBasePath,
}: {
  studentId: string;
  studentAppBasePath: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let section = DEFAULT_PRACTICE_SECTION;

    try {
      const remembered = window.localStorage.getItem(
        getPracticeMemoryKey(studentId, studentAppBasePath),
      );
      if (isPracticeSection(remembered)) section = remembered;
    } catch {
      // 隐私模式或禁用本地存储时，稳定回退到课程巩固。
    }

    router.replace(getPracticeAppPath(studentAppBasePath, section));
  }, [router, studentAppBasePath, studentId]);

  return <StudentRouteLoading />;
}
