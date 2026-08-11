/**
 * 学生分配表单的可序列化状态。
 * 单独放在普通模块中，避免 `use server` 文件导出对象导致加载失败。
 */
export type StudentAssignmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialStudentAssignmentActionState: StudentAssignmentActionState = {
  status: "idle",
  message: "",
};
