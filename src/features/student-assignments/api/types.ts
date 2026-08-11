export type StudentAssignmentScope = "platform" | "tenant";

export type AssignmentMember = {
  id: string;
  full_name: string | null;
  login_id: string | null;
  email: string | null;
};

export type StudentTeacherAssignment = {
  student_id: string;
  teacher_id: string;
};

export type PlatformTenantAssignmentRow = {
  id: string;
  name: string;
  status: string;
  teacherCount: number;
  studentCount: number;
  assignedCount: number;
};

export type PlatformStudentAssignmentResult = {
  scope: "platform";
  canManage: false;
  role: string;
  rows: PlatformTenantAssignmentRow[];
};

export type TenantStudentAssignmentResult = {
  scope: "tenant";
  canManage: true;
  role: string;
  tenantId: string;
  students: AssignmentMember[];
  teachers: AssignmentMember[];
  assignments: StudentTeacherAssignment[];
  assignedStudentIds: string[];
  unassignedStudents: AssignmentMember[];
};

export type StudentAssignmentResult =
  | PlatformStudentAssignmentResult
  | TenantStudentAssignmentResult;

export type StudentAssignmentActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type AssignStudentsToTeachersInput = {
  student_ids: string[];
  teacher_ids: string[];
};

export type RemoveStudentTeacherAssignmentInput = {
  student_id: string;
  teacher_id: string;
};
