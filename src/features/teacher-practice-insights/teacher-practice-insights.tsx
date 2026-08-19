import {
  AlertCircle,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  Clock3,
  MessageSquareText,
  ShieldAlert,
  Target,
  UsersRound,
} from "lucide-react";

import { LocalDateTime } from "@/components/LocalDateTime";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import {
  ManagementMetricStrip,
  ManagementNotice,
} from "@/components/layout/management-page";
import type { ManagementAppAccess } from "@/lib/management-apps";
import { getTeacherAssignedStudentIds } from "@/lib/student-assignments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PracticeRecommendationButton } from "./recommendation-button";
import {
  aggregateChapterWeaknesses,
  aggregateSkillWeaknesses,
  buildNextStepSuggestion,
  PRACTICE_SKILL_LABELS,
  type PracticeSkill,
  type TeacherProgressEvidence,
  type TeacherReviewEvidence,
} from "./model";

type ProfileRow = {
  id: string;
  full_name: string | null;
  login_id: string | null;
  email: string | null;
};

type ProgressRow = {
  student_id: string;
  practice_unit_id: string;
  status: TeacherProgressEvidence["status"];
  progress_percent: number;
  mastery_percent: number;
  last_practiced_at: string | null;
};

type UnitRow = {
  id: string;
  course_chapter_id: string;
  version: number;
};

type ChapterRow = {
  id: string;
  lesson_id: string;
  title: string;
  slug: string | null;
};

type LessonRow = {
  id: string;
  course_id: string;
};

type CourseRow = {
  id: string;
  title: string;
  slug: string | null;
};

type ReviewRow = {
  student_id: string;
  course_id: string | null;
  course_chapter_id: string | null;
  skill: PracticeSkill;
  source_type: string;
  status: "pending" | "reviewing" | "mastered";
  error_count: number;
  feedback_snapshot: Record<string, unknown> | null;
};

type RecommendationRow = {
  id: string;
  student_id: string;
  title: string;
  content: string;
  next_action: string;
  occurred_at: string;
};

const STATUS_PRESENTATION = {
  not_started: {
    label: "未开始",
    icon: CircleDashed,
    color: "var(--foreground-muted)",
  },
  in_progress: {
    label: "巩固中",
    icon: Clock3,
    color: "var(--primary)",
  },
  needs_reinforcement: {
    label: "待加强",
    icon: AlertCircle,
    color: "var(--status-warning)",
  },
  mastered: {
    label: "已掌握",
    icon: CheckCircle2,
    color: "var(--status-success)",
  },
  locked: {
    label: "未开放",
    icon: ShieldAlert,
    color: "var(--foreground-muted)",
  },
  content_preparing: {
    label: "内容准备中",
    icon: CircleDashed,
    color: "var(--support)",
  },
} satisfies Record<
  TeacherProgressEvidence["status"],
  { label: string; icon: typeof Clock3; color: string }
>;

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rubricSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, score]) => typeof score === "string" || typeof score === "number")
    .slice(0, 4);
  return entries.length
    ? entries.map(([key, score]) => `${key}：${String(score)}`).join("；")
    : null;
}

function percentage(value: number) {
  return `${Math.round(Math.max(0, Math.min(100, Number(value) || 0)))}%`;
}

function ProgressStatus({ status }: { status: TeacherProgressEvidence["status"] }) {
  const presentation = STATUS_PRESENTATION[status];
  const Icon = presentation.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold"
      style={{ color: presentation.color }}
    >
      <Icon size={15} aria-hidden="true" />
      {presentation.label}
    </span>
  );
}

function WeaknessList({
  items,
  empty,
}: {
  items: ReturnType<typeof aggregateSkillWeaknesses>;
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-[var(--foreground-muted)]">{empty}</p>;
  }

  const maximum = Math.max(...items.map((item) => item.errorCount), 1);
  return (
    <ol className="space-y-4">
      {items.slice(0, 6).map((item, index) => (
        <li key={item.key}>
          <div className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-semibold">{item.label}</span>
                <span className="text-xs text-[var(--foreground-muted)]">
                  {item.errorCount} 次错误 · {item.unmasteredCount} 项未掌握 · {item.affectedStudentCount} 人
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                <div
                  className="h-full rounded-full bg-[var(--status-warning)]"
                  style={{ width: `${Math.max(6, (item.errorCount / maximum) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export async function TeacherPracticeInsights({
  access,
}: {
  access: ManagementAppAccess;
}) {
  const supabase = await createClient();
  const tenantId = access.tenantId!;
  const studentIds = await getTeacherAssignedStudentIds(
    supabase,
    tenantId,
    access.userId,
    access.appId,
  );

  if (studentIds.length === 0) {
    return (
      <ManagementNotice tone="info">
        当前韩语应用中还没有分配给你的学生，请联系机构负责人完成应用内教学分配。
      </ManagementNotice>
    );
  }

  const admin = createAdminClient();
  const [profilesResult, progressResult, reviewResult, recommendationResult] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id,full_name,login_id,email")
        .in("id", studentIds),
      supabase
        .from("student_chapter_practice_progress")
        .select(
          "student_id,practice_unit_id,status,progress_percent,mastery_percent,last_practiced_at",
        )
        .eq("tenant_id", tenantId)
        .in("student_id", studentIds)
        .order("last_practiced_at", { ascending: false }),
      supabase
        .from("student_review_items")
        .select(
          "student_id,course_id,course_chapter_id,skill,source_type,status,error_count,feedback_snapshot",
        )
        .eq("tenant_id", tenantId)
        .eq("student_app_id", access.appId)
        .in("student_id", studentIds),
      supabase
        .from("learning_record_notes")
        .select("id,student_id,title,content,next_action,occurred_at")
        .eq("tenant_id", tenantId)
        .eq("student_app_id", access.appId)
        .eq("record_type", "plan")
        .eq("status", "active")
        .like("title", "巩固推荐：%")
        .in("student_id", studentIds)
        .order("occurred_at", { ascending: false }),
    ]);

  const dataError = progressResult.error || reviewResult.error || recommendationResult.error;
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const progressRows = (progressResult.data ?? []) as ProgressRow[];
  const reviewRows = (reviewResult.data ?? []) as ReviewRow[];
  const recommendations = (recommendationResult.data ?? []) as RecommendationRow[];
  const unitIds = [...new Set(progressRows.map((item) => item.practice_unit_id))];
  const unitsResult = unitIds.length
    ? await supabase
        .from("chapter_practice_units")
        .select("id,course_chapter_id,version")
        .in("id", unitIds)
    : { data: [] as UnitRow[], error: null };
  const units = (unitsResult.data ?? []) as UnitRow[];
  const chapterIds = [
    ...new Set([
      ...units.map((unit) => unit.course_chapter_id),
      ...reviewRows.flatMap((item) => item.course_chapter_id ? [item.course_chapter_id] : []),
    ]),
  ];
  const chaptersResult = chapterIds.length
    ? await supabase
        .from("course_chapters")
        .select("id,lesson_id,title,slug")
        .in("id", chapterIds)
    : { data: [] as ChapterRow[], error: null };
  const chapters = (chaptersResult.data ?? []) as ChapterRow[];
  const lessonIds = [...new Set(chapters.map((chapter) => chapter.lesson_id))];
  const lessonsResult = lessonIds.length
    ? await supabase
        .from("lessons")
        .select("id,course_id")
        .in("id", lessonIds)
    : { data: [] as LessonRow[], error: null };
  const lessons = (lessonsResult.data ?? []) as LessonRow[];
  const courseIds = [
    ...new Set([
      ...lessons.map((lesson) => lesson.course_id),
      ...reviewRows.flatMap((item) => item.course_id ? [item.course_id] : []),
    ]),
  ];
  const coursesResult = courseIds.length
    ? await supabase
        .from("courses")
        .select("id,title,slug")
        .in("id", courseIds)
    : { data: [] as CourseRow[], error: null };
  const courses = (coursesResult.data ?? []) as CourseRow[];

  const unitById = new Map(units.map((item) => [item.id, item]));
  const chapterById = new Map(chapters.map((item) => [item.id, item]));
  const lessonById = new Map(lessons.map((item) => [item.id, item]));
  const courseById = new Map(courses.map((item) => [item.id, item]));

  const latestProgress = new Map<string, TeacherProgressEvidence & { version: number }>();
  for (const row of progressRows) {
    const unit = unitById.get(row.practice_unit_id);
    const chapter = unit ? chapterById.get(unit.course_chapter_id) : null;
    const lesson = chapter ? lessonById.get(chapter.lesson_id) : null;
    const course = lesson ? courseById.get(lesson.course_id) : null;
    if (!unit || !chapter || !course) continue;
    const key = `${row.student_id}:${chapter.id}`;
    const current = latestProgress.get(key);
    if (current && current.version > unit.version) continue;
    latestProgress.set(key, {
      version: unit.version,
      studentId: row.student_id,
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      courseChapterId: chapter.id,
      chapterTitle: chapter.title,
      chapterSlug: chapter.slug,
      status: row.status,
      progressPercent: Number(row.progress_percent) || 0,
      masteryPercent: Number(row.mastery_percent) || 0,
      lastPracticedAt: row.last_practiced_at,
    });
  }
  const progressEvidence = [...latestProgress.values()];
  const reviewEvidence: TeacherReviewEvidence[] = reviewRows.map((row) => ({
    studentId: row.student_id,
    courseId: row.course_id,
    courseChapterId: row.course_chapter_id,
    chapterTitle: row.course_chapter_id
      ? chapterById.get(row.course_chapter_id)?.title ?? null
      : null,
    skill: row.skill,
    sourceType: row.source_type,
    status: row.status,
    errorCount: Number(row.error_count) || 0,
    feedbackSnapshot: row.feedback_snapshot ?? undefined,
  }));
  const skillWeaknesses = aggregateSkillWeaknesses(reviewEvidence);
  const chapterWeaknesses = aggregateChapterWeaknesses(reviewEvidence);
  const unmasteredReviewCount = reviewEvidence.filter(
    (item) => item.status !== "mastered",
  ).length;
  const masteredProgressCount = progressEvidence.filter(
    (item) => item.status === "mastered",
  ).length;

  return (
    <div className="space-y-5">
      {dataError && (
        <ManagementNotice tone="warning">
          部分学情数据读取失败；页面只展示成功读取的真实记录，请刷新后重试。
        </ManagementNotice>
      )}

      <ManagementMetricStrip
        label="负责学生巩固概况"
        items={[
          { label: "负责学生", value: profiles.length },
          { label: "巩固记录", value: progressEvidence.length },
          { label: "已掌握章节", value: masteredProgressCount },
          { label: "未掌握复习项", value: unmasteredReviewCount },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-[var(--card)] p-4 sm:p-5">
          <CardTitleWithHint
            title="班级薄弱能力"
            description="按负责学生的 skill、来源和掌握状态汇总统一复习项目，只计算尚未掌握的真实错误次数。"
            headingLevel={2}
            titleClassName="text-base font-semibold"
          />
          <div className="mt-5">
            <WeaknessList items={skillWeaknesses} empty="当前没有未掌握的能力错题。" />
          </div>
        </section>

        <section className="rounded-xl border bg-[var(--card)] p-4 sm:p-5">
          <CardTitleWithHint
            title="班级薄弱章节"
            description="按课程章节汇总统一复习项目的错误次数、未掌握项目数和涉及学生人数。"
            headingLevel={2}
            titleClassName="text-base font-semibold"
          />
          <div className="mt-5">
            <WeaknessList items={chapterWeaknesses} empty="当前没有关联章节的未掌握错题。" />
          </div>
        </section>
      </div>

      <section aria-labelledby="student-practice-progress-title">
        <div className="mb-3 flex items-center gap-2">
          <UsersRound size={18} aria-hidden="true" />
          <CardTitleWithHint
            title="学生巩固进度与下一步建议"
            description="进度来自数据库巩固记录；建议按该生错误次数最多的未掌握能力和章节生成，不使用固定文案。"
            headingLevel={2}
            titleClassName="text-base font-semibold"
          />
        </div>

        <div className="space-y-4">
          {profiles
            .sort((left, right) =>
              (left.full_name || left.email || left.id).localeCompare(
                right.full_name || right.email || right.id,
                "zh-CN",
              ),
            )
            .map((student) => {
              const studentProgress = progressEvidence.filter(
                (item) => item.studentId === student.id,
              );
              const studentReviews = reviewEvidence.filter(
                (item) => item.studentId === student.id,
              );
              const suggestion = buildNextStepSuggestion(
                studentProgress,
                studentReviews,
              );
              const studentRecommendations = recommendations.filter(
                (item) => item.student_id === student.id,
              );
              const feedback = studentReviews.filter(
                (item) => item.sourceType === "teacher_speaking_writing_feedback",
              );
              const name = student.full_name || student.login_id || student.email || "未填写姓名";

              return (
                <article key={student.id} className="overflow-hidden rounded-xl border bg-[var(--card)]">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{name}</h3>
                      <p className="mt-1 truncate text-xs text-[var(--foreground-muted)]">
                        {student.login_id || student.email || `账号 …${student.id.slice(-8)}`}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs font-medium">
                      {studentProgress.length} 章巩固记录
                    </span>
                  </header>

                  <div className="space-y-5 p-4 sm:p-5">
                    <section>
                      <CardTitleWithHint
                        title="章节进度"
                        description="分别展示巩固状态、内容完成百分比与掌握百分比；同一章节有多个版本时取最新版本。"
                        headingLevel={4}
                        titleClassName="text-sm font-semibold"
                      />
                      {studentProgress.length > 0 ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {studentProgress.map((item) => (
                            <div key={item.courseChapterId} className="rounded-lg border bg-[var(--surface-soft)] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-xs text-[var(--foreground-muted)]">{item.courseTitle}</p>
                                  <p className="mt-1 font-semibold">{item.chapterTitle}</p>
                                </div>
                                <ProgressStatus status={item.status} />
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <dt className="text-[var(--foreground-muted)]">巩固进度</dt>
                                  <dd className="mt-1 font-semibold tabular-nums">{percentage(item.progressPercent)}</dd>
                                </div>
                                <div>
                                  <dt className="text-[var(--foreground-muted)]">掌握度</dt>
                                  <dd className="mt-1 font-semibold tabular-nums">{percentage(item.masteryPercent)}</dd>
                                </div>
                              </dl>
                              <div className="mt-3">
                                <PracticeRecommendationButton
                                  studentId={student.id}
                                  target={{ type: "chapter", id: item.courseChapterId }}
                                  label={`推荐复习「${item.chapterTitle}」`}
                                  disabled={!access.capabilities.manageAssessments}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-4 text-sm text-[var(--foreground-muted)]">
                          该生尚无章节巩固记录。
                        </p>
                      )}
                    </section>

                    <section className="rounded-lg border-l-4 border-l-[var(--primary)] bg-[var(--surface-soft)] p-4">
                      <div className="flex items-center gap-2">
                        <Target size={17} aria-hidden="true" />
                        <h4 className="text-sm font-semibold">下一步建议</h4>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">
                        {suggestion.text}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {suggestion.skill && (
                          <PracticeRecommendationButton
                            studentId={student.id}
                            target={{ type: "skill", id: suggestion.skill }}
                            label={`推荐${PRACTICE_SKILL_LABELS[suggestion.skill]}专项训练`}
                            disabled={!access.capabilities.manageAssessments}
                          />
                        )}
                        {suggestion.chapterId && !studentProgress.some(
                          (item) => item.courseChapterId === suggestion.chapterId,
                        ) && (
                          <PracticeRecommendationButton
                            studentId={student.id}
                            target={{ type: "chapter", id: suggestion.chapterId }}
                            label={`推荐复习「${suggestion.chapterTitle}」`}
                            disabled={!access.capabilities.manageAssessments}
                          />
                        )}
                      </div>
                      {!access.capabilities.manageAssessments && (
                        <p className="mt-2 text-xs text-[var(--foreground-muted)]">
                          当前账号可查看学情，但未开通该应用的教学任务权限，暂不能发送推荐。
                        </p>
                      )}
                    </section>

                    {feedback.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2">
                          <MessageSquareText size={17} aria-hidden="true" />
                          <CardTitleWithHint
                            title="口语与写作反馈"
                            description="直接读取统一复习项目中的评分标准、单题评语、总体评语与改进任务。"
                            headingLevel={4}
                            titleClassName="text-sm font-semibold"
                          />
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {feedback.slice(0, 4).map((item, index) => {
                            const snapshot = item.feedbackSnapshot ?? {};
                            const comment = stringValue(snapshot.teacherComment)
                              ?? stringValue(snapshot.overallComment);
                            const task = stringValue(snapshot.improvementTask);
                            const rubric = rubricSummary(snapshot.rubric);
                            return (
                              <div key={`${item.sourceType}-${item.skill}-${index}`} className="rounded-lg border p-3 text-sm">
                                <p className="font-semibold">{PRACTICE_SKILL_LABELS[item.skill]}</p>
                                {comment && <p className="mt-2 leading-6">老师评语：{comment}</p>}
                                {rubric && <p className="mt-1 leading-6">评分标准：{rubric}</p>}
                                {task && <p className="mt-1 leading-6">改进任务：{task}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {studentRecommendations.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2">
                          <BookOpenCheck size={17} aria-hidden="true" />
                          <h4 className="text-sm font-semibold">已发送的推荐</h4>
                        </div>
                        <div className="mt-3 space-y-2">
                          {studentRecommendations.slice(0, 3).map((item) => (
                            <div key={item.id} className="rounded-lg border px-3 py-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="font-semibold">{item.title}</p>
                                <time className="text-xs text-[var(--foreground-muted)]">
                                  <LocalDateTime value={item.occurred_at} options={DATE_OPTIONS} />
                                </time>
                              </div>
                              <p className="mt-1 leading-6 text-[var(--foreground-secondary)]">{item.content}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
}
