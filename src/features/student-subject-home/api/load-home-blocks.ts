import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadAbilityPortrait,
  type AbilityPortraitData,
} from "@/features/student-ability-portrait/api/service";
import {
  loadStudentCurrentCourse,
  type StudentCurrentCourse,
} from "@/features/student-current-course/api/service";
import { loadHomeLearningTasks } from "@/features/student-home-learning/api/service";
import type { HomeLearningTask } from "@/features/student-home-learning/api/types";
import type { StudentHomeBlockKey, SubjectSlug } from "@/features/subjects";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

export type HomeBlockResult<T> = { value: T; failed: boolean };

export type StudentHomeBlockData = {
  tasks: HomeBlockResult<HomeLearningTask[]>;
  currentCourse: HomeBlockResult<StudentCurrentCourse | null>;
  abilityPortrait: HomeBlockResult<AbilityPortraitData | null>;
};

/** 区块各自读取；单个区块失败只影响该区块。未请求的区块不读取。 */
async function loadBlock<T>(
  enabled: boolean,
  label: string,
  fallback: T,
  load: () => Promise<T>,
): Promise<HomeBlockResult<T>> {
  if (!enabled) return { value: fallback, failed: false };
  try {
    return { value: await load(), failed: false };
  } catch (error) {
    // 使用 warn：局部失败不触发开发环境错误层。
    console.warn(`[student-home] ${label}读取失败`, error);
    return { value: fallback, failed: true };
  }
}

/**
 * 学科首页的平台区块数据。平台首页框架与学科定制首页（韩语）共用，
 * 保证两边的今日任务、继续学习、能力画像取数一致。
 */
export async function loadStudentHomeBlocks({
  supabase,
  tenantId,
  studentId,
  appSlug,
  appLabel,
  space,
  blocks,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  tenantId: string;
  studentId: string;
  appSlug: SubjectSlug;
  appLabel: string;
  space: string;
  blocks: readonly StudentHomeBlockKey[];
  now?: Date;
}): Promise<StudentHomeBlockData> {
  const studentAppId = STUDENT_APP_IDS[appSlug];
  const [tasks, currentCourse, abilityPortrait] = await Promise.all([
    loadBlock<HomeLearningTask[]>(blocks.includes("today-tasks"), "今日学习任务", [], () =>
      loadHomeLearningTasks({
        supabase,
        tenantId,
        studentId,
        studentAppId,
        appSlug,
        appLabel,
        space,
        now,
      }),
    ),
    loadBlock<StudentCurrentCourse | null>(blocks.includes("continue-learning"), "当前课程", null, () =>
      loadStudentCurrentCourse({ supabase, studentId, studentAppId, appSlug, space, now }),
    ),
    loadBlock<AbilityPortraitData | null>(blocks.includes("ability-portrait"), "能力画像", null, () =>
      loadAbilityPortrait({ supabase, tenantId, studentId, studentAppId, now }),
    ),
  ]);
  return { tasks, currentCourse, abilityPortrait };
}
