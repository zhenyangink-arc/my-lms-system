import { ClipboardList } from "lucide-react";
import { ComingSoonPage } from "../ComingSoonPage";

export default function AssignmentsPage() {
  return (
    <ComingSoonPage
      title="作业与考试"
      description="章节测验、听力测试、写作作业和模拟考试将在这里统一管理。"
      icon={<ClipboardList size={26} style={{ color: "var(--app-accent)" }} />}
    />
  );
}