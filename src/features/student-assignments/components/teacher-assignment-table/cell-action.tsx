import { removeStudentTeacherAssignmentAction } from "@/app/dashboard/admin/student-assignments/actions";

export function AssignmentCellAction({ studentId, teacherId, studentName, teacherName }: { studentId: string; teacherId: string; studentName: string; teacherName: string }) {
  return (
    <form action={removeStudentTeacherAssignmentAction}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="teacher_id" value={teacherId} />
      <button type="submit" aria-label={`解除 ${studentName} 与 ${teacherName} 的负责关系`} title="解除负责" className="h-8 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100">解除负责</button>
    </form>
  );
}
