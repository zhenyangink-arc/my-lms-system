export const TENANT_STATUS_LABELS: Record<string, string> = {
  active: "正常",
  suspended: "停用",
  archived: "已归档",
};

export const TENANT_STATUS_TONES: Record<
  string,
  { dot: string; text: string }
> = {
  active: { dot: "var(--app-success)", text: "var(--app-success)" },
  suspended: { dot: "var(--app-warm)", text: "var(--app-warm)" },
  archived: { dot: "var(--app-muted-light)", text: "var(--app-muted)" },
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
