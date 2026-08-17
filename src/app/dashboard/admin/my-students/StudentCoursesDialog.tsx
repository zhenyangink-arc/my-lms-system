"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, ChevronRight, GraduationCap, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createLiveClassAction } from "@/app/dashboard/live/actions";
import { getStudentCoursesAction, type StudentCourseProgress, type StudentLessonProgress } from "./actions";

/** 把课程按板块分组（保留板块顺序）。 */
function groupCourses(courses: StudentCourseProgress[]) {
  const groups = new Map<string, StudentCourseProgress[]>();
  for (const course of courses) {
    const key = course.categoryTitle ?? "其他课程";
    const list = groups.get(key) ?? [];
    list.push(course);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

function hasLearningProgress(course: StudentCourseProgress) {
  return (
    course.completedLessons > 0 ||
    course.inProgressLessons > 0 ||
    Boolean(course.lastLearnedAt)
  );
}

/** 学习时长（时间制）：与学生端一致，reading_seconds 累计。 */
function formatReadingTime(seconds: number) {
  if (seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  return minutes < 1 ? "不足 1 分钟" : `${minutes} 分钟`;
}

function CourseRow({ course, expanded, onToggle, expandedLessons, onToggleLesson, startingLessonId, onStartLive }: {
  course: StudentCourseProgress;
  expanded: boolean;
  onToggle: () => void;
  expandedLessons: Set<string>;
  onToggleLesson: (lessonId: string) => void;
  startingLessonId: string | null;
  onStartLive: (lesson: StudentLessonProgress, courseId: string) => void;
}) {
  return (
    <div className="border-b text-xs last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.018]"
      >
        <ChevronRight size={13} className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1 truncate font-semibold">{course.courseTitle}</span>
        <span className="app-muted-text hidden shrink-0 sm:block">
          {course.completedLessons}/{course.totalLessons} 课时
        </span>
        <span className="w-10 shrink-0 text-right font-medium tabular-nums">{course.percent}%</span>
      </button>
      <div className="px-4 pb-2">
        <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--border-subtle)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${course.percent}%`, backgroundColor: "var(--primary)" }}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3">
          <div className="app-muted-text mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span>完成 {course.completedLessons}</span>
            <span>进行中 {course.inProgressLessons}</span>
            <span>共 {course.totalLessons} 课时</span>
          </div>
          <div className="overflow-hidden rounded-md border" style={{ borderColor: "var(--border)" }}>
            {course.lessons.map((lesson, index) => {
              const statusColor =
                lesson.status === "completed"
                  ? "var(--status-success)"
                  : lesson.status === "in_progress"
                    ? "var(--status-warning)"
                    : "var(--foreground-muted)";
              const statusDot =
                lesson.status === "completed"
                  ? "var(--status-success)"
                  : lesson.status === "in_progress"
                    ? "var(--status-warning)"
                    : "var(--border)";
              const lessonExpanded = expandedLessons.has(lesson.lessonId);
              return (
                <div
                  key={lesson.lessonId}
                  className={`${index > 0 ? "border-t" : ""} bg-white`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => onToggleLesson(lesson.lessonId)}
                    aria-expanded={lessonExpanded}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-black/[0.018]"
                  >
                    <ChevronRight
                      size={12}
                      className={`shrink-0 transition-transform ${lessonExpanded ? "rotate-90" : ""}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{lesson.lessonTitle}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium" style={{ color: statusColor }}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusDot }} />
                      {lesson.status === "completed" ? "已完成" : lesson.status === "in_progress" ? "进行中" : "未学习"}
                    </span>
                    {lesson.chapters.length > 0 && (
                      <span className="app-muted-text w-20 shrink-0 text-right text-[11px] tabular-nums">
                        {formatReadingTime(lesson.readingSeconds) ?? `0/${lesson.chapters.length} 章`}
                      </span>
                    )}
                  </button>
                  {lesson.chapters.length > 0 && (
                    <div className="flex items-center justify-end px-3 pb-1.5">
                      <button
                        type="button"
                        onClick={() => onStartLive(lesson, course.courseId)}
                        disabled={startingLessonId === lesson.lessonId}
                        title="进入该课时的电子书，给学生实时上课、画笔圈点"
                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold text-[#238777] transition hover:bg-[#e9f6f1] disabled:opacity-60"
                        style={{ borderColor: "var(--border)" }}
                      >
                        {startingLessonId === lesson.lessonId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <GraduationCap size={12} />
                        )}
                        上课
                      </button>
                    </div>
                  )}
                  {lessonExpanded && lesson.chapters.length > 0 && (
                    <div className="px-3 pb-2 pl-9">
                      <div className="rounded-md border px-3 py-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-soft)" }}>
                        {lesson.chapters.map((chapter, chapterIndex) => {
                          const isLocked = chapter.status === "locked";
                          const chapterColor =
                            chapter.status === "completed"
                              ? "var(--status-success)"
                              : chapter.status === "in_progress"
                                ? "var(--status-warning)"
                                : "var(--foreground-muted)";
                          const chapterDot =
                            chapter.status === "completed"
                              ? "var(--status-success)"
                              : chapter.status === "in_progress"
                                ? "var(--status-warning)"
                                : "var(--border)";
                          return (
                            <div
                              key={chapter.id}
                              className={`flex items-center gap-2 py-1 text-[11px] ${chapterIndex > 0 ? "border-t" : ""}`}
                              style={{ borderColor: "var(--border)" }}
                            >
                              <span className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: chapterDot }} />
                              <span className={`min-w-0 flex-1 truncate font-medium ${isLocked ? "opacity-50" : ""}`}>
                                {chapter.sortOrder}. {chapter.title}
                              </span>
                              <span className="shrink-0 font-medium" style={{ color: chapterColor }}>
                                {chapter.status === "completed"
                                  ? "已完成"
                                  : chapter.status === "in_progress"
                                    ? "进行中"
                                    : isLocked
                                      ? "锁定中"
                                      : "未开始"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function StudentCoursesDialog({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof getStudentCoursesAction>> | null>(null);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null);
  const router = useRouter();

  // 开始实时伴学课堂：进入该课时第一章的电子书，老师讲课 + 画笔圈点。
  const handleStartLive = useCallback(
    async (lesson: StudentLessonProgress, courseId: string) => {
      const firstChapter = lesson.chapters[0];
      if (!firstChapter?.slug || startingLessonId) return;
      setStartingLessonId(lesson.lessonId);
      const resultAction = await createLiveClassAction({
        studentId,
        courseId,
        lessonId: lesson.lessonId,
        chapterSlug: firstChapter.slug,
      });
      setStartingLessonId(null);
      if (resultAction.ok) {
        const space = window.location.pathname.split("/")[1];
        router.push(`/${space}/dashboard/live/${resultAction.session.id}`);
      }
    },
    [studentId, startingLessonId, router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setExpandedCourse(null);
    setExpandedLessons(new Set());
    try {
      const data = await getStudentCoursesAction(studentId);
      setResult(data);
      if (data.ok) {
        // 默认收起没有学习进度的板块；有进度的板块保持展开。
        const collapsed = new Set<string>();
        for (const [groupTitle, groupCoursesList] of groupCourses(data.courses)) {
          if (!groupCoursesList.some((course) => hasLearningProgress(course))) {
            collapsed.add(groupTitle);
          }
        }
        setCollapsedGroups(collapsed);
        // 自动展开学生正在学的课程（进行中优先，其次有进度/最近学习过的）。
        const activeCourse =
          data.courses.find((course) => course.inProgressLessons > 0) ??
          data.courses.find((course) => hasLearningProgress(course));
        setExpandedCourse(activeCourse?.courseId ?? null);
        // 课时默认展开有进度的（进行中/已完成），未学习的课时收起。
        const expandedLessonIds = new Set<string>();
        for (const course of data.courses) {
          for (const lesson of course.lessons) {
            if (lesson.status !== "not_started") {
              expandedLessonIds.add(lesson.lessonId);
            }
          }
        }
        setExpandedLessons(expandedLessonIds);
      }
    } catch {
      setResult({ ok: false, error: "课程进度加载失败，请稍后重试。" });
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger
        type="button"
        className="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold transition hover:bg-black/[0.035]"
        style={{ borderColor: "var(--border)" }}
      >
        课程
      </DialogTrigger>
      <DialogContent className="max-h-[1100px] w-full max-w-[600px] gap-0 overflow-y-auto p-0 sm:max-w-[600px]">
        <DialogHeader className="border-b px-5 py-4 pr-12 text-left" style={{ borderColor: "var(--border)" }}>
          <DialogTitle className="text-sm font-semibold">学生课程进度</DialogTitle>
          <DialogDescription className="text-xs">{studentName} 正在学习的课程与课时进度。</DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm">
            <Loader2 className="animate-spin" size={18} style={{ color: "var(--foreground-muted)" }} />
            <p className="app-muted-text text-xs">正在加载课程进度…</p>
          </div>
        )}

        {!loading && result && result.ok === false && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BookOpenCheck size={20} className="app-muted-text opacity-40" />
            <p className="text-xs font-medium">{result.error}</p>
          </div>
        )}

        {!loading && result && result.ok === true && (
          <div className="p-4">
            {result.courses.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                <BookOpenCheck size={22} className="app-muted-text opacity-40" />
                <p className="app-muted-text text-xs">本机构还没有已发布的课程</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupCourses(result.courses).map(([groupTitle, groupCoursesList]) => {
                  const collapsed = collapsedGroups.has(groupTitle);
                    return (
                      <div key={groupTitle}>
                        <button
                          type="button"
                          onClick={() =>
                            setCollapsedGroups((current) => {
                              const next = new Set(current);
                              if (next.has(groupTitle)) next.delete(groupTitle);
                              else next.add(groupTitle);
                              return next;
                            })
                          }
                          aria-expanded={!collapsed}
                          className="flex w-full items-center gap-2 rounded-md px-1 pb-1.5 pt-1 text-left text-[11px] font-semibold transition hover:bg-black/[0.018]"
                        >
                          <ChevronRight
                            size={13}
                            className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`}
                          />
                          <span>{groupTitle}</span>
                          <span className="app-muted-text font-medium">{groupCoursesList.length} 门课</span>
                        </button>
                        {!collapsed && (
                          <div className="overflow-hidden rounded-md border" style={{ borderColor: "var(--border)" }}>
                            {groupCoursesList.map((course) => (
                              <CourseRow
                                key={course.courseId}
                                course={course}
                                expanded={expandedCourse === course.courseId}
                                onToggle={() =>
                                  setExpandedCourse((current) =>
                                    current === course.courseId ? null : course.courseId
                                  )
                                }
                                expandedLessons={expandedLessons}
                                onToggleLesson={(lessonId) =>
                                  setExpandedLessons((current) => {
                                    const next = new Set(current);
                                    if (next.has(lessonId)) next.delete(lessonId);
                                    else next.add(lessonId);
                                    return next;
                                  })
                                }
                                startingLessonId={startingLessonId}
                                onStartLive={handleStartLive}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
