import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadCoursePracticeCatalog } from "@/lib/course-practice-catalog.server";
import {
  DEFAULT_WEAK_ABILITY_THRESHOLD,
  mapSpecializedPracticeTask,
  type SpecializedPracticeCandidate,
} from "./specialized-practice-mapper.ts";
import type { HomeLearningTask } from "./types.ts";

type LoadSpecializedPracticeTasksInput = {
  supabase: SupabaseClient;
  studentId: string;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  now?: Date;
};

function throwReadError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`首页专项训练${label}读取失败`, { cause: error });
}

export async function loadSpecializedPracticeTasks({
  supabase,
  studentId,
  studentAppId,
  appSlug,
  appLabel,
  space,
  now = new Date(),
}: LoadSpecializedPracticeTasksInput): Promise<HomeLearningTask[]> {
  const catalog = await loadCoursePracticeCatalog({ supabase, userId: studentId, now });
  const openChapterById = new Map(
    catalog.flatMap((course) =>
      course.chapters.flatMap((chapter) =>
        course.isOpen && chapter.isOpen
          ? [[chapter.id, { course, chapter }] as const]
          : [],
      ),
    ),
  );
  if (openChapterById.size === 0) return [];

  const recentSince = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [exerciseResult, profileResult, sessionResult] = await Promise.all([
    supabase
      .from("growth_toolbox_exercises")
      .select("id,title,description,skill,course_id,course_chapter_id,updated_at,sort_order")
      .eq("student_app_id", studentAppId)
      .eq("status", "published")
      .in("course_chapter_id", [...openChapterById.keys()])
      .order("sort_order", { ascending: true }),
    supabase
      .from("student_toolbox_skill_profiles")
      .select("skill,ability_score,valid_sessions,last_practiced_at")
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId),
    supabase
      .from("toolbox_practice_sessions")
      .select("skill,earned_score,max_score,completed_at")
      .eq("student_id", studentId)
      .eq("student_app_id", studentAppId)
      .eq("status", "completed")
      .gte("completed_at", recentSince)
      .order("completed_at", { ascending: false }),
  ]);
  throwReadError("已发布练习", exerciseResult.error);
  throwReadError("能力画像", profileResult.error);
  throwReadError("近期练习", sessionResult.error);

  const profileBySkill = new Map(
    (profileResult.data ?? []).map((profile) => [String(profile.skill), profile]),
  );
  const sessionsBySkill = new Map<string, typeof sessionResult.data>();
  for (const session of sessionResult.data ?? []) {
    const skill = String(session.skill);
    const sessions = sessionsBySkill.get(skill) ?? [];
    sessions.push(session);
    sessionsBySkill.set(skill, sessions);
  }
  const selectedSkills = new Set<string>();
  const tasks: HomeLearningTask[] = [];
  for (const exercise of exerciseResult.data ?? []) {
    const skill = String(exercise.skill);
    if (selectedSkills.has(skill) || !exercise.course_chapter_id || !exercise.course_id) continue;
    const location = openChapterById.get(String(exercise.course_chapter_id));
    if (!location) continue;
    const profile = profileBySkill.get(skill);
    const sessions = sessionsBySkill.get(skill) ?? [];
    let consecutiveLowSessionCount = 0;
    for (const session of sessions) {
      const maxScore = Number(session.max_score);
      const score = maxScore > 0 ? (Number(session.earned_score) / maxScore) * 100 : 100;
      if (score >= DEFAULT_WEAK_ABILITY_THRESHOLD) break;
      consecutiveLowSessionCount += 1;
    }
    const candidate: SpecializedPracticeCandidate = {
      exerciseId: String(exercise.id),
      exerciseTitle: String(exercise.title),
      description: exercise.description ? String(exercise.description) : null,
      skill,
      abilityScore: profile?.ability_score == null ? null : Number(profile.ability_score),
      recentSessionCount: Number(profile?.valid_sessions) || 0,
      consecutiveLowSessionCount,
      courseId: String(exercise.course_id),
      courseChapterId: String(exercise.course_chapter_id),
      courseSlug: location.course.slug,
      lessonSlug: location.chapter.lessonSlug,
      chapterSlug: location.chapter.slug,
      isOpen: true,
      updatedAt: String(profile?.last_practiced_at ?? exercise.updated_at),
    };
    const task = mapSpecializedPracticeTask({
      candidate,
      studentAppId,
      appSlug,
      appLabel,
      space,
    });
    if (task) {
      tasks.push(task);
      selectedSkills.add(skill);
    }
  }
  return tasks;
}
