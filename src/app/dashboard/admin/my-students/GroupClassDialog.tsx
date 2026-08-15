"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Loader2,
  LogIn,
  PhoneOff,
  Plus,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addLiveClassMemberAction,
  createLiveClassAction,
  endLiveClassAction,
  getTeacherLiveClassDashboardAction,
  removeLiveClassMemberAction,
  type TeacherLiveClassDashboard,
} from "@/app/dashboard/live/actions";

type StudentOption = { id: string; full_name: string | null; login_id: string | null };

function studentLabel(student: StudentOption) {
  return student.full_name || student.login_id || student.id.slice(0, 8);
}

/** 老师端"公共课堂"弹窗：发起 + 管理进行中课堂（追加/移除/进入/结束）。 */
export function GroupClassDialog({ students }: { students: StudentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeacherLiveClassDashboard | null>(null);

  // 发起表单
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [chapterSlug, setChapterSlug] = useState("");
  const [creating, setCreating] = useState(false);

  // 追加/移除操作
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [appendOpenFor, setAppendOpenFor] = useState<string | null>(null);
  const [appendChecked, setAppendChecked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getTeacherLiveClassDashboardAction();
    setLoading(false);
    if (result.ok) {
      setData(result.data);
      if (!courseId) {
        const firstCourse = result.data.courses.find((c) =>
          c.lessons.some((l) => l.firstChapterSlug)
        );
        if (firstCourse) {
          setCourseId(firstCourse.id);
          const firstLesson = firstCourse.lessons.find((l) => l.firstChapterSlug);
          if (firstLesson) {
            setLessonId(firstLesson.id);
            setChapterSlug(firstLesson.firstChapterSlug ?? "");
          }
        }
      }
    } else {
      setError(result.error);
    }
  }, [courseId]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void load();
  };

  const goToClass = (sessionId: string) => {
    const space = window.location.pathname.split("/")[1];
    router.push(`/${space}/dashboard/live/${sessionId}`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAppend = (id: string) => {
    setAppendChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCourse = data?.courses.find((c) => c.id === courseId);
  const selectedLesson = selectedCourse?.lessons.find((l) => l.id === lessonId);
  const selectedChapter = selectedLesson?.chapters.find((chapter) => chapter.slug === chapterSlug);

  const handleCreate = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setError("请至少选择一名学生。");
      return;
    }
    if (!selectedLesson || !selectedChapter) {
      setError("请选择有效的课时和章节。");
      return;
    }
    setCreating(true);
    setError(null);
    const result = await createLiveClassAction({
      mode: "group",
      studentIds: ids,
      courseId,
      lessonId,
      chapterSlug: selectedChapter.slug,
    });
    setCreating(false);
    if (result.ok) goToClass(result.session.id);
    else setError(result.error);
  };

  const handleAppend = async (sessionId: string) => {
    const ids = [...appendChecked];
    if (ids.length === 0) {
      setError("请先勾选要追加的学生。");
      return;
    }
    setBusyKey(`append:${sessionId}`);
    setError(null);
    const result = await addLiveClassMemberAction(sessionId, ids);
    setBusyKey(null);
    if (result.ok) {
      setAppendOpenFor(null);
      setAppendChecked(new Set());
      void load();
    } else {
      setError(result.error);
    }
  };

  const handleRemove = async (sessionId: string, studentId: string, studentName: string) => {
    if (!window.confirm(`确定把 ${studentName} 移出课堂？移除后他将立即无法进入课堂。`)) return;
    setBusyKey(`remove:${sessionId}:${studentId}`);
    setError(null);
    const result = await removeLiveClassMemberAction(sessionId, studentId);
    setBusyKey(null);
    if (result.ok) void load();
    else setError(result.error);
  };

  const handleEnd = async (sessionId: string, lessonTitle: string) => {
    if (!window.confirm(`确定结束“${lessonTitle}”公共课堂？结束后所有学生将立即退出，且不能恢复。`)) {
      return;
    }
    setBusyKey(`end:${sessionId}`);
    setError(null);
    const result = await endLiveClassAction(sessionId);
    setBusyKey(null);
    if (result.ok) {
      setAppendOpenFor(null);
      setAppendChecked(new Set());
      void load();
    } else {
      setError(result.error);
    }
  };

  const memberIdsOf = (sessionId: string) =>
    new Set(
      (data?.activeGroupClasses.find((c) => c.id === sessionId)?.members ?? []).map(
        (m) => m.studentId
      )
    );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full bg-[#238777] px-4 py-2 text-xs font-black text-white transition hover:bg-[#1d6d60]"
      >
        <Users size={14} />
        发起公共课堂
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap size={17} />
            公共课堂
          </DialogTitle>
          <DialogDescription>
            一次给多位学生上课。学生在你发起后会在课时页看到课堂入口。
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-[#fdecea] px-3 py-2 text-xs font-semibold text-[#c92a2a]">
            {error}
          </div>
        )}

        {/* 进行中的公共课堂 */}
        <section>
          <h3 className="text-xs font-black tracking-wide text-slate-700">进行中的公共课堂</h3>
          {loading && (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin" /> 加载中…
            </div>
          )}
          {!loading && (data?.activeGroupClasses.length ?? 0) === 0 && (
            <p className="app-muted-text py-3 text-xs">暂无进行中的公共课堂。</p>
          )}
          <div className="mt-2 space-y-3">
            {(data?.activeGroupClasses ?? []).map((cls) => {
              const memberIds = memberIdsOf(cls.id);
              const appendable = students.filter((s) => !memberIds.has(s.id));
              return (
                <div
                  key={cls.id}
                  className="rounded-xl border p-3"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {cls.courseTitle} · {cls.lessonTitle}
                      </p>
                      <p className="app-muted-text mt-0.5 text-[11px]">
                        {cls.members.length} 名学生在场
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => goToClass(cls.id)}
                        disabled={busyKey === `end:${cls.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#238777] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#1d6d60] disabled:opacity-50"
                      >
                        <LogIn size={13} />
                        进入课堂
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleEnd(cls.id, cls.lessonTitle)}
                        disabled={busyKey !== null}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#fdecea] px-3.5 py-1.5 text-xs font-black text-[#c92a2a] transition hover:bg-[#fbdcd9] disabled:opacity-50"
                      >
                        {busyKey === `end:${cls.id}` ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <PhoneOff size={13} />
                        )}
                        结束课堂
                      </button>
                    </div>
                  </div>

                  {/* 在场成员 */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {cls.members.map((member) => (
                      <span
                        key={member.studentId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4f1] px-2.5 py-1 text-[11px] font-semibold text-[#315f52]"
                      >
                        {member.fullName || member.loginId || member.studentId.slice(0, 8)}
                        <button
                          type="button"
                          title="移出课堂"
                          disabled={busyKey === `remove:${cls.id}:${member.studentId}`}
                          onClick={() =>
                            handleRemove(
                              cls.id,
                              member.studentId,
                              member.fullName || member.loginId || "该学生"
                            )
                          }
                          className="text-[#b87131] transition hover:text-[#c92a2a] disabled:opacity-50"
                        >
                          {busyKey === `remove:${cls.id}:${member.studentId}` ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <UserMinus size={12} />
                          )}
                        </button>
                      </span>
                    ))}
                    {cls.members.length === 0 && (
                      <span className="app-muted-text text-[11px]">暂无在场学生</span>
                    )}
                  </div>

                  {/* 追加学生 */}
                  <div className="mt-2.5">
                    {appendOpenFor === cls.id ? (
                      <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--app-border)" }}>
                        {appendable.length === 0 ? (
                          <p className="app-muted-text text-[11px]">所有负责学生都已在课堂中。</p>
                        ) : (
                          <div className="max-h-36 space-y-1 overflow-y-auto">
                            {appendable.map((student) => (
                              <label
                                key={student.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-black/[0.03]"
                              >
                                <input
                                  type="checkbox"
                                  checked={appendChecked.has(student.id)}
                                  onChange={() => toggleAppend(student.id)}
                                />
                                <span className="font-semibold text-slate-700">{studentLabel(student)}</span>
                                {student.login_id && student.login_id !== student.full_name && (
                                  <span className="app-muted-text text-[11px]">{student.login_id}</span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setAppendOpenFor(null);
                              setAppendChecked(new Set());
                            }}
                            className="rounded-md px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-black/[0.04]"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === `append:${cls.id}` || appendChecked.size === 0}
                            onClick={() => handleAppend(cls.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#238777] px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1d6d60] disabled:opacity-50"
                          >
                            {busyKey === `append:${cls.id}` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <UserPlus size={12} />
                            )}
                            追加 {appendChecked.size > 0 ? `(${appendChecked.size})` : ""}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAppendOpenFor(cls.id);
                          setAppendChecked(new Set());
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#238777] transition hover:text-[#1d6d60]"
                      >
                        <UserPlus size={13} />
                        追加学生
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="h-px bg-black/[0.07]" />

        {/* 发起新的公共课堂 */}
        <section>
          <h3 className="text-xs font-black tracking-wide text-slate-700">发起新的公共课堂</h3>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--app-border)" }}>
              <p className="mb-2 text-[11px] font-black text-slate-600">选择学生（可多选）</p>
              <div className="max-h-44 space-y-1 overflow-y-auto">
                {students.map((student) => (
                  <label
                    key={student.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-black/[0.03]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(student.id)}
                      onChange={() => toggleSelect(student.id)}
                    />
                    <span className="font-semibold text-slate-700">{studentLabel(student)}</span>
                    {student.login_id && student.login_id !== student.full_name && (
                      <span className="app-muted-text text-[11px]">{student.login_id}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-3" style={{ borderColor: "var(--app-border)" }}>
              <p className="mb-2 text-[11px] font-black text-slate-600">选择课时</p>
              <label className="mb-2 block">
                <span className="app-muted-text mb-1 block text-[11px]">课程</span>
                <select
                  value={courseId}
                  onChange={(event) => {
                    const nextCourseId = event.target.value;
                    setCourseId(nextCourseId);
                    const nextCourse = data?.courses.find((c) => c.id === nextCourseId);
                    const firstLesson = nextCourse?.lessons.find((l) => l.firstChapterSlug);
                    setLessonId(firstLesson?.id ?? "");
                    setChapterSlug(firstLesson?.firstChapterSlug ?? "");
                  }}
                  className="w-full rounded-lg border px-2.5 py-2 text-xs font-semibold outline-none"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  {(data?.courses ?? []).map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="app-muted-text mb-1 block text-[11px]">课时（含电子书的课时才能上课）</span>
                <select
                  value={lessonId}
                  onChange={(event) => {
                    const nextLessonId = event.target.value;
                    setLessonId(nextLessonId);
                    const nextLesson = selectedCourse?.lessons.find((lesson) => lesson.id === nextLessonId);
                    setChapterSlug(nextLesson?.firstChapterSlug ?? "");
                  }}
                  className="w-full rounded-lg border px-2.5 py-2 text-xs font-semibold outline-none"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  {(selectedCourse?.lessons ?? []).map((lesson) => (
                    <option key={lesson.id} value={lesson.id} disabled={!lesson.firstChapterSlug}>
                      {lesson.title}
                      {!lesson.firstChapterSlug ? "（无电子书）" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-2 block">
                <span className="app-muted-text mb-1 block text-[11px]">起始章节</span>
                <select
                  value={chapterSlug}
                  onChange={(event) => setChapterSlug(event.target.value)}
                  disabled={!selectedLesson || selectedLesson.chapters.length === 0}
                  className="w-full rounded-lg border px-2.5 py-2 text-xs font-semibold outline-none disabled:opacity-50"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  {(selectedLesson?.chapters ?? []).map((chapter) => (
                    <option key={chapter.slug} value={chapter.slug}>
                      {chapter.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="app-muted-text text-[11px]">
              已选 {selectedIds.size} 名学生 · {selectedLesson?.title ?? "未选课时"}
              {selectedChapter ? ` · ${selectedChapter.title}` : ""}
            </p>
            <button
              type="button"
              disabled={creating}
              onClick={handleCreate}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#238777] px-5 py-2 text-xs font-black text-white transition hover:bg-[#1d6d60] disabled:opacity-60"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              发起课堂并进入
            </button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
