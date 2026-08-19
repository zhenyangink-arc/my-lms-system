import {
  TEACHER_CLASS_TASK_STATUSES,
  type TeacherClassTaskStatus,
  type TeacherClassTodaySnapshot,
  type TeacherClassTodayStudent,
  type TeacherClassTodaySummary,
  type TeacherClassTodayTask,
} from "./types.ts";

const SEOUL_TIME_ZONE = "Asia/Seoul";
const taskStatusSet = new Set<string>(TEACHER_CLASS_TASK_STATUSES);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function requiredString(value: unknown, field: string): string {
  const parsed = nullableString(value);
  if (!parsed) throw new Error(`班级今日数据缺少 ${field}`);
  return parsed;
}

function taskStatus(value: unknown): TeacherClassTaskStatus {
  if (typeof value !== "string" || !taskStatusSet.has(value)) {
    throw new Error("班级今日数据包含未知任务状态");
  }
  return value as TeacherClassTaskStatus;
}

function parseSummary(value: unknown): TeacherClassTodaySummary {
  const row = record(value);
  return {
    studentCount: numberValue(row.student_count),
    studiedTodayCount: numberValue(row.studied_today_count),
    requiredTaskTotal: numberValue(row.required_task_total),
    requiredTaskCompleted: numberValue(row.required_task_completed),
    requiredCompletionRate: numberValue(row.required_completion_rate),
    notStartedCount: numberValue(row.not_started_count),
    inProgressCount: numberValue(row.in_progress_count),
    completedCount: numberValue(row.completed_count),
    overdueCount: numberValue(row.overdue_count),
    pendingGradingCount: numberValue(row.pending_grading_count),
    continuousNoLearningCount: numberValue(row.continuous_no_learning_count),
  };
}

function parseStudent(value: unknown): TeacherClassTodayStudent {
  const row = record(value);
  return {
    studentId: requiredString(row.student_id, "student_id"),
    fullName: nullableString(row.full_name),
    loginId: nullableString(row.login_id),
    studiedToday: row.studied_today === true,
    lastActivityAt: nullableString(row.last_activity_at),
    inactiveDays: numberValue(row.inactive_days),
    continuousNoLearning: row.continuous_no_learning === true,
    requiredTaskTotal: numberValue(row.required_task_total),
    requiredTaskCompleted: numberValue(row.required_task_completed),
    notStartedTaskCount: numberValue(row.not_started_task_count),
    inProgressTaskCount: numberValue(row.in_progress_task_count),
    completedTaskCount: numberValue(row.completed_task_count),
    overdueTaskCount: numberValue(row.overdue_task_count),
    pendingGradingTaskCount: numberValue(row.pending_grading_task_count),
  };
}

function parseTask(value: unknown): TeacherClassTodayTask {
  const row = record(value);
  const assignmentType = row.assignment_type;
  if (assignmentType !== "homework" && assignmentType !== "exam") {
    throw new Error("班级今日数据包含未知任务类型");
  }
  return {
    assignmentId: requiredString(row.assignment_id, "assignment_id"),
    title: requiredString(row.title, "title"),
    assignmentType,
    status: taskStatus(row.status),
    startsAt: requiredString(row.starts_at, "starts_at"),
    dueAt: requiredString(row.due_at, "due_at"),
    isRequiredToday: row.is_required_today === true,
  };
}

export function parseTeacherClassTodaySnapshot(
  value: unknown,
): TeacherClassTodaySnapshot {
  const payload = record(value);
  const generatedAt = requiredString(payload.generated_at, "generated_at");
  return {
    generatedAt,
    summary: parseSummary(payload.summary),
    students: Array.isArray(payload.students)
      ? payload.students.map(parseStudent)
      : [],
    tasks: Array.isArray(payload.tasks) ? payload.tasks.map(parseTask) : [],
  };
}

export type TeacherClassTodayFixtureStudent = {
  studentId: string;
  fullName?: string | null;
  loginId?: string | null;
  trackingStartedAt: string;
};

export type TeacherClassTodayFixtureTask = {
  studentId: string;
  assignmentId: string;
  title?: string;
  assignmentType?: "homework" | "exam";
  status: TeacherClassTaskStatus;
  isRequiredToday: boolean;
  startsAt?: string;
  dueAt?: string;
};

export type TeacherClassTodayFixtureActivity = {
  studentId: string;
  occurredAt: string;
};

function seoulDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function calendarDayDifference(later: string, earlier: string): number {
  const [laterYear, laterMonth, laterDay] = later.split("-").map(Number);
  const [earlierYear, earlierMonth, earlierDay] = earlier.split("-").map(Number);
  const laterTime = Date.UTC(laterYear, laterMonth - 1, laterDay);
  const earlierTime = Date.UTC(earlierYear, earlierMonth - 1, earlierDay);
  return Math.max(0, Math.floor((laterTime - earlierTime) / 86_400_000));
}

/**
 * Deterministic fixture implementation of the RPC rollup. Tests pass an
 * explicit authorization set so out-of-scope rows can never enter a result.
 */
export function buildTeacherClassTodayFixtureSnapshot({
  students,
  authorizedStudentIds,
  tasks,
  activities,
  now,
}: {
  students: TeacherClassTodayFixtureStudent[];
  authorizedStudentIds: Iterable<string>;
  tasks: TeacherClassTodayFixtureTask[];
  activities: TeacherClassTodayFixtureActivity[];
  now: Date;
}): TeacherClassTodaySnapshot {
  const authorized = new Set(authorizedStudentIds);
  const todayKey = seoulDateKey(now);
  const rows = students
    .filter((student) => authorized.has(student.studentId))
    .map<TeacherClassTodayStudent>((student) => {
      const studentTasks = tasks.filter(
        (task) => task.studentId === student.studentId,
      );
      const requiredTasks = studentTasks.filter((task) => task.isRequiredToday);
      const studentActivities = activities
        .filter((activity) => activity.studentId === student.studentId)
        .sort(
          (left, right) =>
            Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
        );
      const lastActivityAt = studentActivities[0]?.occurredAt ?? null;
      const inactiveDays = calendarDayDifference(
        todayKey,
        seoulDateKey(lastActivityAt ?? student.trackingStartedAt),
      );
      return {
        studentId: student.studentId,
        fullName: student.fullName ?? null,
        loginId: student.loginId ?? null,
        studiedToday: studentActivities.some(
          (activity) => seoulDateKey(activity.occurredAt) === todayKey,
        ),
        lastActivityAt,
        inactiveDays,
        continuousNoLearning: inactiveDays >= 3,
        requiredTaskTotal: requiredTasks.length,
        requiredTaskCompleted: requiredTasks.filter(
          (task) => task.status === "completed",
        ).length,
        notStartedTaskCount: requiredTasks.filter(
          (task) => task.status === "not_started" || task.status === "locked",
        ).length,
        inProgressTaskCount: requiredTasks.filter(
          (task) => task.status === "in_progress",
        ).length,
        completedTaskCount: requiredTasks.filter(
          (task) => task.status === "completed",
        ).length,
        overdueTaskCount: studentTasks.filter(
          (task) => task.status === "overdue",
        ).length,
        pendingGradingTaskCount: studentTasks.filter(
          (task) => task.status === "pending_grading",
        ).length,
      };
    })
    .sort((left, right) =>
      (left.fullName ?? left.loginId ?? left.studentId).localeCompare(
        right.fullName ?? right.loginId ?? right.studentId,
        "zh-CN",
      ),
    );

  const requiredTaskTotal = rows.reduce(
    (total, student) => total + student.requiredTaskTotal,
    0,
  );
  const requiredTaskCompleted = rows.reduce(
    (total, student) => total + student.requiredTaskCompleted,
    0,
  );
  const countStudents = (
    predicate: (student: TeacherClassTodayStudent) => boolean,
  ) => rows.filter(predicate).length;

  return {
    generatedAt: now.toISOString(),
    summary: {
      studentCount: rows.length,
      studiedTodayCount: countStudents((student) => student.studiedToday),
      requiredTaskTotal,
      requiredTaskCompleted,
      requiredCompletionRate:
        requiredTaskTotal === 0
          ? 0
          : Math.round((requiredTaskCompleted * 1000) / requiredTaskTotal) / 10,
      notStartedCount: countStudents(
        (student) => student.notStartedTaskCount > 0,
      ),
      inProgressCount: countStudents(
        (student) => student.inProgressTaskCount > 0,
      ),
      completedCount: countStudents(
        (student) => student.completedTaskCount > 0,
      ),
      overdueCount: countStudents((student) => student.overdueTaskCount > 0),
      pendingGradingCount: countStudents(
        (student) => student.pendingGradingTaskCount > 0,
      ),
      continuousNoLearningCount: countStudents(
        (student) => student.continuousNoLearning,
      ),
    },
    students: rows,
    tasks: [],
  };
}
