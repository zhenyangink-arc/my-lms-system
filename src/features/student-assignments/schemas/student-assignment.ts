import { z } from "zod";

const memberIdSchema = z.string().trim().min(1, "成员编号不能为空。");

export const assignStudentsToTeachersSchema = z.object({
  student_ids: z.array(memberIdSchema).min(1, "请至少选择一名学生。"),
  teacher_ids: z.array(memberIdSchema).min(1, "请至少选择一位负责老师。"),
});

export const removeStudentTeacherAssignmentSchema = z.object({
  student_id: memberIdSchema,
  teacher_id: memberIdSchema,
});

export type AssignStudentsToTeachersValues = z.infer<
  typeof assignStudentsToTeachersSchema
>;
export type RemoveStudentTeacherAssignmentValues = z.infer<
  typeof removeStudentTeacherAssignmentSchema
>;
