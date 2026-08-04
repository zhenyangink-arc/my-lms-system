import { redirect } from "next/navigation";

// 旧“成绩项目”详情页已经停用。成绩现在直接读取作业、考试与章节测试结果，
// 历史书签统一回到实时成绩汇总页，避免继续录入重复成绩。
export default function LegacyGradeItemPage() {
  redirect("/dashboard/admin/grades");
}
