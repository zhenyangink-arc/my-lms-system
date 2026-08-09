import { getStudentAssignmentData } from "../api/service";
import { PlatformCoverageTable } from "./platform-coverage-table";
import { TeacherAssignmentTable } from "./teacher-assignment-table";
import { UnassignedStudentsTable } from "./unassigned-students-table";

export default async function StudentAssignmentListing() {
  const result = await getStudentAssignmentData();

  if (result.scope === "platform") {
    return (
      <div className="space-y-4">
        <section className="management-table-panel overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="management-summary-table w-full min-w-[620px] border-collapse text-left">
              <thead><tr><th>统计项目</th><th>机构数量</th><th>管理方式</th><th>数据范围</th></tr></thead>
              <tbody><tr><th>当前概览</th><td>{result.rows.length}</td><td>只读查看</td><td>全部机构覆盖统计</td></tr></tbody>
            </table>
          </div>
        </section>
        <PlatformCoverageTable data={result.rows} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead><tr><th>统计项目</th><th>老师人数</th><th>学生人数</th><th>已分配学生</th><th>未分配学生</th></tr></thead>
            <tbody><tr><th>当前数量</th><td>{result.teachers.length}</td><td>{result.students.length}</td><td>{result.assignedStudentIds.length}</td><td>{result.unassignedStudents.length}</td></tr></tbody>
          </table>
        </div>
      </section>
      <TeacherAssignmentTable teachers={result.teachers} students={result.students} assignments={result.assignments} />
      <UnassignedStudentsTable data={result.unassignedStudents} />
    </div>
  );
}
