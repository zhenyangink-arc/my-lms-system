import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { scopeDashboardPath } from "@/lib/dashboard-path";
import { getLearningRecordAccess } from "@/lib/learning-records";
import {
  getStudentAppCourseScope,
  withStudentAppSchemaFallback,
} from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { hangulIntroductionChapters } from "@/lib/korean-curriculum";
import {
  LearningRecordBoard,
  type LearningDay,
  type LearningRecordEvent,
} from "./LearningRecordBoard";
import {
  LEARNING_RECORD_TYPE_LABELS,
  type LearningRecordType,
} from "./config";

type ProgressRow = {
  lesson_id: string;
  status: string;
  progress_percent: number | null;
  completed_at: string | null;
  last_viewed_at: string | null;
};

type SubmissionRow = {
  assignment_id: string;
  status: string;
  submitted_at: string;
  graded_at: string | null;
};

type NoteRow = {
  id: string;
  record_type: LearningRecordType;
  title: string;
  content: string;
  next_action: string;
  occurred_at: string;
};

type TimeLogRow = {
  test_slug: string | null;
  source: "ebook" | "lesson" | "toolbox" | "other";
  seconds: number;
  recorded_at: string;
};

type ActivityEventRow = {
  id: string;
  event_type: "conversation_practiced" | "chapter_test_completed";
  source_id: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

type NamedRow = { id: string; title: string };
type ChapterTestRow = {
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
};

const COURSE_KEY_LABELS: Record<string, string> = {
  "hangul-introduction": "韩语字母入门",
  "korean-level-one": "韩国语1级",
  "korean-level-two": "韩国语2级",
};

const TOOLBOX_LABELS: Record<string, string> = {
  "toolbox-vocabulary": "单词练习",
  "toolbox-speaking": "口语练习",
  "toolbox-grammar": "语法练习",
  "toolbox-listening": "听力练习",
};

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateKey(value: string | Date) {
  const parts = dateKeyFormatter.formatToParts(
    typeof value === "string" ? new Date(value) : value,
  );
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function nameMap(rows: unknown) {
  return new Map(
    ((rows ?? []) as NamedRow[]).map((row) => [row.id, row.title]),
  );
}

function assignmentStatus(status: string) {
  if (status === "graded") return "老师已批改";
  if (status === "revision_required") return "需要修改";
  return "已提交待批改";
}

function metadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function metadataNumber(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export default async function LearningRecordsPage() {
  const { supabase, user, role, canManage, dashboardBasePath } =
    await getLearningRecordAccess();
  const isStudent = role === "student";
  const studentAppBasePath = isStudent
    ? dashboardBasePath.replace(/\/dashboard$/, "/apps/korean")
    : dashboardBasePath;
  const recordOldestDate = new Date();
  recordOldestDate.setDate(recordOldestDate.getDate() - 364);
  recordOldestDate.setHours(0, 0, 0, 0);
  const recordOldestIso = recordOldestDate.toISOString();
  const activityOldestDate = new Date();
  activityOldestDate.setDate(activityOldestDate.getDate() - 364);
  activityOldestDate.setHours(0, 0, 0, 0);
  const activityOldestIso = activityOldestDate.toISOString();

  const [koreanScope, assignmentScopeResult] = isStudent
    ? await Promise.all([
        getStudentAppCourseScope(supabase, "korean"),
        withStudentAppSchemaFallback(
          supabase
            .from("learning_assignments")
            .select("id,course_id")
            .eq("student_app_id", STUDENT_APP_IDS.korean),
          () =>
            supabase
              .from("learning_assignments")
              .select("id,course_id"),
        ),
      ])
    : [
        { appId: STUDENT_APP_IDS.korean, categoryIds: [], courseIds: [], lessonIds: [] },
        { data: [] as { id: string; course_id: string | null }[], error: null },
      ];
  const koreanCourseIds = new Set(koreanScope.courseIds);
  const scopedAssignmentIds = (assignmentScopeResult.data ?? [])
    .filter((row) => !row.course_id || koreanCourseIds.has(row.course_id))
    .map((row) => row.id);
  const [
    progressResult,
    submissionResult,
    noteResult,
    timeLogResult,
    activityEventResult,
  ] = await Promise.all([
    isStudent && koreanScope.lessonIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select(
            "lesson_id,status,progress_percent,completed_at,last_viewed_at",
          )
          .eq("user_id", user.id)
          .in("lesson_id", koreanScope.lessonIds)
      : Promise.resolve({ data: [] as ProgressRow[], error: null }),
    isStudent && scopedAssignmentIds.length > 0
      ? supabase
          .from("learning_submissions")
          .select("assignment_id,status,submitted_at,graded_at")
          .eq("student_id", user.id)
          .in("assignment_id", scopedAssignmentIds)
          .gte("submitted_at", recordOldestIso)
      : Promise.resolve({ data: [] as SubmissionRow[], error: null }),
    isStudent
      ? withStudentAppSchemaFallback(
          supabase
            .from("learning_record_notes")
            .select(
              "id,record_type,title,content,next_action,occurred_at",
            )
            .eq("student_id", user.id)
            .eq("student_app_id", STUDENT_APP_IDS.korean)
            .eq("status", "active")
            .eq("visibility", "student_visible"),
          () =>
            supabase
              .from("learning_record_notes")
              .select(
                "id,record_type,title,content,next_action,occurred_at",
              )
              .eq("student_id", user.id)
              .eq("status", "active")
              .eq("visibility", "student_visible"),
        )
      : Promise.resolve({ data: [] as NoteRow[], error: null }),
    isStudent
      ? withStudentAppSchemaFallback(
          supabase
            .from("learning_time_log")
            .select("test_slug,source,seconds,recorded_at")
            .eq("student_id", user.id)
            .eq("student_app_id", STUDENT_APP_IDS.korean)
            .gte("recorded_at", activityOldestIso)
            .order("recorded_at", { ascending: false }),
          () =>
            supabase
              .from("learning_time_log")
              .select("test_slug,source,seconds,recorded_at")
              .eq("student_id", user.id)
              .gte("recorded_at", activityOldestIso)
              .order("recorded_at", { ascending: false }),
        )
      : Promise.resolve({ data: [] as TimeLogRow[], error: null }),
    isStudent
      ? supabase
          .from("student_learning_activity_events")
          .select("id,event_type,source_id,occurred_at,metadata")
          .eq("student_id", user.id)
          .eq("student_app_id", STUDENT_APP_IDS.korean)
          .in("event_type", [
            "conversation_practiced",
            "chapter_test_completed",
          ])
          .gte("occurred_at", activityOldestIso)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] as ActivityEventRow[], error: null }),
  ]);

  const progress = (progressResult.data ?? []) as ProgressRow[];
  const submissions = (submissionResult.data ?? []) as SubmissionRow[];
  const notes = (noteResult.data ?? []) as NoteRow[];
  const timeLogs = (timeLogResult.data ?? []) as TimeLogRow[];
  const activityEvents = (activityEventResult.data ?? []) as ActivityEventRow[];

  const lessonIds = [...new Set(progress.map((row) => row.lesson_id))];
  const assignmentIds = [
    ...new Set(submissions.map((row) => row.assignment_id)),
  ];
  const testSlugs = [
    ...new Set(
      timeLogs
        .map((row) => row.test_slug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ];

  const [lessonNames, assignmentNames, chapterTestsResult] =
    await Promise.all([
      lessonIds.length
        ? supabase.from("lessons").select("id,title").in("id", lessonIds)
        : Promise.resolve({ data: [] as NamedRow[], error: null }),
      assignmentIds.length
        ? supabase
            .from("learning_assignments")
            .select("id,title")
            .in("id", assignmentIds)
        : Promise.resolve({ data: [] as NamedRow[], error: null }),
      testSlugs.length
        ? withStudentAppSchemaFallback(
            supabase
              .from("chapter_tests")
              .select("slug,course_key,chapter_number,title")
              .eq("student_app_id", STUDENT_APP_IDS.korean)
              .in("slug", testSlugs),
            () =>
              supabase
                .from("chapter_tests")
                .select("slug,course_key,chapter_number,title")
                .in("slug", testSlugs),
          )
        : Promise.resolve({ data: [] as ChapterTestRow[], error: null }),
    ]);

  const lessonNameById = nameMap(lessonNames.data);
  const assignmentNameById = nameMap(assignmentNames.data);
  const chapterTestBySlug = new Map(
    ((chapterTestsResult.data ?? []) as ChapterTestRow[]).map((test) => [
      test.slug,
      test,
    ]),
  );
  const events: LearningRecordEvent[] = [];

  type TimeGroup = {
    source: TimeLogRow["source"];
    testSlug: string | null;
    seconds: number;
    latestAt: string;
  };
  const timeGroups = new Map<string, TimeGroup>();
  for (const row of timeLogs) {
    const key = `${dateKey(row.recorded_at)}:${row.source}:${row.test_slug ?? "general"}`;
    const existing = timeGroups.get(key);
    if (existing) {
      existing.seconds += Math.max(0, Number(row.seconds) || 0);
      if (new Date(row.recorded_at) > new Date(existing.latestAt)) {
        existing.latestAt = row.recorded_at;
      }
    } else {
      timeGroups.set(key, {
        source: row.source,
        testSlug: row.test_slug,
        seconds: Math.max(0, Number(row.seconds) || 0),
        latestAt: row.recorded_at,
      });
    }
  }

  for (const [key, group] of timeGroups) {
    const isToolbox = group.source === "toolbox";
    const test = group.testSlug
      ? chapterTestBySlug.get(group.testSlug)
      : undefined;
    const staticChapterIndex = hangulIntroductionChapters.findIndex(
      (chapter) => chapter.slug === group.testSlug,
    );
    const staticChapter = hangulIntroductionChapters[staticChapterIndex];
    const title = isToolbox
      ? TOOLBOX_LABELS[group.testSlug ?? ""] ?? "学习工具练习"
      : test
        ? test.title
        : staticChapter
          ? staticChapter.title
          : "电子书阅读";
    const subtitle = isToolbox
      ? undefined
      : test
        ? `${COURSE_KEY_LABELS[test.course_key] ?? test.course_key} · 第 ${test.chapter_number} 章`
        : staticChapter
          ? `韩语字母入门 · 第 ${staticChapterIndex + 1} 章`
          : undefined;
    events.push({
      id: `time:${key}`,
      category: isToolbox ? "practice" : "course",
      title,
      subtitle,
      description: isToolbox
        ? "当天完成的专项练习时间已经计入学习档案。"
        : staticChapter
          ? `阅读了「${staticChapter.title}」章节电子书。`
          : test
            ? `阅读了「${test.title}」章节电子书。`
            : "完成了一次电子书阅读学习。",
      date: group.latestAt,
      status: isToolbox ? "专项练习" : "有效阅读",
      durationSeconds: group.seconds,
      href: isToolbox
        ? scopeDashboardPath("/dashboard/practice/skills", studentAppBasePath)
        : undefined,
    });
  }

  for (const row of progress) {
    const occurredAt = row.completed_at ?? row.last_viewed_at;
    if (
      row.status !== "completed" ||
      !occurredAt ||
      new Date(occurredAt).getTime() < recordOldestDate.getTime()
    ) {
      continue;
    }
    events.push({
      id: `lesson:${row.lesson_id}:${occurredAt}`,
      category: "course",
      title: lessonNameById.get(row.lesson_id) ?? "课程课时",
      description: "已完成该课程课时。",
      date: occurredAt,
      status: "课时完成",
    });
  }

  for (const row of submissions) {
    const occurredAt = row.graded_at ?? row.submitted_at;
    events.push({
      id: `submission:${row.assignment_id}:${row.submitted_at}`,
      category: "task",
      title: assignmentNameById.get(row.assignment_id) ?? "老师作业或考试",
      description:
        row.status === "revision_required"
          ? "老师已给出修改要求，请查看反馈后重新提交。"
          : row.status === "graded"
            ? "老师已经完成批改，具体分数请到成绩页面查看。"
            : "提交成功，正在等待老师批改。",
      date: occurredAt,
      status: assignmentStatus(row.status),
      href: scopeDashboardPath(
        `/dashboard/assignments/${row.assignment_id}`,
        studentAppBasePath,
      ),
    });
  }

  for (const row of activityEvents) {
    const metadata = row.metadata;
    if (row.event_type === "conversation_practiced") {
      const practiceCount = metadataNumber(metadata, "practice_count") ?? 1;
      const completed = metadataString(metadata, "status") === "completed";
      const historicalSnapshot = metadata?.historical_snapshot === true;
      events.push({
        id: `activity:${row.id}`,
        category: "practice",
        title: metadataString(metadata, "title") ?? "会话练习",
        description: historicalSnapshot
          ? `迁移前累计完成 ${practiceCount} 次练习；旧数据只保留了最后一次时间，之后的每次练习都会独立记录。`
          : `完成第 ${practiceCount} 次会话练习${completed ? "，当前场景已掌握。" : "。"}`,
        date: row.occurred_at,
        status: completed ? "已掌握" : "会话练习",
        href: scopeDashboardPath(
          `/dashboard/conversation-practice/${row.source_id}`,
          studentAppBasePath,
        ),
      });
      continue;
    }

    const score = metadataNumber(metadata, "score");
    const passed = metadata?.passed === true;
    const testSlug = metadataString(metadata, "test_slug");
    events.push({
      id: `activity:${row.id}`,
      category: "task",
      title: metadataString(metadata, "title") ?? "章节测试",
      description:
        score == null
          ? "完成了一次章节测试。"
          : `本次得分 ${score} 分，${passed ? "已经通过。" : "建议复习后再次挑战。"}`,
      date: row.occurred_at,
      status: passed ? "测试通过" : "测试完成",
      href: testSlug
        ? scopeDashboardPath(
            `/dashboard/assignments/korean/${testSlug}`,
            studentAppBasePath,
          )
        : undefined,
    });
  }

  for (const row of notes) {
    if (new Date(row.occurred_at).getTime() < recordOldestDate.getTime()) {
      continue;
    }
    events.push({
      id: `note:${row.id}`,
      category: "teacher",
      title: row.title,
      description: row.content,
      date: row.occurred_at,
      status: LEARNING_RECORD_TYPE_LABELS[row.record_type],
      nextAction: row.next_action,
    });
  }

  events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const today = new Date();
  const todayKey = dateKey(today);
  const dailySeconds = new Map<string, number>();
  for (const row of timeLogs) {
    const key = dateKey(row.recorded_at);
    dailySeconds.set(
      key,
      (dailySeconds.get(key) ?? 0) + Math.max(0, Number(row.seconds) || 0),
    );
  }
  const dailyActivityCounts = new Map<string, number>();
  for (const event of events) {
    if (event.category === "teacher") continue;
    const key = dateKey(event.date);
    dailyActivityCounts.set(key, (dailyActivityCounts.get(key) ?? 0) + 1);
  }
  const learningDays: LearningDay[] = Array.from({ length: 365 }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (364 - index));
    const key = dateKey(day);
    const weekday = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Seoul",
      weekday: "short",
    }).format(day);
    return {
      key,
      label: key === todayKey ? "今天" : weekday.replace("星期", "周"),
      seconds: dailySeconds.get(key) ?? 0,
      activityCount: dailyActivityCounts.get(key) ?? 0,
      isToday: key === todayKey,
    };
  });
  const startOfWeek = new Date(today);
  const daysSinceMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const weekSeconds = timeLogs.reduce(
    (sum, row) =>
      new Date(row.recorded_at).getTime() >= startOfWeek.getTime()
        ? sum + Math.max(0, Number(row.seconds) || 0)
        : sum,
    0,
  );
  let streakDays = 0;
  const activityDays = new Set(
    learningDays
      .filter((day) => day.seconds > 0 || day.activityCount > 0)
      .map((day) => day.key),
  );
  const streakCursor = new Date(today);
  if (!activityDays.has(todayKey)) {
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  while (activityDays.has(dateKey(streakCursor)) && streakDays < 365) {
    streakDays += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const latestTeacherNote =
    events.find((event) => event.category === "teacher") ?? null;
  const dataError = Boolean(
    progressResult.error ||
      submissionResult.error ||
      noteResult.error ||
      timeLogResult.error ||
      activityEventResult.error ||
      lessonNames.error ||
      assignmentNames.error ||
      chapterTestsResult.error,
  );

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {canManage && (
          <div className="flex justify-end">
            <Link
              href={scopeDashboardPath(
                "/dashboard/admin/records",
                dashboardBasePath,
              )}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              进入记录后台
              <ArrowRight size={15} />
            </Link>
          </div>
        )}
        <LearningRecordBoard
          events={events}
          learningDays={learningDays}
          summary={{
            todaySeconds: dailySeconds.get(todayKey) ?? 0,
            weekSeconds,
            streakDays,
            completedCount: progress.filter(
              (row) => row.status === "completed",
            ).length,
          }}
          latestTeacherNote={latestTeacherNote}
          dataError={dataError}
        />
      </div>
    </div>
  );
}
