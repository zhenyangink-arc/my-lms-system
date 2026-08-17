export const TENANT_STATUS_LABELS: Record<string, string> = {
  active: "正常",
  suspended: "停用",
  archived: "已归档",
};

export const TENANT_STATUS_TONES: Record<
  string,
  { dot: string; text: string }
> = {
  active: { dot: "var(--status-success)", text: "var(--status-success)" },
  suspended: { dot: "var(--status-warning)", text: "var(--status-warning)" },
  archived: { dot: "var(--foreground-subtle)", text: "var(--foreground-muted)" },
};

export const STUDENT_ASSIGNMENT_COLUMN_LABELS: Record<string, string> = {
  tenant: "机构",
  status: "状态",
  teacherCount: "老师数",
  studentCount: "学生数",
  assignedCount: "已分配学生",
  assignmentRate: "分配率",
  teacher: "负责老师",
  students: "负责学生",
};
